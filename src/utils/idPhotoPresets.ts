/**
 * ID Photo (证件照) Standard Specifications, Dimensions & Color Profiles
 * Chinese National Standard & International Visa Standards @ 300 DPI
 */

import { IdPhotoPresetSpec, IdPhotoPresetKey } from '../types';

export const ID_PHOTO_PRESETS: IdPhotoPresetSpec[] = [
  {
    key: '1-inch',
    name: '标准 1 寸',
    category: 'common',
    widthMm: 25,
    heightMm: 35,
    widthPx: 295,
    heightPx: 413,
    dpi: 300,
    description: '最通用规格：用于各类资格证、学生证、准考证、体检表、工作证、普通简历',
    recommendedSizeKb: 100,
  },
  {
    key: '2-inch',
    name: '标准 2 寸',
    category: 'common',
    widthMm: 35,
    heightMm: 49,
    widthPx: 413,
    heightPx: 579,
    dpi: 300,
    description: '通用大照片：结婚登记、部分涉外公证、职业资格证书、学位证书、各类出国登记',
    recommendedSizeKb: 150,
  },
  {
    key: 'small-1-inch',
    name: '小 1 寸',
    category: 'common',
    widthMm: 22,
    heightMm: 32,
    widthPx: 260,
    heightPx: 378,
    dpi: 300,
    description: '驾照体检表、部分高校毕业证、个人档案照片专用',
    recommendedSizeKb: 80,
  },
  {
    key: 'large-1-inch',
    name: '大 1 寸',
    category: 'common',
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    dpi: 300,
    description: '计算机等级考试、中国部分省份教师资格证、部分出国签证申请',
    recommendedSizeKb: 120,
  },
  {
    key: 'small-2-inch',
    name: '小 2 寸 / 护照',
    category: 'visa',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    description: '中华人民共和国护照、港澳通行证、台湾通行证、欧洲申根/日本签证标准',
    recommendedSizeKb: 100,
  },
  {
    key: 'large-2-inch',
    name: '大 2 寸',
    category: 'visa',
    widthMm: 35,
    heightMm: 53,
    widthPx: 413,
    heightPx: 626,
    dpi: 300,
    description: '部分出入境证件、美洲签证、专业高级资格考试证',
    recommendedSizeKb: 150,
  },
  {
    key: 'gwy',
    name: '国家公务员考试',
    category: 'exam',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    description: '国考/省考报名系统专用，红/蓝/白底，严格限制文件大小通常在 20KB~50KB',
    recommendedSizeKb: 40,
  },
  {
    key: 'ky',
    name: '全国考研报名',
    category: 'exam',
    widthMm: 36,
    heightMm: 48,
    widthPx: 480,
    heightPx: 640,
    dpi: 300,
    description: '研招网官方标准（480×640 比例 3:4），通常要求浅蓝或白底，≤100KB',
    recommendedSizeKb: 90,
  },
  {
    key: 'cet',
    name: '英语四六级 (CET)',
    category: 'exam',
    widthMm: 20,
    heightMm: 27,
    widthPx: 240,
    heightPx: 320,
    dpi: 300,
    description: '全国大学英语四六级考试报名专用（240×320），浅蓝或白底，≤50KB',
    recommendedSizeKb: 45,
  },
  {
    key: 'teacher',
    name: '教师资格证',
    category: 'exam',
    widthMm: 25,
    heightMm: 35,
    widthPx: 295,
    heightPx: 413,
    dpi: 300,
    description: 'NTCE 中小学教师资格考试报名，要求纯白底，近6个月彩色免冠证件照',
    recommendedSizeKb: 100,
  },
  {
    key: 'driver',
    name: '机动车驾驶证',
    category: 'common',
    widthMm: 22,
    heightMm: 32,
    widthPx: 260,
    heightPx: 378,
    dpi: 300,
    description: '车管所机动车驾驶证、换领驾照专用，纯白底免冠照片',
    recommendedSizeKb: 80,
  },
  {
    key: 'custom',
    name: '自定义尺寸',
    category: 'custom',
    widthMm: 25,
    heightMm: 35,
    widthPx: 300,
    heightPx: 400,
    dpi: 300,
    description: '手动输入任意像素尺寸 (宽 × 高 px) 或毫米 (mm)',
    recommendedSizeKb: 100,
  },
];

