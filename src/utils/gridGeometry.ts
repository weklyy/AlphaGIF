import { GridCropArea, CellOverride, SlicerLayoutMode } from '../types';

/**
 * Returns default uniform normalized splits [0..1] for internal dividers.
 * For count = 4, returns [0.25, 0.5, 0.75] (length is count - 1).
 */
export function getDefaultSplits(count: number): number[] {
  if (count <= 1) return [];
  const splits: number[] = [];
  for (let i = 1; i < count; i++) {
    splits.push(Math.round((i / count) * 1000) / 1000);
  }
  return splits;
}

/**
 * Ensures splits array is valid for given count, sorted, and respects minimum gap.
 */
export function normalizeSplits(splits: number[] | undefined, count: number, minGap = 0.02): number[] {
  if (count <= 1) return [];
  if (!splits || splits.length !== count - 1) {
    return getDefaultSplits(count);
  }

  const result: number[] = [];
  let prev = 0;

  for (let i = 0; i < count - 1; i++) {
    // Current target
    let val = splits[i];
    if (typeof val !== 'number' || isNaN(val)) {
      val = (i + 1) / count;
    }

    // Must be at least prev + minGap
    val = Math.max(prev + minGap, val);

    // Must leave enough space for remaining splits: (count - 1 - i) * minGap
    const maxAllowed = 1 - (count - 1 - i) * minGap;
    val = Math.min(maxAllowed, val);

    result.push(Math.round(val * 10000) / 10000);
    prev = val;
  }

  return result;
}

/**
 * Computes individual column width percentages [w0, w1, ...] summing to 100%
 */
export function getColWidthsPercent(splits: number[] | undefined, cols: number): number[] {
  const norm = normalizeSplits(splits, cols);
  if (cols <= 1) return [100];
  const widths: number[] = [];
  let prev = 0;
  for (let i = 0; i < norm.length; i++) {
    widths.push(Math.max(1, (norm[i] - prev) * 100));
    prev = norm[i];
  }
  widths.push(Math.max(1, (1 - prev) * 100));
  return widths;
}

/**
 * Computes individual row height percentages [h0, h1, ...] summing to 100%
 */
export function getRowHeightsPercent(splits: number[] | undefined, rows: number): number[] {
  const norm = normalizeSplits(splits, rows);
  if (rows <= 1) return [100];
  const heights: number[] = [];
  let prev = 0;
  for (let i = 0; i < norm.length; i++) {
    heights.push(Math.max(1, (norm[i] - prev) * 100));
    prev = norm[i];
  }
  heights.push(Math.max(1, (1 - prev) * 100));
  return heights;
}

/**
 * Converts current linked grid bounds into N independent free-floating crop boxes (% 0..100).
 */
export function getIndependentBoxesFromGrid(
  cropArea: GridCropArea,
  cols: number,
  rows: number,
  colSplits?: number[],
  rowSplits?: number[],
  cellOverrides?: Record<number, CellOverride>,
  naturalW?: number,
  naturalH?: number
): Record<number, GridCropArea> {
  const total = Math.max(1, cols * rows);
  const boxes: Record<number, GridCropArea> = {};
  const validColSplits = normalizeSplits(colSplits, cols);
  const validRowSplits = normalizeSplits(rowSplits, rows);

  for (let idx = 0; idx < total; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const colStartRatio = col === 0 ? 0 : validColSplits[col - 1];
    const colEndRatio = col === cols - 1 ? 1 : validColSplits[col];
    const rowStartRatio = row === 0 ? 0 : validRowSplits[row - 1];
    const rowEndRatio = row === rows - 1 ? 1 : validRowSplits[row];

    let x = cropArea.x + colStartRatio * cropArea.width;
    let y = cropArea.y + rowStartRatio * cropArea.height;
    let width = (colEndRatio - colStartRatio) * cropArea.width;
    let height = (rowEndRatio - rowStartRatio) * cropArea.height;

    const override = cellOverrides?.[idx];
    if (override && naturalW && naturalH && naturalW > 0 && naturalH > 0) {
      x += ((override.dx || 0) / naturalW) * 100;
      y += ((override.dy || 0) / naturalH) * 100;
      width += ((override.dw || 0) / naturalW) * 100;
      height += ((override.dh || 0) / naturalH) * 100;
    }

    boxes[idx] = {
      x: Math.max(0, Math.min(99, Math.round(x * 100) / 100)),
      y: Math.max(0, Math.min(99, Math.round(y * 100) / 100)),
      width: Math.max(1, Math.min(100, Math.round(width * 100) / 100)),
      height: Math.max(1, Math.min(100, Math.round(height * 100) / 100)),
    };
  }

  return boxes;
}

