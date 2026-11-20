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
    key: 'skill-exam',
    name: '职业技能/竞赛照',
    category: 'exam',
    widthMm: 16,
    heightMm: 22,
    widthPx: 190,
    heightPx: 260,
    dpi: 300,
    description: '职业技能等级考核认定/竞赛报名专用（190×260 px）：JPG 格式、纯白或浅蓝底、严格小于 20KB（建议 15K-20K）、18位身份证号命名（X大写）',
    recommendedSizeKb: 20,
    recommendedMinSizeKb: 15,
    recommendedFormat: 'jpg',
    recommendedBgIds: ['white', 'blue-light', 'blue-sky'],
    badgeText: '190×260 · 15-20K',
  },
  {
    key: 'custom',
    name: '自定义尺寸',
    category: 'custom',
    widthMm: 16,
    heightMm: 22,
    widthPx: 190,
    heightPx: 260,
    dpi: 300,
    description: '自由输入任意像素 (px) 或物理毫米 (mm) 与 DPI，支持自定义文件大小区间 (KB) 与身份证号命名',
    recommendedSizeKb: 20,
    badgeText: '自由定制',
  },
];

export interface QuickCustomSizeTemplate {
  id: string;
  label: string;
  widthPx: number;
  heightPx: number;
  minKb?: number;
  maxKb?: number;
  format?: 'jpg' | 'png';
  bgId?: string;
  note: string;
}

export const QUICK_CUSTOM_SIZE_TEMPLATES: QuickCustomSizeTemplate[] = [
  {
    id: 'skill-190x260',
    label: '职业技能/竞赛 190×260',
    widthPx: 190,
    heightPx: 260,
    minKb: 15,
    maxKb: 20,
    format: 'jpg',
    bgId: 'white',
    note: 'JPG · 15-20KB · 白/浅蓝底',
  },
  {
    id: 'social-358x441',
    label: '社保卡/二代证 358×441',
    widthPx: 358,
    heightPx: 441,
    minKb: 14,
    maxKb: 40,
    format: 'jpg',
    bgId: 'white',
    note: 'JPG · 14-40KB · 纯白底',
  },
  {
    id: 'cet-240x320',
    label: '四六级/学信 240×320',
    widthPx: 240,
    heightPx: 320,
    maxKb: 50,
    format: 'jpg',
    bgId: 'blue-light',
    note: 'JPG · ≤50KB · 浅蓝底',
  },
  {
    id: 'std-295x413',
    label: '标准1寸 295×413',
    widthPx: 295,
    heightPx: 413,
    maxKb: 100,
    format: 'jpg',
    note: '300DPI · 25×35mm',
  },
  {
    id: 'gwy-413x531',
    label: '公考/小2寸 413×531',
    widthPx: 413,
    heightPx: 531,
    maxKb: 50,
    format: 'jpg',
    note: 'JPG · ≤50KB',
  },
  {
    id: 'ky-480x640',
    label: '考研报名 480×640',
    widthPx: 480,
    heightPx: 640,
    maxKb: 100,
    format: 'jpg',
    bgId: 'blue-light',
    note: 'JPG · ≤100KB · 3:4',
  },
];

export function pxToMm(px: number, dpi: number = 300): number {
  if (!px || !dpi) return 0;
  return Number(((px / dpi) * 25.4).toFixed(1));
}

export function mmToPx(mm: number, dpi: number = 300): number {
  if (!mm || !dpi) return 0;
  return Math.max(10, Math.round((mm / 25.4) * dpi));
}

export interface IdCardValidationResult {
  normalized: string;
  isEmpty: boolean;
  isIdCardPattern: boolean;
  isValidChecksum: boolean;
  hasLowercaseXConverted: boolean;
  status: 'empty' | 'valid-id' | 'invalid-checksum' | 'custom-name';
  message: string;
}

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

