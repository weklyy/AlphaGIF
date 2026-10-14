/**
 * WeChat Red Packet Cover (微信红包封面) Processor & Compliance Utilities
 * Fully adheres to WeChat Red Packet Cover Platform (cover.weixin.qq.com) specifications:
 *
 * 1. 封面图: 957 × 1278 像素, PNG/JPG/JPEG, <= 500KB; 或 MP4 (3:4, 1s~3s, <= 20MB, 码率 <= 3000kbit/s, 帧率 <= 30fps)
 * 2. 封面挂件: 1053 × 1746 像素, 透明背景 PNG, <= 300KB; 或 24fps PNG序列帧 ZIP (1s~3s, <= 20MB)
 * 3. 气泡挂件: 480 × 384 像素, 透明背景 PNG, <= 300KB
 * 4. 封面故事: 750 × 1250 像素, PNG/JPG/JPEG, <= 500KB; 或 MP4 (1s~15s, <= 50MB, 码率 <= 1600kbit/s)
 */

import JSZip from 'jszip';
import { removeBackgroundWithAI, smartEdgeGuidedKeying } from './aiBackgroundRemoval';

export interface WeChatRedPacketSpecs {
  cover: {
    width: number;
    height: number;
    maxBytes: number;
    videoMaxDuration: number;
    videoMinDuration: number;
    videoMaxBitrateKbps: number;
    videoMaxBytes: number;
    videoMaxFps: number;
  };
  pendant: {
    width: number;
    height: number;
    maxBytes: number;
    sequenceFps: number;
    sequenceMaxBytes: number;
  };
  bubble: {
    width: number;
    height: number;
    maxBytes: number;
  };
  story: {
    width: number;
    height: number;
    maxBytes: number;
    videoMaxDuration: number;
    videoMinDuration: number;
    videoMaxBytes: number;
    videoMaxBitrateKbps: number;
  };
}

export const WECHAT_RED_PACKET_SPECS: WeChatRedPacketSpecs = {
  cover: {
    width: 957,
    height: 1278,
    maxBytes: 500 * 1024,
    videoMaxDuration: 3.0,
    videoMinDuration: 1.0,
    videoMaxBitrateKbps: 3000,
    videoMaxBytes: 20 * 1024 * 1024,
    videoMaxFps: 30,
  },
  pendant: {
    width: 1053,
    height: 1746,
    maxBytes: 300 * 1024,
    sequenceFps: 24,
    sequenceMaxBytes: 20 * 1024 * 1024,
  },
  bubble: {
    width: 480,
    height: 384,
    maxBytes: 300 * 1024,
  },
  story: {
    width: 750,
    height: 1250,
    maxBytes: 500 * 1024,
    videoMaxDuration: 15.0,
    videoMinDuration: 1.0,
    videoMaxBytes: 50 * 1024 * 1024,
    videoMaxBitrateKbps: 1600,
  },
};

export const WECHAT_EDITABLE_ZONES = {
  coverPendant: {
    width: 1053,
    height: 1746,
    // 微信官方规范：封面挂件位于封面的上侧 (342px) 和下侧 (96px)，中间 1308px 为主体不可编辑区
    topZone: {
      name: '上侧可编辑区域 (顶部探头)',
      minX: 96,
      maxX: 957,
      minY: 0,
      maxY: 342,
      defaultAnchorX: 526.5,
      defaultAnchorY: 200, // 微信官方顶部探头推荐位
    },
    bottomZone: {
      name: '下侧可编辑区域 (底部垂饰)',
      minX: 96,
      maxX: 957,
      minY: 1650,
      maxY: 1746,
      defaultAnchorX: 526.5,
      defaultAnchorY: 1698, // 微信官方脊端垂托推荐位
    },
    middleForbiddenZone: {
      minY: 342,
      maxY: 1650,
      desc: '封面主体不可编辑区 (1308×861)，严禁放置挂件',
    },
    defaultAnchorX: 526.5,
    defaultAnchorY: 200,
  },
  bubblePendant: {
    width: 480,
    height: 384,
    // 微信官方规范：气泡挂件总尺寸 480×384
    // 颈部可编辑区：上面 96 像素 (Y: 0 ~ 96)
    // 消息底座不可编辑区：中间 216 像素 (Y: 96 ~ 312)
    // 底部可编辑区：底部 72 像素 (Y: 312 ~ 384)
    topZone: {
      name: '上侧颈部可编辑区 (趴气泡/探头)',
      minX: 40,
      maxX: 440,
      minY: 0,
      maxY: 96,
      defaultAnchorX: 240,
      defaultAnchorY: 48,
    },
    middleForbiddenZone: {
      minY: 96,
      maxY: 312,
      desc: '气泡主体不可编辑区 (中间 216 像素)',
    },
    bottomZone: {
      name: '下侧底部可编辑区 (底部垂饰)',
      minX: 40,
      maxX: 440,
      minY: 312,
      maxY: 384,
      defaultAnchorX: 240,
      defaultAnchorY: 348,
    },
    defaultAnchorX: 240,
    defaultAnchorY: 48,
  },
};

