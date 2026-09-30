import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Camera,
  Download,
  Sparkles,
  Sliders,
  RotateCw,
  RefreshCw,
  Printer,
  FileCheck,
  Check,
  FolderArchive,
  Eye,
  EyeOff,
  Palette,
  Maximize2,
  Minimize2,
  FlipHorizontal,
  ChevronDown,
  Info,
  Wand2,
  Shirt,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Zap,
  SlidersHorizontal,
  Layers,
  ZoomIn,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  IdPhotoPresetKey,
  IdPhotoPresetSpec,
  IdPhotoBgType,
  IdPhotoState,
} from '../../types';
import {
  ID_PHOTO_PRESETS,
  POPULAR_ID_COLORS,
  IdColorPreset,
  drawIdBackground,
  exportPhotoUnderSizeLimit,
} from '../../utils/idPhotoPresets';
import {
  SUIT_OVERLAYS,
  SuitOverlayOption,
  getSuitImage,
  drawSuitOverlay,
} from '../../utils/suitOverlays';
import { DEMO_PORTRAITS, DemoPortrait } from '../../utils/demoPortraits';
import { removeBackgroundWithAI, isAiRemovalSupported } from '../../utils/aiBackgroundRemoval';
import {
  HairOptimizationConfig,
  ClarityConfig,
  SilhouetteField,
  DEFAULT_HAIR_CONFIG,
  DEFAULT_CLARITY_CONFIG,
  buildSilhouetteField,
  createOptimizedPortraitCanvas,
  enhanceImageClarity,
} from '../../utils/portraitEnhancement';
import { CameraCaptureModal } from './CameraCaptureModal';
import { PrintLayoutModal } from './PrintLayoutModal';

interface IdPhotoMakerProps {
  onSendToRetouch?: (file: File) => void;
  onNotification?: (msg: string) => void;
}

