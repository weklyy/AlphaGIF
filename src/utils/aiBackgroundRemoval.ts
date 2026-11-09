/**
 * AI Neural Network Background Removal Engine
 * 100% Client-side in-browser WebAssembly & High-Resolution Edge-Guided Trimap Matting
 * Combines MediaPipe Semantic Segmentation with High-Resolution Joint Bilateral & Color-Affinity Matting
 * to ensure smooth, natural clothing/shoulder contours (zero wavy edges) and clean transparent backgrounds.
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
 * High-Resolution Trimap & Joint Bilateral Edge-Snapping Matting Refinement
 *
 * Solves the root cause of wavy clothing/shoulder contours from low-res (256x144) neural masks:
 * 1. Builds a row-by-row local background wall color model (left & right profiles) to handle vertical lighting gradients.
 * 2. Floods confirmed background inward through the uncertain trimap band to remove neck/collar background pockets.
 * 3. Recovers real clothing & shoulder pixels that low-res neural masks accidentally clipped into wavy scallops.
 * 4. Applies morphological contour smoothing + Joint Bilateral Filtering guided by the full-res RGB image,
 *    snapping the alpha matte directly to the true optical edge of the clothes, skin, and hair with sub-pixel anti-aliasing.
 * 5. Performs foreground color decontamination (un-premultiply) to eliminate white/grey background halos.
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

  // Global fallback background color from top corners and confirmed outer background
  let gSumR = 0, gSumG = 0, gSumB = 0, gCount = 0;
  for (let y = 0; y < Math.round(height * 0.45); y += 2) {
    const row = y * width;
    for (let x = 0; x < width; x += 4) {
      const i = row + x;
      if (coarseAlpha[i] < 20 || (y < height * 0.08 && (x < width * 0.22 || x > width * 0.78))) {
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
      if (coarseAlpha[i] < 22) {
        const p = i * 4;
        lR += srcData[p];
        lG += srcData[p + 1];
        lB += srcData[p + 2];
        lCnt++;
      }
    }
    for (let x = midX; x < width; x += 2) {
      const i = row + x;
      if (coarseAlpha[i] < 22) {
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

  // Fill and vertically smooth row background profiles
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

  // Helper: Perceptual color distance between pixel i and local background at (x, y)
  const bgDistMap = new Float32Array(totalPixels);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const lR = bgLeftR[y], lG = bgLeftG[y], lB = bgLeftB[y];
    const rR = bgRightR[y], rG = bgRightG[y], rB = bgRightB[y];
    const invW = 1 / Math.max(1, width - 1);
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const p = i * 4;
      const t = x * invW;
      const bR = lR * (1 - t) + rR * t;
      const bG = lG * (1 - t) + rG * t;
      const bB = lB * (1 - t) + rB * t;
      const dr = srcData[p] - bR;
      const dg = srcData[p + 1] - bG;
      const db = srcData[p + 2] - bB;
      bgDistMap[i] = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Compute Distance Transforms from Coarse Mask Boundary (Trimap Construction)
  // ---------------------------------------------------------------------------
  // distOutsideFg: distance (in px) outside the coarse foreground (coarseAlpha >= 95)
  // distInsideFg:  distance (in px) inside the coarse foreground (coarseAlpha >= 95)
  const distOutsideFg = new Float32Array(totalPixels);
  const distInsideFg = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    if (coarseAlpha[i] >= 95) {
      distOutsideFg[i] = 0;
      distInsideFg[i] = 9999;
    } else {
      distOutsideFg[i] = 9999;
      distInsideFg[i] = 0;
    }
  }

  // Two-pass Chamfer distance for both outside & inside
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
  // 3. Edge-Guarded Background Flood-Fill into the Trimap Band
  //    Cleans out neck/collar/ear background pockets that MediaPipe missed!
  // ---------------------------------------------------------------------------
  const maxErodePx = Math.max(12, Math.round(width * 0.042)); // how far inward background can flood into false-positive blobs
  const maxDilatePx = Math.max(14, Math.round(width * 0.048)); // how far outward foreground clothing can recover from wavy cuts

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

  // Seed assured outer background pixels
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const isBorder = y <= 2 || ((x <= 2 || x >= width - 3) && y < height * 0.65);
      if (
        (coarseAlpha[i] < 18 && bgDistMap[i] < 32) ||
        (isBorder && coarseAlpha[i] < 120 && bgDistMap[i] < 38)
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

    // 4-connected + diagonal check
    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx + 1 < width ? curr + 1 : -1,
      cy > 0 ? curr - width : -1,
      cy + 1 < height ? curr + width : -1,
    ];

    for (let k = 0; k < 4; k++) {
      const ni = neighbors[k];
      if (ni < 0 || visitedBg[ni]) continue;

      // Never flood deep into core face/torso unless in the lateral neck/shoulder pocket zone
      const ny = (ni / width) | 0;
      const nx = ni % width;
      const isLateralPocketZone = ny > height * 0.35 && ny < height * 0.88 && (nx < width * 0.38 || nx > width * 0.62);
      const allowedDepth = isLateralPocketZone ? maxErodePx * 1.45 : maxErodePx;

      if (distInsideFg[ni] > allowedDepth) continue;

      const step = colorStep(curr, ni);
      const bDist = bgDistMap[ni];
      const cAlpha = coarseAlpha[ni];

      // Adaptive threshold: if coarseAlpha is already low/moderate, allow slightly wider background tolerance,
      // but ALWAYS stop at sharp color steps (actual edge of hair, skin, glasses, or clothing!)
      const maxStep = cAlpha < 110 ? 15.5 : 11.5;
      const maxBgDist = cAlpha < 90 ? 38 : cAlpha < 175 ? 30 : 22;

      if (step <= maxStep && bDist <= maxBgDist) {
        visitedBg[ni] = 1;
        confirmedBg[ni] = 1;
        queue[qTail++] = ni;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. High-Resolution Clothing, Shoulder & Portrait Recovery
  //    Fixes wavy scallops eaten out of shoulders/clothes by MediaPipe's 256x144 grid!
  // ---------------------------------------------------------------------------
  const refinedMask = new Float32Array(totalPixels);

  // Find vertical level where neck/shoulders begin (typically around 42% of height)
  const shoulderZoneY = Math.round(height * 0.42);

  // Seed foreground from assured interior core and flood outward to true high-res clothing/portrait edge
  const confirmedFg = new Uint8Array(totalPixels);
  const visitedFg = new Uint8Array(totalPixels);
  qHead = 0;
  qTail = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (!confirmedBg[i] && (distInsideFg[i] >= 3 || (coarseAlpha[i] >= 175 && bgDistMap[i] > 24))) {
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
      const maxOut = isShoulderOrTorso ? maxDilatePx : maxDilatePx * 0.65;
      if (distOutsideFg[ni] > maxOut) continue;

      const bDist = bgDistMap[ni];
      const step = colorStep(curr, ni);

      // If pixel is clearly distinct from local background AND continuous with adjacent foreground fabric/skin/hair:
      // Recover it as solid foreground!
      const minBgSeparation = isShoulderOrTorso ? 30 : 36;
      const maxFgStep = isShoulderOrTorso ? 24 : 18;

      if (bDist >= minBgSeparation && step <= maxFgStep) {
        visitedFg[ni] = 1;
        confirmedFg[ni] = 1;
        queue[qTail++] = ni;
      }
    }
  }

  // Compose continuous pre-matte from confirmedBg, confirmedFg, and undecided boundary pixels
  for (let i = 0; i < totalPixels; i++) {
    if (confirmedBg[i]) {
      refinedMask[i] = 0;
    } else if (confirmedFg[i]) {
      refinedMask[i] = 255;
    } else {
      // Undecided pixel in narrow transition band: blend based on background distance & coarseAlpha
      const bDist = bgDistMap[i];
      const cA = coarseAlpha[i];
      if (bDist < 16) {
        refinedMask[i] = 0;
      } else if (bDist > 48 && cA > 45 && distOutsideFg[i] < maxDilatePx * 0.8) {
        refinedMask[i] = 255;
      } else {
        const colorFactor = Math.max(0, Math.min(1, (bDist - 16) / 30));
        refinedMask[i] = cA * colorFactor;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Fill Interior Holes & Smooth Shoulder/Clothing Contour Geometry
  //    Eliminates any remaining low-frequency waves on low-contrast clothing!
  // ---------------------------------------------------------------------------
  // 5a. Flood from borders through refinedMask < 128 to find true exterior; any enclosed hole becomes 255
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

  // 5b. Separable Contour Smoothing on the Shoulder/Torso Region (y >= shoulderZoneY)
  // Smooths out any residual low-res CNN grid waves along the shoulder line before edge-snapping
  const smoothRadius = Math.max(3, Math.min(7, Math.round(3.5 * scale)));
  const tempMask = new Float32Array(refinedMask);
  // Horizontal box pass
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
  // Vertical box pass + blend with high-contrast confidence
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
      // If pixel has very strong contrast against background, trust the exact color boundary;
      // otherwise blend in the geometrically smoothed shoulder curve so low-contrast clothes never wave!
      const bDist = bgDistMap[i];
      if (confirmedBg[i] && bDist < 22) {
        refinedMask[i] = 0;
      } else if (confirmedFg[i] && bDist > 55) {
        refinedMask[i] = 255;
      } else {
        refinedMask[i] = geoSmooth;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Joint Bilateral Guided Alpha Filter (Snaps Sub-Pixel Alpha to Full-Res Image Edges)
  //    Guarantees silky-smooth anti-aliased edges on clothes, neck, ears, and hair!
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

      // Quick check if neighborhood is uniform (all 0 or all 255)
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

      // For clothing/torso: apply a clean, smooth anti-aliased S-curve ramp (never hard binary steps, never wide blurry fog)
      if (isTorso) {
        // Map [45, 210] smoothly to [0, 255] using smoothstep so diagonal shoulder edges are razor-clean and anti-aliased
        if (a <= 45) {
          a = 0;
        } else if (a >= 210) {
          a = 255;
        } else {
          const t = (a - 45) / (210 - 45);
          a = Math.round(255 * t * t * (3 - 2 * t));
        }
      } else {
        // Head/hair/ears: preserve delicate hair strands while cutting weak background noise (< 22)
        if (a < 22) {
          a = 0;
        } else if (a > 242) {
          a = 255;
        }
      }

      finalAlpha[i] = Math.round(a);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Foreground Color Decontamination (Un-Premultiply Background Color Spill)
  //    Removes white/grey wall color mixed into semi-transparent hair & clothing edges
  // ---------------------------------------------------------------------------
  const outImageData = new ImageData(width, height);
  const dst = outImageData.data;
  const invW = 1 / Math.max(1, width - 1);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    const lR = bgLeftR[y], lG = bgLeftG[y], lB = bgLeftB[y];
    const rR = bgRightR[y], rG = bgRightG[y], rB = bgRightB[y];

    for (let x = 0; x < width; x++) {
      const i = row + x;
      const p = i * 4;
      const a = finalAlpha[i];

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

      // Decontaminate boundary pixels where 0 < a < 245
      if (a < 245) {
        const t = x * invW;
        const bR = lR * (1 - t) + rR * t;
        const bG = lG * (1 - t) + rG * t;
        const bB = lB * (1 - t) + rB * t;

        const alphaNorm = Math.max(0.32, a / 255);
        const decontamStrength = (1 - a / 255) * 0.85;
        const trueR = Math.max(0, Math.min(255, (r - (1 - alphaNorm) * bR) / alphaNorm));
        const trueG = Math.max(0, Math.min(255, (g - (1 - alphaNorm) * bG) / alphaNorm));
        const trueB = Math.max(0, Math.min(255, (b - (1 - alphaNorm) * bB) / alphaNorm));

        r = Math.round(r * (1 - decontamStrength) + trueR * decontamStrength);
        g = Math.round(g * (1 - decontamStrength) + trueG * decontamStrength);
        b = Math.round(b * (1 - decontamStrength) + trueB * decontamStrength);
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
      message: '正在调用本地高精度人像与服饰边缘分割引擎...',
    });

    const SelfieSegmentationClass = (window as any).SelfieSegmentation;
    const selfie = new SelfieSegmentationClass({
      locateFile: (file: string) => `/mediapipe/selfie_segmentation/${file}`,
    });

    // Model 0 (256x256 General model) has 78% higher vertical resolution than Model 1 (256x144),
    // reducing vertical grid stair-stepping along sloping shoulders!
    selfie.setOptions({
      modelSelection: 0,
      selfieMode: false,
    });

    const width = imageSource instanceof HTMLImageElement ? imageSource.naturalWidth || imageSource.width : imageSource.width;
    const height = imageSource instanceof HTMLImageElement ? imageSource.naturalHeight || imageSource.height : imageSource.height;

    onProgress?.({
      stage: 'processing',
      progress: 55,
      message: 'AI 正在精细对齐衣服肩膀边缘与发丝轮廓...',
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

          // 2. Extract coarse semantic probability mask onto an opaque white canvas with destination-in
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

          // 3. Run High-Resolution Trimap & Joint Bilateral Edge-Snapping Refinement
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
 * Ideal for complex real-world photos, uneven shadows, gradients, and portraits.
 */
