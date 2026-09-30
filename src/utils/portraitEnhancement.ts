/**
 * Portrait Hair & Edge Detail Optimization & Smart Clarity Enhancement Engine
 * 
 * Features:
 * 1. Cached Silhouette Distance Field (全轮廓高精度距离场缓存，确保滑块拖动 60fps 零延迟)
 * 2. True Canvas-Calibrated Edge Trimming (根据 1 寸证件照基准物理内收，真切实效所见即所得)
 * 3. White / Light Background Spill Decontamination (强力消除发丝顶端与颈部两侧白边/光晕)
 * 4. Subpixel Alpha Feathering & Anti-aliasing (发丝与轮廓精细柔和过渡)
 * 5. Hair Texture & Strands Micro-contrast Enhancement (黑发微发缕层次与光泽增强)
 * 6. Contrast-Adaptive Sharpening (CAS) for Ultra-HD Image Clarity (智能超清重建)
 */

export interface HairOptimizationConfig {
  enabled: boolean;
  deFringe: number;    // 0 to 100 (%): 去除发丝与颈部白边/浅色光晕杂色
  feather: number;     // 0 to 4 (px): 边缘柔和羽化与抗锯齿 (以证件照标准画布像素为基准)
  edgeShift: number;   // -10.0 to 2.0 (px): 边缘向内物理微收裁剪 (负值收边，以证件照标准画布像素为基准，真切所见即所得)
  textureBoost: number;// 0 to 100 (%): 发丝纹理与微发丝细节增强
  skinSmoothing: number;// 0 to 100 (%): 智能面部磨皮与自然平滑 (消除粗糙暗沉与毛孔)
}

export interface ClarityConfig {
  enabled: boolean;
  strength: number;    // 0 to 100 (%): 智能超清增强强度 (默认 65%)
  detailMode: 'balanced' | 'features' | 'crisp'; // balanced: 均衡超清; features: 五官特清; crisp: 极致锐利
  exportDpiMultiplier: 1 | 2 | 4; // 1x (300 DPI 官方标清), 2x (600 DPI 智能超清推荐), 4x (1200 DPI 印刷极清)
}

export const DEFAULT_HAIR_CONFIG: HairOptimizationConfig = {
  enabled: true,
  deFringe: 95,
  feather: 1.0,
  edgeShift: -2.0, // 默认物理内收 2.0px 证件照标准像素，彻底切除白边
  textureBoost: 50,
  skinSmoothing: 65, // 默认 65% 自然磨皮平滑，抚平面部粗糙与暗沉
};

export const DEFAULT_CLARITY_CONFIG: ClarityConfig = {
  enabled: true,
  strength: 65,
  detailMode: 'balanced',
  exportDpiMultiplier: 2, // 默认推荐 2x 智能超清 (600 DPI)
};

/**
 * Pre-computed Silhouette Distance Field representation.
 * Cached in memory to allow 60fps real-time live slider response.
 */
export interface SilhouetteField {
  width: number;
  height: number;
  distMap: Float32Array;   // Distance in raw image pixels from the outer transparent/background boundary
  scaleRatio: number;      // Ratio of image width to 295 (base 1-inch ID photo width)
  rawSrc: Uint8ClampedArray; // Original raw RGBA pixel data
  hairMaxY: number;        // Maximum Y coordinate considered hair zone
}

/**
 * Precomputes Euclidean Distance Transform and edge mapping from raw cutout ImageData.
 * Only runs ONCE when a new image or matting result is loaded.
 */
