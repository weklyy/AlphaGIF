import React, { useState, useEffect } from 'react';
import { X, Download, Printer, Check, Image as ImageIcon } from 'lucide-react';
import {
  PRINT_LAYOUT_PRESETS,
  PrintLayoutPreset,
  generate6InchPrintSheet,
} from '../../utils/idPhotoPresets';

interface PrintLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  idPhotoCanvas: HTMLCanvasElement | null;
  oneInchCanvas?: HTMLCanvasElement | null;
  twoInchCanvas?: HTMLCanvasElement | null;
  currentPresetName: string;
}

export const PrintLayoutModal: React.FC<PrintLayoutModalProps> = ({
  isOpen,
  onClose,
  idPhotoCanvas,
  oneInchCanvas,
  twoInchCanvas,
  currentPresetName,
}) => {
  const [selectedLayout, setSelectedLayout] = useState<'8-1inch' | '4-2inch' | 'mixed-1-and-2'>('8-1inch');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!isOpen || !idPhotoCanvas) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }

    generateSheet();
  }, [isOpen, selectedLayout, idPhotoCanvas]);

  const generateSheet = async () => {
    if (!idPhotoCanvas) return;
    setIsGenerating(true);
    try {
      const res = await generate6InchPrintSheet(
        idPhotoCanvas,
        selectedLayout,
        oneInchCanvas || undefined,
        twoInchCanvas || undefined
      );
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(res.url);
      setDownloadBlob(res.blob);
    } catch (err) {
      console.error('Failed to generate print layout:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!downloadBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(downloadBlob);
    a.download = `6寸排版冲印照_${selectedLayout}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Printer className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                6 寸照相馆标准排版冲印照生成 (4R / 102×152mm)
              </h3>
              <p className="text-[11px] text-stone-500">
                符合照相馆 300DPI 高清冲印规格，自带十字与虚线裁切辅助标，洗印后剪开即用
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-stone-100/60">
          {/* Layout Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRINT_LAYOUT_PRESETS.map((p) => {
              const active = selectedLayout === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedLayout(p.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-stone-900">{p.name}</span>
                    {active && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">{p.description}</p>
                </button>
              );
            })}
          </div>

          {/* Preview Sheet Area */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col items-center justify-center min-h-[360px]">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2 text-stone-500 text-xs py-16">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span>正在高保真排版并绘制 300 DPI 裁切标记...</span>
              </div>
            ) : previewUrl ? (
              <div className="relative max-w-full overflow-hidden rounded-lg shadow-md border border-stone-300 bg-white">
                <img
                  src={previewUrl}
                  alt="6寸排版预览"
                  className="max-h-[50vh] w-auto object-contain"
                />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono bg-black/60 text-white/90">
                  1795 × 1205 px • 300 DPI
                </span>
              </div>
            ) : (
              <div className="text-stone-400 text-xs py-16">暂无排版数据</div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-white border-t border-stone-200 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>当前排版源：{currentPresetName}，推荐送至彩印店直接冲印 6 寸（4R）相纸</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!downloadBlob || isGenerating}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>下载 6 寸高清冲印排版图 (JPG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