export interface IdColorPreset {
  id: string;
  name: string;
  type: 'transparent' | 'color' | 'gradient';
  hex: string;
  secondaryHex?: string;
  description: string;
  style?: 'solid' | 'radial-spotlight' | 'linear-top-down';
}

export const POPULAR_ID_COLORS: IdColorPreset[] = [
  {
    id: 'transparent',
    name: '透明背景',
    type: 'transparent',
    hex: 'transparent',
    description: '无背景 PNG 透明图层，方便后续合成任意文档或自选底色',
  },
  {
    id: 'red-classic',
    name: '经典标准红',
    type: 'color',
    hex: '#C8102E',
    description: 'RGB(200, 16, 46) 党政机关、团员证、暂住证、结婚登记红',
  },
  {
    id: 'red-festive',
    name: '喜庆深红',
    type: 'color',
    hex: '#BF1E24',
    description: '婚姻登记处、荣誉证书、颁奖证书常用典雅深红',
  },
  {
    id: 'blue-classic',
    name: '经典标准蓝',
    type: 'color',
    hex: '#0066FF',
    description: 'RGB(0, 102, 255) 毕业证、工作证、简历、考试报名最常用蓝底',
  },
  {
    id: 'blue-deep',
    name: '科技深蓝',
    type: 'color',
    hex: '#1E40AF',
    description: '企业工牌、商务简历、高端职业形象照推荐',
  },
  {
    id: 'blue-light',
    name: '清爽淡蓝',
    type: 'color',
    hex: '#60A5FA',
    description: '考研/四六级系统常用淡天蓝背景',
  },
  {
    id: 'white',
    name: '纯白色',
    type: 'color',
    hex: '#FFFFFF',
    description: '身份证、护照、港澳台通行证、驾照、教师资格证官方规定纯白底',
  },
  {
    id: 'gradient-blue-spotlight',
    name: '影楼渐变蓝',
    type: 'gradient',
    hex: '#3B82F6',
    secondaryHex: '#1E3A8A',
    style: 'radial-spotlight',
    description: '专业照相馆雷达罩柔光效果，人像背后聚光更显立体',
  },
  {
    id: 'gradient-red-spotlight',
    name: '影楼渐变红',
    type: 'gradient',
    hex: '#EF4444',
    secondaryHex: '#991B1B',
    style: 'radial-spotlight',
    description: '摄影棚经典渐变红，温润饱满不单调',
  },
  {
    id: 'morandi-gray',
    name: '高级莫兰迪灰',
    type: 'color',
    hex: '#64748B',
    description: '现代商务职场、高端履历、领英头像推荐',
  },
  {
    id: 'morandi-sand',
    name: '暖米沙色',
    type: 'color',
    hex: '#E2DCD5',
    description: '文艺优雅、个人作品集、生活履历常用暖调',
  },
];

/**
 * Draw background on canvas (handles solid, transparent, and radial/linear gradients)
 */
export function drawIdBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgType: string,
  colorHex: string,
  gradientStyle: 'solid' | 'radial-spotlight' | 'linear-top-down' = 'solid',
  secondaryColor?: string
) {
  ctx.save();
  if (bgType === 'transparent') {
    ctx.clearRect(0, 0, width, height);
    ctx.restore();
    return;
  }

  if (gradientStyle === 'radial-spotlight' || secondaryColor) {
    const centerColor = colorHex;
    const outerColor = secondaryColor || adjustColorBrightness(colorHex, -40);
    // Radial gradient from upper chest/neck position outward
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      Math.min(width, height) * 0.08,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75
    );
    grad.addColorStop(0, centerColor);
    grad.addColorStop(1, outerColor);
    ctx.fillStyle = grad;
  } else if (gradientStyle === 'linear-top-down') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, adjustColorBrightness(colorHex, 20));
    grad.addColorStop(1, colorHex);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = colorHex;
  }

  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Adjust hex color brightness
 */
