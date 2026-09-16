import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
  Settings2,
  Move,
  Crop,
  Maximize2,
  RotateCcw,
  Scan,
  Info,
  Zap,
  Gauge,
  FastForward,
  Pipette,
  Check,
  AlertTriangle,
  AlertCircle,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  SplitSquareVertical,
  Wand2,
  Target,
  RefreshCcw,
  Minimize2,
  LayoutGrid,
  Grid,
  Lock,
  Unlock,
  CheckCheck,
  Square,
} from 'lucide-react';
import { GridConfig, GridPreset, GridCropArea, CellOverride, SlicerLayoutMode } from '../../types';
import {
  removeBackgroundFromFrame,
  applyWhiteOutline,
  cleanEdgeBlackBordersAndMargins,
  rgbToHex,
} from '../../utils/gifProcessor';
import {
  getDefaultSplits,
  normalizeSplits,
  getColWidthsPercent,
  getRowHeightsPercent,
  calculateCellBounds,
  autoDetectGridSplits,
  getIndependentBoxesFromGrid,
  calculateGridAspectFactor,
  calibrateGridCropAreaToSquare,
  calibrateIndependentBoxToSquare,
  calibrateAllIndependentBoxesToSquare,
} from '../../utils/gridGeometry';
import { GridMagnifierLens, MagnifierData } from './GridMagnifierLens';

interface GridSlicerControlsProps {
  videoUrl: string;
  videoFile: File;
  config: GridConfig;
  onConfigChange: (config: GridConfig) => void;
  onStartSlice: (videoElement: HTMLVideoElement) => void;
  isSlicing: boolean;
  sliceProgress: number;
  sliceStatusText: string;
  onResetVideo: () => void;
}

