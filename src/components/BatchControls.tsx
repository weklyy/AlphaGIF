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
} from 'lucide-react';
import { GifItem, RemovalOptions, PreviewBgMode, WeChatStickerOptions } from '../types';

interface BatchControlsProps {
  items: GifItem[];
  isProcessingAny: boolean;
  onProcessAll: (asWeChat?: boolean) => void;
  onDownloadAllZip: (onlyWeChat?: boolean) => void;
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
  const [settingsTab, setSettingsTab] = useState<'wechat' | 'general'>('wechat');

  const [globalOptions, setGlobalOptions] = useState<RemovalOptions>({
    targetColor: '#ffffff',
    tolerance: 15,
    contiguous: true,
    defringe: 1,
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
  });

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const wechatDoneCount = items.filter(
    (i) => i.status === 'done' && i.result?.isWeChatSticker
  ).length;
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

  const quickCaptions = ['收到', '好的', '哈哈', '点赞', '谢谢老板', '告辞', '哭死', '无语'];

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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              showGlobalSettings
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#07c160]" />
            <span>微信表情 & 抠图参数设置</span>
          </button>

          {/* WeChat Sticker Batch Generation Button (HIGH VISIBILITY) */}
          <button
            id="batch-generate-wechat-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => onProcessAll(true)}
            className="px-4 py-1.5 bg-[#07c160] hover:bg-[#06ad56] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
            title="一键将队列中全部图片/动图按微信规范（240x240/白色描边/<1MB）生成微信表情包"
          >
            {isProcessingAny ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Smile className="w-3.5 h-3.5" />
            )}
            批量生成微信表情包
          </button>

          {/* Standard Process All Button */}
          <button
            id="batch-process-all-btn"
            type="button"
            disabled={isProcessingAny || totalCount === 0}
            onClick={() => onProcessAll(false)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="仅抠除背景，保留原始尺寸"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            常规去底
          </button>

          {/* Download All as ZIP */}
          <button
            id="batch-download-zip-btn"
            type="button"
            disabled={doneCount === 0}
            onClick={() => onDownloadAllZip()}
            className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="下载所有处理好的文件打包 ZIP"
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
            className="p-1.5 text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-stone-200 transition-colors disabled:opacity-40"
            title="清空当前队列"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

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

      {/* Expandable Settings Box (With WeChat Sticker Tab + General Tab) */}
      {showGlobalSettings && (
        <div className="p-4 rounded-xl bg-stone-50 border border-emerald-200 text-xs space-y-4 animate-in fade-in duration-150">
          {/* Tabs inside panel */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsTab('wechat')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  settingsTab === 'wechat'
                    ? 'bg-[#07c160] text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                微信表情包规范设置
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('general')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  settingsTab === 'general'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                底色消除与容差参数
              </button>
            </div>

            <button
              type="button"
              onClick={handleApplyToAll}
              className="px-3 py-1 bg-stone-900 hover:bg-black text-white rounded-md font-medium transition-colors shadow-2xs flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              应用当前配置到全部 {totalCount} 个项目
            </button>
          </div>

          {/* WeChat Sticker Settings Tab */}
          {settingsTab === 'wechat' && (
            <div className="space-y-4 animate-in fade-in duration-100">
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

          {/* General Removal Settings Tab */}
          {settingsTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 animate-in fade-in duration-100">
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
          )}
        </div>
      )}
    </div>
  );
};