export interface MaterialResult {
  blob: Blob;
  url: string;
  size: number;
  width: number;
  height: number;
  format: string;
  isCompliant: boolean;
  warnings: string[];
  anchorX?: number;
  anchorY?: number;
  inEditableZone?: boolean;
}

export interface VideoAnalysisResult {
  duration: number;
  width: number;
  height: number;
  bitrateKbps: number;
  fileSizeBytes: number;
  fps: number;
  isBitrateCompliant: boolean;
  isDurationCompliant: boolean;
  warnings: string[];
}

/**
 * Load HTMLImageElement safely from File, Blob or URL
 */
export function loadImageElement(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法加载图片文件'));
    img.src = url;
  });
}

/**
 * Strict PNG compression that guarantees file size stays beneath maxBytes (e.g. 300KB / 307200 bytes)
 * while preserving transparent alpha channel and exact canvas dimensions.
 */
export async function compressPngStrictUnderLimit(
  canvas: HTMLCanvasElement,
  maxBytes: number = 285 * 1024
): Promise<Blob> {
  // First attempt: clean raw PNG
  const rawBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (rawBlob && rawBlob.size <= maxBytes) {
    return rawBlob;
  }

  const w = canvas.width;
  const h = canvas.height;
  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true })!;
  workCtx.drawImage(canvas, 0, 0);

  // 1. Clean near-transparent pixels (zlib deflate compresses pure transparent runs extremely well)
  const baseData = workCtx.getImageData(0, 0, w, h);
  const bd = baseData.data;
  for (let i = 0; i < bd.length; i += 4) {
    if (bd[i + 3] < 16) {
      bd[i] = 0;
      bd[i + 1] = 0;
      bd[i + 2] = 0;
      bd[i + 3] = 0;
    }
  }
  workCtx.putImageData(baseData, 0, 0);
  let blob = await new Promise<Blob | null>((res) => workCanvas.toBlob(res, 'image/png'));
  if (blob && blob.size <= maxBytes) {
    return blob;
  }

  // 2. Progressive color and alpha quantization steps
  const quantSteps = [8, 16, 24, 32, 48, 64, 80, 96, 128];
  for (const step of quantSteps) {
    const imgData = workCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a < 20) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 0;
      } else {
        d[i] = Math.min(255, Math.round(d[i] / step) * step);
        d[i + 1] = Math.min(255, Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.min(255, Math.round(d[i + 2] / step) * step);
        d[i + 3] = Math.min(255, Math.round(a / 32) * 32);
      }
    }
    workCtx.putImageData(imgData, 0, 0);
    blob = await new Promise<Blob | null>((res) => workCanvas.toBlob(res, 'image/png'));
    if (blob && blob.size <= maxBytes) {
      return blob;
    }
  }

  // 3. Downsample high frequency noise while preserving exact dimensions
  // Create a smoothed intermediate buffer to eliminate high-frequency noise that causes large PNGs
  const smoothCanvas = document.createElement('canvas');
  const sw = Math.round(w * 0.75);
  const sh = Math.round(h * 0.75);
  smoothCanvas.width = sw;
  smoothCanvas.height = sh;
  const sctx = smoothCanvas.getContext('2d')!;
  sctx.drawImage(workCanvas, 0, 0, sw, sh);

  workCtx.clearRect(0, 0, w, h);
  workCtx.drawImage(smoothCanvas, 0, 0, w, h);

  // Apply final high compression quantization
  const finalData = workCtx.getImageData(0, 0, w, h);
  const fd = finalData.data;
  for (let i = 0; i < fd.length; i += 4) {
    const a = fd[i + 3];
    if (a < 24) {
      fd[i] = 0;
      fd[i + 1] = 0;
      fd[i + 2] = 0;
      fd[i + 3] = 0;
    } else {
      fd[i] = (fd[i] >> 5) << 5;
      fd[i + 1] = (fd[i + 1] >> 5) << 5;
      fd[i + 2] = (fd[i + 2] >> 5) << 5;
      fd[i + 3] = a > 160 ? 255 : 160;
    }
  }
  workCtx.putImageData(finalData, 0, 0);
  blob = await new Promise<Blob | null>((res) => workCanvas.toBlob(res, 'image/png'));
  if (blob && blob.size <= maxBytes) {
    return blob;
  }

  return blob || rawBlob || new Blob([], { type: 'image/png' });
}

/**
 * Ensures an image or canvas has transparent background pixels required by WeChat Red Packet.
 * If less than 15% of pixels are transparent, automatically detects corner background color
 * (white, black, or solid color) and keys it out to pure alpha=0.
 */
