import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Trash2,
  Pipette,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Split,
  Eye,
  FileImage,
  Smile,
  Type,
  Layers,
  Zap,
  Gauge,
  Scale,
  Paintbrush,
  X,
  Plus,
  ShieldCheck,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  GifItem,
  RemovalOptions,
  PreviewBgMode,
  FrameInfo,
  WeChatStickerOptions,
  CompressionOptions,
  CompressionPreset,
  ProcessedGifResult,
} from '../types';
import {
  decodeMediaFile,
  hexToRgb,
  rgbToHex,
  removeBackgroundFromFrame,
  renderFrameWithWeChatOptions,
  renderFramePipeline,
  encodeTransparentGifWithParams,
  COMPRESSION_PRESETS,
} from '../utils/gifProcessor';
import { removeBackgroundWithAI } from '../utils/aiBackgroundRemoval';

interface GifCardProps {
  item: GifItem;
  previewBg: PreviewBgMode;
  onUpdateOptions: (id: string, options: RemovalOptions) => void;
  onProcessItem: (id: string, asWeChat?: boolean) => void;
  onDeleteItem: (id: string) => void;
  onSendToRetouch?: (file: File) => void;
  onCompleteAiMatting?: (
    id: string,
    result: ProcessedGifResult,
    aiFrames: FrameInfo[],
    updatedOptions: RemovalOptions
  ) => void;
}