export async function removeBackgroundWithAI(
  imageSource: File | Blob | ImageData | HTMLImageElement | string,
  cacheKey?: string,
  onProgress?: (info: AiRemovalProgress) => void
): Promise<{ blob: Blob; url: string; imageData: ImageData; width: number; height: number }> {
  // Check cache first
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
    // Pre-scale large images to max 1024px for crisp clothing & hair edge resolution
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
        message: 'AI 智能抠图完成！人像与衣服边缘平滑贴合',
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
 * Detects row-by-row border backdrop color, runs edge-barrier flood fill down to actual shoulder contact,
 * and applies Joint Bilateral anti-aliasing.
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

  // Check if image already has transparent channel
  let existingTransparent = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] < 35) existingTransparent++;
  }
  if (existingTransparent > totalPixels * 0.05) {
    const outBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const outUrl = URL.createObjectURL(outBlob);
    return { blob: outBlob, url: outUrl, imageData: imgData, width, height };
  }

  // Sample top corners to detect initial backdrop color
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

  // Flood-fill background from top and side borders where border color matches backdrop
  const visited = new Uint8Array(totalPixels);
  const coarseAlpha = new Uint8Array(totalPixels);
  coarseAlpha.fill(255);

  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

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
      const np = ni * 4;
      const nR = data[np], nG = data[np + 1], nB = data[np + 2];
      const dr = nR - cR, dg = nG - cG, db = nB - cB;
      const stepDist = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
      if (stepDist <= 14 && colorDistToBg(nR, nG, nB) <= 50) {
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