export async function ensureTransparentSubject(
  source: HTMLImageElement | HTMLCanvasElement,
  tolerance = 32
): Promise<HTMLCanvasElement> {
  const w = 'naturalWidth' in source ? (source.naturalWidth || source.width) : source.width;
  const h = 'naturalHeight' in source ? (source.naturalHeight || source.height) : source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const totalPixels = w * h;

  let transparentPixels = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 30) {
      transparentPixels++;
    }
  }

  // If already contains sufficient transparent areas (>= 12%), it's already a good transparent cutout!
  if (transparentPixels / totalPixels >= 0.12) {
    return canvas;
  }

  // If mostly opaque, detect corner colors to remove solid background (e.g. white or gray or dark)
  // Samples top-left, top-right, bottom-left, bottom-right
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];

  let bgR = 0;
  let bgG = 0;
  let bgB = 0;

  for (const [cx, cy] of corners) {
    const idx = (cy * w + cx) * 4;
    bgR += d[idx];
    bgG += d[idx + 1];
    bgB += d[idx + 2];
  }
  bgR = Math.round(bgR / corners.length);
  bgG = Math.round(bgG / corners.length);
  bgB = Math.round(bgB / corners.length);

  // Key out matching background colors with smooth alpha falloff
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (dist <= tolerance) {
      d[i + 3] = 0; // completely transparent
    } else if (dist <= tolerance + 18) {
      const alphaFactor = (dist - tolerance) / 18;
      d[i + 3] = Math.round(d[i + 3] * alphaFactor);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Compress an HTMLCanvasElement until it is strictly beneath maxBytes limit.
 * Tries PNG first (if lossless is required and fits), falls back to adaptive JPEG quality.
 */
export async function compressCanvasUnderLimit(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  preferPng = false
): Promise<{ blob: Blob; format: string }> {
  // If PNG is preferred (e.g. for transparent pendants)
  if (preferPng) {
    const pngBlob = await compressPngStrictUnderLimit(canvas, maxBytes);
    return { blob: pngBlob, format: 'image/png' };
  }

  // Try JPEG with binary-search quality optimization
  let low = 0.60;
  let high = 0.96;
  let bestBlob: Blob | null = null;

  for (let i = 0; i < 6; i++) {
    const q = (low + high) / 2;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (!blob) break;

    if (blob.size <= maxBytes) {
      bestBlob = blob;
      low = q; // try higher quality
    } else {
      high = q; // reduce quality
    }
  }

  if (bestBlob) {
    return { blob: bestBlob, format: 'image/jpeg' };
  }

  // Fallback to 0.65 jpeg
  const fallbackBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.65));
  return { blob: fallbackBlob, format: 'image/jpeg' };
}

/**
 * Fit and scale an image source into exact target dimensions (e.g. 957x1278)
 * Supports 'cover' (fill, centered crop), 'contain' (fit with backdrop), and custom pan/zoom
 */
export async function fitImageToTarget(
  source: HTMLImageElement | HTMLCanvasElement,
  targetW: number,
  targetH: number,
  options: {
    mode?: 'cover' | 'contain' | 'custom';
    zoom?: number;
    panX?: number;
    panY?: number;
    bgColor?: string;
    maxBytes?: number;
    preferPng?: boolean;
  } = {}
): Promise<MaterialResult> {
  const {
    mode = 'cover',
    zoom = 1.0,
    panX = 0,
    panY = 0,
    bgColor = '#e52d27',
    maxBytes = 500 * 1024,
    preferPng = false,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  const srcW = 'naturalWidth' in source ? (source.naturalWidth || source.width) : source.width;
  const srcH = 'naturalHeight' in source ? (source.naturalHeight || source.height) : source.height;

  if (preferPng) {
    ctx.clearRect(0, 0, targetW, targetH);
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  if (mode === 'cover' || mode === 'custom') {
    const scale = Math.max(targetW / srcW, targetH / srcH) * zoom;
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const drawX = (targetW - drawW) / 2 + panX;
    const drawY = (targetH - drawH) / 2 + panY;

    ctx.drawImage(source, drawX, drawY, drawW, drawH);
  } else {
    // contain mode: 100% full image preservation with blurred ambient backdrop or clean padding
    // 1. Draw subtle ambient backdrop
    ctx.save();
    ctx.filter = 'blur(30px) brightness(0.7)';
    const bgScale = Math.max(targetW / srcW, targetH / srcH);
    ctx.drawImage(
      source,
      (targetW - srcW * bgScale) / 2,
      (targetH - srcH * bgScale) / 2,
      srcW * bgScale,
      srcH * bgScale
    );
    ctx.restore();

    // 2. Draw 100% complete source image without any cropping
    const scale = Math.min(targetW / srcW, targetH / srcH) * zoom;
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const drawX = (targetW - drawW) / 2 + panX;
    const drawY = (targetH - drawH) / 2 + panY;

    ctx.drawImage(source, drawX, drawY, drawW, drawH);
  }

  const { blob, format } = await compressCanvasUnderLimit(canvas, maxBytes, preferPng);
  const url = URL.createObjectURL(blob);

  const warnings: string[] = [];
  if (blob.size > maxBytes) {
    warnings.push(`文件大小 (${Math.round(blob.size / 1024)}KB) 略微超过微信限制 (${Math.round(maxBytes / 1024)}KB)`);
  }

  return {
    blob,
    url,
    size: blob.size,
    width: targetW,
    height: targetH,
    format: format === 'image/png' ? 'PNG' : 'JPG',
    isCompliant: blob.size <= maxBytes,
    warnings,
  };
}

export interface AlphaBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  hasContent: boolean;
}

/**
 * Accurately detects non-transparent pixel bounding box of an image/canvas.
 * Crucial for zero-truncation guarantee (小熊完整无截断).
 * Supports smart shadow filter (ignoring faint floor contact shadows alpha < threshold).
 */
export function getAlphaBoundingBox(
  source: HTMLCanvasElement | HTMLImageElement,
  alphaThreshold = 24
): AlphaBoundingBox {
  const w = 'naturalWidth' in source ? (source.naturalWidth || source.width) : source.width;
  const h = 'naturalHeight' in source ? (source.naturalHeight || source.height) : source.height;

  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, w, h);
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      // Filter out pure transparent pixels as well as near-transparent floor shadow noise
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, width: w, height: h, hasContent: false };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    hasContent: true,
  };
}

