import React, { useRef, useState, useEffect } from 'react';
import { Upload, Sparkles, Video, Play, Film, AlertCircle, MousePointerClick } from 'lucide-react';
import { generateDemo16GridVideo } from '../../utils/videoGridSlicer';

interface GridVideoUploaderProps {
  onVideoLoaded: (file: File, url: string) => void;
  onImageDropped?: (file: File, url: string) => void;
  disabled?: boolean;
}

export const GridVideoUploader: React.FC<GridVideoUploaderProps> = ({
  onVideoLoaded,
  onImageDropped,
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

    const videoFile = files.find((f) =>
      f.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|gif|avi|mkv)$/i.test(f.name)
    );
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      onVideoLoaded(videoFile, url);
      return;
    }

    // If user dropped a static image (PNG/JPG/WEBP), route to image slicer
    const imgFile = files.find((f) =>
      f.type.startsWith('image/') ||
      /\.(png|jpg|jpeg|webp|bmp|svg)$/i.test(f.name)
    );
    if (imgFile && onImageDropped) {
      const url = URL.createObjectURL(imgFile);
      onImageDropped(imgFile, url);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/') && !file.type.includes('gif') && onImageDropped) {
        const url = URL.createObjectURL(file);
        onImageDropped(file, url);
      } else {
        const url = URL.createObjectURL(file);
        onVideoLoaded(file, url);
      }
      e.target.value = '';
    }
  };

  // Clipboard paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (!file) continue;
          if (file.type.startsWith('video/') || /\.(mp4|webm|mov|gif)$/i.test(file.name)) {
            const url = URL.createObjectURL(file);
            onVideoLoaded(file, url);
            return;
          }
          if (file.type.startsWith('image/') && onImageDropped) {
            const url = URL.createObjectURL(file);
            onImageDropped(file, url);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, onVideoLoaded, onImageDropped]);

  const handleLoadDemo = async () => {
    if (disabled || generatingDemo) return;
    setGeneratingDemo(true);
    try {
      const { file } = await generateDemo16GridVideo();
      const url = URL.createObjectURL(file);
      onVideoLoaded(file, url);
    } catch (err) {
      console.error('Failed to generate demo video', err);
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
        accept="video/mp4,video/webm,video/quicktime,video/*,image/gif"
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
              松开鼠标即可载入视频或动图
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              支持 MP4、WebM、MOV、GIF 格式
            </p>
          </div>
        )}

        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-stone-200 flex items-center justify-center text-[#07c160] group-hover:scale-105 group-hover:border-emerald-200 transition-transform mb-3">
          <Film className="w-8 h-8" />
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-[#07c160] px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
            <span>支持 Midjourney / Runway / Sora / 各种 AI 多宫格视频</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-full border border-stone-200">
            <MousePointerClick className="w-3 h-3 text-[#07c160]" />
            支持鼠标拖拽 / 点击按钮上传
          </span>
        </div>

        <h3 className="text-lg font-bold text-stone-900 mb-1.5 text-center">
          上传多宫格动态视频（MP4 / WebM / MOV）或动图
        </h3>
        <p className="text-sm text-stone-500 text-center max-w-lg mb-4">
          支持点击下方按钮选择文件，或直接将视频/动图拖拽至框内
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#07c160] hover:bg-[#06ad56] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Upload className="w-4 h-4" />
            选择本地视频文件
          </button>

          <button
            type="button"
            disabled={generatingDemo || disabled}
            onClick={(e) => {
              e.stopPropagation();
              handleLoadDemo();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-xl border border-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            {generatingDemo ? '正在生成示例视频...' : '一键载入 16 宫格 AI 动画示例视频'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-center items-center gap-2 text-xs text-stone-400">
          <span className="text-[#07c160] font-medium">支持鼠标将文件直接拖入此框</span>
          <span>•</span>
          <span>自动切出 240×240 微信标准 GIF</span>
          <span>•</span>
          <span>自动压缩至 500KB 微信红线内</span>
          <span>•</span>
          <span>自动生成全套 5 张官方审核物料</span>
        </div>
      </div>
    </div>
  );
};
