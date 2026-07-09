"""Claude API 呼び出しの共通処理（リトライ・コスト集計・画像エンコード）。"""

import base64
import json
import os
import random
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

import anthropic  # noqa: E402

_client = None


def client():
    global _client
    if _client is None:
        # ANTHROPIC_API_KEY を環境変数から解決（キーの直書き禁止）
        _client = anthropic.Anthropic()
    return _client


class CostTracker:
    """トークン使用量と概算コストを積算する。"""

    def __init__(self):
        self.input_tokens = 0
        self.output_tokens = 0
        self.usd = 0.0

    def add(self, model, usage):
        it = (getattr(usage, "input_tokens", 0) or 0)
        it += (getattr(usage, "cache_read_input_tokens", 0) or 0)
        it += (getattr(usage, "cache_creation_input_tokens", 0) or 0)
        ot = (getattr(usage, "output_tokens", 0) or 0)
        self.input_tokens += it
        self.output_tokens += ot
        price = config.PRICING.get(model, {"input": 0.0, "output": 0.0})
        self.usd += it / 1_000_000 * price["input"] + ot / 1_000_000 * price["output"]

    def summary(self):
        return (f"[累計] in={self.input_tokens:,}tok out={self.output_tokens:,}tok "
                f"概算=${self.usd:.4f}")


COST = CostTracker()


def encode_image(path):
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def image_block(path):
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": encode_image(path),
        },
    }


_RETRYABLE = (
    anthropic.RateLimitError,
    anthropic.APIStatusError,
    anthropic.APIConnectionError,
    ValueError,
    json.JSONDecodeError,
)


def call_text(model, system, content, max_tokens, thinking=False):
    """1回のメッセージを送り、テキスト（=モデルの本文）を返す。

    thinking=True のときは adaptive thinking を有効にし、大きな出力でも
    タイムアウトしないよう streaming で最終メッセージを取得する。
    """
    last = None
    for attempt in range(config.MAX_RETRIES):
        try:
            kwargs = dict(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": content}],
            )
            if thinking:
                kwargs["thinking"] = {"type": "adaptive"}
                with client().messages.stream(**kwargs) as stream:
                    msg = stream.get_final_message()
            else:
                msg = client().messages.create(**kwargs)

            COST.add(model, msg.usage)

            if getattr(msg, "stop_reason", None) == "refusal":
                raise ValueError("モデルが安全上の理由で応答を拒否しました")

            text = "".join(b.text for b in msg.content if b.type == "text")
            if not text.strip():
                raise ValueError("空の応答を受け取りました")
            return text
        except _RETRYABLE as e:
            last = e
            delay = min(config.BASE_DELAY * (2 ** attempt) + random.uniform(0, 1),
                        config.MAX_DELAY)
            print(f"    [リトライ {attempt + 1}/{config.MAX_RETRIES}] "
                  f"{type(e).__name__}: {e} — {delay:.1f}s 待機", file=sys.stderr)
            time.sleep(delay)
    raise last


def parse_json(text):
    """モデルのテキスト応答から JSON オブジェクトを頑健に取り出す。"""
    t = text.strip()
    # 先頭・末尾のコードフェンスを除去
    t = re.sub(r"^```[a-zA-Z0-9]*\s*", "", t)
    t = re.sub(r"\s*```$", "", t.strip())
    # 最初の { から最後の } までを対象にする
    start = t.find("{")
    end = t.rfind("}")
    if start != -1 and end != -1 and end > start:
        t = t[start:end + 1]
    return json.loads(t)


def call_json(model, system, content, max_tokens, thinking=False):
    """JSON を返すことを期待して呼び出し、dict を返す。"""
    text = call_text(model, system, content, max_tokens, thinking=thinking)
    return parse_json(text)