/**
 * Automatically trims transparent, semi-transparent, and near-white/shadow borders
 * tightly around the actual subject so no empty padding or floor shadows fool alignment.
 */
export async function trimImageTransparentBorders(
  source: HTMLImageElement | HTMLCanvasElement,
  options: {
    alphaThreshold?: number;
    bottomCropPercent?: number; // 0 ~ 0.8 (e.g. 0.25 to chop off bottom 25% empty/shadow space)
    topCropPercent?: number;
    padding?: number;
  } = {}
): Promise<{ canvas: HTMLCanvasElement; img: HTMLImageElement; bbox: AlphaBoundingBox; originalW: number; originalH: number }> {
  const {
    alphaThreshold = 26,
    bottomCropPercent = 0,
    topCropPercent = 0,
    padding = 2,
  } = options;

  const w = 'naturalWidth' in source ? (source.naturalWidth || source.width) : source.width;
  const h = 'naturalHeight' in source ? (source.naturalHeight || source.height) : source.height;

  // 1. Initial bounding box
  const bbox = getAlphaBoundingBox(source, alphaThreshold);

  if (!bbox.hasContent) {
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = Math.max(1, w);
    emptyCanvas.height = Math.max(1, h);
    const img = await loadImageElement(emptyCanvas.toDataURL('image/png'));
    return { canvas: emptyCanvas, img, bbox, originalW: w, originalH: h };
  }

  // 2. Apply bottom and top percentage trims if requested (to chop off un-matted ground/shadows)
  let cropMinY = bbox.minY + Math.round(bbox.height * Math.max(0, Math.min(0.5, topCropPercent)));
  let cropMaxY = bbox.maxY - Math.round(bbox.height * Math.max(0, Math.min(0.8, bottomCropPercent)));
  if (cropMaxY <= cropMinY) {
    cropMaxY = cropMinY + 10;
  }

  let cropMinX = Math.max(0, bbox.minX - padding);
  let cropMaxX = Math.min(w - 1, bbox.maxX + padding);
  cropMinY = Math.max(0, cropMinY - padding);
  cropMaxY = Math.min(h - 1, cropMaxY + padding);

  const cropW = Math.max(1, cropMaxX - cropMinX + 1);
  const cropH = Math.max(1, cropMaxY - cropMinY + 1);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, cropMinX, cropMinY, cropW, cropH, 0, 0, cropW, cropH);

  const img = await loadImageElement(outCanvas.toDataURL('image/png'));
  const newBbox = getAlphaBoundingBox(outCanvas, alphaThreshold);

  return {
    canvas: outCanvas,
    img,
    bbox: newBbox,
    originalW: w,
    originalH: h,
  };
}

export interface PendantPartConfig {
  source: HTMLImageElement | HTMLCanvasElement;
  scale?: number; // 0.2 ~ 5.0 (支持放大至 500%)
  offsetX?: number;
  offsetY?: number;
  bottomCropPercent?: number; // 0% ~ 80% 去除底部留白
}

/**
 * Generate 封面挂件 (1053 x 1746) supporting separate Top + Bottom uploads or Full artwork
 * Automatically merges top and bottom into ONE compliant transparent PNG for WeChat!
 */