export function sanitizeIdPhotoFileName(raw: string, autoUpperX: boolean = true): string {
  // Remove filesystem-illegal characters
  let cleaned = raw.replace(/[\\/:*?"<>|]/g, '').trim();
  if (autoUpperX && /^\d{0,17}[xX]?$/.test(cleaned)) {
    cleaned = cleaned.replace(/x/g, 'X');
  }
  return cleaned;
}

export function validateChineseIdNumber(raw: string): IdCardValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      normalized: '',
      isEmpty: true,
      isIdCardPattern: false,
      isValidChecksum: false,
      hasLowercaseXConverted: false,
      status: 'empty',
      message: '未填写自定义文件名，将使用默认规格名称导出',
    };
  }

  const hasLowercaseXConverted = /x/.test(trimmed) && /^\d{17}[xX]$/.test(trimmed);
  const normalized = sanitizeIdPhotoFileName(trimmed, true);

  if (/^\d{17}[\dX]$/.test(normalized)) {
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += Number(normalized[i]) * ID_WEIGHTS[i];
    }
    const expected = ID_CHECK_CODES[sum % 11];
    const isValidChecksum = normalized[17] === expected;
    if (isValidChecksum) {
      return {
        normalized,
        isEmpty: false,
        isIdCardPattern: true,
        isValidChecksum: true,
        hasLowercaseXConverted,
        status: 'valid-id',
        message: '18位身份证号格式与校验位均正确（X已自动大写）',
      };
    }
    return {
      normalized,
      isEmpty: false,
      isIdCardPattern: true,
      isValidChecksum: false,
      hasLowercaseXConverted,
      status: 'invalid-checksum',
      message: `已满足18位格式，但第18位校验码应为「${expected}」，请核对号码是否有误`,
    };
  }

  const digitOnly = /^\d+$/.test(normalized);
  return {
    normalized,
    isEmpty: false,
    isIdCardPattern: false,
    isValidChecksum: false,
    hasLowercaseXConverted: false,
    status: 'custom-name',
    message: digitOnly
      ? `当前已输入 ${normalized.length}/18 位数字（身份证号需完整 18 位）`
      : '将直接按此自定义文件名导出',
  };
}

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
    id: 'red-guobiao',
    name: '中国国标规范红 (官方标准)',
    type: 'color',
    hex: '#D9001B',
    description: 'RGB(217, 0, 27) 国家官方标准规范红，资格考、正式证件、国家级官方标准首选',
  },
  {
    id: 'red-spotlight',
    name: '影楼立体柔光红 (推荐)',
    type: 'gradient',
    hex: '#E21E2C',
    secondaryHex: '#9E0E18',
    style: 'radial-spotlight',
    description: '海马体/照相馆雷达罩立体柔光：中心温润饱满，自然烘托面部白皙气色，高级立体',
  },
  {
    id: 'red-classic',
    name: '结婚登记经典正红',
    type: 'color',
    hex: '#C8102E',
    description: 'Pantone 186 C / RGB(200, 16, 46) 结婚登记红本、党团入职经典庄重红',
  },
  {
    id: 'red-carmine',
    name: '典雅中国深绯红',
    type: 'color',
    hex: '#BA1422',
    description: 'RGB(186, 20, 34) 荣誉表彰、学术证书、典雅喜庆端庄红',
  },
  {
    id: 'red-rose',
    name: '温润暖玫瑰红',
    type: 'color',
    hex: '#D32738',
    description: '微暖调文艺红，适合社交履历、文艺肖像与形象照',
  },
  {
    id: 'red-wine',
    name: '高端商务酒红',
    type: 'color',
    hex: '#8B0D16',
    description: '深邃典雅酒红，高管履历、商务年鉴推荐',
  },
  {
    id: 'blue-classic',
    name: '经典标准蓝',
    type: 'color',
    hex: '#0066FF',
    description: 'RGB(0, 102, 255) 毕业证、工作证、简历、考试报名最常用蓝底',
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
    id: 'blue-deep',
    name: '科技深蓝',
    type: 'color',
    hex: '#1E40AF',
    description: '企业工牌、商务简历、高端职业形象照推荐',
  },
  {
    id: 'blue-light',
    name: '标准浅蓝',
    type: 'color',
    hex: '#60A5FA',
    description: '职业技能考核、考研、四六级系统常用标准浅蓝背景',
  },
  {
    id: 'blue-sky',
    name: '淡雅浅天蓝',
    type: 'color',
    hex: '#87CEFA',
    description: '清爽浅天蓝色背景（RGB 135, 206, 250），适合浅蓝底报名要求',
  },
  {
    id: 'white',
    name: '纯白色',
    type: 'color',
    hex: '#FFFFFF',
    description: '身份证、护照、职业技能考核、驾照、教师资格证官方规定纯白底',
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
  {
    id: 'transparent',
    name: '透明背景',
    type: 'transparent',
    hex: 'transparent',
    description: '无背景 PNG 透明图层，方便后续合成任意文档或自选底色',
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
    const outerColor = secondaryColor || adjustColorBrightness(colorHex, -28);
    // Smooth natural studio lighting falloff with wide soft highlight behind upper chest & neck
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.40,
      Math.min(width, height) * 0.16,
      width * 0.5,
      height * 0.42,
      Math.max(width, height) * 0.90
    );
    grad.addColorStop(0, centerColor);
    grad.addColorStop(0.45, adjustColorBrightness(centerColor, -8));
    grad.addColorStop(0.75, adjustColorBrightness(centerColor, -18));
    grad.addColorStop(1, outerColor);
    ctx.fillStyle = grad;
  } else if (gradientStyle === 'linear-top-down') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, adjustColorBrightness(colorHex, 14));
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