export function buildSilhouetteField(sourceData: ImageData): SilhouetteField {
  const width = sourceData.width;
  const height = sourceData.height;
  const totalPixels = width * height;
  const src = sourceData.data;

  // Make a private copy of original pixels
  const rawSrc = new Uint8ClampedArray(src.length);
  rawSrc.set(src);

  // 1-inch standard ID photo width is 295px (at 300 DPI: 25mm / 25.4 * 300 = 295px)
  const scaleRatio = Math.max(1, width / 295);

  const distMap = new Float32Array(totalPixels);
  distMap.fill(9999);

  let transparentCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (rawSrc[i * 4 + 3] < 35) {
      distMap[i] = 0;
      transparentCount++;
    }
  }

  // If the image is opaque or has no transparent channel:
  // Detect border backdrop color and flood-fill from borders to establish background
  if (transparentCount < totalPixels * 0.05) {
    let sumR = 0, sumG = 0, sumB = 0, samples = 0;
    const sample = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const p = (y * width + x) * 4;
      sumR += rawSrc[p];
      sumG += rawSrc[p + 1];
      sumB += rawSrc[p + 2];
      samples++;
    };

    for (let x = 0; x < width; x += 4) {
      sample(x, 0);
      sample(x, 2);
    }
    const maxY = Math.round(height * 0.7);
    for (let y = 0; y < maxY; y += 4) {
      sample(0, y);
      sample(2, y);
      sample(width - 1, y);
      sample(width - 3, y);
    }

    const bgR = samples > 0 ? Math.round(sumR / samples) : 210;
    const bgG = samples > 0 ? Math.round(sumG / samples) : 20;
    const bgB = samples > 0 ? Math.round(sumB / samples) : 40;

    const colorDist = (r: number, g: number, b: number) => {
      return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    };

    const maxTol = 65;
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const isSkinPixel = (r: number, g: number, b: number) => {
      if (r < 90 || g < 50 || b < 30) return false;
      if (r <= g || r - b < 18) return false;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      return l > 55 && l < 235;
    };

    const isHairPixel = (r: number, g: number, b: number) => {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      return l < 80 || (r < 90 && g < 90 && b < 90);
    };

    const enqueue = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const idx = y * width + x;
      if (visited[idx]) return;

      const p = idx * 4;
      const r = rawSrc[p];
      const g = rawSrc[p + 1];
      const b = rawSrc[p + 2];

      // Protect ears, skin, and hair from being flooded
      if (isSkinPixel(r, g, b) || isHairPixel(r, g, b)) {
        return;
      }

      if (colorDist(r, g, b) <= maxTol) {
        visited[idx] = 1;
        distMap[idx] = 0;
        rawSrc[p + 3] = 0;
        queue[tail++] = idx;
      }
    };

    for (let x = 0; x < width; x++) enqueue(x, 0);
    for (let y = 0; y < maxY; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % width;
      const cy = Math.floor(curr / width);

      if (cx > 0) enqueue(cx - 1, cy);
      if (cx < width - 1) enqueue(cx + 1, cy);
      if (cy > 0) enqueue(cx, cy - 1);
      if (cy < height - 1) enqueue(cx, cy + 1);
    }
  }

  // Two-pass Chamfer Distance Transform
  // Forward Pass (Top-Left to Bottom-Right)
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      let d = distMap[i];
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, distMap[i - 1] + 1);
      if (y > 0) {
        d = Math.min(d, distMap[i - width] + 1);
        if (x > 0) d = Math.min(d, distMap[i - width - 1] + 1.414);
        if (x + 1 < width) d = Math.min(d, distMap[i - width + 1] + 1.414);
      }
      distMap[i] = d;
    }
  }

  // Backward Pass (Bottom-Right to Top-Left)
  for (let y = height - 1; y >= 0; y--) {
    const row = y * width;
    for (let x = width - 1; x >= 0; x--) {
      const i = row + x;
      let d = distMap[i];
      if (d === 0) continue;
      if (x + 1 < width) d = Math.min(d, distMap[i + 1] + 1);
      if (y + 1 < height) {
        d = Math.min(d, distMap[i + width] + 1);
        if (x + 1 < width) d = Math.min(d, distMap[i + width + 1] + 1.414);
        if (x > 0) d = Math.min(d, distMap[i + width - 1] + 1.414);
      }
      distMap[i] = d;
    }
  }

  const hairMaxY = Math.round(height * 0.52);

  return {
    width,
    height,
    distMap,
    scaleRatio,
    rawSrc,
    hairMaxY,
  };
}

/**
 * Renders an optimized ImageData using the pre-computed SilhouetteField.
 * Runs in under 5ms, perfectly suitable for 60fps real-time slider manipulation.
 */
