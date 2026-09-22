import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Paintbrush,
  Square,
  Lasso,
  Grid,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Sparkles,
  Download,
  ArrowRight,
  Upload,
  Layers,
  CheckCircle2,
  Scissors,
  Sliders,
  ShieldCheck,
  AlertCircle,
  Pipette,
  Smile,
  Wand2,
  Plus,
  Minus,
  Settings2,
  Link2,
  Unlink2,
  ChevronDown,
  X,
  Scaling,
  Check,
  FileDown,
  ArrowUpDown,
} from 'lucide-react';
import { RetouchTool, RetouchOptions } from '../../types';

export interface ExportSizeConfig {
  mode: 'original' | 'scale' | 'preset' | 'custom';
  scalePercent: number; // 25, 50, 75, 100
  preset: 'original' | '240' | '512' | '750' | '1080' | 'custom';
  customWidth: number;
  customHeight: number;
  lockAspectRatio: boolean;
  format: 'png' | 'jpeg' | 'webp';
  quality: number; // 0.1 to 1.0 (default 0.92)
  fillBgForJpeg: string; // default '#ffffff'
}
import {
  applyInpainting,
  applyRectInpaint,
  applyMosaic,
  applyBlur,
  generateDemoWatermarkedImage,
  applyTransparentErasure,
  applyRectTransparent,
  applyEyedropperTransparent,
  applyRestoreOriginal,
  applyRemoveAllTransparency,
} from '../../utils/imageInpainting';
import {
  applyWhiteOutline,
  removeBackgroundFromFrame,
  detectBackgroundColor,
} from '../../utils/gifProcessor';

interface ImageRetouchWorkspaceProps {
  initialFile?: File | null;
  onSendToStaticSlicer?: (file: File) => void;
  onSendToTransparency?: (file: File) => void;
  onSyncToBatch?: (file: File) => void;
  showToast?: (msg: string) => void;
  onImageLoadedStateChange?: (hasImage: boolean) => void;
}

