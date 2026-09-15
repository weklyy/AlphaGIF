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
import { decodeGif, processGifItem } from './utils/gifProcessor';
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

      // Default temporary item
      const item: GifItem = {
        id,
        name: file.name,
        file,
        originalUrl: url,
        originalSize: file.size,
        width: 0,
        height: 0,
        frameCount: 0,
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
        const buffer = await item.file.arrayBuffer();
        const decoded = await decodeGif(buffer);
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
        console.error('Failed to parse GIF metadata for', item.name, err);
      }
    }
  }, []);

  // Update options for a specific GIF
  const handleUpdateOptions = useCallback((id: string, options: RemovalOptions) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, options } : item))
    );
  }, []);

  // Process a single GIF item
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
      const result = await processGifItem(
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
      console.error('Failed to process GIF:', err);
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
      // Process each item
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
        const result = await processGifItem(
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
    showNotification('全部 GIF 批量转换已完成！');
  };

  // Download all completed GIFs as a single ZIP archive
  const handleDownloadAllZip = async () => {
    const completedItems = items.filter((i) => i.status === 'done' && i.result?.blob);
    if (completedItems.length === 0) return;

    showNotification('正在打包生成 ZIP 压缩包...');
    const zip = new JSZip();

    for (let index = 0; index < completedItems.length; index++) {
      const item = completedItems[index];
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_transparent.gif`;
      if (item.result?.blob) {
        zip.file(fileName, item.result.blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `transparent_gifs_${Date.now()}.zip`;
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
    showNotification('已成功将参数同步应用至全部 GIF');
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
                批量 GIF 背景透明化工具
              </h1>
              <p className="text-xs text-stone-500">
                Batch GIF Background Remover • 纯本地离线处理 • 智能识色扣除
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-stone-500">
            <div className="hidden sm:flex items-center gap-1.5 text-stone-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>本地极速处理，动图不上传任何服务器</span>
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

            {/* Grid of GIF Cards */}
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
                智能边缘与四周背景识别
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                自动采样动图四个边角与边界像素，智能推测底色（如纯白、纯黑或绿幕），无需手动逐个填写色值。
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
                仅从动图外边缘向内消除背景，完美保护角色主体内部的高光、白色眼珠、白色服饰，避免空洞破损。
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
                可一次性上传几十个 GIF 动图，统一调参或单独微调，处理完成后一键打包生成 ZIP 压缩包下载到本地。
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-stone-200 bg-white text-center text-xs text-stone-400">
        <p>
          Batch GIF Background Remover • 批量 GIF 背景透明化转换器 • 遵循标准 GIF89a 规范与透明通道编码
        </p>
      </footer>
    </div>
  );
}