export const GridSlicerControls: React.FC<GridSlicerControlsProps> = ({
  videoUrl,
  videoFile,
  config,
  onConfigChange,
  onStartSlice,
  isSlicing,
  sliceProgress,
  sliceStatusText,
  onResetVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const inspectCanvasRef = useRef<HTMLCanvasElement>(null);
  const inspectOriginalCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenLiveCanvas = useRef<HTMLCanvasElement | null>(null);
  const offscreenInspectCanvas = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [adjustmentTab, setAdjustmentTab] = useState<'margins' | 'coords'>('margins');
  const [showGridOverlay, setShowGridOverlay] = useState(true);

  // Real-time Matting & Transparency Inspector States
  const [showLiveMatting, setShowLiveMatting] = useState<boolean>(true);
  const [previewBg, setPreviewBg] = useState<'checkerboard' | 'dark' | 'chatGreen' | 'chatGray'>('checkerboard');
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const [inspectCellIndex, setInspectCellIndex] = useState<number>(0);
  const [inspectViewMode, setInspectViewMode] = useState<'processed' | 'original' | 'split'>('processed');
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [cellStats, setCellStats] = useState<{
    transparentPercent: number;
    health: 'good' | 'low' | 'high';
  }>({
    transparentPercent: 0,
    health: 'good',
  });

  const cropBoxRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeDraggingSplit, setActiveDraggingSplit] = useState<{
    type: 'col' | 'row';
    index: number;
  } | null>(null);
  const [autoAlignToast, setAutoAlignToast] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Real-time Precision Edge Magnifier States
  const [enableMagnifier, setEnableMagnifier] = useState<boolean>(true);
  const [magnifierZoom, setMagnifierZoom] = useState<number>(3.5);
  const [magnifierData, setMagnifierData] = useState<MagnifierData | null>(null);

  // Active cropArea with fallback
  const cropArea: GridCropArea = config.cropArea || { x: 0, y: 0, width: 100, height: 100 };
  const currentSpeed = config.speed || 1.0;
  const rawClipDuration = Math.max(0.1, config.endTime - config.startTime);
  const effectiveStickerDuration = rawClipDuration / currentSpeed;

  const totalCells = config.cols * config.rows;
  const layoutMode: SlicerLayoutMode = config.layoutMode || 'grid';

  // Normalized splits & column/row percentages
  const validColSplits = normalizeSplits(config.colSplits, config.cols);
  const validRowSplits = normalizeSplits(config.rowSplits, config.rows);
  const colPercents = getColWidthsPercent(config.colSplits, config.cols);
  const rowPercents = getRowHeightsPercent(config.rowSplits, config.rows);

  // 1:1 Square Lock State (Default true per user specification)
  const isLockSquare = config.lockSquare !== false;

  const vidW = videoDimensions.width || 960;
  const vidH = videoDimensions.height || 960;

  // Single cell pixel calculation in grid mode
  const gridCellPixelW = Math.round(((cropArea.width / 100) * vidW) / Math.max(1, config.cols));
  const gridCellPixelH = Math.round(((cropArea.height / 100) * vidH) / Math.max(1, config.rows));
  const isGridExactSquare = Math.abs(gridCellPixelW - gridCellPixelH) <= 1;

  // Compute current independent boxes with fallback from grid
  const currentIndependentBoxes = config.independentBoxes || getIndependentBoxesFromGrid(
    cropArea,
    config.cols,
    config.rows,
    config.colSplits,
    config.rowSplits,
    config.cellOverrides,
    videoDimensions.width,
    videoDimensions.height
  );

  // Toggle 1:1 Square Lock Switch
  const handleToggleLockSquare = () => {
    const nextVal = !isLockSquare;
    if (nextVal) {
      if (layoutMode === 'independent') {
        const calibrated = calibrateAllIndependentBoxesToSquare(currentIndependentBoxes, vidW, vidH);
        onConfigChange({
          ...config,
          lockSquare: true,
          independentBoxes: calibrated,
        });
      } else {
        const calibratedCrop = calibrateGridCropAreaToSquare(cropArea, config.cols, config.rows, vidW, vidH);
        onConfigChange({
          ...config,
          lockSquare: true,
          cropArea: calibratedCrop,
        });
      }
      setAutoAlignToast({
        message: '🔒 已开启 1:1 正方形锁定并自动矫正，拖拽缩放时将严格等比联动！',
        type: 'success',
      });
    } else {
      onConfigChange({
        ...config,
        lockSquare: false,
      });
      setAutoAlignToast({
        message: '🔓 已解锁 1:1 限制，当前可自由拉伸长宽比',
        type: 'info',
      });
    }
    setTimeout(() => setAutoAlignToast(null), 3000);
  };

  // One-Click Calibrate to 1:1 Square
  const handleOneClickCorrectSquare = () => {
    if (layoutMode === 'independent') {
      const calibrated = calibrateAllIndependentBoxesToSquare(currentIndependentBoxes, vidW, vidH);
      onConfigChange({
        ...config,
        lockSquare: true,
        independentBoxes: calibrated,
      });
      setAutoAlignToast({
        message: `✨ 已一键矫正所有 ${totalCells} 个独立小方块为严格 1:1 正方形并锁定！`,
        type: 'success',
      });
    } else {
      const calibratedCrop = calibrateGridCropAreaToSquare(cropArea, config.cols, config.rows, vidW, vidH);
      onConfigChange({
        ...config,
        lockSquare: true,
        cropArea: calibratedCrop,
      });
      const cellW = Math.round(((calibratedCrop.width / 100) * vidW) / Math.max(1, config.cols));
      const cellH = Math.round(((calibratedCrop.height / 100) * vidH) / Math.max(1, config.rows));
      setAutoAlignToast({
        message: `✨ 已一键矫正整网格为严格 1:1 正方形 (单格: ${cellW}×${cellH} px) 并开启锁定！`,
        type: 'success',
      });
    }
    setTimeout(() => setAutoAlignToast(null), 3000);
  };

  // Switch between connected 'grid' mode and 'independent' boxes mode
  const handleSwitchLayoutMode = (newMode: SlicerLayoutMode) => {
    if (newMode === 'independent') {
      const boxes = config.independentBoxes && Object.keys(config.independentBoxes).length > 0
        ? config.independentBoxes
        : getIndependentBoxesFromGrid(
            cropArea,
            config.cols,
            config.rows,
            config.colSplits,
            config.rowSplits,
            config.cellOverrides,
            videoDimensions.width,
            videoDimensions.height
          );
      onConfigChange({
        ...config,
        layoutMode: 'independent',
        independentBoxes: boxes,
      });
      setAutoAlignToast({
        message: `已切换为独立小方块模式：共 ${totalCells} 个独立选框，均可单独拖拽与拉伸调整大小！`,
        type: 'success',
      });
      setTimeout(() => setAutoAlignToast(null), 3500);
    } else {
      onConfigChange({
        ...config,
        layoutMode: 'grid',
      });
      setAutoAlignToast({
        message: '已切换为连通整网格模式',
        type: 'info',
      });
      setTimeout(() => setAutoAlignToast(null), 2500);
    }
  };

  // Re-initialize independent boxes from current grid alignment
  const handleResetIndependentBoxesFromGrid = () => {
    const boxes = getIndependentBoxesFromGrid(
      cropArea,
      config.cols,
      config.rows,
      config.colSplits,
      config.rowSplits,
      config.cellOverrides,
      videoDimensions.width,
      videoDimensions.height
    );
    onConfigChange({
      ...config,
      layoutMode: 'independent',
      independentBoxes: boxes,
    });
    setAutoAlignToast({
      message: '已根据当前网格排布重新对齐所有独立小方块',
      type: 'success',
    });
    setTimeout(() => setAutoAlignToast(null), 2500);
  };

  // Unify dimensions of all independent boxes to match currently selected box
  const handleUnifyBoxSizes = () => {
    const safeIdx = Math.max(0, Math.min(totalCells - 1, inspectCellIndex));
    const base = currentIndependentBoxes[safeIdx] || {
      x: 0,
      y: 0,
      width: 100 / config.cols,
      height: 100 / config.rows,
    };
    const updated: Record<number, GridCropArea> = {};
    for (let i = 0; i < totalCells; i++) {
      const prev = currentIndependentBoxes[i] || {
        x: (i % config.cols) * base.width,
        y: Math.floor(i / config.cols) * base.height,
        width: base.width,
        height: base.height,
      };
      updated[i] = {
        ...prev,
        width: Math.max(2, Math.min(100, Math.round(base.width * 100) / 100)),
        height: Math.max(2, Math.min(100, Math.round(base.height * 100) / 100)),
      };
    }
    onConfigChange({
      ...config,
      layoutMode: 'independent',
      independentBoxes: updated,
    });
    setAutoAlignToast({
      message: `已将所有小方块的尺寸统一对齐为第 ${(safeIdx + 1).toString().padStart(2, '0')} 格的尺寸 (${base.width.toFixed(1)}% × ${base.height.toFixed(1)}%)`,
      type: 'success',
    });
    setTimeout(() => setAutoAlignToast(null), 3000);
  };

  // Pointer drag & resize for independent boxes
  const handleIndependentBoxPointerDown = (
    e: React.PointerEvent,
    idx: number,
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setInspectCellIndex(idx);

    const container = videoContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const boxes = currentIndependentBoxes;
    const initialBox = boxes[idx] || {
      x: (idx % config.cols) * (100 / config.cols),
      y: Math.floor(idx / config.cols) * (100 / config.rows),
      width: 100 / config.cols,
      height: 100 / config.rows,
    };

    const startX = e.clientX;
    const startY = e.clientY;
    const boxAspect = vidW / vidH; // box.height = box.width * boxAspect for 1:1 pixel square

    const getFocalCoords = (
      b: { x: number; y: number; width: number; height: number },
      m: string,
      clientX?: number,
      clientY?: number
    ) => {
      let focalNormX = b.x;
      let focalNormY = b.y;
      if (m === 'nw') {
        focalNormX = b.x;
        focalNormY = b.y;
      } else if (m === 'ne') {
        focalNormX = b.x + b.width;
        focalNormY = b.y;
      } else if (m === 'se') {
        focalNormX = b.x + b.width;
        focalNormY = b.y + b.height;
      } else if (m === 'sw') {
        focalNormX = b.x;
        focalNormY = b.y + b.height;
      } else if (m === 'n') {
        focalNormX = b.x + b.width / 2;
        focalNormY = b.y;
      } else if (m === 's') {
        focalNormX = b.x + b.width / 2;
        focalNormY = b.y + b.height;
      } else if (m === 'w') {
        focalNormX = b.x;
        focalNormY = b.y + b.height / 2;
      } else if (m === 'e') {
        focalNormX = b.x + b.width;
        focalNormY = b.y + b.height / 2;
      } else if (m === 'move' && clientX !== undefined && clientY !== undefined) {
        focalNormX = Math.max(0, Math.min(100, ((clientX - containerRect.left) / containerRect.width) * 100));
        focalNormY = Math.max(0, Math.min(100, ((clientY - containerRect.top) / containerRect.height) * 100));
      }
      return { focalNormX, focalNormY };
    };

    if (enableMagnifier) {
      const { focalNormX, focalNormY } = getFocalCoords(initialBox, mode, e.clientX, e.clientY);
      const curPixelW = Math.round((initialBox.width / 100) * vidW);
      const curPixelH = Math.round((initialBox.height / 100) * vidH);
      setMagnifierData({
        active: true,
        clientX: e.clientX,
        clientY: e.clientY,
        focalNormX,
        focalNormY,
        handle: mode,
        cellIndex: idx,
        boxPixelW: curPixelW,
        boxPixelH: curPixelH,
        isSquare: Math.abs(curPixelW - curPixelH) <= 1,
      });
    }

    const onPointerMove = (moveEv: PointerEvent) => {
      const deltaXPct = ((moveEv.clientX - startX) / containerRect.width) * 100;
      const deltaYPct = ((moveEv.clientY - startY) / containerRect.height) * 100;

      let newBox = { ...initialBox };

      if (mode === 'move') {
        newBox.x = Math.max(0, Math.min(100 - initialBox.width, initialBox.x + deltaXPct));
        newBox.y = Math.max(0, Math.min(100 - initialBox.height, initialBox.y + deltaYPct));
      } else if (isLockSquare) {
        // Locked 1:1 square proportional linkage
        if (mode === 'se') {
          let targetW = Math.max(2, Math.min(100 - initialBox.x, initialBox.width + deltaXPct));
          let targetH = targetW * boxAspect;
          if (initialBox.y + targetH > 100) {
            targetH = 100 - initialBox.y;
            targetW = targetH / boxAspect;
          }
          newBox.width = targetW;
          newBox.height = targetH;
        } else if (mode === 'sw') {
          const right = initialBox.x + initialBox.width;
          let targetW = Math.max(2, Math.min(right, initialBox.width - deltaXPct));
          let targetH = targetW * boxAspect;
          if (initialBox.y + targetH > 100) {
            targetH = 100 - initialBox.y;
            targetW = targetH / boxAspect;
          }
          newBox.width = targetW;
          newBox.height = targetH;
          newBox.x = right - targetW;
        } else if (mode === 'ne') {
          const bottom = initialBox.y + initialBox.height;
          let targetW = Math.max(2, Math.min(100 - initialBox.x, initialBox.width + deltaXPct));
          let targetH = targetW * boxAspect;
          if (bottom - targetH < 0) {
            targetH = bottom;
            targetW = targetH / boxAspect;
          }
          newBox.width = targetW;
          newBox.height = targetH;
          newBox.y = bottom - targetH;
        } else if (mode === 'nw') {
          const right = initialBox.x + initialBox.width;
          const bottom = initialBox.y + initialBox.height;
          let targetW = Math.max(2, Math.min(right, initialBox.width - deltaXPct));
          let targetH = targetW * boxAspect;
          if (bottom - targetH < 0) {
            targetH = bottom;
            targetW = targetH / boxAspect;
          }
          newBox.width = targetW;
          newBox.height = targetH;
          newBox.x = right - targetW;
          newBox.y = bottom - targetH;
        } else if (mode === 'e' || mode === 'w') {
          let targetW = mode === 'e'
            ? Math.max(2, Math.min(100 - initialBox.x, initialBox.width + deltaXPct))
            : Math.max(2, Math.min(initialBox.x + initialBox.width, initialBox.width - deltaXPct));
          let targetH = targetW * boxAspect;
          if (targetH > 100) {
            targetH = 100;
            targetW = targetH / boxAspect;
          }
          const centerY = initialBox.y + initialBox.height / 2;
          newBox.width = targetW;
          newBox.height = targetH;
          newBox.y = Math.max(0, Math.min(100 - targetH, centerY - targetH / 2));
          if (mode === 'w') {
            newBox.x = (initialBox.x + initialBox.width) - targetW;
          }
        } else if (mode === 's' || mode === 'n') {
          let targetH = mode === 's'
            ? Math.max(2, Math.min(100 - initialBox.y, initialBox.height + deltaYPct))
            : Math.max(2, Math.min(initialBox.y + initialBox.height, initialBox.height - deltaYPct));
          let targetW = targetH / boxAspect;
          if (targetW > 100) {
            targetW = 100;
            targetH = targetW * boxAspect;
          }
          const centerX = initialBox.x + initialBox.width / 2;
          newBox.height = targetH;
          newBox.width = targetW;
          newBox.x = Math.max(0, Math.min(100 - targetW, centerX - targetW / 2));
          if (mode === 'n') {
            newBox.y = (initialBox.y + initialBox.height) - targetH;
          }
        }
      } else {
        if (mode.includes('w')) {
          const right = initialBox.x + initialBox.width;
          const proposedX = Math.max(0, Math.min(right - 2, initialBox.x + deltaXPct));
          newBox.x = proposedX;
          newBox.width = right - proposedX;
        }
        if (mode.includes('e')) {
          const proposedW = Math.max(2, Math.min(100 - initialBox.x, initialBox.width + deltaXPct));
          newBox.width = proposedW;
        }
        if (mode.includes('n')) {
          const bottom = initialBox.y + initialBox.height;
          const proposedY = Math.max(0, Math.min(bottom - 2, initialBox.y + deltaYPct));
          newBox.y = proposedY;
          newBox.height = bottom - proposedY;
        }
        if (mode.includes('s')) {
          const proposedH = Math.max(2, Math.min(100 - initialBox.y, initialBox.height + deltaYPct));
          newBox.height = proposedH;
        }
      }

      newBox.x = Math.round(newBox.x * 100) / 100;
      newBox.y = Math.round(newBox.y * 100) / 100;
      newBox.width = Math.round(newBox.width * 100) / 100;
      newBox.height = Math.round(newBox.height * 100) / 100;

      const updated = { ...boxes, [idx]: newBox };
      onConfigChange({
        ...config,
        layoutMode: 'independent',
        independentBoxes: updated,
      });

      if (enableMagnifier) {
        const { focalNormX, focalNormY } = getFocalCoords(newBox, mode, moveEv.clientX, moveEv.clientY);
        const curPixelW = Math.round((newBox.width / 100) * vidW);
        const curPixelH = Math.round((newBox.height / 100) * vidH);
        setMagnifierData({
          active: true,
          clientX: moveEv.clientX,
          clientY: moveEv.clientY,
          focalNormX,
          focalNormY,
          handle: mode,
          cellIndex: idx,
          boxPixelW: curPixelW,
          boxPixelH: curPixelH,
          isSquare: Math.abs(curPixelW - curPixelH) <= 1,
        });
      }
    };

    const onPointerUp = () => {
      setMagnifierData(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Numerical update for active independent box
  const handleUpdateActiveBox = (partial: Partial<GridCropArea>) => {
    const safeIdx = Math.max(0, Math.min(totalCells - 1, inspectCellIndex));
    const boxes = currentIndependentBoxes;
    const current = boxes[safeIdx] || {
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    };
    const boxAspect = vidW / vidH;

    let targetW = Math.max(2, Math.min(100, partial.width !== undefined ? partial.width : current.width));
    let targetH = Math.max(2, Math.min(100, partial.height !== undefined ? partial.height : current.height));

    if (isLockSquare) {
      if (partial.width !== undefined && partial.height === undefined) {
        targetH = Math.max(2, Math.min(100, Math.round(targetW * boxAspect * 10) / 10));
      } else if (partial.height !== undefined && partial.width === undefined) {
        targetW = Math.max(2, Math.min(100, Math.round((targetH / boxAspect) * 10) / 10));
      }
    }

    const updatedBox: GridCropArea = {
      x: Math.max(0, Math.min(100 - targetW, partial.x !== undefined ? partial.x : current.x)),
      y: Math.max(0, Math.min(100 - targetH, partial.y !== undefined ? partial.y : current.y)),
      width: targetW,
      height: targetH,
    };
    onConfigChange({
      ...config,
      layoutMode: 'independent',
      independentBoxes: {
        ...boxes,
        [safeIdx]: updatedBox,
      },
    });
  };

  const handleStepActiveBox = (key: keyof GridCropArea, deltaPct: number) => {
    const safeIdx = Math.max(0, Math.min(totalCells - 1, inspectCellIndex));
    const current = currentIndependentBoxes[safeIdx] || {
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    };
    handleUpdateActiveBox({
      [key]: Math.round((current[key] + deltaPct) * 100) / 100,
    });
  };

  // Dragging internal divider lines (Tier 2)
  const handleSplitPointerDown = (e: React.PointerEvent, type: 'col' | 'row', index: number) => {
    e.stopPropagation();
    e.preventDefault();

    const cropEl = cropBoxRef.current;
    if (!cropEl) return;
    const cropRect = cropEl.getBoundingClientRect();

    setActiveDraggingSplit({ type, index });

    const startCoord = type === 'col' ? e.clientX : e.clientY;
    const splits = type === 'col' ? [...validColSplits] : [...validRowSplits];
    const initialRatio = splits[index];

    const onPointerMove = (moveEv: PointerEvent) => {
      if (type === 'col') {
        const deltaPx = moveEv.clientX - startCoord;
        const deltaRatio = deltaPx / cropRect.width;
        let newRatio = initialRatio + deltaRatio;

        const minPrev = index === 0 ? 0.02 : splits[index - 1] + 0.02;
        const maxNext = index === splits.length - 1 ? 0.98 : splits[index + 1] - 0.02;
        newRatio = Math.max(minPrev, Math.min(maxNext, newRatio));

        const updated = [...splits];
        updated[index] = Math.round(newRatio * 1000) / 1000;
        onConfigChange({
          ...config,
          colSplits: updated,
        });
      } else {
        const deltaPx = moveEv.clientY - startCoord;
        const deltaRatio = deltaPx / cropRect.height;
        let newRatio = initialRatio + deltaRatio;

        const minPrev = index === 0 ? 0.02 : splits[index - 1] + 0.02;
        const maxNext = index === splits.length - 1 ? 0.98 : splits[index + 1] - 0.02;
        newRatio = Math.max(minPrev, Math.min(maxNext, newRatio));

        const updated = [...splits];
        updated[index] = Math.round(newRatio * 1000) / 1000;
        onConfigChange({
          ...config,
          rowSplits: updated,
        });
      }
    };

    const onPointerUp = () => {
      setActiveDraggingSplit(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Smart Auto-align / Snap to gutters (Tier 1)
  const handleAutoAlignSplits = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 960;
    const vh = video.videoHeight || 960;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = vw;
    offCanvas.height = vh;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    offCtx.drawImage(video, 0, 0, vw, vh);
    const detected = autoDetectGridSplits(offCtx, vw, vh, cropArea, config.cols, config.rows);

    onConfigChange({
      ...config,
      colSplits: detected.colSplits,
      rowSplits: detected.rowSplits,
    });
    setAutoAlignToast({
      message: '✨ 已智能对齐视频当前帧各格分割线至内容缝隙！',
      type: 'success',
    });
    setTimeout(() => setAutoAlignToast(null), 3000);
  };

  const handleResetSplits = () => {
    onConfigChange({
      ...config,
      colSplits: getDefaultSplits(config.cols),
      rowSplits: getDefaultSplits(config.rows),
    });
    setAutoAlignToast({
      message: '已恢复均匀等距分割线',
      type: 'info',
    });
    setTimeout(() => setAutoAlignToast(null), 2500);
  };

  // Single-Cell Micro Offset & Dimension Fine-Tuning (Tier 3)
  const currentCellOverride = config.cellOverrides?.[inspectCellIndex] || { dx: 0, dy: 0, dw: 0, dh: 0 };

  const handleUpdateOverride = (field: keyof CellOverride, value: number) => {
    const prev = config.cellOverrides?.[inspectCellIndex] || { dx: 0, dy: 0, dw: 0, dh: 0 };
    const updated = { ...prev, [field]: value };
    const isZero = (updated.dx || 0) === 0 && (updated.dy || 0) === 0 && (updated.dw || 0) === 0 && (updated.dh || 0) === 0;

    const newOverrides = { ...(config.cellOverrides || {}) };
    if (isZero) {
      delete newOverrides[inspectCellIndex];
    } else {
      newOverrides[inspectCellIndex] = updated;
    }

    onConfigChange({
      ...config,
      cellOverrides: newOverrides,
    });
  };

  const handleResetCurrentOverride = () => {
    if (!config.cellOverrides?.[inspectCellIndex]) return;
    const newOverrides = { ...(config.cellOverrides || {}) };
    delete newOverrides[inspectCellIndex];
    onConfigChange({
      ...config,
      cellOverrides: newOverrides,
    });
  };

  const handleResetAllOverrides = () => {
    onConfigChange({
      ...config,
      cellOverrides: {},
    });
  };

  // Keyboard shortcut listener for ESC (fullscreen) and micro-tuning active cell / independent box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        e.preventDefault();
        return;
      }

      let handled = false;

      if (config.layoutMode === 'independent') {
        const delta = e.shiftKey ? 2 : 0.5;
        if (e.altKey) {
          // Resize width/height
          if (e.key === 'ArrowLeft') {
            handleStepActiveBox('width', -delta);
            handled = true;
          } else if (e.key === 'ArrowRight') {
            handleStepActiveBox('width', delta);
            handled = true;
          } else if (e.key === 'ArrowUp') {
            handleStepActiveBox('height', -delta);
            handled = true;
          } else if (e.key === 'ArrowDown') {
            handleStepActiveBox('height', delta);
            handled = true;
          }
        } else {
          // Move x/y
          if (e.key === 'ArrowLeft') {
            handleStepActiveBox('x', -delta);
            handled = true;
          } else if (e.key === 'ArrowRight') {
            handleStepActiveBox('x', delta);
            handled = true;
          } else if (e.key === 'ArrowUp') {
            handleStepActiveBox('y', -delta);
            handled = true;
          } else if (e.key === 'ArrowDown') {
            handleStepActiveBox('y', delta);
            handled = true;
          }
        }
      } else {
        const step = e.shiftKey ? 5 : 1;
        const current = config.cellOverrides?.[inspectCellIndex] || { dx: 0, dy: 0, dw: 0, dh: 0 };

        if (e.key === 'ArrowLeft') {
          handleUpdateOverride('dx', Math.max(-50, (current.dx || 0) - step));
          handled = true;
        } else if (e.key === 'ArrowRight') {
          handleUpdateOverride('dx', Math.min(50, (current.dx || 0) + step));
          handled = true;
        } else if (e.key === 'ArrowUp') {
          handleUpdateOverride('dy', Math.max(-50, (current.dy || 0) - step));
          handled = true;
        } else if (e.key === 'ArrowDown') {
          handleUpdateOverride('dy', Math.min(50, (current.dy || 0) + step));
          handled = true;
        }
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectCellIndex, config, isFullscreen]);

  // Calculate current margins (%)
  const marginTop = Math.round(cropArea.y * 10) / 10;
  const marginBottom = Math.round(Math.max(0, 100 - cropArea.y - cropArea.height) * 10) / 10;
  const marginLeft = Math.round(cropArea.x * 10) / 10;
  const marginRight = Math.round(Math.max(0, 100 - cropArea.x - cropArea.width) * 10) / 10;

  // Eyedropper & Color Extraction
  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-expect-error EyeDropper API
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          onConfigChange({ ...config, autoTransparent: true, bgColor: result.sRGBHex });
        }
      } catch {
        // user canceled or unsupported
      }
    } else {
      setIsPickingColor(true);
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPickingColor || !videoContainerRef.current || !videoRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    const video = videoRef.current;
    if (video.videoWidth && video.videoHeight) {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 1;
      sampleCanvas.height = 1;
      const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(
          video,
          normX * video.videoWidth,
          normY * video.videoHeight,
          1,
          1,
          0,
          0,
          1,
          1
        );
        const p = ctx.getImageData(0, 0, 1, 1).data;
        const sampledColor = rgbToHex(p[0], p[1], p[2]);
        onConfigChange({ ...config, autoTransparent: true, bgColor: sampledColor });
      }
    }
    setIsPickingColor(false);
  };

  // Real-time video frame matting renderer
  const renderVideoMattingFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const ca = config.cropArea || { x: 0, y: 0, width: 100, height: 100 };

    const cropX = (ca.x / 100) * vw;
    const cropY = (ca.y / 100) * vh;
    const cropW = (ca.width / 100) * vw;
    const cropH = (ca.height / 100) * vh;

    if (cropW <= 0 || cropH <= 0) return;

    // 1. Render Full Crop Area Live Matting Canvas
    if (showLiveMatting && config.autoTransparent && liveCanvasRef.current) {
      const liveCanvas = liveCanvasRef.current;
      const maxDim = 540;
      const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
      const renderW = Math.max(64, Math.round(cropW * scale));
      const renderH = Math.max(64, Math.round(cropH * scale));

      if (liveCanvas.width !== renderW || liveCanvas.height !== renderH) {
        liveCanvas.width = renderW;
        liveCanvas.height = renderH;
      }

      if (!offscreenLiveCanvas.current) {
        offscreenLiveCanvas.current = document.createElement('canvas');
      }
      const offCanvas = offscreenLiveCanvas.current;
      if (offCanvas.width !== renderW || offCanvas.height !== renderH) {
        offCanvas.width = renderW;
        offCanvas.height = renderH;
      }
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      const liveCtx = liveCanvas.getContext('2d');

      if (offCtx && liveCtx) {
        offCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, renderW, renderH);
        const rawData = offCtx.getImageData(0, 0, renderW, renderH);

        const processed = removeBackgroundFromFrame(rawData, {
          targetColor: config.bgColor || '#ffffff',
          tolerance: config.tolerance || 20,
          contiguous: false,
          defringe: 1,
        });

        if (config.addWhiteOutline) {
          applyWhiteOutline(processed, config.outlineWidth || 2, '#ffffff');
        }

        liveCtx.putImageData(processed, 0, 0);
      }
    }

    // 2. Render Single Selected Cell Inspector (240x240 standard WeChat dimension)
    const cellCols = config.cols || 1;
    const cellRows = config.rows || 1;
    const safeIdx = Math.max(0, Math.min(cellCols * cellRows - 1, inspectCellIndex));
    const cellCol = safeIdx % cellCols;
    const cellRow = Math.floor(safeIdx / cellCols);

    const cellBounds = calculateCellBounds({
      cropX,
      cropY,
      cropW,
      cropH,
      cols: cellCols,
      rows: cellRows,
      col: cellCol,
      row: cellRow,
      cellIndex: safeIdx,
      layoutMode: config.layoutMode,
      independentBox: config.independentBoxes?.[safeIdx],
      colSplits: config.colSplits,
      rowSplits: config.rowSplits,
      cellOverride: config.cellOverrides?.[safeIdx],
      paddingInset: config.paddingInset || 0,
      sourceWidth: vw,
      sourceHeight: vh,
    });

    const singleCellX = cellBounds.sx;
    const singleCellY = cellBounds.sy;
    const singleCellW = cellBounds.sw;
    const singleCellH = cellBounds.sh;

    // Render original frame slice into inspectOriginalCanvasRef
    if (inspectOriginalCanvasRef.current) {
      const origCanvas = inspectOriginalCanvasRef.current;
      if (origCanvas.width !== 240 || origCanvas.height !== 240) {
        origCanvas.width = 240;
        origCanvas.height = 240;
      }
      const origCtx = origCanvas.getContext('2d');
      if (origCtx) {
        origCtx.clearRect(0, 0, 240, 240);
        origCtx.drawImage(video, singleCellX, singleCellY, singleCellW, singleCellH, 0, 0, 240, 240);
      }
    }

    // Render processed matting frame slice into inspectCanvasRef
    if (inspectCanvasRef.current) {
      const inspCanvas = inspectCanvasRef.current;
      if (inspCanvas.width !== 240 || inspCanvas.height !== 240) {
        inspCanvas.width = 240;
        inspCanvas.height = 240;
      }
      const inspCtx = inspCanvas.getContext('2d');
      if (inspCtx) {
        if (!offscreenInspectCanvas.current) {
          offscreenInspectCanvas.current = document.createElement('canvas');
          offscreenInspectCanvas.current.width = 240;
          offscreenInspectCanvas.current.height = 240;
        }
        const offInsp = offscreenInspectCanvas.current;
        const offInspCtx = offInsp.getContext('2d', { willReadFrequently: true });
        if (offInspCtx) {
          offInspCtx.clearRect(0, 0, 240, 240);
          offInspCtx.drawImage(video, singleCellX, singleCellY, singleCellW, singleCellH, 0, 0, 240, 240);
          const cellRawData = offInspCtx.getImageData(0, 0, 240, 240);

          // Clean contiguous edge black bars and padding margins
          cleanEdgeBlackBordersAndMargins(cellRawData, 32);

          if (config.autoTransparent) {
            const cellProcessed = removeBackgroundFromFrame(cellRawData, {
              targetColor: config.bgColor || '#ffffff',
              tolerance: config.tolerance || 20,
              contiguous: false,
              defringe: 1,
            });

            if (config.addWhiteOutline) {
              applyWhiteOutline(cellProcessed, config.outlineWidth || 2, '#ffffff');
            }

            const data = cellProcessed.data;
            let transparentCount = 0;
            const totalPx = 240 * 240;
            for (let i = 0; i < totalPx; i++) {
              if (data[i * 4 + 3] === 0) transparentCount++;
            }
            const tPercent = Math.round((transparentCount / totalPx) * 100);
            const health = tPercent < 10 ? 'low' : tPercent > 82 ? 'high' : 'good';
            setCellStats({ transparentPercent: tPercent, health });

            inspCtx.putImageData(cellProcessed, 0, 0);
          } else {
            let transparentCount = 0;
            const totalPx = 240 * 240;
            for (let i = 0; i < totalPx; i++) {
              if (cellRawData.data[i * 4 + 3] === 0) transparentCount++;
            }
            const tPercent = Math.round((transparentCount / totalPx) * 100);
            const health = tPercent < 10 ? 'low' : tPercent > 82 ? 'high' : 'good';
            setCellStats({ transparentPercent: tPercent, health });

            inspCtx.putImageData(cellRawData, 0, 0);
          }
        }
      }
    }
  }, [
    config.cropArea,
    config.autoTransparent,
    config.bgColor,
    config.tolerance,
    config.addWhiteOutline,
    config.outlineWidth,
    config.cols,
    config.rows,
    config.colSplits,
    config.rowSplits,
    config.cellOverrides,
    config.layoutMode,
    config.independentBoxes,
    config.paddingInset,
    showLiveMatting,
    inspectCellIndex,
  ]);

  // Video playback frame animation loop
  useEffect(() => {
    let animationId: number;
    let lastTime = 0;
    const fpsInterval = 1000 / 24;

    const loop = (timestamp: number) => {
      if (timestamp - lastTime >= fpsInterval) {
        lastTime = timestamp;
        renderVideoMattingFrame();
      }
      if (isPlaying) {
        animationId = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(loop);
    } else {
      renderVideoMattingFrame();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isPlaying, renderVideoMattingFrame]);

  // Synchronize video playbackRate whenever config.speed changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = currentSpeed;
    }
  }, [currentSpeed]);

  // Handle video loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = currentSpeed;
      const dur = videoRef.current.duration || 3;
      setDuration(dur);
      const vw = videoRef.current.videoWidth || 960;
      const vh = videoRef.current.videoHeight || 960;
      setVideoDimensions({ width: vw, height: vh });
      if (config.endTime === 0 || config.endTime > dur) {
        onConfigChange({ ...config, endTime: Math.min(dur, 3.5) });
      }
      setTimeout(() => renderVideoMattingFrame(), 60);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.playbackRate = currentSpeed;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    const clamped = Math.round(Math.max(0.5, Math.min(4.0, newSpeed)) * 100) / 100;
    onConfigChange({ ...config, speed: clamped });
    if (videoRef.current) {
      videoRef.current.playbackRate = clamped;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (!isPlaying) {
        renderVideoMattingFrame();
      }
      // Loop within trim range
      if (time >= config.endTime) {
        videoRef.current.currentTime = config.startTime;
      }
    }
  };

  const setPreset = (preset: GridPreset) => {
    let cols = 4;
    let rows = 4;
    if (preset === '16') {
      cols = 4; rows = 4;
    } else if (preset === '15') {
      cols = 5; rows = 3;
    } else if (preset === '9') {
      cols = 3; rows = 3;
    } else if (preset === '20') {
      cols = 5; rows = 4;
    } else {
      cols = config.cols; rows = config.rows;
    }

    onConfigChange({
      ...config,
      preset,
      cols,
      rows,
      colSplits: getDefaultSplits(cols),
      rowSplits: getDefaultSplits(rows),
      cellOverrides: {},
    });
  };

  // Helper to update cropArea directly
  const updateCrop = (newCrop: Partial<GridCropArea>) => {
    const gridFactor = calculateGridAspectFactor(config.cols, config.rows, vidW, vidH);
    let targetW = Math.max(5, Math.min(100, newCrop.width !== undefined ? newCrop.width : cropArea.width));
    let targetH = Math.max(5, Math.min(100, newCrop.height !== undefined ? newCrop.height : cropArea.height));

    if (isLockSquare) {
      if (newCrop.width !== undefined && newCrop.height === undefined) {
        targetH = Math.max(5, Math.min(100, Math.round(targetW * gridFactor * 10) / 10));
      } else if (newCrop.height !== undefined && newCrop.width === undefined) {
        targetW = Math.max(5, Math.min(100, Math.round((targetH / gridFactor) * 10) / 10));
      }
    }

    const updated: GridCropArea = {
      x: Math.max(0, Math.min(100 - targetW, newCrop.x !== undefined ? newCrop.x : cropArea.x)),
      y: Math.max(0, Math.min(100 - targetH, newCrop.y !== undefined ? newCrop.y : cropArea.y)),
      width: targetW,
      height: targetH,
    };
    onConfigChange({ ...config, cropArea: updated });
  };

  // Helper to update margins (Top, Bottom, Left, Right)
  const updateMargin = (side: 'top' | 'bottom' | 'left' | 'right', value: number) => {
    const val = Math.max(0, Math.min(85, value));
    if (side === 'top') {
      const maxTop = 100 - marginBottom - 5;
      const safeTop = Math.min(maxTop, val);
      const newHeight = Math.max(5, 100 - safeTop - marginBottom);
      updateCrop({ y: safeTop, height: newHeight });
    } else if (side === 'bottom') {
      const maxBottom = 100 - marginTop - 5;
      const safeBottom = Math.min(maxBottom, val);
      const newHeight = Math.max(5, 100 - marginTop - safeBottom);
      updateCrop({ height: newHeight });
    } else if (side === 'left') {
      const maxLeft = 100 - marginRight - 5;
      const safeLeft = Math.min(maxLeft, val);
      const newWidth = Math.max(5, 100 - safeLeft - marginRight);
      updateCrop({ x: safeLeft, width: newWidth });
    } else if (side === 'right') {
      const maxRight = 100 - marginLeft - 5;
      const safeRight = Math.min(maxRight, val);
      const newWidth = Math.max(5, 100 - marginLeft - safeRight);
      updateCrop({ width: newWidth });
    }
  };

  // Reset crop to full screen
  const resetCropToFull = () => {
    onConfigChange({
      ...config,
      cropArea: { x: 0, y: 0, width: 100, height: 100 },
    });
  };

  // Quick preset crop alignments
  const applyCropPreset = (type: 'removeTop30' | 'removeTopBottom15' | 'center80' | 'full') => {
    if (type === 'full') {
      resetCropToFull();
    } else if (type === 'removeTop30') {
      // Specifically helpful for AI video spritesheets with large top black bar/headers
      onConfigChange({
        ...config,
        cropArea: { x: 0, y: 30, width: 100, height: 70 },
      });
    } else if (type === 'removeTopBottom15') {
      onConfigChange({
        ...config,
        cropArea: { x: 0, y: 15, width: 100, height: 70 },
      });
    } else if (type === 'center80') {
      onConfigChange({
        ...config,
        cropArea: { x: 10, y: 10, width: 80, height: 80 },
      });
    }
  };

  // Interactive mouse/touch dragging handler
  const handlePointerDown = (
    e: React.PointerEvent,
    handle: 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoContainerRef.current) return;

    const containerRect = videoContainerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...cropArea };
    const gridFactor = calculateGridAspectFactor(config.cols, config.rows, vidW, vidH);

    const getGridCropFocal = (
      c: { x: number; y: number; width: number; height: number },
      h: string,
      clientX?: number,
      clientY?: number
    ) => {
      let focalNormX = c.x;
      let focalNormY = c.y;
      if (h === 'nw') {
        focalNormX = c.x;
        focalNormY = c.y;
      } else if (h === 'ne') {
        focalNormX = c.x + c.width;
        focalNormY = c.y;
      } else if (h === 'se') {
        focalNormX = c.x + c.width;
        focalNormY = c.y + c.height;
      } else if (h === 'sw') {
        focalNormX = c.x;
        focalNormY = c.y + c.height;
      } else if (h === 'n') {
        focalNormX = c.x + c.width / 2;
        focalNormY = c.y;
      } else if (h === 's') {
        focalNormX = c.x + c.width / 2;
        focalNormY = c.y + c.height;
      } else if (h === 'w') {
        focalNormX = c.x;
        focalNormY = c.y + c.height / 2;
      } else if (h === 'e') {
        focalNormX = c.x + c.width;
        focalNormY = c.y + c.height / 2;
      } else if (h === 'move' && clientX !== undefined && clientY !== undefined) {
        focalNormX = Math.max(0, Math.min(100, ((clientX - containerRect.left) / containerRect.width) * 100));
        focalNormY = Math.max(0, Math.min(100, ((clientY - containerRect.top) / containerRect.height) * 100));
      }
      return { focalNormX, focalNormY };
    };

    if (enableMagnifier) {
      const { focalNormX, focalNormY } = getGridCropFocal(startCrop, handle, e.clientX, e.clientY);
      const cellW = Math.round(((startCrop.width / 100) * vidW) / config.cols);
      const cellH = Math.round(((startCrop.height / 100) * vidH) / config.rows);
      setMagnifierData({
        active: true,
        clientX: e.clientX,
        clientY: e.clientY,
        focalNormX,
        focalNormY,
        handle,
        cellIndex: 0,
        boxPixelW: cellW,
        boxPixelH: cellH,
        isSquare: Math.abs(cellW - cellH) <= 1,
      });
    }

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const deltaXPercent = ((ev.clientX - startX) / containerRect.width) * 100;
      const deltaYPercent = ((ev.clientY - startY) / containerRect.height) * 100;

      let newCrop = { ...startCrop };

      if (handle === 'move') {
        newCrop.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent));
        newCrop.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent));
      } else if (isLockSquare) {
        // Locked 1:1 square proportional linkage for entire grid
        if (handle === 'se') {
          let targetW = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent));
          let targetH = targetW * gridFactor;
          if (startCrop.y + targetH > 100) {
            targetH = 100 - startCrop.y;
            targetW = targetH / gridFactor;
          }
          newCrop.width = targetW;
          newCrop.height = targetH;
        } else if (handle === 'sw') {
          const right = startCrop.x + startCrop.width;
          let targetW = Math.max(5, Math.min(right, startCrop.width - deltaXPercent));
          let targetH = targetW * gridFactor;
          if (startCrop.y + targetH > 100) {
            targetH = 100 - startCrop.y;
            targetW = targetH / gridFactor;
          }
          newCrop.width = targetW;
          newCrop.height = targetH;
          newCrop.x = right - targetW;
        } else if (handle === 'ne') {
          const bottom = startCrop.y + startCrop.height;
          let targetW = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent));
          let targetH = targetW * gridFactor;
          if (bottom - targetH < 0) {
            targetH = bottom;
            targetW = targetH / gridFactor;
          }
          newCrop.width = targetW;
          newCrop.height = targetH;
          newCrop.y = bottom - targetH;
        } else if (handle === 'nw') {
          const right = startCrop.x + startCrop.width;
          const bottom = startCrop.y + startCrop.height;
          let targetW = Math.max(5, Math.min(right, startCrop.width - deltaXPercent));
          let targetH = targetW * gridFactor;
          if (bottom - targetH < 0) {
            targetH = bottom;
            targetW = targetH / gridFactor;
          }
          newCrop.width = targetW;
          newCrop.height = targetH;
          newCrop.x = right - targetW;
          newCrop.y = bottom - targetH;
        } else if (handle === 'e' || handle === 'w') {
          let targetW = handle === 'e'
            ? Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent))
            : Math.max(5, Math.min(startCrop.x + startCrop.width, startCrop.width - deltaXPercent));
          let targetH = targetW * gridFactor;
          if (targetH > 100) {
            targetH = 100;
            targetW = targetH / gridFactor;
          }
          const centerY = startCrop.y + startCrop.height / 2;
          newCrop.width = targetW;
          newCrop.height = targetH;
          newCrop.y = Math.max(0, Math.min(100 - targetH, centerY - targetH / 2));
          if (handle === 'w') {
            newCrop.x = (startCrop.x + startCrop.width) - targetW;
          }
        } else if (handle === 's' || handle === 'n') {
          let targetH = handle === 's'
            ? Math.max(5, Math.min(100 - startCrop.y, startCrop.height + deltaYPercent))
            : Math.max(5, Math.min(startCrop.y + startCrop.height, startCrop.height - deltaYPercent));
          let targetW = targetH / gridFactor;
          if (targetW > 100) {
            targetW = 100;
            targetH = targetW * gridFactor;
          }
          const centerX = startCrop.x + startCrop.width / 2;
          newCrop.height = targetH;
          newCrop.width = targetW;
          newCrop.x = Math.max(0, Math.min(100 - targetW, centerX - targetW / 2));
          if (handle === 'n') {
            newCrop.y = (startCrop.y + startCrop.height) - targetH;
          }
        }
      } else {
        // Vertical adjustments
        if (handle.includes('n')) {
          const clampedY = Math.max(0, Math.min(startCrop.y + startCrop.height - 5, startCrop.y + deltaYPercent));
          newCrop.y = clampedY;
          newCrop.height = startCrop.height - (clampedY - startCrop.y);
        } else if (handle.includes('s')) {
          newCrop.height = Math.max(5, Math.min(100 - startCrop.y, startCrop.height + deltaYPercent));
        }

        // Horizontal adjustments
        if (handle.includes('w')) {
          const clampedX = Math.max(0, Math.min(startCrop.x + startCrop.width - 5, startCrop.x + deltaXPercent));
          newCrop.x = clampedX;
          newCrop.width = startCrop.width - (clampedX - startCrop.x);
        } else if (handle.includes('e')) {
          newCrop.width = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent));
        }
      }

      onConfigChange({
        ...config,
        cropArea: {
          x: Math.round(newCrop.x * 10) / 10,
          y: Math.round(newCrop.y * 10) / 10,
          width: Math.round(newCrop.width * 10) / 10,
          height: Math.round(newCrop.height * 10) / 10,
        },
      });

      if (enableMagnifier) {
        const { focalNormX, focalNormY } = getGridCropFocal(newCrop, handle, ev.clientX, ev.clientY);
        const cellW = Math.round(((newCrop.width / 100) * vidW) / config.cols);
        const cellH = Math.round(((newCrop.height / 100) * vidH) / config.rows);
        setMagnifierData({
          active: true,
          clientX: ev.clientX,
          clientY: ev.clientY,
          focalNormX,
          focalNormY,
          handle,
          cellIndex: 0,
          boxPixelW: cellW,
          boxPixelH: cellH,
          isSquare: Math.abs(cellW - cellH) <= 1,
        });
      }
    };

    const handlePointerUp = () => {
      setMagnifierData(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const isCustomCropActive = cropArea.x !== 0 || cropArea.y !== 0 || cropArea.width !== 100 || cropArea.height !== 100;

  // Real-time calculated pixel dimensions
  const vw = videoDimensions.width || 960;
  const vh = videoDimensions.height || 960;
  const cropPixelW = Math.round((cropArea.width / 100) * vw);
  const cropPixelH = Math.round((cropArea.height / 100) * vh);
  const cellPixelW = Math.round(cropPixelW / config.cols);
  const cellPixelH = Math.round(cropPixelH / config.rows);

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
      {/* Top bar: file info and re-upload */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#07c160] flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <span>{videoFile.name}</span>
              <span className="text-[11px] font-normal text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
              {isCustomCropActive && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  已启用自定义选区调节
                </span>
              )}
            </h3>
            <p className="text-xs text-stone-500">
              视频时长: {duration.toFixed(1)}s • 原始分辨率: {vw} × {vh} • 当前排布: {config.cols} 列 × {config.rows} 行（共 {totalCells} 格）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config.autoTransparent && (
            <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => setShowLiveMatting(!showLiveMatting)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  showLiveMatting
                    ? 'bg-emerald-500 text-white shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="开启/关闭画面上的实时抠图半透明预览"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{showLiveMatting ? '实时抠图: 开启' : '实时抠图: 关闭'}</span>
              </button>

              {/* Background switcher for transparent preview */}
              {showLiveMatting && (
                <div className="flex items-center gap-0.5 px-1 border-l border-stone-300">
                  <span className="text-[10px] text-stone-500 mr-0.5">底色:</span>
                  {[
                    { id: 'checkerboard', label: '棋盘', title: '棋盘格（透明标准）' },
                    { id: 'chatGreen', label: '微信绿', title: '微信气泡绿' },
                    { id: 'chatGray', label: '聊天灰', title: '微信浅灰底' },
                    { id: 'dark', label: '深黑', title: '微信深色模式' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setPreviewBg(bg.id as any)}
                      className={`px-1.5 py-0.5 text-[10px] rounded transition-all cursor-pointer ${
                        previewBg === bg.id
                          ? 'bg-white shadow-xs font-bold text-stone-900'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                      title={bg.title}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Hold to Compare Original */}
              <button
                type="button"
                onMouseDown={() => setIsComparingOriginal(true)}
                onMouseUp={() => setIsComparingOriginal(false)}
                onTouchStart={() => setIsComparingOriginal(true)}
                onTouchEnd={() => setIsComparingOriginal(false)}
                className={`px-2 py-1 text-[11px] rounded transition-all select-none cursor-pointer ${
                  isComparingOriginal
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'text-stone-600 hover:bg-stone-200'
                }`}
                title="按住临时查看未经抠图的原始视频画面"
              >
                按住对比原画
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
              showGridOverlay
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showGridOverlay ? '隐藏网格线' : '显示网格线'}</span>
          </button>

          <button
            type="button"
            onClick={onResetVideo}
            disabled={isSlicing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>更换视频</span>
          </button>
        </div>
      </div>

      {/* Guide tip banner */}
      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">支持手动自由调节宫格大小与选区位置：</span>
          直接在左侧画面中<span className="font-semibold text-emerald-700">拖拽绿色外边框</span>整体移动，拉动<span className="font-semibold text-emerald-700">四角与边缘白色手柄</span>调整大小；或在右侧面板通过<span className="font-semibold text-emerald-700">「顶部/底部剔除」滑块</span>快速避开 AI 视频的黑边或留白！
        </div>
      </div>

      {/* Main interactive section: Video preview with grid overlay + Controls sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Player with Live Grid Overlay (7 cols) or Fullscreen Modal */}
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-stone-950 flex flex-col p-2.5 backdrop-blur-md overflow-hidden select-none text-white'
              : 'lg:col-span-7 space-y-3'
          }
        >
          {/* Action Bar / Fullscreen Header */}
          {isFullscreen ? (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-stone-900/95 border-b border-white/10 rounded-lg shrink-0 text-xs shadow-md">
              {/* Left: Mode Switcher + Mode Actions */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {/* Mode Switcher */}
                <div className="inline-flex items-center rounded-md bg-stone-950 p-0.5 border border-white/15 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSwitchLayoutMode('grid')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'grid'
                        ? 'bg-stone-700 text-white shadow-xs font-semibold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                    title="整网格模式"
                  >
                    <Grid className="w-3.5 h-3.5 text-emerald-400" />
                    <span>整网格</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchLayoutMode('independent')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'independent'
                        ? 'bg-amber-500 text-stone-950 shadow-xs font-bold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                    title="独立小方块模式"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-stone-950" />
                    <span>独立小方块</span>
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-white/15 shrink-0" />

                {/* Mode-specific actions */}
                {layoutMode === 'grid' ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleLockSquare}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer shadow-xs ${
                        isLockSquare
                          ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900'
                          : 'bg-stone-800 border-white/10 text-stone-300 hover:bg-stone-700 hover:text-white'
                      }`}
                      title={isLockSquare ? '1:1 正方已锁定 (拖动等比联动)' : '自由长宽比'}
                    >
                      {isLockSquare ? <Lock className="w-3.5 h-3.5 text-emerald-400" /> : <Unlock className="w-3.5 h-3.5 text-stone-400" />}
                      <span>{isLockSquare ? '1:1锁定' : '自由比例'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOneClickCorrectSquare}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-white/10 transition-colors cursor-pointer shadow-xs"
                      title="一键校正整网格为严格 1:1 正方形"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>矫正1:1</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoAlignSplits}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-emerald-400 hover:text-emerald-300 border border-white/10 transition-colors cursor-pointer shadow-xs"
                      title="智能吸附边缘缝隙"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>智能吸附</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSplits}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-white/10 transition-colors cursor-pointer shadow-xs"
                      title="重置分割线为均匀等距"
                    >
                      <RefreshCcw className="w-3 h-3 text-stone-400" />
                      <span>重置均分</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleLockSquare}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer shadow-xs ${
                        isLockSquare
                          ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900'
                          : 'bg-stone-800 border-white/10 text-stone-300 hover:bg-stone-700 hover:text-white'
                      }`}
                      title={isLockSquare ? '1:1 正方已锁定' : '自由比例拉伸'}
                    >
                      {isLockSquare ? <Lock className="w-3.5 h-3.5 text-emerald-400" /> : <Unlock className="w-3.5 h-3.5 text-stone-400" />}
                      <span>{isLockSquare ? '1:1锁定' : '自由比例'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOneClickCorrectSquare}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-white/10 transition-colors cursor-pointer shadow-xs"
                      title="一键将所有独立方块矫正为 1:1 纯正方形"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>矫正1:1</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUnifyBoxSizes}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 border border-white/10 transition-colors cursor-pointer shadow-xs"
                      title="统一所有小方块为当前选中尺寸"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>统一尺寸</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetIndependentBoxesFromGrid}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-white/10 transition-colors cursor-pointer shadow-xs"
                      title="从整网格重新对齐小方块"
                    >
                      <RefreshCcw className="w-3 h-3 text-stone-400" />
                      <span>重新对齐</span>
                    </button>
                  </div>
                )}

                {/* Magnifier compact pill */}
                <div className="inline-flex items-center rounded-md bg-stone-950 p-0.5 border border-white/15 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setEnableMagnifier(!enableMagnifier)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                      enableMagnifier ? 'text-amber-400 bg-stone-800' : 'text-stone-400 hover:text-stone-200'
                    }`}
                    title="拉动边缘调整大小时自动唤起放大镜"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                    <span>放大镜 {enableMagnifier ? '开' : '关'}</span>
                  </button>
                  {enableMagnifier && (
                    <div className="flex items-center border-l border-white/10 pl-1 ml-0.5 gap-0.5">
                      {[2.5, 3.5, 5.0].map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => setMagnifierZoom(z)}
                          className={`px-1 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            Math.abs(magnifierZoom - z) < 0.1
                              ? 'bg-amber-500 text-stone-950 font-bold'
                              : 'text-stone-400 hover:text-white'
                          }`}
                          title={`切换至 ${z}x`}
                        >
                          {z}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Dimension & 1:1 indicator, View Zoom, Exit Fullscreen */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Dimension & 1:1 status badge */}
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-950 border border-white/10 font-mono text-[11px] text-stone-300">
                  <span className="text-stone-400">单格:</span>
                  <span className="font-bold text-white">{gridCellPixelW}×{gridCellPixelH}</span>
                  {isGridExactSquare ? (
                    <span className="text-emerald-400 font-sans text-[10px] bg-emerald-950/60 px-1 rounded border border-emerald-500/30">1:1 正方</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOneClickCorrectSquare}
                      className="text-amber-400 hover:text-amber-300 font-sans text-[10px] bg-amber-950/60 px-1 rounded border border-amber-500/30 cursor-pointer"
                      title="点击一键矫正 1:1"
                    >
                      非正方(校正)
                    </button>
                  )}
                </div>

                {/* Viewport Zoom */}
                <div className="flex items-center gap-0.5 bg-stone-950 p-0.5 rounded-md border border-white/15 text-xs">
                  {[1, 1.25, 1.5, 2].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoomLevel(z)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                        zoomLevel === z
                          ? 'bg-stone-700 text-white font-bold'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {Math.round(z * 100)}%
                    </button>
                  ))}
                </div>

                {/* Exit Fullscreen */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-600 transition-colors cursor-pointer shadow-xs"
                  title="退出全屏 (ESC)"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-stone-300" />
                  <span>退出全屏</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {/* Mode switcher */}
                <div className="inline-flex rounded-lg bg-stone-100 p-0.5 border border-stone-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSwitchLayoutMode('grid')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                      layoutMode === 'grid'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="整网格模式：包含统一外框与可调节内部行列分割线"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>整网格模式</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchLayoutMode('independent')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                      layoutMode === 'independent'
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="独立小方块模式：将网格分散为N个独立自由方块，每个小方块可单独拖拽移动和拉伸调整大小"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>独立小方块模式</span>
                  </button>
                </div>

                {layoutMode === 'grid' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleLockSquare}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isLockSquare
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                      title={isLockSquare ? '已锁定 1:1 正方形 (拖拽等比联动)。点击可解锁自由拉伸' : '当前为自由长宽比。点击开启 1:1 正方形锁定'}
                    >
                      {isLockSquare ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>1:1 锁定</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-stone-400" />
                          <span>自由比例</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleOneClickCorrectSquare}
                      className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-xs border border-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="一键校正整网格为严格 1:1 正方形 (单格像素等宽等高)"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>矫正 1:1</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoAlignSplits}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium border border-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="自动扫描当前视频帧中各小图边缘及缝隙，自动吸附对齐内部网格线"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>吸附缝隙</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSplits}
                      className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="恢复所有内部线为均匀等距"
                    >
                      <RefreshCcw className="w-3 h-3 text-stone-500" />
                      <span>重置均分</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleLockSquare}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isLockSquare
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                      title={isLockSquare ? '已锁定 1:1 正方形 (拖拽等比联动)。点击可解锁自由拉伸' : '当前为自由长宽比。点击开启 1:1 正方形锁定'}
                    >
                      {isLockSquare ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>1:1 锁定</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-stone-400" />
                          <span>自由比例</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleOneClickCorrectSquare}
                      className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-xs border border-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="一键将所有独立方块矫正为严格 1:1 正方形"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>矫正 1:1</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUnifyBoxSizes}
                      className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium border border-amber-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="将所有小方块的宽高统一对齐为当前选中小方块的尺寸"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>统一尺寸</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetIndependentBoxesFromGrid}
                      className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="根据当前整体网格重新排列对齐所有独立小方块"
                    >
                      <RefreshCcw className="w-3 h-3 text-stone-500" />
                      <span>重新对齐</span>
                    </button>
                    <div className="inline-flex items-center gap-1 bg-stone-100 border border-stone-200 p-0.5 rounded-md text-xs">
                      <button
                        type="button"
                        onClick={() => setEnableMagnifier(!enableMagnifier)}
                        className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors ${
                          enableMagnifier ? 'text-amber-800 bg-white font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900'
                        }`}
                        title="拉动小方块调整大小时自动显示边缘放大镜"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                        <span>放大镜 {enableMagnifier ? '开' : '关'}</span>
                      </button>
                      {enableMagnifier && (
                        <div className="flex items-center gap-0.5 border-l border-stone-300 pl-1">
                          {[2.5, 3.5, 5.0].map((z) => (
                            <button
                              key={z}
                              type="button"
                              onClick={() => setMagnifierZoom(z)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                                Math.abs(magnifierZoom - z) < 0.1
                                  ? 'bg-amber-500 text-stone-950 font-bold'
                                  : 'text-stone-600 hover:text-stone-900'
                              }`}
                              title={`切换至 ${z}x 放大倍率`}
                            >
                              {z}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
                title="全屏放大查看与编辑 (按ESC退出)"
              >
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>全屏放大查看</span>
              </button>
            </div>
          )}

          {/* Toast Notification for Auto-Align */}
          {autoAlignToast && (
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                autoAlignToast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                  : 'bg-stone-100 text-stone-800 border border-stone-300'
              }`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{autoAlignToast.message}</span>
            </div>
          )}

          {/* Real-time Cell Dimensions & Edge Transparency Status Ribbon */}
          {!isFullscreen && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-stone-900 text-stone-300 rounded-xl text-xs border border-stone-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-stone-400">单格实际像素:</span>
                <span className="font-mono font-bold text-white bg-stone-800 px-2 py-0.5 rounded border border-stone-700">
                  {gridCellPixelW} × {gridCellPixelH} px
                </span>
                {isGridExactSquare ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded font-medium">
                    <CheckCheck className="w-3 h-3" />
                    <span>严格 1:1 正方 (微信规范)</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleOneClickCorrectSquare}
                    className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    title="点击立即校正为 1:1 正方形"
                  >
                    <Square className="w-3 h-3" />
                    <span>当前非正方 (点击一键矫正 1:1)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEnableMagnifier(!enableMagnifier)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                    enableMagnifier
                      ? 'text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25'
                      : 'text-stone-400 bg-stone-800 border border-stone-700 hover:text-stone-300'
                  }`}
                  title="调整独立小方块或网格拉动大小时自动唤起边缘放大镜"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>边缘放大镜: {enableMagnifier ? `开启 (${magnifierZoom}x)` : '已关闭'}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>边缘黑边透明化 · 内容完整不扣图</span>
                </span>
              </div>
            </div>
          )}

          {/* Viewport container wrapping video + overlays */}
          <div
            className={
              isFullscreen
                ? 'flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden py-1'
                : 'w-full'
            }
          >
            <div
              ref={videoContainerRef}
              onClick={handleContainerClick}
              className={`relative bg-stone-950 rounded-xl overflow-hidden shadow-inner flex items-center justify-center select-none transition-transform duration-100 origin-center ${
                isPickingColor ? 'cursor-crosshair ring-2 ring-amber-400' : ''
              } ${isFullscreen ? 'shadow-2xl border border-white/20' : 'w-full'}`}
              style={{
                aspectRatio:
                  videoDimensions.width && videoDimensions.height
                    ? `${videoDimensions.width} / ${videoDimensions.height}`
                    : '16 / 9',
                maxHeight: isFullscreen ? '100%' : '520px',
                maxWidth: '100%',
                width: isFullscreen ? 'auto' : '100%',
                height: isFullscreen ? '100%' : undefined,
                transform: isFullscreen && zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
              }}
            >
              {/* Floating Fullscreen Toggle Button in corner */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(!isFullscreen);
                }}
                className="absolute top-2.5 right-2.5 z-40 p-1.5 rounded-lg bg-black/75 hover:bg-black text-white shadow-md border border-white/25 transition-all cursor-pointer group"
                title={isFullscreen ? '退出全屏 (ESC)' : '全屏放大显示'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-amber-400" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                )}
              </button>
            {/* Pipette Color Picker Floating Tip */}
            {isPickingColor && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-stone-950 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 pointer-events-none animate-bounce">
                <Pipette className="w-3.5 h-3.5" />
                <span>请在视频画面中点击任意处吸取背景底色</span>
              </div>
            )}

            {/* Underlying Video */}
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = config.startTime;
                  videoRef.current.play();
                }
              }}
              playsInline
              muted
              loop={false}
              className="w-full h-full object-fill block pointer-events-none"
            />

            {/* Dimmed backdrop outside active crop area (Grid mode only) */}
            {layoutMode === 'grid' && isCustomCropActive && (
              <>
                <div
                  className="absolute bg-black/60 pointer-events-none transition-all duration-75"
                  style={{ top: 0, left: 0, right: 0, height: `${cropArea.y}%` }}
                />
                <div
                  className="absolute bg-black/60 pointer-events-none transition-all duration-75"
                  style={{ top: `${cropArea.y + cropArea.height}%`, left: 0, right: 0, bottom: 0 }}
                />
                <div
                  className="absolute bg-black/60 pointer-events-none transition-all duration-75"
                  style={{
                    top: `${cropArea.y}%`,
                    height: `${cropArea.height}%`,
                    left: 0,
                    width: `${cropArea.x}%`,
                  }}
                />
                <div
                  className="absolute bg-black/60 pointer-events-none transition-all duration-75"
                  style={{
                    top: `${cropArea.y}%`,
                    height: `${cropArea.height}%`,
                    left: `${cropArea.x + cropArea.width}%`,
                    right: 0,
                  }}
                />
              </>
            )}

            {/* MODE 1: Independent Boxes Overlay */}
            {showGridOverlay && layoutMode === 'independent' && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const box = currentIndependentBoxes[idx] || {
                    x: (idx % config.cols) * (100 / config.cols),
                    y: Math.floor(idx / config.cols) * (100 / config.rows),
                    width: 100 / config.cols,
                    height: 100 / config.rows,
                  };
                  const isSelected = idx === Math.max(0, Math.min(totalCells - 1, inspectCellIndex));

                  return (
                    <div
                      key={`ind-box-${idx}`}
                      className={`absolute pointer-events-auto touch-none select-none transition-shadow ${
                        isSelected
                          ? 'border-2 border-amber-400 bg-amber-400/20 shadow-[0_0_18px_rgba(251,191,36,0.85)] z-30 ring-2 ring-amber-400/60 cursor-move'
                          : 'border-2 border-emerald-400/80 bg-emerald-500/10 hover:border-amber-300 hover:bg-emerald-500/20 z-20 cursor-move'
                      }`}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                      onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'move')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectCellIndex(idx);
                      }}
                    >
                      {/* Box index label badge */}
                      <div className="absolute top-1 left-1 flex items-center gap-1 pointer-events-none">
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded leading-none shadow-xs ${
                            isSelected
                              ? 'bg-amber-500 text-stone-950 ring-1 ring-amber-300'
                              : 'bg-black/75 text-emerald-300'
                          }`}
                        >
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold bg-amber-400 text-stone-950 px-1 rounded shadow-xs">
                            当前选中
                          </span>
                        )}
                        {config.cellOverrides?.[idx] && (
                          <span className="text-[9px] font-bold bg-emerald-500 text-white px-1 rounded shadow-xs">
                            微调
                          </span>
                        )}
                      </div>

                      {/* Size dimension readout in corner */}
                      <div className="absolute bottom-1 right-1 pointer-events-none">
                        <span className="text-[9px] font-mono font-medium px-1 rounded bg-black/60 text-white/80">
                          {box.width.toFixed(1)}%×{box.height.toFixed(1)}%
                        </span>
                      </div>

                      {/* 8 Resize Handles on selected box */}
                      {isSelected && (
                        <>
                          {/* 4 Corners */}
                          <div
                            className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-amber-500 rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'nw')}
                            title="拖动调整左上角"
                          />
                          <div
                            className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-amber-500 rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'ne')}
                            title="拖动调整右上角"
                          />
                          <div
                            className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-amber-500 rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'se')}
                            title="拖动调整右下角"
                          />
                          <div
                            className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-amber-500 rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'sw')}
                            title="拖动调整左下角"
                          />

                          {/* 4 Edges */}
                          <div
                            className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-amber-500 rounded-full shadow-xs cursor-ns-resize hover:scale-110 flex items-center justify-center pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'n')}
                            title="拖动调整上边"
                          />
                          <div
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-amber-500 rounded-full shadow-xs cursor-ns-resize hover:scale-110 flex items-center justify-center pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 's')}
                            title="拖动调整下边"
                          />
                          <div
                            className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-6 bg-white border border-amber-500 rounded-full shadow-xs cursor-ew-resize hover:scale-110 flex items-center justify-center pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'w')}
                            title="拖动调整左边"
                          />
                          <div
                            className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-6 bg-white border border-amber-500 rounded-full shadow-xs cursor-ew-resize hover:scale-110 flex items-center justify-center pointer-events-auto touch-none"
                            onPointerDown={(e) => handleIndependentBoxPointerDown(e, idx, 'e')}
                            title="拖动调整右边"
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODE 2: Unified Interactive Grid Bounding Box */}
            {showGridOverlay && layoutMode === 'grid' && (
              <div
                ref={cropBoxRef}
                className="absolute border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-move z-20 touch-none select-none group"
                style={{
                  left: `${cropArea.x}%`,
                  top: `${cropArea.y}%`,
                  width: `${cropArea.width}%`,
                  height: `${cropArea.height}%`,
                }}
                onPointerDown={(e) => handlePointerDown(e, 'move')}
              >
                {/* Real-time Video Matting Canvas Overlay inside Crop Area */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xs">
                  {showLiveMatting && config.autoTransparent && !isComparingOriginal && (
                    <div
                      className={`absolute inset-0 pointer-events-none ${
                        previewBg === 'checkerboard'
                          ? 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] bg-[size:16px_16px]'
                          : previewBg === 'dark'
                          ? 'bg-stone-950'
                          : previewBg === 'chatGreen'
                          ? 'bg-[#95ec69]'
                          : 'bg-[#ededed]'
                      }`}
                    >
                      <canvas
                        ref={liveCanvasRef}
                        className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                      />
                    </div>
                  )}
                </div>

                {/* Overlaid Semi-Transparent Grid Lines & Numbers inside Crop Box */}
                <div
                  className="w-full h-full grid pointer-events-none relative z-10"
                  style={{
                    gridTemplateColumns: colPercents.map((p) => `${p}%`).join(' '),
                    gridTemplateRows: rowPercents.map((p) => `${p}%`).join(' '),
                  }}
                >
                  {Array.from({ length: totalCells }).map((_, idx) => {
                    const safeIdx = Math.max(0, Math.min(totalCells - 1, inspectCellIndex));
                    const isSelected = idx === safeIdx;
                    return (
                      <div
                        key={idx}
                        className={`relative border transition-all pointer-events-none p-1 flex items-start justify-between ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/80 z-20'
                            : 'border-emerald-400/50'
                        }`}
                      >
                        {/* Padding Inset Boundary Visualization */}
                        {config.paddingInset > 0 && (
                          <div
                            className="absolute border border-dashed border-amber-300/60 pointer-events-none"
                            style={{
                              top: `${config.paddingInset}px`,
                              left: `${config.paddingInset}px`,
                              right: `${config.paddingInset}px`,
                              bottom: `${config.paddingInset}px`,
                            }}
                          />
                        )}

                        {/* Cell index badge with click-to-inspect */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectCellIndex(idx);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded leading-none backdrop-blur-2xs shadow-2xs transition-colors pointer-events-auto cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-stone-950 ring-1 ring-amber-300'
                              : 'bg-black/75 text-emerald-300 hover:bg-black/90 hover:text-amber-300'
                          }`}
                          title={`点击选择第 ${(idx + 1).toString().padStart(2, '0')} 格质检`}
                        >
                          {(idx + 1).toString().padStart(2, '0')}
                        </button>

                        <div className="flex items-center gap-1">
                          {isSelected && (
                            <span className="text-[9px] font-bold bg-amber-400 text-stone-950 px-1 rounded shadow-xs pointer-events-none">
                              质检格
                            </span>
                          )}
                          {config.cellOverrides?.[idx] && (
                            <span className="text-[9px] font-bold bg-emerald-500 text-white px-1 rounded shadow-xs pointer-events-none">
                              微调
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tier 2: Draggable Vertical Internal Dividers */}
                {validColSplits.map((split, i) => (
                  <div
                    key={`col-split-${i}`}
                    className="absolute top-0 bottom-0 z-30 group/split pointer-events-auto touch-none cursor-col-resize flex items-center justify-center -translate-x-1/2 select-none"
                    style={{
                      left: `${split * 100}%`,
                      width: '18px',
                    }}
                    onPointerDown={(e) => handleSplitPointerDown(e, 'col', i)}
                    title={`拖动调节第 ${i + 1} 列与第 ${i + 2} 列内部间距 (位置: ${Math.round(split * 100)}%)`}
                  >
                    <div
                      className={`w-[2px] h-full transition-colors ${
                        activeDraggingSplit?.type === 'col' && activeDraggingSplit?.index === i
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                          : 'bg-emerald-400/80 group-hover/split:bg-amber-400'
                      }`}
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-emerald-600 shadow-md group-hover/split:border-amber-500 group-hover/split:scale-110 transition-transform flex items-center justify-center">
                      <span className="w-1 h-2 border-l border-r border-stone-400" />
                    </div>
                  </div>
                ))}

                {/* Tier 2: Draggable Horizontal Internal Dividers */}
                {validRowSplits.map((split, j) => (
                  <div
                    key={`row-split-${j}`}
                    className="absolute left-0 right-0 z-30 group/split pointer-events-auto touch-none cursor-row-resize flex items-center justify-center -translate-y-1/2 select-none"
                    style={{
                      top: `${split * 100}%`,
                      height: '18px',
                    }}
                    onPointerDown={(e) => handleSplitPointerDown(e, 'row', j)}
                    title={`拖动调节第 ${j + 1} 行与第 ${j + 2} 行内部间距 (位置: ${Math.round(split * 100)}%)`}
                  >
                    <div
                      className={`h-[2px] w-full transition-colors ${
                        activeDraggingSplit?.type === 'row' && activeDraggingSplit?.index === j
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                          : 'bg-emerald-400/80 group-hover/split:bg-amber-400'
                      }`}
                    />
                    <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-emerald-600 shadow-md group-hover/split:border-amber-500 group-hover/split:scale-110 transition-transform flex items-center justify-center">
                      <span className="h-1 w-2 border-t border-b border-stone-400" />
                    </div>
                  </div>
                ))}

                {/* Center Hover Move Indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md border border-white/20">
                  <Move className="w-3.5 h-3.5 text-emerald-400" />
                  <span>按住拖动位置</span>
                </div>

                {/* 4 Draggable Boundary Edge Bars for effortless margin adjustments */}
                <div
                  className="absolute -top-1.5 left-2 right-2 h-3.5 cursor-ns-resize z-40 pointer-events-auto touch-none"
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  title="拖动调整顶部边距 (Top Margin)"
                />
                <div
                  className="absolute -bottom-1.5 left-2 right-2 h-3.5 cursor-ns-resize z-40 pointer-events-auto touch-none"
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  title="拖动调整底部边距 (Bottom Margin)"
                />
                <div
                  className="absolute -left-1.5 top-2 bottom-2 w-3.5 cursor-ew-resize z-40 pointer-events-auto touch-none"
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  title="拖动调整左侧边距 (Left Margin)"
                />
                <div
                  className="absolute -right-1.5 top-2 bottom-2 w-3.5 cursor-ew-resize z-40 pointer-events-auto touch-none"
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  title="拖动调整右侧边距 (Right Margin)"
                />

                {/* Resize Handles: 4 Corners */}
                <div
                  className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nwse-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  title="拉动缩放左上角"
                />
                <div
                  className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nesw-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  title="拉动缩放右上角"
                />
                <div
                  className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nesw-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  title="拉动缩放左下角"
                />
                <div
                  className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nwse-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  title="拉动缩放右下角"
                />

                {/* Resize Handles: 4 Edges */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ns-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  title="拉动缩放顶部边缘"
                />
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ns-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  title="拉动缩放底部边缘"
                />
                <div
                  className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ew-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  title="拉动缩放左侧边缘"
                />
                <div
                  className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ew-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  title="拉动缩放右侧边缘"
                />
              </div>
            )}

            {/* Play/Pause Overlay button */}
            {!isFullscreen && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute bottom-3 left-3 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs flex items-center gap-1.5 backdrop-blur-xs shadow-md border border-white/20 transition-all z-10"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? '暂停播放' : '播放循环'}</span>
              </button>
            )}

            {/* Time indicator overlay */}
            {!isFullscreen && (
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/75 text-white text-[11px] font-mono backdrop-blur-xs border border-white/20 z-10 flex items-center gap-1.5 shadow-md">
                <span>{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
                {currentSpeed !== 1 && (
                  <span className="text-amber-400 font-bold bg-amber-400/20 px-1.5 py-0.2 rounded text-[10px] border border-amber-400/30">
                    {currentSpeed.toFixed(1)}x
                  </span>
                )}
              </div>
            )}
          </div>
          </div>

          {/* Fullscreen Bottom Bar */}
          {isFullscreen && (
            <div className="px-3 py-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 bg-stone-900/95 rounded-lg shadow-md">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors cursor-pointer shadow-xs"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? '暂停' : '播放'}</span>
                </button>

                <div className="text-stone-300 font-mono text-xs flex items-center gap-2">
                  <span>进度: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
                  <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 text-[11px]">
                    表情时长: {effectiveStickerDuration.toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* Target cell & fine tune pills */}
              <div className="flex items-center gap-2">
                <span className="text-stone-400">当前选中小格:</span>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-stone-950 font-bold font-mono text-xs">
                  第 {(Math.max(0, Math.min(totalCells - 1, inspectCellIndex)) + 1).toString().padStart(2, '0')} 格
                </span>

                {layoutMode === 'independent' && (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-stone-400 mr-0.5">微调移动:</span>
                    <button
                      type="button"
                      onClick={() => handleStepActiveBox('x', -1)}
                      className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded font-mono border border-white/10 cursor-pointer text-xs"
                      title="向左移动 1%"
                    >
                      ← X
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepActiveBox('x', 1)}
                      className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded font-mono border border-white/10 cursor-pointer text-xs"
                      title="向右移动 1%"
                    >
                      X →
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepActiveBox('y', -1)}
                      className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded font-mono border border-white/10 cursor-pointer text-xs"
                      title="向上移动 1%"
                    >
                      ↑ Y
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepActiveBox('y', 1)}
                      className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded font-mono border border-white/10 cursor-pointer text-xs"
                      title="向下移动 1%"
                    >
                      Y ↓
                    </button>
                    <span className="text-stone-400 mx-0.5">尺寸:</span>
                    <button
                      type="button"
                      onClick={() => handleStepActiveBox('width', 1)}
                      className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded font-mono border border-amber-500/30 cursor-pointer text-xs"
                      title="加宽 1%"
                    >
                      W+
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepActiveBox('height', 1)}
                      className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded font-mono border border-amber-500/30 cursor-pointer text-xs"
                      title="加高 1%"
                    >
                      H+
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline & Trim Range Slider + Playback Speed Acceleration */}
          {!isFullscreen && (
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium border-b border-stone-200/80 pb-2">
              <span className="flex items-center gap-1.5 text-stone-900 font-bold">
                <Scissors className="w-4 h-4 text-emerald-600" />
                <span>时间修剪与动作加速 (Trim & Speedup)</span>
              </span>

              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 shadow-2xs">
                  原截取: {rawClipDuration.toFixed(2)}s
                </span>
                <span className={`px-2 py-0.5 rounded font-bold border flex items-center gap-1 shadow-2xs ${
                  currentSpeed > 1
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-stone-700 border-stone-200'
                }`}>
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>{currentSpeed.toFixed(1)}x 加速</span>
                </span>
                <span className="bg-emerald-100/90 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold border border-emerald-300 shadow-2xs">
                  表情时长: {effectiveStickerDuration.toFixed(2)}s
                </span>
              </div>
            </div>

            {/* Time Trim Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div>
                <div className="flex items-center justify-between text-[11px] text-stone-600 mb-1">
                  <span>起始秒数 (Start)</span>
                  <span className="font-mono text-emerald-700 font-bold">{config.startTime.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0.1, config.endTime - 0.2)}
                  step="0.05"
                  value={config.startTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onConfigChange({ ...config, startTime: val });
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-stone-600 mb-1">
                  <span>结束秒数 (End)</span>
                  <span className="font-mono text-emerald-700 font-bold">{config.endTime.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={config.startTime + 0.2}
                  max={Math.max(1, duration || 3)}
                  step="0.05"
                  value={config.endTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onConfigChange({ ...config, endTime: val });
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>
            </div>

            {/* Playback Acceleration Control (加速播放功能) */}
            <div className="p-2.5 bg-white rounded-lg border border-stone-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>动作播放加速 (完整动作提速压缩)</span>
                </div>
                <span className="text-[11px] text-stone-500 font-medium">
                  截取 {rawClipDuration.toFixed(2)}s ➔ <span className="font-bold text-emerald-700 font-mono">{effectiveStickerDuration.toFixed(2)}s</span> 紧凑循环
                </span>
              </div>

              {/* Speed Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: '1.0x (原速)', val: 1.0 },
                  { label: '1.25x', val: 1.25 },
                  { label: '1.5x 常用', val: 1.5 },
                  { label: '1.75x', val: 1.75 },
                  { label: '2.0x 双倍', val: 2.0 },
                  { label: '2.5x', val: 2.5 },
                  { label: '3.0x 三倍', val: 3.0 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleSpeedChange(item.val)}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-all ${
                      Math.abs(currentSpeed - item.val) < 0.04
                        ? 'bg-emerald-50 text-emerald-900 border-[#07c160] font-bold shadow-2xs ring-1 ring-emerald-500/20'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Continuous Speed Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] text-stone-600">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-stone-400" />
                    <span>倍速微调滑块:</span>
                  </span>
                  <div className="flex items-center gap-1 font-mono">
                    <button
                      type="button"
                      onClick={() => handleSpeedChange(currentSpeed - 0.1)}
                      className="w-4 h-4 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-[10px]"
                      title="减速 0.1x"
                    >
                      -
                    </button>
                    <span className="text-emerald-700 font-bold min-w-[42px] text-center">
                      {currentSpeed.toFixed(2)}x
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSpeedChange(currentSpeed + 0.1)}
                      className="w-4 h-4 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-[10px]"
                      title="加速 0.1x"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.05"
                  value={currentSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value) || 1.0)}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>

              {/* Explanation tip */}
              <div className="text-[11px] text-stone-500 leading-tight flex items-start gap-1.5 pt-0.5">
                <Info className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                <span>
                  {currentSpeed > 1.0 ? (
                    <span className="text-emerald-800">
                      已启用 <strong>{currentSpeed.toFixed(1)}x</strong> 加速：完整抽取 <strong>{rawClipDuration.toFixed(2)}s</strong> 全套动作过程，生成仅 <strong>{effectiveStickerDuration.toFixed(2)}s</strong> 的轻快表情包，减少总帧数且确保体积 <strong>&lt;500KB</strong>！
                    </span>
                  ) : currentSpeed === 1.0 ? (
                    <span>原速抽帧：适合动作周期本身在 1.5~3 秒以内的视频。如果动作较长建议开启 1.5x~2.0x 加速。</span>
                  ) : (
                    <span>已启用慢放：原动作播放被放慢至 {effectiveStickerDuration.toFixed(2)} 秒。</span>
                  )}
                </span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right: Grid Slicer Settings & Precision Bounds Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Preset Buttons */}
          <div>
            <label className="text-xs font-bold text-stone-900 block mb-2">
              多宫格排布预设 (Grid Layout)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPreset('16')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                  config.preset === '16'
                    ? 'bg-emerald-50 border-[#07c160] text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold">16 宫格</div>
                <div className="text-[10px] text-stone-400">4×4 (最标准)</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('15')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                  config.preset === '15'
                    ? 'bg-emerald-50 border-[#07c160] text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold">15 宫格</div>
                <div className="text-[10px] text-stone-400">5×3 (横屏16:9)</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('9')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                  config.preset === '9'
                    ? 'bg-emerald-50 border-[#07c160] text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold">9 宫格</div>
                <div className="text-[10px] text-stone-400">3×3 (经典)</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('20')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                  config.preset === '20'
                    ? 'bg-emerald-50 border-[#07c160] text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold">20 宫格</div>
                <div className="text-[10px] text-stone-400">5×4 满套</div>
              </button>
            </div>

            {/* Custom columns & rows inputs */}
            <div className="mt-2.5 flex items-center gap-3 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
              <span className="text-stone-500 font-medium">自定义宫格:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-500">列:</span>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={config.cols}
                  onChange={(e) => {
                    const newCols = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
                    onConfigChange({
                      ...config,
                      preset: 'custom',
                      cols: newCols,
                      colSplits: getDefaultSplits(newCols),
                      cellOverrides: {},
                    });
                  }}
                  className="w-12 px-2 py-1 bg-white border border-stone-200 rounded text-center font-bold"
                />
              </div>
              <span className="text-stone-400">×</span>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-500">行:</span>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={config.rows}
                  onChange={(e) => {
                    const newRows = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
                    onConfigChange({
                      ...config,
                      preset: 'custom',
                      rows: newRows,
                      rowSplits: getDefaultSplits(newRows),
                      cellOverrides: {},
                    });
                  }}
                  className="w-12 px-2 py-1 bg-white border border-stone-200 rounded text-center font-bold"
                />
              </div>
              <span className="ml-auto text-emerald-700 font-semibold">
                切出 {totalCells} 张
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* NEW: Manual Grid Size & ROI Adjustments (手动调节宫格大小与选区) */}
          {/* ========================================================= */}
          {layoutMode === 'independent' ? (
            <div className="p-3.5 bg-amber-50/50 rounded-xl border-2 border-amber-400/80 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <LayoutGrid className="w-4 h-4 text-amber-600" />
                  <span>独立小方块尺寸与位置调节</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchLayoutMode('grid')}
                  className="text-[11px] text-stone-600 hover:text-stone-900 underline flex items-center gap-1 cursor-pointer"
                >
                  <Grid className="w-3 h-3" />
                  <span>切回整网格</span>
                </button>
              </div>

              {/* Cell selection pills */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-stone-600 mb-1.5">
                  <span>调节目标小方块:</span>
                  <span className="font-mono text-amber-800 font-semibold">
                    选中: 第 {(Math.max(0, Math.min(totalCells - 1, inspectCellIndex)) + 1).toString().padStart(2, '0')} 格
                  </span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                  {Array.from({ length: totalCells }).map((_, idx) => {
                    const isSel = idx === Math.max(0, Math.min(totalCells - 1, inspectCellIndex));
                    return (
                      <button
                        key={`cell-select-${idx}`}
                        type="button"
                        onClick={() => setInspectCellIndex(idx)}
                        className={`px-2 py-1 text-[11px] font-mono font-bold rounded-md shrink-0 transition-all cursor-pointer ${
                          isSel
                            ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-300 shadow-xs'
                            : 'bg-white text-stone-700 hover:bg-amber-100 border border-stone-200'
                        }`}
                      >
                        {(idx + 1).toString().padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders for current independent box: X, Y, Width, Height */}
              {(() => {
                const safeIdx = Math.max(0, Math.min(totalCells - 1, inspectCellIndex));
                const box = currentIndependentBoxes[safeIdx] || {
                  x: 0,
                  y: 0,
                  width: 25,
                  height: 25,
                };

                return (
                  <div className="space-y-3 bg-white p-3 rounded-lg border border-amber-200/80">
                    {/* X coordinate */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-stone-700">水平位置 X:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('x', -1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            -1%
                          </button>
                          <span className="font-mono text-amber-900 font-bold min-w-[40px] text-right">
                            {box.x.toFixed(1)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('x', 1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            +1%
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, 100 - box.width)}
                        step="0.5"
                        value={box.x}
                        onChange={(e) => handleUpdateActiveBox({ x: parseFloat(e.target.value) || 0 })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Y coordinate */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-stone-700">垂直位置 Y:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('y', -1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            -1%
                          </button>
                          <span className="font-mono text-amber-900 font-bold min-w-[40px] text-right">
                            {box.y.toFixed(1)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('y', 1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            +1%
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, 100 - box.height)}
                        step="0.5"
                        value={box.y}
                        onChange={(e) => handleUpdateActiveBox({ y: parseFloat(e.target.value) || 0 })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Width */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-stone-700">方块宽度 W:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('width', -1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            -1%
                          </button>
                          <span className="font-mono text-amber-900 font-bold min-w-[40px] text-right">
                            {box.width.toFixed(1)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('width', 1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            +1%
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max={Math.max(2, 100 - box.x)}
                        step="0.5"
                        value={box.width}
                        onChange={(e) => handleUpdateActiveBox({ width: parseFloat(e.target.value) || 2 })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Height */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-stone-700">方块高度 H:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('height', -1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            -1%
                          </button>
                          <span className="font-mono text-amber-900 font-bold min-w-[40px] text-right">
                            {box.height.toFixed(1)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepActiveBox('height', 1)}
                            className="px-1.5 py-0.2 text-[10px] bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 font-mono cursor-pointer"
                          >
                            +1%
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max={Math.max(2, 100 - box.y)}
                        step="0.5"
                        value={box.height}
                        onChange={(e) => handleUpdateActiveBox({ height: parseFloat(e.target.value) || 2 })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Batch Operations */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleUnifyBoxSizes}
                  className="px-2.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="把所有小方块的宽高统一设置为当前选中小方块的尺寸"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>统一所有方块尺寸</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetIndependentBoxesFromGrid}
                  className="px-2.5 py-2 rounded-lg bg-white hover:bg-stone-100 text-stone-700 font-medium text-xs border border-stone-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="按当前整网格分布重新排列对齐所有小方块"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  <span>从网格重新对齐</span>
                </button>
              </div>
            </div>
          ) : (
          <div className="p-3.5 bg-stone-50 rounded-xl border-2 border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <Crop className="w-4 h-4 text-emerald-600" />
                <span>手动调节宫格大小与选区 (Grid Bounds)</span>
              </div>
              {isCustomCropActive && (
                <button
                  type="button"
                  onClick={resetCropToFull}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复满屏</span>
                </button>
              )}
            </div>

            {/* 1:1 Square Calibration & Ratio Locking Card */}
            <div className="p-2.5 bg-white rounded-lg border border-stone-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1:1 正方形比例与黑边优化</span>
                </span>
                <button
                  type="button"
                  onClick={handleToggleLockSquare}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                    isLockSquare
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-stone-100 text-stone-600 border-stone-300'
                  }`}
                >
                  {isLockSquare ? <Lock className="w-3 h-3 text-emerald-600" /> : <Unlock className="w-3 h-3 text-stone-400" />}
                  <span>{isLockSquare ? '已锁定 1:1' : '自由长宽比'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[11px]">
                <div className="text-stone-600">
                  当前单格像素: <span className="font-mono font-bold text-stone-900">{gridCellPixelW}×{gridCellPixelH} px</span>
                </div>
                <button
                  type="button"
                  onClick={handleOneClickCorrectSquare}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>一键矫正 1:1</span>
                </button>
              </div>
            </div>

            {/* Quick Presets for Removing Black Bars / Margins */}
            <div>
              <span className="text-[11px] text-stone-500 block mb-1.5">一键快捷对齐与去黑边:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleOneClickCorrectSquare}
                  className="px-2 py-1.5 text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                  <span>严格 1:1 正方校准</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('removeTop30')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>剔除顶部 30% 黑边</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('removeTopBottom15')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <span>剔除上下各 15% 黑边</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('center80')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>居中缩放 80% 区域</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('full')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer col-span-2"
                >
                  <Maximize2 className="w-3 h-3 text-stone-400 shrink-0" />
                  <span>满屏 100% 覆盖</span>
                </button>
              </div>
            </div>

            {/* Adjustment Tab Switch: Margins vs Coords */}
            <div className="flex rounded-lg bg-stone-200/60 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAdjustmentTab('margins')}
                className={`flex-1 py-1 rounded-md transition-all ${
                  adjustmentTab === 'margins'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                四边黑边裁剪 (Margins)
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentTab('coords')}
                className={`flex-1 py-1 rounded-md transition-all ${
                  adjustmentTab === 'coords'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                坐标与尺寸 (X/Y/W/H)
              </button>
            </div>

            {/* TAB 1: Margins Sliders */}
            {adjustmentTab === 'margins' ? (
              <div className="space-y-2.5 pt-1">
                {/* Top Margin */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-stone-700">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>顶部剔除 (Top Margin)</span>
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <button
                        type="button"
                        onClick={() => updateMargin('top', marginTop - 1)}
                        className="w-4 h-4 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-[10px]"
                      >
                        -
                      </button>
                      <span className="text-emerald-700 font-bold min-w-[36px] text-right">{marginTop}%</span>
                      <button
                        type="button"
                        onClick={() => updateMargin('top', marginTop + 1)}
                        className="w-4 h-4 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-[10px]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, 90 - marginBottom)}
                    step="0.5"
                    value={marginTop}
                    onChange={(e) => updateMargin('top', parseFloat(e.target.value) || 0)}
                    className="w-full accent-[#07c160] cursor-pointer"
                  />
                </div>

                {/* Bottom Margin */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-stone-700">
                    <span>底部剔除 (Bottom Margin)</span>
                    <div className="flex items-center gap-1 font-mono">
                      <button
                        type="button"
                        onClick={() => updateMargin('bottom', marginBottom - 1)}
                        className="w-4 h-4 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-[10px]"
                      >
                        -
                      </button>
                      <span className="text-emerald-700 font-bold min-w-[36px] text-right">{marginBottom}%</span>
                      <button
                        type="button"
                        onClick={() => updateMargin('bottom', marginBottom + 1)}
                        className="w-4 h-4 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-[10px]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, 90 - marginTop)}
                    step="0.5"
                    value={marginBottom}
                    onChange={(e) => updateMargin('bottom', parseFloat(e.target.value) || 0)}
                    className="w-full accent-[#07c160] cursor-pointer"
                  />
                </div>

                {/* Left & Right Margins in 2 Columns */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-stone-700">
                      <span>左侧剔除</span>
                      <span className="text-emerald-700 font-mono font-bold">{marginLeft}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(1, 90 - marginRight)}
                      step="0.5"
                      value={marginLeft}
                      onChange={(e) => updateMargin('left', parseFloat(e.target.value) || 0)}
                      className="w-full accent-[#07c160] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-stone-700">
                      <span>右侧剔除</span>
                      <span className="text-emerald-700 font-mono font-bold">{marginRight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(1, 90 - marginLeft)}
                      step="0.5"
                      value={marginRight}
                      onChange={(e) => updateMargin('right', parseFloat(e.target.value) || 0)}
                      className="w-full accent-[#07c160] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: Direct Coords (X, Y, W, H) */
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-stone-700">
                    <span>X 偏移</span>
                    <span className="font-mono text-emerald-700 font-bold">{cropArea.x}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={100 - cropArea.width}
                    step="0.5"
                    value={cropArea.x}
                    onChange={(e) => updateCrop({ x: parseFloat(e.target.value) || 0 })}
                    className="w-full accent-[#07c160] cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-stone-700">
                    <span>Y 偏移</span>
                    <span className="font-mono text-emerald-700 font-bold">{cropArea.y}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={100 - cropArea.height}
                    step="0.5"
                    value={cropArea.y}
                    onChange={(e) => updateCrop({ y: parseFloat(e.target.value) || 0 })}
                    className="w-full accent-[#07c160] cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-stone-700">
                    <span>选区宽度 W</span>
                    <span className="font-mono text-emerald-700 font-bold">{cropArea.width}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max={100 - cropArea.x}
                    step="0.5"
                    value={cropArea.width}
                    onChange={(e) => updateCrop({ width: parseFloat(e.target.value) || 10 })}
                    className="w-full accent-[#07c160] cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-stone-700">
                    <span>选区高度 H</span>
                    <span className="font-mono text-emerald-700 font-bold">{cropArea.height}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max={100 - cropArea.y}
                    step="0.5"
                    value={cropArea.height}
                    onChange={(e) => updateCrop({ height: parseFloat(e.target.value) || 10 })}
                    className="w-full accent-[#07c160] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Real-time Dimensions readout */}
            <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-500 font-mono">
              <span>选区有效像素: {cropPixelW} × {cropPixelH} px</span>
              <span className="text-emerald-700 font-semibold">单格: {cellPixelW} × {cellPixelH} px</span>
            </div>
          </div>
          )}

          {/* Padding Inset slider */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
              <span className="flex items-center gap-1.5">
                <span>边缘内缩容差 (Padding Inset)</span>
              </span>
              <span className="text-emerald-700 font-mono font-bold">
                {config.paddingInset} px
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              防止裁切时相邻宫格像素穿帮，建议设为 2~4px
            </p>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={config.paddingInset}
              onChange={(e) =>
                onConfigChange({ ...config, paddingInset: parseInt(e.target.value) || 0 })
              }
              className="w-full accent-[#07c160] cursor-pointer"
            />
          </div>

          {/* Section 2.5: Tier 3 Single-Cell Micro-Adjustment & Offset */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  单格像素级微调 (第 {(Math.max(0, Math.min(totalCells - 1, inspectCellIndex)) + 1).toString().padStart(2, '0')} 格)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {((currentCellOverride.dx || 0) !== 0 ||
                  (currentCellOverride.dy || 0) !== 0 ||
                  (currentCellOverride.dw || 0) !== 0 ||
                  (currentCellOverride.dh || 0) !== 0) && (
                  <button
                    type="button"
                    onClick={handleResetCurrentOverride}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer"
                  >
                    重置此格
                  </button>
                )}
                {Object.keys(config.cellOverrides || {}).length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllOverrides}
                    className="text-[11px] text-stone-500 hover:text-stone-700 underline cursor-pointer"
                  >
                    清空全部微调
                  </button>
                )}
              </div>
            </div>

            <div className="text-[11px] text-stone-500 bg-white p-2 rounded-lg border border-stone-200/80 flex flex-wrap items-center justify-between gap-1">
              <span>
                支持快捷键微调：键盘 <kbd className="font-mono bg-stone-100 px-1 py-0.5 border rounded text-[10px]">←</kbd> <kbd className="font-mono bg-stone-100 px-1 py-0.5 border rounded text-[10px]">→</kbd> <kbd className="font-mono bg-stone-100 px-1 py-0.5 border rounded text-[10px]">↑</kbd> <kbd className="font-mono bg-stone-100 px-1 py-0.5 border rounded text-[10px]">↓</kbd>（按住 Shift 步进 5px）
              </span>
              <span className="font-mono text-amber-700 font-bold">
                X:{currentCellOverride.dx || 0}px Y:{currentCellOverride.dy || 0}px
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* X Offset */}
              <div className="bg-white p-2 rounded-lg border border-stone-200/80 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-stone-600 font-medium">水平偏移 (X)</span>
                  <span className="font-mono font-bold text-stone-800">{currentCellOverride.dx || 0} px</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="1"
                  value={currentCellOverride.dx || 0}
                  onChange={(e) => handleUpdateOverride('dx', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                />
                <div className="flex justify-between gap-1 pt-0.5">
                  {[-5, -1, 0, 1, 5].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        if (delta === 0) handleUpdateOverride('dx', 0);
                        else handleUpdateOverride('dx', Math.max(-40, Math.min(40, (currentCellOverride.dx || 0) + delta)));
                      }}
                      className="flex-1 py-0.5 rounded bg-stone-50 hover:bg-stone-100 border border-stone-200 font-mono text-[10px] text-stone-700 cursor-pointer"
                    >
                      {delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Y Offset */}
              <div className="bg-white p-2 rounded-lg border border-stone-200/80 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-stone-600 font-medium">垂直偏移 (Y)</span>
                  <span className="font-mono font-bold text-stone-800">{currentCellOverride.dy || 0} px</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="1"
                  value={currentCellOverride.dy || 0}
                  onChange={(e) => handleUpdateOverride('dy', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                />
                <div className="flex justify-between gap-1 pt-0.5">
                  {[-5, -1, 0, 1, 5].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        if (delta === 0) handleUpdateOverride('dy', 0);
                        else handleUpdateOverride('dy', Math.max(-40, Math.min(40, (currentCellOverride.dy || 0) + delta)));
                      }}
                      className="flex-1 py-0.5 rounded bg-stone-50 hover:bg-stone-100 border border-stone-200 font-mono text-[10px] text-stone-700 cursor-pointer"
                    >
                      {delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Width Expand/Shrink */}
              <div className="bg-white p-2 rounded-lg border border-stone-200/80 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-stone-600 font-medium">宽度微扩/微缩</span>
                  <span className="font-mono font-bold text-stone-800">{currentCellOverride.dw || 0} px</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={currentCellOverride.dw || 0}
                  onChange={(e) => handleUpdateOverride('dw', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                />
                <div className="flex justify-between gap-1 pt-0.5">
                  {[-4, -1, 0, 1, 4].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        if (delta === 0) handleUpdateOverride('dw', 0);
                        else handleUpdateOverride('dw', Math.max(-30, Math.min(30, (currentCellOverride.dw || 0) + delta)));
                      }}
                      className="flex-1 py-0.5 rounded bg-stone-50 hover:bg-stone-100 border border-stone-200 font-mono text-[10px] text-stone-700 cursor-pointer"
                    >
                      {delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height Expand/Shrink */}
              <div className="bg-white p-2 rounded-lg border border-stone-200/80 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-stone-600 font-medium">高度微扩/微缩</span>
                  <span className="font-mono font-bold text-stone-800">{currentCellOverride.dh || 0} px</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={currentCellOverride.dh || 0}
                  onChange={(e) => handleUpdateOverride('dh', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                />
                <div className="flex justify-between gap-1 pt-0.5">
                  {[-4, -1, 0, 1, 4].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        if (delta === 0) handleUpdateOverride('dh', 0);
                        else handleUpdateOverride('dh', Math.max(-30, Math.min(30, (currentCellOverride.dh || 0) + delta)));
                      }}
                      className="flex-1 py-0.5 rounded bg-stone-50 hover:bg-stone-100 border border-stone-200 font-mono text-[10px] text-stone-700 cursor-pointer"
                    >
                      {delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FPS & WeChat Standard Options */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
              <span>逐帧抽帧率 (FPS)</span>
              <span className="text-emerald-700 font-mono font-bold">{config.fps} 帧/秒</span>
            </div>
            <div className="flex items-center gap-2">
              {[8, 10, 12, 15].map((fpsVal) => (
                <button
                  key={fpsVal}
                  type="button"
                  onClick={() => onConfigChange({ ...config, fps: fpsVal })}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    config.fps === fpsVal
                      ? 'bg-[#07c160] text-white border-[#07c160]'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {fpsVal} FPS
                </button>
              ))}
            </div>

            {/* Background Transparency & Real-time Live Quality Inspection */}
            <div className="pt-2 border-t border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-stone-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoTransparent}
                    onChange={(e) =>
                      onConfigChange({ ...config, autoTransparent: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#07c160] rounded"
                  />
                  <span>抠除背景色（保留纯透明底）</span>
                </label>

                {config.autoTransparent && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>实时渲染已开启</span>
                  </span>
                )}
              </div>

              {config.autoTransparent && (
                <div className="space-y-3 pl-1">
                  {/* Background Color Picker & Eyedropper */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>目标底色 (Keying Color):</span>
                      <span className="font-mono text-xs font-bold text-stone-800">{config.bgColor.toUpperCase()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center gap-1.5 p-1 bg-white border border-stone-200 rounded-lg shadow-2xs">
                        <input
                          type="color"
                          value={config.bgColor}
                          onChange={(e) => onConfigChange({ ...config, bgColor: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={config.bgColor}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
                              onConfigChange({ ...config, bgColor: val });
                            }
                          }}
                          className="w-16 text-xs font-mono font-bold px-1 py-0.5 border border-stone-200 rounded text-center uppercase"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleEyeDropper}
                        className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isPickingColor
                            ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-xs ring-2 ring-amber-400 font-bold'
                            : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-2xs'
                        }`}
                        title="点击后在视频画面中吸取底色"
                      >
                        <Pipette className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isPickingColor ? '请点击视频取色' : '画面吸色'}</span>
                      </button>
                    </div>

                    {/* Quick Preset Colors */}
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      <span className="text-[10px] text-stone-400">常用:</span>
                      {[
                        { label: '纯白', color: '#ffffff' },
                        { label: '浅灰', color: '#f5f5f5' },
                        { label: '纯黑', color: '#000000' },
                        { label: '绿幕', color: '#00ff00' },
                        { label: '蓝幕', color: '#0000ff' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => onConfigChange({ ...config, bgColor: preset.color })}
                          className={`px-1.5 py-0.5 text-[10px] rounded border flex items-center gap-1 transition-all cursor-pointer ${
                            config.bgColor.toLowerCase() === preset.color.toLowerCase()
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full border border-stone-300"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tolerance with Steppers and Presets */}
                  <div className="space-y-1.5 p-2.5 bg-white rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                        <span>抠图容差 (Tolerance)</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onConfigChange({
                              ...config,
                              tolerance: Math.max(1, config.tolerance - 5),
                            })
                          }
                          className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-mono text-stone-700 cursor-pointer"
                          title="-5"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onConfigChange({
                              ...config,
                              tolerance: Math.max(1, config.tolerance - 1),
                            })
                          }
                          className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-mono text-stone-700 cursor-pointer"
                          title="-1"
                        >
                          -1
                        </button>
                        <span className="font-mono font-bold text-sm text-emerald-700 px-1.5 min-w-[32px] text-center">
                          {config.tolerance}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onConfigChange({
                              ...config,
                              tolerance: Math.min(80, config.tolerance + 1),
                            })
                          }
                          className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-mono text-stone-700 cursor-pointer"
                          title="+1"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onConfigChange({
                              ...config,
                              tolerance: Math.min(80, config.tolerance + 5),
                            })
                          }
                          className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-mono text-stone-700 cursor-pointer"
                          title="+5"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="2"
                      max="70"
                      step="1"
                      value={config.tolerance}
                      onChange={(e) =>
                        onConfigChange({ ...config, tolerance: parseInt(e.target.value) || 20 })
                      }
                      className="w-full accent-[#07c160] cursor-pointer"
                    />

                    {/* Quick Tolerance Preset Buttons */}
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[
                        { label: '弱 (8)', value: 8, desc: '保细节' },
                        { label: '推荐 (14)', value: 14, desc: '标准' },
                        { label: '强 (22)', value: 22, desc: '去毛刺' },
                        { label: '深 (32)', value: 32, desc: '重底色' },
                      ].map((lvl) => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => onConfigChange({ ...config, tolerance: lvl.value })}
                          className={`py-1 px-1 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
                            config.tolerance === lvl.value
                              ? 'bg-emerald-500 text-white border-emerald-600 font-bold shadow-2xs'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          <div>{lvl.label}</div>
                          <div className="text-[9px] opacity-75">{lvl.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time Single-Cell Dynamic Video Quality Inspector (质检格) */}
                  <div className="p-3 bg-white rounded-xl border-2 border-amber-300 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-bold text-stone-900">
                          动态单格放大质检 (240×240 微信标准)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setInspectCellIndex((prev) =>
                              prev > 0 ? prev - 1 : totalCells - 1
                            )
                          }
                          className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                          title="查看上一格"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                          第 {(inspectCellIndex + 1).toString().padStart(2, '0')} 格
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setInspectCellIndex((prev) =>
                              prev < totalCells - 1 ? prev + 1 : 0
                            )
                          }
                          className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                          title="查看下一格"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inspector View Mode Tabs */}
                    <div className="flex rounded-lg bg-stone-100 p-0.5 text-[11px] font-medium text-stone-600">
                      <button
                        type="button"
                        onClick={() => setInspectViewMode('processed')}
                        className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                          inspectViewMode === 'processed'
                            ? 'bg-white text-stone-900 shadow-2xs font-bold'
                            : 'hover:text-stone-900'
                        }`}
                      >
                        ✨ 动态抠图效果
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectViewMode('original')}
                        className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                          inspectViewMode === 'original'
                            ? 'bg-white text-stone-900 shadow-2xs font-bold'
                            : 'hover:text-stone-900'
                        }`}
                      >
                        🖼️ 原始画面
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectViewMode('split')}
                        className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                          inspectViewMode === 'split'
                            ? 'bg-white text-stone-900 shadow-2xs font-bold'
                            : 'hover:text-stone-900'
                        }`}
                      >
                        🌓 并排对比
                      </button>
                    </div>

                    {/* Canvas Stage */}
                    <div className="flex items-center justify-center gap-2 bg-stone-100/70 p-2 rounded-lg border border-stone-200">
                      {/* Processed Live Matting Canvas */}
                      {(inspectViewMode === 'processed' || inspectViewMode === 'split') && (
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-lg border border-stone-300 shadow-inner overflow-hidden relative ${
                              previewBg === 'checkerboard'
                                ? 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] bg-[size:12px_12px]'
                                : previewBg === 'dark'
                                ? 'bg-stone-950'
                                : previewBg === 'chatGreen'
                                ? 'bg-[#95ec69]'
                                : 'bg-[#ededed]'
                            }`}
                          >
                            <canvas
                              ref={inspectCanvasRef}
                              width={240}
                              height={240}
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute top-1 left-1 bg-black/70 text-[9px] font-mono text-emerald-300 px-1 rounded leading-none">
                              240×240 预览
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-500 font-medium">实时抠图后</span>
                        </div>
                      )}

                      {/* Original Video Frame Canvas */}
                      {(inspectViewMode === 'original' || inspectViewMode === 'split') && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg border border-stone-300 shadow-inner overflow-hidden relative bg-stone-900">
                            <canvas
                              ref={inspectOriginalCanvasRef}
                              width={240}
                              height={240}
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute top-1 left-1 bg-black/70 text-[9px] font-mono text-stone-300 px-1 rounded leading-none">
                              原画切片
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-500 font-medium">原始切片</span>
                        </div>
                      )}
                    </div>

                    {/* Diagnostics & Transparent Pixel Ratio */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-500">透明像素占比:</span>
                        <span className="font-mono font-bold text-stone-800">
                          {cellStats.transparentPercent}%
                        </span>
                      </div>

                      {cellStats.health === 'good' && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>抠图比例优良</span>
                        </span>
                      )}
                      {cellStats.health === 'low' && (
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 text-[10px]" title="可能底色未完全去除，可适当调大容差">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>透明偏低/建议微增容差</span>
                        </span>
                      )}
                      {cellStats.health === 'high' && (
                        <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 text-[10px]" title="透明占比极高，可能主体有部分被误伤">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>透明偏高/请检查主体</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* WeChat Standard White Outline */}
            <div className="pt-2 border-t border-stone-200">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.addWhiteOutline}
                  onChange={(e) =>
                    onConfigChange({ ...config, addWhiteOutline: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#07c160] rounded"
                />
                <span className="flex items-center gap-1">
                  <span>微信官方 2px 白色保护描边</span>
                  <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    红线推荐
                  </span>
                </span>
              </label>
              <p className="text-[11px] text-stone-500 pl-6 mt-0.5">
                防止表情在微信深色模式（深黑底色）下轮廓隐形
              </p>
            </div>
          </div>

          {/* Slicing Progress Bar or Action Button */}
          {isSlicing ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#07c160]" />
                  {sliceStatusText}
                </span>
                <span className="font-mono">{sliceProgress}%</span>
              </div>
              <div className="w-full h-2 bg-emerald-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#07c160] transition-all duration-200 rounded-full"
                  style={{ width: `${sliceProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-emerald-700">
                正在多线程量化压缩，严格锁定 240×240 尺寸与 500KB 微信红线...
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) onStartSlice(videoRef.current);
              }}
              className="w-full py-3.5 px-4 bg-[#07c160] hover:bg-[#06ad56] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-[0.99]"
            >
              <Scissors className="w-4 h-4" />
              <span>开始对齐多宫格逐帧切片 (导出 {totalCells} 个 240×240 标准 GIF)</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time High-Precision Edge Magnifier Overlay */}
      <GridMagnifierLens
        data={magnifierData}
        sourceElement={videoRef.current}
        sourceWidth={vidW}
        sourceHeight={vidH}
        zoomLevel={magnifierZoom}
        onZoomChange={setMagnifierZoom}
      />
    </div>
  );
};