export const ImageRetouchWorkspace: React.FC<ImageRetouchWorkspaceProps> = ({
  initialFile,
  onSendToStaticSlicer,
  onSendToTransparency,
  onSyncToBatch,
  showToast,
  onImageLoadedStateChange,
}) => {
  // Image & File State
  const [currentFile, setCurrentFile] = useState<File | null>(initialFile || null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // History Stack for Undo/Redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Original untouched image data for "Hold to Compare"
  const originalImageDataRef = useRef<ImageData | null>(null);
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);

  // Cached Container Bounding Rect to eliminate getBoundingClientRect layout reflow on mousemove
  const containerRectRef = useRef<DOMRect | null>(null);

  // Tools & Options
  const [options, setOptions] = useState<RetouchOptions>({
    tool: 'brush-remove',
    brushSize: 24,
    eraserSize: 24,
    mosaicSize: 16,
    blurRadius: 10,
    mosaicStyle: 'pixel',
    autoFeather: true,
    colorTolerance: 25,
    contiguous: true,
    whiteOutlinePreview: false,
  });

  // Auto inpaint immediately upon releasing mouse brush
  const [autoInpaintOnRelease, setAutoInpaintOnRelease] = useState<boolean>(true);

  // Canvas Stage Background Theme ('checker' | 'light' | 'white' | 'dark')
  const [canvasBg, setCanvasBg] = useState<'checker' | 'light' | 'white' | 'dark'>('checker');

  // Interactive Cursor Position Tracking with Zero React re-render lag
  const brushCursorRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMouseOverCanvas, setIsMouseOverCanvas] = useState(false);

  // Top mode toggle: 'repair' (default inpainting watermark removal, keep background, never transparent) vs 'transparent' (optional cut-out)
  const [retouchMode, setRetouchMode] = useState<'repair' | 'transparent'>('repair');

  // Export Size and Format Settings (控制下载图片大小与规格)
  const [exportConfig, setExportConfig] = useState<ExportSizeConfig>({
    mode: 'original',
    scalePercent: 100,
    preset: 'original',
    customWidth: 0,
    customHeight: 0,
    lockAspectRatio: true,
    format: 'png',
    quality: 0.92,
    fillBgForJpeg: '#ffffff',
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [estimatedFileSize, setEstimatedFileSize] = useState<string>('');

  // Fast sample check whether current canvas has transparent pixels
  const hasTransparentPixels = useMemo(() => {
    if (historyIndex < 0 || !history[historyIndex]) return false;
    const data = history[historyIndex].data;
    const len = data.length;
    for (let i = 3; i < len; i += 4 * 16) {
      if (data[i] < 250) return true;
    }
    return false;
  }, [history, historyIndex]);

  // Canvas viewport frame mode: 'fit-image' (tightly wrapped image display) vs 'free-studio' (wide pan/zoom studio)
  const [canvasFrameMode, setCanvasFrameMode] = useState<'fit-image' | 'free-studio'>('fit-image');

  // Drag and Drop Upload State
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const uploadDragCounterRef = useRef(0);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const canvasDragCounterRef = useRef(0);

  // Canvas Viewport Transforms (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mask Buffer for Brush / Lasso
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasActiveMask, setHasActiveMask] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Marquee Selection State for Rect Tool
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isSelectingRect, setIsSelectingRect] = useState(false);
  const rectStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Lasso Points
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);

  // DOM Canvas References
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load image into canvas and initialize history
  const loadImage = useCallback((file: File) => {
    setCurrentFile(file);
    const url = URL.createObjectURL(file);
    setOriginalImageUrl(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      setImageSize({ width: w, height: h });
      setExportConfig((prev) => ({
        ...prev,
        customWidth: prev.mode === 'custom' && prev.customWidth ? prev.customWidth : w,
        customHeight: prev.mode === 'custom' && prev.customHeight ? prev.customHeight : h,
      }));

      // Init Main Canvas
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);

      const initialData = ctx.getImageData(0, 0, w, h);
      originalImageDataRef.current = initialData;

      // Init Mask Canvas
      if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas');
      }
      maskCanvasRef.current.width = w;
      maskCanvasRef.current.height = h;
      const mCtx = maskCanvasRef.current.getContext('2d')!;
      mCtx.clearRect(0, 0, w, h);

      // Init Overlay Canvas
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = w;
        overlayCanvasRef.current.height = h;
        const oCtx = overlayCanvasRef.current.getContext('2d')!;
        oCtx.clearRect(0, 0, w, h);
      }

      setHistory([initialData]);
      setHistoryIndex(0);
      setHasActiveMask(false);
      setMarqueeRect(null);

      // Center image in container
      const updateCentering = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        containerRectRef.current = rect;
        const cw = rect.width > 0 ? rect.width : (containerRef.current.clientWidth || 800);
        const ch = rect.height > 0 ? rect.height : (containerRef.current.clientHeight || 520);
        const padding = 24;
        const fitScale = Math.min((cw - padding * 2) / w, (ch - padding * 2) / h);
        let targetZoom = 1.0;
        if (w <= 280 && h <= 280) {
          // For WeChat standard stickers (240x240), zoom comfortably to ~360px (1.5x) so user can see and work on details easily
          targetZoom = Math.min(fitScale, 1.5);
        } else if (fitScale < 1.0) {
          targetZoom = fitScale;
        }
        targetZoom = Math.max(0.2, Math.round(targetZoom * 10) / 10);
        setZoom(targetZoom);
        setPan({
          x: Math.max(0, Math.round((cw - w * targetZoom) / 2)),
          y: Math.max(0, Math.round((ch - h * targetZoom) / 2)),
        });
      };

      requestAnimationFrame(updateCentering);
      setTimeout(updateCentering, 60);
      setTimeout(updateCentering, 250);
      onImageLoadedStateChange?.(true);
    };
    img.src = url;
  }, [onImageLoadedStateChange]);

  // Handle Initial File
  useEffect(() => {
    if (initialFile) {
      loadImage(initialFile);
    }
  }, [initialFile, loadImage]);

  // Handle Demo Image Load
  const handleLoadDemo = async () => {
    try {
      const demo = await generateDemoWatermarkedImage();
      loadImage(demo.file);
      showToast?.('已加载示例 AI 带水印表情，可使用圈选或涂抹快速去除！');
    } catch (err) {
      console.error(err);
    }
  };

  // Keyboard Shortcuts (Space for Pan, Ctrl+Z, Ctrl+Y, B, R, M, E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        setSpacePressed(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'b' || e.key === 'B') {
        setOptions((prev) => ({ ...prev, tool: 'brush-remove' }));
      } else if (e.key === 'r' || e.key === 'R') {
        setOptions((prev) => ({ ...prev, tool: 'rect-remove' }));
      } else if (e.key === 'm' || e.key === 'M') {
        setOptions((prev) => ({ ...prev, tool: 'mosaic' }));
      } else if (e.key === 'e' || e.key === 'E') {
        setOptions((prev) => ({ ...prev, tool: 'eraser' }));
      } else if (e.key === 'h' || e.key === 'H') {
        setOptions((prev) => ({ ...prev, tool: 'pan' }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [historyIndex, history]);

  // Coordinate Conversion: Screen to Canvas Natural Coordinates
  const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = mainCanvasRef.current;
    if (!canvas || imageSize.width === 0 || imageSize.height === 0) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const x = Math.round(((clientX - rect.left) / rect.width) * imageSize.width);
    const y = Math.round(((clientY - rect.top) / rect.height) * imageSize.height);
    return {
      x: Math.max(0, Math.min(imageSize.width, x)),
      y: Math.max(0, Math.min(imageSize.height, y)),
    };
  };

  // Push new state to history
  const pushHistory = (newData: ImageData) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newData);
    // Keep max 20 steps
    if (nextHistory.length > 20) {
      nextHistory.shift();
    }
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);

    // Redraw on main canvas
    const canvas = mainCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(newData, 0, 0);
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      const data = history[newIdx];
      const canvas = mainCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(data, 0, 0);
      }
      clearOverlay();
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      const data = history[newIdx];
      const canvas = mainCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(data, 0, 0);
      }
      clearOverlay();
    }
  };

  // Reset to original
  const handleReset = () => {
    if (originalImageDataRef.current) {
      pushHistory(originalImageDataRef.current);
      clearOverlay();
      showToast?.('已重置为初始图片');
    }
  };

  // Clear mask & overlay
  const clearOverlay = () => {
    if (maskCanvasRef.current) {
      const mCtx = maskCanvasRef.current.getContext('2d')!;
      mCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    }
    if (overlayCanvasRef.current) {
      const oCtx = overlayCanvasRef.current.getContext('2d')!;
      oCtx.clearRect(0, 0, imageSize.width, imageSize.height);
    }
    setHasActiveMask(false);
    setMarqueeRect(null);
  };

  // Redraw overlay (translucent brush mask or dashed marquee)
  const renderOverlay = () => {
    if (!overlayCanvasRef.current || !maskCanvasRef.current) return;
    const oCtx = overlayCanvasRef.current.getContext('2d')!;
    oCtx.clearRect(0, 0, imageSize.width, imageSize.height);

    // Draw brush mask with semi-transparent tint
    oCtx.save();
    oCtx.globalAlpha = 0.55;
    oCtx.drawImage(maskCanvasRef.current, 0, 0);
    oCtx.restore();

    // Draw Rect Marquee if active
    if (marqueeRect && marqueeRect.width > 2 && marqueeRect.height > 2) {
      oCtx.save();
      const isTrans = options.tool === 'rect-transparent';
      const isMosaic = options.tool === 'mosaic';
      // Translucent fill
      oCtx.fillStyle = isTrans
        ? 'rgba(6, 182, 212, 0.25)'
        : isMosaic
        ? 'rgba(99, 102, 241, 0.25)'
        : 'rgba(239, 68, 68, 0.25)';
      oCtx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);

      // Marching ants / dashed border
      oCtx.strokeStyle = isTrans ? '#06b6d4' : isMosaic ? '#6366f1' : '#ef4444';
      oCtx.lineWidth = 2 / zoom;
      oCtx.setLineDash([4 / zoom, 4 / zoom]);
      oCtx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
      oCtx.restore();
    }
  };

  // Execute inpaint or transparent erasure on current mask
  const executeInpaint = () => {
    if (!mainCanvasRef.current || !maskCanvasRef.current || historyIndex < 0) return;
    const ctx = mainCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
    const currentData = ctx.getImageData(0, 0, imageSize.width, imageSize.height);

    // Extract mask byte array
    const mCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
    const maskData = mCtx.getImageData(0, 0, imageSize.width, imageSize.height).data;
    const totalPixels = imageSize.width * imageSize.height;
    const maskArray = new Uint8Array(totalPixels);

    let hasMaskPixels = false;
    for (let i = 0; i < totalPixels; i++) {
      if (maskData[i * 4 + 3] > 20) {
        maskArray[i] = 255;
        hasMaskPixels = true;
      }
    }

    if (!hasMaskPixels) return;

    let repairedData: ImageData;
    if (options.tool === 'brush-transparent') {
      repairedData = applyTransparentErasure(currentData, maskArray);
      pushHistory(repairedData);
      clearOverlay();
      showToast?.('涂抹擦除完成！所划选区域已转为 100% 透明底');
      return;
    } else if (options.tool === 'brush-restore') {
      if (!originalImageDataRef.current) return;
      repairedData = applyRestoreOriginal(currentData, originalImageDataRef.current, maskArray);
      pushHistory(repairedData);
      clearOverlay();
      showToast?.('已消除透底！恢复划选区域为原图不透明内容');
      return;
    } else if (options.tool === 'mosaic' || (options.tool === 'brush-remove' && options.mosaicStyle === 'blur')) {
      if (options.mosaicStyle === 'blur') {
        repairedData = applyBlur(currentData, maskArray, options.blurRadius);
      } else {
        repairedData = applyMosaic(currentData, maskArray, options.mosaicSize);
      }
    } else {
      repairedData = applyInpainting(currentData, maskArray);
    }

    pushHistory(repairedData);
    clearOverlay();
    showToast?.('消除完成！已智能融合周围纹理');
  };

  // One-click eliminate all transparency in current image (restore original or fill white)
  const handleRemoveAllTransparency = (fillMode: 'original' | 'white' = 'original') => {
    if (!mainCanvasRef.current || historyIndex < 0) return;
    const ctx = mainCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
    const currentData = ctx.getImageData(0, 0, imageSize.width, imageSize.height);

    const restored = applyRemoveAllTransparency(currentData, originalImageDataRef.current, fillMode);
    pushHistory(restored);
    clearOverlay();
    if (fillMode === 'original') {
      showToast?.('已消除全部透底区域，完整恢复为初始不透明原图！');
    } else {
      showToast?.('已消除全部透底区域，已填充为纯白背景！');
    }
  };

  // Fast 2D incremental dot rendering (0 React state overhead)
  const drawStartDot = (point: { x: number; y: number }, tool: RetouchTool, bSize: number) => {
    const mCanvas = maskCanvasRef.current;
    const oCanvas = overlayCanvasRef.current;
    if (!mCanvas || !oCanvas) return;
    const mCtx = mCanvas.getContext('2d')!;
    const oCtx = oCanvas.getContext('2d')!;

    const color =
      tool === 'brush-transparent'
        ? '#06b6d4'
        : tool === 'brush-restore'
        ? '#10b981'
        : tool === 'mosaic' || tool === 'blur'
        ? '#8b5cf6'
        : '#ff4757';

    mCtx.save();
    if (tool === 'eraser') {
      mCtx.globalCompositeOperation = 'destination-out';
    } else {
      mCtx.globalCompositeOperation = 'source-over';
      mCtx.fillStyle = color;
    }
    mCtx.beginPath();
    mCtx.arc(point.x, point.y, bSize / 2, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.restore();

    oCtx.save();
    if (tool === 'eraser') {
      oCtx.globalCompositeOperation = 'destination-out';
    } else {
      oCtx.globalCompositeOperation = 'source-over';
      oCtx.globalAlpha = 0.55;
      oCtx.fillStyle = color;
    }
    oCtx.beginPath();
    oCtx.arc(point.x, point.y, bSize / 2, 0, Math.PI * 2);
    oCtx.fill();
    oCtx.restore();
  };

  // Fast 2D incremental stroke rendering (0 React state overhead, 120fps responsive)
  const drawIncrementalSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    tool: RetouchTool,
    bSize: number
  ) => {
    const mCanvas = maskCanvasRef.current;
    const oCanvas = overlayCanvasRef.current;
    if (!mCanvas || !oCanvas) return;
    const mCtx = mCanvas.getContext('2d')!;
    const oCtx = oCanvas.getContext('2d')!;

    const color =
      tool === 'brush-transparent'
        ? '#06b6d4'
        : tool === 'brush-restore'
        ? '#10b981'
        : tool === 'mosaic' || tool === 'blur'
        ? '#8b5cf6'
        : '#ff4757';

    mCtx.save();
    if (tool === 'eraser') {
      mCtx.globalCompositeOperation = 'destination-out';
    } else {
      mCtx.globalCompositeOperation = 'source-over';
      mCtx.strokeStyle = color;
      mCtx.fillStyle = color;
    }
    mCtx.lineWidth = bSize;
    mCtx.lineCap = 'round';
    mCtx.lineJoin = 'round';
    mCtx.beginPath();
    mCtx.moveTo(from.x, from.y);
    mCtx.lineTo(to.x, to.y);
    mCtx.stroke();
    mCtx.restore();

    oCtx.save();
    if (tool === 'eraser') {
      oCtx.globalCompositeOperation = 'destination-out';
    } else {
      oCtx.globalCompositeOperation = 'source-over';
      oCtx.globalAlpha = 0.55;
      oCtx.strokeStyle = color;
      oCtx.fillStyle = color;
    }
    oCtx.lineWidth = bSize;
    oCtx.lineCap = 'round';
    oCtx.lineJoin = 'round';
    oCtx.beginPath();
    oCtx.moveTo(from.x, from.y);
    oCtx.lineTo(to.x, to.y);
    oCtx.stroke();
    oCtx.restore();
  };

  // One-click intelligent background removal
  const handleOneClickRemoveBg = () => {
    if (!mainCanvasRef.current || historyIndex < 0) return;
    const ctx = mainCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
    const currentData = ctx.getImageData(0, 0, imageSize.width, imageSize.height);

    const detected = detectBackgroundColor([{ imageData: currentData, delay: 0 }], imageSize.width, imageSize.height) || '#ffffff';
    const result = removeBackgroundFromFrame(currentData, {
      targetColor: detected,
      tolerance: options.colorTolerance || 25,
      contiguous: options.contiguous ?? true,
      defringe: 1,
    });

    pushHistory(result);
    clearOverlay();
    showToast?.(`已智能去除背景色 (${detected}) 为透明！`);
  };

  // One-click add WeChat 2px white outline
  const handleOneClickWhiteOutline = () => {
    if (!mainCanvasRef.current || historyIndex < 0) return;
    const ctx = mainCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
    const currentData = ctx.getImageData(0, 0, imageSize.width, imageSize.height);

    const result = applyWhiteOutline(currentData, 2, '#ffffff');
    pushHistory(result);
    clearOverlay();
    showToast?.('已叠加微信官方标准 2px 保护白描边！');
  };

  // Sync / Send current clean image to batch transparency list
  const handleSyncToBatch = async () => {
    if (!mainCanvasRef.current) return;
    const blob = await new Promise<Blob>((resolve) => {
      mainCanvasRef.current!.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });
    const baseName = (currentFile?.name || 'sticker').replace(/\.[^/.]+$/, '');
    const file = new File([blob], `${baseName}_clean.png`, { type: 'image/png' });
    if (onSyncToBatch) {
      onSyncToBatch(file);
    } else if (onSendToTransparency) {
      onSendToTransparency(file);
    }
    showToast?.('已将修图与透底结果同步至批量列表！');
  };

  // Mouse Handlers on Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    }

    if (e.button === 1 || spacePressed || options.tool === 'pan') {
      // Pan mode
      setIsPanning(true);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return; // Only left click

    const coords = getCanvasCoords(e.clientX, e.clientY);

    // Eyedropper point click to transparency
    if (options.tool === 'color-transparent') {
      if (!mainCanvasRef.current || historyIndex < 0) return;
      const ctx = mainCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
      const currentData = ctx.getImageData(0, 0, imageSize.width, imageSize.height);
      const p = (coords.y * imageSize.width + coords.x) * 4;
      const targetRgb: [number, number, number] = [
        currentData.data[p],
        currentData.data[p + 1],
        currentData.data[p + 2],
      ];
      const resultData = applyEyedropperTransparent(
        currentData,
        targetRgb,
        options.colorTolerance || 25,
        options.contiguous ?? true,
        coords.x,
        coords.y
      );
      pushHistory(resultData);
      clearOverlay();
      showToast?.(`已吸取颜色 rgb(${targetRgb.join(',')}) 并清除为透明！`);
      return;
    }

    const isBrushTool = [
      'brush-remove',
      'brush-transparent',
      'brush-restore',
      'mosaic',
      'blur',
      'eraser',
    ].includes(options.tool);

    if (
      options.tool === 'rect-remove' ||
      options.tool === 'rect-transparent' ||
      (options.tool === 'mosaic' && e.altKey)
    ) {
      // Rect Marquee Selection Start
      setIsSelectingRect(true);
      rectStartPosRef.current = coords;
      setMarqueeRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
    } else if (options.tool === 'lasso-remove') {
      // Lasso Start
      isDrawingRef.current = true;
      setIsDrawing(true);
      lassoPointsRef.current = [coords];
      const mCanvas = maskCanvasRef.current;
      if (mCanvas) {
        const mCtx = mCanvas.getContext('2d')!;
        mCtx.beginPath();
        mCtx.moveTo(coords.x, coords.y);
      }
      setHasActiveMask(true);
    } else if (isBrushTool) {
      // High-performance Brush / Eraser Mode (Instant GPU/2D Canvas path, zero React lag)
      isDrawingRef.current = true;
      setIsDrawing(true);
      lastCoordRef.current = coords;
      const bSize = options.tool === 'eraser' ? options.eraserSize : options.brushSize;
      drawStartDot(coords, options.tool, bSize);
      setHasActiveMask(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Direct hardware-accelerated cursor placement with GPU translate3d (zero layout reflow, zero lag)
    if (brushCursorRef.current && containerRef.current) {
      const rect = containerRectRef.current || containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      brushCursorRef.current.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
    }

    if (isPanning) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const coords = getCanvasCoords(e.clientX, e.clientY);

    if (isSelectingRect) {
      const sx = rectStartPosRef.current.x;
      const sy = rectStartPosRef.current.y;
      const minX = Math.min(sx, coords.x);
      const minY = Math.min(sy, coords.y);
      const w = Math.abs(coords.x - sx);
      const h = Math.abs(coords.y - sy);
      setMarqueeRect({ x: minX, y: minY, width: w, height: h });
      renderOverlay();
    } else if (isDrawingRef.current && options.tool === 'lasso-remove') {
      lassoPointsRef.current.push(coords);
      const mCanvas = maskCanvasRef.current;
      if (mCanvas) {
        const mCtx = mCanvas.getContext('2d')!;
        mCtx.strokeStyle = '#ff4757';
        mCtx.lineWidth = 2;
        mCtx.lineTo(coords.x, coords.y);
        mCtx.stroke();
      }
      renderOverlay();
    } else if (
      isDrawingRef.current &&
      ['brush-remove', 'brush-transparent', 'brush-restore', 'mosaic', 'blur', 'eraser'].includes(options.tool)
    ) {
      // Direct incremental line on 2D context - ultra-responsive 120 FPS
      const bSize = options.tool === 'eraser' ? options.eraserSize : options.brushSize;
      drawIncrementalSegment(lastCoordRef.current, coords, options.tool, bSize);
      lastCoordRef.current = coords;
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isSelectingRect && marqueeRect) {
      setIsSelectingRect(false);
      if (marqueeRect.width > 3 && marqueeRect.height > 3) {
        if (!mainCanvasRef.current || historyIndex < 0) return;
        const ctx = mainCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
        const currentData = ctx.getImageData(0, 0, imageSize.width, imageSize.height);

        let resultData: ImageData;
        if (options.tool === 'rect-transparent') {
          resultData = applyRectTransparent(currentData, marqueeRect);
          pushHistory(resultData);
          clearOverlay();
          showToast?.('已将所选矩形框区域清除为 100% 透明底！');
        } else if (options.tool === 'mosaic') {
          const mask = new Uint8Array(imageSize.width * imageSize.height);
          const rx = Math.round(marqueeRect.x);
          const ry = Math.round(marqueeRect.y);
          const rw = Math.round(marqueeRect.width);
          const rh = Math.round(marqueeRect.height);
          for (let y = ry; y < ry + rh; y++) {
            for (let x = rx; x < rx + rw; x++) {
              mask[y * imageSize.width + x] = 255;
            }
          }
          if (options.mosaicStyle === 'blur') {
            resultData = applyBlur(currentData, mask, options.blurRadius);
          } else {
            resultData = applyMosaic(currentData, mask, options.mosaicSize);
          }
          pushHistory(resultData);
          clearOverlay();
          showToast?.('已圈选并应用马赛克！');
        } else {
          // Rect Inpaint
          resultData = applyRectInpaint(currentData, marqueeRect);
          pushHistory(resultData);
          clearOverlay();
          showToast?.('已圈选并智能去除水印！');
        }
      } else {
        clearOverlay();
      }
      return;
    }

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      setIsDrawing(false);

      if (options.tool === 'brush-transparent') {
        // Execute transparency erasure immediately upon releasing mouse stroke
        executeInpaint();
        return;
      }
      if (options.tool === 'brush-restore') {
        // Restore original image content immediately upon releasing mouse stroke
        executeInpaint();
        return;
      }
      if (options.tool === 'brush-remove') {
        if (autoInpaintOnRelease) {
          executeInpaint();
        }
        return;
      }
      if (options.tool === 'lasso-remove' && lassoPointsRef.current.length > 2) {
        // Fill lasso polygon into mask canvas
        const mCanvas = maskCanvasRef.current;
        if (mCanvas) {
          const mCtx = mCanvas.getContext('2d')!;
          mCtx.fillStyle = '#ff4757';
          mCtx.beginPath();
          mCtx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
          for (let i = 1; i < lassoPointsRef.current.length; i++) {
            mCtx.lineTo(lassoPointsRef.current[i].x, lassoPointsRef.current[i].y);
          }
          mCtx.closePath();
          mCtx.fill();
        }
        renderOverlay();
        // Immediately execute inpaint for lasso selection
        executeInpaint();
      }
    }
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.15, Math.min(6.0, zoom * zoomFactor));

    // Zoom towards mouse position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  // Fit image to viewport
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || imageSize.width === 0 || imageSize.height === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cw = rect.width > 0 ? rect.width : (containerRef.current.clientWidth || 800);
    const ch = rect.height > 0 ? rect.height : (containerRef.current.clientHeight || 520);
    const padding = 28;
    const fitScale = Math.min((cw - padding * 2) / imageSize.width, (ch - padding * 2) / imageSize.height);
    let targetZoom = 1.0;
    if (imageSize.width <= 280 && imageSize.height <= 280) {
      targetZoom = Math.min(fitScale, 1.5);
    } else if (fitScale < 1.0) {
      targetZoom = fitScale;
    }
    targetZoom = Math.max(0.15, Math.round(targetZoom * 10) / 10);
    setZoom(targetZoom);
    setPan({
      x: Math.max(0, Math.round((cw - imageSize.width * targetZoom) / 2)),
      y: Math.max(0, Math.round((ch - imageSize.height * targetZoom) / 2)),
    });
  }, [imageSize]);

  // Keep image centered whenever viewport or container size changes
  useEffect(() => {
    if (!containerRef.current || imageSize.width === 0 || imageSize.height === 0) return;
    const observer = new ResizeObserver(() => {
      handleFitToScreen();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageSize, handleFitToScreen, canvasFrameMode]);

  // Reset zoom to 100% (1:1)
  const handleResetZoom100 = useCallback(() => {
    if (!containerRef.current || imageSize.width === 0 || imageSize.height === 0) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    setZoom(1.0);
    setPan({
      x: Math.round((cw - imageSize.width) / 2),
      y: Math.round((ch - imageSize.height) / 2),
    });
  }, [imageSize]);

  // Calculate Target Export Dimensions (分辨率控制)
  const targetDimensions = useMemo(() => {
    if (imageSize.width === 0 || imageSize.height === 0) return { width: 0, height: 0 };
    if (exportConfig.mode === 'original') {
      return { width: imageSize.width, height: imageSize.height };
    }
    if (exportConfig.mode === 'scale') {
      const scale = exportConfig.scalePercent / 100;
      return {
        width: Math.max(1, Math.round(imageSize.width * scale)),
        height: Math.max(1, Math.round(imageSize.height * scale)),
      };
    }
    if (exportConfig.mode === 'preset') {
      if (exportConfig.preset === '240') {
        if (imageSize.width === imageSize.height) {
          return { width: 240, height: 240 };
        }
        const ratio = imageSize.width / imageSize.height;
        return ratio > 1
          ? { width: 240, height: Math.max(1, Math.round(240 / ratio)) }
          : { width: Math.max(1, Math.round(240 * ratio)), height: 240 };
      }
      if (exportConfig.preset === '512') {
        if (imageSize.width === imageSize.height) {
          return { width: 512, height: 512 };
        }
        const ratio = imageSize.width / imageSize.height;
        return ratio > 1
          ? { width: 512, height: Math.max(1, Math.round(512 / ratio)) }
          : { width: Math.max(1, Math.round(512 * ratio)), height: 512 };
      }
      if (exportConfig.preset === '750') {
        const ratio = imageSize.width / imageSize.height;
        return ratio > 1
          ? { width: 750, height: Math.max(1, Math.round(750 / ratio)) }
          : { width: Math.max(1, Math.round(750 * ratio)), height: 750 };
      }
      if (exportConfig.preset === '1080') {
        const ratio = imageSize.width / imageSize.height;
        return ratio > 1
          ? { width: 1080, height: Math.max(1, Math.round(1080 / ratio)) }
          : { width: Math.max(1, Math.round(1080 * ratio)), height: 1080 };
      }
      return { width: imageSize.width, height: imageSize.height };
    }
    // Custom Mode
    return {
      width: Math.max(1, Math.min(10000, exportConfig.customWidth || imageSize.width)),
      height: Math.max(1, Math.min(10000, exportConfig.customHeight || imageSize.height)),
    };
  }, [imageSize, exportConfig]);

  // Handle custom width input with aspect ratio lock
  const handleCustomWidthChange = (val: number) => {
    const newW = Math.max(1, Math.min(10000, val));
    if (exportConfig.lockAspectRatio && imageSize.width > 0 && imageSize.height > 0) {
      const newH = Math.max(1, Math.round((newW / imageSize.width) * imageSize.height));
      setExportConfig((prev) => ({
        ...prev,
        mode: 'custom',
        preset: 'custom',
        customWidth: newW,
        customHeight: newH,
      }));
    } else {
      setExportConfig((prev) => ({
        ...prev,
        mode: 'custom',
        preset: 'custom',
        customWidth: newW,
      }));
    }
  };

  // Handle custom height input with aspect ratio lock
  const handleCustomHeightChange = (val: number) => {
    const newH = Math.max(1, Math.min(10000, val));
    if (exportConfig.lockAspectRatio && imageSize.width > 0 && imageSize.height > 0) {
      const newW = Math.max(1, Math.round((newH / imageSize.height) * imageSize.width));
      setExportConfig((prev) => ({
        ...prev,
        mode: 'custom',
        preset: 'custom',
        customWidth: newW,
        customHeight: newH,
      }));
    } else {
      setExportConfig((prev) => ({
        ...prev,
        mode: 'custom',
        preset: 'custom',
        customHeight: newH,
      }));
    }
  };

  // Swap width and height
  const handleSwapDimensions = () => {
    setExportConfig((prev) => ({
      ...prev,
      mode: 'custom',
      preset: 'custom',
      customWidth: targetDimensions.height,
      customHeight: targetDimensions.width,
    }));
  };

  // Reset to original dimensions
  const handleResetToOriginalSize = () => {
    setExportConfig((prev) => ({
      ...prev,
      mode: 'original',
      preset: 'original',
      scalePercent: 100,
      customWidth: imageSize.width,
      customHeight: imageSize.height,
    }));
  };

  // Calculate live estimated file size
  useEffect(() => {
    if (!mainCanvasRef.current || targetDimensions.width === 0 || targetDimensions.height === 0) {
      setEstimatedFileSize('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = targetDimensions.width;
        offCanvas.height = targetDimensions.height;
        const ctx = offCanvas.getContext('2d');
        if (!ctx || !mainCanvasRef.current) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (exportConfig.format === 'jpeg') {
          ctx.fillStyle = exportConfig.fillBgForJpeg || '#ffffff';
          ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        }

        ctx.drawImage(mainCanvasRef.current, 0, 0, offCanvas.width, offCanvas.height);

        const mime =
          exportConfig.format === 'jpeg'
            ? 'image/jpeg'
            : exportConfig.format === 'webp'
            ? 'image/webp'
            : 'image/png';
        const q = exportConfig.format === 'png' ? undefined : exportConfig.quality;

        offCanvas.toBlob((blob) => {
          if (cancelled) return;
          if (blob) {
            const kb = blob.size / 1024;
            if (kb >= 1024) {
              setEstimatedFileSize(`${(kb / 1024).toFixed(2)} MB`);
            } else {
              setEstimatedFileSize(`${kb.toFixed(1)} KB`);
            }
          }
        }, mime, q);
      } catch (err) {
        console.warn('Failed to calculate estimated size:', err);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    targetDimensions,
    exportConfig.format,
    exportConfig.quality,
    exportConfig.fillBgForJpeg,
    historyIndex,
  ]);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExportModalOpen) {
        setIsExportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportModalOpen]);

  // Download Output Image with full size and quality control
  const handleDownload = async (overrideFormat?: 'png' | 'jpeg' | 'webp') => {
    if (!mainCanvasRef.current) return;
    const format = overrideFormat || exportConfig.format;
    const tw = targetDimensions.width;
    const th = targetDimensions.height;

    if (tw <= 0 || th <= 0) return;

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = tw;
      exportCanvas.height = th;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // For JPEG, fill transparent areas with background color (default white)
      if (format === 'jpeg') {
        ctx.fillStyle = exportConfig.fillBgForJpeg || '#ffffff';
        ctx.fillRect(0, 0, tw, th);
      }

      ctx.drawImage(mainCanvasRef.current, 0, 0, tw, th);

      const mime =
        format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const q = format === 'png' ? undefined : exportConfig.quality;

      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob((b) => resolve(b), mime, q);
      });

      if (!blob) {
        showToast?.('导出图片失败，请重试');
        return;
      }

      const ext = format === 'jpeg' ? 'jpg' : format;
      const link = document.createElement('a');
      link.download = `retouched_${tw}x${th}_${Date.now()}.${ext}`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);

      const sizeStr =
        blob.size >= 1024 * 1024
          ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB`
          : `${(blob.size / 1024).toFixed(1)} KB`;
      showToast?.(`已成功导出 ${tw}×${th} px (${sizeStr}) 图片！`);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast?.('导出过程中出现异常');
    }
  };

  // Forward to Static Slicer
  const handleForwardToStaticSlicer = async () => {
    if (!mainCanvasRef.current || !onSendToStaticSlicer) return;
    const blob = await new Promise<Blob>((resolve) => {
      mainCanvasRef.current!.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });
    const file = new File([blob], `clean_spritesheet_${Date.now()}.png`, { type: 'image/png' });
    onSendToStaticSlicer(file);
    showToast?.('已将修图结果送往「静态表情切片」！');
  };

  // Forward to Transparency Tool
  const handleForwardToTransparency = async () => {
    if (!mainCanvasRef.current || !onSendToTransparency) return;
    const blob = await new Promise<Blob>((resolve) => {
      mainCanvasRef.current!.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });
    const file = new File([blob], `clean_sticker_${Date.now()}.png`, { type: 'image/png' });
    onSendToTransparency(file);
    showToast?.('已将修图结果送往「背景透明化工具」！');
  };

  // Paste from clipboard support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            loadImage(file);
            showToast?.('已从剪贴板粘贴载入图片！');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImage, showToast]);

  // Mouse enter and leave on canvas
  const handleMouseEnter = () => {
    if (containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    }
    setIsMouseOverCanvas(true);
  };

  const handleMouseLeave = () => {
    setIsMouseOverCanvas(false);
    if (isPanning) setIsPanning(false);
    if (isDrawing) handleMouseUp();
  };

  // Drag and drop for initial upload zone
  const handleUploadDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingUpload(true);
    }
  };

  const handleUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDraggingUpload) setIsDraggingUpload(true);
  };

  const handleUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounterRef.current -= 1;
    if (uploadDragCounterRef.current <= 0) {
      uploadDragCounterRef.current = 0;
      setIsDraggingUpload(false);
    }
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounterRef.current = 0;
    setIsDraggingUpload(false);

    const files = Array.from(e.dataTransfer.files || []) as File[];
    const imgFile = files.find((f) =>
      f.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(f.name)
    );
    if (imgFile) {
      loadImage(imgFile);
      showToast?.(`已通过拖拽载入图片: ${imgFile.name}`);
    } else {
      showToast?.('请拖拽图片文件（支持 PNG / JPG / WEBP）');
    }
  };

  // Drag and drop for active canvas stage (replace image on the fly)
  const handleCanvasDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    canvasDragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingCanvas(true);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDraggingCanvas) setIsDraggingCanvas(true);
  };

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    canvasDragCounterRef.current -= 1;
    if (canvasDragCounterRef.current <= 0) {
      canvasDragCounterRef.current = 0;
      setIsDraggingCanvas(false);
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    canvasDragCounterRef.current = 0;
    setIsDraggingCanvas(false);

    const files = Array.from(e.dataTransfer.files || []) as File[];
    const imgFile = files.find((f) =>
      f.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(f.name)
    );
    if (imgFile) {
      loadImage(imgFile);
      showToast?.(`已通过拖拽载入新图片: ${imgFile.name}`);
    }
  };

  // Canvas background styling generator
  const getCanvasBgStyle = (): React.CSSProperties => {
    switch (canvasBg) {
      case 'checker':
        return {
          backgroundColor: '#f8fafc',
          backgroundImage: `
            linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
            linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        };
      case 'light':
        return { backgroundColor: '#f1f5f9' };
      case 'white':
        return { backgroundColor: '#ffffff' };
      case 'dark':
        return { backgroundColor: '#1c1917' };
      default:
        return {};
    }
  };

  // Prevent browser default file open behavior on accidental window drop
  useEffect(() => {
    const preventWindowDrag = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventWindowDrag);
    window.addEventListener('drop', preventWindowDrag);
    return () => {
      window.removeEventListener('dragover', preventWindowDrag);
      window.removeEventListener('drop', preventWindowDrag);
    };
  }, []);

  return (
    <div className="space-y-2">
      {/* Main Workspace: Empty State Upload Zone with Banner OR Compact Canvas Studio */}
      {!currentFile ? (
        <div className="space-y-4">
          {/* Top Banner with Privacy and Workflow tips */}
          <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 border border-pink-200/80 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-stone-900">
                    AI 表情智能修图 • 去水印 & 打码消除
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-300">
                    纯本地秒级 Inpainting 算法
                  </span>
                </div>
                <p className="text-xs text-stone-600">
                  专为 AI 表情包研发：一键抹除乱码文字、平台角标、多余肢体噪点，支持像素马赛克与毛玻璃遮挡，修完无缝送往切片！
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="hidden md:flex items-center gap-1.5 text-stone-500 mr-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% 离线计算，不上传任何服务器</span>
              </div>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-3 py-1.5 bg-white hover:bg-pink-50 border border-pink-300 text-pink-700 hover:text-pink-900 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                <span>载入带水印示例图测试</span>
              </button>
            </div>
          </div>

          <div
            onDragEnter={handleUploadDragEnter}
            onDragOver={handleUploadDragOver}
            onDragLeave={handleUploadDragLeave}
            onDrop={handleUploadDrop}
            className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all shadow-xs ${
              isDraggingUpload
                ? 'border-pink-500 bg-pink-50/80 scale-[1.01] ring-4 ring-pink-500/20'
                : 'bg-white border-stone-300 hover:border-pink-300'
            }`}
          >
            <div className="max-w-md mx-auto space-y-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all ${
                  isDraggingUpload
                    ? 'bg-pink-600 text-white scale-110 shadow-lg'
                    : 'bg-pink-50 text-pink-600 shadow-inner'
                }`}
              >
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 mb-1">
                  {isDraggingUpload ? '松开鼠标立即载入图片！' : '上传需要修图或去水印的图片'}
                </h3>
                <p className="text-xs text-stone-500">
                  支持 PNG / JPG / WEBP，可直接拖入或使用快捷键 <kbd className="bg-stone-100 px-1.5 py-0.5 border rounded font-mono text-[11px]">Ctrl+V</kbd> 粘贴
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <label className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-4 h-4" />
                  <span>选择本地图片</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) loadImage(file);
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-pink-600" />
                  <span>载入 AI 带水印示例</span>
                </button>
              </div>

              <div className="pt-6 border-t border-stone-100 grid grid-cols-3 gap-3 text-left">
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60">
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1 mb-1">
                    <Paintbrush className="w-3.5 h-3.5 text-pink-600" />
                    <span>手动涂抹消除</span>
                  </div>
                  <div className="text-[11px] text-stone-500 leading-relaxed">
                    红透蒙版随心涂抹，智能采样周边纹理补齐无瑕痕。
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60">
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1 mb-1">
                    <Square className="w-3.5 h-3.5 text-indigo-600" />
                    <span>智能圈选消除</span>
                  </div>
                  <div className="text-[11px] text-stone-500 leading-relaxed">
                    框选角落平台水印、Logo 或字幕，松开秒级净图。
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60">
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1 mb-1">
                    <Grid className="w-3.5 h-3.5 text-amber-600" />
                    <span>马赛克 / 模糊</span>
                  </div>
                  <div className="text-[11px] text-stone-500 leading-relaxed">
                    支持经典像素点阵与柔和毛玻璃，快速保护隐私。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
          {/* ======================================================== */}
          {/* COMPACT PRO ROW 1: 模式切换 + 对应工具 + 内联动态参数 + 一键去底白边 (严格 40px 高) */}
          {/* ======================================================== */}
          <div className="h-[40px] min-h-[40px] max-h-[40px] box-border px-2.5 bg-white border-b border-stone-200 flex items-center justify-between gap-2 text-xs overflow-x-auto overflow-y-hidden select-none no-scrollbar whitespace-nowrap">
            {/* 左侧：模式选择 + 工具选择 + 紧凑内联参数 */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 模式选择器 */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setRetouchMode('repair');
                    if (['brush-transparent', 'rect-transparent', 'color-transparent', 'brush-restore'].includes(options.tool)) {
                      setOptions((prev) => ({ ...prev, tool: 'brush-remove' }));
                    }
                  }}
                  className={`h-7 px-2 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    retouchMode === 'repair'
                      ? 'bg-pink-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="智能纹理融合去水印，保留背景色，绝不产生镂空透底破洞"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>去水印 (不透底)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRetouchMode('transparent');
                    if (!['brush-transparent', 'rect-transparent', 'color-transparent', 'brush-restore'].includes(options.tool)) {
                      setOptions((prev) => ({ ...prev, tool: 'brush-transparent' }));
                    }
                  }}
                  className={`h-7 px-2 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    retouchMode === 'transparent'
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="抠除背景或清除为透明底（可选，做表情包透明底时开启）"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>抠图透底</span>
                </button>
              </div>

              <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

              {/* 对应模式的工具列表 */}
              {retouchMode === 'repair' ? (
                <div className="flex items-center gap-0.5 bg-stone-100 p-0.5 rounded-lg border border-stone-200/80 shrink-0">
                  {[
                    { id: 'brush-remove', label: '涂抹', icon: Paintbrush, key: 'B', color: 'text-pink-600' },
                    { id: 'rect-remove', label: '矩形', icon: Square, key: 'R', color: 'text-indigo-600' },
                    { id: 'lasso-remove', label: '套索', icon: Lasso, key: 'L', color: 'text-purple-600' },
                    { id: 'mosaic', label: '打码', icon: Grid, key: 'M', color: 'text-amber-600' },
                    { id: 'eraser', label: '修选区', icon: RotateCcw, key: 'E', color: 'text-stone-600' },
                    { id: 'pan', label: '抓手', icon: Hand, key: 'H', color: 'text-emerald-600' },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = options.tool === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setOptions((prev) => ({ ...prev, tool: t.id as RetouchTool }))}
                        className={`h-7 flex items-center gap-1 px-2 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          active
                            ? 'bg-white text-stone-900 shadow-2xs ring-1 ring-stone-900/10'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                        }`}
                        title={`${t.label} (快捷键: ${t.key})`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${active ? t.color : 'text-stone-500'}`} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-0.5 bg-cyan-50 p-0.5 rounded-lg border border-cyan-200 shrink-0">
                  {[
                    { id: 'brush-transparent', label: '涂抹透底', icon: Eraser, key: 'T', color: 'text-cyan-700' },
                    { id: 'rect-transparent', label: '框选透底', icon: Square, key: 'Q', color: 'text-cyan-700' },
                    { id: 'color-transparent', label: '吸管抠色', icon: Pipette, key: 'I', color: 'text-cyan-700' },
                    { id: 'brush-restore', label: '消除透底', icon: RotateCcw, key: 'U', color: 'text-emerald-700' },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = options.tool === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setOptions((prev) => ({ ...prev, tool: t.id as RetouchTool }))}
                        className={`h-7 flex items-center gap-1 px-2 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          active
                            ? 'bg-white text-cyan-950 shadow-2xs ring-1 ring-cyan-600/30'
                            : 'text-cyan-800 hover:text-cyan-950 hover:bg-white/60'
                        }`}
                        title={`${t.label} (快捷键: ${t.key})`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${active ? t.color : 'text-cyan-600'}`} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 内联实时工具参数（横向紧贴当前工具，不另占行） */}
              <div className="flex items-center gap-1.5 shrink-0">
                {(options.tool === 'brush-remove' || options.tool === 'brush-transparent' || options.tool === 'brush-restore') && (
                  <div className="flex items-center gap-1 bg-stone-50 h-7 px-1.5 rounded-md border border-stone-200 shrink-0">
                    <span className="text-stone-500 text-[11px] whitespace-nowrap pl-0.5">粗细:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, brushSize: Math.max(2, prev.brushSize - 1) }))
                      }
                      className="w-5 h-5 rounded hover:bg-stone-200 active:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="减小粗细 (快捷键: [ )"
                      aria-label="减小粗细"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="range"
                      min="2"
                      max="120"
                      value={options.brushSize}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, brushSize: parseInt(e.target.value) || 24 }))
                      }
                      className="w-16 sm:w-20 accent-pink-600 cursor-pointer h-1.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, brushSize: Math.min(120, prev.brushSize + 1) }))
                      }
                      className="w-5 h-5 rounded hover:bg-stone-200 active:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="增大粗细 (快捷键: ] )"
                      aria-label="增大粗细"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <div className="flex items-center font-mono text-stone-700 font-bold text-[11px]">
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={options.brushSize}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) {
                            setOptions((prev) => ({ ...prev, brushSize: Math.max(2, Math.min(120, v)) }));
                          }
                        }}
                        className="w-6 text-right bg-transparent hover:bg-stone-200/60 focus:bg-white focus:ring-1 focus:ring-pink-500 rounded text-[11px] p-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-stone-500 ml-0.5">px</span>
                    </div>
                    {options.tool === 'brush-remove' && (
                      <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer pl-1.5 border-l border-stone-200 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={autoInpaintOnRelease}
                          onChange={(e) => setAutoInpaintOnRelease(e.target.checked)}
                          className="accent-pink-600 rounded scale-90"
                        />
                        <span>松手即消</span>
                      </label>
                    )}
                    {hasActiveMask && (
                      <button
                        type="button"
                        onClick={executeInpaint}
                        className="h-5 px-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded font-bold text-[10px] flex items-center gap-0.5 shadow-2xs animate-pulse cursor-pointer ml-0.5 whitespace-nowrap"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>消除选区</span>
                      </button>
                    )}
                  </div>
                )}

                {options.tool === 'eraser' && (
                  <div className="flex items-center gap-1 bg-stone-50 h-7 px-1.5 rounded-md border border-stone-200 shrink-0">
                    <span className="text-stone-500 text-[11px] whitespace-nowrap pl-0.5">橡皮:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, eraserSize: Math.max(2, prev.eraserSize - 1) }))
                      }
                      className="w-5 h-5 rounded hover:bg-stone-200 active:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="减小橡皮粗细 (快捷键: [ )"
                      aria-label="减小橡皮粗细"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="range"
                      min="2"
                      max="120"
                      value={options.eraserSize}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, eraserSize: parseInt(e.target.value) || 24 }))
                      }
                      className="w-16 sm:w-20 accent-stone-700 cursor-pointer h-1.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, eraserSize: Math.min(120, prev.eraserSize + 1) }))
                      }
                      className="w-5 h-5 rounded hover:bg-stone-200 active:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="增大橡皮粗细 (快捷键: ] )"
                      aria-label="增大橡皮粗细"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <div className="flex items-center font-mono text-stone-700 font-bold text-[11px]">
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={options.eraserSize}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) {
                            setOptions((prev) => ({ ...prev, eraserSize: Math.max(2, Math.min(120, v)) }));
                          }
                        }}
                        className="w-6 text-right bg-transparent hover:bg-stone-200/60 focus:bg-white focus:ring-1 focus:ring-stone-500 rounded text-[11px] p-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-stone-500 ml-0.5">px</span>
                    </div>
                  </div>
                )}

                {options.tool === 'color-transparent' && (
                  <div className="flex items-center gap-1.5 bg-cyan-50/70 h-7 px-2 rounded-md border border-cyan-200 shrink-0">
                    <span className="text-cyan-800 text-[11px] whitespace-nowrap">容差:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, colorTolerance: Math.max(0, (prev.colorTolerance ?? 25) - 1) }))
                      }
                      className="w-5 h-5 rounded hover:bg-cyan-100 text-cyan-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="减小容差"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={options.colorTolerance ?? 25}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, colorTolerance: parseInt(e.target.value) || 0 }))
                      }
                      className="w-14 accent-cyan-600 cursor-pointer h-1.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, colorTolerance: Math.min(100, (prev.colorTolerance ?? 25) + 1) }))
                      }
                      className="w-5 h-5 rounded hover:bg-cyan-100 text-cyan-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="增大容差"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-cyan-900 font-bold text-[11px] w-5 whitespace-nowrap">
                      {options.colorTolerance ?? 25}
                    </span>
                    <label className="flex items-center gap-1 text-[11px] text-cyan-900 cursor-pointer pl-1 border-l border-cyan-200 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={options.contiguous ?? true}
                        onChange={(e) => setOptions((prev) => ({ ...prev, contiguous: e.target.checked }))}
                        className="rounded text-cyan-600 scale-90"
                      />
                      <span>仅连通</span>
                    </label>
                  </div>
                )}

                {options.tool === 'mosaic' && (
                  <div className="flex items-center gap-1 bg-amber-50/70 h-7 px-1.5 rounded-md border border-amber-200 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, mosaicStyle: prev.mosaicStyle === 'blur' ? 'pixel' : 'blur' }))
                      }
                      className="text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-1 py-0.5 rounded cursor-pointer whitespace-nowrap"
                    >
                      {options.mosaicStyle === 'blur' ? '毛玻璃' : '像素'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, mosaicSize: Math.max(4, prev.mosaicSize - 2) }))
                      }
                      className="w-5 h-5 rounded hover:bg-amber-200/60 text-amber-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="减小马赛克尺寸"
                      aria-label="减小马赛克尺寸"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="range"
                      min="4"
                      max="40"
                      value={options.mosaicSize}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, mosaicSize: parseInt(e.target.value) || 16 }))
                      }
                      className="w-14 accent-amber-600 cursor-pointer h-1.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, mosaicSize: Math.min(40, prev.mosaicSize + 2) }))
                      }
                      className="w-5 h-5 rounded hover:bg-amber-200/60 text-amber-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="增大马赛克尺寸"
                      aria-label="增大马赛克尺寸"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-amber-900 text-[11px] w-6 whitespace-nowrap">{options.mosaicSize}px</span>
                    {hasActiveMask && (
                      <button
                        type="button"
                        onClick={executeInpaint}
                        className="h-5 px-1.5 bg-amber-600 text-white rounded font-bold text-[10px] cursor-pointer whitespace-nowrap"
                      >
                        应用
                      </button>
                    )}
                  </div>
                )}

                {options.tool === 'rect-remove' && (
                  <span className="text-[11px] text-stone-500 whitespace-nowrap hidden lg:inline">
                    按住鼠标框选水印，松手秒消
                  </span>
                )}

                {options.tool === 'lasso-remove' && (
                  <span className="text-[11px] text-stone-500 whitespace-nowrap hidden lg:inline">
                    画圈套索瑕疵，松手自动修复
                  </span>
                )}
              </div>
            </div>

            {/* 右侧：快速一键操作 + 透底状态恢复按钮 */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {hasTransparentPixels && (
                <button
                  type="button"
                  onClick={() => handleRemoveAllTransparency('original')}
                  className="h-7 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-md font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap"
                  title="一键消除全部透底破洞，恢复为完整不透明原图"
                >
                  <RotateCcw className="w-3 h-3 text-amber-600" />
                  <span>消除全图透底</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOneClickRemoveBg}
                className="h-7 px-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                title="自动探测四角背景色并清除为透明底"
              >
                <Wand2 className="w-3 h-3 text-emerald-600" />
                <span>一键智能去底</span>
              </button>

              <button
                type="button"
                onClick={handleOneClickWhiteOutline}
                className="h-7 px-2 rounded-md bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 font-bold text-[11px] transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                title="叠加微信官方标准的 2px 高清白描边（防暗黑模式融化）"
              >
                <span className="w-2 h-2 rounded-full bg-white border border-stone-400 inline-block" />
                <span>+2px白边</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COMPACT PRO ROW 2: 撤销重做/对比/贴合/底色/缩放/换图 (严格 34px 高) */}
          {/* ======================================================== */}
          <div className="h-[34px] min-h-[34px] max-h-[34px] box-border px-2.5 bg-stone-50/90 border-b border-stone-200 flex items-center justify-between text-xs gap-2 overflow-x-auto overflow-y-hidden select-none no-scrollbar whitespace-nowrap">
            {/* 左侧：历史撤销、重做、对比、重置 */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={historyIndex <= 0}
                onClick={handleUndo}
                className="h-6 w-6 rounded bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={historyIndex >= history.length - 1}
                onClick={handleRedo}
                className="h-6 w-6 rounded bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                title="重做 (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>

              <div className="h-3 w-px bg-stone-200 mx-0.5 shrink-0" />

              <button
                type="button"
                onMouseDown={() => setIsComparingOriginal(true)}
                onMouseUp={() => setIsComparingOriginal(false)}
                onMouseLeave={() => setIsComparingOriginal(false)}
                onTouchStart={() => setIsComparingOriginal(true)}
                onTouchEnd={() => setIsComparingOriginal(false)}
                className={`h-6 px-2 rounded border text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer select-none shrink-0 ${
                  isComparingOriginal
                    ? 'bg-amber-100 border-amber-300 text-amber-900 ring-1 ring-amber-400'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100 shadow-2xs'
                }`}
                title="按住不放查看原图"
              >
                <Eye className="w-3 h-3 text-amber-600" />
                <span>{isComparingOriginal ? '原图对比中' : '按住对比'}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="h-6 w-6 rounded bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 transition-colors cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                title="重置回初始图片"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 中间：贴合/扩展画板 + 底色选择 + 尺寸 */}
            <div className="flex items-center gap-2 shrink-0">
              {/* 贴合图片 vs 扩展画板 */}
              <div className="flex items-center bg-stone-200/60 p-0.5 rounded-md border border-stone-200 text-[11px] h-6 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCanvasFrameMode('fit-image');
                    setTimeout(handleFitToScreen, 60);
                  }}
                  className={`px-1.5 h-5 flex items-center rounded transition-all cursor-pointer ${
                    canvasFrameMode === 'fit-image'
                      ? 'bg-white text-stone-900 font-bold shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="紧凑贴合图片大小"
                >
                  贴合图片
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCanvasFrameMode('free-studio');
                    setTimeout(handleFitToScreen, 60);
                  }}
                  className={`px-1.5 h-5 flex items-center rounded transition-all cursor-pointer ${
                    canvasFrameMode === 'free-studio'
                      ? 'bg-white text-stone-900 font-bold shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="广阔大画布模式"
                >
                  扩展画板
                </button>
              </div>

              {/* 画板底色 */}
              <div className="hidden sm:flex items-center gap-0.5 bg-stone-200/60 p-0.5 rounded-md border border-stone-200 text-[11px] h-6 shrink-0">
                <span className="text-[10px] text-stone-500 px-0.5">底色:</span>
                {[
                  { id: 'checker', label: '🏁', title: '棋盘透明底' },
                  { id: 'light', label: '⚪', title: '浅灰底' },
                  { id: 'white', label: '⬜', title: '纯白底' },
                  { id: 'dark', label: '⬛', title: '深色底' },
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setCanvasBg(bg.id as any)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer text-[10px] ${
                      canvasBg === bg.id ? 'bg-white shadow-2xs ring-1 ring-stone-900/10' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={bg.title}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>

              {/* 尺寸与大小控制触发入口 */}
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="group flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-stone-200/60 hover:bg-pink-50 border border-stone-200/80 hover:border-pink-300 transition-colors cursor-pointer shrink-0"
                title="点击控制导出图片大小、分辨率与压缩画质"
              >
                <span className="text-stone-600 group-hover:text-pink-600">
                  {imageSize.width} × {imageSize.height} px
                </span>
                {targetDimensions.width > 0 &&
                  (targetDimensions.width !== imageSize.width ||
                    targetDimensions.height !== imageSize.height) && (
                    <span className="text-pink-600 font-bold bg-pink-100/80 px-1 rounded text-[10px]">
                      → 导出 {targetDimensions.width}×{targetDimensions.height}
                    </span>
                  )}
                <Settings2 className="w-3 h-3 text-stone-400 group-hover:text-pink-600" />
              </button>
            </div>

            {/* 右侧：缩放 + 换图 + 示例测试 */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <div className="flex items-center bg-white px-1 h-6 rounded border border-stone-200 font-mono text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
                  className="w-4 h-4 rounded hover:bg-stone-100 flex items-center justify-center cursor-pointer text-stone-600"
                  title="缩小"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom100}
                  className="px-1 py-0.2 rounded font-bold text-stone-800 hover:bg-stone-100 cursor-pointer"
                  title="恢复 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(5.0, z + 0.2))}
                  className="w-4 h-4 rounded hover:bg-stone-100 flex items-center justify-center cursor-pointer text-stone-600"
                  title="放大"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleFitToScreen}
                  className="w-4 h-4 rounded hover:bg-stone-100 flex items-center justify-center cursor-pointer text-stone-600 ml-0.5"
                  title="自适应居中"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>

              <label
                className="h-6 px-2 rounded bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap"
                title="换一张图片"
              >
                <Upload className="w-3 h-3 text-stone-500" />
                <span>换图</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadImage(file);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={handleLoadDemo}
                className="h-6 px-1.5 rounded text-stone-500 hover:text-pink-600 text-[11px] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                title="载入 AI 带水印示例测试图"
              >
                示例图
              </button>
            </div>
          </div>

          {/* Interactive Canvas Viewport (全屏视口黄金比例，一览无余无垂直滚动) */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onDragEnter={handleCanvasDragEnter}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            className="relative w-full overflow-hidden select-none bg-stone-100/95 border border-stone-200 transition-colors shadow-inner"
            style={{
              height: 'calc(100vh - 195px)',
              minHeight: '300px',
              maxHeight: 'calc(100vh - 185px)',
              backgroundImage: 'radial-gradient(#d6d3d1 1.2px, transparent 1.2px)',
              backgroundSize: '20px 20px',
              cursor:
                isPanning || spacePressed || options.tool === 'pan'
                  ? 'grab'
                  : ['brush-remove', 'brush-transparent', 'brush-restore', 'eraser', 'mosaic'].includes(options.tool)
                  ? 'none'
                  : 'crosshair',
            }}
          >
            {/* Dynamic GPU Hardware-Accelerated High-Contrast Circular Brush Cursor (0 React re-render lag) */}
            <div
              ref={brushCursorRef}
              className={`pointer-events-none absolute top-0 left-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(0,0,0,0.6)] z-50 flex items-center justify-center transition-none select-none ${
                isMouseOverCanvas &&
                !isPanning &&
                !spacePressed &&
                ['brush-remove', 'brush-transparent', 'brush-restore', 'eraser', 'mosaic'].includes(options.tool)
                  ? 'block'
                  : 'hidden'
              }`}
              style={{
                width: `${Math.max(6, Math.round((options.tool === 'eraser' ? options.eraserSize : options.brushSize) * zoom))}px`,
                height: `${Math.max(6, Math.round((options.tool === 'eraser' ? options.eraserSize : options.brushSize) * zoom))}px`,
                willChange: 'transform',
              }}
            >
              {/* Center precision cross-point dot */}
              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.9)]" />

              {/* Tool label indicator if cursor circle is large */}
              {Math.max(6, Math.round((options.tool === 'eraser' ? options.eraserSize : options.brushSize) * zoom)) > 42 && (
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-stone-900/85 text-[10px] font-mono font-bold text-white shadow-sm whitespace-nowrap pointer-events-none">
                  {options.tool === 'eraser'
                    ? `橡皮 ${options.eraserSize}px`
                    : options.tool === 'brush-transparent'
                    ? `透底 ${options.brushSize}px`
                    : options.tool === 'brush-restore'
                    ? `消除透底 ${options.brushSize}px`
                    : `画笔 ${options.brushSize}px`}
                </span>
              )}
            </div>

            {/* Drag & Drop Replacement Overlay on Canvas */}
            {isDraggingCanvas && (
              <div className="absolute inset-0 z-50 bg-pink-600/20 backdrop-blur-[2px] border-4 border-dashed border-pink-500 flex flex-col items-center justify-center text-pink-700 pointer-events-none animate-in fade-in duration-150">
                <Upload className="w-12 h-12 text-pink-600 mb-2 animate-bounce" />
                <span className="text-sm font-bold bg-white px-4 py-2 rounded-full shadow-lg text-stone-900 border border-pink-200">
                  松开鼠标即可替换载入新图片
                </span>
              </div>
            )}

            {/* Canvas Base Transform */}
            <div
              className="absolute top-0 left-0 transition-transform duration-75 origin-top-left shadow-2xl ring-1 ring-stone-900/15 rounded-sm overflow-hidden"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: imageSize.width,
                height: imageSize.height,
                ...getCanvasBgStyle(),
              }}
            >
              {/* Underlying Image Canvas */}
              <canvas
                ref={mainCanvasRef}
                className="absolute inset-0 z-10"
                style={{
                  display: isComparingOriginal ? 'none' : 'block',
                  imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                }}
              />

              {/* Temporary Original Image Preview when Holding Compare */}
              {isComparingOriginal && originalImageUrl && (
                <img
                  src={originalImageUrl}
                  alt="Original"
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{ width: imageSize.width, height: imageSize.height }}
                />
              )}

              {/* Interactive Overlay Canvas (Mask / Marquee) */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 z-20 pointer-events-none"
              />
            </div>

            {/* Comparing Original floating badge */}
            {isComparingOriginal && (
              <div className="absolute top-4 left-4 z-40 bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg text-xs flex items-center gap-1.5 animate-pulse">
                <Eye className="w-4 h-4" />
                <span>正在显示原图对比 (松开返回修图)</span>
              </div>
            )}
          </div>

          {/* Bottom Export & Inter-tab Action Bar (高度收敛至 36px) */}
          <div className="h-[36px] min-h-[36px] max-h-[36px] box-border px-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 text-xs select-none whitespace-nowrap overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="flex items-center gap-1.5 text-stone-500 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">修图完成？可直接下载或一键送往切片制作微信表情包</span>
              <span className="sm:hidden">修图完成</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* 控制尺寸与导出设置按钮 */}
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="h-6 px-2 rounded-md bg-white hover:bg-pink-50 border border-stone-300 hover:border-pink-300 text-stone-700 hover:text-pink-700 font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-[11px] shrink-0"
                title="设置导出图片分辨率、尺寸比例与文件大小"
              >
                <Scaling className="w-3 h-3 text-pink-600" />
                <span>尺寸:</span>
                <span className="font-mono text-pink-700">
                  {targetDimensions.width || imageSize.width}×{targetDimensions.height || imageSize.height}
                </span>
                {exportConfig.mode !== 'original' && (
                  <span className="px-1 py-0.2 rounded bg-pink-100 text-pink-700 text-[10px] font-bold">
                    {exportConfig.mode === 'scale'
                      ? `${exportConfig.scalePercent}%`
                      : exportConfig.preset === '240'
                      ? '240表情'
                      : exportConfig.preset === '512'
                      ? '512贴纸'
                      : '自定'}
                  </span>
                )}
                {estimatedFileSize && (
                  <span className="font-mono text-stone-400 font-normal text-[10px] hidden sm:inline">
                    ({estimatedFileSize})
                  </span>
                )}
                <Settings2 className="w-3 h-3 text-stone-400 ml-0.5" />
              </button>

              {/* Download Clean Image */}
              <div className="flex items-center rounded-md bg-white border border-stone-300 p-0.5 shadow-2xs text-[11px] h-6 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload('png')}
                  className="px-2 h-5 rounded hover:bg-stone-100 text-stone-700 font-bold transition-colors cursor-pointer flex items-center gap-1"
                  title={`下载 PNG (${targetDimensions.width || imageSize.width}×${targetDimensions.height || imageSize.height} px)`}
                >
                  <Download className="w-3 h-3 text-stone-500" />
                  <span>下载 PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('jpeg')}
                  className="px-1.5 h-5 rounded hover:bg-stone-100 text-stone-700 font-medium transition-colors cursor-pointer"
                  title={`下载 JPG (${targetDimensions.width || imageSize.width}×${targetDimensions.height || imageSize.height} px)`}
                >
                  JPG
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-1 h-5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer border-l border-stone-200 ml-0.5"
                  title="控制图片大小与画质选项"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Sync to Batch Transparency List */}
              {(onSyncToBatch || onSendToTransparency) && (
                <button
                  type="button"
                  onClick={handleSyncToBatch}
                  className="h-6 px-2.5 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 text-[11px] shrink-0"
                  title="将修图与透底结果直接追加同步至下方批量透明化列表中"
                >
                  <Layers className="w-3 h-3" />
                  <span>同步至批量列表</span>
                </button>
              )}

              {/* Forward to Static Slicer */}
              {onSendToStaticSlicer && (
                <button
                  type="button"
                  onClick={handleForwardToStaticSlicer}
                  className="h-6 px-2.5 rounded-md bg-[#07c160] hover:bg-[#06ad56] text-white font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 text-[11px] shrink-0"
                  title="将修干净的大图直接送往静态切片，自动切为 16/24 个微信表情"
                >
                  <Scissors className="w-3 h-3" />
                  <span>送往表情切片</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}

              {/* Forward to Transparency Tool */}
              {onSendToTransparency && (
                <button
                  type="button"
                  onClick={handleForwardToTransparency}
                  className="h-6 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 text-[11px] shrink-0"
                  title="将修完的图片送去去背景并添加 2px 微信白边"
                >
                  <Sliders className="w-3 h-3" />
                  <span>送往透明化</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 导出尺寸与画质控制模态框 (Export Size & Quality Control Modal) */}
      {isExportModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto text-stone-800 flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/80 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                  <Scaling className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">控制导出图片大小与画质</h3>
                  <p className="text-[11px] text-stone-500">
                    调整输出像素分辨率宽高、等比例缩放与压缩文件体积
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5 text-xs">
              {/* Section 1: 分辨率与尺寸规格 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <span>1. 导出分辨率与尺寸</span>
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">
                    原图: {imageSize.width} × {imageSize.height} px
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'original',
                        preset: 'original',
                        scalePercent: 100,
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'original'
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">原图 100%</div>
                    <div className="text-[10px] font-mono text-stone-400">
                      {imageSize.width}×{imageSize.height}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'scale',
                        scalePercent: 75,
                        preset: 'custom',
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'scale' && exportConfig.scalePercent === 75
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">缩放 75%</div>
                    <div className="text-[10px] font-mono text-stone-400">
                      {Math.round(imageSize.width * 0.75)}×{Math.round(imageSize.height * 0.75)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'scale',
                        scalePercent: 50,
                        preset: 'custom',
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'scale' && exportConfig.scalePercent === 50
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">缩放 50%</div>
                    <div className="text-[10px] font-mono text-stone-400">
                      {Math.round(imageSize.width * 0.5)}×{Math.round(imageSize.height * 0.5)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'preset',
                        preset: '240',
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                      exportConfig.mode === 'preset' && exportConfig.preset === '240'
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-bold ring-1 ring-emerald-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] px-1 rounded-bl">
                      微信
                    </span>
                    <div className="text-[11px]">240×240</div>
                    <div className="text-[10px] text-emerald-700 font-medium">表情官方规范</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'preset',
                        preset: '512',
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'preset' && exportConfig.preset === '512'
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">512×512</div>
                    <div className="text-[10px] text-stone-400">高清贴纸推荐</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'preset',
                        preset: '750',
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'preset' && exportConfig.preset === '750'
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">宽 750px</div>
                    <div className="text-[10px] text-stone-400">手机屏幕标准</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'preset',
                        preset: '1080',
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'preset' && exportConfig.preset === '1080'
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">1080×1080</div>
                    <div className="text-[10px] text-stone-400">社交高清方图</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        mode: 'custom',
                        preset: 'custom',
                        customWidth: targetDimensions.width,
                        customHeight: targetDimensions.height,
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer ${
                      exportConfig.mode === 'custom'
                        ? 'border-pink-500 bg-pink-50/60 text-pink-900 font-bold ring-1 ring-pink-500/20'
                        : 'border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">自定义宽高</div>
                    <div className="text-[10px] text-stone-400">自由设定输入</div>
                  </button>
                </div>

                {/* Custom Dimension Inputs Row */}
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                    <span className="text-stone-500 text-[11px] font-bold">宽 (W):</span>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={targetDimensions.width}
                      onChange={(e) => handleCustomWidthChange(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1 font-mono text-xs text-stone-900 focus:outline-pink-500"
                    />
                    <span className="text-stone-400 text-[10px]">px</span>
                  </div>

                  {/* Lock Aspect Ratio Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setExportConfig((prev) => ({
                        ...prev,
                        lockAspectRatio: !prev.lockAspectRatio,
                      }))
                    }
                    className={`px-2 py-1 rounded border flex items-center gap-1 text-[11px] cursor-pointer transition-colors ${
                      exportConfig.lockAspectRatio
                        ? 'bg-pink-50 border-pink-300 text-pink-700 font-bold'
                        : 'bg-white border-stone-300 text-stone-500 hover:text-stone-700'
                    }`}
                    title={exportConfig.lockAspectRatio ? '宽高比已锁定（等比缩放）' : '自由拉伸比例'}
                  >
                    {exportConfig.lockAspectRatio ? (
                      <Link2 className="w-3.5 h-3.5" />
                    ) : (
                      <Unlink2 className="w-3.5 h-3.5" />
                    )}
                    <span>{exportConfig.lockAspectRatio ? '锁定比例' : '自由比例'}</span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                    <span className="text-stone-500 text-[11px] font-bold">高 (H):</span>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={targetDimensions.height}
                      onChange={(e) => handleCustomHeightChange(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-stone-300 rounded px-2 py-1 font-mono text-xs text-stone-900 focus:outline-pink-500"
                    />
                    <span className="text-stone-400 text-[10px]">px</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSwapDimensions}
                      className="p-1 rounded bg-white hover:bg-stone-100 border border-stone-300 text-stone-600 text-[10px] flex items-center gap-0.5 cursor-pointer"
                      title="对调宽高"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>对调</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToOriginalSize}
                      className="px-2 py-1 rounded bg-white hover:bg-stone-100 border border-stone-300 text-stone-600 text-[10px] cursor-pointer"
                      title="还原为原图宽高"
                    >
                      还原原图
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: 格式与体积压缩 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-900">2. 格式与文件体积控制</span>
                  {estimatedFileSize && (
                    <span className="text-[11px] font-mono text-pink-700 bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200">
                      预计体积: ~{estimatedFileSize}
                    </span>
                  )}
                </div>

                {/* Format Radio Tabs */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    {
                      id: 'png',
                      name: 'PNG 格式',
                      desc: '无损高清，支持透明背景（微信表情包首选）',
                    },
                    {
                      id: 'jpeg',
                      name: 'JPG 格式',
                      desc: '文件体积最小，画质可调节，不支持透明底',
                    },
                    {
                      id: 'webp',
                      name: 'WEBP 格式',
                      desc: '新一代高效格式，支持透明底且体积超小',
                    },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() =>
                        setExportConfig((prev) => ({
                          ...prev,
                          format: fmt.id as any,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        exportConfig.format === fmt.id
                          ? 'border-pink-500 bg-pink-50/60 ring-1 ring-pink-500/20'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold text-xs ${
                            exportConfig.format === fmt.id ? 'text-pink-900' : 'text-stone-800'
                          }`}
                        >
                          {fmt.name}
                        </span>
                        {exportConfig.format === fmt.id && (
                          <Check className="w-3.5 h-3.5 text-pink-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                        {fmt.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Quality Slider (for JPG or WEBP) */}
                {(exportConfig.format === 'jpeg' || exportConfig.format === 'webp') && (
                  <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-2 mb-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-stone-700">压缩画质 (Quality):</span>
                      <span className="font-mono font-bold text-pink-700">
                        {Math.round(exportConfig.quality * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={1.0}
                      step={0.02}
                      value={exportConfig.quality}
                      onChange={(e) =>
                        setExportConfig((prev) => ({
                          ...prev,
                          quality: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-pink-600 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                      <span>更小体积 (40%)</span>
                      <div className="flex gap-1.5">
                        {[
                          { q: 0.7, label: '70% 紧凑' },
                          { q: 0.85, label: '85% 推荐' },
                          { q: 0.95, label: '95% 超清' },
                        ].map((item) => (
                          <button
                            key={item.q}
                            type="button"
                            onClick={() =>
                              setExportConfig((prev) => ({ ...prev, quality: item.q }))
                            }
                            className="px-1.5 py-0.5 rounded bg-white hover:bg-stone-200 border border-stone-200 text-stone-600 transition-colors"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <span>极佳画质 (100%)</span>
                    </div>

                    {/* JPEG Background Color if canvas has transparent areas */}
                    {exportConfig.format === 'jpeg' && (
                      <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px]">
                        <span className="text-stone-600">JPG透明底填充色:</span>
                        <div className="flex items-center gap-1.5">
                          {[
                            { color: '#ffffff', label: '纯白底' },
                            { color: '#f8fafc', label: '浅灰底' },
                            { color: '#000000', label: '纯黑底' },
                          ].map((item) => (
                            <button
                              key={item.color}
                              type="button"
                              onClick={() =>
                                setExportConfig((prev) => ({
                                  ...prev,
                                  fillBgForJpeg: item.color,
                                }))
                              }
                              className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer flex items-center gap-1 ${
                                exportConfig.fillBgForJpeg === item.color
                                  ? 'border-pink-500 bg-white font-bold text-pink-700'
                                  : 'border-stone-200 bg-stone-100 text-stone-600'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-stone-300"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* WeChat Sticker 500KB Compliance Banner */}
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    estimatedFileSize && estimatedFileSize.includes('MB')
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`w-4 h-4 shrink-0 ${
                        estimatedFileSize && estimatedFileSize.includes('MB')
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-bold">微信静态表情平台规范：</span>
                      <span>单张图片需 ≤ 500KB，推荐 240×240 px</span>
                    </div>
                  </div>
                  {estimatedFileSize && estimatedFileSize.includes('MB') ? (
                    <span className="px-2 py-0.5 rounded bg-amber-200/70 text-amber-800 text-[10px] font-bold shrink-0">
                      ⚠️ 超过 500KB，建议下调分辨率
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-800 text-[10px] font-bold shrink-0">
                      ✓ 符合规范要求
                    </span>
                  )}
                </div>
              </div>

              {/* Section 3: 规格摘要卡片 */}
              <div className="bg-stone-100/70 rounded-xl p-3 border border-stone-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-stone-400">输出分辨率</div>
                  <div className="font-mono font-bold text-stone-900 text-xs mt-0.5">
                    {targetDimensions.width} × {targetDimensions.height}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">等比缩放率</div>
                  <div className="font-mono font-bold text-stone-900 text-xs mt-0.5">
                    {imageSize.width > 0
                      ? `${Math.round((targetDimensions.width / imageSize.width) * 100)}%`
                      : '100%'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">目标格式</div>
                  <div className="font-mono font-bold text-pink-700 text-xs mt-0.5">
                    {exportConfig.format.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">预估文件大小</div>
                  <div className="font-mono font-bold text-emerald-700 text-xs mt-0.5">
                    {estimatedFileSize || '计算中...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-stone-100 bg-stone-50/80 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-200/60 font-medium text-xs transition-colors cursor-pointer"
              >
                关闭
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload('png')}
                  className="px-3 py-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-300/80 text-stone-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('jpeg')}
                  className="px-3 py-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-300/80 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  下载 JPG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload()}
                  className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>
                    立即下载当前规格 ({targetDimensions.width}×{targetDimensions.height})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
