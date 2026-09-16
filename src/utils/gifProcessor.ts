import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import {
  RemovalOptions,
  ProcessedGifResult,
  FrameInfo,
  WeChatStickerOptions,
  CompressionOptions,
  CompressionPreset,
} from '../types';

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  enabled: true,
  preset: 'wechat-auto',
  targetSizeKb: 1000,
  maxColors: 256,
  scaleRatio: 1.0,
  frameStep: 1,
  autoCompressUnderLimit: true,
};

export const COMPRESSION_PRESETS: {
  id: CompressionPreset;
  name: string;
  desc: string;
  targetSizeKb: number;
  maxColors: number;
  scaleRatio: number;
  frameStep: number;
  autoCompressUnderLimit: boolean;
}[] = [
  {
    id: 'wechat-auto',
    name: '微信平台智能适配 (推荐)',
    desc: '动图自动压缩至 ≤1MB，静态图 ≤500KB，无损感画质',
    targetSizeKb: 1000,
    maxColors: 256,
    scaleRatio: 1.0,
    frameStep: 1,
    autoCompressUnderLimit: true,
  },
  {
    id: 'wechat-500kb',
    name: '微信严苛高保真 (≤500KB)',
    desc: '适合微信静态表情规范及动图极速秒发',
    targetSizeKb: 500,
    maxColors: 128,
    scaleRatio: 1.0,
    frameStep: 1,
    autoCompressUnderLimit: true,
  },
  {
    id: 'wechat-1mb',
    name: '微信官方动图上限 (≤1MB)',
    desc: '微信开放平台动图标准严格要求单个表情 ≤1MB',
    targetSizeKb: 1000,
    maxColors: 256,
    scaleRatio: 1.0,
    frameStep: 1,
    autoCompressUnderLimit: true,
  },
  {
    id: 'light-300kb',
    name: '极速轻量省流 (≤300KB)',
    desc: '深度精简调色板与抽帧，体积超小，任何弱网秒加载',
    targetSizeKb: 300,
    maxColors: 64,
    scaleRatio: 0.9,
    frameStep: 2,
    autoCompressUnderLimit: true,
  },
  {
    id: 'custom',
    name: '自定义压缩参数',
    desc: '自由微调目标大小、调色板色彩数、缩放比与抽帧',
    targetSizeKb: 500,
    maxColors: 128,
    scaleRatio: 1.0,
    frameStep: 1,
    autoCompressUnderLimit: true,
  },
];

export interface DecodedGif {
  width: number;
  height: number;
  frames: FrameInfo[];
  detectedBgColor: string;
}

// Convert Hex string to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert RGB to Hex string
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Euclidean color distance in RGB space (0 to ~441.67)
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Automatically detect the dominant border/corner color
export function detectBackgroundColor(frames: FrameInfo[], width: number, height: number): string {
  if (!frames.length || width <= 0 || height <= 0) return '#ffffff';

  const firstFrame = frames[0].imageData.data;
  const colorBuckets: { [key: string]: { r: number; g: number; b: number; count: number } } = {};

  const samplePixel = (x: number, y: number, weight = 1) => {
    const idx = (y * width + x) * 4;
    const r = firstFrame[idx];
    const g = firstFrame[idx + 1];
    const b = firstFrame[idx + 2];
    const a = firstFrame[idx + 3];
    if (a < 128) return; // already transparent

    // Quantize into 16-step bins to cluster similar compression artifacts
    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;
    const key = `${qr},${qg},${qb}`;

    if (!colorBuckets[key]) {
      colorBuckets[key] = { r, g, b, count: 0 };
    }
    colorBuckets[key].count += weight;
  };

  // Sample the 4 corners heavily
  samplePixel(0, 0, 10);
  samplePixel(width - 1, 0, 10);
  samplePixel(0, height - 1, 10);
  samplePixel(width - 1, height - 1, 10);

  // Sample the outer border perimeter
  const step = Math.max(1, Math.floor(Math.min(width, height) / 20));
  for (let x = 0; x < width; x += step) {
    samplePixel(x, 0, 2);
    samplePixel(x, height - 1, 2);
  }
  for (let y = 0; y < height; y += step) {
    samplePixel(0, y, 2);
    samplePixel(width - 1, y, 2);
  }

  let bestBucket = { r: 255, g: 255, b: 255, count: -1 };
  for (const key in colorBuckets) {
    if (colorBuckets[key].count > bestBucket.count) {
      bestBucket = colorBuckets[key];
    }
  }

  return rgbToHex(bestBucket.r, bestBucket.g, bestBucket.b);
}

// Decode GIF buffer into composited full-size RGBA frames
export async function decodeGif(arrayBuffer: ArrayBuffer): Promise<DecodedGif> {
  const parsedGif = parseGIF(arrayBuffer);
  const rawFrames = decompressFrames(parsedGif, true);

  if (!rawFrames.length) {
    throw new Error('GIF does not contain any frames');
  }

  const width = parsedGif.lsd.width || rawFrames[0].dims.width;
  const height = parsedGif.lsd.height || rawFrames[0].dims.height;

  // Offscreen canvas to composite frames honoring disposalType
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context for GIF decoding');

  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true });

  const frames: FrameInfo[] = [];
  let prevFrameData: ImageData | null = null;
  let prevDisposal = 0;
  let prevDims = { left: 0, top: 0, width: 0, height: 0 };

  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i];

    // Handle disposal of previous frame
    if (prevDisposal === 2) {
      // Restore to background
      ctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height);
    } else if (prevDisposal === 3 && prevFrameData) {
      // Restore to previous
      ctx.putImageData(prevFrameData, 0, 0);
    }

    // If current frame asks to restore to previous later, save current state
    if (frame.disposalType === 3) {
      prevFrameData = ctx.getImageData(0, 0, width, height);
    }

    prevDisposal = frame.disposalType;
    prevDims = frame.dims;

    // Draw current patch
    if (frame.patch && frame.patch.length > 0 && patchCtx) {
      patchCanvas.width = frame.dims.width;
      patchCanvas.height = frame.dims.height;
      const patchImageData = patchCtx.createImageData(frame.dims.width, frame.dims.height);
      patchImageData.data.set(frame.patch);
      patchCtx.putImageData(patchImageData, 0, 0);

      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
    }

    const compositedImageData = ctx.getImageData(0, 0, width, height);
    frames.push({
      imageData: compositedImageData,
      delay: Math.max(20, frame.delay || 100),
    });
  }

  const detectedBgColor = detectBackgroundColor(frames, width, height);

  return {
    width,
    height,
    frames,
    detectedBgColor,
  };
}

