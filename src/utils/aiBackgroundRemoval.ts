/**
 * AI Neural Network Background Removal Engine
 * 100% Client-side in-browser WebAssembly & ONNX Subject Segmentation
 * Solves uneven background lighting, cast shadows, hair strands, and complex portraits
 * where naive color tolerance fails.
 */

import { removeBackground as imglyRemoveBackground, Config } from '@imgly/background-removal';

export interface AiRemovalProgress {
  stage: 'loading' | 'processing' | 'finishing';
  progress: number; // 0 to 100
  message: string;
}

// In-memory cache for processed Blobs keyed by File name + size + lastModified
const aiResultCache = new Map<string, { blob: Blob; url: string; imageData: ImageData }>();

/**
 * MediaPipe Selfie Segmentation (Runs 100% locally via WebAssembly, ~50ms, zero external network needed)
 */
async function segmentWithMediaPipe(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  onProgress?: (info: AiRemovalProgress) => void
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number } | null> {
  try {
    if (typeof window === 'undefined' || !(window as any).SelfieSegmentation) {
      return null;
    }

    onProgress?.({
      stage: 'loading',
      progress: 25,
      message: '正在调用本地极速人像分割引擎...',
    });

    const SelfieSegmentationClass = (window as any).SelfieSegmentation;
    const selfie = new SelfieSegmentationClass({
      locateFile: (file: string) => `/mediapipe/selfie_segmentation/${file}`,
    });

    selfie.setOptions({
      modelSelection: 1, // 1: Landscape model (more accurate for bust, shoulders & torso)
      selfieMode: false,
    });

    const width = imageSource instanceof HTMLImageElement ? imageSource.naturalWidth || imageSource.width : imageSource.width;
    const height = imageSource instanceof HTMLImageElement ? imageSource.naturalHeight || imageSource.height : imageSource.height;

    onProgress?.({
      stage: 'processing',
      progress: 55,
      message: 'AI 正在高精度识别人像轮廓与双肩衣服...',
    });

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { selfie.close(); } catch {}
        reject(new Error('MediaPipe timeout'));
      }, 4000);

      selfie.onResults((results: any) => {
        clearTimeout(timeout);
        try {
          const mask = results.segmentationMask;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

          // 1. Draw source image
          ctx.drawImage(imageSource, 0, 0, width, height);

          // 2. Apply segmentation mask
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(mask, 0, 0, width, height);
          ctx.globalCompositeOperation = 'source-over';

          // 3. Ensure clothing & shoulders have solid alpha while cutting off white background fringes
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          const shoulderCutoffY = Math.round(height * 0.32);

          for (let y = 0; y < height; y++) {
            const row = y * width;
            const isTorso = y >= shoulderCutoffY;
            for (let x = 0; x < width; x++) {
              const p = (row + x) * 4;
              const a = data[p + 3];
              if (a === 0) continue;

              const r = data[p];
              const g = data[p + 1];
              const b = data[p + 2];
              const isWhiteSpill = r > 215 && g > 215 && b > 215;

              if (isTorso) {
                // For clothing/shoulders: clear white wall spill, solidify authentic fabric
                if (a < 115 || (isWhiteSpill && a < 210)) {
                  data[p + 3] = 0; // Cut off white background edge
                } else if (a >= 140) {
                  data[p + 3] = 255; // CLOTHING FABRIC IS SOLID OPAQUE
                }
              } else {
                // For head/hair: clean cut off weak background spill
                if (a < 65 || (isWhiteSpill && a < 160)) {
                  data[p + 3] = 0;
                }
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);

          canvas.toBlob((blob) => {
            try { selfie.close(); } catch {}
            if (!blob) {
              reject(new Error('Canvas blob conversion failed'));
              return;
            }
            const url = URL.createObjectURL(blob);
            resolve({ blob, url, imageData: imgData, width, height });
          }, 'image/png');
        } catch (err) {
          try { selfie.close(); } catch {}
          reject(err);
        }
      });

      selfie.send({ image: imageSource }).catch((err: any) => {
        clearTimeout(timeout);
        try { selfie.close(); } catch {}
        reject(err);
      });
    });
  } catch (err) {
    console.warn('Local MediaPipe selfie segmentation unavailable, continuing to neural fallback:', err);
    return null;
  }
}

/**
 * Remove background using client-side AI neural network model.
 * Ideal for complex real-world photos, uneven shadows, gradients, and portraits.
 */
