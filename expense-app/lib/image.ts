'use client';

// ============================================================
// 領収書の写真を、送る前にブラウザ側で縮小・圧縮する
//   スマホの写真はそのままだと 3〜5MB あり、通信も保存も重いので、
//   長辺 1600px・JPEG 品質 82% に落としてから送ります。
//   （領収書の文字が読める程度は十分に残ります）
// ============================================================

/** 縮小後の長辺の最大ピクセル数 */
const MAX_EDGE = 1600;
/** JPEG の品質（0〜1） */
const QUALITY = 0.82;

/** 画像を読み込む。写真の向き（EXIF）もできる限り反映する。 */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // 古いブラウザや未対応の形式のときは、下の <img> 経由にフォールバックする
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像を読み込めませんでした。'));
      img.src = url;
    });
  } finally {
    // 読み込み後は使い終わったURLを解放する（onload の後でも描画には影響しない）
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export type ResizedImage = {
  /** 送信用の JPEG */
  file: File;
  /** 画面にプレビューを出すための URL。使い終わったら releasePreview で解放する */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
};

/** 縮小して JPEG にした画像を返す */
export async function resizeToJpeg(file: File): Promise<ResizedImage> {
  const source = await loadImage(file);
  const sourceWidth = 'width' in source ? source.width : 0;
  const sourceHeight = 'height' in source ? source.height : 0;
  if (!sourceWidth || !sourceHeight) throw new Error('画像のサイズを読み取れませんでした。');

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('この端末では画像を処理できませんでした。');
  // 写真の白飛び部分が透明にならないよう、下地を白で塗ってから描く
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  if ('close' in source && typeof source.close === 'function') source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) throw new Error('画像を変換できませんでした。');

  return {
    file: new File([blob], 'receipt.jpg', { type: 'image/jpeg' }),
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    bytes: blob.size,
  };
}

/** プレビュー用の URL を解放する */
export function releasePreview(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

/** 12345 → '12 KB' のような表示 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
