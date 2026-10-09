/**
 * Demo 15-Grid (5 columns x 3 rows) Generator
 * Procedurally creates a high quality 5x3 sticker sheet on Canvas for instant testing
 */

export interface DemoGrid15StickerInfo {
  index: number;
  row: number; // 1, 2, 3
  col: number; // 1, 2, 3, 4, 5
  name: string;
  emoji: string;
  bgColor: string;
  faceColor: string;
}

export const DEMO_15_STICKERS: DemoGrid15StickerInfo[] = [
  // Row 1 (Top 5: most prone to being cropped by AI video models!)
  { index: 1, row: 1, col: 1, name: '开怀大笑', emoji: '😄', bgColor: '#FEF3C7', faceColor: '#F59E0B' },
  { index: 2, row: 1, col: 2, name: '害羞脸红', emoji: '🥰', bgColor: '#FCE7F3', faceColor: '#EC4899' },
  { index: 3, row: 1, col: 3, name: '疑惑问号', emoji: '🤔', bgColor: '#EDE9FE', faceColor: '#8B5CF6' },
  { index: 4, row: 1, col: 4, name: '酷酷墨镜', emoji: '😎', bgColor: '#E0E7FF', faceColor: '#6366F1' },
  { index: 5, row: 1, col: 5, name: '眨眼比心', emoji: '😉', bgColor: '#FEE2E2', faceColor: '#EF4444' },

  // Row 2 (Middle 5)
  { index: 6, row: 2, col: 1, name: '疯狂点赞', emoji: '👍', bgColor: '#ECFDF5', faceColor: '#10B981' },
  { index: 7, row: 2, col: 2, name: '笑哭不得', emoji: '😂', bgColor: '#FFFBEB', faceColor: '#D97706' },
  { index: 8, row: 2, col: 3, name: '气鼓鼓腮', emoji: '😤', bgColor: '#FEE2E2', faceColor: '#DC2626' },
  { index: 9, row: 2, col: 4, name: '困倦打盹', emoji: '😴', bgColor: '#F1F5F9', faceColor: '#64748B' },
  { index: 10, row: 2, col: 5, name: '灵光一现', emoji: '💡', bgColor: '#FEF9C3', faceColor: '#EAB308' },

  // Row 3 (Bottom 5: most prone to being cropped at the bottom!)
  { index: 11, row: 3, col: 1, name: '收到敬礼', emoji: '🫡', bgColor: '#E0F2FE', faceColor: '#0284C7' },
  { index: 12, row: 3, col: 2, name: '挥旗加油', emoji: '🎉', bgColor: '#F3E8FF', faceColor: '#9333EA' },
  { index: 13, row: 3, col: 3, name: '惊呆张嘴', emoji: '😱', bgColor: '#FFEDD5', faceColor: '#EA580C' },
  { index: 14, row: 3, col: 4, name: '比耶开心', emoji: '✌️', bgColor: '#DCFCE7', faceColor: '#16A34A' },
  { index: 15, row: 3, col: 5, name: '安睡晚安', emoji: '🌙', bgColor: '#F8FAFC', faceColor: '#475569' },
];

/**
 * Procedurally draws a 5x3 15-grid image on HTML Canvas and returns a File object
 */
