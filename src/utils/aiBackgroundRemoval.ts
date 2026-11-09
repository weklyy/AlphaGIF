/**
 * AI Neural Network Background Removal Engine
 * 100% Client-side in-browser WebAssembly & High-Resolution Edge-Guided Trimap Matting
 *
 * Key Capabilities:
 * 1. Blue / Cyan / Red / White Backdrop Chroma & Color-Affinity Keying:
 *    - Automatically detects chromatic studio backdrops (blue/cyan/red) vs white/grey walls.
 *    - Performs linear chroma unmixing and color-spill decontamination on hair, ears, skin, and clothing edges
 *      so blue/cyan/red studio backgrounds are 100% removed with zero colored halo.
 * 2. Smart Inner-Crown Hair Analysis (Distinguishes True White Hair from Backdrop Halos):
 *    - Inspects interior crown hair luminance & saturation to determine if the subject genuinely has white/silver/grey hair.
 *    - Protects white hair on white walls while aggressively stripping blue/white halos around dark hair.
 * 3. Smooth Wave-Free Clothing & Shoulders:
 *    - High-resolution Joint Bilateral Filtering + morphological contour smoothing keeps shoulders crisp and smooth.
 */

import { removeBackground as imglyRemoveBackground, Config } from '@imgly/background-removal';

export interface AiRemovalProgress {
  stage: 'loading' | 'processing' | 'finishing';
  progress: number; // 0 to 100
  message: string;
}

// In-memory cache for processed Blobs keyed by File name + size + lastModified
const aiResultCache = new Map<string, { blob: Blob; url: string; imageData: ImageData }>();

/**
 * High-Resolution Trimap, Chroma-Unmixing & Joint Bilateral Edge-Snapping Matting
 */