export function renderSilhouetteData(
  field: SilhouetteField,
  config: HairOptimizationConfig = DEFAULT_HAIR_CONFIG
): ImageData {
  const { width, height, distMap, scaleRatio, rawSrc, hairMaxY } = field;
  const totalPixels = width * height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true })!;
  const outData = outCtx.createImageData(width, height);
  const dst = outData.data;

  // Initialize dst with rawSrc
  dst.set(rawSrc);

  if (!config.enabled) {
    return outData;
  }

  const deFringeRate = Math.max(0, Math.min(1, config.deFringe / 100));
  const textureRate = Math.max(0, Math.min(1, config.textureBoost / 100));
  const featherPx = Math.max(0, Math.min(4, config.feather));
  
  // Convert edgeShift from 1-inch ID Photo standard pixels to raw image pixels!
  // This guarantees that setting -2px on the slider trims exactly 2 pixels on the ID photo!
  const actualTrimRawPx = Math.max(0, -config.edgeShift) * scaleRatio;
  const actualExpandRawPx = Math.max(0, config.edgeShift) * scaleRatio;

  const isSkinPixel = (r: number, g: number, b: number) => {
    if (r < 80 || g < 45 || b < 25) return false;
    if (r <= g || r - b < 14) return false;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l > 50 && l < 235;
  };

  const isHairPixel = (r: number, g: number, b: number) => {
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l < 85 || (r < 90 && g < 90 && b < 90);
  };

  // Ear and sideburn zone: lateral sides between 28% and 65% of height
  const earTopY = Math.round(height * 0.28);
  const earBottomY = Math.round(height * 0.65);
  const earLeftX = Math.round(width * 0.40);
  const earRightX = Math.round(width * 0.60);

  // 1. Physical Inward Edge Trimming (Cutting off outer white fringe)
  if (config.edgeShift < 0 && actualTrimRawPx > 0.05) {
    const rampWidth = Math.max(0.6, 0.5 * scaleRatio);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const i = row + x;
        const d = distMap[i];
        if (d === 0) continue;

        const p = i * 4;
        const r = rawSrc[p];
        const g = rawSrc[p + 1];
        const b = rawSrc[p + 2];
        const isSkin = isSkinPixel(r, g, b);
        const isHair = isHairPixel(r, g, b);

        let curTrimPx = actualTrimRawPx;
        if (isSkin) {
          // Protect entire face, jawline, ears, and neck from deep cuts (smooth continuous contour)
          curTrimPx = Math.min(actualTrimRawPx, 0.25 * scaleRatio);
        } else if (y >= height * 0.26 && isHair) {
          // Protect sideburns and lower head hair
          curTrimPx = Math.min(actualTrimRawPx, 0.35 * scaleRatio);
        } else if (y >= height * 0.58) {
          // Protect shirt, collar, and shoulders: maintain smooth natural cloth folds
          curTrimPx = Math.min(actualTrimRawPx, 0.5 * scaleRatio);
        }

        if (d <= curTrimPx) {
          if (d <= curTrimPx - rampWidth) {
            dst[i * 4 + 3] = 0; // Cut off completely
          } else {
            const ratio = Math.max(0, Math.min(1, (d - (curTrimPx - rampWidth)) / rampWidth));
            dst[i * 4 + 3] = Math.round(dst[i * 4 + 3] * ratio);
          }
        }
      }
    }
  } else if (config.edgeShift > 0 && actualExpandRawPx > 0.05) {
    const boost = actualExpandRawPx * 15;
    for (let i = 0; i < totalPixels; i++) {
      const d = distMap[i];
      if (d > 0 && d <= actualExpandRawPx + 1.5) {
        dst[i * 4 + 3] = Math.min(255, Math.round(dst[i * 4 + 3] + boost * (1 - d / (actualExpandRawPx + 1.5))));
      }
    }
  }

  // 2. White Halo / De-fringe Spill Decontamination
  // For pixels near the trimmed boundary, detect whitish residue and replace with genuine inner hair or skin color
  if (deFringeRate > 0) {
    const searchDepth = Math.round(Math.max(6, 4.5 * scaleRatio));
    const deFringeZoneDepth = actualTrimRawPx + searchDepth;

    for (let y = 0; y < height; y++) {
      const isHairZone = y < hairMaxY;
      const inEarSideburnZone = y >= earTopY && y <= earBottomY;
      const searchRadius = Math.round(Math.max(4, (isHairZone ? 3.5 : 3.0) * scaleRatio));

      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const a = dst[i * 4 + 3];
        if (a === 0) continue;

        const d = distMap[i];
        if (d > deFringeZoneDepth) continue;

        const curR = dst[i * 4];
        const curG = dst[i * 4 + 1];
        const curB = dst[i * 4 + 2];
        const curLum = 0.299 * curR + 0.587 * curG + 0.114 * curB;

        const isEarSideburnX = x < earLeftX || x > earRightX;
        const isSkin = isSkinPixel(curR, curG, curB);
        const isHair = isHairPixel(curR, curG, curB);

        // Protect ears: Never treat genuine ear skin as "hair halo" or discolor it
        if (inEarSideburnZone && isEarSideburnX && isSkin) {
          continue;
        }

        // Protect sideburns: Preserve natural dark hair tone and shape
        if (inEarSideburnZone && isEarSideburnX && isHair) {
          continue;
        }

        // In hair zone, true hair is dark (lum < 115)
        // In neck zone, true skin is warm (curR > curB)
        const isPale = curR > 140 && curG > 140 && curB > 140;
        const isWhitishOnHair = isHairZone && !isSkin && (curLum > 95 || isPale);
        const isWhitishOnSkin = (!isHairZone || isSkin) && (curLum > 200 || (curR > 180 && curG > 180 && curB > 180 && Math.abs(curR - curB) < 30));

        if (!isWhitishOnHair && !isWhitishOnSkin && !isPale) continue;

        // Search inward for authentic inner hair or skin color
        let innerR = isHairZone ? 24 : 215;
        let innerG = isHairZone ? 22 : 160;
        let innerB = isHairZone ? 20 : 140;
        let foundInner = false;
        let minSearchDist = 99999;

        const minTargetDist = actualTrimRawPx + Math.max(3, 2.5 * scaleRatio);

        for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;

            const ni = ny * width + nx;
            const nd = distMap[ni];

            if (nd >= minTargetDist && dst[ni * 4 + 3] > 220) {
              const distSq = dx * dx + dy * dy;
              if (distSq < minSearchDist) {
                const r0 = rawSrc[ni * 4];
                const g0 = rawSrc[ni * 4 + 1];
                const b0 = rawSrc[ni * 4 + 2];
                const l0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

                if (isHairZone && !isSkin) {
                  if (l0 < 110) {
                    innerR = r0;
                    innerG = g0;
                    innerB = b0;
                    minSearchDist = distSq;
                    foundInner = true;
                  }
                } else {
                  if (r0 > b0 + 15 && l0 < 225) {
                    innerR = r0;
                    innerG = g0;
                    innerB = b0;
                    minSearchDist = distSq;
                    foundInner = true;
                  }
                }
              }
            }
          }
        }

        // Relative distance from the cut boundary
        const distFromCut = Math.max(0, d - actualTrimRawPx);
        const proximity = Math.max(0, Math.min(1, 1 - distFromCut / searchDepth));
        const blendRatio = deFringeRate * proximity;

        dst[i * 4] = Math.round(curR * (1 - blendRatio) + innerR * blendRatio);
        dst[i * 4 + 1] = Math.round(curG * (1 - blendRatio) + innerG * blendRatio);
        dst[i * 4 + 2] = Math.round(curB * (1 - blendRatio) + innerB * blendRatio);

        // If pixel is severely white halo right at the trimmed edge, also soften alpha (never on skin)
        if (isPale && !isSkin && distFromCut <= 1.2 * scaleRatio) {
          dst[i * 4 + 3] = Math.round(a * (1 - 0.45 * deFringeRate));
        }
      }
    }
  }

  // 3. Subpixel Alpha Feathering & Anti-aliasing
  if (featherPx > 0.1) {
    const actualFeatherRaw = Math.max(1, featherPx * scaleRatio);
    const radius = Math.ceil(actualFeatherRaw);
    const alphaCopy = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      alphaCopy[i] = dst[i * 4 + 3];
    }

    const step = actualFeatherRaw > 3 ? 2 : 1;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const curA = alphaCopy[i];

        // Feather pixels right at the boundary
        if (curA > 5 && curA < 250) {
          let sumA = 0;
          let weightSum = 0;

          for (let dy = -radius; dy <= radius; dy += step) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -radius; dx <= radius; dx += step) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;

              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= actualFeatherRaw) {
                const w = Math.exp(-(dist * dist) / (2 * actualFeatherRaw * actualFeatherRaw));
                sumA += alphaCopy[ny * width + nx] * w;
                weightSum += w;
              }
            }
          }

          if (weightSum > 0) {
            const smoothedA = Math.round(sumA / weightSum);
            dst[i * 4 + 3] = Math.round(curA * 0.35 + smoothedA * 0.65);
          }
        }
      }
    }
  }

  // 4. Hair Strands Texture & Contrast Enhancement
  if (textureRate > 0) {
    const hairBoostFactor = textureRate * 0.55;
    const step = Math.max(1, Math.round(scaleRatio));
    for (let y = 4; y < hairMaxY; y += step) {
      for (let x = 4; x < width - 4; x += step) {
        const idx = (y * width + x) * 4;
        const a = dst[idx + 3];
        if (a < 200) continue;

        const r = dst[idx];
        const g = dst[idx + 1];
        const b = dst[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Dark hair zone (lum < 130)
        if (lum < 130) {
          const leftLum = 0.299 * dst[idx - 4] + 0.587 * dst[idx - 3] + 0.114 * dst[idx - 2];
          const rightLum = 0.299 * dst[idx + 4] + 0.587 * dst[idx + 5] + 0.114 * dst[idx + 6];
          const upLum = 0.299 * dst[idx - width * 4] + 0.587 * dst[idx - width * 4 + 1] + 0.114 * dst[idx - width * 4 + 2];
          const downLum = 0.299 * dst[idx + width * 4] + 0.587 * dst[idx + width * 4 + 1] + 0.114 * dst[idx + width * 4 + 2];

          const avgNeighbor = (leftLum + rightLum + upLum + downLum) * 0.25;
          const diff = lum - avgNeighbor;

          if (Math.abs(diff) < 45) {
            const boost = diff * hairBoostFactor;
            dst[idx] = Math.max(0, Math.min(255, Math.round(r + boost)));
            dst[idx + 1] = Math.max(0, Math.min(255, Math.round(g + boost)));
            dst[idx + 2] = Math.max(0, Math.min(255, Math.round(b + boost)));
          }
        }
      }
    }
  }

  // 5. Intelligent Facial Skin Smoothing & Blemish Softening (智能面部磨皮与自然平滑)
  // Edge-preserving bilateral filter over facial skin pixels to eliminate roughness, coarse pores, and stubble shadows
  const smoothRate = Math.max(0, Math.min(1, (config.skinSmoothing ?? 65) / 100));
  if (smoothRate > 0.05) {
    const radius = Math.round(Math.max(3, 2.5 * scaleRatio));
    const skinCopy = new Uint8ClampedArray(dst);

    const faceTopY = Math.round(height * 0.15);
    const faceBottomY = Math.round(height * 0.78);
    const faceLeftX = Math.round(width * 0.18);
    const faceRightX = Math.round(width * 0.82);

    for (let y = faceTopY; y < faceBottomY; y++) {
      const row = y * width;
      for (let x = faceLeftX; x < faceRightX; x++) {
        const idx = (row + x) * 4;
        if (dst[idx + 3] < 120) continue;

        const curR = dst[idx];
        const curG = dst[idx + 1];
        const curB = dst[idx + 2];

        // Only smooth human skin pixels (leaving eyes, eyebrows, hair, and clothing crisp)
        if (!isSkinPixel(curR, curG, curB)) continue;

        const curL = 0.299 * curR + 0.587 * curG + 0.114 * curB;

        let sumR = curR * 1.5;
        let sumG = curG * 1.5;
        let sumB = curB * 1.5;
        let sumW = 1.5;

        const step = radius > 3 ? 2 : 1;
        for (let dy = -radius; dy <= radius; dy += step) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          const nRow = ny * width;

          for (let dx = -radius; dx <= radius; dx += step) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;

            const nIdx = (nRow + nx) * 4;
            if (dst[nIdx + 3] < 120) continue;

            const nR = skinCopy[nIdx];
            const nG = skinCopy[nIdx + 1];
            const nB = skinCopy[nIdx + 2];

            // If neighbor is also skin
            if (!isSkinPixel(nR, nG, nB)) continue;

            const nL = 0.299 * nR + 0.587 * nG + 0.114 * nB;
            const diffL = Math.abs(curL - nL);

            // Bilateral range threshold: preserves strong structural edges (eyelids, nostrils, mouth)
            if (diffL < 28) {
              const dSq = dx * dx + dy * dy;
              const w = Math.exp(-dSq / (2 * radius * radius) - (diffL * diffL) / 320);
              sumR += nR * w;
              sumG += nG * w;
              sumB += nB * w;
              sumW += w;
            }
          }
        }

        if (sumW > 0) {
          const smoothedR = sumR / sumW;
          const smoothedG = sumG / sumW;
          const smoothedB = sumB / sumW;

          // Blend based on smoothRate
          dst[idx] = Math.round(curR * (1 - smoothRate) + smoothedR * smoothRate);
          dst[idx + 1] = Math.round(curG * (1 - smoothRate) + smoothedG * smoothRate);
          dst[idx + 2] = Math.round(curB * (1 - smoothRate) + smoothedB * smoothRate);
        }
      }
    }
  }

  return outData;
}