export async function removeBackgroundWithAI(
  imageSource: File | Blob | ImageData | HTMLImageElement | string,
  cacheKey?: string,
  onProgress?: (info: AiRemovalProgress) => void
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number }> {
  // Check cache first
  if (cacheKey && aiResultCache.has(cacheKey)) {
    const cached = aiResultCache.get(cacheKey)!;
    return {
      blob: cached.blob,
      url: cached.url,
      imageData: cached.imageData,
      width: cached.imageData.width,
      height: cached.imageData.height,
    };
  }

  onProgress?.({
    stage: 'loading',
    progress: 10,
    message: '正在启动人像高精度识别与智能抠图...',
  });

  try {
    // Pre-downscale large images to max 900px so WebAssembly / Canvas operations are fast and never freeze the browser
    let srcImg: HTMLImageElement;
    let tempUrl: string | null = null;
    if (imageSource instanceof HTMLImageElement) {
      srcImg = imageSource;
    } else if (imageSource instanceof ImageData) {
      const c = document.createElement('canvas');
      c.width = imageSource.width;
      c.height = imageSource.height;
      const ctx = c.getContext('2d')!;
      ctx.putImageData(imageSource, 0, 0);
      tempUrl = c.toDataURL('image/png');
      srcImg = new Image();
      await new Promise<void>((res) => {
        srcImg.onload = () => res();
        srcImg.src = tempUrl!;
      });
    } else {
      tempUrl = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
      srcImg = new Image();
      srcImg.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        srcImg.onload = () => res();
        srcImg.onerror = () => rej(new Error('无法读取源图'));
        srcImg.src = tempUrl!;
      });
      if (tempUrl.startsWith('blob:')) {
        URL.revokeObjectURL(tempUrl);
      }
    }

    const sw = srcImg.naturalWidth || srcImg.width;
    const sh = srcImg.naturalHeight || srcImg.height;
    let workingImg: HTMLImageElement | HTMLCanvasElement = srcImg;

    if (sw > 900 || sh > 900) {
      const scale = 900 / Math.max(sw, sh);
      const nw = Math.round(sw * scale);
      const nh = Math.round(sh * scale);
      const downCanvas = document.createElement('canvas');
      downCanvas.width = nw;
      downCanvas.height = nh;
      const dctx = downCanvas.getContext('2d')!;
      dctx.drawImage(srcImg, 0, 0, nw, nh);
      workingImg = downCanvas;
    }

    // 1. Try local MediaPipe Selfie Segmentation first (fastest & best shoulder/clothing preservation)
    const mediaPipeResult = await segmentWithMediaPipe(workingImg, onProgress);
    if (mediaPipeResult) {
      if (cacheKey) {
        aiResultCache.set(cacheKey, mediaPipeResult);
      }
      onProgress?.({
        stage: 'finishing',
        progress: 100,
        message: 'AI 智能抠图完成！双肩衣服完整保留',
      });
      return mediaPipeResult;
    }

    // 2. Fallback to @imgly neural network model
    onProgress?.({
      stage: 'processing',
      progress: 60,
      message: 'AI 正在智能分离主体人物与阴影背景...',
    });

    let inputSource: Blob | File | string;
    if (workingImg instanceof HTMLCanvasElement) {
      inputSource = await new Promise<Blob>((res) => workingImg.toBlob((b) => res(b!), 'image/png'));
    } else {
      inputSource = imageSource as any;
    }

    const config: Config = {
      model: 'isnet_quint8',
      output: {
        format: 'image/png',
        quality: 0.95,
      },
    };

    const aiExecutionPromise = imglyRemoveBackground(inputSource, config);
    const timeoutPromise = new Promise<Blob>((_, reject) =>
      setTimeout(() => reject(new Error('网络模型下载超时，自动切换至边缘自适应算法')), 4500)
    );
    const outputBlob = await Promise.race([aiExecutionPromise, timeoutPromise]);

    const url = URL.createObjectURL(outputBlob);
    const resImg = new Image();
    resImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      resImg.onload = () => resolve();
      resImg.onerror = () => reject(new Error('无法读取输出图像'));
      resImg.src = url;
    });

    const width = resImg.naturalWidth || resImg.width;
    const height = resImg.naturalHeight || resImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(resImg, 0, 0);

    // Solidify shoulder & clothing area while eliminating white background fringe
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const shoulderCutoffY = Math.round(height * 0.32);
    for (let y = shoulderCutoffY; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const p = (row + x) * 4;
        const a = data[p + 3];
        if (a === 0) continue;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const isWhiteSpill = r > 215 && g > 215 && b > 215;
        if (a < 115 || (isWhiteSpill && a < 210)) {
          data[p + 3] = 0;
        } else if (a >= 140) {
          data[p + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const result = {
      blob: outputBlob,
      url,
      imageData,
      width,
      height,
    };

    if (cacheKey) {
      aiResultCache.set(cacheKey, result);
    }

    onProgress?.({
      stage: 'finishing',
      progress: 100,
      message: 'AI 抠图完成！背景已消除，双肩衣服完好',
    });

    return result;
  } catch (err: any) {
    console.warn('AI neural network model unavailable, falling back to smart edge-guided keying:', err);
    onProgress?.({
      stage: 'processing',
      progress: 80,
      message: '正在使用智能自适应边缘抠图算法...',
    });
    const fallbackResult = await smartEdgeGuidedKeying(imageSource);
    if (cacheKey) {
      aiResultCache.set(cacheKey, fallbackResult);
    }
    onProgress?.({
      stage: 'finishing',
      progress: 100,
      message: '智能抠图完成！发丝与肩膀细节已保护',
    });
    return fallbackResult;
  }
}

/**
 * High-performance smart edge-guided background keying fallback
 * Detects dominant border/corner backdrop color (e.g. Red, Blue, White, or Grey),
 * runs edge-barrier flood fill, and removes the background cleanly.
 */
export async function smartEdgeGuidedKeying(
  imageSource: File | Blob | ImageData | HTMLImageElement | string
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number }> {
  // 1. Get HTMLImageElement or Canvas from source
  let img: HTMLImageElement;
  let tempSrcUrl: string | null = null;
  if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    if (typeof imageSource === 'string') {
      tempSrcUrl = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      tempSrcUrl = URL.createObjectURL(imageSource);
    } else if (imageSource instanceof ImageData) {
      const c = document.createElement('canvas');
      c.width = imageSource.width;
      c.height = imageSource.height;
      const ctx = c.getContext('2d')!;
      ctx.putImageData(imageSource, 0, 0);
      tempSrcUrl = c.toDataURL('image/png');
    }

    img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('无法读取原始图片进行智能抠图'));
      img.src = tempSrcUrl!;
    });
    if (tempSrcUrl && (imageSource instanceof File || imageSource instanceof Blob)) {
      URL.revokeObjectURL(tempSrcUrl);
    }
  }

  // Pre-downscale to max 900px so processing is ultra-fast and never locks the UI
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  const scale = Math.min(1, 900 / Math.max(origW, origH));
  const width = Math.round(origW * scale);
  const height = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // Check if image already has transparent channel (e.g. pre-cutout PNG)
  let existingTransparent = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] < 35) existingTransparent++;
  }
  if (existingTransparent > totalPixels * 0.05) {
    // Already has transparency, return directly
    const outBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const outUrl = URL.createObjectURL(outBlob);
    return { blob: outBlob, url: outUrl, imageData: imgData, width, height };
  }

  // 2. Sample border colors to detect background color
  let sumR = 0, sumG = 0, sumB = 0, samples = 0;
  const sample = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = (y * width + x) * 4;
    sumR += data[p];
    sumG += data[p + 1];
    sumB += data[p + 2];
    samples++;
  };

  // Top border corners & top strip (avoiding center hair)
  for (let x = 0; x < width * 0.25; x += 4) {
    sample(x, 0);
    sample(x, 2);
  }
  for (let x = Math.round(width * 0.75); x < width; x += 4) {
    sample(x, 0);
    sample(x, 2);
  }
  // Upper side borders only (strictly above shoulders)
  const maxY = Math.round(height * 0.25);
  for (let y = 0; y < maxY; y += 4) {
    sample(0, y);
    sample(2, y);
    sample(width - 1, y);
    sample(width - 3, y);
  }

  const bgR = samples > 0 ? Math.round(sumR / samples) : 255;
  const bgG = samples > 0 ? Math.round(sumG / samples) : 255;
  const bgB = samples > 0 ? Math.round(sumB / samples) : 255;

  const colorDist = (r: number, g: number, b: number) => {
    return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
  };

  // Precompute luminance for edge barrier
  const lum = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    lum[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
  }

  // Human skin detector (protects ears, face, and neck from being flooded or erased)
  const isSkinPixel = (r: number, g: number, b: number) => {
    if (r < 80 || g < 45 || b < 25) return false;
    if (r <= g || r - b < 14) return false;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l > 50 && l < 240;
  };

  // Dark hair detector (Hair exists on upper head above collar)
  const isHairPixel = (r: number, g: number, b: number, y: number) => {
    if (y >= height * 0.38) return false;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l < 85 || (r < 90 && g < 90 && b < 90);
  };

  const visited = new Uint8Array(totalPixels);
  const isBg = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;
  const maxTol = 55; // accommodates background lighting gradient

  // Center portrait protection bounds (Head and Torso core)
  const coreLeft = Math.round(width * 0.22);
  const coreRight = Math.round(width * 0.78);
  const coreTop = Math.round(height * 0.12);
  const coreBottom = Math.round(height * 0.95);

  const enqueue = (x: number, y: number, fromIdx?: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    // SHOULDER & TORSO ABSOLUTE BARRIER:
    // Human shoulders expand outward from neck level down to full width.
    // Flood fill must NEVER enter the shoulder trapezoid!
    if (y >= height * 0.32) {
      const shoulderSpread = 0.50 * Math.min(1, (y - height * 0.30) / (height * 0.25));
      const leftShoulder = Math.max(0, width * (0.34 - shoulderSpread));
      const rightShoulder = Math.min(width, width * (0.66 + shoulderSpread));
      if (x >= leftShoulder && x <= rightShoulder) {
        return; // Absolute block for shoulders and torso fabric!
      }
    }

    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1; // Mark visited immediately to prevent duplicate checks

    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const a = data[p + 3];

    if (a < 50) {
      isBg[idx] = 1;
      queue[tail++] = idx;
      return;
    }

    // Never flood fill into person's ears, skin, or hair
    if (isSkinPixel(r, g, b) || isHairPixel(r, g, b, y)) {
      return;
    }

    // Never flood into core torso / face zone
    if (x >= coreLeft && x <= coreRight && y >= coreTop && y <= coreBottom) {
      const cDist = colorDist(r, g, b);
      if (cDist > maxTol * 0.55) {
        return;
      }
    }

    if (fromIdx !== undefined) {
      const deltaLum = Math.abs(lum[fromIdx] - lum[idx]);
      if (deltaLum > 35) return;
    }

    if (colorDist(r, g, b) <= maxTol) {
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  // Seed top corners and upper side borders ONLY (Never seed into lower body or shoulders)
  for (let x = 0; x < width * 0.30; x++) enqueue(x, 0);
  for (let x = Math.round(width * 0.70); x < width; x++) enqueue(x, 0);
  const seedMaxY = Math.round(height * 0.25);
  for (let y = 0; y < seedMaxY; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    if (cx > 0) enqueue(cx - 1, cy, curr);
    if (cx < width - 1) enqueue(cx + 1, cy, curr);
    if (cy > 0) enqueue(cx, cy - 1, curr);
    if (cy < height - 1) enqueue(cx, cy + 1, curr);
  }

  // Set background to transparent
  for (let i = 0; i < totalPixels; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Soften fringe boundary pixels ONLY around upper head/hair
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      if (data[i * 4 + 3] === 0) continue;

      const hasBgNeighbor =
        data[(i - 1) * 4 + 3] === 0 ||
        data[(i + 1) * 4 + 3] === 0 ||
        data[(i - width) * 4 + 3] === 0 ||
        data[(i + width) * 4 + 3] === 0;

      if (hasBgNeighbor) {
        const p = i * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];

        // NEVER soften or erode clothing on shoulders
        if (y >= height * 0.32 && !isSkinPixel(r, g, b)) {
          data[p + 3] = 255;
          continue;
        }

        if (isSkinPixel(r, g, b) || isHairPixel(r, g, b, y)) {
          continue;
        }

        if (colorDist(r, g, b) <= maxTol * 0.75) {
          data[p + 3] = 0;
        }
      }
    }
  }

  // Solidify clothing opacity across torso & shoulder region while cutting off white background fringe
  const shoulderY = Math.round(height * 0.32);
  for (let y = shoulderY; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const p = (row + x) * 4;
      const a = data[p + 3];
      if (a === 0) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const isWhiteSpill = r > 215 && g > 215 && b > 215;
      if (a < 115 || (isWhiteSpill && a < 210)) {
        data[p + 3] = 0;
      } else if (a >= 140) {
        data[p + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const outBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const outUrl = URL.createObjectURL(outBlob);

  return {
    blob: outBlob,
    url: outUrl,
    imageData: imgData,
    width,
    height,
  };
}

/**
 * Check if AI background removal is supported in current environment
 */
export function isAiRemovalSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined';
}