// Check if a file is an animated GIF
export function isGifFile(file: File | Blob | { name?: string; type?: string }): boolean {
  const f = file as { name?: string; type?: string };
  return f.type === 'image/gif' || (!!f.name && f.name.toLowerCase().endsWith('.gif'));
}

/**
 * Safely detach a browser DOM File into an in-memory File + ArrayBuffer.
 * In Chromium/Edge, a File object connected to the disk can throw net::ERR_UPLOAD_FILE_CHANGED
 * if the file on disk was modified, touched, moved, or temporarily locked (e.g. download finished, AV scan).
 * Loading the bytes into an in-memory buffer detaches it from disk access entirely.
 */
export async function detachFileToMemory(file: File): Promise<{
  safeFile: File;
  arrayBuffer: ArrayBuffer;
  dataUrl?: string;
}> {
  // Strategy 1: file.arrayBuffer()
  try {
    const ab = await file.arrayBuffer();
    if (ab && ab.byteLength > 0) {
      const safeBlob = new Blob([ab], { type: file.type || 'image/png' });
      const safeFile = new File([safeBlob], file.name, {
        type: file.type || 'image/png',
        lastModified: file.lastModified || Date.now(),
      });
      return { safeFile, arrayBuffer: ab };
    }
  } catch (e1) {
    console.warn('file.arrayBuffer() failed, trying FileReader...', e1);
  }

  // Strategy 2: FileReader.readAsArrayBuffer
  try {
    const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsArrayBuffer(file);
    });
    if (ab && ab.byteLength > 0) {
      const safeBlob = new Blob([ab], { type: file.type || 'image/png' });
      const safeFile = new File([safeBlob], file.name, {
        type: file.type || 'image/png',
        lastModified: file.lastModified || Date.now(),
      });
      return { safeFile, arrayBuffer: ab };
    }
  } catch (e2) {
    console.warn('FileReader.readAsArrayBuffer failed, trying DataURL...', e2);
  }

  // Strategy 3: FileReader.readAsDataURL
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('DataURL reader failed'));
      reader.readAsDataURL(file);
    });
    const res = await fetch(dataUrl);
    const ab = await res.arrayBuffer();
    const safeBlob = new Blob([ab], { type: file.type || 'image/png' });
    const safeFile = new File([safeBlob], file.name, {
      type: file.type || 'image/png',
      lastModified: file.lastModified || Date.now(),
    });
    return { safeFile, arrayBuffer: ab, dataUrl };
  } catch (e3) {
    console.warn('DataURL fallback failed, trying slice...', e3);
  }

  // Strategy 4: file.slice()
  try {
    const sliced = file.slice(0, file.size, file.type);
    const ab = await sliced.arrayBuffer();
    const safeBlob = new Blob([ab], { type: file.type || 'image/png' });
    const safeFile = new File([safeBlob], file.name, {
      type: file.type || 'image/png',
      lastModified: file.lastModified || Date.now(),
    });
    return { safeFile, arrayBuffer: ab };
  } catch (e4) {
    console.warn('file.slice failed', e4);
  }

  return { safeFile: file, arrayBuffer: new ArrayBuffer(0) };
}

/**
 * Safely extracts an ArrayBuffer from a File or Blob with multiple fallbacks
 */
export async function getSafeArrayBuffer(file: File | Blob, cachedBuffer?: ArrayBuffer): Promise<ArrayBuffer> {
  if (cachedBuffer && cachedBuffer.byteLength > 0) {
    return cachedBuffer;
  }
  try {
    const ab = await file.arrayBuffer();
    if (ab && ab.byteLength > 0) return ab;
  } catch {
    // fallback
  }

  try {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsArrayBuffer(file);
    });
  } catch {
    // fallback
  }

  const detached = await detachFileToMemory(file as File);
  if (detached.arrayBuffer && detached.arrayBuffer.byteLength > 0) {
    return detached.arrayBuffer;
  }

  throw new Error('无法读取图片数据，文件可能已被操作系统修改或占用');
}

