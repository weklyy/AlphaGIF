import React, { useRef, useState, useEffect } from 'react';
import { Upload, Sparkles, Image as ImageIcon, CheckCircle2, MousePointerClick } from 'lucide-react';
import { generateDemo16GridImage } from '../../utils/imageGridSlicer';

interface GridImageUploaderProps {
  onImageLoaded: (file: File, url: string) => void;
  onVideoDropped?: (file: File, url: string) => void;
  disabled?: boolean;
}

export const GridImageUploader: React.FC<GridImageUploaderProps> = ({
  onImageLoaded,
  onVideoDropped,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length === 0) return;

    // Check if user dropped a video by mistake -> route to video slicer if supported
    const videoFile = files.find((f) =>
      f.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|avi)$/i.test(f.name)
    );
    if (videoFile && onVideoDropped) {
      const url = URL.createObjectURL(videoFile);
      onVideoDropped(videoFile, url);
      return;
    }

    const imgFile = files.find((f) =>
      f.type.startsWith('image/') ||
      /\.(png|jpg|jpeg|webp|bmp|svg|gif)$/i.test(f.name)
    );
    if (imgFile) {
      const url = URL.createObjectURL(imgFile);
      onImageLoaded(imgFile, url);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      onImageLoaded(file, url);
      e.target.value = '';
    }
  };

  // Clipboard paste support (supports pasting screenshots and copied images directly)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const url = URL.createObjectURL(file);
            onImageLoaded(file, url);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, onImageLoaded]);

  const handleLoadDemo = async () => {
    if (disabled || generatingDemo) return;
    setGeneratingDemo(true);
    try {
      const { file, url } = await generateDemo16GridImage();
      onImageLoaded(file, url);
    } catch (err) {
      console.error('Failed to generate demo static image', err);
    } finally {
      setGeneratingDemo(false);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-6 relative transition-all"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/*"
        className="hidden"
      />

      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center p-8 md:p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? 'border-[#07c160] bg-emerald-50/90 scale-[1.005] ring-4 ring-emerald-500/20'
            : 'border-stone-300 hover:border-[#07c160] hover:bg-stone-50/80 bg-stone-50/40'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {/* Active Drag Hover Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-2xl bg-[#07c160] text-white shadow-xl flex items-center justify-center mb-3 animate-bounce">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-emerald-900">
              松开鼠标即可载入多宫格大图
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              支持 PNG、JPG、JPEG、WebP、BMP 格式
            </p>
          </div>
        )}

        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-stone-200 flex items-center justify-center text-[#07c160] group-hover:scale-105 group-hover:border-emerald-200 transition-transform mb-3">
          <ImageIcon className="w-8 h-8" />
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-[#07c160] px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
            <span>支持 Midjourney / Stable Diffusion / DALL-E 多宫格静态拼图</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-full border border-stone-200">
            <MousePointerClick className="w-3 h-3 text-[#07c160]" />
            支持鼠标拖拽 / 点击按钮上传
          </span>
        </div>

        <h3 className="text-lg font-bold text-stone-900 mb-1.5 text-center">
          上传多宫格静态大图（PNG / JPG / WEBP）
        </h3>
        <p className="text-sm text-stone-500 text-center max-w-lg mb-4">
          支持点击下方按钮选择本地文件，或直接将图片拖拽至框内（亦支持 Ctrl+V 粘贴截图）
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-[#07c160] hover:bg-[#06ad56] text-white text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Upload className="w-4 h-4" />
            <span>选择本地静态图片</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadDemo();
            }}
            disabled={generatingDemo || disabled}
            className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold transition-all border border-stone-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{generatingDemo ? '正在生成示例大图...' : '一键载入 16 宫格示例图'}</span>
          </button>
        </div>
      </div>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-stone-100 text-xs text-stone-600">
        <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span><strong>自适应宫格</strong>：自由调整 16/15/9 宫格，拖拽裁切黑边</span>
        </div>
        <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span><strong>自动透明化</strong>：一键移除白底/绿幕，添加微信 2px 白描边</span>
        </div>
        <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span><strong>全套物料</strong>：同步生成横幅、封面、图标与赞赏引导图</span>
        </div>
      </div>
    </div>
  );
};