export const GifCard: React.FC<GifCardProps> = ({
  item,
  previewBg,
  onUpdateOptions,
  onProcessItem,
  onDeleteItem,
  onSendToRetouch,
  onCompleteAiMatting,
}) => {
  const [viewMode, setViewMode] = useState<'transparent' | 'original' | 'split'>('transparent');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [decodedFrames, setDecodedFrames] = useState<FrameInfo[]>([]);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [localBgMode, setLocalBgMode] = useState<PreviewBgMode>(previewBg);

  // Function Category Navigation Tab: 'matting' (抠图去底) | 'wechat' (微信规范) | 'compression' (体积压缩)
  const [activeTab, setActiveTab] = useState<'matting' | 'wechat' | 'compression'>('matting');

  // AI Matting States
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgressText, setAiProgressText] = useState('');
  const [aiProgressPct, setAiProgressPct] = useState(0);
  const [aiFrames, setAiFrames] = useState<FrameInfo[] | null>(item.aiTransparentFrames || null);

  const isOversized =
    item.status === 'done' &&
    !!item.result &&
    (item.result.format === 'gif'
      ? item.result.size > 1024 * 1024
      : item.result.size > 512 * 1024);

  // Whether WeChat sticker mode is active (false if user chose 'original' uncompressed quality)
  const isWeChatMode =
    item.options.compression?.preset !== 'original' &&
    item.options.compression?.enabled !== false &&
    !!item.options.wechat?.enabled;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationTimerRef = useRef<number | null>(null);

  // Synchronize previewBg prop with localBgMode if changed globally
  useEffect(() => {
    setLocalBgMode(previewBg);
  }, [previewBg]);

  // Synchronize cached AI frames if item has them
  useEffect(() => {
    if (item.aiTransparentFrames && item.aiTransparentFrames.length > 0 && !aiFrames) {
      setAiFrames(item.aiTransparentFrames);
    }
  }, [item.aiTransparentFrames, aiFrames]);

  // Decode media file locally for interactive player, scrubber, and canvas
  useEffect(() => {
    let cancelled = false;
    async function loadFrames() {
      if (item.cachedFrames && item.cachedFrames.length > 0) {
        setDecodedFrames(item.cachedFrames);
        return;
      }
      try {
        const decoded = await decodeMediaFile(item.file, item.cachedBuffer);
        if (cancelled) return;
        setDecodedFrames(decoded.frames);
      } catch (err) {
        console.error('Error decoding preview frames:', err);
      }
    }
    loadFrames();
    return () => {
      cancelled = true;
    };
  }, [item.file, item.cachedBuffer, item.cachedFrames]);

  // Frame animation player loop when playing
  useEffect(() => {
    if (!isPlaying || decodedFrames.length <= 1) {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      return;
    }

    const currentFrame = decodedFrames[currentFrameIndex];
    const delay = currentFrame ? currentFrame.delay : 100;

    animationTimerRef.current = window.setTimeout(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % decodedFrames.length);
    }, delay);

    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, [isPlaying, currentFrameIndex, decodedFrames]);

  // Helper to safely trigger blob download in browser
  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  // Convert ImageData to PNG Blob
  const imageDataToPngBlob = (data: ImageData): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const c = document.createElement('canvas');
      c.width = data.width;
      c.height = data.height;
      const ctx = c.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.putImageData(data, 0, 0);
      c.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to convert canvas to blob'));
      }, 'image/png');
    });
  };

  // Execute AI Neural Network Background Removal
  const handleRunAiMatting = async () => {
    setIsAiProcessing(true);
    setAiProgressPct(10);
    setAiProgressText('正在启动 AI 视觉模型...');
    try {
      const aiRes = await removeBackgroundWithAI(
        item.file,
        `${item.name}-${item.file.size}`,
        (info) => {
          setAiProgressPct(info.progress);
          setAiProgressText(info.message);
        }
      );
      const newFrames: FrameInfo[] = [{ imageData: aiRes.imageData, delay: 0 }];
      setAiFrames(newFrames);
      setViewMode('transparent');

      const isWeChat = isWeChatMode;
      const processedImageData = isWeChat
        ? renderFrameWithWeChatOptions(aiRes.imageData, item.options.wechat)
        : aiRes.imageData;

      const finalBlob = await imageDataToPngBlob(processedImageData);
      const finalUrl = URL.createObjectURL(finalBlob);

      const processedResult: ProcessedGifResult = {
        blob: finalBlob,
        url: finalUrl,
        size: finalBlob.size,
        frameCount: 1,
        width: processedImageData.width,
        height: processedImageData.height,
        format: 'png',
        isWeChatSticker: isWeChat,
        originalSize: item.file.size,
        passedWeChatLimit: finalBlob.size <= 512 * 1024,
        isAiMatting: true,
      };

      const updatedOptions: RemovalOptions = {
        ...item.options,
        removalMethod: 'ai',
      };

      if (onCompleteAiMatting) {
        onCompleteAiMatting(item.id, processedResult, newFrames, updatedOptions);
      } else {
        item.aiTransparentFrames = newFrames;
        item.result = processedResult;
        item.status = 'done';
        onUpdateOptions(item.id, updatedOptions);
      }
    } catch (err: any) {
      console.error('AI matting error:', err);
      alert('AI 抠图遇到问题，请检查网络或切换为吸色容差模式：' + (err.message || ''));
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSwitchToColor = () => {
    onUpdateOptions(item.id, {
      ...item.options,
      removalMethod: 'color',
    });
  };

  const handleSwitchToAi = () => {
    if (!aiFrames && !item.aiTransparentFrames) {
      handleRunAiMatting();
    } else {
      onUpdateOptions(item.id, {
        ...item.options,
        removalMethod: 'ai',
      });
      setViewMode('transparent');
    }
  };

  // Render the current frame to canvas (with real-time WeChat formatting if enabled!)
  useEffect(() => {
    if (!canvasRef.current || !decodedFrames.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = decodedFrames[currentFrameIndex];
    if (!frame) return;

    const origW = frame.imageData.width;
    const origH = frame.imageData.height;

    // Determine transparent frame based on active removal method (AI vs Color keying)
    const isAiActive = item.options.removalMethod === 'ai' || !!aiFrames || !!item.aiTransparentFrames;
    const activeAiFrames = aiFrames || item.aiTransparentFrames;
    const rawTransparent = isAiActive && activeAiFrames && activeAiFrames[currentFrameIndex]
      ? activeAiFrames[currentFrameIndex].imageData
      : removeBackgroundFromFrame(frame.imageData, item.options);

    const isWeChat = isWeChatMode;
    const processed = isWeChat
      ? renderFrameWithWeChatOptions(rawTransparent, item.options.wechat)
      : rawTransparent;

    if (viewMode === 'original') {
      if (canvas.width !== origW || canvas.height !== origH) {
        canvas.width = origW;
        canvas.height = origH;
      }
      ctx.clearRect(0, 0, origW, origH);
      ctx.putImageData(frame.imageData, 0, 0);
    } else if (viewMode === 'transparent') {
      if (canvas.width !== processed.width || canvas.height !== processed.height) {
        canvas.width = processed.width;
        canvas.height = processed.height;
      }
      ctx.clearRect(0, 0, processed.width, processed.height);
      ctx.putImageData(processed, 0, 0);
    } else if (viewMode === 'split') {
      // Split view: Left half transparent, Right half original
      const pW = processed.width;
      const pH = processed.height;

      if (canvas.width !== pW || canvas.height !== pH) {
        canvas.width = pW;
        canvas.height = pH;
      }

      ctx.clearRect(0, 0, pW, pH);
      ctx.putImageData(processed, 0, 0);

      // Draw right half from original
      const halfWidth = Math.floor(pW / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(halfWidth, 0, pW - halfWidth, pH);
      ctx.clip();

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = origW;
      tempCanvas.height = origH;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(frame.imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, pW, pH);
      }

      // Dividing line
      ctx.restore();
      ctx.strokeStyle = '#07c160';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(halfWidth, 0);
      ctx.lineTo(halfWidth, pH);
      ctx.stroke();
    }
  }, [currentFrameIndex, decodedFrames, viewMode, item.options, aiFrames, item.aiTransparentFrames]);

  // Active target colors list (always at least 1 color)
  const activeTargetColors = Array.isArray(item.options.targetColors) && item.options.targetColors.length > 0
    ? item.options.targetColors
    : [item.options.targetColor || '#ffffff'];

  const addTargetColor = (newHex: string) => {
    const hex = newHex.toLowerCase();
    const current = activeTargetColors.map((c) => c.toLowerCase());
    const updated = current.includes(hex) ? activeTargetColors : [...activeTargetColors, newHex];
    onUpdateOptions(item.id, {
      ...item.options,
      targetColor: newHex,
      targetColors: updated,
    });
  };

  const removeTargetColor = (targetHex: string) => {
    const hex = targetHex.toLowerCase();
    const current = activeTargetColors.map((c) => c.toLowerCase());
    const remaining = activeTargetColors.filter((_, idx) => current[idx] !== hex);
    const nextList = remaining.length > 0 ? remaining : ['#ffffff'];
    onUpdateOptions(item.id, {
      ...item.options,
      targetColor: nextList[0],
      targetColors: nextList,
    });
  };

  // Eyedropper click handler on canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    addTargetColor(hex);
  };

  // Eyedropper move handler for real-time color hover preview
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        setHoverColor(hex);
      }
    }
  };

  // DOWNLOAD HANDLER (GUARANTEED TO EXPORT TRANSPARENT GIF FOR GIFS, PNG FOR STATIC)
  const handleDownloadSingle = async () => {
    const dotIndex = item.file.name.lastIndexOf('.');
    const baseName = dotIndex > -1 ? item.file.name.substring(0, dotIndex) : item.file.name;
    const isWeChat = isWeChatMode;
    const isGif = item.mediaType === 'gif' || item.file.name.toLowerCase().endsWith('.gif') || (decodedFrames && decodedFrames.length > 1);

    // If item has a completed processed result Blob, prioritize downloading that directly!
    if (item.status === 'done' && item.result?.blob) {
      const ext = item.result.format === 'gif' || isGif ? 'gif' : 'png';
      const suffix = item.result.isWeChatSticker ? '_wechat_sticker' : '_transparent';
      triggerBlobDownload(item.result.blob, `${baseName}${suffix}.${ext}`);
      return;
    }

    // Priority: GIF on-the-fly encode if result is not cached yet
    if (isGif && decodedFrames && decodedFrames.length > 0) {
      try {
        const framesToEncode = decodedFrames.map((f) => ({
          imageData: renderFramePipeline(
            item.options.enableRemoval === false
              ? f.imageData
              : removeBackgroundFromFrame(f.imageData, item.options),
            item.options
          ),
          delay: f.delay,
        }));
        const tw = framesToEncode[0]?.imageData.width || item.width || 240;
        const th = framesToEncode[0]?.imageData.height || item.height || 240;
        const res = await encodeTransparentGifWithParams(
          framesToEncode,
          tw,
          th,
          item.options.compression || {
            scaleRatio: 1.0,
            maxColors: 256,
            frameStep: 1,
          }
        );
        const suffix = isWeChat ? '_wechat_sticker' : '_transparent';
        triggerBlobDownload(res.blob, `${baseName}${suffix}.gif`);
        return;
      } catch (err) {
        console.error('Failed to encode GIF on download:', err);
      }
    }

    // Priority 1: If AI matting was performed on static image
    const activeAiFrame = (aiFrames && aiFrames[0]) || (item.aiTransparentFrames && item.aiTransparentFrames[0]);
    if (!isGif && (item.options.removalMethod === 'ai' || activeAiFrame)) {
      if (activeAiFrame) {
        const processed = isWeChat
          ? renderFrameWithWeChatOptions(activeAiFrame.imageData, item.options.wechat)
          : activeAiFrame.imageData;

        try {
          const blob = await imageDataToPngBlob(processed);
          const suffix = isWeChat ? '_wechat_sticker' : '_transparent';
          triggerBlobDownload(blob, `${baseName}${suffix}.png`);
          return;
        } catch (err) {
          console.error('Failed to export AI cutout blob:', err);
        }
      }
    }

    // Priority 2: Direct export from live transparent Canvas (static image only)
    if (!isGif && viewMode === 'transparent' && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const suffix = isWeChat ? '_wechat_sticker' : '_transparent';
          triggerBlobDownload(blob, `${baseName}${suffix}.png`);
        } else {
          fallbackDownload();
        }
      }, 'image/png');
      return;
    }

    // Priority 3: Fallback from item.result
    fallbackDownload();

    function fallbackDownload() {
      if (item.result?.blob) {
        const ext = item.result.format === 'gif' || isGif ? 'gif' : 'png';
        const suffix = item.result.isWeChatSticker ? '_wechat_sticker' : '_transparent';
        triggerBlobDownload(item.result.blob, `${baseName}${suffix}.${ext}`);
        return;
      }
      if (item.result?.url) {
        const a = document.createElement('a');
        a.href = item.result.url;
        const ext = item.result.format === 'gif' || isGif ? 'gif' : 'png';
        const suffix = item.result.isWeChatSticker ? '_wechat_sticker' : '_transparent';
        a.download = `${baseName}${suffix}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const updateWeChatSetting = <K extends keyof WeChatStickerOptions>(
    key: K,
    value: WeChatStickerOptions[K]
  ) => {
    onUpdateOptions(item.id, {
      ...item.options,
      wechat: {
        enabled: true,
        standardSize: '240',
        addWhiteOutline: true,
        outlineWidth: 2,
        outlineColor: '#ffffff',
        captionText: '',
        captionPosition: 'bottom',
        captionColor: '#ffffff',
        captionStrokeColor: '#000000',
        captionFontSize: 22,
        ...item.options.wechat,
        [key]: value,
      },
    });
  };

  const updateCompressionSetting = <K extends keyof CompressionOptions>(
    key: K,
    value: CompressionOptions[K]
  ) => {
    onUpdateOptions(item.id, {
      ...item.options,
      compression: {
        enabled: true,
        preset: 'wechat-auto',
        targetSizeKb: 1000,
        maxColors: 256,
        scaleRatio: 1.0,
        frameStep: 1,
        autoCompressUnderLimit: true,
        ...item.options.compression,
        [key]: value,
      },
    });
  };

  const handleSelectPreset = (preset: CompressionPreset) => {
    if (preset === 'original') {
      onUpdateOptions(item.id, {
        ...item.options,
        wechat: {
          ...item.options.wechat,
          enabled: false,
          standardSize: 'original',
          addWhiteOutline: false,
        },
        compression: {
          enabled: false,
          preset: 'original',
          targetSizeKb: 5000,
          maxColors: 256,
          scaleRatio: 1.0,
          frameStep: 1,
          autoCompressUnderLimit: false,
        },
      });
      return;
    }
    const found = COMPRESSION_PRESETS.find((p) => p.id === preset);
    if (found) {
      onUpdateOptions(item.id, {
        ...item.options,
        wechat: {
          ...item.options.wechat,
          enabled: true,
          standardSize: '240',
          addWhiteOutline: true,
        },
        compression: {
          enabled: true,
          preset,
          targetSizeKb: found.targetSizeKb,
          maxColors: found.maxColors,
          scaleRatio: found.scaleRatio,
          frameStep: found.frameStep,
          autoCompressUnderLimit: found.autoCompressUnderLimit,
        },
      });
    }
  };

  const getBgClass = () => {
    switch (localBgMode) {
      case 'checker-dark':
        return 'bg-checker-dark';
      case 'wechat-chat':
        return 'bg-[#ededed]';
      case 'wechat-dark':
        return 'bg-[#191919]';
      case 'white':
        return 'bg-white';
      case 'dark':
        return 'bg-stone-900';
      case 'neon':
        return 'bg-[#ec4899]';
      case 'checker':
      default:
        return 'bg-checker';
    }
  };

  const quickCardCaptions = ['收到', '好的', '哈哈', '点赞', '谢谢', '哭死', '无语'];

  return (
    <div
      id={`gif-card-${item.id}`}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md"
    >
      {/* 1. CARD HEADER */}
      <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/80">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
              item.mediaType === 'image'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {item.mediaType === 'image' ? '静态图片' : 'GIF 动图'}
          </span>
          <span
            className="text-xs font-bold text-stone-800 truncate"
            title={item.file.name}
          >
            {item.file.name}
          </span>
        </div>

        {/* Status / WeChat Badges & Action Icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {aiFrames || item.aiTransparentFrames || item.options.removalMethod === 'ai' ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200"
              title="已采用 AI 深度神经视觉分割，彻底剥离阴影与杂色底"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              AI 已抠图
            </span>
          ) : item.result?.isWeChatSticker ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300"
              title="已按微信官方标准生成：240×240规格、白色保护描边、体积<1MB"
            >
              <Smile className="w-3.5 h-3.5 text-[#07c160]" />
              微信表情包就绪
            </span>
          ) : item.status === 'done' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> 已去底
            </span>
          ) : null}

          {item.status === 'error' && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200"
              title={item.errorMessage || '处理失败'}
            >
              <AlertCircle className="w-3 h-3" /> 失败
            </span>
          )}

          {onSendToRetouch && (
            <button
              type="button"
              onClick={async () => {
                if (aiFrames && aiFrames[0]) {
                  const b = await imageDataToPngBlob(aiFrames[0].imageData);
                  const f = new File([b], item.name.replace(/\.[^/.]+$/, '') + '_ai_clean.png', {
                    type: 'image/png',
                  });
                  onSendToRetouch(f);
                } else if (item.result?.blob) {
                  const isGifItem = item.mediaType === 'gif' || item.file.name.toLowerCase().endsWith('.gif') || item.result.format === 'gif';
                  const ext = isGifItem ? '.gif' : '.png';
                  const mime = isGifItem ? 'image/gif' : 'image/png';
                  const f = new File([item.result.blob], `${item.name.replace(/\.[^/.]+$/, '')}_transparent${ext}`, {
                    type: mime,
                  });
                  onSendToRetouch(f);
                } else {
                  onSendToRetouch(item.file);
                }
              }}
              className="text-stone-400 hover:text-[#07c160] p-1.5 rounded-md hover:bg-stone-200/60 transition-colors cursor-pointer"
              title="送往 AI 修图去水印画板（消除杂物/文字/修复瑕疵）"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDeleteItem(item.id)}
            className="text-stone-400 hover:text-red-600 p-1.5 rounded-md hover:bg-stone-200/60 transition-colors cursor-pointer"
            title="移除此项"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN BODY: REDESIGNED SIDE-BY-SIDE SPLIT LAYOUT                        */}
      {/* LEFT: Live Sticky Image Stage (No Scrolling Needed!)                      */}
      {/* RIGHT: Function Categories, Sliders & Immediate Actions                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row flex-1 min-w-0">
        {/* ===================================================================== */}
        {/* LEFT COLUMN: VISUAL STAGE & CANVAS (Fixed/Sticky on Wide Screens)     */}
        {/* ===================================================================== */}
        <div className="w-full md:w-[320px] lg:w-[350px] shrink-0 border-b md:border-b-0 md:border-r border-stone-100 bg-stone-50/50 p-4 flex flex-col items-center justify-between gap-3 md:sticky md:top-20 md:self-start">
          {/* Top Stage Control Pills */}
          <div className="w-full flex items-center justify-between gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200 shadow-2xs text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('transparent')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  viewMode === 'transparent'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                透明效果
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-0.5 cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="左右对比（左：去底效果，右：原图）"
              >
                <Split className="w-3 h-3" /> 对比
              </button>
              <button
                type="button"
                onClick={() => setViewMode('original')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  viewMode === 'original'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                原图
              </button>
            </div>

            {/* Eyedropper Button */}
            <button
              type="button"
              onClick={() => {
                setIsEyedropperActive(!isEyedropperActive);
                if (isEyedropperActive) setHoverColor(null);
              }}
              className={`p-1 px-2 rounded-lg border shadow-2xs transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
                isEyedropperActive
                  ? 'bg-amber-500 text-stone-950 border-amber-600 ring-2 ring-amber-400 font-bold animate-pulse'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
              title="吸管工具：点击画面吸取底色，支持多处连续取色"
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>{isEyedropperActive ? '吸色中' : '吸管'}</span>
            </button>
          </div>

          {/* Canvas Preview Container (240x240 Standard WeChat Framing) */}
          <div
            className={`relative rounded-xl overflow-hidden border border-stone-300/80 shadow-xs flex items-center justify-center transition-colors ${getBgClass()}`}
            style={{ width: 240, height: 240 }}
          >
            {/* Eyedropper Floating Notification */}
            {isEyedropperActive && (
              <div className="absolute top-2 left-2 right-2 bg-stone-900/95 text-white border border-amber-400 px-2.5 py-1 rounded-lg text-[10px] font-semibold shadow-lg flex items-center justify-between z-30 animate-in fade-in">
                <div className="flex items-center gap-1 text-amber-400 truncate">
                  <Pipette className="w-3 h-3 animate-pulse shrink-0" />
                  <span className="truncate">点击画面吸色</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEyedropperActive(false);
                    setHoverColor(null);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shrink-0 transition-colors cursor-pointer"
                >
                  完成
                </button>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              className={`max-w-full max-h-full object-contain ${
                isEyedropperActive ? 'cursor-crosshair' : ''
              }`}
            />

            {/* Eyedropper Hover Loupe */}
            {isEyedropperActive && hoverColor && (
              <div className="absolute bottom-2 left-2 bg-stone-900/90 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1.5 shadow-md pointer-events-none z-30">
                <span
                  className="w-3 h-3 rounded-full border border-white/60 inline-block shadow-2xs shrink-0"
                  style={{ backgroundColor: hoverColor }}
                />
                <span className="font-mono">{hoverColor}</span>
              </div>
            )}

            {/* AI Matting Processing Overlay */}
            {isAiProcessing && (
              <div className="absolute inset-0 bg-stone-900/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-30 text-white animate-in fade-in">
                <Sparkles className="w-8 h-8 text-amber-400 animate-bounce mb-2" />
                <p className="text-xs font-bold text-white mb-1">AI 正在智能抠出主体人物</p>
                <p className="text-[10px] text-stone-300 max-w-[200px] truncate">{aiProgressText || '正在分析发丝与身体轮廓...'}</p>
                <div className="w-36 bg-stone-700 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-200"
                    style={{ width: `${aiProgressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-amber-300 font-mono mt-1">{aiProgressPct}%</span>
              </div>
            )}

            {/* Regular Processing Overlay */}
            {item.status === 'processing' && !isAiProcessing && (
              <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-20">
                <RefreshCw className="w-7 h-7 text-[#07c160] animate-spin mb-2" />
                <p className="text-xs font-semibold text-stone-800">
                  {item.statusMessage || '正在处理...'}
                </p>
                <div className="w-32 bg-stone-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-[#07c160] h-full transition-all duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-stone-500 mt-1">{item.progress}%</span>
              </div>
            )}
          </div>

          {/* Preview Background Quick Select Dots */}
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="text-[10px] text-stone-400">底色测试:</span>
            {[
              { id: 'checker', label: '浅色棋盘', bg: 'bg-stone-200' },
              { id: 'wechat-chat', label: '微信浅灰', bg: 'bg-[#ededed]' },
              { id: 'wechat-dark', label: '微信深色', bg: 'bg-[#191919]' },
              { id: 'white', label: '纯白', bg: 'bg-white border border-stone-300' },
              { id: 'dark', label: '纯黑', bg: 'bg-black' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setLocalBgMode(b.id as PreviewBgMode)}
                className={`w-4 h-4 rounded-full ${b.bg} transition-transform cursor-pointer ${
                  localBgMode === b.id ? 'ring-2 ring-emerald-500 scale-110 shadow-2xs' : 'opacity-70 hover:opacity-100'
                }`}
                title={`切换至「${b.label}」背景预览`}
              />
            ))}
          </div>

          {/* Media Dimensions & File Size Info */}
          <div className="w-full text-[11px] text-stone-500 px-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {decodedFrames[0]?.imageData
                  ? `${isWeChatMode && item.options.wechat?.standardSize === '240' ? '240×240 (微信标准)' : `${decodedFrames[0].imageData.width}×${decodedFrames[0].imageData.height} (原图尺寸)`}`
                  : '加载中...'}
              </span>
              <span>
                {item.result?.size ? (
                  <span className="font-bold text-stone-900 font-mono">
                    {formatFileSize(item.result.size)}
                  </span>
                ) : (
                  <span className="font-mono">{formatFileSize(item.file.size)}</span>
                )}
              </span>
            </div>

            {item.result && (
              <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px]">
                <span className="text-stone-400">
                  原: {formatFileSize(item.file.size)}
                  {item.result.size < item.file.size && (
                    <span className="text-emerald-600 font-semibold ml-1">
                      (-{Math.round((1 - item.result.size / item.file.size) * 100)}%)
                    </span>
                  )}
                </span>
                <span
                  className={`font-semibold ${
                    isOversized ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {isOversized ? '超出微信限制' : '✅ 符合微信规范'}
                </span>
              </div>
            )}
          </div>

          {/* GIF Timeline Scrubber (If media is GIF) */}
          {item.mediaType === 'gif' && decodedFrames.length > 1 && (
            <div className="w-full bg-white border border-stone-200 rounded-lg p-1.5 flex items-center gap-2 shadow-2xs">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 text-stone-600 hover:text-stone-900 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                title={isPlaying ? '暂停动图' : '播放动图'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <input
                type="range"
                min="0"
                max={decodedFrames.length - 1}
                value={currentFrameIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrameIndex(parseInt(e.target.value, 10));
                }}
                className="flex-1 accent-[#07c160] h-1.5 bg-stone-200 rounded cursor-pointer"
                title={`帧 ${currentFrameIndex + 1} / ${decodedFrames.length}`}
              />

              <span className="text-[10px] font-mono text-stone-500 w-10 text-right">
                {currentFrameIndex + 1}/{decodedFrames.length}
              </span>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* RIGHT COLUMN: FUNCTION NAVIGATION TABS, SLIDERS & CONTROLS            */}
        {/* Everything is placed side-by-side with the image: NO SCROLLING!       */}
        {/* ===================================================================== */}
        <div className="flex-1 p-4 flex flex-col justify-between gap-3 min-w-0 bg-white">
          <div className="space-y-3">
            {/* Category Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-stone-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('matting')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'matting'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>抠图与去底</span>
                {(aiFrames || item.aiTransparentFrames) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('wechat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'wechat'
                    ? 'bg-[#07c160] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>微信表情规范</span>
                {item.options.wechat?.enabled && (
                  <span className="text-[10px] font-mono px-1 rounded bg-black/15">240px</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('compression')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'compression'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>体积压缩</span>
                {isOversized && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: 抠图与去底 (AI智能一键抠图 vs 吸色容差) */}
            {activeTab === 'matting' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                {/* Mode Selector Segmented Control */}
                <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={handleSwitchToAi}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      item.options.removalMethod === 'ai' || (!item.options.removalMethod && (aiFrames || item.aiTransparentFrames))
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                        : 'text-stone-700 hover:text-indigo-600 hover:bg-white/80'
                    }`}
                    title="一键通过 AI 神经网络精准识别人物轮廓，彻底消除墙面阴影与杂色底"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>✨ AI 智能一键抠图</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchToColor}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      item.options.removalMethod === 'color'
                        ? 'bg-white text-stone-800 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                    }`}
                    title="吸管取色配合容差消除单色背景"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    <span>🎨 吸色容差去底</span>
                  </button>
                </div>

                {/* AI MODE PANEL */}
                {item.options.removalMethod === 'ai' || (!item.options.removalMethod && (aiFrames || item.aiTransparentFrames)) ? (
                  <div className="bg-gradient-to-b from-indigo-50/70 to-purple-50/40 p-3.5 rounded-xl border border-indigo-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-indigo-950">
                          {aiFrames || item.aiTransparentFrames ? 'AI 人物主体抠图已完成' : 'AI 深度视觉分割已就绪'}
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-600 font-medium">100% 浏览器本地运算</span>
                    </div>

                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      💡 针对人物背后墙面阴影、光照不均匀及衣服颜色与背景相近的问题，AI 视觉模型基于人体语义进行精准分割，<strong>彻底清除不均匀阴影与杂色底</strong>，无需手动调容差，人物衣服绝不误删！
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleRunAiMatting}
                        disabled={isAiProcessing}
                        className="flex-1 py-2 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isAiProcessing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{aiFrames || item.aiTransparentFrames ? '重新执行 AI 智能抠图' : '立即执行 AI 智能抠图'}</span>
                      </button>

                      {onSendToRetouch && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (aiFrames && aiFrames[0]) {
                              const b = await imageDataToPngBlob(aiFrames[0].imageData);
                              const f = new File([b], item.name.replace(/\.[^/.]+$/, '') + '_ai_matting.png', {
                                type: 'image/png',
                              });
                              onSendToRetouch(f);
                            } else if (item.result?.blob) {
                              const isGifItem = item.mediaType === 'gif' || item.file.name.toLowerCase().endsWith('.gif') || item.result.format === 'gif';
                              const ext = isGifItem ? '.gif' : '.png';
                              const mime = isGifItem ? 'image/gif' : 'image/png';
                              const f = new File([item.result.blob], `${item.name.replace(/\.[^/.]+$/, '')}_transparent${ext}`, {
                                type: mime,
                              });
                              onSendToRetouch(f);
                            } else {
                              onSendToRetouch(item.file);
                            }
                          }}
                          className="py-2 px-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="在修图画板中微调边缘或消除杂物"
                        >
                          <Paintbrush className="w-3.5 h-3.5 text-stone-500" />
                          <span>修图画板</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* COLOR & TOLERANCE SLIDERS PANEL */
                  <div className="space-y-3">
                    {/* Notice for tolerance eating subject */}
                    <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 shadow-2xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-amber-800">
                          背景颜色不均导致容差只能选 1？
                        </span>
                        <p className="text-stone-600 leading-normal">
                          若背景存在阴影反光，直接点击上方
                          <button
                            type="button"
                            onClick={handleSwitchToAi}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-1 bg-indigo-600 text-white rounded font-bold text-[10px] hover:bg-indigo-700 cursor-pointer"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                            【AI 智能抠图】
                          </button>
                          即可一键剥离，衣服绝不误删！
                        </p>
                      </div>
                    </div>

                    {/* Color Target Row */}
                    <div className="flex items-center justify-between gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-stone-700">消除底色:</label>
                        <div className="flex items-center gap-1 flex-wrap">
                          {activeTargetColors.map((color, idx) => (
                            <span
                              key={`${color}-${idx}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-white border border-stone-200 shadow-2xs"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-stone-300"
                                style={{ backgroundColor: color }}
                              />
                              <span>{color}</span>
                              {activeTargetColors.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTargetColor(color)}
                                  className="text-stone-400 hover:text-red-500 cursor-pointer"
                                  title="移除此颜色"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsEyedropperActive(true);
                        }}
                        className="px-2 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded border border-stone-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-emerald-600" />
                        <span>吸管加选</span>
                      </button>
                    </div>

                    {/* Tolerance Slider (Side-by-side with image, directly see changes!) */}
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <label className="font-bold text-stone-700">容差值 (Tolerance):</label>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[11px]">
                            {item.options.tolerance}
                          </span>
                        </div>
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1">
                          {[1, 10, 20, 35, 50].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() =>
                                onUpdateOptions(item.id, {
                                  ...item.options,
                                  tolerance: v,
                                })
                              }
                              className={`px-1.5 py-0.2 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                                item.options.tolerance === v
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={item.options.tolerance}
                        onChange={(e) =>
                          onUpdateOptions(item.id, {
                            ...item.options,
                            tolerance: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-emerald-600 h-2 bg-stone-200 rounded cursor-pointer"
                      />
                    </div>

                    {/* Edge Barrier & Defringe */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Edge Gradient Barrier Slider */}
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-stone-700">边缘防穿透保护:</span>
                          <span className="font-mono text-indigo-700 font-bold">
                            {item.options.edgeBarrier === false ? '关闭' : `${item.options.edgeThreshold ?? 20}`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="45"
                          value={item.options.edgeThreshold ?? 20}
                          onChange={(e) =>
                            onUpdateOptions(item.id, {
                              ...item.options,
                              edgeBarrier: true,
                              edgeThreshold: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full accent-indigo-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                        />
                      </div>

                      {/* Defringe Feathering */}
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-200 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-stone-700">羽化消边:</span>
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          {[0, 1, 2].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                onUpdateOptions(item.id, {
                                  ...item.options,
                                  defringe: lvl,
                                })
                              }
                              className={`py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                                (item.options.defringe ?? 1) === lvl
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {lvl === 0 ? '无' : `${lvl}px`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 微信表情规范 (240x240, 2px描边, 配字) */}
            {activeTab === 'wechat' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.options.wechat?.enabled ?? true}
                        onChange={(e) => updateWeChatSetting('enabled', e.target.checked)}
                        className="rounded text-[#07c160] focus:ring-[#07c160] w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                        <Smile className="w-3.5 h-3.5 text-[#07c160]" />
                        微信表情包规范模式 (240×240)
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Size Select */}
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <span className="text-[11px] font-medium text-stone-600 block mb-1">
                        画面尺寸
                      </span>
                      <select
                        value={item.options.wechat?.standardSize || '240'}
                        onChange={(e) =>
                          updateWeChatSetting(
                            'standardSize',
                            e.target.value as '240' | 'max240' | 'original'
                          )
                        }
                        className="w-full text-xs bg-stone-50 border border-stone-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-[#07c160]"
                      >
                        <option value="240">240×240 正方形 (推荐)</option>
                        <option value="max240">最大 240px (等比)</option>
                        <option value="original">保持原始比例</option>
                      </select>
                    </div>

                    {/* White Outline */}
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-stone-600">白色描边</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.options.wechat?.addWhiteOutline ?? true}
                            onChange={(e) => updateWeChatSetting('addWhiteOutline', e.target.checked)}
                            className="rounded text-[#07c160] focus:ring-[#07c160] w-3 h-3"
                          />
                          <span className="text-[10px] text-stone-500">开启</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((px) => (
                          <button
                            key={px}
                            type="button"
                            onClick={() => updateWeChatSetting('outlineWidth', px)}
                            className={`flex-1 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                              (item.options.wechat?.outlineWidth ?? 2) === px
                                ? 'bg-[#07c160] text-white border-[#07c160]'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {px}px
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Caption Text Input & Presets */}
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-600 flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-[#07c160]" />
                        表情包配字文案:
                      </span>
                      {item.options.wechat?.captionText && (
                        <button
                          type="button"
                          onClick={() => updateWeChatSetting('captionText', '')}
                          className="text-[10px] text-stone-400 hover:text-red-500 cursor-pointer"
                        >
                          清除文字
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="在表情包上添加文字（如：收到、哈哈）"
                      value={item.options.wechat?.captionText || ''}
                      onChange={(e) => updateWeChatSetting('captionText', e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#07c160]"
                    />

                    {/* Quick Caption Chips */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {quickCardCaptions.map((text) => (
                        <button
                          key={text}
                          type="button"
                          onClick={() => updateWeChatSetting('captionText', text)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                        >
                          {text}
                        </button>
                      ))}
                    </div>

                    {/* Auto erase bottom text option */}
                    <div className="pt-1.5 border-t border-emerald-100 space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] text-stone-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.options.wechat?.eraseOriginalBottomText ?? false}
                          onChange={(e) => updateWeChatSetting('eraseOriginalBottomText', e.target.checked)}
                          className="rounded text-[#07c160] focus:ring-[#07c160] w-3.5 h-3.5"
                        />
                        <span className="font-bold text-amber-800">
                          自动擦除原图底部旧文字区（防新旧文字重叠）
                        </span>
                      </label>

                      {onSendToRetouch && (
                        <button
                          type="button"
                          onClick={() => onSendToRetouch(item.file)}
                          className="w-full py-1.5 px-2 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          title="进入画板：可逐帧用矩形或涂抹消除错误文字，并重新打字"
                        >
                          <Paintbrush className="w-3.5 h-3.5 text-pink-600" />
                          <span>🎨 进入修图画板：自由擦除旧文字并重新打字</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 体积压缩与微信达标 (<1MB / 500KB) */}
            {activeTab === 'compression' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.options.compression?.enabled ?? true}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          updateCompressionSetting('enabled', enabled);
                          if (!enabled) {
                            updateCompressionSetting('preset', 'original');
                          } else if (item.options.compression?.preset === 'original') {
                            updateCompressionSetting('preset', 'wechat-auto');
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        微信上传体积压缩
                      </span>
                    </label>

                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      {(!item.options.compression?.enabled || item.options.compression?.preset === 'original')
                        ? '原图 (不压缩)'
                        : `目标: ≤${item.options.compression?.targetSizeKb ?? 1000}KB`}
                    </span>
                  </div>

                  {/* Preset Pills: 原图, 智能适配, ≤500KB, ≤300KB, 自定义 */}
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'original', label: '原图' },
                      { id: 'wechat-auto', label: '智能适配' },
                      { id: 'wechat-500kb', label: '≤500KB' },
                      { id: 'light-300kb', label: '≤300KB' },
                      { id: 'custom', label: '自定义' },
                    ].map((preset) => {
                      const isSelected =
                        preset.id === 'original'
                          ? (!item.options.compression?.enabled || item.options.compression?.preset === 'original')
                          : (item.options.compression?.enabled && item.options.compression?.preset === preset.id);

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.id as CompressionPreset)}
                          className={`py-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-bold'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Target Size Slider OR Original Quality Status */}
                  {(!item.options.compression?.enabled || item.options.compression?.preset === 'original') ? (
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-xs flex items-center justify-between text-stone-700">
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">已选择「<strong>原图</strong>」：不压缩画质，保留原始文件完整色彩与帧率</span>
                      </div>
                      <span className="font-mono text-stone-500 text-[11px] shrink-0 ml-2">
                        原图: {formatFileSize(item.file.size)}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-700">限制上限:</span>
                        <span className="font-mono font-bold text-amber-700">
                          {item.options.compression?.targetSizeKb ?? 1000} KB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="150"
                        max="1200"
                        step="50"
                        value={item.options.compression?.targetSizeKb ?? 1000}
                        onChange={(e) => {
                          updateCompressionSetting('targetSizeKb', parseInt(e.target.value, 10));
                          updateCompressionSetting('preset', 'custom');
                        }}
                        className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* BOTTOM ACTION BAR: GENERATE WECHAT / REPROCESS / DOWNLOAD         */}
          {/* ================================================================= */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 mt-auto">
            {/* Generate WeChat Sticker (Primary) */}
            <button
              id={`generate-wechat-btn-${item.id}`}
              type="button"
              disabled={item.status === 'processing'}
              onClick={() => {
                if (!item.options.wechat?.enabled) {
                  onUpdateOptions(item.id, {
                    ...item.options,
                    wechat: {
                      enabled: true,
                      standardSize: '240',
                      addWhiteOutline: true,
                      outlineWidth: 2,
                      outlineColor: '#ffffff',
                      captionText: item.options.wechat?.captionText || '',
                      captionPosition: 'bottom',
                      captionColor: '#ffffff',
                      captionStrokeColor: '#000000',
                      captionFontSize: 22,
                    },
                  });
                }
                onProcessItem(item.id, true);
              }}
              className="flex-1 px-3 py-2 bg-[#07c160] hover:bg-[#06ad56] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="按微信官方规范（240x240/白色描边/<1MB）生成微信表情包"
            >
              {item.status === 'processing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Smile className="w-3.5 h-3.5" />
              )}
              <span>生成微信表情包</span>
            </button>

            {/* Regular Transparent Button */}
            <button
              id={`reprocess-btn-${item.id}`}
              type="button"
              disabled={item.status === 'processing'}
              onClick={() => {
                handleSelectPreset('original');
                onProcessItem(item.id, false);
              }}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
              title="常规去底，保持原始图片尺寸与原画质"
            >
              常规去底
            </button>

            {/* Download Button (100% Guaranteed to download transparent cutout) */}
            <button
              id={`download-btn-${item.id}`}
              type="button"
              disabled={!item.result?.url && !aiFrames && !item.aiTransparentFrames && viewMode !== 'transparent'}
              onClick={handleDownloadSingle}
              className="px-3.5 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={isWeChatMode ? '下载微信表情包 (240x240/白色描边)' : '下载原图尺寸透明图片 (保留原始分辨率无描边)'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isWeChatMode ? '下载表情' : '下载原图'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