// Decode regular static image (PNG, JPG, JPEG, WEBP, BMP, SVG, etc.)
// Highly resilient to net::ERR_UPLOAD_FILE_CHANGED and browser sandbox file restrictions
export async function decodeStaticImage(
  source: File | Blob | ArrayBuffer | string,
  cachedBuffer?: ArrayBuffer
): Promise<DecodedGif> {
  let imgBitmap: ImageBitmap | HTMLImageElement | null = null;
  let width = 0;
  let height = 0;
  let objectUrlToRevoke: string | null = null;

  // 1. If cachedBuffer or ArrayBuffer is available, build an in-memory detached Blob
  let buffer: ArrayBuffer | null = cachedBuffer || null;
  if (!buffer && source instanceof ArrayBuffer) {
    buffer = source;
  }

  // 2. If source is already a string (Data URL or Object URL)
  if (typeof source === 'string') {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('无法读取该图片文件'));
        img.src = source;
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      imgBitmap = img;
    } catch {
      // Continue to other fallbacks
    }
  }

  // 3. If in-memory buffer is available, decode safely without disk I/O
  if (!imgBitmap && buffer && buffer.byteLength > 0) {
    const memoryBlob = new Blob([buffer], { type: 'image/png' });
    if (typeof createImageBitmap === 'function') {
      try {
        imgBitmap = await createImageBitmap(memoryBlob);
        width = imgBitmap.width;
        height = imgBitmap.height;
      } catch {
        imgBitmap = null;
      }
    }

    if (!imgBitmap) {
      try {
        const url = URL.createObjectURL(memoryBlob);
        objectUrlToRevoke = url;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('无法读取图片内存数据'));
          img.src = url;
        });
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        imgBitmap = img;
      } catch {
        imgBitmap = null;
      }
    }
  }

  // 4. If source is a File or Blob, detach to memory first to avoid ERR_UPLOAD_FILE_CHANGED
  if (!imgBitmap && (source instanceof Blob || source instanceof File)) {
    try {
      const detached = await detachFileToMemory(source as File);
      if (detached.arrayBuffer && detached.arrayBuffer.byteLength > 0) {
        const memoryBlob = new Blob([detached.arrayBuffer], {
          type: (source as File).type || 'image/png',
        });
        if (typeof createImageBitmap === 'function') {
          try {
            imgBitmap = await createImageBitmap(memoryBlob);
            width = imgBitmap.width;
            height = imgBitmap.height;
          } catch {
            imgBitmap = null;
          }
        }
        if (!imgBitmap) {
          const url = URL.createObjectURL(memoryBlob);
          objectUrlToRevoke = url;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('无法从内存解析图片'));
            img.src = url;
          });
          width = img.naturalWidth || img.width;
          height = img.naturalHeight || img.height;
          imgBitmap = img;
        }
      }
    } catch (detErr) {
      console.warn('Memory detachment decode fallback:', detErr);
    }
  }

  // 5. Fallback via FileReader readAsDataURL
  if (!imgBitmap && (source instanceof Blob || source instanceof File)) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(source);
      });
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('无法读取该图片文件'));
        img.src = dataUrl;
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      imgBitmap = img;
    } catch {
      // Continue to final attempt
    }
  }

  // 6. Final direct createImageBitmap attempt
  if (!imgBitmap && (source instanceof Blob || source instanceof File)) {
    if (typeof createImageBitmap === 'function') {
      try {
        imgBitmap = await createImageBitmap(source);
        width = imgBitmap.width;
        height = imgBitmap.height;
      } catch (err) {
        throw new Error('无法读取该图片文件 (ERR_UPLOAD_FILE_CHANGED)，请重新选择文件或点击重试');
      }
    }
  }

  if (!imgBitmap || width === 0 || height === 0) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    throw new Error('无法解析图片尺寸与像素内容，请确认图片文件是否有效');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    throw new Error('无法创建 Canvas 上下文');
  }

  ctx.drawImage(imgBitmap, 0, 0);

  // Close imageBitmap if applicable
  if ('close' in imgBitmap && typeof (imgBitmap as ImageBitmap).close === 'function') {
    (imgBitmap as ImageBitmap).close();
  }

  // Only revoke object URL after rendering to canvas
  if (objectUrlToRevoke) {
    URL.revokeObjectURL(objectUrlToRevoke);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const frames: FrameInfo[] = [{ imageData, delay: 0 }];
  const detectedBgColor = detectBackgroundColor(frames, width, height);

  return {
    width,
    height,
    frames,
    detectedBgColor,
  };
}

// Unified decoder for both GIF and static images
export async function decodeMediaFile(
  file: File | Blob | ArrayBuffer,
  cachedBuffer?: ArrayBuffer
): Promise<DecodedGif> {
  if (isGifFile(file as File)) {
    let arrayBuffer: ArrayBuffer;
    if (file instanceof ArrayBuffer) {
      arrayBuffer = file;
    } else {
      arrayBuffer = await getSafeArrayBuffer(file as File | Blob, cachedBuffer);
    }
    return decodeGif(arrayBuffer);
  } else {
    return decodeStaticImage(file, cachedBuffer);
  }
}

// Process a single ImageData frame by removing background color
export function removeBackgroundFromFrame(
  imageData: ImageData,
  options: RemovalOptions
): ImageData {
  const { targetColor, tolerance, contiguous, defringe } = options;
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;

  const target = hexToRgb(targetColor);
  // Maximum possible distance in RGB space is ~441.67
  const maxThreshold = (Math.max(0, Math.min(100, tolerance)) / 100) * 441.67;

  // Clone original image data
  const resultData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );
  const data = resultData.data;

  // Mask array: 1 for transparent background, 0 for kept foreground
  const isBackground = new Uint8Array(totalPixels);

  if (contiguous) {
    // Flood fill starting from all 4 borders
    const queue: number[] = [];
    const visited = new Uint8Array(totalPixels);

    const checkAndQueue = (x: number, y: number) => {
      const idx = y * width + x;
      if (visited[idx]) return;
      visited[idx] = 1;

      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];

      if (a < 64) {
        // already transparent
        isBackground[idx] = 1;
        queue.push(idx);
        return;
      }

      const dist = colorDistance(r, g, b, target.r, target.g, target.b);
      if (dist <= maxThreshold) {
        isBackground[idx] = 1;
        queue.push(idx);
      }
    };

    // Push top & bottom borders
    for (let x = 0; x < width; x++) {
      checkAndQueue(x, 0);
      checkAndQueue(x, height - 1);
    }
    // Push left & right borders
    for (let y = 0; y < height; y++) {
      checkAndQueue(0, y);
      checkAndQueue(width - 1, y);
    }

    // BFS Queue processing
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cx = curr % width;
      const cy = Math.floor(curr / width);

      // 4-way neighbors
      if (cx > 0) checkAndQueue(cx - 1, cy);
      if (cx < width - 1) checkAndQueue(cx + 1, cy);
      if (cy > 0) checkAndQueue(cx, cy - 1);
      if (cy < height - 1) checkAndQueue(cx, cy + 1);
    }
  } else {
    // Global removal: any pixel within tolerance is removed
    for (let i = 0; i < totalPixels; i++) {
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];

      if (a < 64) {
        isBackground[i] = 1;
        continue;
      }

      const dist = colorDistance(r, g, b, target.r, target.g, target.b);
      if (dist <= maxThreshold) {
        isBackground[i] = 1;
      }
    }
  }

  // Defringe / Edge Erosion (removes color fringes/halos around edges)
  if (defringe > 0) {
    const eroded = new Uint8Array(isBackground);
    for (let pass = 0; pass < defringe; pass++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (eroded[idx] === 0) {
            // Check if adjacent to background
            let hasBgNeighbor = false;
            if (x > 0 && eroded[idx - 1] === 1) hasBgNeighbor = true;
            else if (x < width - 1 && eroded[idx + 1] === 1) hasBgNeighbor = true;
            else if (y > 0 && eroded[idx - width] === 1) hasBgNeighbor = true;
            else if (y < height - 1 && eroded[idx + width] === 1) hasBgNeighbor = true;

            if (hasBgNeighbor) {
              const p = idx * 4;
              const r = data[p];
              const g = data[p + 1];
              const b = data[p + 2];
              // If pixel is somewhat close to target color (within 1.5x tolerance), erode it
              const dist = colorDistance(r, g, b, target.r, target.g, target.b);
              if (dist <= maxThreshold * 1.5) {
                isBackground[idx] = 1;
              }
            }
          }
        }
      }
      eroded.set(isBackground);
    }
  }

  // Apply transparency to resultData
  for (let i = 0; i < totalPixels; i++) {
    if (isBackground[i] === 1) {
      const p = i * 4;
      data[p + 3] = 0; // Alpha = 0 (Transparent)
    }
  }

  return resultData;
}

