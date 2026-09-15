import React, { useRef, useState } from 'react';
import { Upload, Sparkles, Video, Play, Film, AlertCircle } from 'lucide-react';
import { generateDemo16GridVideo } from '../../utils/videoGridSlicer';

interface GridVideoUploaderProps {
  onVideoLoaded: (file: File, url: string) => void;
  onImageDropped?: (file: File) => void;
  disabled?: boolean;
}

export const GridVideoUploader: React.FC<GridVideoUploaderProps> = ({
  onVideoLoaded,
  onImageDropped,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []) as File[];
    const videoFile = files.find((f) =>
      f.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|gif|avi)$/i.test(f.name)
    );
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      onVideoLoaded(videoFile, url);
      return;
    }

    // If user dropped a static image (PNG/JPG/WEBP), route to image slicer
    const imgFile = files.find((f) =>
      f.type.startsWith('image/') ||
      /\.(png|jpg|jpeg|webp|bmp)$/i.test(f.name)
    );
    if (imgFile && onImageDropped) {
      onImageDropped(imgFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/') && !file.type.includes('gif') && onImageDropped) {
        onImageDropped(file);
      } else {
        const url = URL.createObjectURL(file);
        onVideoLoaded(file, url);
      }
      e.target.value = '';
    }
  };

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
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/webm,video/quicktime,video/*,image/gif"
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center p-8 md:p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? 'border-[#07c160] bg-emerald-50/60 scale-[1.005]'
            : 'border-stone-300 hover:border-[#07c160] hover:bg-stone-50/80 bg-stone-50/40'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-stone-200 flex items-center justify-center text-[#07c160] group-hover:scale-105 group-hover:border-emerald-200 transition-transform mb-3">
          <Film className="w-8 h-8" />
        </div>

        <div className="mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-[#07c160] px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
            <span>支持 Midjourney / Runway / Sora 等 AI 多宫格视频</span>
          </span>
        </div>

        <h3 className="text-lg font-bold text-stone-900 mb-1.5 text-center">
          上传多宫格动态视频（MP4 / WebM / MOV）或动图
        </h3>
        <p className="text-sm text-stone-500 text-center max-w-lg mb-4">
          支持 16 宫格 (4×4)、15 宫格 (5×3)、9 宫格 (3×3)、20 宫格或自定义宫格，自动对齐逐帧切片
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#07c160] hover:bg-[#06ad56] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
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
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-xl border border-emerald-300 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            {generatingDemo ? '正在生成示例视频...' : '一键载入 16 宫格 AI 动画示例视频'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-center items-center gap-2 text-xs text-stone-400">
          <span>拖拽或点击上传</span>
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