export function adjustColorBrightness(hex: string, percent: number): string {
  if (!hex || hex === 'transparent') return '#ffffff';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Intelligent file size optimizer (binary search quality + minor resolution adjustment)
 * to strictly satisfy exam system requirements like <= 20KB, <= 50KB, <= 100KB!
 */
export async function exportPhotoUnderSizeLimit(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg',
  targetMaxKb?: number
): Promise<{ blob: Blob; url: string; size: number; qualityUsed: number }> {
  // If PNG or unlimited, export directly
  if (format === 'png' || !targetMaxKb || targetMaxKb <= 0) {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), mime, 0.96));
    return {
      blob,
      url: URL.createObjectURL(blob),
      size: blob.size,
      qualityUsed: 0.96,
    };
  }

  const targetBytes = targetMaxKb * 1024;
  let minQuality = 0.15;
  let maxQuality = 0.98;
  let bestBlob: Blob | null = null;
  let bestQuality = 0.85;

  // Binary search for ideal JPEG compression quality
  for (let iteration = 0; iteration < 8; iteration++) {
    const q = (minQuality + maxQuality) / 2;
    const testBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', q)
    );

    if (testBlob.size <= targetBytes) {
      bestBlob = testBlob;
      bestQuality = q;
      // We can try higher quality
      minQuality = q;
    } else {
      // Too large, decrease quality
      maxQuality = q;
    }
  }

  // If even lowest quality is still over the limit, scale down canvas slightly
  if (!bestBlob || bestBlob.size > targetBytes) {
    let scale = 0.9;
    while (scale >= 0.5) {
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = Math.round(canvas.width * scale);
      scaledCanvas.height = Math.round(canvas.height * scale);
      const sCtx = scaledCanvas.getContext('2d')!;
      sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
      const scaledBlob = await new Promise<Blob>((resolve) =>
        scaledCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.75)
      );
      if (scaledBlob.size <= targetBytes || scale <= 0.55) {
        bestBlob = scaledBlob;
        bestQuality = 0.75;
        break;
      }
      scale -= 0.1;
    }
  }

  const finalBlob = bestBlob || (await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.5)));
  return {
    blob: finalBlob,
    url: URL.createObjectURL(finalBlob),
    size: finalBlob.size,
    qualityUsed: bestQuality,
  };
}

/**
 * Generate 6-Inch / 4R Photo Studio Printable Layout Sheet (102mm x 152mm @ 300DPI)
 * Standard 6-inch = 1205px x 1795px
 */
export interface PrintLayoutPreset {
  id: '8-1inch' | '4-2inch' | 'mixed-1-and-2';
  name: string;
  description: string;
}

export const PRINT_LAYOUT_PRESETS: PrintLayoutPreset[] = [
  {
    id: '8-1inch',
    name: '8 张 1 寸照排版 (4×2)',
    description: '经典冲印版，整洁排列8张标准1寸照，含虚线裁剪辅助标记',
  },
  {
    id: '4-2inch',
    name: '4 张 2 寸照排版 (2×2)',
    description: '排列4张标准2寸照，适合签证、学位证书备用冲印',
  },
  {
    id: 'mixed-1-and-2',
    name: '混拼版：4 张 1 寸 + 2 张 2 寸',
    description: '实用混拼：一张相纸同时拥有1寸与2寸，满足不同场景备用',
  },
];

