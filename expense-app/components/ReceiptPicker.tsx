'use client';

import { useEffect, useRef, useState } from 'react';
import { formatBytes, releasePreview, resizeToJpeg } from '@/lib/image';
import { toErrorMessage } from '@/lib/client';

// ============================================================
// 領収書の写真を選ぶ部品
//   ・「カメラで撮影」と「ライブラリから選ぶ」を分けている
//     （capture 属性を付けた input はカメラが直接立ち上がる）
//   ・選んだ直後にブラウザ側で縮小・JPEG化してからプレビューする
// ============================================================

export type ReceiptPickerProps = {
  /** 縮小済みの画像。まだ選んでいなければ null */
  file: File | null;
  onChange: (file: File | null) => void;
};

export default function ReceiptPicker({ file, onChange }: ReceiptPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // プレビュー用の URL は、差し替わったときと画面を離れるときに必ず解放する。
  // （解放を1か所にまとめておくと、消し忘れも二重解放も起きない）
  useEffect(() => () => releasePreview(previewUrl), [previewUrl]);

  // 保存が終わって親が file を空にしたら、プレビューも消す
  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null);
      setInfo(null);
    }
  }, [file]);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    // 同じ写真をもう一度選んでも反応するように、input の値は毎回空にする
    e.target.value = '';
    if (!picked) return;

    setBusy(true);
    setError(null);
    try {
      const resized = await resizeToJpeg(picked);
      setPreviewUrl(resized.previewUrl);
      setInfo(`${resized.width}×${resized.height} / ${formatBytes(resized.bytes)}`);
      onChange(resized.file);
    } catch (err) {
      setError(toErrorMessage(err));
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreviewUrl(null);
    setInfo(null);
    setError(null);
    onChange(null);
  }

  return (
    <div>
      <span className="field-label">領収書の写真</span>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost flex-1"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          カメラで撮影
        </button>
        <button
          type="button"
          className="btn-ghost flex-1"
          disabled={busy}
          onClick={() => libraryRef.current?.click()}
        >
          ライブラリから選ぶ
        </button>
      </div>

      {/* capture="environment" が付いた方は、スマホで外側カメラが直接起動する */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />

      {busy && <p className="mt-2 text-sm text-sub">写真を縮小しています…</p>}
      {error && <p className="mt-2 text-sm font-bold text-danger">{error}</p>}

      {previewUrl && (
        <div className="mt-3 flex items-start gap-3">
          {/* 縮小済みのプレビュー。next/image を使うと外部URLの設定が要るので img を使う */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="選んだ領収書のプレビュー"
            className="h-24 w-24 rounded-lg border border-line object-cover"
          />
          <div className="text-sm text-sub">
            <p>縮小して保存します</p>
            {info && <p className="mt-0.5">{info}</p>}
            <button type="button" className="mt-2 text-danger underline" onClick={clear}>
              取り消す
            </button>
          </div>
        </div>
      )}

      {!previewUrl && !busy && (
        <p className="mt-2 text-xs text-sub">
          写真は自動で縮小してから保存します。領収書が無い支出は、写真なしでも登録できます。
        </p>
      )}
    </div>
  );
}
