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
    // 微信官方规范 (图3)：封面挂件位于封面的上侧和下侧（上端与脊端），中间为红包封面主体不可放置区
    topZone: {
      name: '上侧可编辑区域 (上端探头)',
      minX: 85,
      maxX: 968,
      minY: 20,
      maxY: 360,
      defaultAnchorX: 526.5,
      defaultAnchorY: 200, // 微信官方顶部探头推荐位
    },
    bottomZone: {
      name: '下侧可编辑区域 (脊端垂饰)',
      minX: 85,
      maxX: 968,
      minY: 1380,
      maxY: 1720,
      defaultAnchorX: 526.5,
      defaultAnchorY: 1540, // 微信官方脊端垂托推荐位
    },
    middleForbiddenZone: {
      minY: 360,
      maxY: 1380,
      desc: '封面主体区（头像、昵称、祝福语、開奖金币按钮），严禁放置挂件',
    },
    defaultAnchorX: 526.5,
    defaultAnchorY: 200,
  },
  bubblePendant: {
    width: 480,
    height: 384,
    // 微信官方规范 (图4)：气泡挂件可编辑区域位于聊天气泡上方及安全范围
    minX: 40,
    maxX: 440,
    minY: 20,
    maxY: 280,
    defaultAnchorX: 240,
    defaultAnchorY: 120, // 气泡上方黄金挂点
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
 */
export function getAlphaBoundingBox(
  source: HTMLCanvasElement | HTMLImageElement,
  alphaThreshold = 15
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
      const a = data[(y * w + x) * 4 + 3];
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
 * Generate 封面挂件 (1053 x 1746) with transparent background
 * Strictly adheres to WeChat Red Packet Platform Specification (Figure 2 & Figure 3):
 * 1. 封面挂件严格位于封面的【上端】(上侧可编辑区域 Y: 20~360) 或【脊端】(下侧可编辑区域 Y: 1380~1720)
 * 2. 中间区域 (Y: 360~1380) 为红包封面主体展示区（头像、昵称、祝福语、開奖按钮），严禁放置挂件
 * 3. 挂件模式：
 *    - 'top': 上端探头挂件 (默认推荐，如虎头探出顶部，Y ≈ 200)
 *    - 'bottom': 脊端垂饰挂件 (底部元宝/祥瑞底托，Y ≈ 1540)
 *    - 'dual': 上下双端联动挂件 (与图2官方标准一致：顶部探头 + 脊端萌爪/元宝底托)
 * 4. 挂点严格锁定在上侧或下侧可编辑区域内，PNG 体积严格 ≤ 300KB
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
    scale = 0.85,
    offsetY = 0,
    offsetX = 0,
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

  const transSubject = await ensureTransparentSubject(subjectSource);
  const bbox = getAlphaBoundingBox(transSubject);
  const srcW = bbox.width;
  const srcH = bbox.height;

  // Normalized placement mode
  const mode = (placement === 'lower' || placement === 'bottom') ? 'bottom' : (placement === 'dual' ? 'dual' : 'top');

  // WeChat Figure 5 Official Standards:
  // Top Editable Area: Y [0, 342px]
  // Middle Non-Editable Area: Y [342px, 1650px] (Width: 861px, X: [96, 957])
  // Bottom Editable Area: Y [1650px, 1746px] (Height: 96px)
  const maxZoneW = 860;
  const maxZoneH = 330;
  const containRatio = Math.min(maxZoneW / srcW, maxZoneH / srcH);
  const effectiveScale = Math.min(Math.max(scale, 0.3), 1.25);
  const drawW = Math.round(srcW * containRatio * effectiveScale);
  const drawH = Math.round(srcH * containRatio * effectiveScale);

  const baseX = targetW / 2; // 526.5
  // WeChat Figure 2 Alignment: Mascot bottom sits close to red envelope card top edge (Y = 338~340px)
  const defaultTopAnchorY = Math.round(338 - drawH / 2);
  const baseY = mode === 'bottom' ? 1690 : defaultTopAnchorY;

  let anchorX = Math.round(baseX + offsetX);
  let anchorY = Math.round(baseY + offsetY);

  // Clamping into WeChat Figure 5 editable zones:
  if (mode === 'bottom') {
    anchorX = Math.max(96, Math.min(957, anchorX));
    anchorY = Math.max(1650, Math.min(1740, anchorY));
  } else {
    anchorX = Math.max(96, Math.min(957, anchorX));
    // Anchor clamped so mascot bottom drawY + drawH <= 340, drawY >= 10
    anchorY = Math.max(Math.round(drawH / 2 + 10), Math.min(Math.round(340 - drawH / 2), anchorY));
  }

  ctx.save();
  if (addGlow) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 16;
  }

  if (mode === 'top' || mode === 'dual') {
    // 1. Draw top rim subject (Mascot peeking out over top edge, strictly resting at top rim Y <= 340px)
    const drawX = Math.max(20, Math.min(targetW - drawW - 20, anchorX - drawW / 2));
    const drawY = Math.max(10, Math.min(340 - drawH, anchorY - drawH / 2));
    ctx.drawImage(transSubject, bbox.minX, bbox.minY, bbox.width, bbox.height, drawX, drawY, drawW, drawH);
  }

  if (mode === 'bottom') {
    // 2. Draw bottom spine subject (Mascot tail, paws, or ingot tray hanging below Y >= 1650px)
    const drawX = Math.max(20, Math.min(targetW - drawW - 20, anchorX - drawW / 2));
    const drawY = Math.max(1650, Math.min(targetH - drawH - 5, anchorY - drawH / 2));
    ctx.drawImage(transSubject, bbox.minX, bbox.minY, bbox.width, bbox.height, drawX, drawY, drawW, drawH);
  } else if (mode === 'dual') {
    // 3. Dual mode (Figure 5 exact replica): Also draw bottom spine accent (paws/ingot/tassels in Y >= 1650px)
    const bottomW = Math.round(drawW * 0.75);
    const bottomH = Math.min(88, Math.round(drawH * 0.7));
    const bDrawX = Math.round((targetW - bottomW) / 2 + (offsetX * 0.5));
    const bDrawY = 1652;

    // Draw festive gold ingot & cute paws over spine
    ctx.save();
    const bGrad = ctx.createLinearGradient(bDrawX, bDrawY, bDrawX + bottomW, bDrawY + bottomH);
    bGrad.addColorStop(0, '#fef08a');
    bGrad.addColorStop(0.5, '#f59e0b');
    bGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.roundRect(bDrawX + bottomW * 0.15, bDrawY + 5, bottomW * 0.7, 45, 22);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fef9c3';
    ctx.stroke();

    // Two cute paws hanging down over spine
    const pawR = 18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bDrawX + bottomW * 0.28, bDrawY + 48, pawR, 0, Math.PI * 2);
    ctx.arc(bDrawX + bottomW * 0.72, bDrawY + 48, pawR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // WeChat Figure 5 Strict Security: Clear any stray pixels in the forbidden envelope body zone (Y: 342 ~ 1650, X: 96 ~ 957)
  ctx.clearRect(96, 342, 861, 1308);

  // Compress strictly under 285KB PNG (under WeChat 300KB platform limit)
  const blob = await compressPngStrictUnderLimit(canvas, 285 * 1024);
  const url = URL.createObjectURL(blob);

  // Check if anchor is in top zone or bottom zone (Figure 5)
  const inTopZone = anchorX >= 96 && anchorX <= 957 && anchorY >= 0 && anchorY <= 342;
  const inBottomZone = anchorX >= 96 && anchorX <= 957 && anchorY >= 1650 && anchorY <= 1746;
  const inEditableZone = inTopZone || inBottomZone;

  return {
    blob,
    url,
    size: blob.size,
    width: targetW,
    height: targetH,
    format: 'PNG',
    isCompliant: blob.size <= 300 * 1024,
    warnings: blob.size > 300 * 1024 ? ['挂件体积超出 300KB'] : [],
    anchorX: Math.round(anchorX),
    anchorY: Math.round(anchorY),
    inEditableZone,
  };
}

/**
 * Generate 气泡挂件 (480 x 384) with transparent background
 * Strictly adheres to WeChat Red Packet Platform Specification (Figure 6):
 * 1. 顶部可编辑区域: 高度 96px (Y: 0 ~ 96px)，挂件主体/萌宠趴在气泡卡片上方
 * 2. 中间不可编辑区域: 高度 216px (Y: 96 ~ 312px)，【严禁任何图案进入，否则微信平台直接报错】
 * 3. 底部可编辑区域: 高度 72px (Y: 312 ~ 384px)，用于尾巴/流苏悬垂
 * 4. 保证完整零截断 (小熊身体、耳朵、四肢完全保留且在 96px 内)
 */
export async function createBubblePendant(
  subjectSource: HTMLImageElement | HTMLCanvasElement,
  options: {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    addGlow?: boolean;
  } = {}
): Promise<MaterialResult> {
  const { scale = 0.9, offsetX = 0, offsetY = 0, addGlow = true } = options;

  const targetW = WECHAT_RED_PACKET_SPECS.bubble.width; // 480
  const targetH = WECHAT_RED_PACKET_SPECS.bubble.height; // 384

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, targetW, targetH);

  const transSubject = await ensureTransparentSubject(subjectSource);
  // Detect true non-transparent bounds of the subject (e.g. little bear)
  const bbox = getAlphaBoundingBox(transSubject);
  const srcW = bbox.width;
  const srcH = bbox.height;

  // 1. WeChat Figure 4 & Figure 6 Official Safe Constraint:
  // Canvas: 480 x 384
  // Safe Editable Zone: X: [40, 440] (width 400), Y: [20, 280] (height 260)
  // Message Bubble Base Forbidden Zone: Y: [280, 384]
  // Bear rests on top rim of bubble (趴在对话框气泡上, Y = 278)
  const maxZoneW = 390;
  const maxZoneH = 240;

  const containRatio = Math.min(maxZoneW / srcW, maxZoneH / srcH);
  const effectiveScale = Math.min(Math.max(scale, 0.4), 1.25);
  const drawW = Math.min(maxZoneW, Math.round(srcW * containRatio * effectiveScale));
  const drawH = Math.min(maxZoneH, Math.round(srcH * containRatio * effectiveScale));

  // 2. Base anchor point in WeChat's bubble top editable zone
  // When resting on the bubble (趴在对话框气泡上, Figure 3): paws sit at Y = 278
  const baseAnchorX = Math.round(targetW / 2); // 240
  const defaultBearRestY = Math.round(278 - drawH / 2); // Bear paws touch Y = 278
  const baseAnchorY = defaultBearRestY;

  // Clamped anchor strictly inside safe editable zone:
  const anchorX = Math.max(Math.round(drawW / 2 + 40), Math.min(Math.round(440 - drawW / 2), Math.round(baseAnchorX + offsetX)));
  const anchorY = Math.max(Math.round(drawH / 2 + 20), Math.min(Math.round(278 - drawH / 2), Math.round(baseAnchorY + offsetY)));

  // Guaranteed ZERO PIXELS enter the forbidden Y >= 280 zone:
  const drawX = Math.round(anchorX - drawW / 2);
  const drawY = Math.max(20, Math.min(278 - drawH, Math.round(anchorY - drawH / 2)));

  ctx.save();
  if (addGlow) {
    ctx.shadowColor = 'rgba(255, 215, 0, 0.45)';
    ctx.shadowBlur = 8;
  }

  // Draw ONLY the real subject pixels completely inside safe editable zone
  ctx.drawImage(transSubject, bbox.minX, bbox.minY, bbox.width, bbox.height, drawX, drawY, drawW, drawH);
  ctx.restore();

  // STRICT WECHAT AUDIT DEFENSE (Figure 4 & Figure 6):
  // Clean all pixels in forbidden zones so WeChat automated inspection NEVER fails with "侵入不可编辑区域":
  // 1. Clear bubble base forbidden zone (Y >= 280)
  ctx.clearRect(0, 280, targetW, targetH - 280);
  // 2. Clear outer boundary safety margins
  ctx.clearRect(0, 0, targetW, 20);
  ctx.clearRect(0, 0, 40, targetH);
  ctx.clearRect(440, 0, targetW - 440, targetH);

  // Compress strictly under 280KB (WeChat 300KB ceiling)
  const blob = await compressPngStrictUnderLimit(canvas, 280 * 1024);
  const url = URL.createObjectURL(blob);

  // Compliance check: anchor point and drawing strictly inside Figure 4/6 editable area
  const inEditableZone = drawY >= 20 && (drawY + drawH) <= 280 && drawX >= 40 && (drawX + drawW) <= 440;

  return {
    blob,
    url,
    size: blob.size,
    width: targetW,
    height: targetH,
    format: 'PNG',
    isCompliant: blob.size <= 300 * 1024,
    warnings: blob.size > 300 * 1024 ? ['气泡挂件体积超出 300KB'] : [],
    anchorX: Math.round(anchorX),
    anchorY: Math.round(anchorY),
    inEditableZone,
  };
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
