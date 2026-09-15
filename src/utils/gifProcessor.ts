import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { RemovalOptions, ProcessedGifResult, FrameInfo } from '../types';

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

// Encode processed frames into a GIF blob
export async function encodeTransparentGif(
  frames: { imageData: ImageData; delay: number }[],
  width: number,
  height: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const gif = GIFEncoder();
  const totalFrames = frames.length;

  for (let f = 0; f < totalFrames; f++) {
    const frame = frames[f];
    const data = frame.imageData.data;
    const totalPixels = width * height;

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
      gif.writeFrame(index, width, height, {
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

      // Quantize down to at most 255 colors (saving index 0 for transparent)
      const opaquePalette = quantize(opaquePixels, 255, { format: 'rgb565' });

      // Build full palette: index 0 is transparent dummy color
      const fullPalette = [[0, 0, 0], ...opaquePalette];

      // Map the entire frame using applyPalette with opaquePalette
      // Then offset indices by +1 for opaque pixels, and 0 for transparent pixels
      const rawIndices = applyPalette(data, opaquePalette, 'rgb565');
      const finalIndices = new Uint8Array(totalPixels);

      for (let p = 0; p < totalPixels; p++) {
        if (data[p * 4 + 3] <= 64) {
          finalIndices[p] = 0; // transparent
        } else {
          finalIndices[p] = rawIndices[p] + 1; // opaque color index in fullPalette
        }
      }

      gif.writeFrame(finalIndices, width, height, {
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

    // Yield to browser event loop so UI stays super responsive
    if (f % 2 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes], { type: 'image/gif' });
}

// Complete processing pipeline for a single GIF file
export async function processGifItem(
  file: File,
  options: RemovalOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<ProcessedGifResult> {
  onProgress?.(10, '正在解析 GIF 帧...');
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await decodeGif(arrayBuffer);

  onProgress?.(30, '正在处理背景透明化...');
  const processedFrames = decoded.frames.map((frame) => ({
    imageData: removeBackgroundFromFrame(frame.imageData, options),
    delay: frame.delay,
  }));

  onProgress?.(50, '正在重新编码透明 GIF...');
  const blob = await encodeTransparentGif(
    processedFrames,
    decoded.width,
    decoded.height,
    (pct) => {
      const mappedPct = Math.round(50 + (pct / 100) * 45);
      onProgress?.(mappedPct, `正在编码 GIF 帧 (${pct}%)...`);
    }
  );

  onProgress?.(100, '处理完成');
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    size: blob.size,
    frameCount: decoded.frames.length,
    width: decoded.width,
    height: decoded.height,
  };
}