export interface CellBoundsCalculationOptions {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  cols: number;
  rows: number;
  col: number;
  row: number;
  cellIndex?: number;
  layoutMode?: SlicerLayoutMode;
  independentBox?: GridCropArea;
  colSplits?: number[];
  rowSplits?: number[];
  cellOverride?: CellOverride;
  paddingInset: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface CalculatedCellBounds {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  baseSx: number;
  baseSy: number;
  baseSw: number;
  baseSh: number;
}

/**
 * Calculates exact pixel crop coordinates on source image/video for cell (col, row),
 * respecting independent boxes (if mode is independent), column/row splits, cellOverrides, and paddingInset.
 */
export function calculateCellBounds(options: CellBoundsCalculationOptions): CalculatedCellBounds {
  const {
    cropX,
    cropY,
    cropW,
    cropH,
    cols,
    rows,
    col,
    row,
    layoutMode,
    independentBox,
    colSplits,
    rowSplits,
    cellOverride,
    paddingInset,
    sourceWidth,
    sourceHeight,
  } = options;

  // Case 1: Independent box mode
  if (layoutMode === 'independent' && independentBox) {
    const baseSx = (independentBox.x / 100) * sourceWidth;
    const baseSy = (independentBox.y / 100) * sourceHeight;
    const baseSw = Math.max(4, (independentBox.width / 100) * sourceWidth);
    const baseSh = Math.max(4, (independentBox.height / 100) * sourceHeight);

    const inset = Math.max(0, paddingInset || 0);
    const dx = cellOverride?.dx || 0;
    const dy = cellOverride?.dy || 0;
    const dw = cellOverride?.dw || 0;
    const dh = cellOverride?.dh || 0;

    const rawSx = baseSx + inset + dx;
    const rawSy = baseSy + inset + dy;
    const rawSw = baseSw - inset * 2 + dw;
    const rawSh = baseSh - inset * 2 + dh;

    const sx = Math.max(0, Math.min(sourceWidth - 2, rawSx));
    const sy = Math.max(0, Math.min(sourceHeight - 2, rawSy));
    const sw = Math.max(2, Math.min(sourceWidth - sx, rawSw));
    const sh = Math.max(2, Math.min(sourceHeight - sy, rawSh));

    return {
      sx,
      sy,
      sw,
      sh,
      baseSx,
      baseSy,
      baseSw,
      baseSh,
    };
  }

  // Case 2: Standard linked grid mode
  const validColSplits = normalizeSplits(colSplits, cols);
  const validRowSplits = normalizeSplits(rowSplits, rows);

  const colStartRatio = col === 0 ? 0 : validColSplits[col - 1];
  const colEndRatio = col === cols - 1 ? 1 : validColSplits[col];
  const rowStartRatio = row === 0 ? 0 : validRowSplits[row - 1];
  const rowEndRatio = row === rows - 1 ? 1 : validRowSplits[row];

  const baseSx = cropX + colStartRatio * cropW;
  const baseSw = Math.max(4, (colEndRatio - colStartRatio) * cropW);
  const baseSy = cropY + rowStartRatio * cropH;
  const baseSh = Math.max(4, (rowEndRatio - rowStartRatio) * cropH);

  const inset = Math.max(0, paddingInset || 0);
  const dx = cellOverride?.dx || 0;
  const dy = cellOverride?.dy || 0;
  const dw = cellOverride?.dw || 0;
  const dh = cellOverride?.dh || 0;

  const rawSx = baseSx + inset + dx;
  const rawSy = baseSy + inset + dy;
  const rawSw = baseSw - inset * 2 + dw;
  const rawSh = baseSh - inset * 2 + dh;

  const sx = Math.max(0, Math.min(sourceWidth - 2, rawSx));
  const sy = Math.max(0, Math.min(sourceHeight - 2, rawSy));
  const sw = Math.max(2, Math.min(sourceWidth - sx, rawSw));
  const sh = Math.max(2, Math.min(sourceHeight - sy, rawSh));

  return {
    sx,
    sy,
    sw,
    sh,
    baseSx,
    baseSy,
    baseSw,
    baseSh,
  };
}

/**
 * Fast projection-based seam / divider detector.
 * Analyzes visual image data within cropArea to snap vertical and horizontal dividers
 * to actual content boundaries or gutters (white/light/dark seam lines or edge transitions).
 */
export function autoDetectGridSplits(
  ctx: CanvasRenderingContext2D,
  naturalW: number,
  naturalH: number,
  cropArea: GridCropArea,
  cols: number,
  rows: number
): { colSplits: number[]; rowSplits: number[] } {
  // Bounding rect in canvas natural coordinates
  const cropX = Math.max(0, Math.floor((cropArea.x / 100) * naturalW));
  const cropY = Math.max(0, Math.floor((cropArea.y / 100) * naturalH));
  const cropW = Math.max(20, Math.min(naturalW - cropX, Math.floor((cropArea.width / 100) * naturalW)));
  const cropH = Math.max(20, Math.min(naturalH - cropY, Math.floor((cropArea.height / 100) * naturalH)));

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(cropX, cropY, cropW, cropH);
  } catch (err) {
    console.warn('Cannot read image data for auto-detection:', err);
    return {
      colSplits: getDefaultSplits(cols),
      rowSplits: getDefaultSplits(rows),
    };
  }