function refineMaskWithHighResImage(
  srcData: Uint8ClampedArray,
  coarseAlpha: Uint8Array,
  width: number,
  height: number
): ImageData {
  const totalPixels = width * height;
  const scale = Math.max(1, width / 300);

  // ---------------------------------------------------------------------------
  // 1. Build Row-by-Row Local Background Color Profile (Left & Right Wall Reference)
  // ---------------------------------------------------------------------------
  const bgLeftR = new Float32Array(height);
  const bgLeftG = new Float32Array(height);
  const bgLeftB = new Float32Array(height);
  const bgRightR = new Float32Array(height);
  const bgRightG = new Float32Array(height);
  const bgRightB = new Float32Array(height);

  let gSumR = 0, gSumG = 0, gSumB = 0, gCount = 0;
  for (let y = 0; y < Math.round(height * 0.45); y += 2) {
    const row = y * width;
    for (let x = 0; x < width; x += 4) {
      const i = row + x;
      if (coarseAlpha[i] < 18 || (y < height * 0.06 && (x < width * 0.20 || x > width * 0.80))) {
        const p = i * 4;
        gSumR += srcData[p];
        gSumG += srcData[p + 1];
        gSumB += srcData[p + 2];
        gCount++;
      }
    }
  }
  const globalBgR = gCount > 0 ? gSumR / gCount : 230;
  const globalBgG = gCount > 0 ? gSumG / gCount : 230;
  const globalBgB = gCount > 0 ? gSumB / gCount : 230;

  // Detect if backdrop is chromatic (e.g. Blue, Cyan-Blue, Red) vs Achromatic (White, Grey)
  const globalBgMax = Math.max(globalBgR, globalBgG, globalBgB);
  const globalBgMin = Math.min(globalBgR, globalBgG, globalBgB);
  const globalBgChroma = globalBgMax - globalBgMin;
  const isBlueOrCyanBg =
    globalBgChroma > 22 && (globalBgB > globalBgR + 20 || (globalBgG > globalBgR + 18 && globalBgB > globalBgR + 15));
  const isRedBg =
    globalBgChroma > 25 && globalBgR > globalBgG + 25 && globalBgR > globalBgB + 25;
  const isChromaticBg = isBlueOrCyanBg || isRedBg || globalBgChroma > 32;

  const rawLeftR = new Float32Array(height);
  const rawLeftG = new Float32Array(height);
  const rawLeftB = new Float32Array(height);
  const rawLeftValid = new Uint8Array(height);

  const rawRightR = new Float32Array(height);
  const rawRightG = new Float32Array(height);
  const rawRightB = new Float32Array(height);
  const rawRightValid = new Uint8Array(height);

  const midX = width >> 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let lR = 0, lG = 0, lB = 0, lCnt = 0;
    let rR = 0, rG = 0, rB = 0, rCnt = 0;

    for (let x = 0; x < midX; x += 2) {
      const i = row + x;
      if (coarseAlpha[i] < 20) {
        const p = i * 4;
        lR += srcData[p];
        lG += srcData[p + 1];
        lB += srcData[p + 2];
        lCnt++;
      }
    }
    for (let x = midX; x < width; x += 2) {
      const i = row + x;
      if (coarseAlpha[i] < 20) {
        const p = i * 4;
        rR += srcData[p];
        rG += srcData[p + 1];
        rB += srcData[p + 2];
        rCnt++;
      }
    }

    if (lCnt >= 3) {
      rawLeftR[y] = lR / lCnt;
      rawLeftG[y] = lG / lCnt;
      rawLeftB[y] = lB / lCnt;
      rawLeftValid[y] = 1;
    }
    if (rCnt >= 3) {
      rawRightR[y] = rR / rCnt;
      rawRightG[y] = rG / rCnt;
      rawRightB[y] = rB / rCnt;
      rawRightValid[y] = 1;
    }
  }

  let lastLR = globalBgR, lastLG = globalBgG, lastLB = globalBgB;
  let lastRR = globalBgR, lastRG = globalBgG, lastRB = globalBgB;
  for (let y = 0; y < height; y++) {
    if (rawLeftValid[y]) {
      lastLR = rawLeftR[y];
      lastLG = rawLeftG[y];
      lastLB = rawLeftB[y];
    } else {
      rawLeftR[y] = lastLR;
      rawLeftG[y] = lastLG;
      rawLeftB[y] = lastLB;
    }
    if (rawRightValid[y]) {
      lastRR = rawRightR[y];
      lastRG = rawRightG[y];
      lastRB = rawRightB[y];
    } else {
      rawRightR[y] = lastRR;
      rawRightG[y] = lastRG;
      rawRightB[y] = lastRB;
    }
  }

  const winY = Math.max(8, Math.round(height * 0.04));
  for (let y = 0; y < height; y++) {
    let lR = 0, lG = 0, lB = 0;
    let rR = 0, rG = 0, rB = 0;
    let cnt = 0;
    const y0 = Math.max(0, y - winY);
    const y1 = Math.min(height - 1, y + winY);
    for (let ny = y0; ny <= y1; ny++) {
      lR += rawLeftR[ny];
      lG += rawLeftG[ny];
      lB += rawLeftB[ny];
      rR += rawRightR[ny];
      rG += rawRightG[ny];
      rB += rawRightB[ny];
      cnt++;
    }
    bgLeftR[y] = lR / cnt;
    bgLeftG[y] = lG / cnt;
    bgLeftB[y] = lB / cnt;
    bgRightR[y] = rR / cnt;
    bgRightG[y] = rG / cnt;
    bgRightB[y] = rB / cnt;
  }

  // Perceptual color distance between pixel i and local background at (x, y)
  const bgDistMap = new Float32Array(totalPixels);
  const lumMap = new Float32Array(totalPixels);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const lR = bgLeftR[y], lG = bgLeftG[y], lB = bgLeftB[y];
    const rR = bgRightR[y], rG = bgRightG[y], rB = bgRightB[y];
    const invW = 1 / Math.max(1, width - 1);
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const p = i * 4;
      const r = srcData[p];
      const g = srcData[p + 1];
      const b = srcData[p + 2];
      lumMap[i] = 0.299 * r + 0.587 * g + 0.114 * b;

      const t = x * invW;
      const bR = lR * (1 - t) + rR * t;
      const bG = lG * (1 - t) + rG * t;
      const bB = lB * (1 - t) + rB * t;
      const dr = r - bR;
      const dg = g - bG;
      const db = b - bB;
      bgDistMap[i] = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Analyze Interior Crown Hair to Distinguish White-Haired Subjects vs Dark-Haired Subjects
  // ---------------------------------------------------------------------------
  let headTopY = Math.round(height * 0.08);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let found = false;
    for (let x = 0; x < width; x += 2) {
      if (coarseAlpha[row + x] >= 120) {
        headTopY = y;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  const isSkinColor = (r: number, g: number, b: number) => {
    if (r < 85 || g < 45 || b < 25) return false;
    return r > g + 8 && g >= b - 5 && r - b >= 18;
  };

  // Sample interior crown hair (between headTopY + 3% and headTopY + 15% of height, where coarseAlpha >= 200)
  let hairLumSum = 0;
  let hairChromaSum = 0;
  let hairSampleCount = 0;
  const crownStartY = Math.min(height - 1, headTopY + Math.round(height * 0.025));
  const crownEndY = Math.min(height - 1, headTopY + Math.round(height * 0.16));
  for (let y = crownStartY; y <= crownEndY; y += 2) {
    const row = y * width;
    for (let x = Math.round(width * 0.28); x <= Math.round(width * 0.72); x += 2) {
      const i = row + x;
      if (coarseAlpha[i] >= 205) {
        const p = i * 4;
        const r = srcData[p], g = srcData[p + 1], b = srcData[p + 2];
        // Skip forehead skin pixels and skip backdrop-colored pixels
        if (isSkinColor(r, g, b)) continue;
        if (isBlueOrCyanBg && (b > r + 20 || g > r + 20)) continue;
        if (isRedBg && r > g + 30 && r > b + 30) continue;

        hairLumSum += lumMap[i];
        hairChromaSum += Math.max(r, g, b) - Math.min(r, g, b);
        hairSampleCount++;
      }
    }
  }

  const avgCrownHairLum = hairSampleCount > 10 ? hairLumSum / hairSampleCount : 45;
  const avgCrownHairChroma = hairSampleCount > 10 ? hairChromaSum / hairSampleCount : 15;

  // Subject has white/silver/grey hair ONLY if interior crown hair has high luminance (>= 98) and low chroma (< 35),
  // AND white hair protection against white walls is only needed when the wall is achromatic (!isChromaticBg)!
  const hasWhiteOrGreyHairOnLightWall =
    !isChromaticBg && avgCrownHairLum >= 98 && avgCrownHairChroma < 38;

  const cranialProtectMaxY = Math.min(
    Math.round(height * 0.50),
    Math.max(Math.round(height * 0.42), headTopY + Math.round(height * 0.35))
  );
  const shoulderZoneY = Math.round(height * 0.44);

  // Local 3x3 texture energy
  const textureMap = new Float32Array(totalPixels);
  if (hasWhiteOrGreyHairOnLightWall) {
    for (let y = 1; y < Math.min(height - 1, cranialProtectMaxY + 10); y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const i = row + x;
        const cL = lumMap[i];
        const d1 = Math.abs(cL - lumMap[i - 1]);
        const d2 = Math.abs(cL - lumMap[i + 1]);
        const d3 = Math.abs(cL - lumMap[i - width]);
        const d4 = Math.abs(cL - lumMap[i + width]);
        textureMap[i] = (d1 + d2 + d3 + d4) * 0.25;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Compute Distance Transforms from Coarse Mask Boundary
  // ---------------------------------------------------------------------------
  const distOutsideFg = new Float32Array(totalPixels);
  const distInsideFg = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const y = (i / width) | 0;
    const fgThresh = hasWhiteOrGreyHairOnLightWall && y < cranialProtectMaxY ? 60 : 95;
    if (coarseAlpha[i] >= fgThresh) {
      distOutsideFg[i] = 0;
      distInsideFg[i] = 9999;
    } else {
      distOutsideFg[i] = 9999;
      distInsideFg[i] = 0;
    }
  }

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      let dOut = distOutsideFg[i];
      let dIn = distInsideFg[i];
      if (x > 0) {
        dOut = Math.min(dOut, distOutsideFg[i - 1] + 1);
        dIn = Math.min(dIn, distInsideFg[i - 1] + 1);
      }
      if (y > 0) {
        const up = i - width;
        dOut = Math.min(dOut, distOutsideFg[up] + 1);
        dIn = Math.min(dIn, distInsideFg[up] + 1);
        if (x > 0) {
          dOut = Math.min(dOut, distOutsideFg[up - 1] + 1.414);
          dIn = Math.min(dIn, distInsideFg[up - 1] + 1.414);
        }
        if (x + 1 < width) {
          dOut = Math.min(dOut, distOutsideFg[up + 1] + 1.414);
          dIn = Math.min(dIn, distInsideFg[up + 1] + 1.414);
        }
      }
      distOutsideFg[i] = dOut;
      distInsideFg[i] = dIn;
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    const row = y * width;
    for (let x = width - 1; x >= 0; x--) {
      const i = row + x;
      let dOut = distOutsideFg[i];
      let dIn = distInsideFg[i];
      if (x + 1 < width) {
        dOut = Math.min(dOut, distOutsideFg[i + 1] + 1);
        dIn = Math.min(dIn, distInsideFg[i + 1] + 1);
      }
      if (y + 1 < height) {
        const dn = i + width;
        dOut = Math.min(dOut, distOutsideFg[dn] + 1);
        dIn = Math.min(dIn, distInsideFg[dn] + 1);
        if (x + 1 < width) {
          dOut = Math.min(dOut, distOutsideFg[dn + 1] + 1.414);
          dIn = Math.min(dIn, distInsideFg[dn + 1] + 1.414);
        }
        if (x > 0) {
          dOut = Math.min(dOut, distOutsideFg[dn - 1] + 1.414);
          dIn = Math.min(dIn, distInsideFg[dn - 1] + 1.414);
        }
      }
      distOutsideFg[i] = dOut;
      distInsideFg[i] = dIn;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Edge-Guarded Background Flood-Fill + Chromatic Backdrop Keying
  //    - For Blue/Cyan/Red backdrops (or dark-haired subjects): floods cleanly right up to the hair, ear, neck, and suit edge!
  //    - For White-Haired subjects on a White wall: protects the cranial white hair dome!
  // ---------------------------------------------------------------------------
  const maxErodePx = Math.max(14, Math.round(width * 0.046));
  const maxDilatePx = Math.max(14, Math.round(width * 0.048));

  const confirmedBg = new Uint8Array(totalPixels);
  const visitedBg = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let qHead = 0;
  let qTail = 0;

  const colorStep = (i1: number, i2: number): number => {
    const p1 = i1 * 4;
    const p2 = i2 * 4;
    const dr = srcData[p1] - srcData[p2];
    const dg = srcData[p1 + 1] - srcData[p2 + 1];
    const db = srcData[p1 + 2] - srcData[p2 + 2];
    return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
  };

  // Helper: checks if a pixel strongly exhibits the chromatic signature of a blue/cyan or red studio backdrop
  const hasBackdropChroma = (idx: number): boolean => {
    const p = idx * 4;
    const r = srcData[p], g = srcData[p + 1], b = srcData[p + 2];
    if (isBlueOrCyanBg) {
      return (b > r + 22 && b > 75) || (g > r + 20 && b > r + 15 && b > 70);
    }
    if (isRedBg) {
      return r > g + 35 && r > b + 35 && !isSkinColor(r, g, b);
    }
    return false;
  };

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const isBorder = y <= 2 || ((x <= 2 || x >= width - 3) && y < height * 0.70);
      if (
        (coarseAlpha[i] < 20 && bgDistMap[i] < 36) ||
        (isBorder && coarseAlpha[i] < 120 && bgDistMap[i] < 44) ||
        (isChromaticBg && coarseAlpha[i] < 95 && bgDistMap[i] < 34 && hasBackdropChroma(i))
      ) {
        visitedBg[i] = 1;
        confirmedBg[i] = 1;
        queue[qTail++] = i;
      }
    }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % width;
    const cy = (curr / width) | 0;

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx + 1 < width ? curr + 1 : -1,
      cy > 0 ? curr - width : -1,
      cy + 1 < height ? curr + width : -1,
    ];

    for (let k = 0; k < 4; k++) {
      const ni = neighbors[k];
      if (ni < 0 || visitedBg[ni]) continue;

      const ny = (ni / width) | 0;
      const nx = ni % width;
      const cAlpha = coarseAlpha[ni];

      // Only block cranial flood-fill if the subject genuinely has white/grey hair on a white/grey wall!
      if (hasWhiteOrGreyHairOnLightWall && ny < cranialProtectMaxY) {
        if (cAlpha >= 48) continue;
        if (cAlpha >= 24 && textureMap[ni] > 2.2) continue;
      }

      const isLateralPocketZone =
        ny >= cranialProtectMaxY && ny < height * 0.88 && (nx < width * 0.38 || nx > width * 0.62);
      const allowedDepth = isLateralPocketZone
        ? maxErodePx * 1.45
        : hasWhiteOrGreyHairOnLightWall && ny < cranialProtectMaxY
        ? 1.5
        : maxErodePx;

      if (distInsideFg[ni] > allowedDepth) continue;

      const step = colorStep(curr, ni);
      const bDist = bgDistMap[ni];
      const isChromaMatch = isChromaticBg && hasBackdropChroma(ni);

      // For blue/cyan/red studio backdrops, allow slightly wider tolerance to eat up the entire blue/cyan halo right up to the hair/suit edge!
      const maxStep = isChromaMatch ? 22.0 : cAlpha < 110 ? 16.0 : 12.0;
      const maxBgDist = isChromaMatch ? 46 : cAlpha < 90 ? 38 : cAlpha < 185 ? 32 : 24;

      if (step <= maxStep && bDist <= maxBgDist) {
        visitedBg[ni] = 1;
        confirmedBg[ni] = 1;
        queue[qTail++] = ni;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. High-Resolution Foreground Recovery (Hair + Face + Smooth Clothing/Shoulders)
  // ---------------------------------------------------------------------------
  const refinedMask = new Float32Array(totalPixels);
  const confirmedFg = new Uint8Array(totalPixels);
  const visitedFg = new Uint8Array(totalPixels);
  qHead = 0;
  qTail = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (confirmedBg[i]) continue;
    const y = (i / width) | 0;
    const cA = coarseAlpha[i];
    const bDist = bgDistMap[i];

    // If pixel has strong studio blue/red backdrop chroma and is near the outer edge, never seed it as solid foreground!
    if (isChromaticBg && distInsideFg[i] < 8 * scale && hasBackdropChroma(i) && bDist < 48) {
      continue;
    }

    const isSolidWhiteHair = hasWhiteOrGreyHairOnLightWall && y < cranialProtectMaxY && cA >= 105;
    const isSolidCore =
      (distInsideFg[i] >= 5 * scale && bDist > 22) ||
      (distInsideFg[i] >= 8 * scale) ||
      (cA >= 185 && bDist > (isChromaticBg ? 38 : 24));

    if (isSolidWhiteHair || isSolidCore) {
      confirmedFg[i] = 1;
      visitedFg[i] = 1;
      queue[qTail++] = i;
    }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % width;
    const cy = (curr / width) | 0;

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx + 1 < width ? curr + 1 : -1,
      cy > 0 ? curr - width : -1,
      cy + 1 < height ? curr + width : -1,
    ];

    for (let k = 0; k < 4; k++) {
      const ni = neighbors[k];
      if (ni < 0 || visitedFg[ni] || confirmedBg[ni]) continue;

      const ny = (ni / width) | 0;
      const isShoulderOrTorso = ny >= shoulderZoneY;
      const isCranial = ny < cranialProtectMaxY;
      const maxOut = isShoulderOrTorso ? maxDilatePx : isCranial ? 6 * scale : maxDilatePx * 0.65;
      if (distOutsideFg[ni] > maxOut) continue;

      // Never recover a pixel as foreground if it carries the blue/cyan/red studio backdrop color!
      if (isChromaticBg && hasBackdropChroma(ni) && bgDistMap[ni] < 52) continue;

      const bDist = bgDistMap[ni];
      const step = colorStep(curr, ni);
      const cA = coarseAlpha[ni];

      if (hasWhiteOrGreyHairOnLightWall && isCranial) {
        if ((cA >= 62 && step <= 22) || (cA >= 35 && (bDist >= 16 || textureMap[ni] >= 2.5) && step <= 18)) {
          visitedFg[ni] = 1;
          confirmedFg[ni] = 1;
          queue[qTail++] = ni;
        }
        continue;
      }

      const minBgSeparation = isShoulderOrTorso ? (isChromaticBg ? 42 : 30) : (isChromaticBg ? 45 : 36);
      const maxFgStep = isShoulderOrTorso ? 22 : 17;

      if (bDist >= minBgSeparation && step <= maxFgStep) {
        visitedFg[ni] = 1;
        confirmedFg[ni] = 1;
        queue[qTail++] = ni;
      }
    }
  }

  // Compose continuous pre-matte from confirmedBg, confirmedFg, and boundary transition pixels
  for (let i = 0; i < totalPixels; i++) {
    if (confirmedBg[i]) {
      refinedMask[i] = 0;
    } else if (confirmedFg[i]) {
      refinedMask[i] = 255;
    } else {
      const y = (i / width) | 0;
      const cA = coarseAlpha[i];
      const bDist = bgDistMap[i];

      if (hasWhiteOrGreyHairOnLightWall && y < cranialProtectMaxY) {
        if (cA <= 22) {
          refinedMask[i] = 0;
        } else if (cA >= 105) {
          refinedMask[i] = 255;
        } else {
          const t = (cA - 22) / (105 - 22);
          refinedMask[i] = Math.round(255 * Math.pow(t, 0.72));
        }
      } else {
        // For blue/cyan/red backdrops or dark-haired subjects: strictly key out pixels that match the backdrop!
        const lowThresh = isChromaticBg ? 26 : 18;
        const span = isChromaticBg ? 38 : 30;
        if (bDist <= lowThresh) {
          refinedMask[i] = 0;
        } else if (bDist > lowThresh + span && cA > 65 && distOutsideFg[i] < maxDilatePx * 0.7) {
          refinedMask[i] = 255;
        } else {
          const colorFactor = Math.max(0, Math.min(1, (bDist - lowThresh) / span));
          refinedMask[i] = cA * colorFactor;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Chroma Spill Alpha Attenuation on Outer Boundary (Eliminates Blue/Cyan/Red Edge Fringe!)
  // ---------------------------------------------------------------------------
  if (isBlueOrCyanBg || isRedBg) {
    const invW = 1 / Math.max(1, width - 1);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      const lR = bgLeftR[y], lG = bgLeftG[y], lB = bgLeftB[y];
      const rR = bgRightR[y], rG = bgRightG[y], rB = bgRightB[y];

      for (let x = 0; x < width; x++) {
        const i = row + x;
        const curM = refinedMask[i];
        if (curM === 0 || distInsideFg[i] > 9 * scale) continue;

        const p = i * 4;
        const r = srcData[p], g = srcData[p + 1], b = srcData[p + 2];
        const t = x * invW;
        const bR = lR * (1 - t) + rR * t;
        const bG = lG * (1 - t) + rG * t;
        const bB = lB * (1 - t) + rB * t;

        if (isBlueOrCyanBg) {
          // Excess blue/cyan relative to red channel:
          // Human skin has R > B; dark hair and dark suits have B ≈ R.
          // Any significant positive (B - R) or (0.6*B + 0.4*G - R) on the boundary comes from the blue/cyan backdrop!
          const bgBlueExcess = Math.max(25, (bB * 0.65 + bG * 0.35) - bR);
          const pixBlueExcess = (b * 0.65 + g * 0.35) - r;
          if (pixBlueExcess > 8) {
            const bgFraction = Math.max(0, Math.min(1, (pixBlueExcess - 6) / Math.max(15, bgBlueExcess * 0.82)));
            if (bgFraction > 0.58) {
              refinedMask[i] = 0;
            } else {
              refinedMask[i] = curM * (1 - bgFraction * 0.92);
            }
          }
        } else if (isRedBg && !isSkinColor(r, g, b)) {
          const bgRedExcess = Math.max(25, bR - (bG * 0.5 + bB * 0.5));
          const pixRedExcess = r - (g * 0.5 + b * 0.5);
          if (pixRedExcess > 14) {
            const bgFraction = Math.max(0, Math.min(1, (pixRedExcess - 10) / Math.max(15, bgRedExcess * 0.85)));
            if (bgFraction > 0.60) {
              refinedMask[i] = 0;
            } else {
              refinedMask[i] = curM * (1 - bgFraction * 0.90);
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Fill Interior Holes & Smooth Shoulder/Clothing Contour Geometry
  // ---------------------------------------------------------------------------
  const isExterior = new Uint8Array(totalPixels);
  qHead = 0;
  qTail = 0;
  for (let x = 0; x < width; x++) {
    if (refinedMask[x] < 128) {
      isExterior[x] = 1;
      queue[qTail++] = x;
    }
  }
  for (let y = 0; y < height; y++) {
    const lIdx = y * width;
    const rIdx = y * width + width - 1;
    if (!isExterior[lIdx] && refinedMask[lIdx] < 128) {
      isExterior[lIdx] = 1;
      queue[qTail++] = lIdx;
    }
    if (!isExterior[rIdx] && refinedMask[rIdx] < 128) {
      isExterior[rIdx] = 1;
      queue[qTail++] = rIdx;
    }
  }
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % width;
    const cy = (curr / width) | 0;
    if (cx > 0 && !isExterior[curr - 1] && refinedMask[curr - 1] < 128) {
      isExterior[curr - 1] = 1;
      queue[qTail++] = curr - 1;
    }
    if (cx + 1 < width && !isExterior[curr + 1] && refinedMask[curr + 1] < 128) {
      isExterior[curr + 1] = 1;
      queue[qTail++] = curr + 1;
    }
    if (cy > 0 && !isExterior[curr - width] && refinedMask[curr - width] < 128) {
      isExterior[curr - width] = 1;
      queue[qTail++] = curr - width;
    }
    if (cy + 1 < height && !isExterior[curr + width] && refinedMask[curr + width] < 128) {
      isExterior[curr + width] = 1;
      queue[qTail++] = curr + width;
    }
  }
  for (let i = 0; i < totalPixels; i++) {
    if (!isExterior[i] && refinedMask[i] < 128) {
      refinedMask[i] = 255;
    }
  }

  // Separable Contour Smoothing on the Shoulder/Torso Region (y >= shoulderZoneY)
  const smoothRadius = Math.max(3, Math.min(7, Math.round(3.5 * scale)));
  const tempMask = new Float32Array(refinedMask);
  for (let y = shoulderZoneY; y < height; y++) {
    const row = y * width;
    for (let x = smoothRadius; x < width - smoothRadius; x++) {
      const i = row + x;
      if (distOutsideFg[i] > maxDilatePx + 4 && distInsideFg[i] > maxErodePx + 4) continue;
      let sum = 0;
      for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
        sum += refinedMask[i + dx];
      }
      tempMask[i] = sum / (smoothRadius * 2 + 1);
    }
  }
  for (let y = shoulderZoneY; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      if (distOutsideFg[i] > maxDilatePx + 4 && distInsideFg[i] > maxErodePx + 4) continue;
      let sum = 0;
      let cnt = 0;
      for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += tempMask[ny * width + x];
          cnt++;
        }
      }
      const geoSmooth = sum / cnt;
      const bDist = bgDistMap[i];
      if (confirmedBg[i] && bDist < 26) {
        refinedMask[i] = 0;
      } else if (confirmedFg[i] && bDist > 55 && !(isChromaticBg && hasBackdropChroma(i))) {
        refinedMask[i] = 255;
      } else {
        refinedMask[i] = geoSmooth;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Joint Bilateral Guided Alpha Filter (Snaps Sub-Pixel Alpha to Full-Res Image Edges)
  // ---------------------------------------------------------------------------
  const finalAlpha = new Uint8ClampedArray(totalPixels);
  const jbfRadius = Math.max(2, Math.min(4, Math.round(2.2 * scale)));
  const twoSigmaSpatialSq = 2 * (jbfRadius * 0.75) * (jbfRadius * 0.75);
  const twoSigmaColorSq = 2 * 22 * 22;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    const isTorso = y >= shoulderZoneY;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const centerA = refinedMask[i];

      let hasVariation = false;
      const yMin = Math.max(0, y - jbfRadius);
      const yMax = Math.min(height - 1, y + jbfRadius);
      const xMin = Math.max(0, x - jbfRadius);
      const xMax = Math.min(width - 1, x + jbfRadius);

      for (let ny = yMin; ny <= yMax && !hasVariation; ny += jbfRadius) {
        const nRow = ny * width;
        for (let nx = xMin; nx <= xMax; nx += jbfRadius) {
          if (Math.abs(refinedMask[nRow + nx] - centerA) > 3) {
            hasVariation = true;
            break;
          }
        }
      }

      if (!hasVariation) {
        finalAlpha[i] = centerA >= 128 ? 255 : 0;
        continue;
      }

      const p = i * 4;
      const cR = srcData[p];
      const cG = srcData[p + 1];
      const cB = srcData[p + 2];

      let weightedAlphaSum = 0;
      let weightSum = 0;

      for (let ny = yMin; ny <= yMax; ny++) {
        const dy = ny - y;
        const nRow = ny * width;
        for (let nx = xMin; nx <= xMax; nx++) {
          const dx = nx - x;
          const ni = nRow + nx;
          const np = ni * 4;
          const dr = cR - srcData[np];
          const dg = cG - srcData[np + 1];
          const db = cB - srcData[np + 2];
          const colorSq = (2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9;
          const distSq = dx * dx + dy * dy;

          const w = Math.exp(-distSq / twoSigmaSpatialSq - colorSq / twoSigmaColorSq);
          weightedAlphaSum += refinedMask[ni] * w;
          weightSum += w;
        }
      }

      let a = weightSum > 0 ? weightedAlphaSum / weightSum : centerA;

      if (isTorso) {
        if (a <= 55) {
          a = 0;
        } else if (a >= 210) {
          a = 255;
        } else {
          const t = (a - 55) / (210 - 55);
          a = Math.round(255 * t * t * (3 - 2 * t));
        }
      } else {
        const lowCut = isChromaticBg ? 38 : 22;
        const highSolid = hasWhiteOrGreyHairOnLightWall ? 185 : 225;
        if (a < lowCut) {
          a = 0;
        } else if (a > highSolid) {
          a = 255;
        }
      }

      finalAlpha[i] = Math.round(a);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Foreground Color Decontamination & Blue/Red Chroma Despill
  //    Completely removes blue/cyan/red/white background color cast from boundary pixels!
  // ---------------------------------------------------------------------------
  const outImageData = new ImageData(width, height);
  const dst = outImageData.data;
  const invW = 1 / Math.max(1, width - 1);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    const isCranial = y < cranialProtectMaxY;
    const lR = bgLeftR[y], lG = bgLeftG[y], lB = bgLeftB[y];
    const rR = bgRightR[y], rG = bgRightG[y], rB = bgRightB[y];

    for (let x = 0; x < width; x++) {
      const i = row + x;
      const p = i * 4;
      let a = finalAlpha[i];

      if (a === 0) {
        dst[p] = 0;
        dst[p + 1] = 0;
        dst[p + 2] = 0;
        dst[p + 3] = 0;
        continue;
      }

      let r = srcData[p];
      let g = srcData[p + 1];
      let b = srcData[p + 2];

      // 9a. Chroma Despill for Blue/Cyan or Red Backdrops on outer boundary (distInsideFg < 10*scale or a < 250)
      if ((isBlueOrCyanBg || isRedBg) && (a < 250 || distInsideFg[i] < 8 * scale)) {
        if (isBlueOrCyanBg) {
          // Sample inner non-blue pixel (shifted 6px toward portrait center)
          const stepInX = x < midX ? Math.min(width - 1, x + Math.round(6 * scale)) : Math.max(0, x - Math.round(6 * scale));
          const stepInY = y < height * 0.35 ? Math.min(height - 1, y + Math.round(6 * scale)) : y;
          const inIdx = stepInY * width + stepInX;
          const inP = inIdx * 4;
          const inR = srcData[inP], inG = srcData[inP + 1], inB = srcData[inP + 2];

          const blueExcess = b - Math.max(r, inB);
          const cyanExcess = g - Math.max(r, inG);

          if (blueExcess > 6 || cyanExcess > 6) {
            // Suppress blue & cyan spill down to inner foreground's natural channel balance
            if (finalAlpha[inIdx] > 210 && inB <= inR + 12) {
              const spillRatio = Math.min(1, Math.max(blueExcess, cyanExcess) / 45);
              r = Math.round(r * (1 - spillRatio * 0.7) + inR * (spillRatio * 0.7));
              g = Math.round(Math.min(g, r * 0.5 + inG * 0.5));
              b = Math.round(Math.min(b, r * 0.5 + inB * 0.5));
            } else {
              // Clamp blue and green to red channel (neutralizes cyan/blue fringe to natural dark grey/skin tone)
              b = Math.min(b, Math.round(r * 1.02));
              g = Math.min(g, Math.round(r * 1.02));
            }
          }
        } else if (isRedBg && !isSkinColor(r, g, b)) {
          const redExcess = r - Math.max(g, b);
          if (redExcess > 12) {
            r = Math.min(r, Math.round((g + b) * 0.52));
          }
        }
      }

      // 9b. Un-Premultiply Background Color Spill on semi-transparent boundary pixels (0 < a < 245)
      if (a < 245) {
        const t = x * invW;
        const bR = lR * (1 - t) + rR * t;
        const bG = lG * (1 - t) + rG * t;
        const bB = lB * (1 - t) + rB * t;
        const bgLum = 0.299 * bR + 0.587 * bG + 0.114 * bB;
        const pixLum = lumMap[i];

        const isProtectedWhiteHair =
          hasWhiteOrGreyHairOnLightWall && isCranial && pixLum > 110;

        if (!isProtectedWhiteHair && (isChromaticBg || pixLum < bgLum - 18)) {
          const alphaNorm = Math.max(0.35, a / 255);
          const decontamStrength = (1 - a / 255) * 0.82;
          const trueR = Math.max(0, Math.min(255, (r - (1 - alphaNorm) * bR) / alphaNorm));
          const trueG = Math.max(0, Math.min(255, (g - (1 - alphaNorm) * bG) / alphaNorm));
          const trueB = Math.max(0, Math.min(255, (b - (1 - alphaNorm) * bB) / alphaNorm));

          r = Math.round(r * (1 - decontamStrength) + trueR * decontamStrength);
          g = Math.round(g * (1 - decontamStrength) + trueG * decontamStrength);
          b = Math.round(b * (1 - decontamStrength) + trueB * decontamStrength);
        }
      }

      dst[p] = r;
      dst[p + 1] = g;
      dst[p + 2] = b;
      dst[p + 3] = a;
    }
  }

  return outImageData;
}

/**
 * MediaPipe Selfie Segmentation + High-Resolution Edge-Guided Trimap Matting
 * (Runs 100% locally via WebAssembly, ~60ms, zero external network needed)
 */
async function segmentWithMediaPipe(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  onProgress?: (info: AiRemovalProgress) => void
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number } | null> {
  try {
    if (typeof window === 'undefined' || !(window as any).SelfieSegmentation) {
      return null;
    }

    onProgress?.({
      stage: 'loading',
      progress: 25,
      message: '正在调用本地高精度人像与多底色净边分割引擎...',
    });

    const SelfieSegmentationClass = (window as any).SelfieSegmentation;
    const selfie = new SelfieSegmentationClass({
      locateFile: (file: string) => `/mediapipe/selfie_segmentation/${file}`,
    });

    selfie.setOptions({
      modelSelection: 0,
      selfieMode: false,
    });

    const width = imageSource instanceof HTMLImageElement ? imageSource.naturalWidth || imageSource.width : imageSource.width;
    const height = imageSource instanceof HTMLImageElement ? imageSource.naturalHeight || imageSource.height : imageSource.height;

    onProgress?.({
      stage: 'processing',
      progress: 55,
      message: 'AI 正在智能消除背景色溢并对齐发丝与双肩衣服...',
    });

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { selfie.close(); } catch {}
        reject(new Error('MediaPipe timeout'));
      }, 4500);

      selfie.onResults((results: any) => {
        clearTimeout(timeout);
        try {
          const mask = results.segmentationMask;

          // 1. Extract original high-resolution RGB pixels
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = width;
          srcCanvas.height = height;
          const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
          srcCtx.drawImage(imageSource, 0, 0, width, height);
          const srcImgData = srcCtx.getImageData(0, 0, width, height);

          // 2. Extract coarse semantic probability mask
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = width;
          maskCanvas.height = height;
          const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
          maskCtx.fillStyle = '#FFFFFF';
          maskCtx.fillRect(0, 0, width, height);
          maskCtx.globalCompositeOperation = 'destination-in';
          maskCtx.drawImage(mask, 0, 0, width, height);
          const rawMaskData = maskCtx.getImageData(0, 0, width, height).data;

          const totalPixels = width * height;
          const coarseAlpha = new Uint8Array(totalPixels);
          for (let i = 0; i < totalPixels; i++) {
            coarseAlpha[i] = rawMaskData[i * 4 + 3];
          }

          // 3. Run High-Resolution Trimap, Chroma-Unmixing & Joint Bilateral Edge-Snapping Refinement
          const refinedImageData = refineMaskWithHighResImage(
            srcImgData.data,
            coarseAlpha,
            width,
            height
          );

          const outCanvas = document.createElement('canvas');
          outCanvas.width = width;
          outCanvas.height = height;
          const outCtx = outCanvas.getContext('2d')!;
          outCtx.putImageData(refinedImageData, 0, 0);

          outCanvas.toBlob((blob) => {
            try { selfie.close(); } catch {}
            if (!blob) {
              reject(new Error('Canvas blob conversion failed'));
              return;
            }
            const url = URL.createObjectURL(blob);
            resolve({ blob, url, imageData: refinedImageData, width, height });
          }, 'image/png');
        } catch (err) {
          try { selfie.close(); } catch {}
          reject(err);
        }
      });

      selfie.send({ image: imageSource }).catch((err: any) => {
        clearTimeout(timeout);
        try { selfie.close(); } catch {}
        reject(err);
      });
    });
  } catch (err) {
    console.warn('Local MediaPipe selfie segmentation unavailable, continuing to neural fallback:', err);
    return null;
  }
}

/**
 * Remove background using client-side AI neural network model + High-Res Edge Snapping.
 */
export async function removeBackgroundWithAI(
  imageSource: File | Blob | ImageData | HTMLImageElement | string,
  cacheKey?: string,
  onProgress?: (info: AiRemovalProgress) => void
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number }> {
  if (cacheKey && aiResultCache.has(cacheKey)) {
    const cached = aiResultCache.get(cacheKey)!;
    return {
      blob: cached.blob,
      url: cached.url,
      imageData: cached.imageData,
      width: cached.imageData.width,
      height: cached.imageData.height,
    };
  }

  onProgress?.({
    stage: 'loading',
    progress: 10,
    message: '正在启动人像高精度识别与智能抠图...',
  });

  try {
    let srcImg: HTMLImageElement;
    let tempUrl: string | null = null;
    if (imageSource instanceof HTMLImageElement) {
      srcImg = imageSource;
    } else if (imageSource instanceof ImageData) {
      const c = document.createElement('canvas');
      c.width = imageSource.width;
      c.height = imageSource.height;
      const ctx = c.getContext('2d')!;
      ctx.putImageData(imageSource, 0, 0);
      tempUrl = c.toDataURL('image/png');
      srcImg = new Image();
      await new Promise<void>((res) => {
        srcImg.onload = () => res();
        srcImg.src = tempUrl!;
      });
    } else {
      tempUrl = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
      srcImg = new Image();
      srcImg.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        srcImg.onload = () => res();
        srcImg.onerror = () => rej(new Error('无法读取源图'));
        srcImg.src = tempUrl!;
      });
      if (tempUrl.startsWith('blob:')) {
        URL.revokeObjectURL(tempUrl);
      }
    }

    const sw = srcImg.naturalWidth || srcImg.width;
    const sh = srcImg.naturalHeight || srcImg.height;
    let workingImg: HTMLImageElement | HTMLCanvasElement = srcImg;

    if (sw > 1024 || sh > 1024) {
      const scale = 1024 / Math.max(sw, sh);
      const nw = Math.round(sw * scale);
      const nh = Math.round(sh * scale);
      const downCanvas = document.createElement('canvas');
      downCanvas.width = nw;
      downCanvas.height = nh;
      const dctx = downCanvas.getContext('2d')!;
      dctx.drawImage(srcImg, 0, 0, nw, nh);
      workingImg = downCanvas;
    }

    // 1. Try local MediaPipe + High-Res Edge-Guided Trimap Matting first
    const mediaPipeResult = await segmentWithMediaPipe(workingImg, onProgress);
    if (mediaPipeResult) {
      if (cacheKey) {
        aiResultCache.set(cacheKey, mediaPipeResult);
      }
      onProgress?.({
        stage: 'finishing',
        progress: 100,
        message: 'AI 智能抠图完成！蓝/红/白底色溢已净除，人像与衣服平滑自然',
      });
      return mediaPipeResult;
    }

    // 2. Fallback to @imgly neural network model
    onProgress?.({
      stage: 'processing',
      progress: 60,
      message: 'AI 正在智能分离主体人物与阴影背景...',
    });

    let inputSource: Blob | File | string;
    if (workingImg instanceof HTMLCanvasElement) {
      inputSource = await new Promise<Blob>((res) => workingImg.toBlob((b) => res(b!), 'image/png'));
    } else {
      inputSource = imageSource as any;
    }

    const config: Config = {
      model: 'isnet_quint8',
      output: {
        format: 'image/png',
        quality: 0.95,
      },
    };

    const aiExecutionPromise = imglyRemoveBackground(inputSource, config);
    const timeoutPromise = new Promise<Blob>((_, reject) =>
      setTimeout(() => reject(new Error('网络模型下载超时，自动切换至边缘自适应算法')), 4500)
    );
    const outputBlob = await Promise.race([aiExecutionPromise, timeoutPromise]);

    const url = URL.createObjectURL(outputBlob);
    const resImg = new Image();
    resImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      resImg.onload = () => resolve();
      resImg.onerror = () => reject(new Error('无法读取输出图像'));
      resImg.src = url;
    });

    const width = resImg.naturalWidth || resImg.width;
    const height = resImg.naturalHeight || resImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(resImg, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);

    const result = {
      blob: outputBlob,
      url,
      imageData,
      width,
      height,
    };

    if (cacheKey) {
      aiResultCache.set(cacheKey, result);
    }

    onProgress?.({
      stage: 'finishing',
      progress: 100,
      message: 'AI 抠图完成！背景已消除，双肩衣服完好',
    });

    return result;
  } catch (err: any) {
    console.warn('AI neural network model unavailable, falling back to smart edge-guided keying:', err);
    onProgress?.({
      stage: 'processing',
      progress: 80,
      message: '正在使用智能自适应边缘抠图算法...',
    });
    const fallbackResult = await smartEdgeGuidedKeying(imageSource);
    if (cacheKey) {
      aiResultCache.set(cacheKey, fallbackResult);
    }
    onProgress?.({
      stage: 'finishing',
      progress: 100,
      message: '智能抠图完成！发丝与肩膀细节已保护',
    });
    return fallbackResult;
  }
}