export interface ExportSizeOptions {
  targetMinKb?: number;
  strictKeepDimensions?: boolean;
  strictUnderMax?: boolean;
}

export interface ExportPhotoResult {
  blob: Blob;
  url: string;
  size: number;
  qualityUsed: number;
  width: number;
  height: number;
  paddedBytes?: number;
  withinLimit: boolean;
}

/**
 * Safely pad a valid JPEG Blob to an exact target byte size using standard ISO/IEC 10918-1
 * COM (Comment, 0xFF 0xFE) segments inserted right after APP0/APP1 so the JFIF header
 * and every single image pixel remain 100% untouched.
 */
async function padJpegToTargetBytes(blob: Blob, targetBytes: number): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  const src = new Uint8Array(buf);
  if (src.length >= targetBytes || src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) {
    return blob;
  }

  // Keep SOI (FF D8) and leading APP0 (JFIF) / APP1 (EXIF) header intact at byte 0
  let insertPos = 2;
  if (
    src.length > 6 &&
    src[2] === 0xff &&
    (src[3] === 0xe0 || src[3] === 0xe1)
  ) {
    const segLen = (src[4] << 8) | src[5];
    if (2 + 2 + segLen < src.length) {
      insertPos = 2 + 2 + segLen;
    }
  }

  let remaining = targetBytes - src.length;
  if (remaining < 4) return blob;

  const chunks: Uint8Array[] = [];
  while (remaining >= 4) {
    // Each COM segment adds (2 marker + segLen) bytes, where segLen <= 65535 and >= 2
    const chunkTotal = Math.min(remaining, 65535);
    // Avoid leaving a remainder of 1..3 bytes that cannot form a valid COM segment
    const adjustedTotal =
      remaining - chunkTotal > 0 && remaining - chunkTotal < 4
        ? remaining - 4
        : chunkTotal;
    const segLen = adjustedTotal - 2;
    const seg = new Uint8Array(adjustedTotal);
    seg[0] = 0xff;
    seg[1] = 0xfe;
    seg[2] = (segLen >> 8) & 0xff;
    seg[3] = segLen & 0xff;
    seg.fill(0x20, 4); // ASCII spaces
    chunks.push(seg);
    remaining -= adjustedTotal;
  }

  const totalPad = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(src.length + totalPad);
  out.set(src.subarray(0, insertPos), 0);
  let offset = insertPos;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  out.set(src.subarray(insertPos), offset);

  return new Blob([out], { type: 'image/jpeg' });
}

/**
 * Intelligent file size optimizer (12-iteration binary search quality + safe range targeting)
 * Strictly satisfies exam system requirements like < 20KB (15K-20K), <= 50KB, <= 100KB
 * while preserving exact pixel dimensions whenever requested!
 */