/**
 * Detects and transparentizes contiguous black/near-black letterbox bars, margins,
 * and unpainted padding starting strictly from the outer boundaries (edges).
 * Preserves 100% of internal content and artwork without color-keying or eroding
 * the actual sticker details ("内容保持原图完整不扣图，未选中/填充的边缘区域完全透明输出").
 */
export function cleanEdgeBlackBordersAndMargins(
  imageData: ImageData,
  maxBlackThreshold: number = 32
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;
  const data = imageData.data;

  // 1. Any pixel with alpha <= 64 is already unpainted margin/padding
  // 2. We flood from the outer boundary pixels: top row, bottom row, left col, right col
  const isBackground = new Uint8Array(totalPixels);
  const queue: number[] = [];

  const isNearBlackOrTransparent = (idx: number) => {
    const p = idx * 4;
    const a = data[p + 3];
    if (a <= 64) return true; // Already transparent/unpainted
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    // Near-black threshold check
    return r <= maxBlackThreshold && g <= maxBlackThreshold && b <= maxBlackThreshold;
  };

  const checkAndQueue = (x: number, y: number) => {
    const idx = y * width + x;
    if (isBackground[idx] === 1) return;
    if (isNearBlackOrTransparent(idx)) {
      isBackground[idx] = 1;
      queue.push(idx);
    }
  };

  // Check top and bottom rows
  for (let x = 0; x < width; x++) {
    checkAndQueue(x, 0);
    checkAndQueue(x, height - 1);
  }
  // Check left and right columns
  for (let y = 0; y < height; y++) {
    checkAndQueue(0, y);
    checkAndQueue(width - 1, y);
  }

  // BFS contiguous flood fill
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // 4 neighbors
    if (cx > 0) checkAndQueue(cx - 1, cy);
    if (cx < width - 1) checkAndQueue(cx + 1, cy);
    if (cy > 0) checkAndQueue(cx, cy - 1);
    if (cy < height - 1) checkAndQueue(cx, cy + 1);
  }

  // Set alpha = 0 for all identified edge black bars / empty margins
  for (let i = 0; i < totalPixels; i++) {
    if (isBackground[i] === 1) {
      data[i * 4 + 3] = 0;
    }
  }

  return imageData;
}


// Apply white (or custom color) outline around transparent edges (WeChat Sticker Specification)
export function applyWhiteOutline(
  imageData: ImageData,
  outlineWidth: number = 2,
  outlineColorHex: string = '#ffffff'
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;
  const src = imageData.data;

  const result = new ImageData(new Uint8ClampedArray(src), width, height);
  const dst = result.data;

  if (outlineWidth <= 0) return result;

  const outlineRgb = hexToRgb(outlineColorHex);

  // Mark foreground (opaque) pixels
  const isForeground = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (src[i * 4 + 3] > 64) {
      isForeground[i] = 1;
    }
  }

  // Precompute circle neighbor offsets
  const offsets: { dx: number; dy: number }[] = [];
  const rSquared = outlineWidth * outlineWidth + 0.4;
  for (let dy = -outlineWidth; dy <= outlineWidth; dy++) {
    for (let dx = -outlineWidth; dx <= outlineWidth; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (dx * dx + dy * dy <= rSquared) {
        offsets.push({ dx, dy });
      }
    }
  }

  // Identify pixels that are transparent (not foreground), but adjacent to foreground
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isForeground[idx] === 1) continue; // Foreground pixel, keep original color

      let nearForeground = false;
      for (let k = 0; k < offsets.length; k++) {
        const nx = x + offsets[k].dx;
        const ny = y + offsets[k].dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (isForeground[ny * width + nx] === 1) {
            nearForeground = true;
            break;
          }
        }
      }

      if (nearForeground) {
        const p = idx * 4;
        dst[p] = outlineRgb.r;
        dst[p + 1] = outlineRgb.g;
        dst[p + 2] = outlineRgb.b;
        dst[p + 3] = 255; // Solid opaque stroke
      }
    }
  }

  return result;
}