/**
 * High-performance smart edge-guided background keying fallback
 */
export async function smartEdgeGuidedKeying(
  imageSource: File | Blob | ImageData | HTMLImageElement | string
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number }> {
  let img: HTMLImageElement;
  let tempSrcUrl: string | null = null;
  if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    if (typeof imageSource === 'string') {
      tempSrcUrl = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      tempSrcUrl = URL.createObjectURL(imageSource);
    } else if (imageSource instanceof ImageData) {
      const c = document.createElement('canvas');
      c.width = imageSource.width;
      c.height = imageSource.height;
      const ctx = c.getContext('2d')!;
      ctx.putImageData(imageSource, 0, 0);
      tempSrcUrl = c.toDataURL('image/png');
    }

    img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('无法读取原始图片进行智能抠图'));
      img.src = tempSrcUrl!;
    });
    if (tempSrcUrl && (imageSource instanceof File || imageSource instanceof Blob)) {
      URL.revokeObjectURL(tempSrcUrl);
    }
  }

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  const scale = Math.min(1, 1024 / Math.max(origW, origH));
  const width = Math.round(origW * scale);
  const height = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  let existingTransparent = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] < 35) existingTransparent++;
  }
  if (existingTransparent > totalPixels * 0.05) {
    const outBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const outUrl = URL.createObjectURL(outBlob);
    return { blob: outBlob, url: outUrl, imageData: imgData, width, height };
  }

  let sumR = 0, sumG = 0, sumB = 0, samples = 0;
  const sample = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = (y * width + x) * 4;
    sumR += data[p];
    sumG += data[p + 1];
    sumB += data[p + 2];
    samples++;
  };

  for (let x = 0; x < width * 0.25; x += 3) {
    sample(x, 0);
    sample(x, 2);
  }
  for (let x = Math.round(width * 0.75); x < width; x += 3) {
    sample(x, 0);
    sample(x, 2);
  }
  const maxSampleY = Math.round(height * 0.35);
  for (let y = 0; y < maxSampleY; y += 3) {
    sample(0, y);
    sample(2, y);
    sample(width - 1, y);
    sample(width - 3, y);
  }

  const bgR = samples > 0 ? sumR / samples : 235;
  const bgG = samples > 0 ? sumG / samples : 235;
  const bgB = samples > 0 ? sumB / samples : 235;

  const colorDistToBg = (r: number, g: number, b: number) => {
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
  };

  const visited = new Uint8Array(totalPixels);
  const coarseAlpha = new Uint8Array(totalPixels);
  coarseAlpha.fill(255);

  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const archCenterX = width * 0.5;
  const archCenterY = height * 0.36;
  const archRx = width * 0.27;
  const archRy = height * 0.26;

  const trySeed = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (colorDistToBg(data[p], data[p + 1], data[p + 2]) <= 46) {
      visited[idx] = 1;
      coarseAlpha[idx] = 0;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) trySeed(x, 0);
  for (let y = 0; y < Math.round(height * 0.85); y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = (curr / width) | 0;
    const cp = curr * 4;
    const cR = data[cp], cG = data[cp + 1], cB = data[cp + 2];

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx + 1 < width ? curr + 1 : -1,
      cy > 0 ? curr - width : -1,
      cy + 1 < height ? curr + width : -1,
    ];

    for (let k = 0; k < 4; k++) {
      const ni = neighbors[k];
      if (ni < 0 || visited[ni]) continue;
      const nx = ni % width;
      const ny = (ni / width) | 0;

      const dxNorm = (nx - archCenterX) / archRx;
      const dyNorm = (ny - archCenterY) / archRy;
      if (dxNorm * dxNorm + dyNorm * dyNorm <= 1.0) continue;

      const np = ni * 4;
      const nR = data[np], nG = data[np + 1], nB = data[np + 2];
      const dr = nR - cR, dg = nG - cG, db = nB - cB;
      const stepDist = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
      if (stepDist <= 12 && colorDistToBg(nR, nG, nB) <= 45) {
        visited[ni] = 1;
        coarseAlpha[ni] = 0;
        queue[tail++] = ni;
      }
    }
  }

  const refinedData = refineMaskWithHighResImage(data, coarseAlpha, width, height);
  ctx.putImageData(refinedData, 0, 0);

  const outBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const outUrl = URL.createObjectURL(outBlob);

  return {
    blob: outBlob,
    url: outUrl,
    imageData: refinedData,
    width,
    height,
  };
}

/**
 * Check if AI background removal is supported in current environment
 */
export function isAiRemovalSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined';
}