export async function exportPhotoUnderSizeLimit(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg',
  targetMaxKb?: number,
  options?: ExportSizeOptions
): Promise<ExportPhotoResult> {
  const targetMinKb = options?.targetMinKb && options.targetMinKb > 0 ? options.targetMinKb : 0;
  const strictKeepDimensions = options?.strictKeepDimensions ?? true;
  const strictUnderMax = options?.strictUnderMax ?? true;

  // If PNG or neither min nor max KB limit is set, export directly at high quality
  if (format === 'png' || (!targetMaxKb && !targetMinKb)) {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), mime, 0.96)
    );
    return {
      blob,
      url: URL.createObjectURL(blob),
      size: blob.size,
      qualityUsed: 0.96,
      width: canvas.width,
      height: canvas.height,
      withinLimit: true,
    };
  }

  // Compute dual-safe byte ceiling so strictly "< 20KB" passes BOTH 1000-byte KB & 1024-byte KiB checks
  const hasMax = Boolean(targetMaxKb && targetMaxKb > 0);
  const maxBytes = hasMax
    ? strictUnderMax
      ? Math.max(1024, Math.min(Math.floor(targetMaxKb! * 1024) - 256, Math.floor(targetMaxKb! * 1000) - 150))
      : Math.floor(targetMaxKb! * 1024)
    : Number.MAX_SAFE_INTEGER;

  // Compute safe lower bound (>= targetMinKb under both 1000 and 1024 definitions)
  const rawMinBytes = targetMinKb > 0 ? Math.ceil(targetMinKb * 1024) + 256 : 0;
  const minBytes = hasMax ? Math.min(rawMinBytes, Math.max(1024, maxBytes - 512)) : rawMinBytes;

  const toJpegBlob = (c: HTMLCanvasElement, q: number) =>
    new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', q));

  let bestBlob: Blob | null = null;
  let bestQuality = 0.95;
  let finalW = canvas.width;
  let finalH = canvas.height;

  // First check highest quality (0.99) — if already under maxBytes, we preserve maximum clarity
  const highBlob = await toJpegBlob(canvas, 0.99);
  if (highBlob.size <= maxBytes) {
    bestBlob = highBlob;
    bestQuality = 0.99;
    // If smaller than minBytes, see if q=1.0 naturally brings it closer or inside [minBytes, maxBytes]
    if (minBytes > 0 && highBlob.size < minBytes) {
      const maxQBlob = await toJpegBlob(canvas, 1.0);
      if (maxQBlob.size <= maxBytes) {
        bestBlob = maxQBlob;
        bestQuality = 1.0;
      } else {
        // Binary search between 0.92 and 1.0 to get maximum genuine quality under maxBytes
        let lo = 0.92;
        let hi = 1.0;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          const b = await toJpegBlob(canvas, mid);
          if (b.size <= maxBytes) {
            bestBlob = b;
            bestQuality = mid;
            lo = mid;
          } else {
            hi = mid;
          }
        }
      }
    }
  } else {
    // 12-iteration binary search for highest JPEG quality strictly under maxBytes
    let minQuality = 0.08;
    let maxQuality = 0.99;
    for (let iteration = 0; iteration < 12; iteration++) {
      const q = (minQuality + maxQuality) / 2;
      const testBlob = await toJpegBlob(canvas, q);
      if (testBlob.size <= maxBytes) {
        bestBlob = testBlob;
        bestQuality = q;
        minQuality = q;
      } else {
        maxQuality = q;
      }
    }
  }

  // If still over limit even at q=0.08
  if (!bestBlob || bestBlob.size > maxBytes) {
    if (strictKeepDimensions) {
      // Keep exact pixel dimensions, try ultra-low quality before giving up
      for (const q of [0.06, 0.04, 0.02]) {
        const b = await toJpegBlob(canvas, q);
        bestBlob = b;
        bestQuality = q;
        if (b.size <= maxBytes) break;
      }
    } else {
      let scale = 0.9;
      while (scale >= 0.45) {
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.max(40, Math.round(canvas.width * scale));
        scaledCanvas.height = Math.max(40, Math.round(canvas.height * scale));
        const sCtx = scaledCanvas.getContext('2d')!;
        sCtx.imageSmoothingEnabled = true;
        sCtx.imageSmoothingQuality = 'high';
        sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        const scaledBlob = await toJpegBlob(scaledCanvas, 0.72);
        if (scaledBlob.size <= maxBytes || scale <= 0.5) {
          bestBlob = scaledBlob;
          bestQuality = 0.72;
          finalW = scaledCanvas.width;
          finalH = scaledCanvas.height;
          break;
        }
        scale -= 0.1;
      }
    }
  }

  let finalBlob = bestBlob || (await toJpegBlob(canvas, 0.5));
  let paddedBytes = 0;

  // If user requested a minimum KB (e.g. 15K-20K) and the high-quality JPEG is still below minBytes,
  // pad cleanly inside [minBytes, maxBytes] using a standard JPEG COM segment (zero quality loss)
  if (minBytes > 0 && finalBlob.size < minBytes) {
    const desiredBytes = hasMax
      ? Math.min(maxBytes - 128, Math.max(minBytes + 512, Math.round((minBytes + maxBytes) * 0.55)))
      : minBytes + 512;
    if (desiredBytes > finalBlob.size + 4) {
      const originalLen = finalBlob.size;
      finalBlob = await padJpegToTargetBytes(finalBlob, desiredBytes);
      paddedBytes = Math.max(0, finalBlob.size - originalLen);
    }
  }

  const withinLimit =
    (!hasMax || finalBlob.size <= maxBytes) &&
    (minBytes <= 0 || finalBlob.size >= targetMinKb * 1000);

  return {
    blob: finalBlob,
    url: URL.createObjectURL(finalBlob),
    size: finalBlob.size,
    qualityUsed: bestQuality,
    width: finalW,
    height: finalH,
    paddedBytes,
    withinLimit,
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
    description: '标准 1 寸 (25×35mm / 295×413 px @ 300DPI)，冲印剪裁即为 8 张标准一寸照',
  },
  {
    id: '4-2inch',
    name: '4 张 2 寸照排版 (2×2)',
    description: '标准 2 寸 (35×49mm / 413×579 px @ 300DPI)，适合签证、学位考试等冲印备用',
  },
  {
    id: 'mixed-1-and-2',
    name: '混拼版：4 张 1 寸 + 2 张 2 寸',
    description: '实用混拼：4 张 1 寸 (25×35mm) + 2 张 2 寸 (35×49mm)，一张相纸备齐常用规格',
  },
];