// Format and render a transparent frame according to WeChat Sticker rules (240x240, padding, outline, caption)
export function renderFrameWithWeChatOptions(
  transparentImageData: ImageData,
  wechat?: WeChatStickerOptions
): ImageData {
  if (!wechat || !wechat.enabled) {
    return transparentImageData;
  }

  const origW = transparentImageData.width;
  const origH = transparentImageData.height;

  let targetW = origW;
  let targetH = origH;
  let drawW = origW;
  let drawH = origH;
  let drawX = 0;
  let drawY = 0;

  const hasCaption = !!wechat.captionText && wechat.captionText.trim().length > 0;
  const captionHeightReserve = hasCaption ? 32 : 0;

  if (wechat.standardSize === '240') {
    targetW = 240;
    targetH = 240;
    // Leave safe padding for outline (2px-4px) and optional caption
    const maxUsableW = 240 - 24; // 216
    const maxUsableH = 240 - 24 - (hasCaption ? 28 : 0);
    const scale = Math.min(maxUsableW / origW, maxUsableH / origH);
    drawW = Math.max(1, Math.round(origW * scale));
    drawH = Math.max(1, Math.round(origH * scale));
    drawX = Math.round((240 - drawW) / 2);

    if (hasCaption && wechat.captionPosition === 'top') {
      drawY = Math.round((240 - captionHeightReserve - drawH) / 2) + captionHeightReserve;
    } else if (hasCaption) {
      drawY = Math.round((240 - captionHeightReserve - drawH) / 2);
    } else {
      drawY = Math.round((240 - drawH) / 2);
    }
  } else if (wechat.standardSize === 'max240') {
    const maxDim = Math.max(origW, origH);
    const scale = maxDim > 240 ? (240 - (hasCaption ? 28 : 12)) / maxDim : 1;
    drawW = Math.max(1, Math.round(origW * scale));
    drawH = Math.max(1, Math.round(origH * scale));
    targetW = Math.max(drawW, hasCaption ? 160 : drawW);
    targetH = drawH + (hasCaption ? captionHeightReserve : 0);
    drawX = Math.round((targetW - drawW) / 2);
    drawY = hasCaption && wechat.captionPosition === 'top' ? captionHeightReserve : 0;
  }

  // Draw scaled transparent image onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return transparentImageData;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = origW;
  tempCanvas.height = origH;
  const tempCtx = tempCanvas.getContext('2d');
  if (tempCtx) {
    tempCtx.putImageData(transparentImageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
  }

  let currentImageData = ctx.getImageData(0, 0, targetW, targetH);

  // Apply WeChat standard white outline if enabled
  if (wechat.addWhiteOutline) {
    currentImageData = applyWhiteOutline(
      currentImageData,
      wechat.outlineWidth ?? 2,
      wechat.outlineColor ?? '#ffffff'
    );
  }

  // Apply caption text if present
  if (hasCaption) {
    ctx.putImageData(currentImageData, 0, 0);
    const fontSize =
      wechat.captionFontSize ||
      (targetW >= 240 ? 22 : Math.max(14, Math.round(targetW / 10)));

    ctx.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const text = wechat.captionText!.trim();
    const textX = targetW / 2;
    let textY = targetH - 8;
    if (wechat.captionPosition === 'top') {
      textY = fontSize + 4;
      ctx.textBaseline = 'alphabetic';
    } else {
      ctx.textBaseline = 'alphabetic';
    }

    // Outer stroke (black outline by default)
    ctx.lineWidth = Math.max(3, Math.round(fontSize / 4.5));
    ctx.strokeStyle = wechat.captionStrokeColor || '#000000';
    ctx.strokeText(text, textX, textY);

    // Inner text fill
    ctx.fillStyle = wechat.captionColor || '#ffffff';
    ctx.fillText(text, textX, textY);

    currentImageData = ctx.getImageData(0, 0, targetW, targetH);
  }

  return currentImageData;
}

// Rescale ImageData using high-quality offscreen canvas
export function scaleImageData(imageData: ImageData, targetW: number, targetH: number): ImageData {
  if (imageData.width === targetW && imageData.height === targetH) {
    return imageData;
  }
  const c1 = document.createElement('canvas');
  c1.width = imageData.width;
  c1.height = imageData.height;
  const ctx1 = c1.getContext('2d', { willReadFrequently: true });
  if (!ctx1) return imageData;
  ctx1.putImageData(imageData, 0, 0);

  const c2 = document.createElement('canvas');
  c2.width = targetW;
  c2.height = targetH;
  const ctx2 = c2.getContext('2d', { willReadFrequently: true });
  if (!ctx2) return imageData;
  ctx2.imageSmoothingEnabled = true;
  ctx2.imageSmoothingQuality = 'high';
  ctx2.drawImage(c1, 0, 0, targetW, targetH);
  return ctx2.getImageData(0, 0, targetW, targetH);
}

export interface GifEncodingParams {
  maxColors?: number; // 32, 64, 128, 255
  scaleRatio?: number; // 0.5 to 1.0
  frameStep?: number; // 1, 2, 3
}

// Encode processed frames into a GIF blob with custom compression parameters
export async function encodeTransparentGifWithParams(
  frames: { imageData: ImageData; delay: number }[],
  width: number,
  height: number,
  params?: GifEncodingParams,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; width: number; height: number; frameCount: number }> {
  const maxColors = Math.max(16, Math.min(255, params?.maxColors ?? 255));
  const scaleRatio = Math.max(0.3, Math.min(1.0, params?.scaleRatio ?? 1.0));
  const frameStep = Math.max(1, Math.min(4, params?.frameStep ?? 1));

  // 1. Frame Sampling / Stepping (accumulate delay to preserve exact playback speed and overall duration)
  let sampledFrames: { imageData: ImageData; delay: number }[] = [];
  if (frameStep > 1 && frames.length > 3) {
    for (let i = 0; i < frames.length; i += frameStep) {
      let totalDelay = 0;
      for (let s = 0; s < frameStep && i + s < frames.length; s++) {
        totalDelay += frames[i + s].delay;
      }
      sampledFrames.push({
        imageData: frames[i].imageData,
        delay: totalDelay,
      });
    }
  } else {
    sampledFrames = frames;
  }

  // 2. Scaling dimensions if scaleRatio < 1.0
  const outW = Math.max(16, Math.round(width * scaleRatio));
  const outH = Math.max(16, Math.round(height * scaleRatio));
  const needsRescaling = outW !== width || outH !== height;

  const scaledFrames = needsRescaling
    ? sampledFrames.map((f) => ({
        imageData: scaleImageData(f.imageData, outW, outH),
        delay: f.delay,
      }))
    : sampledFrames;

  // 3. GIF Encoding via gifenc
  const gif = GIFEncoder();
  const totalFrames = scaledFrames.length;

  for (let f = 0; f < totalFrames; f++) {
    const frame = scaledFrames[f];
    const data = frame.imageData.data;
    const totalPixels = outW * outH;

    // Count opaque pixels
    let opaqueCount = 0;
    for (let p = 0; p < totalPixels; p++) {
      if (data[p * 4 + 3] > 64) {
        opaqueCount++;
      }
    }

    if (opaqueCount === 0) {
      // Entire frame is transparent
      const palette = [[0, 0, 0]];
      const index = new Uint8Array(totalPixels);
      gif.writeFrame(index, outW, outH, {
        palette,
        delay: frame.delay,
        transparent: true,
        transparentIndex: 0,
        dispose: 2,
        repeat: 0,
      });
    } else {
      // Collect opaque RGBA pixels for quantization
      const opaquePixels = new Uint8Array(opaqueCount * 4);
      let opIdx = 0;
      for (let p = 0; p < totalPixels; p++) {
        if (data[p * 4 + 3] > 64) {
          opaquePixels[opIdx] = data[p * 4];
          opaquePixels[opIdx + 1] = data[p * 4 + 1];
          opaquePixels[opIdx + 2] = data[p * 4 + 2];
          opaquePixels[opIdx + 3] = 255;
          opIdx += 4;
        }
      }

      // Quantize down to at most maxColors (index 0 is reserved for transparent dummy)
      const opaquePalette = quantize(opaquePixels, maxColors, { format: 'rgb565' });

      // Build full palette: index 0 is transparent dummy color
      const fullPalette = [[0, 0, 0], ...opaquePalette];

      // Map entire frame
      const rawIndices = applyPalette(data, opaquePalette, 'rgb565');
      const finalIndices = new Uint8Array(totalPixels);

      for (let p = 0; p < totalPixels; p++) {
        if (data[p * 4 + 3] <= 64) {
          finalIndices[p] = 0; // transparent
        } else {
          finalIndices[p] = rawIndices[p] + 1; // opaque color index in fullPalette
        }
      }

      gif.writeFrame(finalIndices, outW, outH, {
        palette: fullPalette,
        delay: frame.delay,
        transparent: true,
        transparentIndex: 0,
        dispose: 2, // Restore to background
        repeat: 0, // Infinite loop
      });
    }

    if (onProgress) {
      onProgress(Math.round(((f + 1) / totalFrames) * 100));
    }

    if (f % 2 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  gif.finish();
  const bytes = gif.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });

  return {
    blob,
    width: outW,
    height: outH,
    frameCount: totalFrames,
  };
}

// Encode processed frames into a GIF blob (backward compatible)
export async function encodeTransparentGif(
  frames: { imageData: ImageData; delay: number }[],
  width: number,
  height: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const res = await encodeTransparentGifWithParams(
    frames,
    width,
    height,
    { maxColors: 255 },
    onProgress
  );
  return res.blob;
}

// Intelligent multi-pass GIF compression to strictly fit WeChat upload limits (<1MB)
export async function compressAndEncodeGif(
  frames: { imageData: ImageData; delay: number }[],
  width: number,
  height: number,
  originalSize: number,
  compression: CompressionOptions,
  onProgress?: (progress: number, note?: string) => void
): Promise<{ blob: Blob; width: number; height: number; frameCount: number }> {
  const targetBytes = (compression.targetSizeKb || 1000) * 1024;

  // Pass 1: Initial encoding using user's settings
  const baseParams: GifEncodingParams = {
    maxColors: compression.maxColors || 256,
    scaleRatio: compression.scaleRatio || 1.0,
    frameStep: compression.frameStep || 1,
  };

  onProgress?.(50, '正在初次编码动图...');
  let currentRes = await encodeTransparentGifWithParams(
    frames,
    width,
    height,
    baseParams,
    (pct) => onProgress?.(50 + Math.round((pct / 100) * 20), `正在编码 GIF 帧 (${pct}%)...`)
  );

  // If already complies with target size or auto-compression is off, return immediately
  if (!compression.autoCompressUnderLimit || currentRes.blob.size <= targetBytes) {
    return currentRes;
  }

  // Multi-pass iterative compression strategies
  const passes: { name: string; params: GifEncodingParams }[] = [];

  // Strategy 1: Reduce palette to 128 colors if it was high
  if ((baseParams.maxColors ?? 256) > 128) {
    passes.push({
      name: '精简调色板 (128 色)',
      params: { ...baseParams, maxColors: 128 },
    });
  }

  // Strategy 2: Frame stepping (2) if frames.length > 6
  if (frames.length > 6 && (baseParams.frameStep ?? 1) < 2) {
    passes.push({
      name: '智能隔帧采样 (延时同步翻倍，播放速度不变)',
      params: { ...baseParams, maxColors: 128, frameStep: 2 },
    });
  }

  // Strategy 3: Reduce palette to 64 colors
  passes.push({
    name: '精简调色板 (64 色)',
    params: {
      ...baseParams,
      maxColors: 64,
      frameStep: frames.length > 6 ? 2 : 1,
    },
  });

  // Strategy 4: Scale down slightly to 80% if still exceeding
  passes.push({
    name: '等比缩放画面至 80%',
    params: {
      maxColors: 64,
      frameStep: frames.length > 6 ? 2 : 1,
      scaleRatio: Math.max(0.65, (baseParams.scaleRatio || 1.0) * 0.8),
    },
  });

  // Strategy 5: Aggressive compression for very large GIFs
  if (frames.length > 12) {
    passes.push({
      name: '极限动图省流压缩 (32色 / 抽帧 / 75%尺寸)',
      params: {
        maxColors: 32,
        frameStep: 3,
        scaleRatio: Math.max(0.6, (baseParams.scaleRatio || 1.0) * 0.75),
      },
    });
  }

  let bestRes = currentRes;
  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i];
    const passPct = 70 + Math.round(((i + 1) / (passes.length + 1)) * 28);
    onProgress?.(
      passPct,
      `当前体积 ${(bestRes.blob.size / 1024).toFixed(0)}KB 超出限制 (${(targetBytes / 1024).toFixed(0)}KB)，正在${pass.name}...`
    );

    const attempt = await encodeTransparentGifWithParams(
      frames,
      width,
      height,
      pass.params
    );

    if (attempt.blob.size < bestRes.blob.size) {
      bestRes = attempt;
    }

    if (bestRes.blob.size <= targetBytes) {
      break;
    }
  }

  return bestRes;
}

