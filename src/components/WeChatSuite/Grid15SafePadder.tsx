/**
 * 15-Grid (5x3) 16:9 Safe Padder Component
 * Solves the critical pain point where AI Video Models (Kling, Runway, Hailuo, Jimeng, Luma, Sora, etc.)
 * crop the top row (5 stickers) and bottom row (5 stickers) due to 16:9 aspect ratio mismatch.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Download,
  Copy,
  Check,
  Sparkles,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  Layers,
  ArrowRight,
  Maximize2,
  Grid,
  Palette,
  Film,
  Info,
  ChevronDown,
  ChevronUp,
  Scissors,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { generateDemo15GridFile, sampleImageEdgeColor } from '../../utils/demoGrid15';

interface Grid15SafePadderProps {
  onSendToStaticSlicer?: (file: File) => void;
  onSendToRetouch?: (file: File) => void;
  onSendToBatch?: (file: File) => void;
  showToast: (message: string) => void;
  externalImageFile?: File | null;
}

export type FillMode = 'auto_edge' | 'solid_color' | 'blur_image' | 'transparent';
export type ResolutionPreset = '1080p' | '1440p' | '2160p' | 'auto_width';
export type ViewMode = 'safe_padded' | 'simulate_crop' | 'side_by_side';

export function Grid15SafePadder({
  onSendToStaticSlicer,
  onSendToRetouch,
  onSendToBatch,
  showToast,
  externalImageFile,
}: Grid15SafePadderProps) {
  // Input image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);
  const [sampledEdgeColor, setSampledEdgeColor] = useState<string>('#FFFFFF');

  // Padding configuration
  const [verticalPaddingPercent, setVerticalPaddingPercent] = useState<number>(15); // Top & bottom 15%
  const [horizontalPaddingPercent, setHorizontalPaddingPercent] = useState<number>(6); // Left & right 6%
  const [isPaddingLocked, setIsPaddingLocked] = useState<boolean>(true); // Lock top and bottom together
  const [topPaddingPercent, setTopPaddingPercent] = useState<number>(15);
  const [bottomPaddingPercent, setBottomPaddingPercent] = useState<number>(15);
  const [verticalOffsetPercent, setVerticalOffsetPercent] = useState<number>(0); // -20% to +20% fine-tuning

  // Fill mode configuration
  const [fillMode, setFillMode] = useState<FillMode>('auto_edge');
  const [customSolidColor, setCustomSolidColor] = useState<string>('#FFFFFF');
  const [blurStrength, setBlurStrength] = useState<number>(24);

  // Overlay & Preview options
  const [viewMode, setViewMode] = useState<ViewMode>('safe_padded');
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [showSafeZoneGuide, setShowSafeZoneGuide] = useState<boolean>(true);
  const [showCellNumbers, setShowCellNumbers] = useState<boolean>(true);

  // Export resolution
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>('1080p');
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');

  // Processing & Copy state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [showPromptGuide, setShowPromptGuide] = useState<boolean>(false);

  // Canvas refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync external file if provided
  useEffect(() => {
    if (externalImageFile && !imageFile) {
      loadImageFromFile(externalImageFile);
    }
  }, [externalImageFile]);

  // Handle file loading
  const loadImageFromFile = useCallback((file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      setNaturalWidth(img.naturalWidth || img.width);
      setNaturalHeight(img.naturalHeight || img.height);

      // Sample edge color automatically
      const edge = sampleImageEdgeColor(img);
      setSampledEdgeColor(edge.hex);
      if (fillMode === 'auto_edge') {
        setCustomSolidColor(edge.hex);
      }
    };
    img.src = url;
  }, [fillMode]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // Load demo 15-grid
  const handleLoadDemo = async () => {
    try {
      const demoFile = await generateDemo15GridFile();
      loadImageFromFile(demoFile);
      showToast('已成功载入 5×3 样例15宫格图片，随时可调整留白参数');
    } catch (err) {
      console.error('Failed to generate demo 15 grid:', err);
      showToast('载入示例图失败，请手动上传图片');
    }
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        loadImageFromFile(file);
      }
    }
  };

  // Handle Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            loadImageFromFile(file);
            showToast('已从剪贴板粘贴图片');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImageFromFile, showToast]);

  // Keep top & bottom synced when locked
  const handleVerticalPaddingChange = (val: number) => {
    setVerticalPaddingPercent(val);
    setTopPaddingPercent(val);
    setBottomPaddingPercent(val);
  };

  const handleTopPaddingChange = (val: number) => {
    setTopPaddingPercent(val);
    if (isPaddingLocked) {
      setBottomPaddingPercent(val);
      setVerticalPaddingPercent(val);
    }
  };

  const handleBottomPaddingChange = (val: number) => {
    setBottomPaddingPercent(val);
    if (isPaddingLocked) {
      setTopPaddingPercent(val);
      setVerticalPaddingPercent(val);
    }
  };

  // Determine export dimension
  const getTargetDimensions = useCallback((): { width: number; height: number } => {
    switch (resolutionPreset) {
      case '1080p':
        return { width: 1920, height: 1080 };
      case '1440p':
        return { width: 2560, height: 1440 };
      case '2160p':
        return { width: 3840, height: 2160 };
      case 'auto_width':
      default: {
        const baseWidth = Math.max(naturalWidth || 1920, 1280);
        const calculatedHeight = Math.round(baseWidth * (9 / 16));
        return { width: baseWidth, height: calculatedHeight };
      }
    }
  }, [resolutionPreset, naturalWidth]);

  // Render the canvas
  const renderCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img || !naturalWidth || !naturalHeight) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: targetW, height: targetH } = getTargetDimensions();
    canvas.width = targetW;
    canvas.height = targetH;

    // Clear canvas
    ctx.clearRect(0, 0, targetW, targetH);

    if (viewMode === 'simulate_crop') {
      // ⚠️ Simulate Direct AI Video Crop (Show the pain point!)
      // When a 5:3 or tight image is fed to 16:9 AI video model without letterbox padding,
      // it scales the image to fill the 16:9 frame horizontally (width = targetW),
      // meaning height overflows!
      const scaleToFitWidth = targetW / naturalWidth;
      const drawnH = naturalHeight * scaleToFitWidth;
      const drawnW = targetW;
      const offsetY = (targetH - drawnH) / 2; // will be negative, meaning top and bottom clipped!

      // Draw original image scaled to fill
      ctx.drawImage(img, 0, offsetY, drawnW, drawnH);

      // Highlight the clipped zones
      if (offsetY < 0) {
        const clippedHeight = Math.abs(offsetY);

        // Top clipped zone (Red alert band)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
        ctx.fillRect(0, 0, targetW, clippedHeight);
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, clippedHeight);
        ctx.lineTo(targetW, clippedHeight);
        ctx.stroke();

        // Top alert banner
        ctx.save();
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(targetW / 2 - 260, 16, 520, 48);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❌ 危险：顶部第 1 行（前 5 张表情）被严重截断！', targetW / 2, 40);
        ctx.restore();

        // Bottom clipped zone (Red alert band)
        const bottomClippedY = targetH - clippedHeight;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
        ctx.fillRect(0, bottomClippedY, targetW, clippedHeight);
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, bottomClippedY);
        ctx.lineTo(targetW, bottomClippedY);
        ctx.stroke();

        // Bottom alert banner
        ctx.save();
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(targetW / 2 - 260, targetH - 64, 520, 48);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❌ 危险：底部第 3 行（后 5 张表情）被严重截断！', targetW / 2, targetH - 40);
        ctx.restore();
      }

      // 5x3 Grid overlay on simulated crop
      if (showGridOverlay) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        const cols = 5;
        const rows = 3;
        const cellW = drawnW / cols;
        const cellH = drawnH / rows;
        for (let c = 1; c < cols; c++) {
          ctx.beginPath();
          ctx.moveTo(c * cellW, offsetY);
          ctx.lineTo(c * cellW, offsetY + drawnH);
          ctx.stroke();
        }
        for (let r = 1; r < rows; r++) {
          ctx.beginPath();
          ctx.moveTo(0, offsetY + r * cellH);
          ctx.lineTo(drawnW, offsetY + r * cellH);
          ctx.stroke();
        }
        ctx.restore();
      }
      return;
    }

    // Normal Safe Padded 16:9 Canvas Rendering
    // 1. Fill background based on fillMode
    if (fillMode === 'transparent') {
      // Keep canvas transparent (alpha channel retained)
    } else if (fillMode === 'blur_image') {
      // Gaussian Blur Background Letterbox
      ctx.save();
      // Draw zoomed original image
      const bgScale = Math.max(targetW / naturalWidth, targetH / naturalHeight) * 1.15;
      const bgW = naturalWidth * bgScale;
      const bgH = naturalHeight * bgScale;
      const bgX = (targetW - bgW) / 2;
      const bgY = (targetH - bgH) / 2;
      ctx.filter = `blur(${blurStrength}px) brightness(0.9)`;
      ctx.drawImage(img, bgX, bgY, bgW, bgH);
      ctx.restore();

      // Subtle dark wash over blur for contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, targetW, targetH);
    } else {
      // Solid Color or Auto Edge Color
      const bgColor = fillMode === 'auto_edge' ? sampledEdgeColor : customSolidColor;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // 2. Calculate safe placement of the 15-grid image
    // Effective available box after horizontal and vertical padding
    const padTop = (topPaddingPercent / 100) * targetH;
    const padBottom = (bottomPaddingPercent / 100) * targetH;
    const padHoriz = (horizontalPaddingPercent / 100) * targetW;

    const availableW = targetW - padHoriz * 2;
    const availableH = targetH - (padTop + padBottom);

    // Calculate scale to fit inside the safe box while preserving aspect ratio
    const scaleFactor = Math.min(availableW / naturalWidth, availableH / naturalHeight);
    const destW = naturalWidth * scaleFactor;
    const destH = naturalHeight * scaleFactor;

    // Centered horizontally, vertically placed according to top & bottom padding + vertical offset
    const destX = padHoriz + (availableW - destW) / 2;
    const verticalOffsetPx = (verticalOffsetPercent / 100) * targetH;
    const destY = padTop + (availableH - destH) / 2 + verticalOffsetPx;

    // Optional soft drop-shadow if blur background
    if (fillMode === 'blur_image') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(img, destX, destY, destW, destH);
      ctx.restore();
    } else {
      ctx.drawImage(img, destX, destY, destW, destH);
    }

    // 3. Draw 5x3 Grid Lines & Labels if enabled
    if (showGridOverlay) {
      ctx.save();
      const cols = 5;
      const rows = 3;
      const cellW = destW / cols;
      const cellH = destH / rows;

      // Draw grid bounding box
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.strokeRect(destX, destY, destW, destH);

      // Draw inner grid dashed lines
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);

      for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(destX + c * cellW, destY);
        ctx.lineTo(destX + c * cellW, destY + destH);
        ctx.stroke();
      }

      for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(destX, destY + r * cellH);
        ctx.lineTo(destX + destW, destY + r * cellH);
        ctx.stroke();
      }

      // Draw Cell sequence badges if enabled
      if (showCellNumbers) {
        ctx.setLineDash([]);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cellIndex = r * cols + c + 1;
            const cx = destX + c * cellW + 12;
            const cy = destY + r * cellH + 12;

            // Pill tag
            ctx.fillStyle = r === 0 || r === 2 ? '#047857' : '#065F46';
            ctx.beginPath();
            ctx.roundRect(cx, cy, 32, 20, 6);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${cellIndex}`, cx + 16, cy + 10);
          }
        }
      }
      ctx.restore();
    }

    // 4. Draw Safe Zone Guide Lines (90% Action Safe & 80% Title Safe)
    if (showSafeZoneGuide) {
      ctx.save();
      // 90% Safe Area (Standard Video Action Safe)
      const safe90W = targetW * 0.9;
      const safe90H = targetH * 0.9;
      const safe90X = (targetW - safe90W) / 2;
      const safe90Y = (targetH - safe90H) / 2;

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(safe90X, safe90Y, safe90W, safe90H);

      // Safe zone corner tag
      ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
      ctx.fillRect(safe90X + 8, safe90Y + 8, 140, 22);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️ 16:9 影视级安全区', safe90X + 16, safe90Y + 19);

      ctx.restore();
    }
  }, [
    getTargetDimensions,
    viewMode,
    naturalWidth,
    naturalHeight,
    fillMode,
    sampledEdgeColor,
    customSolidColor,
    blurStrength,
    topPaddingPercent,
    bottomPaddingPercent,
    horizontalPaddingPercent,
    verticalOffsetPercent,
    showGridOverlay,
    showSafeZoneGuide,
    showCellNumbers,
  ]);

  // Re-render canvas when controls change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Export to Blob
  const exportToBlob = useCallback(async (): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const img = loadedImageRef.current;
    if (!img) throw new Error('No image loaded');

    const { width: targetW, height: targetH } = getTargetDimensions();
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;

    // 1. Fill background
    if (fillMode === 'transparent') {
      // leave transparent
    } else if (fillMode === 'blur_image') {
      ctx.save();
      const bgScale = Math.max(targetW / naturalWidth, targetH / naturalHeight) * 1.15;
      const bgW = naturalWidth * bgScale;
      const bgH = naturalHeight * bgScale;
      const bgX = (targetW - bgW) / 2;
      const bgY = (targetH - bgH) / 2;
      ctx.filter = `blur(${blurStrength}px) brightness(0.9)`;
      ctx.drawImage(img, bgX, bgY, bgW, bgH);
      ctx.restore();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, targetW, targetH);
    } else {
      const bgColor = fillMode === 'auto_edge' ? sampledEdgeColor : customSolidColor;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // 2. Draw 15-grid safely
    const padTop = (topPaddingPercent / 100) * targetH;
    const padBottom = (bottomPaddingPercent / 100) * targetH;
    const padHoriz = (horizontalPaddingPercent / 100) * targetW;
    const availableW = targetW - padHoriz * 2;
    const availableH = targetH - (padTop + padBottom);

    const scaleFactor = Math.min(availableW / naturalWidth, availableH / naturalHeight);
    const destW = naturalWidth * scaleFactor;
    const destH = naturalHeight * scaleFactor;
    const destX = padHoriz + (availableW - destW) / 2;
    const verticalOffsetPx = (verticalOffsetPercent / 100) * targetH;
    const destY = padTop + (availableH - destH) / 2 + verticalOffsetPx;

    if (fillMode === 'blur_image') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(img, destX, destY, destW, destH);
      ctx.restore();
    } else {
      ctx.drawImage(img, destX, destY, destW, destH);
    }

    const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = exportFormat === 'jpg' ? 0.95 : 1.0;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Export canvas to blob failed'));
        },
        mime,
        quality
      );
    });
  }, [
    getTargetDimensions,
    fillMode,
    sampledEdgeColor,
    customSolidColor,
    blurStrength,
    naturalWidth,
    naturalHeight,
    topPaddingPercent,
    bottomPaddingPercent,
    horizontalPaddingPercent,
    verticalOffsetPercent,
    exportFormat,
  ]);

  // Handle Download
  const handleDownload = async () => {
    if (!imageFile) return;
    try {
      setIsExporting(true);
      const blob = await exportToBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = imageFile.name.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}_16x9_AI安全图.${exportFormat}`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('🎉 16:9 安全防截断图已成功导出！');
    } catch (err) {
      console.error('Download error:', err);
      showToast('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopyToClipboard = async () => {
    if (!imageFile) return;
    try {
      setIsExporting(true);
      const blob = await exportToBlob();
      // Most browser clipboard APIs only support image/png
      if (navigator.clipboard && navigator.clipboard.write) {
        let pngBlob = blob;
        if (blob.type !== 'image/png') {
          // convert to png for clipboard
          const canvas = previewCanvasRef.current;
          if (canvas) {
            pngBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          }
        }
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': pngBlob,
          }),
        ]);
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
        showToast('已复制 16:9 安全图至剪贴板，可直接在 AI 视频工具中 Ctrl+V 粘贴！');
      } else {
        showToast('浏览器不支持直接复制图片到剪贴板，请点击下载保存');
      }
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      showToast('复制到剪贴板失败，请使用一键下载保存');
    } finally {
      setIsExporting(false);
    }
  };

  // Convert current exported canvas to File object for workflow transitions
  const createExportedFile = async (): Promise<File> => {
    const blob = await exportToBlob();
    const baseName = imageFile?.name ? imageFile.name.replace(/\.[^/.]+$/, '') : 'grid15_safe';
    return new File([blob], `${baseName}_16x9_safe.png`, { type: 'image/png' });
  };

  // Workflow Handlers
  const handleTransitionToStaticSlicer = async () => {
    if (!onSendToStaticSlicer) return;
    try {
      const file = await createExportedFile();
      onSendToStaticSlicer(file);
    } catch (err) {
      console.error('Transition failed:', err);
      showToast('流转失败，请重试');
    }
  };

  const handleTransitionToRetouch = async () => {
    if (!onSendToRetouch) return;
    try {
      const file = await createExportedFile();
      onSendToRetouch(file);
    } catch (err) {
      console.error('Transition failed:', err);
      showToast('流转失败，请重试');
    }
  };

  const handleTransitionToBatch = async () => {
    if (!onSendToBatch) return;
    try {
      const file = await createExportedFile();
      onSendToBatch(file);
    } catch (err) {
      console.error('Transition failed:', err);
      showToast('流转失败，请重试');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner: Direct Value Proposition */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                AI 视频防截断神器
              </span>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <span>15宫格 16:9 安全图扩展与留白适配</span>
                <span className="text-xs font-normal text-stone-500">（5列 × 3行）</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              <strong>根治痛点：</strong>可灵、Runway、海螺、即梦等 AI 视频模型强制按 <span className="text-amber-700 font-bold">16:9</span> 画幅生视频。5×3 宫格比 16:9 更高，直接上传会导致<span className="text-red-600 font-bold underline decoration-red-400">顶部 5 张或底部 5 张表情被残酷截断</span>。在这里一键给 15 宫格上下精准添加安全留白，彻底解决截断难题！
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl border border-stone-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>载入 5×3 示例测试</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPromptGuide((v) => !v)}
              className="px-3 py-2 bg-amber-100/70 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-300/80 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Film className="w-3.5 h-3.5 text-amber-700" />
              <span>AI视频提示词小贴士</span>
              {showPromptGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible AI Video Prompt Guide */}
        {showPromptGuide && (
          <div className="mt-4 pt-4 border-t border-amber-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in duration-150">
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>可灵 Kling 推荐设置</span>
              </div>
              <p className="text-stone-600 leading-normal">
                画面比例选 <strong>16:9</strong>，运镜模式选「<strong>水平固定/无运镜</strong>」，运动幅度推荐设为 <strong>2 ~ 3</strong>。提示词加上：<code className="text-amber-800 bg-amber-50 px-1 rounded">15 stickers animation, static camera, cute micro motions</code>。
              </p>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Runway Gen-3 设置</span>
              </div>
              <p className="text-stone-600 leading-normal">
                在 Camera Control 中将 Zoom 与 Pan 均设为 <strong>0</strong>，Lock Camera，避免镜头向前推导致四周边缘表情穿帮。使用本工具导出的 16:9 图直接作为 First Frame。
              </p>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>海螺 / 即梦 / Luma 提示</span>
              </div>
              <p className="text-stone-600 leading-normal">
                垫图时选择 16:9 画幅，提示词强调「<strong>保持网格排布固定，每个独立格子中的人物做可爱微表情循环</strong>」，上下保留的留白能完美抵御模型自发性的镜头抖动。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Workspace Body: Left (Image Canvas / Preview) & Right (Controls Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Canvas Preview & Modes (7 / 12 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Preview Header & View Mode Switcher */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('safe_padded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'safe_padded'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>16:9 安全导出预览</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('simulate_crop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'simulate_crop'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="直观展示：如果直接上传 5x3 进 16:9 AI 视频，上下将会如何惨遭截断"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>截断痛点对比模拟</span>
                <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-mono">
                  直击痛点
                </span>
              </button>
            </div>

            {/* Overlay toggle checkboxes */}
            {viewMode === 'safe_padded' && (
              <div className="flex items-center gap-3 text-xs text-stone-600">
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showGridOverlay}
                    onChange={(e) => setShowGridOverlay(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>5×3 宫格辅助线</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSafeZoneGuide}
                    onChange={(e) => setShowSafeZoneGuide(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>安全框</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCellNumbers}
                    onChange={(e) => setShowCellNumbers(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>序号</span>
                </label>
              </div>
            )}
          </div>

          {/* Interactive Canvas Viewport (Fixed 16:9 Aspect Ratio Container) */}
          <div
            className={`relative w-full aspect-video rounded-2xl overflow-hidden border-2 shadow-sm transition-all flex items-center justify-center bg-stone-900 ${
              !imageFile ? 'border-dashed border-stone-300 bg-stone-50' : 'border-stone-800'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {/* If no image loaded: Show upload dropzone */}
            {!imageFile ? (
              <div className="p-8 text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    上传 15 宫格图片（5 列 × 3 行）
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    点击上传、拖拽图片至此处，或在键盘直接按下 <kbd className="px-1.5 py-0.5 rounded bg-stone-200 font-mono text-[11px]">Ctrl + V</kbd> 粘贴
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    选择本地图片
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold rounded-xl border border-stone-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    载入 15 宫格测试样例
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      loadImageFromFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            ) : (
              /* Canvas element with 16:9 preview */
              <div className="relative w-full h-full flex items-center justify-center">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-full object-contain shadow-md"
                />

                {/* 16:9 Indicator Pill */}
                <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-md text-white text-[11px] font-mono px-2.5 py-1 rounded-lg border border-stone-700/80 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>16:9 视频标准画幅</span>
                  <span className="text-stone-400">({naturalWidth}×{naturalHeight} 原图)</span>
                </div>

                {/* Status notice when simulating direct crop */}
                {viewMode === 'simulate_crop' && (
                  <div className="absolute bottom-3 left-3 right-3 bg-red-950/90 backdrop-blur-md text-red-200 text-xs px-3 py-2 rounded-xl border border-red-700/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>未添加留白时，AI 视频模型会强行裁切上下红框区域，导致前 5 张和后 5 张表情损毁！</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewMode('safe_padded')}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer whitespace-nowrap ml-2"
                    >
                      切换到安全保护图
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Info & Re-upload Bar */}
          {imageFile && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-stone-600">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="w-4 h-4 text-stone-500 shrink-0" />
                <span className="truncate font-medium">{imageFile.name}</span>
                <span className="text-stone-400 font-mono">
                  ({naturalWidth}×{naturalHeight}px)
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 font-bold rounded-lg border border-stone-300 transition-colors cursor-pointer"
                >
                  更换图片
                </button>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 font-bold rounded-lg border border-stone-300 transition-colors cursor-pointer"
                >
                  重载样例
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Parameters & Controls Panel (5 / 12 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600" />
                <span>防截断留白与排版控制</span>
              </h3>
              <span className="text-xs text-stone-500">16:9 画幅适配</span>
            </div>

            {/* 1. Quick Padding Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                <span>⚡ 常用防截断推荐预设</span>
                <span className="text-[11px] font-normal text-stone-500">上下留白比例</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleVerticalPaddingChange(15)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    verticalPaddingPercent === 15 && isPaddingLocked
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="text-amber-700 font-extrabold">+15%</div>
                  <div className="text-[10px] text-stone-500 font-normal">推荐安全防截断</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerticalPaddingChange(22)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    verticalPaddingPercent === 22 && isPaddingLocked
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="text-amber-700 font-extrabold">+22%</div>
                  <div className="text-[10px] text-stone-500 font-normal">超强防镜头抖动</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerticalPaddingChange(6.5)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    verticalPaddingPercent === 6.5 && isPaddingLocked
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="text-amber-700 font-extrabold">+6.5%</div>
                  <div className="text-[10px] text-stone-500 font-normal">极限紧凑补齐差值</div>
                </button>
              </div>
            </div>

            {/* 2. Vertical Padding Controls (Top & Bottom) */}
            <div className="space-y-3 pt-1 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <span>上下留白高度</span>
                  <span className="text-[11px] font-mono text-amber-700 font-bold">
                    ({isPaddingLocked ? `上下各 +${topPaddingPercent}%` : `顶 +${topPaddingPercent}% / 底 +${bottomPaddingPercent}%`})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPaddingLocked((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                    isPaddingLocked ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'
                  }`}
                  title={isPaddingLocked ? '上下留白已联动锁定' : '上下留白可单独微调'}
                >
                  {isPaddingLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{isPaddingLocked ? '上下对称' : '单独调节'}</span>
                </button>
              </div>

              {isPaddingLocked ? (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    step="0.5"
                    value={verticalPaddingPercent}
                    onChange={(e) => handleVerticalPaddingChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-0.5">
                    <span>0% (无留白易截断)</span>
                    <span>15% (黄金平衡)</span>
                    <span>35% (超大安全区)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-stone-600 mb-1">
                      <span>顶部留白 (防第1行截断)</span>
                      <span className="font-mono font-bold text-amber-700">{topPaddingPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      step="0.5"
                      value={topPaddingPercent}
                      onChange={(e) => handleTopPaddingChange(parseFloat(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-stone-600 mb-1">
                      <span>底部留白 (防第3行截断)</span>
                      <span className="font-mono font-bold text-amber-700">{bottomPaddingPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      step="0.5"
                      value={bottomPaddingPercent}
                      onChange={(e) => handleBottomPaddingChange(parseFloat(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Horizontal Padding & Vertical Offset */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-stone-600 mb-1">
                    <span>左右安全边距</span>
                    <span className="font-mono font-bold text-stone-700">{horizontalPaddingPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={horizontalPaddingPercent}
                    onChange={(e) => setHorizontalPaddingPercent(parseFloat(e.target.value))}
                    className="w-full accent-stone-700 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-stone-600 mb-1">
                    <span>上下微调偏移</span>
                    <span className="font-mono font-bold text-stone-700">
                      {verticalOffsetPercent > 0 ? `+${verticalOffsetPercent}%` : `${verticalOffsetPercent}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={verticalOffsetPercent}
                    onChange={(e) => setVerticalOffsetPercent(parseFloat(e.target.value))}
                    className="w-full accent-stone-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 3. Background Fill Mode */}
            <div className="space-y-3 pt-3 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span>🎨 留白区域填充模式</span>
                <span className="text-[11px] font-normal text-stone-500">保持自然融合</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFillMode('auto_edge')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                    fillMode === 'auto_edge'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-stone-300 shadow-xs shrink-0"
                    style={{ backgroundColor: sampledEdgeColor }}
                  />
                  <div className="truncate">
                    <div className="truncate">智能提取原图底色</div>
                    <div className="text-[10px] text-stone-500 font-mono truncate">{sampledEdgeColor}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFillMode('blur_image')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                    fillMode === 'blur_image'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <div>高斯模糊虚化铺底</div>
                    <div className="text-[10px] text-stone-500 font-normal">短视频与电影感</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFillMode('solid_color')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                    fillMode === 'solid_color'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <Palette className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div>纯色自定义背景</div>
                    <div className="text-[10px] text-stone-500 font-normal">支持白/黑/绿幕</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFillMode('transparent')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                    fillMode === 'transparent'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <Grid className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div>透明背景 (PNG)</div>
                    <div className="text-[10px] text-stone-500 font-normal">保留透明通道</div>
                  </div>
                </button>
              </div>

              {/* Solid Color Picker Sub-options */}
              {fillMode === 'solid_color' && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-600 font-medium">快捷色板:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '纯白', color: '#FFFFFF' },
                        { label: '浅灰', color: '#F3F4F6' },
                        { label: '纯黑', color: '#000000' },
                        { label: '绿幕', color: '#00FF00' },
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => setCustomSolidColor(item.color)}
                          className="w-5 h-5 rounded-md border border-stone-300 shadow-2xs transition-transform hover:scale-110 cursor-pointer"
                          style={{ backgroundColor: item.color }}
                          title={item.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customSolidColor}
                      onChange={(e) => setCustomSolidColor(e.target.value)}
                      className="w-8 h-8 rounded border border-stone-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customSolidColor}
                      onChange={(e) => setCustomSolidColor(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs font-mono bg-white border border-stone-300 rounded-lg uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Blur Strength Slider */}
              {fillMode === 'blur_image' && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>虚化模糊半径</span>
                    <span className="font-mono">{blurStrength}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="60"
                    value={blurStrength}
                    onChange={(e) => setBlurStrength(parseInt(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* 4. Output Resolution & Format */}
            <div className="space-y-2 pt-3 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span>📐 16:9 导出分辨率与格式</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[
                  { id: '1080p', label: '1080P', sub: '1920×1080' },
                  { id: '1440p', label: '2K QHD', sub: '2560×1440' },
                  { id: '2160p', label: '4K UHD', sub: '3840×2160' },
                  { id: 'auto_width', label: '源图自适应', sub: '宽保真换算' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setResolutionPreset(item.id as ResolutionPreset)}
                    className={`py-1.5 px-1 rounded-lg text-center border font-bold transition-all cursor-pointer ${
                      resolutionPreset === item.id
                        ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                        : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div>{item.label}</div>
                    <div className="text-[9px] opacity-75 font-mono">{item.sub}</div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 text-xs text-stone-600">
                <span className="text-[11px]">导出格式:</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="export_format"
                      checked={exportFormat === 'png'}
                      onChange={() => setExportFormat('png')}
                      className="text-stone-900 focus:ring-stone-900"
                    />
                    <span>PNG (无损推荐)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="export_format"
                      checked={exportFormat === 'jpg'}
                      onChange={() => setExportFormat('jpg')}
                      className="text-stone-900 focus:ring-stone-900"
                    />
                    <span>JPG (轻量)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 5. Main Action Buttons */}
            <div className="space-y-2 pt-3 border-t border-stone-100">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!imageFile || isExporting}
                  onClick={handleDownload}
                  className="py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>导出 16:9 安全图</span>
                </button>

                <button
                  type="button"
                  disabled={!imageFile || isExporting}
                  onClick={handleCopyToClipboard}
                  className="py-3 px-4 bg-white hover:bg-stone-50 border border-stone-300 disabled:opacity-50 text-stone-800 font-bold rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  title="可直接 Ctrl+V 粘贴进可灵或 Runway 的提示词图片输入框"
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">已复制到剪贴板</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-stone-600" />
                      <span>复制到剪贴板</span>
                    </>
                  )}
                </button>
              </div>

              {/* 6. Seamless Workflow Integration */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  🚀 套件工作流快捷流转:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!imageFile}
                    onClick={handleTransitionToStaticSlicer}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-[#07c160] disabled:opacity-50 text-xs font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer text-center"
                    title="将本图送往静态表情切片套件，直接切出15个微信表情"
                  >
                    <span>送往静态切片</span>
                  </button>

                  <button
                    type="button"
                    disabled={!imageFile}
                    onClick={handleTransitionToRetouch}
                    className="p-2 bg-pink-50 hover:bg-pink-100 text-pink-700 disabled:opacity-50 text-xs font-bold rounded-xl border border-pink-200 transition-colors cursor-pointer text-center"
                    title="将本图送往精细修图去水印画板"
                  >
                    <span>送往去水印画板</span>
                  </button>

                  <button
                    type="button"
                    disabled={!imageFile}
                    onClick={handleTransitionToBatch}
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer text-center"
                    title="送往批量背景透明化与压缩列表"
                  >
                    <span>送往批量透底</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