export const IdPhotoMaker: React.FC<IdPhotoMakerProps> = ({
  onSendToRetouch,
  onNotification,
}) => {
  // Current specification preset
  const [selectedPresetKey, setSelectedPresetKey] = useState<IdPhotoPresetKey>('1-inch');
  const [customWidthMm, setCustomWidthMm] = useState<number>(25);
  const [customHeightMm, setCustomHeightMm] = useState<number>(35);
  const [customWidthPx, setCustomWidthPx] = useState<number>(295);
  const [customHeightPx, setCustomHeightPx] = useState<number>(413);

  // Background color state
  const [selectedColorId, setSelectedColorId] = useState<string>('red-classic');
  const [customColorHex, setCustomColorHex] = useState<string>('#C8102E');

  // Portrait State
  const [portraitState, setPortraitState] = useState<IdPhotoState>({
    file: null,
    originalUrl: null,
    transparentUrl: null,
    transparentBlob: null,
    transparentImageData: null,
    isMatting: false,
    mattingProgress: 0,
    mattingMessage: '',
  });

  // Portrait Framing & Adjustments
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [flipX, setFlipX] = useState<boolean>(false);

  // Image Enhancement: Light & Contrast
  const [brightness, setBrightness] = useState<number>(0); // -50 to 50
  const [contrast, setContrast] = useState<number>(0); // -50 to 50

  // 1. Hair & Neck Detail & Edge Optimization Configuration
  const [hairConfig, setHairConfig] = useState<HairOptimizationConfig>({
    ...DEFAULT_HAIR_CONFIG,
  });

  // 2. Synchronously Cached Optimized Canvas & Silhouette Field
  const [optimizedCanvas, setOptimizedCanvas] = useState<HTMLCanvasElement | null>(null);
  const silhouetteFieldRef = useRef<SilhouetteField | null>(null);

  // 3. Smart Image Clarity Optimization Configuration
  const [clarityConfig, setClarityConfig] = useState<ClarityConfig>({
    ...DEFAULT_CLARITY_CONFIG,
  });
  const [isComparingOriginal, setIsComparingOriginal] = useState<boolean>(false);

  // Suit Attire Overlay
  const [selectedSuitId, setSelectedSuitId] = useState<string>('none');
  const [suitScale, setSuitScale] = useState<number>(1.0);
  const [suitOffsetY, setSuitOffsetY] = useState<number>(0);

  // Export options
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
  const [fileSizeLimitKb, setFileSizeLimitKb] = useState<number>(0); // 0 for unlimited
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);

  // Modals
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Drag interaction on preview canvas
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawCutoutImageDataRef = useRef<ImageData | null>(null);
  const transparentImgRef = useRef<HTMLImageElement | null>(null);

  // Find current spec
  const currentSpec =
    ID_PHOTO_PRESETS.find((p) => p.key === selectedPresetKey) || ID_PHOTO_PRESETS[0];

  const targetWidthPx =
    selectedPresetKey === 'custom' ? customWidthPx : currentSpec.widthPx;
  const targetHeightPx =
    selectedPresetKey === 'custom' ? customHeightPx : currentSpec.heightPx;

  // Selected color profile
  const currentColor: IdColorPreset =
    selectedColorId === 'custom'
      ? {
          id: 'custom',
          name: '自定义颜色',
          type: 'color',
          hex: customColorHex,
          description: `自定义颜色 ${customColorHex}`,
          style: 'solid',
          secondaryHex: undefined,
        }
      : POPULAR_ID_COLORS.find((c) => c.id === selectedColorId) || POPULAR_ID_COLORS[1];

  // Helper to ensure we have raw ImageData from transparentImgRef if needed
  const ensureRawImageData = useCallback((): ImageData | null => {
    if (rawCutoutImageDataRef.current) {
      return rawCutoutImageDataRef.current;
    }
    const img = transparentImgRef.current;
    if (img && (img.naturalWidth || img.width)) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      rawCutoutImageDataRef.current = data;
      return data;
    }
    return null;
  }, []);

  // -------------------------------------------------------------
  // File Upload & Automatic Matting Process
  // -------------------------------------------------------------
  const processImageFile = async (file: File) => {
    const originalUrl = URL.createObjectURL(file);
    setPortraitState({
      file,
      originalUrl,
      transparentUrl: null,
      transparentBlob: null,
      transparentImageData: null,
      isMatting: true,
      mattingProgress: 10,
      mattingMessage: '正在启动 AI 人物智能分割识别...',
    });

    // Reset framing transforms to natural center
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    setFlipX(false);

    try {
      const cacheKey = `id_matting_${file.name}_${file.size}_${file.lastModified}`;
      const mattingResult = await removeBackgroundWithAI(
        file,
        cacheKey,
        (progress) => {
          setPortraitState((prev) => ({
            ...prev,
            mattingProgress: progress.progress,
            mattingMessage: progress.message,
          }));
        }
      );

      rawCutoutImageDataRef.current = mattingResult.imageData;
      const field = buildSilhouetteField(mattingResult.imageData);
      silhouetteFieldRef.current = field;

      // Preload image element
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('无法解析抠图结果图像'));
        img.src = mattingResult.url;
      });
      transparentImgRef.current = img;

      // Immediately generate hair-optimized canvas synchronously from precomputed field
      const optCanvas = createOptimizedPortraitCanvas(field, hairConfig);
      setOptimizedCanvas(optCanvas);

      setPortraitState((prev) => ({
        ...prev,
        transparentUrl: mattingResult.url,
        transparentBlob: mattingResult.blob,
        transparentImageData: mattingResult.imageData,
        isMatting: false,
        mattingProgress: 100,
        mattingMessage: 'AI 抠图完成！发丝细节精细提取，已去除杂色光晕',
      }));

      onNotification?.('✨ AI 智能抠图成功！已完成人像提取与发丝颈部去白边优化');
    } catch (err: any) {
      console.error('AI Matting failed, falling back:', err);
      const fallbackImg = new Image();
      fallbackImg.src = originalUrl;
      await new Promise<void>((resolve) => {
        fallbackImg.onload = () => resolve();
      });
      transparentImgRef.current = fallbackImg;

      // Extract raw data from fallback image
      const w = fallbackImg.naturalWidth || fallbackImg.width;
      const h = fallbackImg.naturalHeight || fallbackImg.height;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(fallbackImg, 0, 0);
      const rawData = ctx.getImageData(0, 0, w, h);
      rawCutoutImageDataRef.current = rawData;
      const field = buildSilhouetteField(rawData);
      silhouetteFieldRef.current = field;

      const optCanvas = createOptimizedPortraitCanvas(field, hairConfig);
      setOptimizedCanvas(optCanvas);

      setPortraitState((prev) => ({
        ...prev,
        isMatting: false,
        mattingProgress: 100,
        mattingMessage: '已载入原始图像，已准备好边缘优化与换底',
      }));
      onNotification?.('已载入人像照片，可自由调节位置与换底');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handleSelectDemoPortrait = async (demo: DemoPortrait) => {
    const file = await demo.createFile();
    processImageFile(file);
    onNotification?.(`已载入「${demo.name}」，AI 正在自动化抠图、精修发丝与超清增强...`);
  };

  // -------------------------------------------------------------
  // One-Click Auto Enhance (发丝精修 + 人像超清一键最佳配置)
  // -------------------------------------------------------------
  const handleOneClickAutoEnhance = () => {
    const newHairConfig: HairOptimizationConfig = {
      enabled: true,
      deFringe: 100,
      feather: 1.0,
      edgeShift: -2.8, // 物理内收 2.8px，彻底切除任何残存白边
      textureBoost: 50,
      skinSmoothing: 65, // 65% 自然影楼级磨皮，抚平脸部粗糙与暗沉
    };
    setHairConfig(newHairConfig);
    applyHairOptimization(newHairConfig);

    setClarityConfig({
      enabled: true,
      strength: 70,
      detailMode: 'balanced',
      exportDpiMultiplier: 2,
    });
    setBrightness(4);
    setContrast(6);
    onNotification?.('⚡ 已一键应用智能最佳调优：物理切除白边 + 发丝去杂色 + 五官超清增强！');
  };

  // -------------------------------------------------------------
  // Canvas Rendering Pipeline (Renders final ID photo with Multi-DPI & Clarity)
  // -------------------------------------------------------------
  const renderIdPhotoToCanvas = useCallback(
    async (
      targetCanvas: HTMLCanvasElement,
      baseWidth: number,
      baseHeight: number,
      withGuides: boolean,
      dpiScale: number = 1,
      applyClarity: boolean = true,
      overrideSubjectSource?: HTMLCanvasElement | HTMLImageElement | null
    ) => {
      const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const width = Math.round(baseWidth * dpiScale);
      const height = Math.round(baseHeight * dpiScale);

      targetCanvas.width = width;
      targetCanvas.height = height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Draw Background
      if (currentColor.type === 'transparent') {
        ctx.clearRect(0, 0, width, height);
      } else {
        drawIdBackground(
          ctx,
          width,
          height,
          currentColor.type,
          currentColor.hex,
          currentColor.style || 'solid',
          currentColor.secondaryHex
        );
      }

      // 2. Draw Subject Portrait (with Hair & Edge Optimization)
      // If comparing original, use raw transparent img; otherwise use optimized canvas or override
      const subjectSource: HTMLCanvasElement | HTMLImageElement | null =
        overrideSubjectSource !== undefined
          ? overrideSubjectSource
          : (!isComparingOriginal && hairConfig.enabled && optimizedCanvas
              ? optimizedCanvas
              : transparentImgRef.current);

      if (subjectSource) {
        ctx.save();

        // Apply framing transforms around canvas center
        const centerX = width / 2 + panX * dpiScale;
        const centerY = height / 2 + panY * dpiScale;
        ctx.translate(centerX, centerY);

        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        if (flipX) {
          ctx.scale(-1, 1);
        }

        // Apply CSS-like brightness and contrast filters
        if (brightness !== 0 || contrast !== 0) {
          const bVal = 100 + brightness;
          const cVal = 100 + contrast;
          ctx.filter = `brightness(${bVal}%) contrast(${cVal}%)`;
        }

        // Calculate aspect-fit scale
        const naturalW =
          subjectSource instanceof HTMLImageElement
            ? subjectSource.naturalWidth || subjectSource.width
            : subjectSource.width;
        const naturalH =
          subjectSource instanceof HTMLImageElement
            ? subjectSource.naturalHeight || subjectSource.height
            : subjectSource.height;
        const imgAspect = naturalW / naturalH;
        const canvasAspect = width / height;
        let drawW = width;
        let drawH = height;

        if (imgAspect > canvasAspect) {
          drawH = height;
          drawW = height * imgAspect;
        } else {
          drawW = width;
          drawH = width / imgAspect;
        }

        // Apply user zoom
        drawW *= zoom;
        drawH *= zoom;

        ctx.drawImage(subjectSource, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      // 3. Draw Suit Attire Overlay (if selected)
      if (selectedSuitId !== 'none') {
        const suitImg = await getSuitImage(selectedSuitId);
        if (suitImg) {
          drawSuitOverlay(ctx, suitImg, width, height, suitScale, suitOffsetY * dpiScale);
        }
      }

      // 4. Apply Intelligent Smart Clarity Enhancement
      if (applyClarity && clarityConfig.enabled && !isComparingOriginal) {
        enhanceImageClarity(ctx, width, height, clarityConfig);
      }

      // 5. Draw Standard Guidelines (if enabled for on-screen preview)
      if (withGuides) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)';
        ctx.lineWidth = Math.max(1, Math.round(dpiScale));
        ctx.setLineDash([4 * dpiScale, 4 * dpiScale]);

        // Standard Top margin line (3~5mm head clearance: ~10% from top)
        const topHeadY = Math.round(height * 0.12);
        ctx.beginPath();
        ctx.moveTo(0, topHeadY);
        ctx.lineTo(width, topHeadY);
        ctx.stroke();

        // Eye alignment line (~38% from top)
        const eyesY = Math.round(height * 0.38);
        ctx.beginPath();
        ctx.moveTo(0, eyesY);
        ctx.lineTo(width, eyesY);
        ctx.stroke();

        // Chin alignment line (~68% from top)
        const chinY = Math.round(height * 0.68);
        ctx.beginPath();
        ctx.moveTo(0, chinY);
        ctx.lineTo(width, chinY);
        ctx.stroke();

        // Center vertical symmetry axis
        const midX = Math.round(width / 2);
        ctx.beginPath();
        ctx.moveTo(midX, 0);
        ctx.lineTo(midX, height);
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.font = `${Math.round(10 * dpiScale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('头顶基准线', 8 * dpiScale, topHeadY - 4 * dpiScale);
        ctx.fillText('双眼水平线', 8 * dpiScale, eyesY - 4 * dpiScale);
        ctx.fillText('下巴基准线', 8 * dpiScale, chinY - 4 * dpiScale);

        ctx.restore();
      }
    },
    [
      currentColor,
      panX,
      panY,
      rotation,
      flipX,
      zoom,
      brightness,
      contrast,
      hairConfig,
      optimizedCanvas,
      clarityConfig,
      isComparingOriginal,
      selectedSuitId,
      suitScale,
      suitOffsetY,
    ]
  );

  // Synchronously apply hair & edge optimization and immediately redraw the preview canvas
  const applyHairOptimization = useCallback(
    (hConfig: HairOptimizationConfig) => {
      let field = silhouetteFieldRef.current;
      if (!field) {
        const rawData = ensureRawImageData();
        if (!rawData) return;
        field = buildSilhouetteField(rawData);
        silhouetteFieldRef.current = field;
      }
      const canvas = createOptimizedPortraitCanvas(field, hConfig);
      setOptimizedCanvas(canvas);
      // Immediately draw to preview canvas for zero-delay 60fps live response
      if (previewCanvasRef.current) {
        renderIdPhotoToCanvas(
          previewCanvasRef.current,
          targetWidthPx,
          targetHeightPx,
          showGuidelines,
          2,
          true,
          canvas
        );
      }
    },
    [ensureRawImageData, renderIdPhotoToCanvas, targetWidthPx, targetHeightPx, showGuidelines]
  );

  // Synchronously update whenever hairConfig changes
  useEffect(() => {
    applyHairOptimization(hairConfig);
  }, [hairConfig, applyHairOptimization]);

  // Re-render preview canvas whenever settings change
  useEffect(() => {
    if (previewCanvasRef.current) {
      renderIdPhotoToCanvas(
        previewCanvasRef.current,
        targetWidthPx,
        targetHeightPx,
        showGuidelines,
        2,
        true
      );
    }
  }, [
    renderIdPhotoToCanvas,
    targetWidthPx,
    targetHeightPx,
    showGuidelines,
    portraitState.transparentUrl,
    optimizedCanvas,
    isComparingOriginal,
  ]);

  // -------------------------------------------------------------
  // Drag & Wheel Interaction for Quick Repositioning
  // -------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setZoom((prev) => Math.max(0.4, Math.min(3.0, Number((prev + delta).toFixed(2)))));
  };

  // -------------------------------------------------------------
  // Export Handlers (Single Photo, Sizes, and Full ZIP)
  // -------------------------------------------------------------
  const handleDownloadSinglePhoto = async (overrideMultiplier?: 1 | 2 | 4) => {
    const dpiMultiplier = overrideMultiplier || clarityConfig.exportDpiMultiplier || 2;
    const finalW = targetWidthPx * dpiMultiplier;
    const finalH = targetHeightPx * dpiMultiplier;

    // Generate clean canvas without guidelines at requested super-resolution
    const offscreen = document.createElement('canvas');
    await renderIdPhotoToCanvas(
      offscreen,
      targetWidthPx,
      targetHeightPx,
      false,
      dpiMultiplier,
      clarityConfig.enabled
    );

    const isTransparent = currentColor.type === 'transparent';
    const effectiveFormat = isTransparent ? 'png' : exportFormat;

    const res = await exportPhotoUnderSizeLimit(
      offscreen,
      effectiveFormat,
      fileSizeLimitKb
    );

    const dpiLabel = dpiMultiplier === 1 ? '300DPI_标准' : dpiMultiplier === 2 ? '600DPI_超清' : '1200DPI_极清';
    const sizeNote = fileSizeLimitKb > 0 ? `_${Math.round(res.size / 1024)}KB` : '';

    const a = document.createElement('a');
    a.href = res.url;
    a.download = `证件照_${currentSpec.name}_${currentColor.name}_${dpiLabel}${sizeNote}.${effectiveFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(res.url);

    onNotification?.(
      `🎉 智能证件照已成功导出！(${finalW}×${finalH} px @ ${300 * dpiMultiplier} DPI, ${Math.round(res.size / 1024)} KB)！`
    );
  };

  // Batch Export Full Set ZIP (Includes both 300DPI Official Standard & 600DPI Ultra-HD)
  const handleExportFullSetZip = async () => {
    if (isExportingZip) return;
    setIsExportingZip(true);
    onNotification?.('正在打包生成全套官方标准 300DPI 与智能超清 600DPI 证件照...');

    try {
      const zip = new JSZip();
      const exportPresets = [
        { key: '1-inch', name: '1寸标准照', w: 295, h: 413 },
        { key: '2-inch', name: '2寸标准照', w: 413, h: 579 },
        { key: 'small-2-inch', name: '小2寸护照', w: 413, h: 531 },
      ];

      const exportColors = [
        { name: '红底', type: 'color', hex: '#C8102E' },
        { name: '蓝底', type: 'color', hex: '#0066FF' },
        { name: '白底', type: 'color', hex: '#FFFFFF' },
        { name: '透明底', type: 'transparent', hex: 'transparent' },
      ];

      const folder300 = zip.folder('1_官方标准版_300DPI');
      const folder600 = zip.folder('2_智能超清版_600DPI_推荐冲印');

      const offscreen = document.createElement('canvas');

      for (const preset of exportPresets) {
        const sub300 = folder300?.folder(`${preset.name}_${preset.w}x${preset.h}`);
        const sub600 = folder600?.folder(`${preset.name}_${preset.w * 2}x${preset.h * 2}_超清`);

        for (const col of exportColors) {
          const isTrans = col.type === 'transparent';
          const format = isTrans ? 'image/png' : 'image/jpeg';
          const ext = isTrans ? 'png' : 'jpg';

          // 1. Generate 300 DPI version
          offscreen.width = preset.w;
          offscreen.height = preset.h;
          const ctx1 = offscreen.getContext('2d')!;
          if (isTrans) {
            ctx1.clearRect(0, 0, preset.w, preset.h);
          } else {
            drawIdBackground(ctx1, preset.w, preset.h, col.type, col.hex, 'solid');
          }

          const subjectSource: HTMLCanvasElement | HTMLImageElement | null =
            hairConfig.enabled && optimizedCanvas ? optimizedCanvas : transparentImgRef.current;

          if (subjectSource) {
            ctx1.save();
            ctx1.translate(preset.w / 2 + panX, preset.h / 2 + panY);
            if (rotation !== 0) ctx1.rotate((rotation * Math.PI) / 180);
            if (flipX) ctx1.scale(-1, 1);
            if (brightness !== 0 || contrast !== 0) {
              ctx1.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
            }
            const nw =
              subjectSource instanceof HTMLImageElement
                ? subjectSource.naturalWidth || subjectSource.width
                : subjectSource.width;
            const nh =
              subjectSource instanceof HTMLImageElement
                ? subjectSource.naturalHeight || subjectSource.height
                : subjectSource.height;
            const imgAspect = nw / nh;
            const canvasAspect = preset.w / preset.h;
            let drawW = preset.w;
            let drawH = preset.h;
            if (imgAspect > canvasAspect) {
              drawH = preset.h;
              drawW = preset.h * imgAspect;
            } else {
              drawW = preset.w;
              drawH = preset.w / imgAspect;
            }
            drawW *= zoom;
            drawH *= zoom;
            ctx1.drawImage(subjectSource, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx1.restore();
          }

          if (selectedSuitId !== 'none') {
            const suitImg = await getSuitImage(selectedSuitId);
            if (suitImg) {
              drawSuitOverlay(ctx1, suitImg, preset.w, preset.h, suitScale, suitOffsetY);
            }
          }
          if (clarityConfig.enabled) {
            enhanceImageClarity(ctx1, preset.w, preset.h, clarityConfig);
          }

          const blob300 = await new Promise<Blob>((resolve) =>
            offscreen.toBlob((b) => resolve(b!), format, 0.96)
          );
          sub300?.file(`${preset.name}_${col.name}_300DPI.${ext}`, blob300);

          // 2. Generate 600 DPI Ultra-HD version
          const w600 = preset.w * 2;
          const h600 = preset.h * 2;
          offscreen.width = w600;
          offscreen.height = h600;
          const ctx2 = offscreen.getContext('2d')!;
          if (isTrans) {
            ctx2.clearRect(0, 0, w600, h600);
          } else {
            drawIdBackground(ctx2, w600, h600, col.type, col.hex, 'solid');
          }

          if (subjectSource) {
            ctx2.save();
            ctx2.translate(w600 / 2 + panX * 2, h600 / 2 + panY * 2);
            if (rotation !== 0) ctx2.rotate((rotation * Math.PI) / 180);
            if (flipX) ctx2.scale(-1, 1);
            if (brightness !== 0 || contrast !== 0) {
              ctx2.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
            }
            const nw =
              subjectSource instanceof HTMLImageElement
                ? subjectSource.naturalWidth || subjectSource.width
                : subjectSource.width;
            const nh =
              subjectSource instanceof HTMLImageElement
                ? subjectSource.naturalHeight || subjectSource.height
                : subjectSource.height;
            const imgAspect = nw / nh;
            const canvasAspect = w600 / h600;
            let drawW = w600;
            let drawH = h600;
            if (imgAspect > canvasAspect) {
              drawH = h600;
              drawW = h600 * imgAspect;
            } else {
              drawW = w600;
              drawH = w600 / imgAspect;
            }
            drawW *= zoom;
            drawH *= zoom;
            ctx2.drawImage(subjectSource, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx2.restore();
          }

          if (selectedSuitId !== 'none') {
            const suitImg = await getSuitImage(selectedSuitId);
            if (suitImg) {
              drawSuitOverlay(ctx2, suitImg, w600, h600, suitScale, suitOffsetY * 2);
            }
          }
          if (clarityConfig.enabled) {
            enhanceImageClarity(ctx2, w600, h600, clarityConfig);
          }

          const blob600 = await new Promise<Blob>((resolve) =>
            offscreen.toBlob((b) => resolve(b!), format, 0.98)
          );
          sub600?.file(`${preset.name}_${col.name}_600DPI_超清.${ext}`, blob600);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `证件照全套合集_含300DPI与600DPI超清_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      onNotification?.('🎉 全套证件照合集 ZIP 打包下载成功！包含 300DPI 官方版与 600DPI 智能超清版');
    } catch (err: any) {
      console.error('Failed to export full set zip:', err);
      onNotification?.('导出失败，请重试');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleSendToWorkspace = () => {
    if (!portraitState.file && !portraitState.transparentBlob) return;
    const fileToSend =
      portraitState.transparentBlob && portraitState.file
        ? new File([portraitState.transparentBlob], `portrait_cutout_${portraitState.file.name}`, {
            type: 'image/png',
          })
        : portraitState.file!;
    onSendToRetouch?.(fileToSend);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Feature Intro */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/30 text-pink-200 border border-pink-400/30 flex items-center gap-1">
              <Scissors className="w-3 h-3 text-pink-300" />
              发丝与颈部深度去白边 • 边缘微收内剪
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-300" />
              智能超清增强 (600DPI 极清)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              国家通用标准规范
            </span>
          </div>
          <h2 className="text-lg font-bold">证件照一键智能生成与发丝超清优化套件</h2>
          <p className="text-xs text-blue-200/80 leading-relaxed max-w-2xl">
            深度优化头发与颈部边缘：采用精确距离场物理收边与去色溢算法，消除红蓝底色下的白边与阶梯锯齿；提供 300DPI 官方标准与 600DPI 双倍超清下载，解决下载图片模糊问题。
          </p>
        </div>

        {/* Quick Actions & Demo Portrait Loaders */}
        <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* One click auto enhance button */}
          <button
            type="button"
            onClick={handleOneClickAutoEnhance}
            className="px-3.5 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md text-white flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="一键切除白边、消除光晕杂色、提升五官清晰度"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>⚡ 一键强力去白边超清</span>
          </button>

          <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] text-blue-200 font-medium pl-1">快速测试：</span>
            {DEMO_PORTRAITS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => handleSelectDemoPortrait(demo)}
                disabled={portraitState.isMatting}
                className="px-2.5 py-1 text-xs font-bold bg-white/15 hover:bg-white/25 rounded-lg border border-white/20 transition-all text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>{demo.id === 'demo-male-mature' ? '👨 自然发丝' : demo.gender === 'male' ? '👨 青年男士' : '👩 职场女士'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration Controls (Width: 7 / 12) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Upload & Input Card */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-bold text-stone-900">上传人像照片</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>摄像头直接拍摄</span>
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                portraitState.file
                  ? 'border-indigo-300 bg-indigo-50/20 hover:bg-indigo-50/40'
                  : 'border-stone-300 hover:border-indigo-500 hover:bg-stone-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-stone-800">
                    {portraitState.file ? (
                      <span className="text-indigo-600">
                        当前文件: {portraitState.file.name} (点击可更换照片)
                      </span>
                    ) : (
                      '点击或拖拽上传人像正面照片（支持 JPG/PNG/WEBP）'
                    )}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    光线均匀、正面免冠拍摄效果最佳；系统将自动精修发丝与五官细节
                  </p>
                </div>
              </div>
            </div>

            {/* Matting Progress Indicator */}
            {portraitState.isMatting && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-blue-900 font-bold">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>{portraitState.mattingMessage || 'AI 正在自动抠图精修发丝中...'}</span>
                  </div>
                  <span className="font-mono text-blue-700">{portraitState.mattingProgress}%</span>
                </div>
                <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${portraitState.mattingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Preset Size Specifications */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-bold text-stone-900">选择证件照规格</h3>
              </div>
              <span className="text-xs text-stone-500 font-mono">
                {currentSpec.widthMm} × {currentSpec.heightMm} mm ({targetWidthPx} × {targetHeightPx} px @ 300DPI)
              </span>
            </div>

            {/* Specification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ID_PHOTO_PRESETS.map((spec) => {
                const active = selectedPresetKey === spec.key;
                return (
                  <button
                    key={spec.key}
                    type="button"
                    onClick={() => setSelectedPresetKey(spec.key)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      active
                        ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${active ? 'text-blue-700' : 'text-stone-800'}`}>
                        {spec.name}
                      </span>
                      {active && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono mt-1">
                      {spec.widthMm}×{spec.heightMm}mm
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Spec info detail banner */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-800">{currentSpec.name}：</span>
                <span>{currentSpec.description}</span>
              </div>
            </div>

            {/* Custom size inputs if 'custom' is selected */}
            {selectedPresetKey === 'custom' && (
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-stone-600 font-medium mb-1">宽度 (像素 px):</label>
                  <input
                    type="number"
                    value={customWidthPx}
                    onChange={(e) => setCustomWidthPx(Math.max(50, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 font-medium mb-1">高度 (像素 px):</label>
                  <input
                    type="number"
                    value={customHeightPx}
                    onChange={(e) => setCustomHeightPx(Math.max(50, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Background Transparency & Color Switcher */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-sm font-bold text-stone-900">一键换底色与背景透明化</h3>
              </div>
              <span className="text-xs text-stone-500 font-bold">
                当前底色：{currentColor.name}
              </span>
            </div>

            {/* Background Color Swatches */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {POPULAR_ID_COLORS.map((col) => {
                const active = selectedColorId === col.id;
                const isTrans = col.id === 'transparent';
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColorId(col.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600/30'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    {/* Color dot */}
                    <div
                      className={`w-6 h-6 rounded-lg shrink-0 border border-stone-300/80 shadow-2xs ${
                        isTrans
                          ? 'bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[size:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]'
                          : ''
                      }`}
                      style={{
                        backgroundColor: isTrans ? undefined : col.hex,
                        backgroundImage: col.secondaryHex
                          ? `radial-gradient(circle, ${col.hex}, ${col.secondaryHex})`
                          : undefined,
                      }}
                    />
                    <div className="text-left overflow-hidden">
                      <div className="text-xs font-bold text-stone-800 truncate">{col.name}</div>
                      <div className="text-[10px] text-stone-400 font-mono truncate">
                        {isTrans ? 'PNG 透明' : col.hex}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Custom Color Picker Button */}
              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                  selectedColorId === 'custom'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600/30'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <input
                  type="color"
                  value={customColorHex}
                  onChange={(e) => {
                    setCustomColorHex(e.target.value);
                    setSelectedColorId('custom');
                  }}
                  className="w-6 h-6 rounded-lg shrink-0 border border-stone-300 cursor-pointer p-0 bg-transparent"
                />
                <div className="text-left overflow-hidden">
                  <div className="text-xs font-bold text-stone-800">自定义颜色</div>
                  <div className="text-[10px] text-stone-400 font-mono">{customColorHex}</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Hair & Neck Detail & Edge Optimization (发丝与颈部去白边精修) */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xs">
                  <Scissors className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    发丝与颈部边缘精修
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">
                      消除头发与颈部白边
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    针对红/蓝底色下头发顶端与颈部两侧的白色残留进行距离场物理内切与消色溢
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hairConfig.enabled}
                  onChange={(e) =>
                    setHairConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-stone-700">开启边缘优化</span>
              </label>
            </div>

            {/* Quick Hair & Neck Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-stone-500 font-medium">快捷去白边与发丝调优预设（点击即刻实时生效）：</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    name: '强力去白边 (强烈推荐)',
                    desc: '物理内收2.8px，消除白边与面部粗糙',
                    highlight: true,
                    config: { deFringe: 100, feather: 1.0, edgeShift: -2.8, textureBoost: 50, skinSmoothing: 65 },
                  },
                  {
                    name: '✂️ 超深切除 (顽固白边专用)',
                    desc: '物理内收5.0px，彻底切除任何顽固白边',
                    config: { deFringe: 100, feather: 1.2, edgeShift: -5.0, textureBoost: 40, skinSmoothing: 70 },
                  },
                  {
                    name: '自然发丝 (标准)',
                    desc: '微收1.2px，兼顾发梢细节与净边磨皮',
                    config: { deFringe: 90, feather: 1.0, edgeShift: -1.2, textureBoost: 50, skinSmoothing: 55 },
                  },
                  {
                    name: '柔和过渡',
                    desc: '内收2.0px+大羽化平滑柔肤',
                    config: { deFringe: 95, feather: 2.2, edgeShift: -2.0, textureBoost: 30, skinSmoothing: 65 },
                  },
                ].map((preset) => {
                  const isActive =
                    hairConfig.enabled &&
                    hairConfig.edgeShift === preset.config.edgeShift &&
                    hairConfig.deFringe === preset.config.deFringe;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        const newCfg: HairOptimizationConfig = {
                          ...hairConfig,
                          enabled: true,
                          ...preset.config,
                        };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                        onNotification?.(`已切换至「${preset.name}」模式，白边已立即切除`);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-pink-50 border-pink-500 shadow-2xs ring-1 ring-pink-400'
                          : preset.highlight
                          ? 'border-pink-300 bg-pink-50/40 hover:bg-pink-50'
                          : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                        <span>{preset.name}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-pink-600" />}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Sliders */}
            <div className="space-y-3.5 pt-2 border-t border-stone-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Edge Inward Shift (Key Slider for White Edges) */}
                <div className="bg-pink-50/40 p-3 rounded-xl border border-pink-100 space-y-1">
                  <div className="flex items-center justify-between text-xs text-stone-800 font-bold">
                    <span className="flex items-center gap-1">
                      <span>边缘物理内收剪切 (Edge Trim)</span>
                      <span className="text-[10px] font-normal text-pink-700 bg-pink-200/60 px-1.5 py-0.2 rounded">
                        消除白边核心
                      </span>
                    </span>
                    <span className="font-mono text-pink-700 text-sm">
                      {hairConfig.edgeShift > 0 ? `+${hairConfig.edgeShift}` : hairConfig.edgeShift} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10.0"
                    max="2.0"
                    step="0.2"
                    value={hairConfig.edgeShift}
                    onInput={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const newCfg = { ...hairConfig, edgeShift: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const newCfg = { ...hairConfig, edgeShift: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    disabled={!hairConfig.enabled}
                    className="w-full accent-pink-600 cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                    <span>强力切除 (-10px)</span>
                    <span>推荐 (-2.8px)</span>
                    <span>原边 (0px)</span>
                    <span>外扩 (+2px)</span>
                  </div>
                  <p className="text-[10px] text-pink-600/90 leading-tight pt-0.5">
                    💡 往左滑动可将头发、耳朵与颈部外围残存的原图白边整圈切除，画面实时跟随变化！
                  </p>
                </div>

                {/* 2. De-fringe */}
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/70 space-y-1">
                  <div className="flex items-center justify-between text-xs text-stone-700 font-medium">
                    <span title="消除原图背景色在发丝和颈部边缘形成的浅色反光与光晕">
                      发丝与颈部消色溢 (De-fringe)
                    </span>
                    <span className="font-mono text-pink-600 font-bold">{hairConfig.deFringe}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={hairConfig.deFringe}
                    onInput={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const newCfg = { ...hairConfig, deFringe: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const newCfg = { ...hairConfig, deFringe: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    disabled={!hairConfig.enabled}
                    className="w-full accent-pink-600 cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400">
                    <span>原样保留</span>
                    <span>深度净边 (推荐 90%~100%)</span>
                  </div>
                  <p className="text-[10px] text-stone-400 leading-tight pt-0.5">
                    将浅色边缘自动替换为真实的黑发发色与红润颈部肤色。
                  </p>
                </div>

                {/* 3. Feathering / Anti-aliasing */}
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-700 mb-1 font-medium">
                    <span title="消除边缘阶梯锯齿与生硬轮廓，使发梢与颈部自然融入底色">
                      边缘柔和羽化与抗锯齿 (Feather)
                    </span>
                    <span className="font-mono text-pink-600 font-bold">{hairConfig.feather} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3.5"
                    step="0.1"
                    value={hairConfig.feather}
                    onInput={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const newCfg = { ...hairConfig, feather: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const newCfg = { ...hairConfig, feather: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    disabled={!hairConfig.enabled}
                    className="w-full accent-pink-600 cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                    <span>硬边干净</span>
                    <span>柔和过渡 (1.0px 推荐)</span>
                  </div>
                </div>

                {/* 4. Hair Texture Boost */}
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-700 mb-1 font-medium">
                    <span title="增强深色头发的微发缕对比与光泽，使头发不再是一团死黑">
                      发丝纹理立体感与光泽
                    </span>
                    <span className="font-mono text-pink-600 font-bold">
                      {hairConfig.textureBoost}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={hairConfig.textureBoost}
                    onInput={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const newCfg = { ...hairConfig, textureBoost: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const newCfg = { ...hairConfig, textureBoost: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    disabled={!hairConfig.enabled}
                    className="w-full accent-pink-600 cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                    <span>平滑</span>
                    <span>发缕分明 (50% 推荐)</span>
                  </div>
                </div>

                {/* 5. Smart Facial Skin Smoothing (面部智能磨皮与自然平滑) */}
                <div className="sm:col-span-2 bg-gradient-to-r from-amber-50/60 via-pink-50/50 to-rose-50/60 p-3.5 rounded-xl border border-pink-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-800 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-pink-600" />
                      <span>面部智能磨皮与自然平滑 (Skin Smoothing)</span>
                      <span className="text-[10px] font-normal text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full font-sans">
                        抚平粗糙毛孔与暗沉
                      </span>
                    </span>
                    <span className="font-mono text-pink-700 font-bold text-sm">
                      {hairConfig.skinSmoothing ?? 65}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={hairConfig.skinSmoothing ?? 65}
                    onInput={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const newCfg = { ...hairConfig, skinSmoothing: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const newCfg = { ...hairConfig, skinSmoothing: val };
                      setHairConfig(newCfg);
                      applyHairOptimization(newCfg);
                    }}
                    disabled={!hairConfig.enabled}
                    className="w-full accent-pink-600 cursor-pointer disabled:opacity-50"
                  />

                  <div className="flex justify-between items-center text-[10px] text-stone-600 font-medium pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const newCfg = { ...hairConfig, skinSmoothing: 0 };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                      }}
                      className="hover:text-stone-900 px-1.5 py-0.5 rounded hover:bg-white/60 cursor-pointer transition-colors"
                    >
                      关闭磨皮 (0%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCfg = { ...hairConfig, skinSmoothing: 35 };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                      }}
                      className="hover:text-stone-900 px-1.5 py-0.5 rounded hover:bg-white/60 cursor-pointer transition-colors"
                    >
                      轻微平滑 (35%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCfg = { ...hairConfig, skinSmoothing: 65 };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                      }}
                      className="font-bold text-pink-600 hover:text-pink-700 px-1.5 py-0.5 rounded bg-pink-100/70 cursor-pointer transition-colors"
                    >
                      自然影楼精修 (65% 推荐)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCfg = { ...hairConfig, skinSmoothing: 90 };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                      }}
                      className="hover:text-stone-900 px-1.5 py-0.5 rounded hover:bg-white/60 cursor-pointer transition-colors"
                    >
                      强效柔肤 (90%)
                    </button>
                  </div>

                  <p className="text-[10px] text-pink-700/80 leading-relaxed">
                    💡 智能双边边缘保留滤波：深度抚平面部粗糙、毛孔暗沉与胡茬斑驳，精准保留双眼、鼻梁高光、嘴唇轮廓与耳朵结构的极致清晰！
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Framing, Position, Suit Attire & Beauty Controls */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  5
                </div>
                <h3 className="text-sm font-bold text-stone-900">人像微调、正装换装与调光</h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setZoom(1.0);
                  setPanX(0);
                  setPanY(0);
                  setRotation(0);
                  setFlipX(false);
                  setBrightness(0);
                  setContrast(0);
                  setSelectedSuitId('none');
                }}
                className="text-[11px] text-stone-500 hover:text-stone-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>重置微调</span>
              </button>
            </div>

            {/* Suit Attire Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700 flex items-center gap-1">
                  <Shirt className="w-3.5 h-3.5 text-indigo-600" />
                  智能正装换装（西装/衬衫）:
                </span>
                <span className="text-[11px] text-stone-400">日常便服一秒变商务正装</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSuitId('none')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedSuitId === 'none'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  保持原衣服
                </button>
                {SUIT_OVERLAYS.map((suit) => {
                  const active = selectedSuitId === suit.id;
                  return (
                    <button
                      key={suit.id}
                      type="button"
                      onClick={() => {
                        setSelectedSuitId(suit.id);
                        setSuitScale(suit.defaultScale);
                        setSuitOffsetY(suit.defaultOffsetY);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border truncate transition-all cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                      title={suit.description}
                    >
                      {suit.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Suit position fine-tuning if suit is selected */}
            {selectedSuitId !== 'none' && (
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex items-center justify-between text-stone-600 mb-1">
                    <span>西装大小缩放</span>
                    <span className="font-mono">{Math.round(suitScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.02"
                    value={suitScale}
                    onChange={(e) => setSuitScale(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-stone-600 mb-1">
                    <span>西装领口上下位置</span>
                    <span className="font-mono">{suitOffsetY} px</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={suitOffsetY}
                    onChange={(e) => setSuitOffsetY(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Zoom & Framing Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs text-stone-700 mb-1 font-medium">
                  <span>人像缩放比例</span>
                  <span className="font-mono">{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-stone-700 mb-1 font-medium">
                  <span>旋转校正</span>
                  <span className="font-mono">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-stone-700 mb-1 font-medium">
                  <span>人像肤色提亮</span>
                  <span className="font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-stone-700 mb-1 font-medium">
                  <span>画面对比度</span>
                  <span className="font-mono">{contrast > 0 ? `+${contrast}` : contrast}</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setFlipX((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  flipX
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>水平翻转 (镜面校正)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGuidelines((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  showGuidelines
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {showGuidelines ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{showGuidelines ? '隐藏对齐基准虚线' : '显示对齐基准虚线'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live High-Definition Canvas Preview & Smart Clarity Controls (Width: 5 / 12) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  实时超清预览 • {currentSpec.name}
                </h3>
                <p className="text-[11px] text-stone-500 font-mono">
                  {targetWidthPx} × {targetHeightPx} px @ 300 DPI (冲印级精度)
                </p>
              </div>

              {/* Format selection */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setExportFormat('png')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    exportFormat === 'png'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('jpg')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    exportFormat === 'jpg'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  JPG
                </button>
              </div>
            </div>

            {/* Interactive Canvas Viewport */}
            <div
              className={`relative rounded-xl overflow-hidden border border-stone-200 flex items-center justify-center p-4 min-h-[380px] select-none ${
                currentColor.type === 'transparent'
                  ? 'bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%),linear-gradient(-45deg,#f0f0f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0f0f0_75%),linear-gradient(-45deg,transparent_75%,#f0f0f0_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]'
                  : 'bg-stone-100'
              }`}
            >
              <canvas
                ref={previewCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="max-h-[340px] max-w-full rounded shadow-md border border-stone-300/80 cursor-grab active:cursor-grabbing transition-transform"
                style={{
                  aspectRatio: `${targetWidthPx} / ${targetHeightPx}`,
                }}
              />

              {/* Top compare badge button: Hold to Compare original */}
              <div className="absolute top-2.5 right-2.5">
                <button
                  type="button"
                  onMouseDown={() => setIsComparingOriginal(true)}
                  onMouseUp={() => setIsComparingOriginal(false)}
                  onMouseLeave={() => setIsComparingOriginal(false)}
                  onTouchStart={() => setIsComparingOriginal(true)}
                  onTouchEnd={() => setIsComparingOriginal(false)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer select-none ${
                    isComparingOriginal
                      ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                      : 'bg-black/60 hover:bg-black/75 text-white/90 backdrop-blur-xs'
                  }`}
                  title="按住即可查看未进行发丝去白边与清晰度增强的原始画质"
                >
                  <Eye className="w-3 h-3" />
                  <span>{isComparingOriginal ? '正在显示原画质...' : '按住对比原画质'}</span>
                </button>
              </div>

              {/* Drag instruction overlay badge */}
              <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/60 text-white/90 backdrop-blur-xs">
                  按住左键拖拽平移 • 滚轮缩放 • 超清去白边实时呈现
                </span>
              </div>
            </div>

            {/* Smart Image Clarity Controls (智能优化图片清晰度) */}
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      智能优化图片清晰度 (AI 超清重建)
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                        解决下载模糊
                      </span>
                    </h4>
                    <p className="text-[10px] text-stone-500">
                      自适应锐化眼睛、眉毛、发丝与五官轮廓，防止画面发糊
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clarityConfig.enabled}
                    onChange={(e) =>
                      setClarityConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-amber-900">开启超清</span>
                </label>
              </div>

              {/* Clarity Intensity Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-stone-700 font-medium">
                  <span>清晰度增强强度:</span>
                  <span className="font-mono text-amber-700 font-bold">{clarityConfig.strength}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={clarityConfig.strength}
                  onChange={(e) =>
                    setClarityConfig((prev) => ({ ...prev, strength: Number(e.target.value) }))
                  }
                  disabled={!clarityConfig.enabled}
                  className="w-full accent-amber-600 cursor-pointer disabled:opacity-50"
                />
              </div>

              {/* Detail Mode Selection */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-stone-600 font-medium">五官与细节模式:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'balanced', label: '智能均衡', desc: '自然人像' },
                    { id: 'features', label: '五官特清', desc: '明眸发丝' },
                    { id: 'crisp', label: '极致锐利', desc: '照相馆原画' },
                  ].map((mode) => {
                    const active = clarityConfig.detailMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          setClarityConfig((prev) => ({
                            ...prev,
                            detailMode: mode.id as any,
                          }))
                        }
                        disabled={!clarityConfig.enabled}
                        className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-100 border-amber-500 text-amber-900 font-bold shadow-2xs'
                            : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <div className="text-xs">{mode.label}</div>
                        <div className="text-[9px] text-stone-400">{mode.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Download Resolution & DPI Multiplier Selector */}
              <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">下载图片清晰度规格:</span>
                  <span className="text-[11px] font-mono text-amber-700 font-bold">
                    {clarityConfig.exportDpiMultiplier === 1
                      ? `标准 300DPI (${targetWidthPx}×${targetHeightPx})`
                      : clarityConfig.exportDpiMultiplier === 2
                      ? `🔥 智能超清 600DPI (${targetWidthPx * 2}×${targetHeightPx * 2})`
                      : `💎 印刷极清 1200DPI (${targetWidthPx * 4}×${targetHeightPx * 4})`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    {
                      mult: 1 as const,
                      title: '300 DPI 官方',
                      sub: `${targetWidthPx}×${targetHeightPx}`,
                      tag: '报名规范',
                    },
                    {
                      mult: 2 as const,
                      title: '🔥 600 DPI 超清',
                      sub: `${targetWidthPx * 2}×${targetHeightPx * 2}`,
                      tag: '清晰翻倍/推荐',
                    },
                    {
                      mult: 4 as const,
                      title: '1200 DPI 极清',
                      sub: `${targetWidthPx * 4}×${targetHeightPx * 4}`,
                      tag: '印刷原画',
                    },
                  ].map((res) => {
                    const active = clarityConfig.exportDpiMultiplier === res.mult;
                    return (
                      <button
                        key={res.mult}
                        type="button"
                        onClick={() =>
                          setClarityConfig((prev) => ({
                            ...prev,
                            exportDpiMultiplier: res.mult,
                          }))
                        }
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-1 ring-amber-400'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{res.title}</div>
                        <div className={`text-[10px] font-mono ${active ? 'text-amber-100' : 'text-stone-400'}`}>
                          {res.sub}
                        </div>
                        <span
                          className={`inline-block mt-0.5 text-[9px] px-1 py-0.2 rounded font-medium ${
                            active ? 'bg-amber-700/60 text-white' : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {res.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-stone-500">
                  💡 很多网站下载的照片看起来模糊，是因为标准 1 寸 (295×413) 像素较小。选择「600DPI 智能超清」，导出分辨率翻倍，手机打开放大看发丝五官极其清晰！
                </p>
              </div>
            </div>

            {/* File Size Constraint (Exam & System Submission) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700">报名系统文件大小达标限制:</span>
                <span className="text-[11px] font-mono text-indigo-600 font-bold">
                  {fileSizeLimitKb === 0 ? '无限制 (最佳画质)' : `严格压缩至 ≤ ${fileSizeLimitKb} KB`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { kb: 0, label: '无限制' },
                  { kb: 20, label: '≤20KB' },
                  { kb: 50, label: '≤50KB' },
                  { kb: 100, label: '≤100KB' },
                  { kb: 200, label: '≤200KB' },
                ].map((lim) => (
                  <button
                    key={lim.kb}
                    type="button"
                    onClick={() => {
                      setFileSizeLimitKb(lim.kb);
                      if (lim.kb > 0 && exportFormat !== 'jpg') {
                        setExportFormat('jpg');
                      }
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      fileSizeLimitKb === lim.kb
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {lim.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-400 leading-normal">
                {fileSizeLimitKb > 0
                  ? `💡 系统将采用智能二分法压缩，严格保证文件不超过 ${fileSizeLimitKb}KB，满足公考/考研/报名系统验证！`
                  : '💡 默认无体积限制，输出最高品质与最清晰发丝细节'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100">
              {/* Primary Download: Smart Ultra-HD Download Button */}
              <button
                type="button"
                onClick={() => handleDownloadSinglePhoto(2)}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 hover:from-amber-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <Zap className="w-4 h-4 fill-amber-200 text-amber-200" />
                <span>
                  ⚡ 智能超清下载 (推荐 600DPI • {targetWidthPx * 2}×{targetHeightPx * 2} px)
                </span>
              </button>

              {/* Secondary Download: Exact Selected DPI/Size */}
              <button
                type="button"
                onClick={() => handleDownloadSinglePhoto()}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-2 border border-stone-200 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>
                  下载当前设定规格 ({currentSpec.name} • {currentColor.name} • {clarityConfig.exportDpiMultiplier * 300}DPI)
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-600" />
                  <span>6寸排版冲印照</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportFullSetZip}
                  disabled={isExportingZip}
                  className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs border border-indigo-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="一键打包生成1寸/2寸/护照规格，含300DPI官方版与600DPI超清版红蓝白全底色"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isExportingZip ? '打包中...' : '全套合集 ZIP (含超清版)'}</span>
                </button>
              </div>

              {/* Send to Retouch Workspace */}
              {onSendToRetouch && (
                <button
                  type="button"
                  onClick={handleSendToWorkspace}
                  disabled={!portraitState.file && !portraitState.transparentBlob}
                  className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                  title="导入修图画板进行精细消除碎发、抹除痘痕或局部透底"
                >
                  <Wand2 className="w-3.5 h-3.5 text-pink-600" />
                  <span>发送至修图画板（擦除局部碎发/瑕疵去水印）</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onPhotoCaptured={(file) => {
          processImageFile(file);
          onNotification?.('📷 摄像头抓拍成功，AI 正在自动化抠图与发丝超清优化...');
        }}
      />

      {/* 6-Inch Print Layout Sheet Modal */}
      <PrintLayoutModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        idPhotoCanvas={previewCanvasRef.current}
        currentPresetName={currentSpec.name}
      />
    </div>
  );
};
