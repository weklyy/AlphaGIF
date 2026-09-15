import React, { useState } from 'react';
import {
  Play,
  Download,
  Trash2,
  Sliders,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { GifItem, RemovalOptions, PreviewBgMode } from '../types';

interface BatchControlsProps {
  items: GifItem[];
  isProcessingAny: boolean;
  onProcessAll: () => void;
  onDownloadAllZip: () => void;
  onClearAll: () => void;
  onApplyGlobalOptions: (options: RemovalOptions) => void;
  previewBg: PreviewBgMode;
  onPreviewBgChange: (mode: PreviewBgMode) => void;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  items,
  isProcessingAny,
  onProcessAll,
  onDownloadAllZip,
  onClearAll,
  onApplyGlobalOptions,
  previewBg,
  onPreviewBgChange,
}) => {
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [globalOptions, setGlobalOptions] = useState<RemovalOptions>({
    targetColor: '#ffffff',
    tolerance: 15,
    contiguous: true,
    defringe: 1,
  });

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const processingCount = items.filter((i) => i.status === 'processing').length;
  const pendingCount = items.filter((i) => i.status === 'idle').length;

  const handleApplyToAll = () => {
    onApplyGlobalOptions(globalOptions);
  };

  const presetColors = [
    { label: '纯白背景', color: '#ffffff' },
    { label: '纯黑背景', color: '#000000' },
    { label: '绿幕扣色', color: '#00ff00' },
    { label: '蓝幕扣色', color: '#0000ff' },
  ];

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Statistics & Status */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-stone-900">
            批量队列 ({totalCount})
          </span>
          <div className="flex items-center gap-2 text-xs">
            {doneCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                已完成: {doneCount}
              </span>
            )}
            {processingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                处理中: {processingCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                待处理: {pendingCount}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Global Settings */}
          <button
            id="toggle-global-settings-btn"
            type="button"
            onClick={() => setShowGlobalSettings(!showGlobalSettings)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              showGlobalSettings
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            统一参数配置
          </button>

          {/* Process All */}
          <button
            id="batch-process-all-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={onProcessAll}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isProcessingAny ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            批量转换全部
          </button>

          {/* Download All as ZIP */}
          <button
            id="batch-download-zip-btn"
            type="button"
            disabled={doneCount === 0}
            onClick={onDownloadAllZip}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            打包下载全部 ZIP ({doneCount})
          </button>

          {/* Clear All */}
          <button
            id="clear-all-queue-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={onClearAll}
            className="px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-stone-200 transition-colors disabled:opacity-40"
            title="清空当前队列"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Background preview mode switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-stone-400" />
          <span>预览底衬效果：</span>
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => onPreviewBgChange('checker')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'checker'
                  ? 'bg-white shadow-xs text-stone-900 font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded bg-checker border border-stone-300 inline-block" />
              明亮棋盘
            </button>
            <button
              type="button"
              onClick={() => onPreviewBgChange('checker-dark')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'checker-dark'
                  ? 'bg-white shadow-xs text-stone-900 font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded bg-checker-dark border border-stone-600 inline-block" />
              暗色棋盘
            </button>
            <button
              type="button"
              onClick={() => onPreviewBgChange('white')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'white'
                  ? 'bg-white shadow-xs text-stone-900 font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded bg-white border border-stone-300 inline-block" />
              纯白
            </button>
            <button
              type="button"
              onClick={() => onPreviewBgChange('dark')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'dark'
                  ? 'bg-white shadow-xs text-stone-900 font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded bg-stone-900 inline-block" />
              纯黑
            </button>
            <button
              type="button"
              onClick={() => onPreviewBgChange('neon')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'neon'
                  ? 'bg-white shadow-xs text-stone-900 font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="亮色用于检查是否有残留杂边"
            >
              <span className="w-2.5 h-2.5 rounded bg-[#ec4899] inline-block" />
              高亮粉
            </button>
          </div>
        </div>

        <span className="text-[11px] text-stone-400">
          每个卡片内可单独针对某张 GIF 独立调节容差、颜色与微调
        </span>
      </div>

      {/* Expandable Global Settings Box */}
      {showGlobalSettings && (
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              统一设定参数（可一键同步给全部 GIF）
            </span>
            <button
              type="button"
              onClick={handleApplyToAll}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors shadow-xs"
            >
              应用到全部 {totalCount} 个 GIF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Color */}
            <div>
              <label className="block text-stone-600 font-medium mb-1.5">
                目标背景颜色
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={globalOptions.targetColor}
                  onChange={(e) =>
                    setGlobalOptions({ ...globalOptions, targetColor: e.target.value })
                  }
                  className="w-8 h-8 rounded border border-stone-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={globalOptions.targetColor}
                  onChange={(e) =>
                    setGlobalOptions({ ...globalOptions, targetColor: e.target.value })
                  }
                  className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-mono uppercase"
                />
                <div className="flex items-center gap-1">
                  {presetColors.map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() =>
                        setGlobalOptions({ ...globalOptions, targetColor: p.color })
                      }
                      className="w-5 h-5 rounded border border-stone-300 shadow-xs"
                      style={{ backgroundColor: p.color }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Tolerance */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-stone-600 font-medium">
                  容差阈值: {globalOptions.tolerance}%
                </label>
                <span className="text-stone-400 text-[11px]">
                  {globalOptions.tolerance < 10
                    ? '严格匹配'
                    : globalOptions.tolerance > 30
                    ? '宽松匹配'
                    : '标准推荐'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={globalOptions.tolerance}
                onChange={(e) =>
                  setGlobalOptions({
                    ...globalOptions,
                    tolerance: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-indigo-600 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Mode & Defringe */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={globalOptions.contiguous}
                  onChange={(e) =>
                    setGlobalOptions({
                      ...globalOptions,
                      contiguous: e.target.checked,
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-stone-700 font-medium">
                  边缘向内扩散 (保护主体内部相同颜色)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-stone-600">边缘去杂色 (羽化):</span>
                {[0, 1, 2].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() =>
                      setGlobalOptions({ ...globalOptions, defringe: lvl })
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      globalOptions.defringe === lvl
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'bg-white border-stone-200 text-stone-600'
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
  );
};