export async function generateDemo15GridFile(): Promise<File> {
  const cols = 5;
  const rows = 3;
  const cellWidth = 320;
  const cellHeight = 320;
  const canvasWidth = cols * cellWidth; // 1600
  const canvasHeight = rows * cellHeight; // 960 (ratio 5:3 = 1.6667)

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // 1. Clean background (solid white with gentle warm off-white tone)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Draw each cell
  DEMO_15_STICKERS.forEach((sticker) => {
    const c = sticker.col - 1;
    const r = sticker.row - 1;
    const cellX = c * cellWidth;
    const cellY = r * cellHeight;
    const centerX = cellX + cellWidth / 2;
    const centerY = cellY + cellHeight / 2 - 12;

    // Draw cell inner rounded card
    const cardPadding = 16;
    const cardX = cellX + cardPadding;
    const cardY = cellY + cardPadding;
    const cardW = cellWidth - cardPadding * 2;
    const cardH = cellHeight - cardPadding * 2;
    const radius = 24;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = sticker.bgColor;
    ctx.fill();

    // Subtle card border
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();

    // Draw cute character avatar circle
    const avatarRadius = 76;
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = sticker.faceColor;
    ctx.stroke();

    // Draw Emoji icon inside avatar
    ctx.font = '68px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sticker.emoji, centerX, centerY + 2);

    // Sticker sequence tag (e.g. #01, #02 ... #15)
    ctx.font = 'bold 16px "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = sticker.faceColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`#${sticker.index.toString().padStart(2, '0')}`, cardX + 16, cardY + 16);

    // Row indicator tag in top right
    ctx.font = '12px "SF Pro Text", sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    if (sticker.row === 1) {
      ctx.fillStyle = '#DC2626';
      ctx.fillText('顶部第1行(易截断)', cardX + cardW - 14, cardY + 16);
    } else if (sticker.row === 3) {
      ctx.fillStyle = '#DC2626';
      ctx.fillText('底部第3行(易截断)', cardX + cardW - 14, cardY + 16);
    } else {
      ctx.fillStyle = '#059669';
      ctx.fillText('中间第2行', cardX + cardW - 14, cardY + 16);
    }

    // Sticker Name Label at bottom of cell
    ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(sticker.name, centerX, cardY + cardH - 18);

    ctx.restore();
  });

  // 3. Grid dividing grid lines (clean dashed reference lines)
  ctx.save();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);

  // Vertical lines
  for (let c = 1; c < cols; c++) {
    const x = c * cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  // Horizontal lines
  for (let r = 1; r < rows; r++) {
    const y = r * cellHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
  ctx.restore();

  // Convert to Blob & File
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const file = new File([blob!], 'demo-15grid-5x3-stickers.png', { type: 'image/png' });
      resolve(file);
    }, 'image/png');
  });
}

/**
 * Samples the dominant edge color from an image element
 */
export function sampleImageEdgeColor(image: HTMLImageElement): { hex: string; isDark: boolean } {
  try {
    const sampleCanvas = document.createElement('canvas');
    const w = Math.min(image.naturalWidth || image.width, 200);
    const h = Math.min(image.naturalHeight || image.height, 200);
    sampleCanvas.width = w;
    sampleCanvas.height = h;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return { hex: '#FFFFFF', isDark: false };

    ctx.drawImage(image, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let count = 0;

    // Sample top edge and bottom edge
    for (let x = 0; x < w; x += 2) {
      // Top edge pixel
      const topIdx = (0 * w + x) * 4;
      totalR += imgData[topIdx];
      totalG += imgData[topIdx + 1];
      totalB += imgData[topIdx + 2];
      count++;

      // Bottom edge pixel
      const btmIdx = ((h - 1) * w + x) * 4;
      totalR += imgData[btmIdx];
      totalG += imgData[btmIdx + 1];
      totalB += imgData[btmIdx + 2];
      count++;
    }

    // Sample left edge and right edge
    for (let y = 1; y < h - 1; y += 2) {
      const leftIdx = (y * w + 0) * 4;
      totalR += imgData[leftIdx];
      totalG += imgData[leftIdx + 1];
      totalB += imgData[leftIdx + 2];
      count++;

      const rightIdx = (y * w + (w - 1)) * 4;
      totalR += imgData[rightIdx];
      totalG += imgData[rightIdx + 1];
      totalB += imgData[rightIdx + 2];
      count++;
    }

    if (count === 0) return { hex: '#FFFFFF', isDark: false };

    const r = Math.round(totalR / count);
    const g = Math.round(totalG / count);
    const b = Math.round(totalB / count);

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();

    // Perceived luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return { hex, isDark: luminance < 0.5 };
  } catch (e) {
    console.warn('Failed to sample edge color:', e);
    return { hex: '#FFFFFF', isDark: false };
  }
}
