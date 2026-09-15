import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Scissors,
  CheckCircle2,
  Sparkles,
  Sliders,
  Maximize2,
  Minimize2,
  Palette,
  Layers,
  HelpCircle,
  RotateCcw,
  Scan,
  Info,
  Image as ImageIcon,
  FileImage,
  Pipette,
  Eye,
  ZoomIn,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  Wand2,
  Target,
  Crosshair,
  RefreshCcw,
  Move,
} from 'lucide-react';
import { ImageGridConfig, GridPreset, GridCropArea, CellOverride } from '../../types';
import {
  removeBackgroundFromFrame,
  applyWhiteOutline,
  rgbToHex,
} from '../../utils/gifProcessor';
import {
  getDefaultSplits,
  normalizeSplits,
  getColWidthsPercent,
  getRowHeightsPercent,
  calculateCellBounds,
  autoDetectGridSplits,
} from '../../utils/gridGeometry';

interface GridImageSlicerControlsProps {
  imageFile: File;
  imageUrl: string;
  config: ImageGridConfig;
  onConfigChange: (newConfig: ImageGridConfig) => void;
  onStartSlice: (imgElement: HTMLImageElement) => void;
  onResetImage: () => void;
  isSlicing: boolean;
  sliceProgress: number;
  sliceStatusText: string;
}

