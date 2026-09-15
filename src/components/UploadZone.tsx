import React, { useRef, useState, useEffect } from 'react';
import { Upload, Sparkles, Image as ImageIcon, Plus } from 'lucide-react';
import {
  generateWhiteBgDemoGif,
  generateBlackBgDemoGif,
  generateGreenScreenDemoGif,
} from '../utils/demoGifs';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const rawFiles = Array.from(e.dataTransfer.files || []) as File[];
    const files = rawFiles.filter(
      (file: File) => file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawFiles = Array.from(e.target.files) as File[];
      const files = rawFiles.filter(
        (file: File) => file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
      );
      if (files.length > 0) {
        onFilesSelected(files);
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
      const gifFiles: File[] = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type === 'image/gif') {
          const file = item.getAsFile();
          if (file) gifFiles.push(file);
        }
      }
      if (gifFiles.length > 0) {
        onFilesSelected(gifFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, onFilesSelected]);

  const loadDemoGifs = async (type: 'all' | 'white' | 'black' | 'green') => {
    setLoadingDemo(true);
    try {
      const files: File[] = [];
      if (type === 'all' || type === 'white') {
        files.push(await generateWhiteBgDemoGif());
      }
      if (type === 'all' || type === 'black') {
        files.push(await generateBlackBgDemoGif());
      }
      if (type === 'all' || type === 'green') {
        files.push(await generateGreenScreenDemoGif());
      }
      onFilesSelected(files);
    } catch (err) {
      console.error('Failed to generate demo GIFs:', err);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden p-6 transition-all">
      <input
        id="gif-file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".gif,image/gif"
        multiple
        className="hidden"
      />

      <div
        id="drop-zone-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center p-8 md:p-12 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/70 scale-[1.005]'
            : 'border-stone-300 hover:border-indigo-500 hover:bg-stone-50/80 bg-stone-50/40'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-stone-200 flex items-center justify-center text-indigo-600 group-hover:scale-105 group-hover:border-indigo-200 transition-transform mb-4">
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-semibold text-stone-900 mb-1.5 text-center">
          点击选择或将 GIF 动图拖放到此处
        </h3>
        <p className="text-sm text-stone-500 text-center max-w-md mb-4">
          支持批量上传多个 GIF 文件，浏览器本地高性能纯离线处理，保护隐私且极速
        </p>

        <div className="flex items-center gap-2">
          <button
            id="select-files-btn"
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Plus className="w-4 h-4" />
            选择 GIF 文件 (可多选)
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
          <span>支持 Ctrl+V 直接粘贴剪贴板动图</span>
          <span>•</span>
          <span>不限文件大小与帧数</span>
        </div>
      </div>

      {/* Preset Demo GIFs */}
      <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>没有准备好的 GIF？点击快速载入内置示例体验：</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="demo-all-btn"
            type="button"
            disabled={loadingDemo || disabled}
            onClick={() => loadDemoGifs('all')}
            className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200/60 transition-colors disabled:opacity-50"
          >
            {loadingDemo ? '生成中...' : '载入全部示例 (3个)'}
          </button>
          <button
            id="demo-white-btn"
            type="button"
            disabled={loadingDemo || disabled}
            onClick={() => loadDemoGifs('white')}
            className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white border border-stone-300 inline-block" />
            白底星星
          </button>
          <button
            id="demo-black-btn"
            type="button"
            disabled={loadingDemo || disabled}
            onClick={() => loadDemoGifs('black')}
            className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-black inline-block" />
            黑底金币
          </button>
          <button
            id="demo-green-btn"
            type="button"
            disabled={loadingDemo || disabled}
            onClick={() => loadDemoGifs('green')}
            className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff00] border border-stone-300 inline-block" />
            绿幕火箭
          </button>
        </div>
      </div>
    </div>
  );
};
