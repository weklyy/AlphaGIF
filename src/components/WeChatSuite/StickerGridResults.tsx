import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  Sparkles,
  Smile,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Image as ImageIcon,
  Sliders,
  FolderArchive,
  FileImage,
  Loader2,
  Paintbrush,
} from 'lucide-react';
import { SlicedStickerItem } from '../../types';
import {
  exportSlicedStickersOnlyZip,
  isStaticStickerSet,
} from '../../utils/wechatZipExporter';

interface StickerGridResultsProps {
  stickers: SlicedStickerItem[];
  onImportAllToTab2: () => void;
  onImportSingleToTab2: (sticker: SlicedStickerItem) => void;
  onSendToRetouch?: (sticker: SlicedStickerItem) => void;
  onSetAsCover: (index: number) => void;
  onSetAsIcon: (index: number) => void;
  onSetAsGuide: (index: number) => void;
  onSetAsThanks: (index: number) => void;
  currentCoverIndex: number;
  currentIconIndex: number;
  currentGuideIndex: number;
  currentThanksIndex: number;
}

export const StickerGridResults: React.FC<StickerGridResultsProps> = ({
  stickers,
  onImportAllToTab2,
  onImportSingleToTab2,
  onSendToRetouch,
  onSetAsCover,
  onSetAsIcon,
  onSetAsGuide,
  onSetAsThanks,
  currentCoverIndex,
  currentIconIndex,
  currentGuideIndex,
  currentThanksIndex,
}) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const isStatic = isStaticStickerSet(stickers);

  const handleExportZip = async () => {
    if (stickers.length === 0 || isExportingZip) return;
    setIsExportingZip(true);
    try {
      await exportSlicedStickersOnlyZip(stickers);
    } catch (err) {
      console.error('Failed to export stickers ZIP', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDownloadSingle = (sticker: SlicedStickerItem) => {
    const a = document.createElement('a');
    a.href = sticker.url;
    const baseName = sticker.name.replace(/\.[^/.]+$/, '');
    const ext = isStatic ? 'png' : 'gif';
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#07c160] flex items-center justify-center font-bold shadow-2xs">
            {isStatic ? <FileImage className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-stone-900">
                01_表情主图切片结果 ({stickers.length} 个)
              </h3>
              {isStatic ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#07c160]" />
                  240×240 PNG 格式（微信静态官方唯一标准）
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  全部严格锁定 240×240 GIF &lt; 1MB
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {isStatic
                ? '严格输出微信官方 240×240 无损透明 PNG 格式，每张均满足 ≤500KB 规范，支持 2px 白色描边与一键指派物料'
                : '符合微信官方表情主图数量规范（8~24之间），支持循环播放、白边保护与一键指派为配套物料'}
            </p>
          </div>
        </div>

        {/* Global Action: Download Zip and Import to Tab 2 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportZip}
            disabled={isExportingZip}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#07c160] hover:bg-[#06ad56] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isExportingZip ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderArchive className="w-3.5 h-3.5" />
            )}
            <span>{isStatic ? '打包下载全部 PNG 主图 (ZIP)' : '打包下载全部 GIF 主图 (ZIP)'}</span>
          </button>

          <button
            type="button"
            onClick={onImportAllToTab2}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>全部导入「背景透明化工具」继续微调</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid of Sticker Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {stickers.map((sticker) => {
          const isCover = currentCoverIndex === sticker.index;
          const isIcon = currentIconIndex === sticker.index;
          const isGuide = currentGuideIndex === sticker.index;
          const isThanks = currentThanksIndex === sticker.index;
          const sizeKb = (sticker.size / 1024).toFixed(1);

          return (
            <div
              key={sticker.index}
              className={`group relative rounded-xl border transition-all p-3 flex flex-col justify-between bg-stone-50/50 hover:bg-white hover:shadow-md ${
                isCover || isIcon || isGuide || isThanks
                  ? 'border-emerald-500 ring-1 ring-emerald-400/40'
                  : 'border-stone-200'
              }`}
            >
              {/* Top Header inside card */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 text-[10px] font-mono font-bold flex items-center justify-center">
                    {sticker.index}
                  </span>
                  <span className="font-mono text-xs font-bold text-stone-800 bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-2xs">
                    {String(sticker.index).padStart(2, '0')}_T.{isStatic ? 'png' : 'gif'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isStatic
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}
                  >
                    {isStatic ? 'PNG' : 'GIF'}
                  </span>

                  {isCover && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      封面
                    </span>
                  )}
                  {isIcon && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      图标
                    </span>
                  )}
                  {isGuide && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                      引导
                    </span>
                  )}
                  {isThanks && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      致谢
                    </span>
                  )}
                </div>
              </div>

              {/* Preview with checkerboard background */}
              <div
                className="relative w-full aspect-square rounded-lg overflow-hidden border border-stone-200 flex items-center justify-center mb-2"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
                    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
                    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                  `,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  backgroundColor: '#ffffff',
                }}
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Specification stats */}
              <div className="flex items-center justify-between text-[11px] text-stone-500 mb-2.5 px-0.5">
                <span className="flex items-center gap-1">
                  <span>{sticker.width}×{sticker.height}</span>
                  <span className="text-stone-300">•</span>
                  <span>
                    {isStatic
                      ? 'PNG'
                      : sticker.duration
                      ? `${sticker.duration.toFixed(1)}s`
                      : 'GIF'}
                  </span>
                  {!isStatic && (
                    <>
                      <span className="text-stone-300">•</span>
                      <span>{sticker.frameCount}帧</span>
                    </>
                  )}
                </span>
                <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {sizeKb} KB
                </span>
              </div>

              {/* Action buttons: Set as cover/icon, download, import to Tab 2 */}
              <div className="space-y-1.5 pt-2 border-t border-stone-200/80">
                {/* Fast role assign buttons */}
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => onSetAsCover(sticker.index)}
                    className={`py-1 px-1.5 rounded font-medium border text-center transition-colors cursor-pointer ${
                      isCover
                        ? 'bg-amber-500 text-white border-amber-600 font-bold'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {isCover ? '已选为封面' : '选为封面'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAsIcon(sticker.index)}
                    className={`py-1 px-1.5 rounded font-medium border text-center transition-colors cursor-pointer ${
                      isIcon
                        ? 'bg-blue-600 text-white border-blue-700 font-bold'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {isIcon ? '已选为图标' : '选为图标'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAsGuide(sticker.index)}
                    className={`py-1 px-1.5 rounded font-medium border text-center transition-colors cursor-pointer ${
                      isGuide
                        ? 'bg-purple-600 text-white border-purple-700 font-bold'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {isGuide ? '已选引导图' : '选为引导'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAsThanks(sticker.index)}
                    className={`py-1 px-1.5 rounded font-medium border text-center transition-colors cursor-pointer ${
                      isThanks
                        ? 'bg-rose-600 text-white border-rose-700 font-bold'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {isThanks ? '已选致谢图' : '选为致谢'}
                  </button>
                </div>

                {/* Secondary tools */}
                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(sticker)}
                    className="flex-1 py-1 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    下载单张 ({isStatic ? 'PNG' : 'GIF'})
                  </button>

                  {onSendToRetouch && (
                    <button
                      type="button"
                      onClick={() => onSendToRetouch(sticker)}
                      title="送往 AI 修图去水印画板（消除杂物/文字/水印/打码）"
                      className="py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-[#07c160] rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors border border-emerald-200/60 cursor-pointer"
                    >
                      <Paintbrush className="w-3 h-3" />
                      修图
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onImportSingleToTab2(sticker)}
                    title="导入到背景透明化工具进行高级微调"
                    className="py-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors border border-indigo-200/60 cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    去底
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
