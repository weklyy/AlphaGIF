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
  Plus,
  Minus,
  RotateCcw,
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
  const [selectedColorId, setSelectedColorId] = useState<string>('red-guobiao');
  const [customColorHex, setCustomColorHex] = useState<string>('#D9001B');
  const [bgLightingMode, setBgLightingMode] = useState<'auto' | 'spotlight' | 'solid'>('auto');

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
  // Pure Original Photo Mode: Keeps the original photo unedited and unoptimized, just cropped to ID photo spec
  const [useOriginalOnly, setUseOriginalOnly] = useState<boolean>(false);

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
  const [printCanvases, setPrintCanvases] = useState<{
    main: HTMLCanvasElement | null;
    oneInch: HTMLCanvasElement | null;
    twoInch: HTMLCanvasElement | null;
  }>({ main: null, oneInch: null, twoInch: null });
  const [isPreparingPrint, setIsPreparingPrint] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Drag interaction on preview canvas
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Apple-style Step 2 tab state: 'spec' | 'color' | 'suit' | 'retouch'
  const [activeStepTab, setActiveStepTab] = useState<'spec' | 'color' | 'suit' | 'retouch'>('spec');

  // Canvas Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawCutoutImageDataRef = useRef<ImageData | null>(null);
  const transparentImgRef = useRef<HTMLImageElement | null>(null);
  const originalImgRef = useRef<HTMLImageElement | null>(null);

  // Find current spec
  const currentSpec =
    ID_PHOTO_PRESETS.find((p) => p.key === selectedPresetKey) || ID_PHOTO_PRESETS[0];

  const targetWidthPx =
    selectedPresetKey === 'custom' ? customWidthPx : currentSpec.widthPx;
  const targetHeightPx =
    selectedPresetKey === 'custom' ? customHeightPx : currentSpec.heightPx;

  // Selected color profile with optional lighting mode override
  const baseColor: IdColorPreset =
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
      : POPULAR_ID_COLORS.find((c) => c.id === selectedColorId) || POPULAR_ID_COLORS[0];

  const currentColor: IdColorPreset = {
    ...baseColor,
    style:
      baseColor.type === 'transparent'
        ? 'solid'
        : bgLightingMode === 'spotlight'
        ? 'radial-spotlight'
        : bgLightingMode === 'solid'
        ? 'solid'
        : baseColor.style || 'solid',
  };

  // Helper to ensure we have raw ImageData from transparentImgRef if needed
  // Helper to ensure we have raw ImageData from transparentImgRef if needed
  const ensureRawImageData = useCallback((): ImageData | null => {
    if (rawCutoutImageDataRef.current) {
      return rawCutoutImageDataRef.current;
    }
    const img = transparentImgRef.current;
    if (img && (img.naturalWidth || img.width)) {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const scale = Math.min(1, 900 / Math.max(origW, origH));
      const w = Math.round(origW * scale);
      const h = Math.round(origH * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      rawCutoutImageDataRef.current = data;
      return data;
    }
    return null;
  }, []);

  // -------------------------------------------------------------
  // File Upload & Processing (Supports Pure Original Crop vs AI Matting)
  // -------------------------------------------------------------
  const processImageFile = async (file: File, forceMode?: boolean) => {
    const originalUrl = URL.createObjectURL(file);
    const origImg = new Image();
    origImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      origImg.onload = () => resolve();
      origImg.onerror = () => reject(new Error('无法读取图片'));
      origImg.src = originalUrl;
    });
    originalImgRef.current = origImg;

    // Reset framing transforms to natural center
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    setFlipX(false);

    const isOrig = forceMode !== undefined ? forceMode : useOriginalOnly;

    if (isOrig) {
      setPortraitState({
        file,
        originalUrl,
        transparentUrl: originalUrl,
        transparentBlob: null,
        transparentImageData: null,
        isMatting: false,
        mattingProgress: 100,
        mattingMessage: '原图已就绪！仅按证件照规格裁剪，保持原始画质与原图背景',
      });
      onNotification?.(`📷 已成功载入原图！仅按「${currentSpec.name}」规格尺寸剪切，保持原图画质未做任何优化`);
      return;
    }

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

      // Extract raw data from fallback image with max 900px clamp
      const origW = fallbackImg.naturalWidth || fallbackImg.width;
      const origH = fallbackImg.naturalHeight || fallbackImg.height;
      const scale = Math.min(1, 900 / Math.max(origW, origH));
      const w = Math.round(origW * scale);
      const h = Math.round(origH * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(fallbackImg, 0, 0, w, h);
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

  // Switch to AI matting on-demand if user was in pure original mode
  const triggerAiMatting = async () => {
    if (!portraitState.file) return;
    if (portraitState.transparentBlob && rawCutoutImageDataRef.current) {
      setUseOriginalOnly(false);
      onNotification?.('已切换至「智能抠图换底精修」模式：支持替换底色、智能正装与发丝超清优化');
      return;
    }

    setPortraitState((prev) => ({
      ...prev,
      isMatting: true,
      mattingProgress: 15,
      mattingMessage: '正在启动 AI 抠图引擎分割发丝与人像...',
    }));

    try {
      const cacheKey = `id_matting_${portraitState.file.name}_${portraitState.file.size}_${portraitState.file.lastModified}`;
      const mattingResult = await removeBackgroundWithAI(
        portraitState.file,
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

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('无法解析抠图结果图像'));
        img.src = mattingResult.url;
      });
      transparentImgRef.current = img;

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

      setUseOriginalOnly(false);
      onNotification?.('✨ AI 智能抠图成功！已完成人像提取与发丝颈部去白边优化');
    } catch (err: any) {
      console.error('AI Matting failed, falling back:', err);
      setUseOriginalOnly(false);
      onNotification?.('已切换为智能换底模式');
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
      deFringe: 90,
      feather: 0.5,
      edgeShift: -1.2, // 默认物理微收 1.2px，配合消色溢彻底消除红底白边
      textureBoost: 45,
      skinSmoothing: 50, // 自然影楼级磨皮，抚平脸部粗糙与暗沉
    };
    setHairConfig(newHairConfig);
    applyHairOptimization(newHairConfig);

    setClarityConfig({
      enabled: true,
      strength: 65,
      detailMode: 'balanced',
      exportDpiMultiplier: 2,
    });
    setBrightness(2);
    setContrast(4);
    onNotification?.('⚡ 已一键应用智能最佳调优：白边净化 + 发际精修 + 衣服边缘锐利保护 + 五官超清增强！');
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

      // 0. Pure Original Photo Mode OR Hold-to-Compare:
      // If user enabled "纯原图仅裁剪" or is holding "对比原图", render pristine original photo without ANY modification!
      if ((useOriginalOnly || isComparingOriginal) && originalImgRef.current) {
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        const orig = originalImgRef.current;
        const origW = orig.naturalWidth || orig.width;
        const origH = orig.naturalHeight || orig.height;
        const imgAspect = origW / origH;
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
        drawW *= zoom;
        drawH *= zoom;
        ctx.translate(width / 2 + panX * dpiScale, height / 2 + panY * dpiScale);
        if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
        if (flipX) ctx.scale(-1, 1);
        ctx.drawImage(orig, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // Standard Guidelines for on-screen composition (if enabled)
        if (withGuides) {
          ctx.save();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)';
          ctx.lineWidth = Math.max(1, Math.round(dpiScale));
          ctx.setLineDash([4 * dpiScale, 4 * dpiScale]);

          const topHeadY = Math.round(height * 0.12);
          ctx.beginPath();
          ctx.moveTo(0, topHeadY);
          ctx.lineTo(width, topHeadY);
          ctx.stroke();

          const eyesY = Math.round(height * 0.38);
          ctx.beginPath();
          ctx.moveTo(0, eyesY);
          ctx.lineTo(width, eyesY);
          ctx.stroke();

          const chinY = Math.round(height * 0.68);
          ctx.beginPath();
          ctx.moveTo(0, chinY);
          ctx.lineTo(width, chinY);
          ctx.stroke();

          const midX = Math.round(width / 2);
          ctx.beginPath();
          ctx.moveTo(midX, 0);
          ctx.lineTo(midX, height);
          ctx.stroke();

          ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
          ctx.font = `${Math.round(10 * dpiScale)}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText('头顶基准线', 8 * dpiScale, topHeadY - 4 * dpiScale);
          ctx.fillText('双眼水平线', 8 * dpiScale, eyesY - 4 * dpiScale);
          ctx.fillText('下巴基准线', 8 * dpiScale, chinY - 4 * dpiScale);

          ctx.restore();
        }
        return;
      }

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
      const subjectSource: HTMLCanvasElement | HTMLImageElement | null =
        overrideSubjectSource !== undefined
          ? overrideSubjectSource
          : (hairConfig.enabled && optimizedCanvas
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

        // TORSO BOTTOM EXTENSION (Eliminates bottom red background box / gap):
        // When user drags subject upwards (panY < 0), or due to aspect ratio / zoom,
        // the bottom edge of the subject (-drawH/2 to drawH/2) might end above canvas bottom (height).
        // In local coordinates, canvas bottom is (height - centerY).
        // If (height - centerY) > drawH / 2, an exposed gap of background color (e.g. red) would appear under the clothes!
        // We seamlessly extend the bottom-most 4px strip of the clothing fabric down to the canvas bottom.
        const canvasBottomInLocal = height - centerY;
        if (canvasBottomInLocal > drawH / 2) {
          const extensionHeight = canvasBottomInLocal - drawH / 2 + 3;
          ctx.drawImage(
            subjectSource,
            0,
            Math.max(0, naturalH - 4),
            naturalW,
            4,
            -drawW / 2,
            drawH / 2 - 1,
            drawW,
            extensionHeight
          );
        }

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
      useOriginalOnly,
    ]
  );

  // Synchronously apply hair & edge optimization
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
    },
    [ensureRawImageData]
  );

  // Synchronously update whenever hairConfig changes
  useEffect(() => {
    if (silhouetteFieldRef.current || rawCutoutImageDataRef.current) {
      applyHairOptimization(hairConfig);
    }
  }, [hairConfig, applyHairOptimization]);

  // Re-render preview canvas whenever settings or optimizedCanvas change
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
    portraitState.originalUrl,
    optimizedCanvas,
    isComparingOriginal,
    useOriginalOnly,
  ]);

  // -------------------------------------------------------------
  // Drag & Zoom Interaction with Bottom Torso Anchoring (NO Red Box at Bottom)
  // -------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;

    // Calculate actual drawn height to strictly anchor bottom edge
    const subject = useOriginalOnly
      ? originalImgRef.current
      : (optimizedCanvas || transparentImgRef.current);
    let drawW = targetWidthPx;
    let drawH = targetHeightPx;
    if (subject) {
      const naturalW =
        subject instanceof HTMLImageElement ? subject.naturalWidth || subject.width : subject.width;
      const naturalH =
        subject instanceof HTMLImageElement ? subject.naturalHeight || subject.height : subject.height;
      const imgAspect = naturalW / naturalH;
      const canvasAspect = targetWidthPx / targetHeightPx;
      if (imgAspect > canvasAspect) {
        drawH = targetHeightPx;
        drawW = targetHeightPx * imgAspect;
      } else {
        drawW = targetWidthPx;
        drawH = targetWidthPx / imgAspect;
      }
      drawW *= zoom;
      drawH *= zoom;
    }

    if (useOriginalOnly) {
      // In original photo cropping mode, allow smooth flexible panning within bounds to compose the portrait
      const maxPanX = Math.max(targetWidthPx * 0.8, (drawW - targetWidthPx) / 2);
      const maxPanY = Math.max(targetHeightPx * 0.8, (drawH - targetHeightPx) / 2);
      setPanX(Math.max(-maxPanX, Math.min(maxPanX, newPanX)));
      setPanY(Math.max(-maxPanY, Math.min(maxPanY, newPanY)));
    } else {
      // STRICT CLAMPING for AI mode: In canvas coordinates, the bottom of the subject is:
      //   bottomY = targetHeightPx / 2 + panY + drawH / 2
      // To ensure the torso clothes ALWAYS touch or exceed the bottom of the canvas:
      //   targetHeightPx / 2 + panY + drawH / 2 >= targetHeightPx
      //   => panY >= (targetHeightPx - drawH) / 2
      // Thus minimum panY (most upward movement allowed) is:
      const minPanY = (targetHeightPx - drawH) / 2;
      // Maximum downward movement allowed (prevents head sinking off screen)
      const maxPanY = targetHeightPx * 0.25;
      // Horizontal bounds
      const limitX = targetWidthPx * 0.35;

      setPanX(Math.max(-limitX, Math.min(limitX, newPanX)));
      setPanY(Math.max(minPanY, Math.min(maxPanY, newPanY)));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSnapToBottomCenter = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    onNotification?.('已复位居中对齐');
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
      useOriginalOnly ? false : clarityConfig.enabled
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
    a.download = useOriginalOnly
      ? `证件照_原图裁剪_${currentSpec.name}_${targetWidthPx}x${targetHeightPx}_${dpiLabel}${sizeNote}.${effectiveFormat}`
      : `证件照_${currentSpec.name}_${currentColor.name}_${dpiLabel}${sizeNote}.${effectiveFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(res.url);

    onNotification?.(
      useOriginalOnly
        ? `🎉 已成功导出「${currentSpec.name}」原图剪裁照！(${finalW}×${finalH} px @ ${300 * dpiMultiplier} DPI，保持原图画质未做任何优化)`
        : `🎉 智能证件照已成功导出！(${finalW}×${finalH} px @ ${300 * dpiMultiplier} DPI, ${Math.round(res.size / 1024)} KB)！`
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

  // Generate pristine, 100% guideline-free canvases for 6-inch print layout
  const handleOpenPrintModal = async () => {
    setIsPreparingPrint(true);
    onNotification?.('正在排版冲印底图（已自动清除屏幕构图辅助线）...');
    try {
      // 1. Current specification clean photo (STRICTLY withGuides = false)
      const mainCanvas = document.createElement('canvas');
      await renderIdPhotoToCanvas(
        mainCanvas,
        targetWidthPx,
        targetHeightPx,
        false, // withGuides: false (NEVER include blue dashed guidelines or guide text!)
        2,     // 600 DPI for high fidelity
        useOriginalOnly ? false : clarityConfig.enabled
      );

      // 2. Standard 1-inch clean photo (STRICTLY withGuides = false)
      const oneInchCanvas = document.createElement('canvas');
      await renderIdPhotoToCanvas(
        oneInchCanvas,
        295,
        413,
        false, // withGuides: false
        2,
        useOriginalOnly ? false : clarityConfig.enabled
      );

      // 3. Standard 2-inch clean photo (STRICTLY withGuides = false)
      const twoInchCanvas = document.createElement('canvas');
      await renderIdPhotoToCanvas(
        twoInchCanvas,
        413,
        579,
        false, // withGuides: false
        2,
        useOriginalOnly ? false : clarityConfig.enabled
      );

      setPrintCanvases({
        main: mainCanvas,
        oneInch: oneInchCanvas,
        twoInch: twoInchCanvas,
      });
      setIsPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to prepare print canvas:', err);
      onNotification?.('排版底图生成失败，请重试');
    } finally {
      setIsPreparingPrint(false);
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
      {/* Apple-style Minimal Header */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 md:p-5 border border-stone-200/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <span>智能证件照制作工坊</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
              极简极速
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              国标 300/600 DPI
            </span>
          </div>
          <p className="text-xs text-stone-500">
            三步自然逻辑：<span className="text-stone-800 font-semibold">① 上传正面人像</span> → <span className="text-stone-800 font-semibold">② 选规格换底色</span> → <span className="text-stone-800 font-semibold">③ 实时预览下载</span>
          </p>
        </div>

        {/* Quick Actions & Demo Portals */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOneClickAutoEnhance}
            className="px-3.5 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-black text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="一键切除白边、消除光晕杂色、提升五官清晰度"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>智能一键调优</span>
          </button>

          <div className="flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl text-xs border border-stone-200/60">
            <span className="text-[11px] text-stone-400 pl-1.5 font-medium">示例：</span>
            {DEMO_PORTRAITS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => handleSelectDemoPortrait(demo)}
                disabled={portraitState.isMatting}
                className="px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-stone-950 hover:bg-white rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {demo.id === 'demo-male-mature' ? '👨 自然发丝' : demo.gender === 'male' ? '👨 青年男' : '👩 职场女'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration Controls (Width: 7 / 12) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Apple-style Step 1: Upload Photo Card */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h3 className="text-sm font-bold text-stone-900">第一步：上传照片</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-stone-600" />
                  <span>摄像头拍照</span>
                </button>
              </div>
            </div>

            {/* Mode Switcher in Step 1: Pure Original Crop (No Optimization) vs AI Matting & Enhance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200/70">
              <button
                type="button"
                onClick={() => {
                  setUseOriginalOnly(true);
                  onNotification?.('已启用「纯原图直接裁切」：使用原图仅按证件照尺寸裁剪，保留原图真实画质与原图背景，不做任何优化');
                }}
                className={`px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  useOriginalOnly
                    ? 'bg-white text-stone-900 shadow-2xs font-bold border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${useOriginalOnly ? 'bg-blue-600 text-white' : 'bg-stone-200 text-stone-500'}`}>
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>纯原图直接裁切</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                      原图零优化
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 truncate">保留原图背景与画质 • 仅按一寸等规格裁剪</p>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (portraitState.file && !portraitState.transparentBlob) {
                    await triggerAiMatting();
                  } else {
                    setUseOriginalOnly(false);
                    onNotification?.('已切换至「智能抠图换底精修」模式：支持替换底色、智能正装与发丝超清优化');
                  }
                }}
                className={`px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  !useOriginalOnly
                    ? 'bg-white text-stone-900 shadow-2xs font-bold border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${!useOriginalOnly ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'}`}>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>智能抠图换底精修</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                      AI换底 • 正装
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 truncate">自动去背景 • 红/蓝/白底 • 正装换装</p>
                </div>
              </button>
            </div>

            {/* If photo is already uploaded, show clean minimal summary card */}
            {portraitState.file ? (
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                useOriginalOnly ? 'bg-blue-50/70 border-blue-200' : 'bg-stone-50/80 border-stone-200'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  {portraitState.originalUrl ? (
                    <img
                      src={portraitState.originalUrl}
                      alt="已上传照片"
                      className="w-12 h-14 object-cover rounded-lg border border-stone-300/80 shrink-0 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-14 rounded-lg bg-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {portraitState.file.name}
                    </p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      {(portraitState.file.size / 1024).toFixed(1)} KB • {useOriginalOnly ? '纯原图模式 (100% 原始画质与原背景)' : 'AI 抠图与发丝优化已就绪'}
                    </p>
                    {useOriginalOnly ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                        <Check className="w-3 h-3 text-blue-600" />
                        原图载入成功 • 仅裁剪未做任何优化
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        人像识别成功
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {useOriginalOnly && (
                    <button
                      type="button"
                      onClick={triggerAiMatting}
                      className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                      title="切换为 AI 抠图换底色"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>开启AI换底</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    更换照片
                  </button>
                </div>
              </div>
            ) : (
              /* Dropzone when no photo is uploaded */
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer border-stone-300 hover:border-stone-500 hover:bg-stone-50/60"
              >
                <div className="flex flex-col items-center justify-center gap-2.5">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xs ${useOriginalOnly ? 'bg-blue-50 text-blue-600' : 'bg-stone-100 text-stone-600'}`}>
                    {useOriginalOnly ? <Camera className="w-5 h-5 text-blue-600" /> : <Upload className="w-5 h-5 text-stone-700" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-stone-800">
                      {useOriginalOnly
                        ? `点击选取照片，直接按「${currentSpec.name}」规格精准剪切原图`
                        : '点击选取照片，或将人像图片拖拽到这里'}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {useOriginalOnly
                        ? '📷 保持原图真实画质与原图背景，不做抠图换底与磨皮滤镜，0 秒极速完成'
                        : '支持 JPG / PNG / WEBP，自动人像抠图、发丝去白边与智能换底'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Matting Progress Indicator */}
            {portraitState.isMatting && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-stone-800 font-bold">
                    <div className="w-4 h-4 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
                    <span>{portraitState.mattingMessage || 'AI 正在自动抠图精修发丝中...'}</span>
                  </div>
                  <span className="font-mono text-stone-600">{portraitState.mattingProgress}%</span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-stone-900 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${portraitState.mattingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Apple-style Step 2: Specification & Customization Card with Segmented Tabs */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-stone-900">第二步：选择规格与调整</h3>
                </div>

                {/* Mode Switcher: AI Smart Retouch vs Pure Original Crop */}
                <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-semibold gap-1 self-start sm:self-auto border border-stone-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setUseOriginalOnly(false);
                      onNotification?.('已切换至「智能抠图换底精修」模式：支持替换底色、智能正装与发丝超清优化');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      !useOriginalOnly
                        ? 'bg-white text-stone-900 shadow-2xs font-bold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${!useOriginalOnly ? 'text-amber-500' : 'text-stone-400'}`} />
                    <span>智能抠图换底精修</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseOriginalOnly(true);
                      onNotification?.('已开启「纯原图仅裁剪」模式：保持上传原图背景与 100% 原始画质，不做任何换底磨皮优化');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      useOriginalOnly
                        ? 'bg-stone-900 text-white shadow-2xs font-bold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Camera className={`w-3.5 h-3.5 ${useOriginalOnly ? 'text-amber-300' : 'text-stone-400'}`} />
                    <span>纯原图仅裁剪规格 (不做任何优化)</span>
                  </button>
                </div>
              </div>

              {/* Informative Banner for Pure Original Photo Mode */}
              {useOriginalOnly && (
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 flex items-start gap-2.5 animate-in fade-in duration-150">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>纯原图剪裁模式生效中</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-200/70 text-blue-800 font-semibold">
                        原图原画质 • 零优化
                      </span>
                    </p>
                    <p className="text-[11px] text-blue-800/90 leading-relaxed">
                      当前直接使用您上传的 100% 原始照片，<strong>保留原图背景、不做抠图换底、不做磨皮滤镜</strong>；仅精准裁剪为所选规格尺寸（如标准 1 寸 25×35mm）。可在预览区使用右侧加减号缩放，拖动画面对齐构图基准线。
                    </p>
                  </div>
                </div>
              )}

              {/* Apple-style Segmented Control Bar */}
              <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-semibold gap-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveStepTab('spec')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeStepTab === 'spec'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  📏 证件规格
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStepTab('color')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeStepTab === 'color'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  🎨 背景底色 {useOriginalOnly && <span className="text-[10px] text-stone-400 font-normal">(原图背景)</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStepTab('suit')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeStepTab === 'suit'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  👔 正装换装
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStepTab('retouch')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeStepTab === 'retouch'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  ✨ 发丝美化
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: SPECIFICATION */}
            {activeStepTab === 'spec' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                {useOriginalOnly && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl text-xs text-blue-950 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        纯原图剪裁模式生效中：仅按所选「<strong>{currentSpec.name}</strong>（{currentSpec.widthMm}×{currentSpec.heightMm}mm）」裁剪，保持 100% 原始画质与原图背景，不做任何修改。
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md shrink-0">
                      {targetWidthPx} × {targetHeightPx} px
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>常用国家官方标准规格（点击即可切换）：</span>
                  <span className="font-mono font-medium">
                    {currentSpec.widthMm} × {currentSpec.heightMm} mm ({targetWidthPx} × {targetHeightPx} px @ 300DPI)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ID_PHOTO_PRESETS.map((spec) => {
                    const active = selectedPresetKey === spec.key;
                    return (
                      <button
                        key={spec.key}
                        type="button"
                        onClick={() => setSelectedPresetKey(spec.key)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-stone-50/60 hover:bg-stone-100/80 border-stone-200 text-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${active ? 'text-white' : 'text-stone-900'}`}>
                            {spec.name}
                          </span>
                          {active && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={active ? 'text-stone-300 font-mono' : 'text-stone-500 font-mono'}>
                            {spec.widthMm}×{spec.heightMm}mm
                          </span>
                          <span className={`text-[10px] ${active ? 'text-stone-300' : 'text-stone-400'}`}>
                            {spec.key === '1-inch'
                              ? '常用报名'
                              : spec.key === '2-inch'
                              ? '护照签证'
                              : spec.key === 'small-2-inch'
                              ? '通行证'
                              : '官方规范'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Spec description card */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-800">{currentSpec.name}：</span>
                    <span>{currentSpec.description}</span>
                  </div>
                </div>

                {/* Custom size inputs if 'custom' is selected */}
                {selectedPresetKey === 'custom' && (
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-stone-600 font-medium mb-1">宽度 (像素 px):</label>
                      <input
                        type="number"
                        value={customWidthPx}
                        onChange={(e) => setCustomWidthPx(Math.max(50, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono text-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 font-medium mb-1">高度 (像素 px):</label>
                      <input
                        type="number"
                        value={customHeightPx}
                        onChange={(e) => setCustomHeightPx(Math.max(50, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono text-stone-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: BACKGROUND COLOR */}
            {activeStepTab === 'color' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {useOriginalOnly && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">当前处于「纯原图直接裁切」模式</p>
                        <p className="text-[11px] text-amber-800">
                          正在直接使用您上传照片的原始背景，未做任何换底。若需要更换底色（红/蓝/白），请开启智能换底。
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={triggerAiMatting}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>一键开启智能换底</span>
                    </button>
                  </div>
                )}
                {/* Lighting Mode Switcher */}
                <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-100">
                  <span className="text-stone-500 font-medium">背景渲染光效风格：</span>
                  <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setBgLightingMode('auto')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        bgLightingMode === 'auto'
                          ? 'bg-white text-stone-900 font-bold shadow-2xs'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      智能预设
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgLightingMode('spotlight')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        bgLightingMode === 'spotlight'
                          ? 'bg-white text-rose-600 font-bold shadow-2xs'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      <span>✨ 影楼柔光</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgLightingMode('solid')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        bgLightingMode === 'solid'
                          ? 'bg-white text-stone-900 font-bold shadow-2xs'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      官方纯色
                    </button>
                  </div>
                </div>

                {/* Red ID Photo Specialized Bar */}
                <div className="p-3 bg-red-50/60 rounded-xl border border-red-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      红底标准专区 (国家考试 / 婚姻登记 / 影楼调优)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newCfg: HairOptimizationConfig = {
                          ...hairConfig,
                          enabled: true,
                          deFringe: 100,
                          edgeShift: -1.8,
                          feather: 0.5,
                          textureBoost: 45,
                          skinSmoothing: 50,
                        };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                        onNotification?.('✨ 已执行红底白边净化：微收1.8px + 消色溢100%，红底白边已彻底消除');
                      }}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>一键消除红底白边</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'red-guobiao', name: '国标标准红', hex: '#D9001B', tag: '官方考试' },
                      { id: 'red-spotlight', name: '影楼柔光红', hex: '#E21E2C', tag: '立体聚光' },
                      { id: 'red-classic', name: '结婚登记红', hex: '#C8102E', tag: '婚姻登记' },
                    ].map((item) => {
                      const isCur = selectedColorId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedColorId(item.id)}
                          className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                            isCur
                              ? 'bg-white border-red-600 shadow-2xs ring-1 ring-red-500'
                              : 'bg-white/90 hover:bg-white border-red-200/70'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded shrink-0 border border-black/10"
                            style={{ backgroundColor: item.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-stone-900 truncate">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono">{item.tag}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Popular Background Colors */}
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
                            ? 'border-stone-900 bg-stone-50 shadow-xs ring-1 ring-stone-900/20'
                            : 'border-stone-200 hover:border-stone-300 bg-white'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md shrink-0 border border-stone-300/80 shadow-2xs ${
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
                        ? 'border-stone-900 bg-stone-50 shadow-xs ring-1 ring-stone-900/20'
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
                      className="w-5 h-5 rounded-md shrink-0 border border-stone-300 cursor-pointer p-0 bg-transparent"
                    />
                    <div className="text-left overflow-hidden">
                      <div className="text-xs font-bold text-stone-800">自定义颜色</div>
                      <div className="text-[10px] text-stone-400 font-mono">{customColorHex}</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: SUIT & ATTIRE */}
            {activeStepTab === 'suit' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {useOriginalOnly && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">当前处于「纯原图直接裁切」模式</p>
                        <p className="text-[11px] text-amber-800">
                          正在直接使用您上传照片的原衣服，未做正装叠加。若需要换上职业西装或衬衫，请开启智能换底。
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={triggerAiMatting}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>一键开启智能换底</span>
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>一键智能正装换装（西装/衬衫）：</span>
                  <span className="text-stone-400">自动智能对齐双肩与领口</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSuitId('none')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedSuitId === 'none'
                        ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
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
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border truncate transition-all cursor-pointer ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                        title={suit.description}
                      >
                        {suit.name}
                      </button>
                    );
                  })}
                </div>

                {/* Suit position fine-tuning if suit is selected */}
                {selectedSuitId !== 'none' && (
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 grid grid-cols-2 gap-3 text-xs">
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
                        className="w-full accent-stone-900 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-stone-600 mb-1">
                        <span>领口上下位置</span>
                        <span className="font-mono">{suitOffsetY} px</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="1"
                        value={suitOffsetY}
                        onChange={(e) => setSuitOffsetY(Number(e.target.value))}
                        className="w-full accent-stone-900 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 4: RETOUCH & BEAUTY */}
            {activeStepTab === 'retouch' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {useOriginalOnly && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">当前处于「纯原图直接裁切」模式</p>
                        <p className="text-[11px] text-amber-800">
                          正在直接使用您上传照片的 100% 原始像素，未加任何磨皮与滤镜。若需要人像磨皮与发丝去白边，请开启智能换底。
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={triggerAiMatting}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>一键开启智能换底</span>
                    </button>
                  </div>
                )}
                {/* One-click white edge elimination presets */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-stone-700" />
                      边缘去白边与发丝精修
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newCfg: HairOptimizationConfig = {
                          ...hairConfig,
                          enabled: true,
                          deFringe: 95,
                          feather: 0.5,
                          edgeShift: -1.2,
                          textureBoost: 45,
                          skinSmoothing: 50,
                        };
                        setHairConfig(newCfg);
                        applyHairOptimization(newCfg);
                        onNotification?.('已启用官方证件标准微收1.2px，白边已消除');
                      }}
                      className="px-2.5 py-1 bg-stone-900 hover:bg-black text-white text-[11px] font-semibold rounded-lg cursor-pointer transition-all"
                    >
                      推荐微收 (1.2px)
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-stone-700 font-medium">
                      <span>边缘物理微收剪切 (Edge Trim):</span>
                      <span className="font-mono font-bold text-stone-900">
                        {hairConfig.edgeShift} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-5.0"
                      max="1.0"
                      step="0.2"
                      value={hairConfig.edgeShift}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setHairConfig((prev) => ({ ...prev, edgeShift: val }));
                      }}
                      className="w-full accent-stone-900 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400">
                      <span>强力内收 (-5px)</span>
                      <span className="text-stone-800 font-bold">标准微收 (-1.2px)</span>
                      <span>原边 (0px)</span>
                    </div>
                  </div>
                </div>

                {/* Facial Skin Smoothing */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-800 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-stone-700" />
                      <span>面部智能自然磨皮 (Skin Smoothing)</span>
                    </span>
                    <span className="font-mono text-stone-900 font-bold">
                      {hairConfig.skinSmoothing ?? 50}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={hairConfig.skinSmoothing ?? 50}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHairConfig((prev) => ({ ...prev, skinSmoothing: val }));
                    }}
                    className="w-full accent-stone-900 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400">
                    <span>原肤色 (0%)</span>
                    <span className="text-stone-800 font-bold">影楼自然磨皮 (50% 推荐)</span>
                    <span>强力柔肤 (100%)</span>
                  </div>
                </div>

                {/* Brightness & Contrast */}
                <div className="grid grid-cols-2 gap-3 pt-1">
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
                      className="w-full accent-stone-900 cursor-pointer"
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
                      className="w-full accent-stone-900 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick utility buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setFlipX((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      flipX
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    <span>水平镜像翻转</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(0);
                      setContrast(0);
                      setFlipX(false);
                      setRotation(0);
                      onNotification?.('已重置美化微调参数');
                    }}
                    className="text-xs text-stone-500 hover:text-stone-800 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>重置微调</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live High-Definition Canvas Preview & Step 3 Download (Width: 5 / 12) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-4">
            {/* Header info & Top Controls */}
            <div className="flex flex-col gap-2 pb-2 border-b border-stone-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-[10px]">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">
                      实时效果预览 • {currentSpec.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                    {targetWidthPx} × {targetHeightPx} px @ 300 DPI
                  </p>
                </div>

                {/* Format selection */}
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setExportFormat('png')}
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
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
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      exportFormat === 'jpg'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    JPG
                  </button>
                </div>
              </div>

              {/* Top Toolbar Outside the Photo: Compare Original & Guidelines */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {useOriginalOnly ? (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center gap-1.5 shadow-2xs">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>原图剪裁模式 (100% 原始画质)</span>
                  </span>
                ) : portraitState.originalUrl ? (
                  <button
                    type="button"
                    onMouseDown={() => setIsComparingOriginal(true)}
                    onMouseUp={() => setIsComparingOriginal(false)}
                    onMouseLeave={() => setIsComparingOriginal(false)}
                    onTouchStart={() => setIsComparingOriginal(true)}
                    onTouchEnd={() => setIsComparingOriginal(false)}
                    onClick={() => setIsComparingOriginal((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 border ${
                      isComparingOriginal
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm ring-2 ring-amber-300'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                    title="按住或点击对比原始拍摄照片，松开即刻恢复精修证件照"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isComparingOriginal ? '正在对比原图...' : '按住对比原画质'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">上传人像后可对比原图</span>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuidelines((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    showGuidelines
                      ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                      : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                  }`}
                  title="开关官方人像对称构图三线（头顶/双眼/下巴）"
                >
                  {showGuidelines ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{showGuidelines ? '构图虚线: 开' : '构图虚线: 关'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Canvas Viewport */}
            <div
              className={`relative rounded-2xl overflow-hidden border border-stone-200/90 flex items-center justify-center p-4 min-h-[380px] select-none ${
                currentColor.type === 'transparent'
                  ? 'bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%),linear-gradient(-45deg,#f0f0f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0f0f0_75%),linear-gradient(-45deg,transparent_75%,#f0f0f0_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]'
                  : 'bg-stone-100/70'
              }`}
            >
              <canvas
                ref={previewCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="max-h-[340px] max-w-full rounded shadow-md border border-stone-300/80 cursor-grab active:cursor-grabbing transition-transform"
                style={{
                  aspectRatio: `${targetWidthPx} / ${targetHeightPx}`,
                }}
              />

              {/* Instant High-Performance Original Photo Overlay when Comparing */}
              {isComparingOriginal && portraitState.originalUrl && (
                <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center p-4">
                  <div
                    className="relative max-h-[340px] max-w-full rounded shadow-md overflow-hidden bg-black/5"
                    style={{
                      aspectRatio: `${targetWidthPx} / ${targetHeightPx}`,
                      width: previewCanvasRef.current?.clientWidth,
                      height: previewCanvasRef.current?.clientHeight,
                    }}
                  >
                    <img
                      src={portraitState.originalUrl}
                      alt="原始拍摄图像"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 inset-x-0 flex justify-center">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-600/95 text-white shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                        <Eye className="w-3 h-3" />
                        <span>正在对比拍摄原图（松开返回精修）</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Zoom & Framing Toolbar on the Right Side of Preview Image */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center bg-white/95 backdrop-blur-md rounded-2xl p-1.5 shadow-md border border-stone-200/90 z-20 gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}
                  className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xs"
                  title="放大照片 (+10%)"
                >
                  <Plus className="w-4 h-4 text-stone-700" />
                </button>
                <button
                  type="button"
                  onClick={handleSnapToBottomCenter}
                  className="text-[10px] font-bold font-mono text-stone-600 hover:text-stone-900 px-1 py-0.5 rounded cursor-pointer transition-colors"
                  title="点击复位缩放与居中"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.6, Number((prev - 0.1).toFixed(2))))}
                  className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xs"
                  title="缩小照片 (-10%)"
                >
                  <Minus className="w-4 h-4 text-stone-700" />
                </button>
                <div className="w-4 h-[1px] bg-stone-200 my-0.5" />
                <button
                  type="button"
                  onClick={handleSnapToBottomCenter}
                  className="w-8 h-8 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  title="一键贴底居中对齐"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Drag instruction overlay badge at bottom */}
              <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/60 text-white/90 backdrop-blur-xs">
                  按住左键拖拽平移 • 右侧加减号缩放 • 自动贴底无空隙
                </span>
              </div>
            </div>

            {/* Smart Image Clarity Controls (智能优化图片清晰度) */}
            {useOriginalOnly ? (
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-2">
                    <span>原图真实画质保护</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-200 text-blue-900 font-bold">
                      100% 原始像素
                    </span>
                  </h4>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    当前为纯原图功能：已自动关闭一切 AI 锐化、滤镜与美化，保持原图真实清晰度与原背景，仅精准剪切为所选证件照尺寸。
                  </p>
                </div>
              </div>
            ) : (
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
            )}

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
                className={`w-full py-3.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.99] ${
                  useOriginalOnly
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-stone-900 hover:from-blue-700 hover:to-stone-950'
                    : 'bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 hover:from-amber-700 hover:to-indigo-800'
                }`}
              >
                <Zap className="w-4 h-4 fill-amber-200 text-amber-200" />
                <span>
                  {useOriginalOnly
                    ? `⚡ 导出「${currentSpec.name}」原图超清剪裁照 (600DPI • ${targetWidthPx * 2}×${targetHeightPx * 2} px)`
                    : `⚡ 智能超清下载 (推荐 600DPI • ${targetWidthPx * 2}×${targetHeightPx * 2} px)`}
                </span>
              </button>

              {/* Secondary Download: Exact Selected DPI/Size */}
              <button
                type="button"
                onClick={() => handleDownloadSinglePhoto(1)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-2 border border-stone-200 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>
                  {useOriginalOnly
                    ? `下载标准规范原图照 (${currentSpec.name} • 300DPI 规范 • ${targetWidthPx}×${targetHeightPx} px)`
                    : `下载当前设定规格 (${currentSpec.name} • ${currentColor.name} • ${clarityConfig.exportDpiMultiplier * 300}DPI)`}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenPrintModal}
                  disabled={isPreparingPrint}
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="生成 6 寸照相馆标准排版冲印照，纯净无屏幕构图辅助线"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isPreparingPrint ? '排版准备中...' : useOriginalOnly ? '6寸排版冲印照 (8张原图1寸)' : '6寸排版冲印照 (8张1寸)'}</span>
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
        idPhotoCanvas={printCanvases.main}
        oneInchCanvas={printCanvases.oneInch}
        twoInchCanvas={printCanvases.twoInch}
        currentPresetName={currentSpec.name}
      />
    </div>
  );
};