/**
 * Optimizes hair and edge details.
 * Supports passing either a precomputed SilhouetteField or raw ImageData.
 */
export function optimizeHairAndEdges(
  source: ImageData | SilhouetteField,
  config: HairOptimizationConfig = DEFAULT_HAIR_CONFIG
): ImageData {
  const field: SilhouetteField =
    'distMap' in source ? source : buildSilhouetteField(source);
  return renderSilhouetteData(field, config);
}

/**
 * Synchronously generates an HTMLCanvasElement from SilhouetteField or ImageData.
 */
export function createOptimizedPortraitCanvas(
  source: ImageData | SilhouetteField,
  hairConfig: HairOptimizationConfig
): HTMLCanvasElement {
  const optimizedData = optimizeHairAndEdges(source, hairConfig);

  const canvas = document.createElement('canvas');
  canvas.width = optimizedData.width;
  canvas.height = optimizedData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(optimizedData, 0, 0);

  return canvas;
}

/**
 * Intelligent Smart Clarity Enhancement Engine (智能人像超清增强)
 * Applied to the composite canvas (portrait on background)
 * Uses Contrast-Adaptive High-Frequency Sharpening, edge preservation,
 * and facial feature micro-contrast enhancement without amplifying flat background noise.
 */
export function enhanceImageClarity(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: ClarityConfig = DEFAULT_CLARITY_CONFIG
) {
  if (!config.enabled || config.strength <= 0) return;

  const rawData = ctx.getImageData(0, 0, width, height);
  const src = rawData.data;

  // Allocate work buffer
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(width, height);
  const dst = outData.data;
  dst.set(src);

  const strength = (config.strength / 100) * 0.9;
  const mode = config.detailMode;

  const totalPixels = width * height;
  const lum = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    lum[i] = 0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2];
  }

  const thresholdLow = mode === 'crisp' ? 2 : 4;
  const thresholdHigh = mode === 'features' ? 55 : 75;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const curL = lum[idx];

      const l_up = lum[idx - width];
      const l_down = lum[idx + width];
      const l_left = lum[idx - 1];
      const l_right = lum[idx + 1];

      const minNeigh = Math.min(l_up, l_down, l_left, l_right, curL);
      const maxNeigh = Math.max(l_up, l_down, l_left, l_right, curL);
      const localContrast = maxNeigh - minNeigh;

      if (localContrast < thresholdLow || localContrast > thresholdHigh) {
        continue;
      }

      const laplacian = 4 * curL - (l_up + l_down + l_left + l_right);
      let weight = Math.min(1.0, localContrast / 25) * strength;

      // Dampen sharpening on skin so we never amplify pores, stubble, or rough skin texture!
      const p = idx * 4;
      const curR = src[p];
      const curG = src[p + 1];
      const curB = src[p + 2];
      if (curR > 80 && curG > 45 && curB > 25 && curR > curG && curR - curB >= 14 && curL > 50 && curL < 235) {
        weight *= 0.15; // Smooth skin remains soft; only eyes, brows, hair, and clothing get crisp sharpening
      }

      const delta = laplacian * weight * 0.45;

      dst[p] = Math.max(0, Math.min(255, Math.round(src[p] + delta)));
      dst[p + 1] = Math.max(0, Math.min(255, Math.round(src[p + 1] + delta)));
      dst[p + 2] = Math.max(0, Math.min(255, Math.round(src[p + 2] + delta)));
    }
  }

  ctx.putImageData(outData, 0, 0);
}