// Compress static PNG to comply with WeChat platform standards (<= 500KB)
export async function compressStaticImage(
  imageData: ImageData,
  originalSize: number,
  compression: CompressionOptions,
  onStatus?: (msg: string) => void
): Promise<{ blob: Blob; width: number; height: number }> {
  let targetW = imageData.width;
  let targetH = imageData.height;

  // Apply user scaleRatio if present
  if (compression.scaleRatio && compression.scaleRatio < 1.0) {
    targetW = Math.max(16, Math.round(targetW * compression.scaleRatio));
    targetH = Math.max(16, Math.round(targetH * compression.scaleRatio));
  }

  // If dimensions are unnecessarily huge (> 1200), downscale gracefully
  if (targetW > 1200 || targetH > 1200) {
    const scale = 1200 / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const targetBytes = (compression.targetSizeKb || 500) * 1024;
  let currentImageData =
    targetW !== imageData.width || targetH !== imageData.height
      ? scaleImageData(imageData, targetW, targetH)
      : imageData;

  // Pass 1: Standard PNG export
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.putImageData(currentImageData, 0, 0);

  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('导出 PNG 失败'));
    }, 'image/png');
  });

  // If already within WeChat limit, return
  if (!compression.autoCompressUnderLimit || blob.size <= targetBytes) {
    return { blob, width: targetW, height: targetH };
  }

  // Pass 2: Color binning to dramatically increase DEFLATE compression ratio
  onStatus?.(`当前体积 ${(blob.size / 1024).toFixed(0)}KB 超过微信限制，正在进行色彩优化压缩...`);
  const binData = new ImageData(new Uint8ClampedArray(currentImageData.data), targetW, targetH);
  const data = binData.data;
  const total = targetW * targetH * 4;
  for (let i = 0; i < total; i += 4) {
    if (data[i + 3] > 16) {
      data[i] = Math.round(data[i] / 8) * 8;
      data[i + 1] = Math.round(data[i + 1] / 8) * 8;
      data[i + 2] = Math.round(data[i + 2] / 8) * 8;
    }
  }
  ctx.clearRect(0, 0, targetW, targetH);
  ctx.putImageData(binData, 0, 0);
  const blob2 = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  );
  if (blob2.size < blob.size) {
    blob = blob2;
  }
  if (blob.size <= targetBytes) {
    return { blob, width: targetW, height: targetH };
  }

  // Pass 3: Gradual downscaling if still over targetBytes
  onStatus?.(`正在进行尺寸自适应微调以确保符合微信 ≤${compression.targetSizeKb}KB 限制...`);
  let scale = 0.85;
  while (scale >= 0.5 && blob.size > targetBytes) {
    const sW = Math.max(16, Math.round(targetW * scale));
    const sH = Math.max(16, Math.round(targetH * scale));
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = sW;
    scaledCanvas.height = sH;
    const sCtx = scaledCanvas.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(canvas, 0, 0, sW, sH);
      const b = await new Promise<Blob>((resolve) =>
        scaledCanvas.toBlob((res) => resolve(res!), 'image/png')
      );
      if (b && b.size < blob.size) {
        blob = b;
        targetW = sW;
        targetH = sH;
      }
    }
    scale -= 0.15;
  }

  return { blob, width: targetW, height: targetH };
}

