import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { ImageGridConfig, SlicedStickerItem } from '../types';
import { removeBackgroundFromFrame, applyWhiteOutline, cleanEdgeBlackBordersAndMargins } from './gifProcessor';
import { calculateCellBounds } from './gridGeometry';

/**
 * Generate a high-resolution 16-grid (4x4) static emoji spritesheet demo image
 * (White background, cute characters with caption texts, ready for slicing test)
 */
export async function generateDemo16GridImage(): Promise<{ file: File; url: string }> {
  const canvas = document.createElement('canvas');
  const width = 1024;
  const height = 1024;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // 1. Fill crisp white background (common AI generated grid image background)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const cellW = width / 4;
  const cellH = height / 4;

  const stickers = [
    { text: '收到', emoji: '👍', color: '#ffb703', title: '收到点赞' },
    { text: '谢谢老板', emoji: '🙏', color: '#e76f51', title: '双手合十' },
    { text: '爱你哟', emoji: '💖', color: '#f4a261', title: '比心发射' },
    { text: '哈哈哈哈', emoji: '🤣', color: '#2a9d8f', title: '大笑不止' },
    { text: '冲鸭加油', emoji: '🔥', color: '#e63946', title: '全力以赴' },
    { text: '吃个瓜', emoji: '🍉', color: '#588157', title: '围观吃瓜' },
    { text: '问号脸', emoji: '❓', color: '#8338ec', title: '满头问号' },
    { text: '太难了', emoji: '😭', color: '#3a86ff', title: '泪奔抓狂' },
    { text: '摸鱼中', emoji: '☕', color: '#4a4e69', title: '悠闲咖啡' },
    { text: 'OK没问题', emoji: '👌', color: '#06d6a0', title: '妥妥的' },
    { text: '暗中观察', emoji: '👀', color: '#118ab2', title: '小鹿乱撞' },
    { text: '生气啦', emoji: '💢', color: '#d00000', title: '气鼓鼓' },
    { text: '困到变形', emoji: '💤', color: '#7209b7', title: '晚安好梦' },
    { text: '大佬求带', emoji: '🙇', color: '#ff9f1c', title: '真诚膜拜' },
    { text: '溜了溜了', emoji: '🏃', color: '#3d405b', title: '告辞撤退' },
    { text: '开心到飞起', emoji: '🎉', color: '#ff006e', title: '庆祝撒花' },
  ];

  for (let i = 0; i < 16; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;
    const item = stickers[i];

    // Delicate grid separation lines (AI grid generator boundary)
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);

    ctx.save();
    ctx.translate(cx, cy);

    // Character Face/Head Base (Cute Round Mascot)
    ctx.beginPath();
    ctx.arc(0, -14, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdf6d';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e6af00';
    ctx.stroke();

    // Cute Ears
    const drawEar = (ex: number) => {
      ctx.beginPath();
      ctx.arc(ex, -64, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdf6d';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#e6af00';
      ctx.stroke();
      // Inner ear
      ctx.beginPath();
      ctx.arc(ex, -64, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb5a7';
      ctx.fill();
    };
    drawEar(-42);
    drawEar(42);

    // Blush Cheeks
    ctx.fillStyle = 'rgba(255, 120, 120, 0.45)';
    ctx.beginPath();
    ctx.arc(-32, -4, 12, 0, Math.PI * 2);
    ctx.arc(32, -4, 12, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-20, -18, 7, 0, Math.PI * 2);
    ctx.arc(20, -18, 7, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-18, -20, 2.5, 0, Math.PI * 2);
    ctx.arc(22, -20, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Cute nose & mouth
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -4, 12, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    // Small icon or prop badge
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, 44, -36);

    // Caption Pill at bottom
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(-64, 52, 128, 32, 16);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Caption Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.text, 0, 68);

    ctx.restore();
  }

  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const file = new File([blob], 'demo_16grid_stickers.png', { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  return { file, url };
}

/**
 * Slice a static image into WeChat compliant 240x240 PNG or GIF stickers
 */
export async function sliceImageIntoStickers(
  imageSource: HTMLImageElement | File,
  config: ImageGridConfig,
  onProgress?: (progress: number, currentCell: number, totalCells: number, statusText: string) => void
): Promise<SlicedStickerItem[]> {
  const {
    cols,
    rows,
    cropArea,
    paddingInset,
    autoTransparent,
    bgColor,
    tolerance,
    addWhiteOutline,
    outlineWidth,
    outputFormat = 'png',
    colSplits,
    rowSplits,
    cellOverrides,
    layoutMode,
    independentBoxes,
  } = config;

  let imgElement: HTMLImageElement;
  let shouldRevoke = false;

  if (imageSource instanceof File) {
    const url = URL.createObjectURL(imageSource);
    shouldRevoke = true;
    imgElement = new Image();
    await new Promise<void>((resolve, reject) => {
      imgElement.onload = () => resolve();
      imgElement.onerror = () => reject(new Error('无法解析上传的静态图片文件'));
      imgElement.src = url;
    });
  } else {
    imgElement = imageSource;
  }

  try {
    const imgW = imgElement.naturalWidth || imgElement.width || 1024;
    const imgH = imgElement.naturalHeight || imgElement.height || 1024;

    const totalCells = cols * rows;
    onProgress?.(10, 0, totalCells, '计算切片坐标与区域...');

    // Calculate crop rectangle in source pixel space
    const cropX = (cropArea.x / 100) * imgW;
    const cropY = (cropArea.y / 100) * imgH;
    const cropW = Math.max(10, (cropArea.width / 100) * imgW);
    const cropH = Math.max(10, (cropArea.height / 100) * imgH);

    const cellW = cropW / cols;
    const cellH = cropH / rows;

    const stickers: SlicedStickerItem[] = [];

    // Temporary working canvas for 240x240 standard WeChat output
    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = 240;
    cellCanvas.height = 240;
    const cellCtx = cellCanvas.getContext('2d', { willReadFrequently: true })!;

    for (let index = 0; index < totalCells; index++) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const stickerNum = index + 1;
      const progressPercent = 15 + Math.round(((index + 1) / totalCells) * 75);

      onProgress?.(
        progressPercent,
        stickerNum,
        totalCells,
        `正在切片第 ${stickerNum}/${totalCells} 格 (行${row + 1}, 列${col + 1})...`
      );

      // Clear canvas with transparency
      cellCtx.clearRect(0, 0, 240, 240);

      // Source cell bounding rect with splits, padding inset, and per-cell overrides
      const cellBounds = calculateCellBounds({
        cropX,
        cropY,
        cropW,
        cropH,
        cols,
        rows,
        col,
        row,
        cellIndex: index,
        layoutMode,
        independentBox: independentBoxes?.[index],
        colSplits,
        rowSplits,
        cellOverride: cellOverrides?.[index],
        paddingInset: paddingInset || 0,
        sourceWidth: imgW,
        sourceHeight: imgH,
      });

      const srcX = cellBounds.sx;
      const srcY = cellBounds.sy;
      const srcW = cellBounds.sw;
      const srcH = cellBounds.sh;

      // Scale and center the sliced cell into standard 240x240 canvas maintaining aspect ratio
      const scale = Math.min(240 / srcW, 240 / srcH);
      const dstW = srcW * scale;
      const dstH = srcH * scale;
      const dstX = (240 - dstW) / 2;
      const dstY = (240 - dstH) / 2;

      cellCtx.drawImage(imgElement, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

      // Read pixel data
      let imageData = cellCtx.getImageData(0, 0, 240, 240);

      // Clean unselected margins & edge black bars so unpainted padding is completely transparent
      imageData = cleanEdgeBlackBordersAndMargins(imageData, 32);

      // Remove background if requested
      if (autoTransparent) {
        imageData = removeBackgroundFromFrame(imageData, {
          targetColor: bgColor || '#ffffff',
          tolerance: tolerance || 20,
          contiguous: false,
          defringe: 1,
        });
      }

      // Add WeChat official 2px white outline if requested
      if (addWhiteOutline) {
        imageData = applyWhiteOutline(imageData, outlineWidth || 2, '#ffffff');
      }

      // Put processed pixels back to canvas
      cellCtx.putImageData(imageData, 0, 0);

      // Generate representative preview URL
      const repDataUrl = cellCanvas.toDataURL('image/png');

      // Export format (PNG is WeChat official static sticker standard; GIF is also supported)
      let blob: Blob;
      const ext = outputFormat === 'gif' ? 'gif' : 'png';
      const fileName = `${stickerNum < 10 ? '0' : ''}${stickerNum}_T.${ext}`;

      if (outputFormat === 'gif') {
        const encoder = new GIFEncoder();
        const data = imageData.data;
        const totalPixels = 240 * 240;
        let opaqueCount = 0;
        for (let p = 0; p < totalPixels; p++) {
          if (data[p * 4 + 3] > 64) opaqueCount++;
        }

        if (opaqueCount === 0) {
          const palette = [[0, 0, 0]];
          const index = new Uint8Array(totalPixels);
          encoder.writeFrame(index, 240, 240, {
            palette,
            delay: 0,
            transparent: true,
            transparentIndex: 0,
            dispose: 2,
            repeat: 0,
          });
        } else {
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
          const opaquePalette = quantize(opaquePixels, 255, { format: 'rgb565' });
          const fullPalette = [[0, 0, 0], ...opaquePalette];
          const rawIndices = applyPalette(data, opaquePalette, 'rgb565');
          const finalIndices = new Uint8Array(totalPixels);
          for (let p = 0; p < totalPixels; p++) {
            if (data[p * 4 + 3] <= 64) {
              finalIndices[p] = 0;
            } else {
              finalIndices[p] = rawIndices[p] + 1;
            }
          }
          encoder.writeFrame(finalIndices, 240, 240, {
            palette: fullPalette,
            delay: 0,
            transparent: true,
            transparentIndex: 0,
            dispose: 2,
            repeat: 0,
          });
        }
        encoder.finish();
        const gifBytes = encoder.bytes();
        blob = new Blob([gifBytes], { type: 'image/gif' });
      } else {
        blob = await new Promise<Blob>((resolve) => {
          cellCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
        });
      }

      const stickerUrl = URL.createObjectURL(blob);

      stickers.push({
        index: stickerNum,
        name: fileName,
        row,
        col,
        blob,
        url: stickerUrl,
        size: blob.size,
        width: 240,
        height: 240,
        frameCount: 1,
        duration: 0,
        representativeFrameData: imageData,
        representativeDataUrl: repDataUrl,
      });

      // Brief tick for responsive UI
      await new Promise((r) => setTimeout(r, 8));
    }

    onProgress?.(95, totalCells, totalCells, '静态切片全部完成，准备生成审核物料...');
    return stickers;
  } finally {
    if (shouldRevoke && imgElement) {
      URL.revokeObjectURL(imgElement.src);
    }
  }
}