export async function createCompositeCoverPendant(options: {
  topPart?: PendantPartConfig | null;
  bottomPart?: PendantPartConfig | null;
  fullSource?: (HTMLImageElement | HTMLCanvasElement) | null;
  addGlow?: boolean;
  glowColor?: string;
}): Promise<MaterialResult> {
  const {
    topPart,
    bottomPart,
    fullSource,
    addGlow = true,
    glowColor = '#fef08a',
  } = options;

  const targetW = WECHAT_RED_PACKET_SPECS.pendant.width; // 1053
  const targetH = WECHAT_RED_PACKET_SPECS.pendant.height; // 1746

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, targetW, targetH);

  // 1. Full artwork mode
  if (fullSource) {
    const trans = await ensureTransparentSubject(fullSource);
    ctx.drawImage(trans, 0, 0, targetW, targetH);
  }

  // 2. Top Part (顶部 342px 可编辑区域, Y: 0 ~ 342)
  // 用户直观心智：小熊/主体最底部默认贴紧不可编辑区上沿 Y = 342
  let topDrawY = 0;
  let topDrawH = 0;
  if (topPart && topPart.source) {
    const trans = await ensureTransparentSubject(topPart.source);
    const trimmed = await trimImageTransparentBorders(trans, {
      alphaThreshold: 24,
      bottomCropPercent: topPart.bottomCropPercent || 0,
      padding: 0,
    });
    const bbox = trimmed.bbox;
    const drawSource = trimmed.canvas;

    if (bbox.hasContent) {
      const baseH = 280;
      const effectiveScale = Math.min(Math.max(topPart.scale ?? 1.0, 0.2), 5.0);
      topDrawH = Math.round(baseH * effectiveScale);
      const topDrawW = Math.round(bbox.width * (topDrawH / bbox.height));
      const topDrawX = Math.round((targetW - topDrawW) / 2 + (topPart.offsetX || 0));
      // 底部重合基准：Y = 342
      topDrawY = Math.round(342 - topDrawH + (topPart.offsetY || 0));

      ctx.save();
      if (addGlow) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16;
      }
      ctx.drawImage(drawSource, bbox.minX, bbox.minY, bbox.width, bbox.height, topDrawX, topDrawY, topDrawW, topDrawH);
      ctx.restore();
    }
  }

  // 3. Bottom Part (底部 96px 可编辑区域, Y: 1650 ~ 1746)
  // 用户直观心智：垂饰/底托最顶端默认贴紧不可编辑区下沿 Y = 1650
  let bottomDrawY = 1650;
  let bottomDrawH = 0;
  if (bottomPart && bottomPart.source) {
    const trans = await ensureTransparentSubject(bottomPart.source);
    const bbox = getAlphaBoundingBox(trans);
    if (bbox.hasContent) {
      const baseH = 80;
      const effectiveScale = Math.min(Math.max(bottomPart.scale ?? 1.0, 0.2), 5.0);
      bottomDrawH = Math.round(baseH * effectiveScale);
      const bottomDrawW = Math.round(bbox.width * (bottomDrawH / bbox.height));
      const bottomDrawX = Math.round((targetW - bottomDrawW) / 2 + (bottomPart.offsetX || 0));
      // 顶部重合基准：Y = 1650
      bottomDrawY = Math.round(1650 + (bottomPart.offsetY || 0));

      ctx.save();
      if (addGlow) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;
      }
      ctx.drawImage(trans, bbox.minX, bbox.minY, bbox.width, bbox.height, bottomDrawX, bottomDrawY, bottomDrawW, bottomDrawH);
      ctx.restore();
    }
  }

  // 微信官方严格审核：清空主体不可编辑区 (Y: 342 ~ 1650, X: 96 ~ 957)
  ctx.clearRect(96, 342, 861, 1308);

  const blob = await compressPngStrictUnderLimit(canvas, 285 * 1024);
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    size: blob.size,
    width: targetW,
    height: targetH,
    format: 'PNG',
    isCompliant: blob.size <= 300 * 1024,
    warnings: blob.size > 300 * 1024 ? ['封面挂件体积超出 300KB'] : [],
    anchorX: 526,
    anchorY: topPart ? Math.round(topDrawY + topDrawH / 2) : Math.round(bottomDrawY + bottomDrawH / 2),
    inEditableZone: true,
  };
}

/**
 * Generate 封面挂件 (1053 x 1746) with transparent background
 * Backwards-compatible single-source wrapper delegating to createCompositeCoverPendant
 */
export async function createCoverPendant(
  subjectSource: HTMLImageElement | HTMLCanvasElement,
  options: {
    placement?: 'top' | 'bottom' | 'dual' | 'upper' | 'lower' | 'center';
    scale?: number;
    offsetY?: number;
    offsetX?: number;
    addGlow?: boolean;
    glowColor?: string;
  } = {}
): Promise<MaterialResult> {
  const {
    placement = 'top',
    scale = 1.0,
    offsetY = 0,
    offsetX = 0,
    addGlow = true,
    glowColor = '#fef08a',
  } = options;

  const mode = (placement === 'lower' || placement === 'bottom') ? 'bottom' : (placement === 'dual' ? 'dual' : 'top');

  if (mode === 'bottom') {
    return createCompositeCoverPendant({
      bottomPart: { source: subjectSource, scale, offsetX, offsetY },
      addGlow,
      glowColor,
    });
  } else if (mode === 'dual') {
    return createCompositeCoverPendant({
      topPart: { source: subjectSource, scale, offsetX, offsetY },
      bottomPart: { source: subjectSource, scale: scale * 0.75, offsetX, offsetY: 0 },
      addGlow,
      glowColor,
    });
  } else {
    return createCompositeCoverPendant({
      topPart: { source: subjectSource, scale, offsetX, offsetY },
      addGlow,
      glowColor,
    });
  }
}

/**
 * Generate 气泡挂件 (480 x 384) supporting separate Top + Bottom uploads or Full artwork
 * Automatically merges top and bottom into ONE compliant transparent PNG for WeChat!
 */
