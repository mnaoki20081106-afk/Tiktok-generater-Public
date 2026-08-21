/**
 * 画像を指定サイズ以下になるまで自動で圧縮する。qualityを二分探索し、
 * それでも収まらない場合は段階的に縮小する(OGP画像の「800KB以下が望ましい」
 * 警告に対する「圧縮する」ボタンから使う)。
 */

type CompressOptions = {
  targetBytes: number;
  mimeType: 'auto' | 'image/webp' | 'image/jpeg';
  minQuality: number;
  maxQuality: number;
  qualitySearchSteps: number;
  minScale: number;
  scaleStep: number;
};

const DEFAULT_OPTIONS: CompressOptions = {
  targetBytes: 800 * 1024,
  mimeType: 'auto', // PNGはqualityが効かないため非対応。auto時はwebp対応ブラウザならwebp、それ以外はjpeg
  minQuality: 0.05,
  maxQuality: 0.95,
  qualitySearchSteps: 8,
  minScale: 0.3,
  scaleStep: 0.85,
};

let webpSupportPromise: Promise<boolean> | null = null;

// canvas.toBlob("image/webp")が実際にwebpを返すか確認する。
// 非対応ブラウザはpng等にフォールバックして返すことがあるため、typeを見て判定する。
function detectWebpSupport(): Promise<boolean> {
  if (webpSupportPromise) return webpSupportPromise;
  webpSupportPromise = new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    canvas.toBlob((blob) => resolve(!!blob && blob.type === 'image/webp'), 'image/webp');
  });
  return webpSupportPromise;
}

async function resolveMimeType(mimeType: CompressOptions['mimeType']): Promise<string> {
  if (mimeType !== 'auto') return mimeType;
  return (await detectWebpSupport()) ? 'image/webp' : 'image/jpeg';
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function drawToCanvas(image: HTMLImageElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), mimeType, quality);
  });
}

// 指定canvasに対して、targetBytes以下になる最大qualityを二分探索する。
// 見つからなければminQualityでの結果を返す(目標未達ならcallerが縮小して再試行)。
async function searchQualityForTarget(
  canvas: HTMLCanvasElement,
  opts: CompressOptions & { mimeType: string }
): Promise<{ blob: Blob; quality: number }> {
  let lo = opts.minQuality;
  let hi = opts.maxQuality;
  let best = await canvasToBlob(canvas, opts.mimeType, opts.minQuality);

  if (best.size > opts.targetBytes) {
    // 最低品質でも収まらない → これ以上qualityを探索しても無駄なので即返す
    return { blob: best, quality: opts.minQuality };
  }

  let bestQuality = opts.minQuality;

  for (let i = 0; i < opts.qualitySearchSteps; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, opts.mimeType, mid);

    if (blob.size <= opts.targetBytes) {
      best = blob;
      bestQuality = mid;
      lo = mid; // まだ上げられる可能性がある
    } else {
      hi = mid; // 下げる必要がある
    }
  }

  return { blob: best, quality: bestQuality };
}

export async function compressToTargetSize(blob: Blob, options: Partial<CompressOptions> = {}): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const mimeType = await resolveMimeType(opts.mimeType);
  const image = await loadImage(blob);

  let scale = 1;
  let result: { blob: Blob; quality: number } | null = null;

  while (scale >= opts.minScale) {
    const canvas = drawToCanvas(image, scale);
    result = await searchQualityForTarget(canvas, { ...opts, mimeType } as CompressOptions & { mimeType: string });
    if (result.blob.size <= opts.targetBytes) {
      return result.blob;
    }
    scale *= opts.scaleStep;
  }

  // 縮小してもminQualityでも目標に届かない場合は、これまでで一番小さかった結果を返す(妥協案)
  return result!.blob;
}
