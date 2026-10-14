/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlicedStickerItem } from '../types';
import { StickerTextConfig, drawStickerText, applyEraseActions } from './stickerFontPresets';
import { decodeGif, encodeTransparentGifWithParams, decodeMediaFile } from './gifProcessor';

/**
 * Burn custom typography (font, size, color, stroke, position, orientation)
 * and manual erase operations (wiping out original text) onto a single sticker item (GIF or PNG).
 * Preserves the original raw blob so the user can re-edit or undo text anytime without quality degradation.
 */
export async function burnTextToStickerItem(
  sticker: SlicedStickerItem,
  config: StickerTextConfig
): Promise<SlicedStickerItem> {
  const isGif =
    sticker.frameCount > 1 ||
    sticker.name.toLowerCase().endsWith('.gif') ||
    sticker.blob.type === 'image/gif';

  // Preserve raw media backup
  const sourceBlob = sticker.rawBlob || sticker.blob;
  const sourceUrl = sticker.rawUrl || sticker.url;

  if (isGif) {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const decoded = await decodeGif(arrayBuffer);
    const width = decoded.width;
    const height = decoded.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not create 2d canvas context');

    const updatedFrames: { imageData: ImageData; delay: number }[] = [];

    for (let f = 0; f < decoded.frames.length; f++) {
      const frame = decoded.frames[f];
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(frame.imageData, 0, 0);

      // Apply manual eraser actions (wipe out original text) across all GIF frames
      if (config.eraseActions && config.eraseActions.length > 0) {
        applyEraseActions(ctx, config.eraseActions);
      }

      // Draw custom styled text overlay (if text is provided)
      if (config.text && config.text.trim().length > 0) {
        drawStickerText(ctx, config, width, height);
      }

      const modifiedImageData = ctx.getImageData(0, 0, width, height);
      updatedFrames.push({
        imageData: modifiedImageData,
        delay: frame.delay,
      });
    }

    // Re-encode into transparent animated GIF
    const encoded = await encodeTransparentGifWithParams(
      updatedFrames,
      width,
      height,
      {
        maxColors: 256,
        scaleRatio: 1.0,
        frameStep: 1,
      }
    );

    const newBlob = encoded.blob;
    const newUrl = URL.createObjectURL(newBlob);

    // Generate representative frame data URL
    const repFrame = updatedFrames[0].imageData;
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(repFrame, 0, 0);
    const repDataUrl = canvas.toDataURL('image/png');

    return {
      ...sticker,
      blob: newBlob,
      url: newUrl,
      rawBlob: sourceBlob,
      rawUrl: sourceUrl,
      size: newBlob.size,
      width,
      height,
      representativeFrameData: repFrame,
      representativeDataUrl: repDataUrl,
      textConfig: config,
    };
  } else {
    // Static Image (PNG / JPG)
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);

        // Apply manual eraser actions (wipe out original text)
        if (config.eraseActions && config.eraseActions.length > 0) {
          applyEraseActions(ctx, config.eraseActions);
        }

        // Draw styled text
        if (config.text && config.text.trim().length > 0) {
          drawStickerText(ctx, config, w, h);
        }

        const repImageData = ctx.getImageData(0, 0, w, h);
        const repDataUrl = canvas.toDataURL('image/png');

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to generate PNG blob'));
            return;
          }
          const newUrl = URL.createObjectURL(blob);
          resolve({
            ...sticker,
            blob,
            url: newUrl,
            rawBlob: sourceBlob,
            rawUrl: sourceUrl,
            size: blob.size,
            representativeFrameData: repImageData,
            representativeDataUrl: repDataUrl,
            textConfig: config,
          });
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load image for text burning'));
      img.src = sourceUrl;
    });
  }
}

/**
 * Revert a sticker to its original image state before any text was added
 */
export function revertStickerText(sticker: SlicedStickerItem): SlicedStickerItem {
  if (!sticker.rawBlob || !sticker.rawUrl) {
    return sticker;
  }
  return {
    ...sticker,
    blob: sticker.rawBlob,
    url: sticker.rawUrl,
    size: sticker.rawBlob.size,
    textConfig: undefined,
  };
}

/**
 * Batch burn text across multiple stickers
 */
export async function batchBurnTextToStickers(
  stickers: SlicedStickerItem[],
  configs: Record<number, StickerTextConfig> | StickerTextConfig,
  onProgress?: (percent: number, current: number, total: number) => void
): Promise<SlicedStickerItem[]> {
  const result: SlicedStickerItem[] = [];
  const total = stickers.length;

  for (let i = 0; i < total; i++) {
    const sticker = stickers[i];
    const config =
      'text' in configs
        ? (configs as StickerTextConfig)
        : (configs as Record<number, StickerTextConfig>)[sticker.index];

    if (config && config.text && config.text.trim().length > 0) {
      const updated = await burnTextToStickerItem(sticker, config);
      result.push(updated);
    } else {
      result.push(sticker);
    }

    onProgress?.(Math.round(((i + 1) / total) * 100), i + 1, total);
  }

  return result;
}