// Complete processing pipeline for a single GIF file
export async function processGifItem(
  file: File,
  options: RemovalOptions,
  onProgress?: (progress: number, message: string) => void,
  cachedBuffer?: ArrayBuffer
): Promise<ProcessedGifResult> {
  const isWeChat = !!options.wechat?.enabled;
  const compression = options.compression ?? {
    enabled: true,
    preset: 'wechat-auto',
    targetSizeKb: 1000,
    maxColors: 256,
    scaleRatio: 1.0,
    frameStep: 1,
    autoCompressUnderLimit: true,
  };

  onProgress?.(10, '正在解析 GIF 帧...');
  const arrayBuffer = await getSafeArrayBuffer(file, cachedBuffer);
  const decoded = await decodeGif(arrayBuffer);

  onProgress?.(
    30,
    isWeChat
      ? '正在生成微信表情包 (背景透明化 + 240x240规范 + 白色描边)...'
      : '正在处理背景透明化...'
  );

  const processedFrames = decoded.frames.map((frame) => {
    const transparentData = removeBackgroundFromFrame(frame.imageData, options);
    const finalData = isWeChat
      ? renderFrameWithWeChatOptions(transparentData, options.wechat)
      : transparentData;
    return {
      imageData: finalData,
      delay: frame.delay,
    };
  });

  const baseWidth = processedFrames[0]?.imageData.width || decoded.width;
  const baseHeight = processedFrames[0]?.imageData.height || decoded.height;

  onProgress?.(
    50,
    compression.enabled
      ? `正在智能压缩并编码动图 (目标 ≤${compression.targetSizeKb || 1000}KB)...`
      : '正在重新编码透明 GIF...'
  );

  const encoded = compression.enabled
    ? await compressAndEncodeGif(
        processedFrames,
        baseWidth,
        baseHeight,
        file.size,
        compression,
        (pct, note) => {
          onProgress?.(pct, note || `正在编码 GIF 帧 (${pct}%)...`);
        }
      )
    : {
        blob: await encodeTransparentGif(
          processedFrames,
          baseWidth,
          baseHeight,
          (pct) => {
            const mappedPct = Math.round(50 + (pct / 100) * 45);
            onProgress?.(mappedPct, `正在编码 GIF 帧 (${pct}%)...`);
          }
        ),
        width: baseWidth,
        height: baseHeight,
        frameCount: processedFrames.length,
      };

  const finalBlob = encoded.blob;
  const passedWeChat = finalBlob.size <= 1024 * 1024;
  const ratio =
    file.size > 0 ? Math.max(0, Math.round((1 - finalBlob.size / file.size) * 100)) : 0;
  const summary =
    file.size > 0
      ? `原图 ${(file.size / 1024).toFixed(0)}KB ➔ 压缩后 ${(finalBlob.size / 1024).toFixed(0)}KB (-${ratio}%) ${passedWeChat ? '✅ 符合微信平台限制' : '⚠️ 仍超出微信限制'}`
      : `文件大小 ${(finalBlob.size / 1024).toFixed(0)}KB`;

  onProgress?.(100, isWeChat ? '微信表情包生成完成 (已压缩)' : '处理完成 (已压缩)');
  const url = URL.createObjectURL(finalBlob);

  return {
    blob: finalBlob,
    url,
    size: finalBlob.size,
    frameCount: encoded.frameCount,
    width: encoded.width,
    height: encoded.height,
    format: 'gif',
    isWeChatSticker: isWeChat,
    originalSize: file.size,
    compressionRatio: ratio,
    passedWeChatLimit: passedWeChat,
    compressionSummary: summary,
  };
}

