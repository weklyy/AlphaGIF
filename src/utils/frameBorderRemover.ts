/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { rgbToHex, hexToRgb, decodeGif, encodeTransparentGifWithParams } from './gifProcessor';
import { SlicedStickerItem } from '../types';

export interface FrameRemovalOptions {
  enabled?: boolean;
  mode?: 'auto' | 'black' | 'color' | 'inset' | 'none'; // 'auto'=智能全自动, 'black'=去黑框, 'color'=去彩色框, 'inset'=内缩切除, 'none'=仅画笔模式
  targetColor?: string; // 默认 '#000000'
  targetColors?: string[]; // 支持同时累计消除多种线框颜色
  tolerance?: number; // 0 - 100, 默认 35
  borderWidth?: number; // 1 - 12px, 默认 3
  inset?: number; // 0 - 8px, 默认 2
  autoScale?: boolean; // 是否裁剪到内框并居中自适应至 240x240 (默认 true)
  removeOuterMargin?: boolean; // 是否同时透明化外围空白/边距 (默认 true)
  skipColorRemoval?: boolean; // 纯画笔模式：不使用颜色匹配删除，避免误删画作中同色线条与文字
  eraserMaskUrl?: string; // 画笔擦除蒙版
  cellBounds?: { srcX: number; srcY: number; srcW: number; srcH: number };
}

export interface DetectedBorderInfo {
  hasBorder: boolean;
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
  topThickness: number;
  bottomThickness: number;
  leftThickness: number;
  rightThickness: number;
  detectedColor: string;
  confidence: number; // 0 to 1
}

/**
 * Check if pixel RGB matches target frame color or dark threshold
 */
function isColorMatch(
  r: number,
  g: number,
  b: number,
  a: number,
  mode: 'auto' | 'black' | 'color' | 'inset' | 'none',
  targetRgbs: { r: number; g: number; b: number }[] | { r: number; g: number; b: number },
  tolerance: number
): boolean {
  if (mode === 'none') return false;
  if (a < 32) return false; // Transparent pixel is not a border line

  const list: { r: number; g: number; b: number }[] = Array.isArray(targetRgbs)
    ? targetRgbs
    : targetRgbs
    ? [targetRgbs]
    : [{ r: 0, g: 0, b: 0 }];

  // Black or near-black border line check
  const isNearBlack = r <= 65 && g <= 65 && b <= 65;
  if ((mode === 'black' || mode === 'auto') && isNearBlack) return true;

  const maxDist = (Math.max(20, tolerance) / 100) * 255;
  for (const targetRgb of list) {
    if (!targetRgb) continue;
    // If target itself is near black, also allow dark matches
    if (targetRgb.r <= 65 && targetRgb.g <= 65 && targetRgb.b <= 65 && isNearBlack) {
      return true;
    }
    const dr = r - targetRgb.r;
    const dg = g - targetRgb.g;
    const db = b - targetRgb.b;
    const dist = Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114);
    if (dist <= maxDist) return true;
  }

  return false;
}

/**
 * Detect square/rectangular border lines inside an ImageData
 * Strictly scans near the outer boundary (max 6% or 12px) so text and artwork are NEVER detected as lines.
 */