  const { data, width: W, height: H } = imgData;

  // Helper to read luminance [0..255]
  const getLum = (px: number, py: number): number => {
    const x = Math.max(0, Math.min(W - 1, px));
    const y = Math.max(0, Math.min(H - 1, py));
    const offset = (y * W + x) * 4;
    return (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
  };

  // 1. Detect Vertical Dividers (Column Splits)
  const detectedCols: number[] = [];
  const colNominalW = W / cols;
  const colSearchWindow = Math.max(6, Math.min(60, Math.floor(colNominalW * 0.22)));

  for (let k = 1; k < cols; k++) {
    const nominalX = Math.round(k * colNominalW);
    const startX = Math.max(k === 1 ? 5 : Math.round(detectedCols[k - 2] * W + 10), nominalX - colSearchWindow);
    const endX = Math.min(W - (cols - k) * 10, nominalX + colSearchWindow);

    let bestX = nominalX;
    let bestScore = -Infinity;

    // Check if the area tends to have a white/bright gutter
    let maxLumObserved = 0;
    for (let sampleX = startX; sampleX <= endX; sampleX += 2) {
      let sumLum = 0;
      let count = 0;
      for (let y = 0; y < H; y += 4) {
        sumLum += getLum(sampleX, y);
        count++;
      }
      const avg = sumLum / count;
      if (avg > maxLumObserved) maxLumObserved = avg;
    }

    const isLightGutterMode = maxLumObserved > 210;

    for (let x = startX; x <= endX; x++) {
      let sumLum = 0;
      let sumSqDiff = 0;
      let edgeEnergy = 0;
      let count = 0;

      for (let y = 0; y < H; y += 3) {
        const lum = getLum(x, y);
        sumLum += lum;

        if (x > 0 && x < W - 1) {
          const lumL = getLum(x - 1, y);
          const lumR = getLum(x + 1, y);
          edgeEnergy += Math.abs(lumR - lumL);
        }
        count++;
      }

      const meanLum = sumLum / count;
      const avgEdge = edgeEnergy / count;

      // Calculate variance
      for (let y = 0; y < H; y += 6) {
        const lum = getLum(x, y);
        sumSqDiff += (lum - meanLum) ** 2;
      }
      const variance = Math.sqrt(sumSqDiff / (count / 2));

      let score = 0;
      if (isLightGutterMode) {
        // High brightness, low variance along the seam, and low edge energy across it
        score = meanLum * 1.5 - variance * 0.8 - avgEdge * 0.5;
      } else {
        // Uniform color valley or strong edge divider
        score = -variance * 1.2 - avgEdge * 0.6;
      }

      // Distance penalty from nominal position so we don't drift too far
      const distFromNominal = Math.abs(x - nominalX) / colSearchWindow;
      score -= distFromNominal * 25;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }

    const splitRatio = Math.round((bestX / W) * 10000) / 10000;
    detectedCols.push(splitRatio);
  }

  // 2. Detect Horizontal Dividers (Row Splits)
  const detectedRows: number[] = [];
  const rowNominalH = H / rows;
  const rowSearchWindow = Math.max(6, Math.min(60, Math.floor(rowNominalH * 0.22)));

  for (let j = 1; j < rows; j++) {
    const nominalY = Math.round(j * rowNominalH);
    const startY = Math.max(j === 1 ? 5 : Math.round(detectedRows[j - 2] * H + 10), nominalY - rowSearchWindow);
    const endY = Math.min(H - (rows - j) * 10, nominalY + rowSearchWindow);

    let bestY = nominalY;
    let bestScore = -Infinity;

    let maxLumObserved = 0;
    for (let sampleY = startY; sampleY <= endY; sampleY += 2) {
      let sumLum = 0;
      let count = 0;
      for (let x = 0; x < W; x += 4) {
        sumLum += getLum(x, sampleY);
        count++;
      }
      const avg = sumLum / count;
      if (avg > maxLumObserved) maxLumObserved = avg;
    }

    const isLightGutterMode = maxLumObserved > 210;

    for (let y = startY; y <= endY; y++) {
      let sumLum = 0;
      let sumSqDiff = 0;
      let edgeEnergy = 0;
      let count = 0;

      for (let x = 0; x < W; x += 3) {
        const lum = getLum(x, y);
        sumLum += lum;

        if (y > 0 && y < H - 1) {
          const lumT = getLum(x, y - 1);
          const lumB = getLum(x, y + 1);
          edgeEnergy += Math.abs(lumB - lumT);
        }
        count++;
      }

      const meanLum = sumLum / count;
      const avgEdge = edgeEnergy / count;

      for (let x = 0; x < W; x += 6) {
        const lum = getLum(x, y);
        sumSqDiff += (lum - meanLum) ** 2;
      }
      const variance = Math.sqrt(sumSqDiff / (count / 2));

      let score = 0;
      if (isLightGutterMode) {
        score = meanLum * 1.5 - variance * 0.8 - avgEdge * 0.5;
      } else {
        score = -variance * 1.2 - avgEdge * 0.6;
      }

      const distFromNominal = Math.abs(y - nominalY) / rowSearchWindow;
      score -= distFromNominal * 25;

      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }

    const splitRatio = Math.round((bestY / H) * 10000) / 10000;
    detectedRows.push(splitRatio);
  }

  return {
    colSplits: normalizeSplits(detectedCols, cols),
    rowSplits: normalizeSplits(detectedRows, rows),
  };
}