export async function generate6InchPrintSheet(
  idPhotoCanvas: HTMLCanvasElement,
  layoutType: '8-1inch' | '4-2inch' | 'mixed-1-and-2',
  oneInchCanvas?: HTMLCanvasElement,
  twoInchCanvas?: HTMLCanvasElement
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  // 6寸相纸标准像素: 1205 x 1795 (300 DPI)
  const sheetW = 1795; // 宽版横向
  const sheetH = 1205;
  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d')!;

  // White photo paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, sheetW, sheetH);

  // Decorative border / Print watermark info at bottom
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(30, 30, sheetW - 60, sheetH - 60);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('6寸 (4R / 102×152mm) 照相馆标准排版冲印照 • 请沿灰色裁剪线剪开使用', sheetW / 2, sheetH - 40);

  const drawPhotoWithGuides = (imgCanvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) => {
    // Draw photo
    ctx.drawImage(imgCanvas, x, y, w, h);

    // Draw subtle border around photo
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Draw scissor cutting tick marks at corners
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;

    // Corner crosshairs / tick marks (extend 8px outwards)
    const tick = 10;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x - tick, y);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y - tick);
    ctx.lineTo(x, y);
    // Top-right
    ctx.moveTo(x + w + tick, y);
    ctx.lineTo(x + w, y);
    ctx.moveTo(x + w, y - tick);
    ctx.lineTo(x + w, y);
    // Bottom-left
    ctx.moveTo(x - tick, y + h);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x, y + h + tick);
    ctx.lineTo(x, y + h);
    // Bottom-right
    ctx.moveTo(x + w + tick, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y + h + tick);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    ctx.setLineDash([]); // reset dash
  };

  if (layoutType === '8-1inch') {
    // 8x 1-inch (295 x 413 px) in 4 columns x 2 rows
    const photoW = 295;
    const photoH = 413;
    const cols = 4;
    const rows = 2;
    const gapX = 60;
    const gapY = 60;
    const totalW = cols * photoW + (cols - 1) * gapX;
    const totalH = rows * photoH + (rows - 1) * gapY;
    const startX = Math.round((sheetW - totalW) / 2);
    const startY = Math.round((sheetH - totalH) / 2) - 15;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (photoW + gapX);
        const y = startY + r * (photoH + gapY);
        drawPhotoWithGuides(idPhotoCanvas, x, y, photoW, photoH);
      }
    }
  } else if (layoutType === '4-2inch') {
    // 4x 2-inch (413 x 579 px) in 2 columns x 2 rows
    const photoW = 413;
    const photoH = 579;
    const cols = 2;
    const rows = 2;
    const gapX = 120;
    const gapY = 60;
    const totalW = cols * photoW + (cols - 1) * gapX;
    const totalH = rows * photoH + (rows - 1) * gapY;
    const startX = Math.round((sheetW - totalW) / 2);
    const startY = Math.round((sheetH - totalH) / 2) - 15;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (photoW + gapX);
        const y = startY + r * (photoH + gapY);
        drawPhotoWithGuides(idPhotoCanvas, x, y, photoW, photoH);
      }
    }
  } else {
    // Mixed: 2x 2-inch on left + 4x 1-inch on right
    const oneW = 295;
    const oneH = 413;
    const twoW = 413;
    const twoH = 579;

    const sourceOne = oneInchCanvas || idPhotoCanvas;
    const sourceTwo = twoInchCanvas || idPhotoCanvas;

    // Left: 2x 2-inch placed vertically
    const leftX1 = 160;
    const leftX2 = 160 + twoW + 60;
    const top2 = Math.round((sheetH - twoH) / 2) - 15;
    drawPhotoWithGuides(sourceTwo, leftX1, top2, twoW, twoH);
    drawPhotoWithGuides(sourceTwo, leftX2, top2, twoW, twoH);

    // Right: 4x 1-inch in 2x2 grid
    const rightStartX = leftX2 + twoW + 100;
    const rightStartY = Math.round((sheetH - (2 * oneH + 40)) / 2) - 15;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = rightStartX + c * (oneW + 40);
        const y = rightStartY + r * (oneH + 40);
        drawPhotoWithGuides(sourceOne, x, y, oneW, oneH);
      }
    }
  }

  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.98));
  return {
    blob,
    url: URL.createObjectURL(blob),
    width: sheetW,
    height: sheetH,
  };
}