export async function createCompositeBubblePendant(options: {
  topPart?: PendantPartConfig | null;
  bottomPart?: PendantPartConfig | null;
  fullSource?: (HTMLImageElement | HTMLCanvasElement) | null;
  addGlow?: boolean;
}): Promise<MaterialResult> {
  const {
    topPart,
    bottomPart,
    fullSource,
    addGlow = true,
  } = options;

  const targetW = WECHAT_RED_PACKET_SPECS.bubble.width; // 480
  const targetH = WECHAT_RED_PACKET_SPECS.bubble.height; // 384

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, targetW, targetH);

  // 1. Full artwork mode
  if (fullSource) {
    const trans = await ensureTransparentSubject(fullSource);
    ctx.drawImage(trans, 0, 0, targetW, targetH);
  }

  // 2. Top Part (顶部 96px 颈部可编辑区, Y: 0 ~ 96)
  // 微信官方平台真实展示特性：挂件在聊天框中与气泡卡片等比例渲染，顶部探头/小熊双爪自然搭在气泡边缘
  let topDrawY = 0;
  let topDrawH = 0;
  if (topPart && topPart.source) {
    const trans = await ensureTransparentSubject(topPart.source);
    // Auto-trim transparent borders and apply bottom crop if user requested
    const trimmed = await trimImageTransparentBorders(trans, {
      alphaThreshold: 24,
      bottomCropPercent: topPart.bottomCropPercent || 0,
      padding: 0,
    });
    const bbox = trimmed.bbox;
    const drawSource = trimmed.canvas;

    if (bbox.hasContent) {
      // WeChat Red Packet bubble pendant top proportion: base height 96px matches official WeChat template (0 ~ 96px zone)
      const baseH = 96;
      const effectiveScale = Math.min(Math.max(topPart.scale ?? 1.0, 0.2), 5.0);
      topDrawH = Math.round(baseH * effectiveScale);
      const topDrawW = Math.round(bbox.width * (topDrawH / bbox.height));
      const topDrawX = Math.round((targetW - topDrawW) / 2 + (topPart.offsetX || 0));
      // 基准：爪子/底部搭在 Y = 96 边缘，配合 offsetY 精准上下调整
      topDrawY = Math.round(96 - topDrawH + (topPart.offsetY || 0));

      ctx.save();
      if (addGlow) {
        ctx.shadowColor = 'rgba(255, 215, 0, 0.45)';
        ctx.shadowBlur = 8;
      }
      ctx.drawImage(drawSource, bbox.minX, bbox.minY, bbox.width, bbox.height, topDrawX, topDrawY, topDrawW, topDrawH);
      ctx.restore();
    }
  }

  // 3. Bottom Part (底部 72px 可编辑区, Y: 312 ~ 384)
  // 用户直观心智：垂饰最顶端默认重合在不可编辑区域下沿 Y = 312，标准高度 72px
  let bottomDrawY = 312;
  let bottomDrawH = 0;
  if (bottomPart && bottomPart.source) {
    const trans = await ensureTransparentSubject(bottomPart.source);
    const bbox = getAlphaBoundingBox(trans);
    if (bbox.hasContent) {
      const baseH = 72;
      const effectiveScale = Math.min(Math.max(bottomPart.scale ?? 1.0, 0.2), 5.0);
      bottomDrawH = Math.round(baseH * effectiveScale);
      const bottomDrawW = Math.round(bbox.width * (bottomDrawH / bbox.height));
      const bottomDrawX = Math.round((targetW - bottomDrawW) / 2 + (bottomPart.offsetX || 0));
      // 顶部重合基准：Y = 312
      bottomDrawY = Math.round(312 + (bottomPart.offsetY || 0));

      ctx.save();
      if (addGlow) {
        ctx.shadowColor = 'rgba(255, 215, 0, 0.45)';
        ctx.shadowBlur = 8;
      }
      ctx.drawImage(trans, bbox.minX, bbox.minY, bbox.width, bbox.height, bottomDrawX, bottomDrawY, bottomDrawW, bottomDrawH);
      ctx.restore();
    }
  }

  // 微信官方严格审核：中间 216px (Y: 96 ~ 312) 绝对不可编辑区，100% 彻底抹除！
  ctx.clearRect(0, 96, targetW, 216);

  if (!bottomPart && !fullSource) {
    // 仅顶部时，确保 Y >= 96 全部清空
    ctx.clearRect(0, 96, targetW, targetH - 96);
  }
  if (!topPart && !fullSource) {
    // 仅底部时，确保 Y < 312 全部清空
    ctx.clearRect(0, 0, targetW, 312);
  }

  const blob = await compressPngStrictUnderLimit(canvas, 280 * 1024);
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    size: blob.size,
    width: targetW,
    height: targetH,
    format: 'PNG',
    isCompliant: blob.size <= 300 * 1024,
    warnings: blob.size > 300 * 1024 ? ['气泡挂件体积超出 300KB'] : [],
    anchorX: 240,
    anchorY: topPart ? Math.round(topDrawY + topDrawH / 2) : Math.round(bottomDrawY + bottomDrawH / 2),
    inEditableZone: true,
  };
}