export function detectFrameBorder(
  imageData: ImageData,
  options: FrameRemovalOptions = {}
): DetectedBorderInfo {
  const {
    mode = 'auto',
    targetColor = '#000000',
    targetColors,
    tolerance = 35,
  } = options;

  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const rawColors = targetColors && targetColors.length > 0 ? targetColors : [targetColor || '#000000'];
  let activeTargetRgbs = rawColors.map((c) => hexToRgb(c));

  // Search range: strictly outer margin (max 5-6% of dimension or 12px)
  // Never penetrate deep into the image content or bottom text!
  const maxSearchY = Math.min(12, Math.max(3, Math.floor(height * 0.06)));
  const maxSearchX = Math.min(12, Math.max(3, Math.floor(width * 0.06)));

  // If in 'auto' mode and not specified, sample candidate along outer perimeter (0-6px)
  if (mode === 'auto') {
    const colorCounts: Record<string, number> = {};
    for (let y = 0; y < Math.min(6, maxSearchY); y++) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 2) {
        const p = (y * width + x) * 4;
        if (data[p + 3] > 64) {
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          if (r <= 65 && g <= 65 && b <= 65) {
            colorCounts['0,0,0'] = (colorCounts['0,0,0'] || 0) + 1;
          } else {
            const binR = Math.round(r / 16) * 16;
            const binG = Math.round(g / 16) * 16;
            const binB = Math.round(b / 16) * 16;
            const key = `${binR},${binG},${binB}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
          }
        }
      }
    }
    let bestKey = '0,0,0';
    let bestCount = 0;
    for (const [k, count] of Object.entries(colorCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestKey = k;
      }
    }
    const [br, bg, bb] = bestKey.split(',').map(Number);
    if (bestCount > (width * 0.3) / 2) {
      activeTargetRgbs = [{ r: br, g: bg, b: bb }, ...activeTargetRgbs];
    }
  }

  // Line tester helper: must have high density AND continuous stretch across width/height
  const testStartW = Math.floor(width * 0.1);
  const testEndW = Math.floor(width * 0.9);
  const testTotalW = testEndW - testStartW;

  const testStartH = Math.floor(height * 0.1);
  const testEndH = Math.floor(height * 0.9);
  const testTotalH = testEndH - testStartH;

  // 1. Detect Top Horizontal Line
  let topY = -1;
  let topThickness = 1;
  for (let y = 0; y < maxSearchY; y++) {
    let matchCount = 0;
    let maxConsecutive = 0;
    let currConsecutive = 0;

    for (let x = testStartW; x < testEndW; x++) {
      const p = (y * width + x) * 4;
      if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, activeTargetRgbs, tolerance)) {
        matchCount++;
        currConsecutive++;
        if (currConsecutive > maxConsecutive) maxConsecutive = currConsecutive;
      } else {
        currConsecutive = 0;
      }
    }

    if (matchCount / testTotalW >= 0.55 && maxConsecutive >= Math.floor(testTotalW * 0.3)) {
      topY = y;
      let thick = 1;
      while (y + thick < maxSearchY && thick < 4) {
        let nextMatch = 0;
        for (let x = testStartW; x < testEndW; x++) {
          const np = ((y + thick) * width + x) * 4;
          if (isColorMatch(data[np], data[np + 1], data[np + 2], data[np + 3], mode, activeTargetRgbs, tolerance)) {
            nextMatch++;
          }
        }
        if (nextMatch / testTotalW >= 0.45) {
          thick++;
        } else {
          break;
        }
      }
      topThickness = thick;
      break;
    }
  }

  // 2. Detect Bottom Horizontal Line (Strictly within outer 12px from bottom)
  let bottomY = -1;
  let bottomThickness = 1;
  for (let y = height - 1; y >= height - maxSearchY; y--) {
    let matchCount = 0;
    let maxConsecutive = 0;
    let currConsecutive = 0;

    for (let x = testStartW; x < testEndW; x++) {
      const p = (y * width + x) * 4;
      if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, activeTargetRgbs, tolerance)) {
        matchCount++;
        currConsecutive++;
        if (currConsecutive > maxConsecutive) maxConsecutive = currConsecutive;
      } else {
        currConsecutive = 0;
      }
    }

    // Must be a solid horizontal line across >= 55% of the cell with consecutive stretch
    // Chinese text NEVER has this in the outer 12px margin!
    if (matchCount / testTotalW >= 0.55 && maxConsecutive >= Math.floor(testTotalW * 0.3)) {
      bottomY = y;
      let thick = 1;
      while (y - thick >= height - maxSearchY && thick < 4) {
        let nextMatch = 0;
        for (let x = testStartW; x < testEndW; x++) {
          const np = ((y - thick) * width + x) * 4;
          if (isColorMatch(data[np], data[np + 1], data[np + 2], data[np + 3], mode, activeTargetRgbs, tolerance)) {
            nextMatch++;
          }
        }
        if (nextMatch / testTotalW >= 0.45) {
          thick++;
        } else {
          break;
        }
      }
      bottomThickness = thick;
      break;
    }
  }

  // 3. Detect Left Vertical Line
  let leftX = -1;
  let leftThickness = 1;
  for (let x = 0; x < maxSearchX; x++) {
    let matchCount = 0;
    let maxConsecutive = 0;
    let currConsecutive = 0;

    for (let y = testStartH; y < testEndH; y++) {
      const p = (y * width + x) * 4;
      if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, activeTargetRgbs, tolerance)) {
        matchCount++;
        currConsecutive++;
        if (currConsecutive > maxConsecutive) maxConsecutive = currConsecutive;
      } else {
        currConsecutive = 0;
      }
    }

    if (matchCount / testTotalH >= 0.55 && maxConsecutive >= Math.floor(testTotalH * 0.3)) {
      leftX = x;
      let thick = 1;
      while (x + thick < maxSearchX && thick < 4) {
        let nextMatch = 0;
        for (let y = testStartH; y < testEndH; y++) {
          const np = (y * width + (x + thick)) * 4;
          if (isColorMatch(data[np], data[np + 1], data[np + 2], data[np + 3], mode, activeTargetRgbs, tolerance)) {
            nextMatch++;
          }
        }
        if (nextMatch / testTotalH >= 0.45) {
          thick++;
        } else {
          break;
        }
      }
      leftThickness = thick;
      break;
    }
  }

  // 4. Detect Right Vertical Line
  let rightX = -1;
  let rightThickness = 1;
  for (let x = width - 1; x >= width - maxSearchX; x--) {
    let matchCount = 0;
    let maxConsecutive = 0;
    let currConsecutive = 0;

    for (let y = testStartH; y < testEndH; y++) {
      const p = (y * width + x) * 4;
      if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, activeTargetRgbs, tolerance)) {
        matchCount++;
        currConsecutive++;
        if (currConsecutive > maxConsecutive) maxConsecutive = currConsecutive;
      } else {
        currConsecutive = 0;
      }
    }

    if (matchCount / testTotalH >= 0.55 && maxConsecutive >= Math.floor(testTotalH * 0.3)) {
      rightX = x;
      let thick = 1;
      while (x - thick >= width - maxSearchX && thick < 4) {
        let nextMatch = 0;
        for (let y = testStartH; y < testEndH; y++) {
          const np = (y * width + (x - thick)) * 4;
          if (isColorMatch(data[np], data[np + 1], data[np + 2], data[np + 3], mode, activeTargetRgbs, tolerance)) {
            nextMatch++;
          }
        }
        if (nextMatch / testTotalH >= 0.45) {
          thick++;
        } else {
          break;
        }
      }
      rightThickness = thick;
      break;
    }
  }

  const detectedSidesCount =
    (topY !== -1 ? 1 : 0) +
    (bottomY !== -1 ? 1 : 0) +
    (leftX !== -1 ? 1 : 0) +
    (rightX !== -1 ? 1 : 0);

  // Symmetry inference for outer frame box:
  if (topY !== -1 && bottomY === -1) {
    bottomY = height - 1 - topY;
    bottomThickness = topThickness;
  } else if (bottomY !== -1 && topY === -1) {
    topY = height - 1 - bottomY;
    topThickness = bottomThickness;
  }

  if (leftX !== -1 && rightX === -1) {
    rightX = width - 1 - leftX;
    rightThickness = leftThickness;
  } else if (rightX !== -1 && leftX === -1) {
    leftX = width - 1 - rightX;
    leftThickness = rightThickness;
  }

  if (topY !== -1 && leftX === -1) {
    leftX = topY;
    leftThickness = topThickness;
    rightX = width - 1 - topY;
    rightThickness = topThickness;
  } else if (leftX !== -1 && topY === -1) {
    topY = leftX;
    topThickness = leftThickness;
    bottomY = height - 1 - leftX;
    bottomThickness = leftThickness;
  }

  const hasBorder = detectedSidesCount >= 1;
  const primRgb = activeTargetRgbs[0] || { r: 0, g: 0, b: 0 };
  let detectedHex = rgbToHex(primRgb.r, primRgb.g, primRgb.b);

  if (hasBorder) {
    if (topY !== -1) {
      const midX = Math.floor(width / 2);
      const p = (topY * width + midX) * 4;
      if (data[p + 3] > 64) {
        detectedHex = rgbToHex(data[p], data[p + 1], data[p + 2]);
      }
    } else if (leftX !== -1) {
      const midY = Math.floor(height / 2);
      const p = (midY * width + leftX) * 4;
      if (data[p + 3] > 64) {
        detectedHex = rgbToHex(data[p], data[p + 1], data[p + 2]);
      }
    }
  }

  return {
    hasBorder,
    topY: topY !== -1 ? topY : -1,
    bottomY: bottomY !== -1 ? bottomY : -1,
    leftX: leftX !== -1 ? leftX : -1,
    rightX: rightX !== -1 ? rightX : -1,
    topThickness: Math.min(4, topThickness),
    bottomThickness: Math.min(4, bottomThickness),
    leftThickness: Math.min(4, leftThickness),
    rightThickness: Math.min(4, rightThickness),
    detectedColor: detectedHex,
    confidence: Math.max(0.25, detectedSidesCount / 4),
  };
}

/**
 * Remove square black frame or colored frame from an ImageData.
 * STRICT PRINCIPLE: 删框不能进行缩放，只要把线删除即可，图像不要变动！
 * Zero scaling, zero cropping, zero deformation, and bottom text is 100% preserved!
 */
export function removeSquareFrameBorder(
  sourceImageData: ImageData,
  options: FrameRemovalOptions = {}
): ImageData {
  if (options.skipColorRemoval || options.mode === 'none') {
    return sourceImageData;
  }

  const {
    mode = 'auto',
    targetColor = '#000000',
    targetColors,
    tolerance = 35,
    borderWidth = 3,
  } = options;

  const width = sourceImageData.width;
  const height = sourceImageData.height;

  // Clone pixel data so source is not mutated in place
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.putImageData(sourceImageData, 0, 0);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const rawColors = targetColors && targetColors.length > 0
    ? targetColors
    : [targetColor || '#000000'];
  const targetRgbs = rawColors.map((c) => hexToRgb(c));

  // Detect genuine border line coordinates strictly within outer margin
  const borderInfo = detectFrameBorder(imgData, {
    ...options,
    mode,
    targetColors: rawColors,
    tolerance,
  });

  // NO RESIZING OR SCALING!
  // "删框不能进行缩放，只要把线删除即可，图像不要变动"
  // ONLY erase pixels on the actual detected border lines (1-3px thick strips)
  // All other content, illustrations, and bottom texts remain 100% untouched!

  // 1. Top border line
  if (borderInfo.topY >= 0 && borderInfo.topThickness > 0 && borderInfo.topY < Math.min(14, height * 0.08)) {
    const startY = Math.max(0, borderInfo.topY);
    const endY = Math.min(height - 1, borderInfo.topY + Math.min(4, borderInfo.topThickness) - 1);
    for (let y = startY; y <= endY; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4;
        if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, targetRgbs, tolerance)) {
          data[p + 3] = 0;
        }
      }
    }
  }

  // 2. Bottom border line (strictly near bottom edge, never touching text)
  if (borderInfo.bottomY >= 0 && borderInfo.bottomThickness > 0 && borderInfo.bottomY >= height - Math.min(14, height * 0.08)) {
    const endY = Math.min(height - 1, borderInfo.bottomY);
    const startY = Math.max(0, borderInfo.bottomY - Math.min(4, borderInfo.bottomThickness) + 1);
    for (let y = startY; y <= endY; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4;
        if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, targetRgbs, tolerance)) {
          data[p + 3] = 0;
        }
      }
    }
  }

  // 3. Left border line
  if (borderInfo.leftX >= 0 && borderInfo.leftThickness > 0 && borderInfo.leftX < Math.min(14, width * 0.08)) {
    const startX = Math.max(0, borderInfo.leftX);
    const endX = Math.min(width - 1, borderInfo.leftX + Math.min(4, borderInfo.leftThickness) - 1);
    for (let x = startX; x <= endX; x++) {
      for (let y = 0; y < height; y++) {
        const p = (y * width + x) * 4;
        if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, targetRgbs, tolerance)) {
          data[p + 3] = 0;
        }
      }
    }
  }

  // 4. Right border line
  if (borderInfo.rightX >= 0 && borderInfo.rightThickness > 0 && borderInfo.rightX >= width - Math.min(14, width * 0.08)) {
    const endX = Math.min(width - 1, borderInfo.rightX);
    const startX = Math.max(0, borderInfo.rightX - Math.min(4, borderInfo.rightThickness) + 1);
    for (let x = startX; x <= endX; x++) {
      for (let y = 0; y < height; y++) {
        const p = (y * width + x) * 4;
        if (isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, targetRgbs, tolerance)) {
          data[p + 3] = 0;
        }
      }
    }
  }

  // 5. Clean immediate 1-2px outer boundary line residue (cell separator residue)
  const edgeCut = Math.min(2, Math.max(1, borderWidth));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < edgeCut || x >= width - edgeCut || y < edgeCut || y >= height - edgeCut) {
        const p = (y * width + x) * 4;
        if (data[p + 3] > 0 && isColorMatch(data[p], data[p + 1], data[p + 2], data[p + 3], mode, targetRgbs, tolerance)) {
          data[p + 3] = 0;
        }
      }
    }
  }

  return imgData;
}

/**
 * Process an existing SlicedStickerItem (static PNG or animated GIF)
 * by removing its square black/colored frame and returning an updated item.
 */
export async function processStickerItemFrameRemoval(
  sticker: SlicedStickerItem,
  options: FrameRemovalOptions = {}
): Promise<SlicedStickerItem> {
  const isGif = sticker.name.endsWith('.gif');

  let eraserMaskImg: HTMLImageElement | null = null;
  if (options.eraserMaskUrl) {
    try {
      eraserMaskImg = new Image();
      eraserMaskImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        eraserMaskImg!.onload = () => resolve();
        eraserMaskImg!.onerror = () => resolve();
        eraserMaskImg!.src = options.eraserMaskUrl!;
      });
    } catch {
      eraserMaskImg = null;
    }
  }

  if (isGif) {
    // Preserve original rawBlob so multiple color additions don't lose quality or revert
    const rawBlob = sticker.rawBlob || sticker.blob;
    const rawUrl = sticker.rawUrl || sticker.url;
    const arrayBuffer = await rawBlob.arrayBuffer();
    const decoded = await decodeGif(arrayBuffer);

    // Temp canvas for mask application if needed
    const tempMaskCanvas = document.createElement('canvas');
    tempMaskCanvas.width = 240;
    tempMaskCanvas.height = 240;
    const tempMaskCtx = tempMaskCanvas.getContext('2d')!;

    // Process each frame with cumulative target colors
    const processedFrames = decoded.frames.map((frame) => {
      let cleanedData = options.skipColorRemoval
        ? frame.imageData
        : removeSquareFrameBorder(frame.imageData, options);

      if (eraserMaskImg) {
        tempMaskCtx.clearRect(0, 0, 240, 240);
        tempMaskCtx.putImageData(cleanedData, 0, 0);
        tempMaskCtx.save();
        tempMaskCtx.globalCompositeOperation = 'destination-out';
        if (options.cellBounds) {
          tempMaskCtx.drawImage(
            eraserMaskImg,
            options.cellBounds.srcX,
            options.cellBounds.srcY,
            options.cellBounds.srcW,
            options.cellBounds.srcH,
            0,
            0,
            240,
            240
          );
        } else {
          tempMaskCtx.drawImage(eraserMaskImg, 0, 0, 240, 240);
        }
        tempMaskCtx.restore();
        cleanedData = tempMaskCtx.getImageData(0, 0, 240, 240);
      }

      return {
        imageData: cleanedData,
        delay: frame.delay,
      };
    });

    // Re-encode GIF with standard WeChat palette settings
    const encoded = await encodeTransparentGifWithParams(
      processedFrames,
      240,
      240,
      { maxColors: 255 }
    );

    const newBlob = encoded.blob;
    if (sticker.url && sticker.url !== rawUrl) URL.revokeObjectURL(sticker.url);
    const newUrl = URL.createObjectURL(newBlob);

    // Render representative frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 240;
    tempCanvas.height = 240;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(processedFrames[0].imageData, 0, 0);
    const newRepUrl = tempCanvas.toDataURL('image/png');

    return {
      ...sticker,
      rawBlob,
      rawUrl,
      blob: newBlob,
      url: newUrl,
      size: newBlob.size,
      width: 240,
      height: 240,
      representativeFrameData: processedFrames[0].imageData,
      representativeDataUrl: newRepUrl,
    };
  } else {
    // Static PNG sticker
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const sourceUrl = sticker.rawUrl || sticker.url;
    const rawBlob = sticker.rawBlob || sticker.blob;

    // Load sticker image onto canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('无法解析切片图片'));
      img.src = sourceUrl;
    });

    ctx.drawImage(img, 0, 0, 240, 240);
    let rawData = ctx.getImageData(0, 0, 240, 240);
    let cleanedData = options.skipColorRemoval
      ? rawData
      : removeSquareFrameBorder(rawData, options);

    ctx.putImageData(cleanedData, 0, 0);

    // Apply brush eraser mask if present
    if (eraserMaskImg) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      if (options.cellBounds) {
        ctx.drawImage(
          eraserMaskImg,
          options.cellBounds.srcX,
          options.cellBounds.srcY,
          options.cellBounds.srcW,
          options.cellBounds.srcH,
          0,
          0,
          240,
          240
        );
      } else {
        ctx.drawImage(eraserMaskImg, 0, 0, 240, 240);
      }
      ctx.restore();
      cleanedData = ctx.getImageData(0, 0, 240, 240);
    }

    const newBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });

    if (sticker.url && sticker.url !== sourceUrl) URL.revokeObjectURL(sticker.url);
    const newUrl = URL.createObjectURL(newBlob);
    const newRepUrl = canvas.toDataURL('image/png');

    return {
      ...sticker,
      rawBlob,
      rawUrl: sourceUrl,
      blob: newBlob,
      url: newUrl,
      size: newBlob.size,
      width: 240,
      height: 240,
      representativeFrameData: cleanedData,
      representativeDataUrl: newRepUrl,
    };
  }
}

export interface SampledClickFrameResult {
  hex: string;
  isDark: boolean;
  suggestedMode: 'black' | 'color';
  suggestedTolerance: number;
  suggestedThickness: number;
  suggestedInset: number;
  suggestedAutoScale: boolean;
  foundLine: boolean;
  cellIndex: number;
}

/**
 * Sample the exact border line color and geometry when user clicks anywhere near or on a frame box.
 * Uses smart line-snapping and cell-perimeter detection to ensure effortless 100% selection accuracy.
 */
export function sampleBorderColorAndGeometryFromClick(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  normX: number, // 0 to 1
  normY: number, // 0 to 1
  cols: number = 4,
  rows: number = 4,
  cropArea?: { x: number; y: number; width: number; height: number }
): SampledClickFrameResult {
  const nw = (source as HTMLImageElement).naturalWidth || (source as HTMLVideoElement).videoWidth || source.width || 1024;
  const nh = (source as HTMLImageElement).naturalHeight || (source as HTMLVideoElement).videoHeight || source.height || 1024;

  const clickPxX = Math.max(0, Math.min(nw - 1, Math.floor(normX * nw)));
  const clickPxY = Math.max(0, Math.min(nh - 1, Math.floor(normY * nh)));

  const activeCrop = cropArea || { x: 0, y: 0, width: 100, height: 100 };
  const cropX = (activeCrop.x / 100) * nw;
  const cropY = (activeCrop.y / 100) * nh;
  const cropW = Math.max(10, (activeCrop.width / 100) * nw);
  const cropH = Math.max(10, (activeCrop.height / 100) * nh);

  const cropNormX = Math.max(0, Math.min(1, (clickPxX - cropX) / cropW));
  const cropNormY = Math.max(0, Math.min(1, (clickPxY - cropY) / cropH));
  const cellCol = Math.min(cols - 1, Math.max(0, Math.floor(cropNormX * cols)));
  const cellRow = Math.min(rows - 1, Math.max(0, Math.floor(cropNormY * rows)));
  const cellIndex = cellRow * cols + cellCol;

  // 1. Stage 1: Search local 57x57 window for straight border lines
  const radius = 28;
  const startX = Math.max(0, clickPxX - radius);
  const startY = Math.max(0, clickPxY - radius);
  const sampleW = Math.min(nw - startX, radius * 2 + 1);
  const sampleH = Math.min(nh - startY, radius * 2 + 1);

  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let bestHex = '#000000';
  let isDark = true;
  let foundLine = false;
  let detectedThickness = 3;

  if (ctx) {
    ctx.drawImage(source, startX, startY, sampleW, sampleH, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Check horizontal line slices in sample window
    let bestHScore = 0;
    let bestHHex = '#000000';
    let bestHThick = 2;
    for (let y = 1; y < sampleH - 1; y++) {
      let rSum = 0, gSum = 0, bSum = 0, validCount = 0;
      let minB = 255;
      for (let x = 2; x < sampleW - 2; x++) {
        const p = (y * sampleW + x) * 4;
        if (data[p + 3] > 64) {
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          rSum += r;
          gSum += g;
          bSum += b;
          validCount++;
          const brightness = r * 0.299 + g * 0.587 + b * 0.114;
          if (brightness < minB) minB = brightness;
        }
      }
      if (validCount >= Math.floor(sampleW * 0.6)) {
        const avgR = Math.round(rSum / validCount);
        const avgG = Math.round(gSum / validCount);
        const avgB = Math.round(bSum / validCount);
        // Measure contrast against row above and below
        const pAbove = ((y - 1) * sampleW + Math.floor(sampleW / 2)) * 4;
        const pBelow = ((y + 1) * sampleW + Math.floor(sampleW / 2)) * 4;
        const contrast = Math.abs(avgR - data[pAbove]) + Math.abs(avgG - data[pAbove + 1]) + Math.abs(avgB - data[pAbove + 2])
                       + Math.abs(avgR - data[pBelow]) + Math.abs(avgG - data[pBelow + 1]) + Math.abs(avgB - data[pBelow + 2]);
        const score = contrast + (255 - minB);
        if (score > bestHScore && contrast > 30) {
          bestHScore = score;
          bestHHex = rgbToHex(avgR, avgG, avgB);
        }
      }
    }

    // Check vertical line slices in sample window
    let bestVScore = 0;
    let bestVHex = '#000000';
    for (let x = 1; x < sampleW - 1; x++) {
      let rSum = 0, gSum = 0, bSum = 0, validCount = 0;
      let minB = 255;
      for (let y = 2; y < sampleH - 2; y++) {
        const p = (y * sampleW + x) * 4;
        if (data[p + 3] > 64) {
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          rSum += r;
          gSum += g;
          bSum += b;
          validCount++;
          const brightness = r * 0.299 + g * 0.587 + b * 0.114;
          if (brightness < minB) minB = brightness;
        }
      }
      if (validCount >= Math.floor(sampleH * 0.6)) {
        const avgR = Math.round(rSum / validCount);
        const avgG = Math.round(gSum / validCount);
        const avgB = Math.round(bSum / validCount);
        const pLeft = (Math.floor(sampleH / 2) * sampleW + (x - 1)) * 4;
        const pRight = (Math.floor(sampleH / 2) * sampleW + (x + 1)) * 4;
        const contrast = Math.abs(avgR - data[pLeft]) + Math.abs(avgG - data[pLeft + 1]) + Math.abs(avgB - data[pLeft + 2])
                       + Math.abs(avgR - data[pRight]) + Math.abs(avgG - data[pRight + 1]) + Math.abs(avgB - data[pRight + 2]);
        const score = contrast + (255 - minB);
        if (score > bestVScore && contrast > 30) {
          bestVScore = score;
          bestVHex = rgbToHex(avgR, avgG, avgB);
        }
      }
    }

    if (bestHScore > 80 || bestVScore > 80) {
      foundLine = true;
      bestHex = bestHScore >= bestVScore ? bestHHex : bestVHex;
    } else {
      // Fallback: search for darkest or highest contrast pixel in window
      let minBrightness = 999;
      let darkHex: string | null = null;
      for (let y = 0; y < sampleH; y++) {
        for (let x = 0; x < sampleW; x++) {
          const p = (y * sampleW + x) * 4;
          if (data[p + 3] < 64) continue;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const brightness = r * 0.299 + g * 0.587 + b * 0.114;
          if (brightness < minBrightness) {
            minBrightness = brightness;
            bestHex = rgbToHex(r, g, b);
          }
          if (r <= 65 && g <= 65 && b <= 65) {
            darkHex = rgbToHex(r, g, b);
          }
        }
      }
      if (darkHex) {
        bestHex = darkHex;
      }
    }
  }

  // 2. Stage 2: If click was inside cell, also verify cell boundary lines
  if (!foundLine && cols > 0 && rows > 0) {
    const singleCellW = cropW / cols;
    const singleCellH = cropH / rows;
    const cellLeft = cropX + cellCol * singleCellW;
    const cellTop = cropY + cellRow * singleCellH;
    const cellCanvas = document.createElement('canvas');
    const cDim = 120;
    cellCanvas.width = cDim;
    cellCanvas.height = cDim;
    const cCtx = cellCanvas.getContext('2d', { willReadFrequently: true });
    if (cCtx) {
      cCtx.drawImage(source, cellLeft, cellTop, singleCellW, singleCellH, 0, 0, cDim, cDim);
      const cData = cCtx.getImageData(0, 0, cDim, cDim);
      const border = detectFrameBorder(cData, { mode: 'auto', tolerance: 35 });
      if (border.hasBorder && border.detectedColor) {
        bestHex = border.detectedColor;
        foundLine = true;
        detectedThickness = Math.max(2, Math.round((border.topThickness / cDim) * singleCellW));
      }
    }
  }

  const rgb = hexToRgb(bestHex);
  const brightness = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
  isDark = brightness < 75 || (rgb.r <= 65 && rgb.g <= 65 && rgb.b <= 65);

  return {
    hex: bestHex,
    isDark,
    suggestedMode: isDark ? 'black' : 'color',
    suggestedTolerance: isDark ? 38 : 42,
    suggestedThickness: Math.min(4, Math.max(2, detectedThickness)),
    suggestedInset: 0,
    suggestedAutoScale: false,
    foundLine,
    cellIndex,
  };
}

export interface AutoDetectedAtlasFrame {
  found: boolean;
  hex: string;
  mode: 'black' | 'color';
  tolerance: number;
  thickness: number;
  inset: number;
  autoScale: boolean;
}

/**
 * Automatically inspects the spritesheet / video grid and discovers
 * the consistent border box color and thickness across all cells with 1 click!
 * STRICT PRINCIPLE: 删框不能进行缩放，只要把线删除即可，图像不要变动！
 */
export function autoDetectAtlasFrameBorder(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  cols: number = 4,
  rows: number = 4,
  cropArea?: { x: number; y: number; width: number; height: number }
): AutoDetectedAtlasFrame {
  const canvas = document.createElement('canvas');
  const nw = (source as HTMLImageElement).naturalWidth || (source as HTMLVideoElement).videoWidth || source.width || 1024;
  const nh = (source as HTMLImageElement).naturalHeight || (source as HTMLVideoElement).videoHeight || source.height || 1024;

  const testDim = 600;
  canvas.width = testDim;
  canvas.height = testDim;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const activeCrop = cropArea || { x: 0, y: 0, width: 100, height: 100 };
  const sx = (activeCrop.x / 100) * nw;
  const sy = (activeCrop.y / 100) * nh;
  const sw = (activeCrop.width / 100) * nw;
  const sh = (activeCrop.height / 100) * nh;

  if (ctx) {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, testDim, testDim);
    const data = ctx.getImageData(0, 0, testDim, testDim).data;

    const cellW = testDim / Math.max(1, cols);
    const cellH = testDim / Math.max(1, rows);

    // Track line colors along inner cell boundaries across outer margins only
    const colorVotes: Record<string, number> = {};
    let darkVotes = 0;

    const sampleCells = Math.min(8, cols * rows);
    for (let c = 0; c < sampleCells; c++) {
      const colIdx = c % cols;
      const rowIdx = Math.floor(c / cols);
      const cellLeft = Math.floor(colIdx * cellW);
      const cellTop = Math.floor(rowIdx * cellH);
      const cellRight = Math.floor(cellLeft + cellW);
      const cellBottom = Math.floor(cellTop + cellH);

      // Scan shallow outer margins only (1-4px) to avoid hitting text at bottom
      const margins = [1, 2, 4];

      for (const m of margins) {
        // Horizontal line sample (top edge only, avoid bottom text)
        for (let x = cellLeft + Math.floor(cellW * 0.2); x < cellRight - Math.floor(cellW * 0.2); x += 2) {
          const pTop = ((cellTop + m) * testDim + x) * 4;

          if (pTop < data.length && data[pTop + 3] > 64) {
            const r = data[pTop];
            const g = data[pTop + 1];
            const b = data[pTop + 2];
            if (r <= 65 && g <= 65 && b <= 65) {
              darkVotes++;
            } else {
              const binR = Math.round(r / 16) * 16;
              const binG = Math.round(g / 16) * 16;
              const binB = Math.round(b / 16) * 16;
              const key = rgbToHex(binR, binG, binB);
              colorVotes[key] = (colorVotes[key] || 0) + 1;
            }
          }
        }

        // Vertical line sample (left and right edges)
        for (let y = cellTop + Math.floor(cellH * 0.2); y < cellBottom - Math.floor(cellH * 0.2); y += 2) {
          const pLeft = (y * testDim + (cellLeft + m)) * 4;
          const pRight = (y * testDim + (cellRight - m)) * 4;

          for (const p of [pLeft, pRight]) {
            if (p < data.length && data[p + 3] > 64) {
              const r = data[p];
              const g = data[p + 1];
              const b = data[p + 2];
              if (r <= 65 && g <= 65 && b <= 65) {
                darkVotes++;
              } else {
                const binR = Math.round(r / 16) * 16;
                const binG = Math.round(g / 16) * 16;
                const binB = Math.round(b / 16) * 16;
                const key = rgbToHex(binR, binG, binB);
                colorVotes[key] = (colorVotes[key] || 0) + 1;
              }
            }
          }
        }
      }
    }

    if (darkVotes >= 10) {
      return {
        found: true,
        hex: '#000000',
        mode: 'black',
        tolerance: 38,
        thickness: 3,
        inset: 0,
        autoScale: false,
      };
    }

    let topColor = '#000000';
    let maxVotes = 0;
    for (const [hex, votes] of Object.entries(colorVotes)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        topColor = hex;
      }
    }

    if (maxVotes >= 10) {
      return {
        found: true,
        hex: topColor,
        mode: 'color',
        tolerance: 40,
        thickness: 3,
        inset: 0,
        autoScale: false,
      };
    }
  }

  // Fallback defaults to zero-scale black line elimination
  return {
    found: true,
    hex: '#000000',
    mode: 'black',
    tolerance: 38,
    thickness: 3,
    inset: 0,
    autoScale: false,
  };
}

