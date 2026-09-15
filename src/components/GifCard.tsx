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
  Sparkles,
  ChevronDown,
  ChevronUp,
  Split,
  Eye,
  FileImage,
  Smile,
  Type,
  Layers,
} from 'lucide-react';
import {
  GifItem,
  RemovalOptions,
  PreviewBgMode,
  FrameInfo,
  WeChatStickerOptions,
} from '../types';
import {
  decodeMediaFile,
  hexToRgb,
  rgbToHex,
  removeBackgroundFromFrame,
  renderFrameWithWeChatOptions,
} from '../utils/gifProcessor';

interface GifCardProps {
  item: GifItem;
  previewBg: PreviewBgMode;
  onUpdateOptions: (id: string, options: RemovalOptions) => void;
  onProcessItem: (id: string, asWeChat?: boolean) => void;
  onDeleteItem: (id: string) => void;
}

export const GifCard: React.FC<GifCardProps> = ({
  item,
  previewBg,
  onUpdateOptions,
  onProcessItem,
  onDeleteItem,
}) => {
  const [viewMode, setViewMode] = useState<'transparent' | 'original' | 'split'>('transparent');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [decodedFrames, setDecodedFrames] = useState<FrameInfo[]>([]);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWeChatOptions, setShowWeChatOptions] = useState(
    item.options.wechat?.enabled ?? true
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationTimerRef = useRef<number | null>(null);

  // Decode media file locally for the interactive player, scrubber, and eyedropper
  useEffect(() => {
    let cancelled = false;
    async function loadFrames() {
      try {
        const decoded = await decodeMediaFile(item.file);
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
  }, [item.file]);

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

    if (viewMode === 'original') {
      if (canvas.width !== origW || canvas.height !== origH) {
        canvas.width = origW;
        canvas.height = origH;
      }
      ctx.clearRect(0, 0, origW, origH);
      ctx.putImageData(frame.imageData, 0, 0);
    } else if (viewMode === 'transparent') {
      const rawTransparent = removeBackgroundFromFrame(frame.imageData, item.options);
      const isWeChat = !!item.options.wechat?.enabled;
      const processed = isWeChat
        ? renderFrameWithWeChatOptions(rawTransparent, item.options.wechat)
        : rawTransparent;

      if (canvas.width !== processed.width || canvas.height !== processed.height) {
        canvas.width = processed.width;
        canvas.height = processed.height;
      }
      ctx.clearRect(0, 0, processed.width, processed.height);
      ctx.putImageData(processed, 0, 0);
    } else if (viewMode === 'split') {
      // Split view: Left half transparent, Right half original
      const rawTransparent = removeBackgroundFromFrame(frame.imageData, item.options);
      const isWeChat = !!item.options.wechat?.enabled;
      const processed = isWeChat
        ? renderFrameWithWeChatOptions(rawTransparent, item.options.wechat)
        : rawTransparent;

      const pW = processed.width;
      const pH = processed.height;

      if (canvas.width !== pW || canvas.height !== pH) {
        canvas.width = pW;
        canvas.height = pH;
      }

      ctx.clearRect(0, 0, pW, pH);
      ctx.putImageData(processed, 0, 0);

      // Draw right half from original (scaled if WeChat size is active)
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
  }, [currentFrameIndex, decodedFrames, viewMode, item.options]);

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

    onUpdateOptions(item.id, {
      ...item.options,
      targetColor: hex,
    });

    setIsEyedropperActive(false);
    setHoverColor(null);
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

  const handleDownloadSingle = () => {
    if (!item.result?.url) return;
    const a = document.createElement('a');
    a.href = item.result.url;
    const dotIndex = item.file.name.lastIndexOf('.');
    const baseName = dotIndex > -1 ? item.file.name.substring(0, dotIndex) : item.file.name;
    const ext = item.result.format === 'png' ? 'png' : 'gif';
    const suffix = item.result.isWeChatSticker ? '_wechat_sticker' : '_transparent';
    a.download = `${baseName}${suffix}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getBgClass = () => {
    switch (previewBg) {
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

  const quickCardCaptions = ['收到', '好的', '哈哈', '点赞', '谢谢', '哭死', '无语'];

  return (
    <div
      id={`gif-card-${item.id}`}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md"
    >
      {/* Card Header */}
      <div className="p-3.5 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/70">
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
            className="text-xs font-semibold text-stone-800 truncate"
            title={item.file.name}
          >
            {item.file.name}
          </span>
        </div>

        {/* Status / WeChat badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {item.result?.isWeChatSticker ? (
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
              title={item.errorMessage}
            >
              <AlertCircle className="w-3 h-3" /> 失败
            </span>
          )}

          <button
            type="button"
            onClick={() => onDeleteItem(item.id)}
            className="text-stone-400 hover:text-red-600 p-1 rounded-md hover:bg-stone-200/60 transition-colors"
            title="移除此项"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Stage / Canvas */}
      <div className="relative p-4 flex flex-col items-center justify-center bg-stone-100/50 min-h-[260px]">
        {/* Top Floating Controls on Stage */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          {/* View Mode Pills */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-xs p-0.5 rounded-lg border border-stone-200/80 shadow-2xs pointer-events-auto text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('transparent')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
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
              className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-0.5 ${
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
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                viewMode === 'original'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              原图
            </button>
          </div>

          {/* Eyedropper Button */}
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEyedropperActive(!isEyedropperActive)}
              className={`p-1.5 rounded-lg border shadow-2xs transition-all flex items-center gap-1 text-[11px] ${
                isEyedropperActive
                  ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300'
                  : 'bg-white/95 text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
              title="吸管工具：点击画面中的背景色自动吸取"
            >
              <Pipette className="w-3.5 h-3.5" />
              {isEyedropperActive && <span>点选背景</span>}
            </button>
          </div>
        </div>

        {/* The Canvas Canvas Container */}
        <div
          className={`relative rounded-xl overflow-hidden border border-stone-300/80 shadow-xs max-w-full flex items-center justify-center ${getBgClass()}`}
          style={{ width: 240, height: 240 }}
        >
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
            <div className="absolute bottom-2 left-2 bg-stone-900/90 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1.5 shadow-md pointer-events-none">
              <span
                className="w-3 h-3 rounded-full border border-white/60 inline-block shadow-2xs"
                style={{ backgroundColor: hoverColor }}
              />
              <span className="font-mono">{hoverColor}</span>
            </div>
          )}

          {/* Processing Overlay */}
          {item.status === 'processing' && (
            <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-20">
              <RefreshCw className="w-7 h-7 text-[#07c160] animate-spin mb-2" />
              <p className="text-xs font-semibold text-stone-800">
                {item.progressMessage || '正在处理...'}
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

        {/* Media Dimension & File Size Info */}
        <div className="flex items-center justify-between w-full max-w-[240px] text-[11px] text-stone-500 mt-2 px-1">
          <span>
            {decodedFrames[0]?.imageData
              ? `${item.options.wechat?.enabled && item.options.wechat?.standardSize === '240' ? '240×240 (微信标准)' : `${decodedFrames[0].imageData.width}×${decodedFrames[0].imageData.height}`}`
              : '加载中...'}
          </span>
          <span>
            {item.result?.size ? (
              <span className="font-medium text-emerald-700">
                {formatFileSize(item.result.size)}
              </span>
            ) : (
              formatFileSize(item.file.size)
            )}
          </span>
        </div>

        {/* Animation Scrubber & Playback Controls (GIF Only) */}
        {item.mediaType === 'gif' && decodedFrames.length > 1 && (
          <div className="w-full max-w-[240px] mt-2 bg-white/90 border border-stone-200 rounded-lg p-1.5 flex items-center gap-2 shadow-2xs">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 text-stone-600 hover:text-stone-900 rounded hover:bg-stone-100 transition-colors"
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

      {/* WECHAT STICKER SPEC & TUNING PANEL */}
      <div className="p-3.5 border-t border-emerald-100 bg-emerald-50/30 space-y-3">
        {/* WeChat Mode Switch Header */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={item.options.wechat?.enabled ?? true}
              onChange={(e) => {
                const enabled = e.target.checked;
                updateWeChatSetting('enabled', enabled);
                setShowWeChatOptions(enabled);
              }}
              className="rounded text-[#07c160] focus:ring-[#07c160] w-4 h-4"
            />
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5 text-[#07c160]" />
              微信表情包制作模式
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowWeChatOptions(!showWeChatOptions)}
            className="text-[11px] text-[#07c160] font-semibold hover:underline flex items-center gap-0.5"
          >
            {showWeChatOptions ? '收起配置' : '展开选项'}
            {showWeChatOptions ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Detailed WeChat Options */}
        {showWeChatOptions && (
          <div className="space-y-2.5 pt-1 text-xs animate-in fade-in duration-100">
            {/* 1. Size & Outline row */}
            <div className="grid grid-cols-2 gap-2">
              {/* Standard size */}
              <div className="bg-white p-2 rounded-lg border border-emerald-200/80">
                <span className="text-[11px] font-medium text-stone-600 block mb-1">
                  规范尺寸
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
              <div className="bg-white p-2 rounded-lg border border-emerald-200/80">
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
                      className={`flex-1 py-0.5 rounded text-[11px] font-semibold border ${
                        (item.options.wechat?.outlineWidth ?? 2) === px
                          ? 'bg-[#07c160] text-white border-[#07c160]'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      {px}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Caption Text & Presets */}
            <div className="bg-white p-2 rounded-lg border border-emerald-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-stone-600 flex items-center gap-1">
                  <Type className="w-3 h-3 text-[#07c160]" />
                  表情包配字:
                </span>
                {item.options.wechat?.captionText && (
                  <button
                    type="button"
                    onClick={() => updateWeChatSetting('captionText', '')}
                    className="text-[10px] text-stone-400 hover:text-red-500"
                  >
                    清除配字
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

              {/* Quick Card Captions */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {quickCardCaptions.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => updateWeChatSetting('captionText', text)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GENERAL REMOVAL TUNING (Background Color & Tolerance) */}
      <div className="p-3.5 border-t border-stone-100 bg-stone-50/40 space-y-2.5">
        {/* Target Color Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-stone-700">消除底色:</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={item.options.targetColor}
                onChange={(e) =>
                  onUpdateOptions(item.id, {
                    ...item.options,
                    targetColor: e.target.value,
                  })
                }
                className="w-6 h-6 rounded border border-stone-300 cursor-pointer p-0.5"
              />
              <span className="text-xs font-mono text-stone-700 uppercase">
                {item.options.targetColor}
              </span>
            </div>
          </div>

          {/* Quick preset color buttons */}
          <div className="flex items-center gap-1">
            {['#ffffff', '#000000', '#00ff00', '#0000ff'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() =>
                  onUpdateOptions(item.id, {
                    ...item.options,
                    targetColor: c,
                  })
                }
                className={`w-4 h-4 rounded-full border shadow-xs ${
                  item.options.targetColor.toLowerCase() === c
                    ? 'ring-2 ring-indigo-500 scale-110'
                    : 'border-stone-300'
                }`}
                style={{ backgroundColor: c }}
                title={`设为 ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Auto Detected Color Badge */}
        {item.detectedBgColor && (
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>
              自动检测边缘背景色:{' '}
              <span className="font-mono font-medium text-stone-700">
                {item.detectedBgColor}
              </span>
            </span>
            {item.options.targetColor.toLowerCase() !==
              item.detectedBgColor.toLowerCase() && (
              <button
                type="button"
                onClick={() =>
                  onUpdateOptions(item.id, {
                    ...item.options,
                    targetColor: item.detectedBgColor,
                  })
                }
                className="text-indigo-600 hover:text-indigo-800 font-medium underline"
              >
                恢复推荐色
              </button>
            )}
          </div>
        )}

        {/* Tolerance Slider */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-stone-600 font-medium">
              容差阈值 (Tolerance): {item.options.tolerance}%
            </span>
            <span className="text-stone-400 text-[11px]">
              {item.options.tolerance <= 10
                ? '严格'
                : item.options.tolerance >= 30
                ? '宽松'
                : '标准'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            value={item.options.tolerance}
            onChange={(e) =>
              onUpdateOptions(item.id, {
                ...item.options,
                tolerance: parseInt(e.target.value, 10),
              })
            }
            className="w-full accent-[#07c160] h-1.5 bg-stone-200 rounded cursor-pointer"
          />
        </div>

        {/* Contiguous checkbox & Toggle Advanced */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={item.options.contiguous}
              onChange={(e) =>
                onUpdateOptions(item.id, {
                  ...item.options,
                  contiguous: e.target.checked,
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span
              className="text-stone-700 font-medium"
              title="仅从四周外边缘向内消除背景，保护主体内部相同颜色（如眼球白、高光白）"
            >
              仅向内消除外边缘 (保护内部)
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-stone-400 hover:text-stone-700 flex items-center gap-0.5 text-[11px]"
          >
            {showAdvanced ? '收起羽化' : '边缘羽化'}
            {showAdvanced ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Advanced Defringe / Edge Choke */}
        {showAdvanced && (
          <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs animate-in fade-in duration-100">
            <span className="text-stone-600">边缘去杂色 (羽化):</span>
            <div className="flex items-center gap-1">
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
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                    item.options.defringe === lvl
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-semibold'
                      : 'bg-white border-stone-200 text-stone-600'
                  }`}
                >
                  {lvl === 0 ? '关闭' : `${lvl}px`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="p-3 border-t border-stone-100 bg-white flex items-center justify-between gap-2 mt-auto">
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
          className="flex-1 px-3 py-2 bg-[#07c160] hover:bg-[#06ad56] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-[1.01]"
          title="按微信官方规范（240x240/白色描边/<1MB）生成微信表情包"
        >
          {item.status === 'processing' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Smile className="w-3.5 h-3.5" />
          )}
          生成微信表情包
        </button>

        {/* Regular Transparent Button */}
        <button
          id={`reprocess-btn-${item.id}`}
          type="button"
          disabled={item.status === 'processing'}
          onClick={() => onProcessItem(item.id, false)}
          className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs rounded-lg transition-colors"
          title="常规去底，保持原始图片尺寸"
        >
          常规去底
        </button>

        {/* Download Button */}
        <button
          id={`download-btn-${item.id}`}
          type="button"
          disabled={!item.result?.url}
          onClick={handleDownloadSingle}
          className="px-3 py-2 bg-stone-900 hover:bg-black text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          title={item.result?.isWeChatSticker ? '下载微信表情包' : '下载透明图片'}
        >
          <Download className="w-3.5 h-3.5" />
          {item.result?.isWeChatSticker ? '下载表情' : '下载'}
        </button>
      </div>

      {/* Helpful WeChat copy note */}
      <div className="px-3 pb-2 pt-0.5 bg-white text-[10px] text-stone-400 flex items-center justify-between border-t border-stone-50">
        <span>💡 微信中可直接长按或右键复制此图发送</span>
        {item.result?.isWeChatSticker && (
          <span className="text-[#07c160] font-medium">体积符合微信 &lt;1MB 限制</span>
        )}
      </div>
    </div>
  );
};
