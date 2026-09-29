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
  const [selectedColorId, setSelectedColorId] = useState<string>('blue-classic');
  const [customColorHex, setCustomColorHex] = useState<string>('#0066FF');

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

  // Image Enhancement
  const [brightness, setBrightness] = useState<number>(0); // -50 to 50
  const [contrast, setContrast] = useState<number>(0); // -50 to 50
  const [skinSmoothing, setSkinSmoothing] = useState<number>(0); // 0 to 100
  const [edgeShift, setEdgeShift] = useState<number>(0); // -2 to 2 px
  const [featherEdge, setFeatherEdge] = useState<number>(1); // 0 to 4 px

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
      : POPULAR_ID_COLORS.find((c) => c.id === selectedColorId) || POPULAR_ID_COLORS[3];

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

      // Preload image element for canvas rendering
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('无法解析抠图结果图像'));
        img.src = mattingResult.url;
      });
      transparentImgRef.current = img;

      setPortraitState((prev) => ({
        ...prev,
        transparentUrl: mattingResult.url,
        transparentBlob: mattingResult.blob,
        transparentImageData: mattingResult.imageData,
        isMatting: false,
        mattingProgress: 100,
        mattingMessage: 'AI 抠图完成！发丝细节已保留，背景已彻底透明化',
      }));

      onNotification?.('✨ AI 智能抠图成功！已完成人像提取与背景透明化');
    } catch (err: any) {
      console.error('AI Matting failed, falling back:', err);
      // Fallback: use original image as transparentImgRef so user can still crop/frame
      const fallbackImg = new Image();
      fallbackImg.src = originalUrl;
      await new Promise<void>((resolve) => {
        fallbackImg.onload = () => resolve();
      });
      transparentImgRef.current = fallbackImg;

      setPortraitState((prev) => ({
        ...prev,
        isMatting: false,
        mattingProgress: 100,
        mattingMessage: '已载入原始图像（可在上方精细修图画板进行手动抠图）',
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
    onNotification?.(`已载入「${demo.name}」，AI 正在自动化抠图与换底...`);
  };

  // -------------------------------------------------------------
  // Canvas Rendering Pipeline (Renders final ID photo)
  // -------------------------------------------------------------
  const renderIdPhotoToCanvas = useCallback(
    async (targetCanvas: HTMLCanvasElement, width: number, height: number, withGuides: boolean) => {
      const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      targetCanvas.width = width;
      targetCanvas.height = height;

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

      // 2. Draw Subject Portrait (if loaded)
      const subjectImg = transparentImgRef.current;
      if (subjectImg) {
        ctx.save();

        // Apply framing transforms around canvas center
        const centerX = width / 2 + panX;
        const centerY = height / 2 + panY;
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
        const imgAspect = subjectImg.naturalWidth / subjectImg.naturalHeight;
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

        ctx.drawImage(subjectImg, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      // 3. Draw Suit Attire Overlay (if selected)
      if (selectedSuitId !== 'none') {
        const suitImg = await getSuitImage(selectedSuitId);
        if (suitImg) {
          drawSuitOverlay(ctx, suitImg, width, height, suitScale, suitOffsetY);
        }
      }

      // 4. Draw Standard Guidelines (if enabled for on-screen preview)
      if (withGuides) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.65)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

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
        ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('头顶基准线', 8, topHeadY - 4);
        ctx.fillText('双眼水平线', 8, eyesY - 4);
        ctx.fillText('下巴基准线', 8, chinY - 4);

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
      selectedSuitId,
      suitScale,
      suitOffsetY,
    ]
  );

  // Re-render preview canvas whenever settings change
  useEffect(() => {
    if (previewCanvasRef.current) {
      renderIdPhotoToCanvas(
        previewCanvasRef.current,
        targetWidthPx,
        targetHeightPx,
        showGuidelines
      );
    }
  }, [renderIdPhotoToCanvas, targetWidthPx, targetHeightPx, showGuidelines, portraitState.transparentUrl]);

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
  const handleDownloadSinglePhoto = async () => {
    // Generate clean canvas without guidelines
    const offscreen = document.createElement('canvas');
    await renderIdPhotoToCanvas(offscreen, targetWidthPx, targetHeightPx, false);

    const isTransparent = currentColor.type === 'transparent';
    const effectiveFormat = isTransparent ? 'png' : exportFormat;

    const res = await exportPhotoUnderSizeLimit(
      offscreen,
      effectiveFormat,
      fileSizeLimitKb
    );

    const a = document.createElement('a');
    a.href = res.url;
    const sizeNote = fileSizeLimitKb > 0 ? `_${Math.round(res.size / 1024)}KB` : '';
    a.download = `证件照_${currentSpec.name}_${currentColor.name}${sizeNote}.${effectiveFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(res.url);

    onNotification?.(
      `🎉 已成功导出「${currentSpec.name}」(${Math.round(res.size / 1024)} KB)！`
    );
  };

  // Batch Export Full Set ZIP (1-inch, 2-inch, Red, Blue, White, Transparent)
  const handleExportFullSetZip = async () => {
    if (isExportingZip) return;
    setIsExportingZip(true);
    onNotification?.('正在打包生成全套常用尺寸与红白蓝底色证件照...');

    try {
      const zip = new JSZip();
      const exportPresets = [
        { key: '1-inch', name: '1寸标准照 (295x413)', w: 295, h: 413 },
        { key: '2-inch', name: '2寸标准照 (413x579)', w: 413, h: 579 },
        { key: 'small-2-inch', name: '小2寸护照 (413x531)', w: 413, h: 531 },
      ];

      const exportColors = [
        { name: '蓝底', type: 'color', hex: '#0066FF' },
        { name: '红底', type: 'color', hex: '#C8102E' },
        { name: '白底', type: 'color', hex: '#FFFFFF' },
        { name: '透明底', type: 'transparent', hex: 'transparent' },
      ];

      const offscreen = document.createElement('canvas');

      for (const preset of exportPresets) {
        const folder = zip.folder(preset.name);
        for (const col of exportColors) {
          offscreen.width = preset.w;
          offscreen.height = preset.h;
          const ctx = offscreen.getContext('2d')!;

          if (col.type === 'transparent') {
            ctx.clearRect(0, 0, preset.w, preset.h);
          } else {
            drawIdBackground(ctx, preset.w, preset.h, col.type, col.hex, 'solid');
          }

          if (transparentImgRef.current) {
            ctx.save();
            const centerX = preset.w / 2 + panX;
            const centerY = preset.h / 2 + panY;
            ctx.translate(centerX, centerY);
            if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
            if (flipX) ctx.scale(-1, 1);

            const img = transparentImgRef.current;
            const imgAspect = img.naturalWidth / img.naturalHeight;
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
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          }

          if (selectedSuitId !== 'none') {
            const suitImg = await getSuitImage(selectedSuitId);
            if (suitImg) {
              drawSuitOverlay(ctx, suitImg, preset.w, preset.h, suitScale, suitOffsetY);
            }
          }

          const isTrans = col.type === 'transparent';
          const format = isTrans ? 'image/png' : 'image/jpeg';
          const ext = isTrans ? 'png' : 'jpg';

          const blob = await new Promise<Blob>((resolve) =>
            offscreen.toBlob((b) => resolve(b!), format, 0.95)
          );
          folder?.file(`${preset.name}_${col.name}.${ext}`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `证件照全套合集_1寸_2寸_红蓝白透明_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      onNotification?.('🎉 全套证件照合集 ZIP 打包下载成功！包含1寸/2寸/红白蓝全底色');
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-300" />
              AI 智能人像抠图 • 300 DPI 照相馆冲印标准
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              国家通用国家标准
            </span>
          </div>
          <h2 className="text-lg font-bold">证件照一键智能生成与换底套件</h2>
          <p className="text-xs text-blue-200/80 leading-relaxed">
            支持 1寸 / 2寸 / 护照签证 / 考研公考规格自动裁切；AI 自动精细抠发丝，一键切换透明底、红底、蓝底、白底及自选调色；提供 6寸相纸照相馆排版冲印。
          </p>
        </div>

        {/* Quick Demo Portrait Loaders */}
        <div className="shrink-0 flex items-center gap-2 bg-white/10 p-2 rounded-xl border border-white/10 backdrop-blur-xs">
          <span className="text-[11px] text-blue-200 font-medium pl-1">快速测试：</span>
          {DEMO_PORTRAITS.map((demo) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => handleSelectDemoPortrait(demo)}
              disabled={portraitState.isMatting}
              className="px-2.5 py-1 text-xs font-bold bg-white/15 hover:bg-white/25 rounded-lg border border-white/20 transition-all text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{demo.gender === 'male' ? '👨 男士示范' : '👩 女士示范'}</span>
            </button>
          ))}
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
                        当前文件: {portraitState.file.name} (点击可更换)
                      </span>
                    ) : (
                      '点击或拖拽上传人像正面照片（支持 JPG/PNG/WEBP）'
                    )}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    光线均匀、面部无遮挡、正面免冠拍摄效果最佳
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
                    <span>{portraitState.mattingMessage || 'AI 正在自动抠图中...'}</span>
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

          {/* Section 4: Framing, Position, Suit Attire & Beauty Controls */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="text-sm font-bold text-stone-900">人像微调、正装换装与美化</h3>
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

        {/* Right Column: Live High-Definition Canvas Preview & Export (Width: 5 / 12) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  实时预览 • {currentSpec.name}
                </h3>
                <p className="text-[11px] text-stone-500 font-mono">
                  {targetWidthPx} × {targetHeightPx} px @ 300 DPI
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

              {/* Drag instruction overlay badge */}
              <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/60 text-white/90 backdrop-blur-xs">
                  按住鼠标左键可拖拽平移 • 滚轮可缩放人像
                </span>
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
                  ? `💡 系统将采用二分法质量优化，严格保证文件不超过 ${fileSizeLimitKb}KB，满足公考/考研/报名系统验证！`
                  : '💡 适合洗印与高清冲印，保留最高细节'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleDownloadSinglePhoto}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
              >
                <Download className="w-4 h-4" />
                <span>下载当前证件照 ({currentSpec.name} • {currentColor.name})</span>
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
                  className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isExportingZip ? '打包中...' : '全套合集 ZIP 打包'}</span>
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
                  <span>发送至修图画板（擦除碎发/瑕疵去水印）</span>
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
          onNotification?.('📷 摄像头抓拍成功，AI 正在自动化抠图与换底...');
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
