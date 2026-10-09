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
  Smile,
  MessageSquare,
  Type,
  ShieldAlert,
  Zap,
  AlertTriangle,
  Scale,
  Gauge,
  Columns,
  LayoutGrid,
  Scaling,
  Maximize2,
  ArrowRight,
  Settings2,
} from 'lucide-react';
import {
  GifItem,
  RemovalOptions,
  PreviewBgMode,
  WeChatStickerOptions,
  CompressionOptions,
  CompressionPreset,
  ArbitrarySizeOptions,
} from '../types';
import { COMPRESSION_PRESETS } from '../utils/gifProcessor';

interface BatchControlsProps {
  items: GifItem[];
  isProcessingAny: boolean;
  onProcessAll: (asWeChat?: boolean) => void;
  onDownloadAllZip: (onlyWeChat?: boolean) => void;
  onClearAll: () => void;
  onApplyGlobalOptions: (options: RemovalOptions) => void;
  previewBg: PreviewBgMode;
  onPreviewBgChange: (mode: PreviewBgMode) => void;
  onCompressAll?: () => void;
  onCompressOversized?: () => void;
  cardLayout?: 'split' | 'grid';
  onCardLayoutChange?: (layout: 'split' | 'grid') => void;
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
  onCompressAll,
  onCompressOversized,
  cardLayout = 'split',
  onCardLayoutChange,
}) => {
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'removal' | 'size' | 'wechat' | 'compression'>('removal');

  const [globalOptions, setGlobalOptions] = useState<RemovalOptions>({
    enableRemoval: true,
    targetColor: '#ffffff',
    tolerance: 15,
    contiguous: true,
    defringe: 1,
    edgeBarrier: true,
    edgeThreshold: 20,
    protectTorsoBottom: true,
    removeFrameBorder: false,
    frameBorderMode: 'auto',
    frameBorderColor: '#000000',
    frameBorderTolerance: 35,
    frameBorderWidth: 3,
    frameBorderInset: 2,
    frameBorderAutoScale: true,
    sizeConfig: {
      enabled: false,
      mode: 'original',
      scalePercent: 100,
      customWidth: 512,
      customHeight: 512,
      lockAspectRatio: true,
      fitMode: 'contain',
    },
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
    },
    compression: {
      enabled: true,
      preset: 'wechat-auto',
      targetSizeKb: 1000,
      maxColors: 256,
      scaleRatio: 1.0,
      frameStep: 1,
      autoCompressUnderLimit: true,
    },
  });

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const wechatDoneCount = items.filter(
    (i) => i.status === 'done' && i.result?.isWeChatSticker
  ).length;
  const processingCount = items.filter((i) => i.status === 'processing').length;
  const pendingCount = items.filter((i) => i.status === 'idle').length;

  // Check how many completed items violate WeChat upload limits (>1MB for GIF, >500KB for PNG)
  const oversizedItems = items.filter((i) => {
    if (i.status !== 'done' || !i.result) return false;
    const isGif = i.result.format === 'gif' || i.mediaType === 'gif';
    const limit = isGif ? 1024 * 1024 : 512 * 1024;
    return i.result.size > limit;
  });

  const handleApplyToAll = () => {
    onApplyGlobalOptions(globalOptions);
  };

  const presetColors = [
    { label: '纯白背景', color: '#ffffff' },
    { label: '纯黑背景', color: '#000000' },
    { label: '绿幕扣色', color: '#00ff00' },
    { label: '蓝幕扣色', color: '#0000ff' },
  ];

  const quickCaptions = ['收到', '好的', '哈哈', '点赞', '谢谢老板', '告辞', '哭死', '无语'];

  const updateSizeConfigOption = <K extends keyof ArbitrarySizeOptions>(
    key: K,
    value: ArbitrarySizeOptions[K]
  ) => {
    setGlobalOptions((prev) => ({
      ...prev,
      sizeConfig: {
        enabled: true,
        mode: 'custom',
        scalePercent: 100,
        customWidth: 512,
        customHeight: 512,
        lockAspectRatio: true,
        fitMode: 'contain',
        ...prev.sizeConfig,
        [key]: value,
      },
    }));
  };

  const updateWeChatOption = <K extends keyof WeChatStickerOptions>(
    key: K,
    value: WeChatStickerOptions[K]
  ) => {
    setGlobalOptions((prev) => ({
      ...prev,
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
        ...prev.wechat,
        [key]: value,
      },
    }));
  };

  const updateCompressionOption = <K extends keyof CompressionOptions>(
    key: K,
    value: CompressionOptions[K]
  ) => {
    setGlobalOptions((prev) => ({
      ...prev,
      compression: {
        enabled: true,
        preset: 'wechat-auto',
        targetSizeKb: 1000,
        maxColors: 256,
        scaleRatio: 1.0,
        frameStep: 1,
        autoCompressUnderLimit: true,
        ...prev.compression,
        [key]: value,
      },
    }));
  };

  const handleSelectPreset = (preset: CompressionPreset) => {
    if (preset === 'original') {
      setGlobalOptions((prev) => ({
        ...prev,
        compression: {
          enabled: false,
          preset: 'original',
          targetSizeKb: 5000,
          maxColors: 256,
          scaleRatio: 1.0,
          frameStep: 1,
          autoCompressUnderLimit: false,
        },
      }));
      return;
    }
    const found = COMPRESSION_PRESETS.find((p) => p.id === preset);
    if (found) {
      setGlobalOptions((prev) => ({
        ...prev,
        compression: {
          enabled: true,
          preset,
          targetSizeKb: found.targetSizeKb,
          maxColors: found.maxColors,
          scaleRatio: found.scaleRatio,
          frameStep: found.frameStep,
          autoCompressUnderLimit: found.autoCompressUnderLimit,
        },
      }));
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Statistics & Status */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-stone-900">
              处理队列 ({totalCount})
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-[#07c160] px-2 py-0.5 rounded-full border border-emerald-200">
              <Smile className="w-3.5 h-3.5" />
              微信表情包专区已就绪
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {doneCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                已生成: {doneCount}
                {wechatDoneCount > 0 && ` (微信表情: ${wechatDoneCount})`}
              </span>
            )}
            {processingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                正在处理: {processingCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                待处理: {pendingCount}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle WeChat / Global Settings */}
          <button
            id="toggle-global-settings-btn"
            type="button"
            onClick={() => setShowGlobalSettings(!showGlobalSettings)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showGlobalSettings
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs ring-1 ring-emerald-300'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>参数配置 & 协同流水线</span>
            <span className="text-[10px] px-1 py-0.2 bg-stone-100 text-stone-500 rounded font-mono">
              “和”生效
            </span>
          </button>

          {/* Batch Process with Current Combined Options (AND relationship) - PRIMARY BUTTON */}
          <button
            id="batch-process-all-pipeline-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => {
              onApplyGlobalOptions(globalOptions);
              onProcessAll(undefined);
            }}
            className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] cursor-pointer"
            title="按当前全部勾选的设置标签（抠图 + 任意尺寸 + 微信规范 + 体积压缩）批量执行协同生成"
          >
            {isProcessingAny ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>按当前设置批量生成/导出</span>
          </button>

          {/* WeChat Sticker Batch Generation Button (HIGH VISIBILITY) */}
          <button
            id="batch-generate-wechat-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => {
              const wechatOpts: RemovalOptions = {
                ...globalOptions,
                enableRemoval: true,
                wechat: {
                  ...globalOptions.wechat,
                  enabled: true,
                  standardSize: '240',
                  addWhiteOutline: true,
                },
                compression: {
                  ...globalOptions.compression,
                  enabled: true,
                  preset: 'wechat-auto',
                  targetSizeKb: 1000,
                  autoCompressUnderLimit: true,
                },
              };
              onApplyGlobalOptions(wechatOpts);
              onProcessAll(true);
            }}
            className="px-3.5 py-1.5 bg-[#07c160] hover:bg-[#06ad56] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] cursor-pointer"
            title="一键将队列中全部图片/动图按微信规范（240x240/白色描边/智能压缩<1MB）生成微信表情包"
          >
            <Smile className="w-3.5 h-3.5" />
            <span>一键生成微信标准表情包</span>
          </button>

          {/* Arbitrary Size Export Shortcut */}
          <button
            id="batch-arbitrary-size-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => {
              setShowGlobalSettings(true);
              setSettingsTab('size');
            }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            title="自定义任意尺寸规格（512×512、1080×1080、等比缩放、自定义像素）"
          >
            <Scaling className="w-3.5 h-3.5" />
            <span>自定任意尺寸</span>
          </button>

          {/* Batch Compress to WeChat Limit */}
          <button
            id="batch-compress-all-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => {
              if (onCompressAll) {
                onCompressAll();
              } else {
                onProcessAll(true);
              }
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            title="应用智能压缩设置，针对超大文件自动降采样或缩放，确保体积完全符合微信平台上传限制"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>智能达标压缩</span>
          </button>

          {/* Standard Process All Button */}
          <button
            id="batch-process-all-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => onProcessAll(false)}
            className="px-3 py-1.5 bg-stone-700 hover:bg-stone-800 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            title="仅抠除背景，保留原始尺寸"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>常规去底</span>
          </button>

          {/* Download All as ZIP */}
          <button
            id="batch-download-zip-btn"
            type="button"
            disabled={doneCount === 0}
            onClick={() => onDownloadAllZip()}
            className="px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            title="下载所有处理好的文件打包 ZIP (支持动态 GIF 及任意格式尺寸)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>打包下载全部 ZIP ({doneCount})</span>
          </button>

          {/* Card Layout Switcher: 左右分栏对照 vs 紧凑网格 */}
          {onCardLayoutChange && (
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => onCardLayoutChange('split')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  cardLayout === 'split'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="左右分栏对照模式：左侧实时看图，右侧调参，无需上下滚动"
              >
                <Columns className="w-3.5 h-3.5 text-indigo-600" />
                <span>左右对照</span>
              </button>
              <button
                type="button"
                onClick={() => onCardLayoutChange('grid')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  cardLayout === 'grid'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="紧凑多列网格模式"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-stone-600" />
                <span>网格</span>
              </button>
            </div>
          )}

          {/* Clear All */}
          <button
            id="clear-all-queue-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={onClearAll}
            className="p-1.5 text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-stone-200 transition-colors disabled:opacity-40"
            title="清空当前队列"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Oversized Alert Banner for WeChat Limits */}
      {oversizedItems.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-amber-950">
                微信上传超标预警：
              </span>
              <span>
                检测到 <strong className="text-amber-800 font-bold">{oversizedItems.length}</strong> 个生成文件体积超出微信平台上限（动图&gt;1MB / 静态图&gt;500KB），上传微信时会被提示“表情过大无法添加”。
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessingAny}
            onClick={() => {
              if (onCompressOversized) {
                onCompressOversized();
              } else if (onCompressAll) {
                onCompressAll();
              }
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            一键压缩超标文件 ({oversizedItems.length})
          </button>
        </div>
      )}

      {/* Background preview mode switch (Includes WeChat Chat & Dark Mode simulation!) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-stone-400" />
          <span className="font-medium text-stone-600">底衬预览效果：</span>
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
              onClick={() => onPreviewBgChange('wechat-chat')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'wechat-chat'
                  ? 'bg-white shadow-xs text-[#07c160] font-semibold ring-1 ring-emerald-300'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="微信默认浅色聊天背景 (#ededed)"
            >
              <span className="w-2.5 h-2.5 rounded bg-[#ededed] border border-stone-300 inline-block" />
              微信浅色聊天
            </button>
            <button
              type="button"
              onClick={() => onPreviewBgChange('wechat-dark')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'wechat-dark'
                  ? 'bg-white shadow-xs text-[#07c160] font-semibold ring-1 ring-emerald-300'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="微信深色模式黑底 (#191919)，可检验白色描边效果"
            >
              <span className="w-2.5 h-2.5 rounded bg-[#191919] inline-block" />
              微信深色模式
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
              onClick={() => onPreviewBgChange('neon')}
              className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                previewBg === 'neon'
                  ? 'bg-white shadow-xs text-stone-900 font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="亮色用于检查是否有残留杂边"
            >
              <span className="w-2.5 h-2.5 rounded bg-[#ec4899] inline-block" />
              荧光粉
            </button>
          </div>
        </div>

        <span className="text-[11px] text-stone-400">
          微信官方规范：建议开启 2px 白色描边，在微信深色模式聊天中清晰可见
        </span>
      </div>

      {/* Expandable Settings Box (AND Pipeline: Removal + Arbitrary Size + WeChat Specs + Compression) */}
      {showGlobalSettings && (
        <div className="p-4 rounded-xl bg-stone-50 border border-indigo-200 text-xs space-y-4 animate-in fade-in duration-150">
          {/* AND Relationship Pipeline Banner */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-indigo-50 to-amber-50 rounded-xl border border-stone-200 text-xs text-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-stone-900 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                协同流水线（“和”的关系 · 同时满足）：
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold border transition-all ${
                  globalOptions.enableRemoval !== false
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                    : 'bg-stone-200 text-stone-500 border-stone-300 line-through'
                }`}
              >
                1. 抠图去底 {globalOptions.enableRemoval !== false ? '✓' : '关'}
              </span>
              <span className="text-stone-400 font-bold">➔</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold border transition-all ${
                  globalOptions.sizeConfig?.enabled
                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                    : 'bg-stone-200 text-stone-600 border-stone-300'
                }`}
              >
                2. 尺寸规格 {globalOptions.sizeConfig?.enabled
                  ? (globalOptions.sizeConfig.mode === 'custom'
                      ? `${globalOptions.sizeConfig.customWidth}×${globalOptions.sizeConfig.customHeight}px`
                      : globalOptions.sizeConfig.mode === 'scale'
                      ? `${globalOptions.sizeConfig.scalePercent}%`
                      : '自定')
                  : (globalOptions.wechat?.enabled ? '微信240' : '原尺寸')}
              </span>
              <span className="text-stone-400 font-bold">➔</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold border transition-all ${
                  globalOptions.wechat?.enabled
                    ? 'bg-emerald-100 text-[#07c160] border-emerald-300'
                    : 'bg-stone-200 text-stone-500 border-stone-300 line-through'
                }`}
              >
                3. 微信规范 {globalOptions.wechat?.enabled ? '✓' : '关'}
              </span>
              <span className="text-stone-400 font-bold">➔</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold border transition-all ${
                  globalOptions.compression?.enabled
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-stone-200 text-stone-500 border-stone-300 line-through'
                }`}
              >
                4. 体积压缩 {globalOptions.compression?.enabled ? `≤${globalOptions.compression.targetSizeKb}KB` : '关'}
              </span>
            </div>
            <div className="text-[11px] text-stone-600 font-medium shrink-0 bg-white/80 px-2 py-0.5 rounded border border-stone-200">
              各标签为“和”的关系，导出时满足以上所有已勾选参数
            </div>
          </div>

          {/* Tabs inside panel */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsTab('removal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  settingsTab === 'removal'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>抠图与去底</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  settingsTab === 'removal'
                    ? 'bg-indigo-700 text-white'
                    : globalOptions.enableRemoval !== false
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  {globalOptions.enableRemoval !== false ? '已开启' : '关闭'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('size')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  settingsTab === 'size'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Scaling className="w-3.5 h-3.5" />
                <span>任意尺寸规格</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  settingsTab === 'size'
                    ? 'bg-purple-700 text-white'
                    : globalOptions.sizeConfig?.enabled
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  {globalOptions.sizeConfig?.enabled ? '已开启' : '自适应'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('wechat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  settingsTab === 'wechat'
                    ? 'bg-[#07c160] text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>微信表情包规范</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  settingsTab === 'wechat'
                    ? 'bg-emerald-700 text-white'
                    : globalOptions.wechat?.enabled
                    ? 'bg-emerald-50 text-[#07c160]'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  {globalOptions.wechat?.enabled ? '已开启' : '关闭'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('compression')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  settingsTab === 'compression'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>体积压缩</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  settingsTab === 'compression'
                    ? 'bg-amber-700 text-white'
                    : globalOptions.compression?.enabled
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  {globalOptions.compression?.enabled ? `≤${globalOptions.compression.targetSizeKb}K` : '关闭'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleApplyToAll}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white rounded-lg font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              应用当前配置到全部 {totalCount} 个项目
            </button>
          </div>

          {/* WeChat Sticker Settings Tab */}
          {settingsTab === 'wechat' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* WeChat Master Toggle Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={globalOptions.wechat?.enabled ?? true}
                    onChange={(e) => updateWeChatOption('enabled', e.target.checked)}
                    className="rounded text-[#07c160] focus:ring-[#07c160] w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      启用微信表情包官方规范 (默认开启)
                    </span>
                    <span className="text-[11px] text-stone-600">
                      包含 2px 白色描边（防微信深色模式黑底看不清）、自适应居中留白防裁切与底部文字排版
                    </span>
                  </div>
                </label>
                <div className="flex items-center gap-1.5 self-end md:self-center">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-300">
                    {globalOptions.wechat?.enabled ? '规范生效中' : '已关闭'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Size Spec */}
                <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
                  <span className="font-semibold text-stone-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#07c160]" />
                    尺寸规范 (微信标准)
                  </span>
                  <p className="text-[11px] text-stone-400 leading-tight">
                    微信表情开放平台推荐 240×240 正方形，自动居中留白防裁切
                  </p>
                  <div className="flex flex-col gap-1.5 pt-1">
                    {[
                      { id: '240', title: '240 × 240 正方形 (微信标准推荐)' },
                      { id: 'max240', title: '等比缩放至最大 240px (保持宽高比)' },
                      { id: 'original', title: '保持原始尺寸' },
                    ].map((mode) => (
                      <label
                        key={mode.id}
                        className="flex items-center gap-2 cursor-pointer text-stone-700"
                      >
                        <input
                          type="radio"
                          name="wechat-size"
                          value={mode.id}
                          checked={globalOptions.wechat?.standardSize === mode.id}
                          onChange={() =>
                            updateWeChatOption(
                              'standardSize',
                              mode.id as '240' | 'max240' | 'original'
                            )
                          }
                          className="text-[#07c160] focus:ring-[#07c160]"
                        />
                        <span className="text-xs">{mode.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. White Outline Spec */}
                <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#07c160]" />
                      白色外描边 (微信深色模式必备)
                    </span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalOptions.wechat?.addWhiteOutline ?? true}
                        onChange={(e) => updateWeChatOption('addWhiteOutline', e.target.checked)}
                        className="text-[#07c160] rounded focus:ring-[#07c160]"
                      />
                      <span className="text-[11px] text-stone-600 font-medium">启用描边</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-tight">
                    在透明边缘生成高精度白色描边，防止在微信黑底深色模式中被吞没
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-stone-600">描边粗细:</span>
                    {[1, 2, 3, 4].map((px) => (
                      <button
                        key={px}
                        type="button"
                        onClick={() => updateWeChatOption('outlineWidth', px)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                          (globalOptions.wechat?.outlineWidth ?? 2) === px
                            ? 'bg-[#07c160] text-white border-[#07c160]'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {px}px {px === 2 ? '(推荐)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. File Size & Compliance Guarantee */}
                <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
                  <span className="font-semibold text-stone-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#07c160]" />
                    体积限制与格式保障
                  </span>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    ✅ <strong className="text-stone-800">&lt; 1MB 自动优化</strong>：杜绝微信提示“表情过大无法添加”
                    <br />
                    ✅ <strong className="text-stone-800">真·透明通道</strong>：透明背景无黑色杂边
                    <br />
                    ✅ <strong className="text-stone-800">即存即发</strong>：支持长按/右键直接发送至微信聊天
                  </p>
                </div>
              </div>

              {/* Caption Text Row */}
              <div className="bg-white p-3.5 rounded-xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-[#07c160]" />
                  <span className="font-semibold text-stone-800">统一表情包配字:</span>
                  <input
                    type="text"
                    placeholder="输入表情包文字（如：收到、哈哈）"
                    value={globalOptions.wechat?.captionText || ''}
                    onChange={(e) => updateWeChatOption('captionText', e.target.value)}
                    className="px-2.5 py-1 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#07c160] w-48 font-medium"
                  />
                  {globalOptions.wechat?.captionText && (
                    <button
                      type="button"
                      onClick={() => updateWeChatOption('captionText', '')}
                      className="text-[11px] text-stone-400 hover:text-red-500"
                    >
                      清空文字
                    </button>
                  )}
                </div>

                {/* Quick Caption Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-stone-400">常用预设:</span>
                  {quickCaptions.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => updateWeChatOption('captionText', text)}
                      className="px-2 py-0.5 rounded text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* WeChat Compression & Optimization Tab */}
          {settingsTab === 'compression' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Compression Switch & WeChat Policy Note */}
              <div className="bg-amber-500/10 border border-amber-300/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={globalOptions.compression?.enabled ?? true}
                    onChange={(e) => updateCompressionOption('enabled', e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      启用微信平台智能体积压缩 (默认开启)
                    </span>
                    <span className="text-[11px] text-stone-600">
                      微信开放平台硬性规定：动态表情不得超过 1024KB (1MB)，静态表情不得超过 500KB
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-1.5 self-end md:self-center">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-300">
                    当前目标: ≤ {globalOptions.compression?.targetSizeKb ?? 1000} KB
                  </span>
                </div>
              </div>

              {/* Preset Selection Grid */}
              <div className="space-y-1.5">
                <span className="font-semibold text-stone-800 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-amber-600" />
                  选择压缩档位与预设:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  {COMPRESSION_PRESETS.map((preset) => {
                    const isSelected = globalOptions.compression?.preset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400 shadow-2xs'
                            : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
                        )}
                        <div className="text-xs font-bold text-stone-900 mb-1">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-stone-500 line-clamp-2 leading-tight mb-2">
                          {preset.desc}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-stone-600">
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200">
                            ≤{preset.targetSizeKb}KB
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200">
                            {preset.maxColors}色
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Fine-Tuning Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-stone-200">
                {/* 1. Target Size Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-700 font-medium">目标体积上限:</span>
                    <span className="font-mono font-bold text-amber-700">
                      {globalOptions.compression?.targetSizeKb ?? 1000} KB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="1200"
                    step="50"
                    value={globalOptions.compression?.targetSizeKb ?? 1000}
                    onChange={(e) => {
                      updateCompressionOption('targetSizeKb', parseInt(e.target.value, 10));
                      updateCompressionOption('preset', 'custom');
                    }}
                    className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400">
                    <span>300KB (极速)</span>
                    <span>500KB (静态微信)</span>
                    <span>1MB (动图微信)</span>
                  </div>
                </div>

                {/* 2. Palette Color Limit */}
                <div className="space-y-1">
                  <span className="text-stone-700 font-medium block text-xs">
                    调色板色彩上限:
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {[32, 64, 128, 256].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          updateCompressionOption('maxColors', num);
                          updateCompressionOption('preset', 'custom');
                        }}
                        className={`py-1 rounded text-[11px] font-semibold border transition-all ${
                          (globalOptions.compression?.maxColors ?? 256) === num
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {num}色
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-stone-400 block">
                    色彩越少，体积缩减越显著
                  </span>
                </div>

                {/* 3. Scale Ratio */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-700 font-medium">等比画质缩放:</span>
                    <span className="font-mono font-bold text-stone-800">
                      {Math.round((globalOptions.compression?.scaleRatio ?? 1.0) * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: '100%', val: 1.0 },
                      { label: '85%', val: 0.85 },
                      { label: '75%', val: 0.75 },
                      { label: '60%', val: 0.6 },
                    ].map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          updateCompressionOption('scaleRatio', s.val);
                          updateCompressionOption('preset', 'custom');
                        }}
                        className={`py-1 rounded text-[11px] font-semibold border transition-all ${
                          (globalOptions.compression?.scaleRatio ?? 1.0) === s.val
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-stone-400 block">
                    超出限制时缩放可大幅减少体积
                  </span>
                </div>

                {/* 4. Frame Sampling & Fallback Check */}
                <div className="space-y-2">
                  <div>
                    <span className="text-stone-700 font-medium block text-xs mb-1">
                      动图隔帧采样 (GIF专用):
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { label: '全帧完整', val: 1 },
                        { label: '抽1隔1 (减半)', val: 2 },
                      ].map((f) => (
                        <button
                          key={f.val}
                          type="button"
                          onClick={() => {
                            updateCompressionOption('frameStep', f.val);
                            updateCompressionOption('preset', 'custom');
                          }}
                          className={`py-1 rounded text-[11px] font-semibold border transition-all ${
                            (globalOptions.compression?.frameStep ?? 1) === f.val
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={globalOptions.compression?.autoCompressUnderLimit ?? true}
                      onChange={(e) =>
                        updateCompressionOption('autoCompressUnderLimit', e.target.checked)
                      }
                      className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] text-stone-600 font-medium">
                      多轮自适应达标保障 (自动二次降色)
                    </span>
                  </label>
                </div>
              </div>

              {/* Compliance Guidance Info */}
              <div className="p-3 bg-stone-100/70 border border-stone-200 rounded-xl text-[11px] text-stone-600 leading-relaxed">
                <span className="font-bold text-stone-800">💡 微信表情上传避坑指南：</span>
                微信开放平台审核对表情大小有极严格校验，
                动态表情需保证 <strong>&le; 1024KB (1MB)</strong>，静态表情需 <strong>&le; 500KB</strong>。
                若原图过大或帧数过多导致超标，开启【微信平台智能适配】后，系统会自动为您多轮微调色彩量化矩阵，
                在保持人眼无法察觉的高画质透明轮廓的同时，确保 100% 顺利上传微信。
              </div>
            </div>
          )}

          {/* 1. Removal Settings Tab */}
          {settingsTab === 'removal' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Removal Master Toggle Banner */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={globalOptions.enableRemoval !== false}
                    onChange={(e) =>
                      setGlobalOptions({ ...globalOptions, enableRemoval: e.target.checked })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      启用抠图与去底 (默认开启)
                    </span>
                    <span className="text-[11px] text-stone-600">
                      勾选后自动消除目标底色；若取消勾选，则保留原图背景，仅执行尺寸规格调整与体积压缩
                    </span>
                  </div>
                </label>
                <div className="flex items-center gap-1.5 self-end md:self-center">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-semibold border border-indigo-300">
                    {globalOptions.enableRemoval !== false ? '去底已启用' : '保留原底'}
                  </span>
                </div>
              </div>

              {globalOptions.enableRemoval !== false && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  {/* Color */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
                    <label className="block text-stone-700 font-semibold text-xs">
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
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {presetColors.map((p) => (
                        <button
                          key={p.color}
                          type="button"
                          onClick={() =>
                            setGlobalOptions({ ...globalOptions, targetColor: p.color })
                          }
                          className="px-2 py-0.5 rounded text-[11px] border border-stone-200 hover:bg-stone-50 flex items-center gap-1 cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-stone-300 inline-block"
                            style={{ backgroundColor: p.color }}
                          />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tolerance */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-stone-700 font-semibold text-xs">
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
                    <p className="text-[11px] text-stone-400 leading-tight">
                      纯色背景建议 15~20%，若有反光微噪点可提高至 25~35%
                    </p>
                  </div>

                  {/* Mode & Defringe */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
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
                      <span className="text-stone-700 font-medium text-xs">
                        边缘向内扩散 (保护主体内部相同颜色)
                      </span>
                    </label>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-stone-600 text-xs">边缘去杂色:</span>
                      {[0, 1, 2].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() =>
                            setGlobalOptions({ ...globalOptions, defringe: lvl })
                          }
                          className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
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
              )}
            </div>
          )}

          {/* 2. Arbitrary Size Settings Tab */}
          {settingsTab === 'size' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Arbitrary Size Master Toggle */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={globalOptions.sizeConfig?.enabled ?? true}
                    onChange={(e) => updateSizeConfigOption('enabled', e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      启用任意尺寸规格重设 (支持任意自定义尺寸 / 比例 / 预设)
                    </span>
                    <span className="text-[11px] text-stone-600">
                      支持导出 512×512、1080×1080、手机宽 750px、百分比缩放或自定义像素，打破微信 240px 单一限制
                    </span>
                  </div>
                </label>
                <div className="flex items-center gap-1.5 self-end md:self-center">
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-semibold border border-purple-300">
                    {globalOptions.sizeConfig?.enabled ? '自定规格生效中' : '未开启'}
                  </span>
                </div>
              </div>

              {/* Mode Selection Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    id: 'custom',
                    title: '自定义宽高像素',
                    desc: '自由设定像素数值，适合特定场景',
                  },
                  {
                    id: 'wechat',
                    title: '微信标准 240×240',
                    desc: '微信开放平台官方标准正方形',
                  },
                  {
                    id: 'scale',
                    title: '百分比等比缩放',
                    desc: '按 75%、50% 等比例缩小画质',
                  },
                  {
                    id: 'original',
                    title: '保持原图尺寸',
                    desc: '不改变分辨率，导出原始图像大小',
                  },
                ].map((m) => {
                  const isCur =
                    (globalOptions.sizeConfig?.mode || 'custom') === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        updateSizeConfigOption('mode', m.id as any)
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isCur
                          ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-300 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-stone-900 mb-0.5">
                        {m.title}
                      </div>
                      <div className="text-[10px] text-stone-500 leading-tight">
                        {m.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Presets Buttons */}
              <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                  <Scaling className="w-3.5 h-3.5 text-purple-600" />
                  常用尺寸快速套用:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '240×240 微信表情', w: 240, h: 240 },
                    { label: '300×300 紧凑表情', w: 300, h: 300 },
                    { label: '512×512 高清贴纸', w: 512, h: 512 },
                    { label: '750×750 手机高清', w: 750, h: 750 },
                    { label: '1080×1080 社交大图', w: 1080, h: 1080 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        updateSizeConfigOption('enabled', true);
                        updateSizeConfigOption('mode', 'custom');
                        updateSizeConfigOption('customWidth', preset.w);
                        updateSizeConfigOption('customHeight', preset.h);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-purple-100 hover:text-purple-800 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Options based on mode */}
              {globalOptions.sizeConfig?.mode === 'custom' && (
                <div className="bg-white p-3.5 rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      目标宽度 (Width px)
                    </label>
                    <input
                      type="number"
                      min="16"
                      max="10000"
                      step="10"
                      value={globalOptions.sizeConfig?.customWidth || 512}
                      onChange={(e) =>
                        updateSizeConfigOption('customWidth', parseInt(e.target.value, 10) || 240)
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      目标高度 (Height px)
                    </label>
                    <input
                      type="number"
                      min="16"
                      max="10000"
                      step="10"
                      value={globalOptions.sizeConfig?.customHeight || 512}
                      onChange={(e) =>
                        updateSizeConfigOption('customHeight', parseInt(e.target.value, 10) || 240)
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      适配模式 (Fit Mode)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateSizeConfigOption('fitMode', 'contain')}
                        className={`py-1 rounded text-[11px] font-semibold border ${
                          (globalOptions.sizeConfig?.fitMode || 'contain') === 'contain'
                            ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
                            : 'bg-white text-stone-600 border-stone-200'
                        }`}
                        title="等比居中留白防裁切"
                      >
                        等比居中
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSizeConfigOption('fitMode', 'stretch')}
                        className={`py-1 rounded text-[11px] font-semibold border ${
                          globalOptions.sizeConfig?.fitMode === 'stretch'
                            ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
                            : 'bg-white text-stone-600 border-stone-200'
                        }`}
                        title="自由拉伸充满目标宽高"
                      >
                        拉伸填满
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {globalOptions.sizeConfig?.mode === 'scale' && (
                <div className="bg-white p-3.5 rounded-xl border border-stone-200 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-stone-700">
                    缩放比例: {globalOptions.sizeConfig?.scalePercent || 100}%
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[100, 85, 75, 50, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => updateSizeConfigOption('scalePercent', pct)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          (globalOptions.sizeConfig?.scalePercent || 100) === pct
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notice */}
              <div className="p-3 bg-stone-100/70 border border-stone-200 rounded-xl text-[11px] text-stone-600 leading-relaxed">
                <span className="font-bold text-stone-800">💡 “和”的关系说明：</span>
                尺寸规格将与【微信表情规范】（2px 白色描边/文字）与【体积压缩】参数协同生效！
                例如选择 512×512 像素，同时保留白色描边与 &le;1MB 压缩，将导出 512px 高清且带有白色描边的达标表情或动图！
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
