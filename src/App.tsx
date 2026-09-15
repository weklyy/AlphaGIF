/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Sparkles,
  Layers,
  Download,
  Upload,
  CheckCircle2,
  FileImage,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { GifItem, RemovalOptions, PreviewBgMode } from './types';
import {
  decodeMediaFile,
  processMediaItem,
  isGifFile,
} from './utils/gifProcessor';
import { UploadZone } from './components/UploadZone';
import { BatchControls } from './components/BatchControls';
import { GifCard } from './components/GifCard';

export default function App() {
  const [items, setItems] = useState<GifItem[]>([]);
  const [previewBg, setPreviewBg] = useState<PreviewBgMode>('checker');
  const [isProcessingAny, setIsProcessingAny] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setGlobalNotification(msg);
    setTimeout(() => {
      setGlobalNotification((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Handle newly selected files
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newItems: GifItem[] = [];

    for (const file of files) {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const url = URL.createObjectURL(file);
      const isGif = isGifFile(file);

      // Default temporary item
      const item: GifItem = {
        id,
        name: file.name,
        file,
        mediaType: isGif ? 'gif' : 'image',
        originalUrl: url,
        originalSize: file.size,
        width: 0,
        height: 0,
        frameCount: isGif ? 0 : 1,
        detectedBgColor: '#ffffff',
        options: {
          targetColor: '#ffffff',
          tolerance: 15,
          contiguous: true,
          defringe: 1,
        },
        status: 'idle',
        progress: 0,
      };

      newItems.push(item);
    }

    setItems((prev) => [...prev, ...newItems]);

    // Inspect metadata for each item in background
    for (const item of newItems) {
      try {
        const decoded = await decodeMediaFile(item.file);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  width: decoded.width,
                  height: decoded.height,
                  frameCount: decoded.frames.length,
                  detectedBgColor: decoded.detectedBgColor,
                  options: {
                    ...i.options,
                    targetColor: decoded.detectedBgColor || '#ffffff',
                  },
                }
              : i
          )
        );
      } catch (err) {
        console.error('Failed to parse media metadata for', item.name, err);
      }
    }
  }, []);

  // Update options for a specific item
  const handleUpdateOptions = useCallback((id: string, options: RemovalOptions) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, options } : item))
    );
  }, []);

  // Process a single item
  const handleProcessItem = useCallback(async (id: string) => {
    const currentItem = items.find((i) => i.id === id);
    if (!currentItem) return;

    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'processing',
              progress: 10,
              statusMessage: '准备中...',
              errorMessage: undefined,
            }
          : i
      )
    );

    try {
      const result = await processMediaItem(
        currentItem.file,
        currentItem.options,
        (progress, message) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === id ? { ...i, progress, statusMessage: message } : i
            )
          );
        }
      );

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'done',
                progress: 100,
                statusMessage: '完成',
                result,
              }
            : i
        )
      );
    } catch (err: any) {
      console.error('Failed to process media:', err);
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'error',
                errorMessage: err.message || '处理失败',
              }
            : i
        )
      );
    }
  }, [items]);

  // Batch process all pending or current items
  const handleProcessAll = async () => {
    if (items.length === 0 || isProcessingAny) return;
    setIsProcessingAny(true);

    const pendingOrAll = items;
    for (const item of pendingOrAll) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'processing',
                progress: 10,
                statusMessage: '正在处理...',
              }
            : i
        )
      );

      try {
        const result = await processMediaItem(
          item.file,
          item.options,
          (progress, message) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, progress, statusMessage: message }
                  : i
              )
            );
          }
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'done',
                  progress: 100,
                  statusMessage: '完成',
                  result,
                }
              : i
          )
        );
      } catch (err: any) {
        console.error('Failed to process item in batch:', item.name, err);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: err.message || '处理失败',
                }
              : i
          )
        );
      }
    }

    setIsProcessingAny(false);
    showNotification('批量透明化转换已全部完成！');
  };

  // Download all completed items as a single ZIP archive
  const handleDownloadAllZip = async () => {
    const completedItems = items.filter((i) => i.status === 'done' && i.result?.blob);
    if (completedItems.length === 0) return;

    showNotification('正在打包生成 ZIP 压缩包...');
    const zip = new JSZip();

    for (let index = 0; index < completedItems.length; index++) {
      const item = completedItems[index];
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const isGif = item.result?.format === 'gif' || (item.result?.format === undefined && item.mediaType === 'gif');
      const ext = isGif ? 'gif' : 'png';
      const fileName = `${baseName}_T.${ext}`;
      if (item.result?.blob) {
        zip.file(fileName, item.result.blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `images_T_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  // Clear all items
  const handleClearAll = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.originalUrl);
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    });
    setItems([]);
  };

  // Delete single item
  const handleDeleteItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.result?.url) URL.revokeObjectURL(target.result.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // Apply options to all items in queue
  const handleApplyGlobalOptions = (options: RemovalOptions) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        options: { ...options },
      }))
    );
    showNotification('已成功将参数同步应用至全部图片/动图');
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {globalNotification && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-stone-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{globalNotification}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-tight">
                批量 GIF & 图片背景透明化工具
              </h1>
              <p className="text-xs text-stone-500">
                Batch GIF & Image Background Remover • 纯本地离线处理 • 智能抠除背景
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-stone-500">
            <div className="hidden sm:flex items-center gap-1.5 text-stone-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>本地极速处理，图片不上传任何服务器</span>
            </div>
            {items.length > 0 && (
              <span className="bg-stone-100 text-stone-700 font-semibold px-2.5 py-1 rounded-full border border-stone-200">
                已载入 {items.length} 个文件
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Upload Zone */}
        <UploadZone
          onFilesSelected={handleFilesSelected}
          disabled={isProcessingAny}
        />

        {/* If items exist: Batch Controls + Grid of GIF cards */}
        {items.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Batch Control Action Bar */}
            <BatchControls
              items={items}
              isProcessingAny={isProcessingAny}
              onProcessAll={handleProcessAll}
              onDownloadAllZip={handleDownloadAllZip}
              onClearAll={handleClearAll}
              onApplyGlobalOptions={handleApplyGlobalOptions}
              previewBg={previewBg}
              onPreviewBgChange={setPreviewBg}
            />

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <GifCard
                  key={item.id}
                  item={item}
                  previewBg={previewBg}
                  onUpdateOptions={handleUpdateOptions}
                  onProcessItem={handleProcessItem}
                  onDeleteItem={handleDeleteItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Feature Highlights / FAQ Card when empty */}
        {items.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-stone-900 mb-1">
                全格式支持与智能背景识别
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                完美支持 GIF 动图以及 PNG、JPG、JPEG、WebP、BMP 普通静态图片。自动采样四个边角与边界像素，智能推测底色。
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-stone-900 mb-1">
                边缘连通泛洪消除算法
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                仅从画面外边缘向内消除背景，完美保护角色主体内部的高光、白色眼珠、白色服饰，避免空洞破损。
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <Download className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-stone-900 mb-1">
                批量导出与打包下载 ZIP
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                动图导出透明 GIF，静态图片导出高清透明 PNG。可一次性批量转换并一键打包为 ZIP 压缩包下载到本地。
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-stone-200 bg-white text-center text-xs text-stone-400">
        <p>
          Batch GIF & Image Background Remover • 批量 GIF & 图片背景透明化工具 • 本地高性能纯离线处理
        </p>
      </footer>
    </div>
  );
}