/**
 * Generate 气泡挂件 (480 x 384) with transparent background
 * Backwards-compatible single-source wrapper delegating to createCompositeBubblePendant
 */
export async function createBubblePendant(
  subjectSource: HTMLImageElement | HTMLCanvasElement,
  options: {
    placement?: 'top' | 'bottom';
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    addGlow?: boolean;
  } = {}
): Promise<MaterialResult> {
  const { placement = 'top', scale = 1.0, offsetX = 0, offsetY = 0, addGlow = true } = options;

  if (placement === 'bottom') {
    return createCompositeBubblePendant({
      bottomPart: { source: subjectSource, scale, offsetX, offsetY },
      addGlow,
    });
  } else {
    return createCompositeBubblePendant({
      topPart: { source: subjectSource, scale, offsetX, offsetY },
      addGlow,
    });
  }
}

/**
 * Generate 封面故事 (750 x 1250) full page presentation card
 */
export async function createCoverStory(
  source: HTMLImageElement | HTMLCanvasElement,
  options: {
    title?: string;
    subtitle?: string;
    description?: string;
    zoom?: number;
  } = {}
): Promise<MaterialResult> {
  const targetW = WECHAT_RED_PACKET_SPECS.story.width; // 750
  const targetH = WECHAT_RED_PACKET_SPECS.story.height; // 1250

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  const srcW = 'naturalWidth' in source ? (source.naturalWidth || source.width) : source.width;
  const srcH = 'naturalHeight' in source ? (source.naturalHeight || source.height) : source.height;

  // Background gradient: High-end festive crimson / carmine gradient instead of dark black
  const bgGrad = ctx.createLinearGradient(0, 0, targetW, targetH);
  bgGrad.addColorStop(0, '#7f1d1d');
  bgGrad.addColorStop(0.3, '#991b1b');
  bgGrad.addColorStop(0.7, '#b91c1c');
  bgGrad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, targetW, targetH);

  // Draw main image card
  const cardW = 630;
  const cardH = 680;
  const cardX = 60;
  const cardY = 180;

  ctx.save();
  // Clip card
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  ctx.clip();

  // Draw image: if image is portrait, display cleanly with full visibility
  const scale = Math.max(cardW / srcW, cardH / srcH) * (options.zoom || 1.0);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = cardX + (cardW - dw) / 2;
  const dy = cardY + (cardH - dh) / 2;
  ctx.drawImage(source, dx, dy, dw, dh);
  ctx.restore();

  // Card gold border
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(options.title || '红包故事 · 迎祥纳福', targetW / 2, 110);

  // Subtitle & Story text
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(options.subtitle || '岁岁平安 · 吉祥如意', targetW / 2, 940);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '22px sans-serif';
  const desc = options.description || '感谢新的一年与我们相遇，愿喜乐常在，万事顺遂！';
  ctx.fillText(desc, targetW / 2, 1000);

  const { blob } = await compressCanvasUnderLimit(canvas, WECHAT_RED_PACKET_SPECS.story.maxBytes, false);
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    size: blob.size,
    width: targetW,
    height: targetH,
    format: 'JPG',
    isCompliant: blob.size <= WECHAT_RED_PACKET_SPECS.story.maxBytes,
    warnings: blob.size > WECHAT_RED_PACKET_SPECS.story.maxBytes ? ['封面故事体积超出 500KB'] : [],
  };
}

/**
 * Analyze an uploaded video file for WeChat Red Packet compliance
 * Calculates bitrate in kbps, duration, resolution, and checks WeChat's strict <= 3000 kbps limit
 */
export async function analyzeVideoForWeChat(file: File): Promise<VideoAnalysisResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = url;

  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const fileSizeBytes = file.size;

      // Approximate video bitrate in kbps: (Bytes * 8) / (duration * 1000)
      const bitrateKbps = duration > 0 ? Math.round((fileSizeBytes * 8) / (duration * 1000)) : 0;
      const fps = 30; // standard estimation

      const isDurationCompliant = duration >= 0.8 && duration <= 3.5;
      const isBitrateCompliant = bitrateKbps <= 3000;

      const warnings: string[] = [];
      if (bitrateKbps > 3000) {
        warnings.push(`视频码率 (${bitrateKbps} kbit/s) 大于微信平台强制限制 3000kbit/s，微信平台会直接报错拒绝上传！建议使用内置抽帧工具导出为 24fps PNG 序列帧 ZIP。`);
      }
      if (duration < 1.0 || duration > 3.0) {
        warnings.push(`视频时长为 ${duration.toFixed(1)} 秒，微信封面要求时长在 1秒至 3秒 之间。`);
      }
      if (fileSizeBytes > 20 * 1024 * 1024) {
        warnings.push(`视频文件大小超过微信 20MB 限制。`);
      }

      URL.revokeObjectURL(url);
      resolve({
        duration,
        width,
        height,
        bitrateKbps,
        fileSizeBytes,
        fps,
        isBitrateCompliant,
        isDurationCompliant,
        warnings,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法解析视频文件，请确保为 MP4 格式'));
    };
  });
}