export const GridImageSlicerControls: React.FC<GridImageSlicerControlsProps> = ({
  imageFile,
  imageUrl,
  config,
  onConfigChange,
  onStartSlice,
  onResetImage,
  isSlicing,
  sliceProgress,
  sliceStatusText,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const inspectCanvasRef = useRef<HTMLCanvasElement>(null);
  const inspectOriginalCanvasRef = useRef<HTMLCanvasElement>(null);

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 1024,
    height: 1024,
  });

  // Real-Time Matting & Inspection Controls
  const [showLiveMatting, setShowLiveMatting] = useState<boolean>(true);
  const [previewBg, setPreviewBg] = useState<'checkerboard' | 'dark' | 'chatGray' | 'chatGreen'>('checkerboard');
  const [isComparingOriginal, setIsComparingOriginal] = useState<boolean>(false);
  const [inspectCellIndex, setInspectCellIndex] = useState<number>(0);
  const [inspectViewMode, setInspectViewMode] = useState<'processed' | 'original' | 'split'>('processed');
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);
  const [cellStats, setCellStats] = useState<{
    transparentPercent: number;
    isHealthy: 'good' | 'low' | 'high';
  }>({
    transparentPercent: 0,
    isHealthy: 'good',
  });

  const cropBoxRef = useRef<HTMLDivElement>(null);
  const [activeDraggingSplit, setActiveDraggingSplit] = useState<{
    type: 'col' | 'row';
    index: number;
  } | null>(null);
  const [autoAlignToast, setAutoAlignToast] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Active cropArea with fallback
  const cropArea: GridCropArea = config.cropArea || { x: 0, y: 0, width: 100, height: 100 };

  // Normalized splits & column/row percentages
  const validColSplits = normalizeSplits(config.colSplits, config.cols);
  const validRowSplits = normalizeSplits(config.rowSplits, config.rows);
  const colPercents = getColWidthsPercent(config.colSplits, config.cols);
  const rowPercents = getRowHeightsPercent(config.rowSplits, config.rows);

  // Calculate current margins (%)
  const marginTop = Math.round(cropArea.y * 10) / 10;
  const marginBottom = Math.round(Math.max(0, 100 - cropArea.y - cropArea.height) * 10) / 10;
  const marginLeft = Math.round(cropArea.x * 10) / 10;
  const marginRight = Math.round(Math.max(0, 100 - cropArea.x - cropArea.width) * 10) / 10;

  const handleImageLoaded = () => {
    if (imgRef.current) {
      const nw = imgRef.current.naturalWidth || 1024;
      const nh = imgRef.current.naturalHeight || 1024;
      setNaturalDimensions({ width: nw, height: nh });
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
    if (!imgRef.current) return;
    const img = imgRef.current;
    const nw = img.naturalWidth || 1024;
    const nh = img.naturalHeight || 1024;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = nw;
    offCanvas.height = nh;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0, nw, nh);
    const detected = autoDetectGridSplits(offCtx, nw, nh, cropArea, config.cols, config.rows);

    onConfigChange({
      ...config,
      colSplits: detected.colSplits,
      rowSplits: detected.rowSplits,
    });
    setAutoAlignToast({
      message: '✨ 已智能对齐内部各格分割线至内容缝隙！',
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

  // Keyboard shortcut listener for micro-tuning active cell
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const step = e.shiftKey ? 5 : 1;
      let handled = false;
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

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectCellIndex, config]);

  // Helper to update cropArea directly
  const updateCrop = (newCrop: Partial<GridCropArea>) => {
    const updated: GridCropArea = {
      x: Math.max(0, Math.min(95, newCrop.x !== undefined ? newCrop.x : cropArea.x)),
      y: Math.max(0, Math.min(95, newCrop.y !== undefined ? newCrop.y : cropArea.y)),
      width: Math.max(5, Math.min(100, newCrop.width !== undefined ? newCrop.width : cropArea.width)),
      height: Math.max(5, Math.min(100, newCrop.height !== undefined ? newCrop.height : cropArea.height)),
    };
    if (updated.x + updated.width > 100) {
      updated.width = 100 - updated.x;
    }
    if (updated.y + updated.height > 100) {
      updated.height = 100 - updated.y;
    }
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

  // Color Eyedropper
  const handlePickColor = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onConfigChange({ ...config, bgColor: result.sRGBHex });
          return;
        }
      } catch {
        // user aborted or not supported
      }
    }
    setIsPickingColor((prev) => !prev);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPickingColor || !imgRef.current || !imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    const nw = imgRef.current.naturalWidth || 1024;
    const nh = imgRef.current.naturalHeight || 1024;
    const pxX = Math.floor(normX * nw);
    const pxY = Math.floor(normY * nh);

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1;
    sampleCanvas.height = 1;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      sCtx.drawImage(imgRef.current, pxX, pxY, 1, 1, 0, 0, 1, 1);
      const pixel = sCtx.getImageData(0, 0, 1, 1).data;
      const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
      onConfigChange({ ...config, bgColor: hex });
    }
    setIsPickingColor(false);
  };

  // -------------------------------------------------------------
  // Real-Time Matting Renderers (Runs on Tolerance / Config Changes)
  // -------------------------------------------------------------
  const renderLiveMatting = () => {
    if (!imgRef.current || !liveCanvasRef.current) return;
    const canvas = liveCanvasRef.current;
    const img = imgRef.current;
    const nw = img.naturalWidth || 1024;
    const nh = img.naturalHeight || 1024;

    const cropX = (cropArea.x / 100) * nw;
    const cropY = (cropArea.y / 100) * nh;
    const cropW = Math.max(10, (cropArea.width / 100) * nw);
    const cropH = Math.max(10, (cropArea.height / 100) * nh);

    // Keep internal canvas resolution optimal for 60fps responsiveness (capped around 800px)
    const maxDim = 800;
    const aspect = cropW / cropH;
    let targetW = maxDim;
    let targetH = maxDim;
    if (aspect >= 1) {
      targetW = maxDim;
      targetH = Math.max(50, Math.round(maxDim / aspect));
    } else {
      targetH = maxDim;
      targetW = Math.max(50, Math.round(maxDim * aspect));
    }

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    if (config.autoTransparent) {
      let imgData = ctx.getImageData(0, 0, targetW, targetH);
      imgData = removeBackgroundFromFrame(imgData, {
        targetColor: config.bgColor || '#ffffff',
        tolerance: config.tolerance || 20,
        contiguous: false,
        defringe: 1,
      });

      if (config.addWhiteOutline) {
        imgData = applyWhiteOutline(imgData, config.outlineWidth || 2, '#ffffff');
      }

      ctx.putImageData(imgData, 0, 0);
    }
  };

  const renderInspectCell = () => {
    if (!imgRef.current || !inspectCanvasRef.current) return;
    const canvas = inspectCanvasRef.current;
    const img = imgRef.current;
    const nw = img.naturalWidth || 1024;
    const nh = img.naturalHeight || 1024;

    const cropX = (cropArea.x / 100) * nw;
    const cropY = (cropArea.y / 100) * nh;
    const cropW = Math.max(10, (cropArea.width / 100) * nw);
    const cropH = Math.max(10, (cropArea.height / 100) * nh);

    const total = config.cols * config.rows;
    const safeIdx = Math.max(0, Math.min(total - 1, inspectCellIndex));
    const col = safeIdx % config.cols;
    const row = Math.floor(safeIdx / config.cols);

    const cellBounds = calculateCellBounds({
      cropX,
      cropY,
      cropW,
      cropH,
      cols: config.cols,
      rows: config.rows,
      col,
      row,
      colSplits: config.colSplits,
      rowSplits: config.rowSplits,
      cellOverride: config.cellOverrides?.[safeIdx],
      paddingInset: config.paddingInset || 0,
      sourceWidth: nw,
      sourceHeight: nh,
    });

    const srcX = cellBounds.sx;
    const srcY = cellBounds.sy;
    const srcW = cellBounds.sw;
    const srcH = cellBounds.sh;

    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, 240, 240);

    const scale = Math.min(240 / srcW, 240 / srcH);
    const dstW = srcW * scale;
    const dstH = srcH * scale;
    const dstX = (240 - dstW) / 2;
    const dstY = (240 - dstH) / 2;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

    // Also draw original if inspectOriginalCanvasRef exists
    if (inspectOriginalCanvasRef.current) {
      const origCanvas = inspectOriginalCanvasRef.current;
      origCanvas.width = 240;
      origCanvas.height = 240;
      const origCtx = origCanvas.getContext('2d');
      if (origCtx) {
        origCtx.clearRect(0, 0, 240, 240);
        origCtx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      }
    }

    let imgData = ctx.getImageData(0, 0, 240, 240);

    if (config.autoTransparent) {
      imgData = removeBackgroundFromFrame(imgData, {
        targetColor: config.bgColor || '#ffffff',
        tolerance: config.tolerance || 20,
        contiguous: false,
        defringe: 1,
      });
    }

    // Calculate transparent percentage
    let transparentCount = 0;
    const totalPix = 240 * 240;
    for (let i = 3; i < imgData.data.length; i += 4) {
      if (imgData.data[i] === 0) transparentCount++;
    }
    const pct = Math.round((transparentCount / totalPix) * 1000) / 10;
    let status: 'good' | 'low' | 'high' = 'good';
    if (pct < 10) status = 'low';
    else if (pct > 82) status = 'high';
    setCellStats({ transparentPercent: pct, isHealthy: status });

    if (config.autoTransparent && config.addWhiteOutline) {
      imgData = applyWhiteOutline(imgData, config.outlineWidth || 2, '#ffffff');
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Synchronous, real-time update loop
  useEffect(() => {
    let animId: number;
    const update = () => {
      renderLiveMatting();
      renderInspectCell();
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [
    imageUrl,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    config.cols,
    config.rows,
    config.paddingInset,
    config.autoTransparent,
    config.bgColor,
    config.tolerance,
    config.addWhiteOutline,
    config.outlineWidth,
    config.colSplits,
    config.rowSplits,
    config.cellOverrides,
    inspectCellIndex,
  ]);

  // Quick preset crop alignments
  const applyCropPreset = (type: 'removeTop30' | 'removeTopBottom15' | 'center80' | 'full') => {
    if (type === 'full') {
      resetCropToFull();
    } else if (type === 'removeTop30') {
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
    if (!imgContainerRef.current) return;

    const containerRect = imgContainerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...cropArea };

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaXPercent = ((moveEvent.clientX - startX) / containerRect.width) * 100;
      const deltaYPercent = ((moveEvent.clientY - startY) / containerRect.height) * 100;

      let newX = startCrop.x;
      let newY = startCrop.y;
      let newW = startCrop.width;
      let newH = startCrop.height;

      if (handle === 'move') {
        newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent));
        newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent));
      } else {
        // Resizing from edges/corners
        if (handle.includes('e')) {
          newW = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent));
        }
        if (handle.includes('s')) {
          newH = Math.max(5, Math.min(100 - startCrop.y, startCrop.height + deltaYPercent));
        }
        if (handle.includes('w')) {
          const maxShift = startCrop.width - 5;
          const shift = Math.max(-startCrop.x, Math.min(maxShift, deltaXPercent));
          newX = startCrop.x + shift;
          newW = startCrop.width - shift;
        }
        if (handle.includes('n')) {
          const maxShift = startCrop.height - 5;
          const shift = Math.max(-startCrop.y, Math.min(maxShift, deltaYPercent));
          newY = startCrop.y + shift;
          newH = startCrop.height - shift;
        }
      }

      onConfigChange({
        ...config,
        cropArea: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        },
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleStart = () => {
    if (imgRef.current && !isSlicing) {
      onStartSlice(imgRef.current);
    }
  };

  const totalCells = config.cols * config.rows;

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-6">
      {/* Top Bar: Title & Source File Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-stone-900">
              静态图多宫格切片与微信物料工作台
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {config.cols}×{config.rows} = {totalCells} 格
            </span>
            {config.autoTransparent && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>实时容差微调中 ({config.tolerance})</span>
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            当前图片: <span className="font-mono text-stone-700 font-medium">{imageFile.name}</span> (原图尺寸: {naturalDimensions.width}×{naturalDimensions.height})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetImage}
            disabled={isSlicing}
            className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>更换图片</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Interactive Visual Canvas Slicer Area */}
        <div className="lg:col-span-7 space-y-3">
          {/* Header Bar with Live Matting Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-emerald-600" />
                <span>N 宫格实时预览</span>
              </span>

              {config.autoTransparent && (
                <button
                  type="button"
                  onClick={() => setShowLiveMatting(!showLiveMatting)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 transition-all cursor-pointer ${
                    showLiveMatting
                      ? 'bg-emerald-50 text-[#07c160] border-emerald-300 font-bold'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                  title="开关 N 宫格抠图实时透明化效果"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{showLiveMatting ? '实时抠图已开' : '显示原图'}</span>
                </button>
              )}
            </div>

            {/* Background Switcher & Hold to Compare */}
            <div className="flex items-center gap-1.5">
              {config.autoTransparent && showLiveMatting && (
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                  <span className="text-[10px] text-stone-500 pl-1">背景:</span>
                  <button
                    type="button"
                    onClick={() => setPreviewBg('checkerboard')}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                      previewBg === 'checkerboard' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="棋盘格透明底"
                  >
                    🏁 棋盘
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBg('dark')}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                      previewBg === 'dark' ? 'bg-stone-900 text-white shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="深色黑底（检验 2px 白描边及暗部杂色最佳）"
                  >
                    ⬛ 深色
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBg('chatGray')}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                      previewBg === 'chatGray' ? 'bg-[#ededed] shadow-xs font-bold text-stone-900' : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="微信聊天浅灰底"
                  >
                    💬 聊天灰
                  </button>
                </div>
              )}

              {/* Hold to Compare Original */}
              {config.autoTransparent && showLiveMatting && (
                <button
                  type="button"
                  onPointerDown={() => setIsComparingOriginal(true)}
                  onPointerUp={() => setIsComparingOriginal(false)}
                  onPointerLeave={() => setIsComparingOriginal(false)}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-medium border border-stone-300 transition-colors cursor-pointer select-none flex items-center gap-1"
                  title="按住鼠标左键临时查看未抠图的原图"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>按住对比原图</span>
                </button>
              )}
            </div>
          </div>

          {/* 3-Tier Grid Alignment & Adjustment Action Bar */}
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/90 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-stone-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                <span>分格对齐方式:</span>
              </span>
              <button
                type="button"
                onClick={handleAutoAlignSplits}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="自动扫描图中各小图边缘及缝隙，自动吸附对齐内部网格线"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>智能吸附边缘缝隙</span>
              </button>
              <button
                type="button"
                onClick={handleResetSplits}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="恢复所有内部线为均匀等距"
              >
                <RefreshCcw className="w-3 h-3 text-stone-500" />
                <span>重置均分</span>
              </button>
            </div>

            <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>拖拽图内绿色中线可调宽窄，选中单格可在右侧像素级微调</span>
            </div>
          </div>

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

          {/* Interactive Image Container */}
          <div
            ref={imgContainerRef}
            onClick={handleContainerClick}
            style={{
              aspectRatio:
                naturalDimensions.width && naturalDimensions.height
                  ? `${naturalDimensions.width} / ${naturalDimensions.height}`
                  : '1 / 1',
              maxHeight: '68vh',
            }}
            className={`relative w-full bg-stone-950 rounded-xl overflow-hidden shadow-inner select-none border border-stone-800 ${
              isPickingColor ? 'cursor-crosshair ring-2 ring-amber-400' : ''
            }`}
          >
            {/* Color Picking Hint Banner */}
            {isPickingColor && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-stone-950 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 pointer-events-none animate-bounce">
                <Pipette className="w-3.5 h-3.5" />
                <span>请在图片上点击任意处吸取背景底色</span>
              </div>
            )}

            {/* Base Image */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Spritesheet Source"
              onLoad={handleImageLoaded}
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Outside Dim Mask: Top */}
            <div
              className="absolute left-0 top-0 right-0 bg-black/60 pointer-events-none transition-all z-10"
              style={{ height: `${cropArea.y}%` }}
            />
            {/* Outside Dim Mask: Bottom */}
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-none transition-all z-10"
              style={{ height: `${Math.max(0, 100 - cropArea.y - cropArea.height)}%` }}
            />
            {/* Outside Dim Mask: Left */}
            <div
              className="absolute left-0 bg-black/60 pointer-events-none transition-all z-10"
              style={{
                top: `${cropArea.y}%`,
                height: `${cropArea.height}%`,
                width: `${cropArea.x}%`,
              }}
            />
            {/* Outside Dim Mask: Right */}
            <div
              className="absolute right-0 bg-black/60 pointer-events-none transition-all z-10"
              style={{
                top: `${cropArea.y}%`,
                height: `${cropArea.height}%`,
                width: `${Math.max(0, 100 - cropArea.x - cropArea.width)}%`,
              }}
            />

            {/* Draggable & Resizable Active Crop Box */}
            <div
              ref={cropBoxRef}
              className="absolute border-2 border-emerald-400 bg-emerald-500/10 shadow-lg cursor-move z-20 touch-none select-none group"
              style={{
                left: `${cropArea.x}%`,
                top: `${cropArea.y}%`,
                width: `${cropArea.width}%`,
                height: `${cropArea.height}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              {/* Live Matting Transparency Preview Layer inside Crop Area */}
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

              {/* Internal Grid Matrix (Cols x Rows with dynamic split widths) */}
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
                  const override = config.cellOverrides?.[idx];
                  const hasOverride =
                    override &&
                    ((override.dx || 0) !== 0 ||
                      (override.dy || 0) !== 0 ||
                      (override.dw || 0) !== 0 ||
                      (override.dh || 0) !== 0);

                  return (
                    <div
                      key={idx}
                      className={`border transition-all pointer-events-none relative p-1 flex items-start justify-between ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/20 ring-2 ring-amber-400/90 z-20'
                          : 'border-emerald-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-1">
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
                          title={`点击选择第 ${(idx + 1).toString().padStart(2, '0')} 格质检与微调`}
                        >
                          {(idx + 1).toString().padStart(2, '0')}
                        </button>
                        {hasOverride && (
                          <span
                            className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500 text-stone-950 font-black pointer-events-none shadow-xs"
                            title={`此格微调: X:${override.dx || 0} Y:${override.dy || 0} W:${override.dw || 0} H:${override.dh || 0}`}
                          >
                            微调
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <span className="text-[9px] font-bold bg-amber-400 text-stone-950 px-1 rounded shadow-xs pointer-events-none">
                          选中微调
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tier 2: Draggable Vertical Internal Dividers */}
              {validColSplits.map((split, k) => (
                <div
                  key={`col-split-${k}`}
                  className="absolute top-0 bottom-0 z-30 group/split pointer-events-auto touch-none cursor-col-resize flex items-center justify-center -translate-x-1/2 select-none"
                  style={{
                    left: `${split * 100}%`,
                    width: '18px',
                  }}
                  onPointerDown={(e) => handleSplitPointerDown(e, 'col', k)}
                  title={`拖动调节第 ${k + 1} 列与第 ${k + 2} 列内部间距 (位置: ${Math.round(split * 100)}%)`}
                >
                  <div
                    className={`w-[2px] h-full transition-colors ${
                      activeDraggingSplit?.type === 'col' && activeDraggingSplit?.index === k
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

              {/* 8 Distinct Resize Handles (4 Corners + 4 Edge Midpoints) */}
              <div
                className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nwse-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
                title="拉动缩放左上角"
              />
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ns-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'n')}
                title="拉动缩放顶部边缘"
              />
              <div
                className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nesw-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'ne')}
                title="拉动缩放右上角"
              />
              <div
                className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ew-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'w')}
                title="拉动缩放左侧边缘"
              />
              <div
                className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ew-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'e')}
                title="拉动缩放右侧边缘"
              />
              <div
                className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nesw-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'sw')}
                title="拉动缩放左下角"
              />
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-ns-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 's')}
                title="拉动缩放底部边缘"
              />
              <div
                className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg z-50 cursor-nwse-resize hover:scale-125 hover:bg-emerald-50 transition-transform pointer-events-auto touch-none before:absolute before:-inset-2.5 before:content-['']"
                onPointerDown={(e) => handlePointerDown(e, 'se')}
                title="拉动缩放右下角"
              />
            </div>
          </div>

          {/* Quick Crop Alignment Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-stone-500 font-medium">快速裁切黑边:</span>
              <button
                type="button"
                onClick={() => applyCropPreset('removeTop30')}
                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium border border-stone-200 transition-all cursor-pointer"
              >
                剔除顶部 30% 黑边
              </button>
              <button
                type="button"
                onClick={() => applyCropPreset('removeTopBottom15')}
                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium border border-stone-200 transition-all cursor-pointer"
              >
                剔除上下各 15%
              </button>
              <button
                type="button"
                onClick={() => applyCropPreset('center80')}
                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium border border-stone-200 transition-all cursor-pointer"
              >
                居中 80% 区域
              </button>
              <button
                type="button"
                onClick={() => applyCropPreset('full')}
                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium border border-stone-200 transition-all cursor-pointer"
              >
                恢复 100% 满屏
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Parameter Controls & Action */}
        <div className="lg:col-span-5 space-y-4">
          {/* Section 1: Grid Presets */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>多宫格布局排列</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                {config.cols} 列 × {config.rows} 行 = {totalCells} 个表情
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: '16', label: '16 宫格', sub: '4×4 标准' },
                { id: '15', label: '15 宫格', sub: '5×3 矩形' },
                { id: '9', label: '9 宫格', sub: '3×3 经典' },
                { id: '20', label: '20 宫格', sub: '5×4 密集' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id as GridPreset)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    config.preset === p.id
                      ? 'border-[#07c160] bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="text-xs">{p.label}</div>
                  <div className="text-[10px] text-stone-500 font-mono">{p.sub}</div>
                </button>
              ))}
            </div>

            {/* Custom Cols & Rows */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/70">
              <div>
                <label className="text-[11px] text-stone-600 block mb-0.5">自定义列数 (Cols)</label>
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
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone-600 block mb-0.5">自定义行数 (Rows)</label>
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
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Precise Margin Sliders (Top, Bottom, Left, Right) */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-900">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                <span>精细边缘边距调节 (Margin %)</span>
              </span>
              <button
                type="button"
                onClick={resetCropToFull}
                className="text-[11px] text-stone-500 hover:text-emerald-700 underline font-normal cursor-pointer"
              >
                重置边距
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="flex justify-between text-stone-600 mb-0.5">
                  <span>顶部裁切 (Top)</span>
                  <span className="font-mono text-emerald-700">{marginTop}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={marginTop}
                  onChange={(e) => updateMargin('top', parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-stone-600 mb-0.5">
                  <span>底部裁切 (Bottom)</span>
                  <span className="font-mono text-emerald-700">{marginBottom}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={marginBottom}
                  onChange={(e) => updateMargin('bottom', parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-stone-600 mb-0.5">
                  <span>左侧裁切 (Left)</span>
                  <span className="font-mono text-emerald-700">{marginLeft}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={marginLeft}
                  onChange={(e) => updateMargin('left', parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-stone-600 mb-0.5">
                  <span>右侧裁切 (Right)</span>
                  <span className="font-mono text-emerald-700">{marginRight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={marginRight}
                  onChange={(e) => updateMargin('right', parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#07c160] cursor-pointer"
                />
              </div>
            </div>

            {/* Cell Padding Inset */}
            <div className="pt-2 border-t border-stone-200/70">
              <div className="flex justify-between text-[11px] text-stone-600 mb-0.5">
                <span>单格内缩边距 (避免切到邻格边缘)</span>
                <span className="font-mono text-emerald-700 font-bold">{config.paddingInset} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                value={config.paddingInset}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    paddingInset: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full accent-[#07c160] cursor-pointer"
              />
            </div>
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

          {/* Section 3: Transparency & White Outline & Format */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-900">
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-emerald-600" />
                <span>微信表情视觉合规设置</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                官方规范保障
              </span>
            </div>

            {/* Background Transparency Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-stone-800 flex items-center gap-1">
                  <span>自动抠除背景底色</span>
                </label>
                <p className="text-[11px] text-stone-500">将白底或纯色背景转为纯透明 PNG</p>
              </div>
              <input
                type="checkbox"
                checked={config.autoTransparent}
                onChange={(e) =>
                  onConfigChange({ ...config, autoTransparent: e.target.checked })
                }
                className="w-4 h-4 rounded text-emerald-600 accent-[#07c160] cursor-pointer"
              />
            </div>

            {config.autoTransparent && (
              <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-3 shadow-2xs">
                {/* Target Background Color + Eyedropper + Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-stone-700 font-semibold">目标底色:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePickColor}
                        className={`px-2 py-1 rounded text-xs border flex items-center gap-1 transition-all cursor-pointer ${
                          isPickingColor
                            ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold animate-pulse'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                        }`}
                        title="吸管吸色 (可直接在左侧图片上点击采样)"
                      >
                        <Pipette className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{isPickingColor ? '点击图内像素' : '吸管吸色'}</span>
                      </button>
                      <div className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                        <input
                          type="color"
                          value={config.bgColor}
                          onChange={(e) => onConfigChange({ ...config, bgColor: e.target.value })}
                          className="w-5 h-5 rounded border-0 p-0 cursor-pointer bg-transparent"
                        />
                        <span className="font-mono text-xs text-stone-800 font-bold">{config.bgColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Preset Colors */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-stone-400">常用底色:</span>
                    {[
                      { label: '纯白', color: '#ffffff' },
                      { label: '浅灰', color: '#f5f5f5' },
                      { label: '纯黑', color: '#000000' },
                      { label: '绿幕', color: '#00ff00' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => onConfigChange({ ...config, bgColor: c.color })}
                        className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer flex items-center gap-1 ${
                          config.bgColor.toLowerCase() === c.color.toLowerCase()
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full border border-stone-300" style={{ backgroundColor: c.color }} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tolerance Slider & Quick Steps */}
                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 flex items-center gap-1">
                      <span>抠图容差 (Tolerance)</span>
                      <span className="text-[10px] text-stone-400 font-normal">拖动全图实时响应</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {config.tolerance}
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="5"
                    max="75"
                    value={config.tolerance}
                    onChange={(e) =>
                      onConfigChange({ ...config, tolerance: parseInt(e.target.value) || 20 })
                    }
                    className="w-full accent-[#07c160] cursor-pointer"
                  />

                  {/* Micro Stepper & Preset Buttons */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onConfigChange({ ...config, tolerance: Math.max(5, config.tolerance - 5) })
                        }
                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 text-stone-700 font-mono text-[10px] cursor-pointer"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onConfigChange({ ...config, tolerance: Math.max(5, config.tolerance - 1) })
                        }
                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 text-stone-700 font-mono text-[10px] cursor-pointer"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onConfigChange({ ...config, tolerance: Math.min(75, config.tolerance + 1) })
                        }
                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 text-stone-700 font-mono text-[10px] cursor-pointer"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onConfigChange({ ...config, tolerance: Math.min(75, config.tolerance + 5) })
                        }
                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 text-stone-700 font-mono text-[10px] cursor-pointer"
                      >
                        +5
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {[
                        { label: '弱 8', val: 8 },
                        { label: '推荐 14', val: 14 },
                        { label: '强 22', val: 22 },
                        { label: '深 32', val: 32 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => onConfigChange({ ...config, tolerance: item.val })}
                          className={`px-1.5 py-0.5 rounded text-[10px] border transition-all cursor-pointer ${
                            config.tolerance === item.val
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                              : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Real-time Single-Cell Magnifier & Quality Inspector */}
                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                      <span>单格高倍放大质检 (第 {(Math.max(0, Math.min(totalCells - 1, inspectCellIndex)) + 1).toString().padStart(2, '0')} 格)</span>
                    </div>

                    {/* Prev/Next Cell Switchers */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setInspectCellIndex((prev) => (prev > 0 ? prev - 1 : totalCells - 1))}
                        className="p-1 rounded hover:bg-stone-100 text-stone-600 border border-stone-200 cursor-pointer"
                        title="上一格"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectCellIndex((prev) => (prev < totalCells - 1 ? prev + 1 : 0))}
                        className="p-1 rounded hover:bg-stone-100 text-stone-600 border border-stone-200 cursor-pointer"
                        title="下一格"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Mode Toggles for Inspector */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                      <button
                        type="button"
                        onClick={() => setInspectViewMode('processed')}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                          inspectViewMode === 'processed'
                            ? 'bg-white text-stone-900 font-bold shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        ✨ 抠图效果
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectViewMode('original')}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                          inspectViewMode === 'original'
                            ? 'bg-white text-stone-900 font-bold shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        🖼️ 原图对比
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectViewMode('split')}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                          inspectViewMode === 'split'
                            ? 'bg-white text-stone-900 font-bold shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        🌓 并排对比
                      </button>
                    </div>

                    <span className="text-[10px] text-stone-500 font-mono">
                      透明像素: <strong className="text-emerald-700">{cellStats.transparentPercent}%</strong>
                    </span>
                  </div>

                  {/* Magnified Cell Canvas Display Card */}
                  <div className="flex items-center justify-center p-2.5 bg-stone-100 rounded-xl border border-stone-200/80">
                    {inspectViewMode === 'split' ? (
                      <div className="grid grid-cols-2 gap-3 w-full">
                        {/* Processed Cell */}
                        <div className="space-y-1">
                          <div className="text-[10px] text-stone-500 text-center font-medium">✨ 实时抠图后 (240×240)</div>
                          <div
                            className={`w-full aspect-square rounded-lg overflow-hidden border border-stone-300 relative shadow-2xs ${
                              previewBg === 'dark' ? 'bg-stone-950' : 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] bg-[size:12px_12px]'
                            }`}
                          >
                            <canvas ref={inspectCanvasRef} className="w-full h-full object-contain" />
                          </div>
                        </div>

                        {/* Original Cell */}
                        <div className="space-y-1">
                          <div className="text-[10px] text-stone-500 text-center font-medium">🖼️ 原图裁切</div>
                          <div className="w-full aspect-square rounded-lg overflow-hidden border border-stone-300 relative shadow-2xs bg-white">
                            <canvas ref={inspectOriginalCanvasRef} className="w-full h-full object-contain" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-44 h-44 rounded-xl overflow-hidden border-2 border-stone-300 shadow-md">
                        {/* Processed View */}
                        <div
                          className={`absolute inset-0 ${
                            inspectViewMode === 'original'
                              ? 'hidden'
                              : previewBg === 'dark'
                              ? 'bg-stone-950'
                              : 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] bg-[size:14px_14px]'
                          }`}
                        >
                          <canvas ref={inspectCanvasRef} className="w-full h-full object-contain" />
                        </div>

                        {/* Original View */}
                        <div className={`absolute inset-0 bg-white ${inspectViewMode === 'original' ? 'block' : 'hidden'}`}>
                          <canvas ref={inspectOriginalCanvasRef} className="w-full h-full object-contain" />
                        </div>

                        {/* Badge */}
                        <div className="absolute top-1 left-1 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.2 rounded">
                          第 {(Math.max(0, Math.min(totalCells - 1, inspectCellIndex)) + 1).toString().padStart(2, '0')} 格
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time Health Diagnosis Banner */}
                  <div
                    className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
                      cellStats.isHealthy === 'good'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : cellStats.isHealthy === 'low'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {cellStats.isHealthy === 'good' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      {cellStats.isHealthy === 'good' && (
                        <span>
                          <strong>容差恰当：</strong>底色已干净去除，人物边缘和白色文字细节保留完好。
                        </span>
                      )}
                      {cellStats.isHealthy === 'low' && (
                        <span>
                          <strong>容差偏小 (底色残留)：</strong>当前透明像素较低 ({cellStats.transparentPercent}%)，背景可能存在残留浅色噪点，建议适当调大容差。
                        </span>
                      )}
                      {cellStats.isHealthy === 'high' && (
                        <span>
                          <strong>容差偏大 (细节可能被扣)：</strong>透明区域占比过高 ({cellStats.transparentPercent}%)，请注意检查人物高光或白色文字是否被误扣除。
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2px White Outline Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-200/70">
              <div>
                <label className="text-xs font-semibold text-stone-800 flex items-center gap-1">
                  <span>添加微信 2px 白色保护描边</span>
                </label>
                <p className="text-[11px] text-stone-500">防止深色聊天背景下人物被吞掉</p>
              </div>
              <input
                type="checkbox"
                checked={config.addWhiteOutline}
                onChange={(e) =>
                  onConfigChange({ ...config, addWhiteOutline: e.target.checked })
                }
                className="w-4 h-4 rounded text-emerald-600 accent-[#07c160] cursor-pointer"
              />
            </div>

            {/* Output Format Selection */}
            <div className="pt-2 border-t border-stone-200/70 space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-700 block">切片输出格式:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onConfigChange({ ...config, outputFormat: 'png' })}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    config.outputFormat !== 'gif'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>240×240 PNG</span>
                    <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded">官方标准</span>
                  </div>
                  <div className="text-[10px] text-stone-500 mt-0.5">纯透明背景，清晰无噪点</div>
                </button>

                <button
                  type="button"
                  onClick={() => onConfigChange({ ...config, outputFormat: 'gif' })}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    config.outputFormat === 'gif'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>240×240 GIF</span>
                  </div>
                  <div className="text-[10px] text-stone-500 mt-0.5">静态单帧 GIF 格式</div>
                </button>
              </div>
            </div>
          </div>

          {/* Action Button: Start Slicing */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={isSlicing}
              className="w-full py-3.5 px-4 rounded-xl bg-[#07c160] hover:bg-[#06ad56] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSlicing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>切片生成中 ({sliceProgress}%)...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>开始切片并生成全套 5 大微信审核物料</span>
                </>
              )}
            </button>

            {isSlicing && (
              <div className="mt-2 text-center text-xs text-stone-500 font-mono">
                {sliceStatusText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
