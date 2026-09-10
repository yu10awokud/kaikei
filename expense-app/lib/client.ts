'use client';

// ============================================================
// 画面から API を呼ぶときの共通処理
//   サーバーが返す { error: '...' } を必ず例外として拾い、
//   画面に日本語のメッセージを出せるようにする。
// ============================================================

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { cache: 'no-store', ...init });
  } catch {
    throw new Error('通信に失敗しました。電波の状況を確認して、もう一度お試しください。');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // JSON で返ってこなかった場合は下の分岐でまとめて扱う
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `エラーが発生しました（${res.status}）。時間をおいて、もう一度お試しください。`;
    throw new Error(message);
  }

  return body as T;
}

export function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '不明なエラーが発生しました。';
}