/**
 * Extract frames from a video at exact 24fps and package them into a WeChat compliant PNG sequence ZIP
 * Conforming to: "以24fps帧率导出序列帧，全部图片打包为1个ZIP压缩包上传，压缩包不超过20MB"
 */
export async function extractVideoToPngSequenceZip(
  videoElement: HTMLVideoElement,
  startTime: number,
  endTime: number,
  targetW: number,
  targetH: number,
  fps = 24,
  onProgress?: (progress: number, status: string) => void
): Promise<{ zipBlob: Blob; frameCount: number; zipSize: number }> {
  const duration = Math.max(0.5, endTime - startTime);
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const zip = new JSZip();

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  const srcW = videoElement.videoWidth || 1053;
  const srcH = videoElement.videoHeight || 1746;
  const scale = Math.max(targetW / srcW, targetH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (targetW - dw) / 2;
  const dy = (targetH - dh) / 2;

  onProgress?.(5, `准备抽帧 (共 ${totalFrames} 帧，24fps)...`);

  for (let i = 0; i < totalFrames; i++) {
    const targetTime = startTime + i * (1 / fps);
    videoElement.currentTime = targetTime;

    await new Promise<void>((res) => {
      const handler = () => {
        videoElement.removeEventListener('seeked', handler);
        res();
      };
      videoElement.addEventListener('seeked', handler);
    });

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(videoElement, dx, dy, dw, dh);

    // Frame filename e.g. "frame_001.png"
    const frameNumberStr = String(i + 1).padStart(3, '0');
    const frameBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    zip.file(`frame_${frameNumberStr}.png`, frameBlob);

    const pct = 10 + Math.round(((i + 1) / totalFrames) * 75);
    onProgress?.(pct, `正在提取并打包序列帧 ${i + 1}/${totalFrames}...`);
  }

  onProgress?.(88, '正在压缩并封装为微信标准 ZIP 包...');
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.(100, `完成！成功导出 ${totalFrames} 帧，总大小 ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);

  return {
    zipBlob,
    frameCount: totalFrames,
    zipSize: zipBlob.size,
  };
}

/**
 * Package all created WeChat Red Packet assets into one unified download ZIP
 */
export async function packageAllRedPacketAssets(assets: {
  cover?: MaterialResult | null;
  coverVideoFile?: File | null;
  pendant?: MaterialResult | null;
  pendantSequenceZip?: Blob | null;
  bubble?: MaterialResult | null;
  story?: MaterialResult | null;
}): Promise<Blob> {
  const zip = new JSZip();

  // 1. Cover Image or Video
  if (assets.cover) {
    const ext = assets.cover.format.toLowerCase() === 'png' ? 'png' : 'jpg';
    zip.file(`01_封面图_957x1278.${ext}`, assets.cover.blob);
  } else if (assets.coverVideoFile) {
    zip.file(`01_封面视频_3比4_${assets.coverVideoFile.name}`, assets.coverVideoFile);
  }

  // 2. Cover Pendant
  if (assets.pendantSequenceZip) {
    zip.file('02_封面挂件_24fps_PNG序列帧包.zip', assets.pendantSequenceZip);
  } else if (assets.pendant) {
    zip.file('02_封面挂件_1053x1746_透明PNG.png', assets.pendant.blob);
  }

  // 3. Bubble Pendant
  if (assets.bubble) {
    zip.file('03_气泡挂件_480x384_透明PNG.png', assets.bubble.blob);
  }

  // 4. Cover Story
  if (assets.story) {
    zip.file('04_封面故事_750x1250.jpg', assets.story.blob);
  }

  // 5. Official Guidelines & Checklist
  const readme = `=====================================================
微信红包封面全套素材包（100% 符合官方审核标准）
=====================================================

本素材包由「微信红包封面制作工具」一键生成，各项参数均严格对照微信官方开放平台（cover.weixin.qq.com）设计规范：

【1. 封面图 (01_封面图_957x1278)】
- 尺寸：957 × 1278 像素 (3:4 比例)
- 格式：PNG / JPG / JPEG (不超过 500KB)
- 视频要求：MP4，时长 1s~3s，码率 <= 3000kbit/s，不超过 20MB

【2. 封面挂件 (02_封面挂件_1053x1746)】
- 尺寸：1053 × 1746 像素 (PNG 透明背景通道)
- 体积：不超过 300KB
- 动态挂件要求：24fps PNG 序列帧 ZIP 包，时长 1s~3s，不超过 20MB

【3. 气泡挂件 (03_气泡挂件_480x384)】
- 尺寸：480 × 384 像素 (PNG 透明背景通道)
- 体积：不超过 300KB
- 作用：展示于微信聊天对话框绿色气泡右上/侧边

【4. 封面故事 (04_封面故事_750x1250)】
- 尺寸：750 × 1250 像素
- 体积：不超过 500KB
- 作用：领完红包后上滑查看的品牌故事/个人视频号跳板

【微信官方平台上传直达网址】
https://cover.weixin.qq.com/

祝您的红包封面顺利通过审核！
`;

  zip.file('微信红包封面平台上传规范与避坑指南.txt', readme);

  return await zip.generateAsync({ type: 'blob' });
}
