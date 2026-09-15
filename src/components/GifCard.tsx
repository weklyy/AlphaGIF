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
} from 'lucide-react';
import { GifItem, RemovalOptions, PreviewBgMode, FrameInfo } from '../types';
import {
  decodeGif,
  hexToRgb,
  rgbToHex,
  removeBackgroundFromFrame,
} from '../utils/gifProcessor';

interface GifCardProps {
  item: GifItem;
  previewBg: PreviewBgMode;
  onUpdateOptions: (id: string, options: RemovalOptions) => void;
  onProcessItem: (id: string) => void;
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationTimerRef = useRef<number | null>(null);

  // Decode GIF locally for the interactive player, scrubber, and eyedropper
  useEffect(() => {
    let cancelled = false;
    async function loadFrames() {
      try {
        const buffer = await item.file.arrayBuffer();
        if (cancelled) return;
        const decoded = await decodeGif(buffer);
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

  // Render the current frame to canvas
  useEffect(() => {
    if (!canvasRef.current || !decodedFrames.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = decodedFrames[currentFrameIndex];
    if (!frame) return;

    const width = frame.imageData.width;
    const height = frame.imageData.height;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (viewMode === 'original') {
      ctx.putImageData(frame.imageData, 0, 0);
    } else if (viewMode === 'transparent') {
      const processed = removeBackgroundFromFrame(frame.imageData, item.options);
      ctx.putImageData(processed, 0, 0);
    } else if (viewMode === 'split') {
      // Split view: Left half transparent, Right half original
      const processed = removeBackgroundFromFrame(frame.imageData, item.options);
      ctx.putImageData(processed, 0, 0);

      // Draw right half from original
      const halfWidth = Math.floor(width / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(halfWidth, 0, width - halfWidth, height);
      ctx.clip();
      ctx.putImageData(frame.imageData, 0, 0);

      // Dividing line
      ctx.restore();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(halfWidth, 0);
      ctx.lineTo(halfWidth, height);
      ctx.stroke();
    }
  }, [currentFrameIndex, decodedFrames, viewMode, item.options]);

  // Eyedropper click handler on canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive || !canvasRef.current || !decodedFrames.length) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const frame = decodedFrames[currentFrameIndex];
      if (frame) {
        const idx = (y * canvas.width + x) * 4;
        const r = frame.imageData.data[idx];
        const g = frame.imageData.data[idx + 1];
        const b = frame.imageData.data[idx + 2];
        const hex = rgbToHex(r, g, b);
        onUpdateOptions(item.id, {
          ...item.options,
          targetColor: hex,
        });
        setIsEyedropperActive(false);
        setHoverColor(null);
      }
    }
  };

  // Eyedropper hover preview
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive || !canvasRef.current || !decodedFrames.length) {
      if (hoverColor) setHoverColor(null);
      return;
    }
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const frame = decodedFrames[currentFrameIndex];
      if (frame) {
        const idx = (y * canvas.width + x) * 4;
        const r = frame.imageData.data[idx];
        const g = frame.imageData.data[idx + 1];
        const b = frame.imageData.data[idx + 2];
        setHoverColor(rgbToHex(r, g, b));
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getBgClass = () => {
    switch (previewBg) {
      case 'checker-dark':
        return 'bg-checker-dark';
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

  const handleDownloadSingle = () => {
    if (!item.result?.url) return;
    const a = document.createElement('a');
    a.href = item.result.url;
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}_transparent.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      id={`gif-card-${item.id}`}
      className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col hover:border-stone-300 transition-all"
    >
      {/* Card Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between gap-3 bg-stone-50/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              className="text-sm font-semibold text-stone-900 truncate"
              title={item.name}
            >
              {item.name}
            </h4>
            {item.status === 'done' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3 h-3" /> 已透明化
              </span>
            )}
            {item.status === 'processing' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin" /> 处理中 {item.progress}%
              </span>
            )}
            {item.status === 'error' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 shrink-0">
                <AlertCircle className="w-3 h-3" /> 失败
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
            <span>{item.width} × {item.height} px</span>
            <span>•</span>
            <span>{item.frameCount || decodedFrames.length} 帧</span>
            <span>•</span>
            <span>原大小: {formatBytes(item.originalSize)}</span>
            {item.result && (
              <>
                <span>→</span>
                <span className="font-semibold text-emerald-600">
                  新大小: {formatBytes(item.result.size)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDeleteItem(item.id)}
          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="移除此 GIF"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Processing Progress Bar if active */}
      {item.status === 'processing' && (
        <div className="w-full bg-stone-100 h-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-200"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}

      {/* Main Preview Container */}
      <div className="p-4 flex flex-col items-center">
        {/* Preview View Mode Tabs */}
        <div className="flex items-center justify-between w-full mb-3 text-xs">
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('transparent')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                viewMode === 'transparent'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              透明预览
            </button>
            <button
              type="button"
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                viewMode === 'original'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              原图
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                viewMode === 'split'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              对比模式
            </button>
          </div>

          {/* Eyedropper toggle */}
          <button
            type="button"
            onClick={() => setIsEyedropperActive(!isEyedropperActive)}
            className={`px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
              isEyedropperActive
                ? 'bg-amber-100 border-amber-300 text-amber-800 font-medium'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
            title="在画面中点击任意像素吸取背景色"
          >
            <Pipette className="w-3.5 h-3.5" />
            {isEyedropperActive ? '点击画面吸色' : '吸管取色'}
          </button>
        </div>

        {/* Canvas Display Stage */}
        <div
          className={`relative w-full aspect-square max-h-64 rounded-xl border border-stone-200 overflow-hidden flex items-center justify-center ${getBgClass()} ${
            isEyedropperActive ? 'cursor-crosshair' : ''
          }`}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            className="max-w-full max-h-full object-contain image-rendering-pixelated shadow-sm"
          />

          {/* Eyedropper hover loupe */}
          {isEyedropperActive && hoverColor && (
            <div className="absolute top-2 right-2 bg-stone-900/90 text-white text-[11px] px-2 py-1 rounded-md flex items-center gap-1.5 shadow-md pointer-events-none">
              <span
                className="w-3 h-3 rounded-full border border-white/50"
                style={{ backgroundColor: hoverColor }}
              />
              <span className="font-mono">{hoverColor}</span>
            </div>
          )}

          {/* Split View Badge Guide */}
          {viewMode === 'split' && (
            <div className="absolute bottom-2 inset-x-2 flex justify-between pointer-events-none text-[10px] font-semibold text-white px-2">
              <span className="bg-stone-900/75 px-1.5 py-0.5 rounded">左: 透明</span>
              <span className="bg-stone-900/75 px-1.5 py-0.5 rounded">右: 原图</span>
            </div>
          )}
        </div>

        {/* Frame Scrubber & Play/Pause */}
        {decodedFrames.length > 1 && (
          <div className="w-full mt-3 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>
            <span className="text-stone-400 font-mono text-[11px] w-12 shrink-0">
              {currentFrameIndex + 1}/{decodedFrames.length}
            </span>
            <input
              type="range"
              min="0"
              max={decodedFrames.length - 1}
              value={currentFrameIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentFrameIndex(parseInt(e.target.value, 10));
              }}
              className="w-full accent-indigo-600 h-1.5 bg-stone-200 rounded cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Tuning Controls */}
      <div className="p-4 border-t border-stone-100 bg-stone-50/40 space-y-3">
        {/* Target Color Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-stone-700">背景颜色:</label>
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
                className="w-7 h-7 rounded border border-stone-300 cursor-pointer p-0.5"
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
            className="w-full accent-indigo-600 h-1.5 bg-stone-200 rounded cursor-pointer"
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
              title="仅从四周外边缘向内消除背景，保护主体内部的相同颜色（如白眼球、白牙齿、高光）"
            >
              仅消除连通外边缘 (保护内部)
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-stone-400 hover:text-stone-700 flex items-center gap-0.5 text-[11px]"
          >
            {showAdvanced ? '收起' : '羽化去边'}
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
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
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
        <button
          id={`reprocess-btn-${item.id}`}
          type="button"
          disabled={item.status === 'processing'}
          onClick={() => onProcessItem(item.id)}
          className="flex-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-lg border border-indigo-200/60 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {item.status === 'processing' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {item.status === 'done' ? '重新导出' : '生成透明 GIF'}
        </button>

        <button
          id={`download-btn-${item.id}`}
          type="button"
          disabled={!item.result?.url}
          onClick={handleDownloadSingle}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          title="下载此透明 GIF"
        >
          <Download className="w-3.5 h-3.5" />
          下载
        </button>
      </div>
    </div>
  );
};
