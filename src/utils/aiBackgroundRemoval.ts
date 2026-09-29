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
    message: '正在加载 AI 视觉分割模型...',
  });

  try {
    const config: Config = {
      model: 'isnet_fp16',
      output: {
        format: 'image/png',
        quality: 1.0,
      },
      progress: (key: string, current: number, total: number) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 50;
        if (key.includes('fetch')) {
          onProgress?.({
            stage: 'loading',
            progress: Math.min(60, Math.round(pct * 0.6)),
            message: `正在加载 AI 模型权重 (${pct}%)...`,
          });
        } else if (key.includes('compute')) {
          onProgress?.({
            stage: 'processing',
            progress: 60 + Math.min(35, Math.round(pct * 0.35)),
            message: `AI 正在智能识别人物轮廓与发丝细节 (${pct}%)...`,
          });
        }
      },
    };

    // If source is ImageData, convert to Blob first
    let inputSource: Blob | File | string = imageSource as any;
    if (imageSource instanceof ImageData) {
      const c = document.createElement('canvas');
      c.width = imageSource.width;
      c.height = imageSource.height;
      const ctx = c.getContext('2d')!;
      ctx.putImageData(imageSource, 0, 0);
      inputSource = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
    }

    onProgress?.({
      stage: 'processing',
      progress: 65,
      message: 'AI 正在智能分离主体人物与阴影背景...',
    });

    const outputBlob = await imglyRemoveBackground(inputSource, config);

    onProgress?.({
      stage: 'finishing',
      progress: 95,
      message: '正在生成高清无损透明图层...',
    });

    // Convert output Blob to ImageData for Canvas rendering & WeChat formatting
    const url = URL.createObjectURL(outputBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('无法读取 AI 抠图输出图像'));
      img.src = url;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);

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
      message: 'AI 抠图完成！背景阴影已彻底清除',
    });

    return result;
  } catch (err: any) {
    console.error('AI background removal error, falling back to smart edge-guided keying:', err);
    throw err;
  }
}

/**
 * Check if AI background removal is supported in current environment
 */
export function isAiRemovalSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined';
}
