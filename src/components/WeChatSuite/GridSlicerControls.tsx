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
} from 'lucide-react';
import { GridConfig, GridPreset, GridCropArea } from '../../types';
import {
  removeBackgroundFromFrame,
  applyWhiteOutline,
  rgbToHex,
} from '../../utils/gifProcessor';

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

  // Active cropArea with fallback
  const cropArea: GridCropArea = config.cropArea || { x: 0, y: 0, width: 100, height: 100 };
  const currentSpeed = config.speed || 1.0;
  const rawClipDuration = Math.max(0.1, config.endTime - config.startTime);
  const effectiveStickerDuration = rawClipDuration / currentSpeed;

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
    const cellW = cropW / cellCols;
    const cellH = cropH / cellRows;
    const safeIdx = Math.max(0, Math.min(cellCols * cellRows - 1, inspectCellIndex));
    const cellCol = safeIdx % cellCols;
    const cellRow = Math.floor(safeIdx / cellCols);

    const inset = config.paddingInset || 0;
    const singleCellX = cropX + cellCol * cellW + inset;
    const singleCellY = cropY + cellRow * cellH + inset;
    const singleCellW = Math.max(4, cellW - inset * 2);
    const singleCellH = Math.max(4, cellH - inset * 2);

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
            setCellStats({ transparentPercent: 0, health: 'good' });
            inspCtx.drawImage(offInsp, 0, 0);
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
    if (preset === '16') {
      onConfigChange({ ...config, preset: '16', cols: 4, rows: 4 });
    } else if (preset === '15') {
      onConfigChange({ ...config, preset: '15', cols: 5, rows: 3 });
    } else if (preset === '9') {
      onConfigChange({ ...config, preset: '9', cols: 3, rows: 3 });
    } else if (preset === '20') {
      onConfigChange({ ...config, preset: '20', cols: 5, rows: 4 });
    } else {
      onConfigChange({ ...config, preset: 'custom' });
    }
  };

  // Helper to update cropArea directly
  const updateCrop = (newCrop: Partial<GridCropArea>) => {
    const updated: GridCropArea = {
      x: Math.max(0, Math.min(95, newCrop.x !== undefined ? newCrop.x : cropArea.x)),
      y: Math.max(0, Math.min(95, newCrop.y !== undefined ? newCrop.y : cropArea.y)),
      width: Math.max(5, Math.min(100, newCrop.width !== undefined ? newCrop.width : cropArea.width)),
      height: Math.max(5, Math.min(100, newCrop.height !== undefined ? newCrop.height : cropArea.height)),
    };
    // Ensure boundaries
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

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const deltaXPercent = ((ev.clientX - startX) / containerRect.width) * 100;
      const deltaYPercent = ((ev.clientY - startY) / containerRect.height) * 100;

      let newCrop = { ...startCrop };

      if (handle === 'move') {
        newCrop.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent));
        newCrop.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent));
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
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const totalCells = config.cols * config.rows;
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
        {/* Left: Video Player with Live Grid Overlay (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div
            ref={videoContainerRef}
            onClick={handleContainerClick}
            className={`relative w-full bg-stone-950 rounded-xl overflow-hidden shadow-inner flex items-center justify-center select-none ${
              isPickingColor ? 'cursor-crosshair ring-2 ring-amber-400' : ''
            }`}
            style={{
              aspectRatio: videoDimensions.width && videoDimensions.height ? `${videoDimensions.width} / ${videoDimensions.height}` : '16 / 9',
              maxHeight: '520px',
            }}
          >
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

            {/* Dimmed backdrop outside active crop area */}
            {isCustomCropActive && (
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

            {/* Overlaid Interactive Grid Bounding Box */}
            {showGridOverlay && (
              <div
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
                    gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
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

                        {isSelected && (
                          <span className="text-[9px] font-bold bg-amber-400 text-stone-950 px-1 rounded shadow-xs pointer-events-none">
                            质检格
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

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
            <button
              type="button"
              onClick={togglePlay}
              className="absolute bottom-3 left-3 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs flex items-center gap-1.5 backdrop-blur-xs shadow-md border border-white/20 transition-all z-10"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? '暂停播放' : '播放循环'}</span>
            </button>

            {/* Time indicator overlay */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/75 text-white text-[11px] font-mono backdrop-blur-xs border border-white/20 z-10 flex items-center gap-1.5 shadow-md">
              <span>{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
              {currentSpeed !== 1 && (
                <span className="text-amber-400 font-bold bg-amber-400/20 px-1.5 py-0.2 rounded text-[10px] border border-amber-400/30">
                  {currentSpeed.toFixed(1)}x
                </span>
              )}
            </div>
          </div>

          {/* Timeline & Trim Range Slider + Playback Speed Acceleration */}
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
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      preset: 'custom',
                      cols: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)),
                    })
                  }
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
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      preset: 'custom',
                      rows: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)),
                    })
                  }
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

            {/* Quick Presets for Removing Black Bars / Margins */}
            <div>
              <span className="text-[11px] text-stone-500 block mb-1.5">一键快捷对齐与去黑边:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyCropPreset('removeTop30')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>剔除顶部 30% 黑边</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('removeTopBottom15')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <span>剔除上下各 15% 黑边</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('center80')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-stone-800 hover:text-emerald-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>居中缩放 80% 区域</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCropPreset('full')}
                  className="px-2 py-1.5 text-[11px] font-medium bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 rounded-lg text-left transition-colors flex items-center gap-1.5"
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
    </div>
  );
};