export async function generate6InchPrintSheet(
  idPhotoCanvas: HTMLCanvasElement,
  layoutType: '8-1inch' | '4-2inch' | 'mixed-1-and-2',
  oneInchCanvas?: HTMLCanvasElement,
  twoInchCanvas?: HTMLCanvasElement,
  withCropMarks: boolean = true
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  // 6寸相纸标准像素: 1205 x 1795 (300 DPI, 对应国际 4R / 102×152mm)
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

  // Bottom info text (on white paper margin)
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  const subText =
    layoutType === '8-1inch'
      ? '6寸 (4R / 102×152mm) 照相馆标准排版冲印照 • 单张标准 1 寸 (25×35mm / 300DPI) • 纯净无屏幕构图线'
      : layoutType === '4-2inch'
      ? '6寸 (4R / 102×152mm) 照相馆标准排版冲印照 • 单张标准 2 寸 (35×49mm / 300DPI) • 纯净无屏幕构图线'
      : '6寸 (4R / 102×152mm) 照相馆标准排版冲印照 • 4 张 1 寸 (25×35mm) + 2 张 2 寸 (35×49mm) 混拼 • 纯净无屏幕构图线';
  ctx.fillText(subText, sheetW / 2, sheetH - 40);

  const drawPhotoItem = (imgCanvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) => {
    // 1. Draw photo (100% pristine photo, no guidelines across person)
    ctx.drawImage(imgCanvas, x, y, w, h);

    if (withCropMarks) {
      // 2. Draw subtle boundary border around photo to guide scissors
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      // 3. Draw scissor cutting tick marks at corners on white photo paper margin
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      const tick = 10;
      ctx.beginPath();
      // Top-left corner tick marks extending outwards onto white margin
      ctx.moveTo(x - tick, y);
      ctx.lineTo(x, y);
      ctx.moveTo(x, y - tick);
      ctx.lineTo(x, y);
      // Top-right corner tick marks
      ctx.moveTo(x + w + tick, y);
      ctx.lineTo(x + w, y);
      ctx.moveTo(x + w, y - tick);
      ctx.lineTo(x + w, y);
      // Bottom-left corner tick marks
      ctx.moveTo(x - tick, y + h);
      ctx.lineTo(x, y + h);
      ctx.moveTo(x, y + h + tick);
      ctx.lineTo(x, y + h);
      // Bottom-right corner tick marks
      ctx.moveTo(x + w + tick, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y + h + tick);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
    }
  };

  // Strictly use 1-inch and 2-inch sources to prevent wrong aspect ratio distortion
  const sourceOne = oneInchCanvas || idPhotoCanvas;
  const sourceTwo = twoInchCanvas || idPhotoCanvas;

  if (layoutType === '8-1inch') {
    // 8x 1-inch (295 x 413 px @ 300DPI, 物理尺寸严格对应 25mm x 35mm) in 4 columns x 2 rows
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
        drawPhotoItem(sourceOne, x, y, photoW, photoH);
      }
    }
  } else if (layoutType === '4-2inch') {
    // 4x 2-inch (413 x 579 px @ 300DPI, 物理尺寸严格对应 35mm x 49mm) in 2 columns x 2 rows
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
        drawPhotoItem(sourceTwo, x, y, photoW, photoH);
      }
    }
  } else {
    // Mixed: 2x 2-inch on left + 4x 1-inch on right
    const oneW = 295;
    const oneH = 413;
    const twoW = 413;
    const twoH = 579;

    // Left: 2x 2-inch placed vertically
    const leftX1 = 160;
    const leftX2 = 160 + twoW + 60;
    const top2 = Math.round((sheetH - twoH) / 2) - 15;
    drawPhotoItem(sourceTwo, leftX1, top2, twoW, twoH);
    drawPhotoItem(sourceTwo, leftX2, top2, twoW, twoH);

    // Right: 4x 1-inch in 2x2 grid
    const rightStartX = leftX2 + twoW + 100;
    const rightStartY = Math.round((sheetH - (2 * oneH + 40)) / 2) - 15;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = rightStartX + c * (oneW + 40);
        const y = rightStartY + r * (oneH + 40);
        drawPhotoItem(sourceOne, x, y, oneW, oneH);
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