// Complete processing pipeline for a static image file (PNG / JPG / WebP etc.)
export async function processStaticImageItem(
  file: File,
  options: RemovalOptions,
  onProgress?: (progress: number, message: string) => void,
  cachedBuffer?: ArrayBuffer,
  cachedFrames?: FrameInfo[]
): Promise<ProcessedGifResult> {
  const isWeChat = !!options.wechat?.enabled;
  const compression = options.compression ?? {
    enabled: true,
    preset: 'wechat-auto',
    targetSizeKb: 500,
    maxColors: 256,
    scaleRatio: 1.0,
    frameStep: 1,
    autoCompressUnderLimit: true,
  };

  onProgress?.(15, '正在读取并解析图片...');

  let sourceImageData: ImageData;
  if (cachedFrames && cachedFrames.length > 0 && cachedFrames[0]?.imageData) {
    sourceImageData = cachedFrames[0].imageData;
  } else {
    const decoded = await decodeStaticImage(file, cachedBuffer);
    sourceImageData = decoded.frames[0].imageData;
  }

  onProgress?.(
    45,
    isWeChat
      ? '正在消除背景并应用微信表情包规范 (白色描边与自适应)...'
      : '正在分析并消除背景色...'
  );

  const rawTransparentData = removeBackgroundFromFrame(sourceImageData, options);
  const processedImageData = isWeChat
    ? renderFrameWithWeChatOptions(rawTransparentData, options.wechat)
    : rawTransparentData;

  onProgress?.(
    75,
    compression.enabled
      ? `正在生成并压缩透明 PNG (微信静态表情规范 ≤${compression.targetSizeKb || 500}KB)...`
      : isWeChat
        ? '正在导出微信表情包透明 PNG...'
        : '正在生成高清无损透明 PNG...'
  );

  const compressed = compression.enabled
    ? await compressStaticImage(
        processedImageData,
        file.size,
        compression,
        (msg) => onProgress?.(85, msg)
      )
    : await (async () => {
        const c = document.createElement('canvas');
        c.width = processedImageData.width;
        c.height = processedImageData.height;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
        ctx.putImageData(processedImageData, 0, 0);
        const b = await new Promise<Blob>((resolve, reject) => {
          c.toBlob((res) => {
            if (res) resolve(res);
            else reject(new Error('导出 PNG 失败'));
          }, 'image/png');
        });
        return { blob: b, width: processedImageData.width, height: processedImageData.height };
      })();

  const finalBlob = compressed.blob;
  const passedWeChat = finalBlob.size <= 512 * 1024;
  const ratio =
    file.size > 0 ? Math.max(0, Math.round((1 - finalBlob.size / file.size) * 100)) : 0;
  const summary =
    file.size > 0
      ? `原图 ${(file.size / 1024).toFixed(0)}KB ➔ 压缩后 ${(finalBlob.size / 1024).toFixed(0)}KB (-${ratio}%) ${passedWeChat ? '✅ 符合微信平台限制' : '⚠️ 仍超出微信限制'}`
      : `文件大小 ${(finalBlob.size / 1024).toFixed(0)}KB`;

  onProgress?.(100, isWeChat ? '微信表情包生成完成 (已压缩)' : '处理完成 (已压缩)');
  const url = URL.createObjectURL(finalBlob);

  return {
    blob: finalBlob,
    url,
    size: finalBlob.size,
    frameCount: 1,
    width: compressed.width,
    height: compressed.height,
    format: 'png',
    isWeChatSticker: isWeChat,
    originalSize: file.size,
    compressionRatio: ratio,
    passedWeChatLimit: passedWeChat,
    compressionSummary: summary,
  };
}

// Unified processor for either GIF or static image
export async function processMediaItem(
  file: File,
  options: RemovalOptions,
  onProgress?: (progress: number, message: string) => void,
  cachedBuffer?: ArrayBuffer,
  cachedFrames?: FrameInfo[]
): Promise<ProcessedGifResult> {
  if (isGifFile(file)) {
    return processGifItem(file, options, onProgress, cachedBuffer);
  } else {
    return processStaticImageItem(file, options, onProgress, cachedBuffer, cachedFrames);
  }
}

