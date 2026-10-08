/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Square,
  Sparkles,
  Pipette,
  Check,
  RotateCcw,
  Scissors,
  Sliders,
  Maximize2,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Paintbrush,
  Eraser,
} from 'lucide-react';

export interface FrameRemovalSettings {
  removeFrameBorder: boolean;
  frameBorderMode: 'auto' | 'black' | 'color' | 'inset';
  frameBorderColor: string;
  frameBorderColors?: string[];
  frameBorderTolerance: number;
  frameBorderWidth: number;
  frameBorderInset: number;
  frameBorderAutoScale: boolean;
  frameEraserMaskUrl?: string;
  frameEraserSyncAllCells?: boolean;
}

interface FrameRemovalControlPanelProps {
  settings: Partial<FrameRemovalSettings>;
  onChange: (updated: Partial<FrameRemovalSettings>) => void;
  onPickColorFromScreen?: () => void;
  onOneClickAutoDelete?: () => void;
  isPickingColor?: boolean;
  compact?: boolean;
  onToggleBrushSmear?: () => void;
  isBrushSmearActive?: boolean;
  brushSize?: number;
  onBrushSizeChange?: (size: number) => void;
  syncAllCells?: boolean;
  onSyncAllCellsChange?: (sync: boolean) => void;
  onUndoBrush?: () => void;
  onClearBrush?: () => void;
  canUndoBrush?: boolean;
  hasBrushMask?: boolean;
}

export const FrameRemovalControlPanel: React.FC<FrameRemovalControlPanelProps> = ({
  settings,
  onChange,
  onPickColorFromScreen,
  onOneClickAutoDelete,
  isPickingColor,
  compact = false,
  onToggleBrushSmear,
  isBrushSmearActive = false,
  brushSize = 16,
  onBrushSizeChange,
  syncAllCells = true,
  onSyncAllCellsChange,
  onUndoBrush,
  onClearBrush,
  canUndoBrush = false,
  hasBrushMask = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const enabled = !!settings.removeFrameBorder;
  const mode = settings.frameBorderMode || 'auto';
  const color = settings.frameBorderColor || '#000000';
  const tolerance = settings.frameBorderTolerance ?? 38;
  const borderWidth = settings.frameBorderWidth ?? 4;
  const inset = settings.frameBorderInset ?? 0;
  const autoScale = settings.frameBorderAutoScale === true; // Default false: 删框不缩放，保证文字与图像原位

  const presetColors = [
    { label: '黑色', hex: '#000000' },
    { label: '深灰', hex: '#333333' },
    { label: '白色', hex: '#ffffff' },
    { label: '棕褐', hex: '#5c4033' },
    { label: '暗红', hex: '#8b0000' },
    { label: '藏蓝', hex: '#1a2a3a' },
  ];

  return (
    <div
      className={`rounded-xl border transition-all ${
        enabled
          ? 'bg-amber-50/80 border-amber-300 shadow-2xs ring-1 ring-amber-300/60'
          : 'bg-stone-50 border-stone-200'
      } ${compact ? 'p-2.5' : 'p-3.5'} space-y-2.5`}
    >
      {/* Top Header & Master Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              enabled ? 'bg-amber-500 text-stone-950 shadow-2xs font-bold' : 'bg-stone-200 text-stone-600'
            }`}
          >
            <Square className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-900">鼠标点一下·一键全删方框</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                极简模式
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              无需反复手动拖动裁切框！点一下即可消除所有相同方框
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                const nextVal = e.target.checked;
                onChange({
                  removeFrameBorder: nextVal,
                  frameBorderMode: mode,
                  frameBorderColor: color,
                  frameBorderTolerance: tolerance,
                  frameBorderWidth: borderWidth,
                  frameBorderInset: inset,
                  frameBorderAutoScale: autoScale,
                });
              }}
              className="sr-only peer"
            />
            <div className="w-10 h-5.5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-500 shadow-2xs"></div>
          </label>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-200/50 cursor-pointer"
            title={isExpanded ? '收起微调高级参数' : '展开微调高级参数'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Three Action Buttons: One-Click Auto, Eyedropper Pick, and Brush Smear */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
        {onOneClickAutoDelete && (
          <button
            type="button"
            onClick={onOneClickAutoDelete}
            className="w-full py-2 px-2 bg-amber-500 hover:bg-amber-600 active:scale-98 text-stone-950 font-bold rounded-lg border border-amber-600 shadow-xs flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
            title="鼠标点一下，全自动检测识别图片中的方框并全部删除"
          >
            <Sparkles className="w-3.5 h-3.5 text-stone-950 fill-stone-950" />
            <span>⚡ 鼠标点一下全删</span>
          </button>
        )}

        {onPickColorFromScreen && (
          <button
            type="button"
            onClick={onPickColorFromScreen}
            className={`w-full py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isPickingColor
                ? 'bg-amber-400 text-stone-950 border-amber-600 ring-2 ring-amber-400 animate-pulse'
                : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300 shadow-2xs'
            }`}
            title="鼠标点击画面中任意方框线，即可直接全部删除所有方框"
          >
            <Pipette className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
            <span>{isPickingColor ? '点击图中方框...' : '🎯 点画面方框全删'}</span>
          </button>
        )}

        {onToggleBrushSmear && (
          <button
            type="button"
            onClick={onToggleBrushSmear}
            className={`w-full py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isBrushSmearActive
                ? 'bg-amber-400 text-stone-950 border-amber-600 ring-2 ring-amber-400 animate-pulse shadow-xs font-black'
                : hasBrushMask
                ? 'bg-amber-100 text-amber-950 border-amber-400'
                : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300 shadow-2xs'
            }`}
            title="按住鼠标拖动涂抹擦除残余框线与角落杂点"
          >
            <Paintbrush className="w-3.5 h-3.5 text-amber-700" />
            <span>{isBrushSmearActive ? '涂抹消框中...' : '🖌️ 画笔涂抹消框'}</span>
          </button>
        )}
      </div>

      {/* Brush Smear Controls Sub-Panel (Visible when brush mode is active or when mask exists) */}
      {(isBrushSmearActive || hasBrushMask) && (
        <div className="p-2.5 bg-amber-50/90 rounded-lg border border-amber-300 text-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Paintbrush className="w-4 h-4 text-amber-700" />
              <span>画笔涂抹消框工具</span>
              {hasBrushMask && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-normal">
                  已有涂抹蒙版
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onUndoBrush && (
                <button
                  type="button"
                  onClick={onUndoBrush}
                  disabled={!canUndoBrush}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-stone-100 disabled:opacity-40 text-stone-700 border border-stone-300 cursor-pointer flex items-center gap-1 transition-colors"
                  title="撤销上一笔涂抹"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>撤销</span>
                </button>
              )}
              {onClearBrush && (
                <button
                  type="button"
                  onClick={onClearBrush}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-red-50 text-stone-700 hover:text-red-700 border border-stone-300 cursor-pointer transition-colors"
                  title="清空所有涂抹内容"
                >
                  清空
                </button>
              )}
              {onToggleBrushSmear && (
                <button
                  type="button"
                  onClick={onToggleBrushSmear}
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 border border-amber-600 cursor-pointer shadow-2xs"
                >
                  {isBrushSmearActive ? '完成涂抹' : '开启涂抹'}
                </button>
              )}
            </div>
          </div>

          {/* Brush size slider & sync toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-700 font-medium">笔刷粗细:</span>
              <input
                type="range"
                min={2}
                max={60}
                value={brushSize ?? 16}
                onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                className="w-20 sm:w-24 accent-amber-600 cursor-pointer h-1.5 bg-stone-200 rounded"
              />
              <span className="font-mono text-[11px] font-bold text-amber-900 w-7">
                {brushSize ?? 16}px
              </span>
              <div className="flex items-center gap-1">
                {[4, 8, 16, 32].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onBrushSizeChange?.(sz)}
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono border cursor-pointer ${
                      (brushSize ?? 16) === sz
                        ? 'bg-amber-500 text-stone-950 font-bold border-amber-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {onSyncAllCellsChange && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={syncAllCells ?? true}
                  onChange={(e) => onSyncAllCellsChange(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                />
                <span>同步全图所有宫格（涂抹一处全图生效）</span>
              </label>
            )}
          </div>

          <div className="text-[10px] space-y-1 pt-0.5 border-t border-amber-200/80 leading-relaxed">
            <p className="text-emerald-900 font-semibold flex items-center gap-1">
              <span>🛡️</span>
              <span><strong>保护画作细节：</strong>画笔涂抹纯手动擦除，<strong>不按颜色匹配</strong>，绘图中的黑线、文字、眼睛等同色内容绝不误删！</span>
            </p>
            <p className="text-amber-900/80">
              💡 <strong>操作提示：</strong>拖动鼠标在要清除的方框线上涂抹即可擦除；涂抹完成后点击「完成涂抹」，涂抹引导色自动隐藏，画面仅保留纯净透明擦除效果！
            </p>
          </div>
        </div>
      )}

      {/* Safety Notice for Color-based Deletion */}
      <div className="px-2.5 py-1.5 bg-stone-100/90 rounded-md border border-stone-200 text-[10px] text-stone-600 flex items-start gap-1.5">
        <span className="shrink-0 text-amber-600 font-bold">⚠️</span>
        <span>
          <strong>特别说明：</strong>如果画作中包含较多与方框同色的线条或文字（如黑色描边），使用颜色识别可能会误伤画中内容；强烈建议使用上方<strong>【🖌️ 画笔涂抹消框】</strong>进行精准擦除，画作细节 100% 完好无损！
        </span>
      </div>

      {/* Active State Feedback Banner */}
      {enabled && (
        <div className="p-2 bg-amber-100/80 rounded-lg border border-amber-300 text-[11px] text-amber-950 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>已开启全删方框</span>
            {settings.frameBorderColors && settings.frameBorderColors.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {settings.frameBorderColors.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 font-mono text-[10px] bg-white px-1.5 py-0.2 rounded border border-amber-300"
                  >
                    <span className="w-2 h-2 rounded-full inline-block border border-black/20" style={{ backgroundColor: c }} />
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (settings.frameBorderColors || []).filter((x) => x !== c);
                        onChange({
                          frameBorderColors: next,
                          frameBorderColor: next[next.length - 1] || '#000000',
                          removeFrameBorder: next.length > 0,
                        });
                      }}
                      className="text-stone-400 hover:text-stone-700 ml-0.5 cursor-pointer font-bold"
                      title="撤销此框线颜色"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              color && (
                <span className="inline-flex items-center gap-1 ml-1.5 font-mono text-[10px] bg-white px-1.5 py-0.2 rounded border border-amber-300">
                  <span className="w-2 h-2 rounded-full inline-block border border-black/20" style={{ backgroundColor: color }} />
                  {color}
                </span>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({
                removeFrameBorder: false,
                frameBorderColors: [],
                frameBorderColor: '#000000',
              });
            }}
            className="text-[10px] text-amber-900 hover:text-amber-950 font-bold underline cursor-pointer"
          >
            重置恢复原框
          </button>
        </div>
      )}

      {/* Expanded Control Details */}
      {isExpanded && (
        <div className="p-3 bg-white rounded-xl border border-amber-200/90 space-y-3 animate-in fade-in duration-150">
          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-stone-700 block">去框模式选择:</label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'auto', label: '智能识别', sub: '自动寻框消除' },
                { id: 'black', label: '消除黑框', sub: '黑灰线框/黑边' },
                { id: 'color', label: '彩色边框', sub: '吸管或指定色' },
                { id: 'inset', label: '边缘内缩', sub: '硬核切除毛刺' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange({ frameBorderMode: item.id as any })}
                  className={`py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                    mode === item.id
                      ? 'bg-amber-500 text-stone-950 border-amber-600 font-bold shadow-2xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  <div className="text-[11px] leading-tight">{item.label}</div>
                  <div className="text-[9px] opacity-75">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker & Eyedropper (Visible if mode is 'color' or 'black') */}
          {(mode === 'color' || mode === 'black') && (
            <div className="p-2 bg-stone-50 rounded-lg border border-stone-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-700 font-medium">
                  {mode === 'black' ? '黑框容差基准色:' : '目标框线颜色:'}
                </span>

                <div className="flex items-center gap-1.5">
                  {onPickColorFromScreen && (
                    <button
                      type="button"
                      onClick={onPickColorFromScreen}
                      className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 transition-all cursor-pointer ${
                        isPickingColor
                          ? 'bg-amber-500 text-stone-950 font-bold border-amber-600 animate-pulse'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                      }`}
                      title="点击后在图片上吸取框线颜色"
                    >
                      <Pipette className="w-3 h-3 text-stone-700" />
                      <span>{isPickingColor ? '点击图中框线' : '吸取框色'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Swatches & Native Picker */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-white border border-stone-300 px-2 py-1 rounded-md text-xs font-mono shadow-2xs">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange({ frameBorderColor: e.target.value })}
                    className="w-4 h-4 rounded border-0 p-0 cursor-pointer bg-transparent"
                    title="自定义选择框颜色"
                  />
                  <span className="text-stone-800 font-bold uppercase text-[11px]">{color}</span>
                </div>

                <div className="flex items-center gap-1">
                  {presetColors.map((p) => {
                    const isSelected = color.toLowerCase() === p.hex.toLowerCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => onChange({ frameBorderColor: p.hex })}
                        className={`px-1.5 py-0.5 text-[10px] rounded border flex items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-100 border-amber-500 text-amber-900 font-bold'
                            : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-stone-300 shrink-0"
                          style={{ backgroundColor: p.hex }}
                        />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sliders: Thickness & Inset & Tolerance */}
          <div className="space-y-2 pt-1 border-t border-stone-100">
            {/* Inset Cutting Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-700 font-medium flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-amber-600" />
                  <span>边缘安全内缩 (Inset 剪裁):</span>
                </span>
                <span className="font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded text-[10px]">
                  {inset} px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={inset}
                onChange={(e) => onChange({ frameBorderInset: parseInt(e.target.value, 10) || 0 })}
                className="w-full accent-amber-600 cursor-pointer h-1.5 bg-stone-200 rounded"
              />
              <div className="flex justify-between text-[9px] text-stone-400">
                <span>0px (仅消隐框线)</span>
                <span className="text-amber-800 font-medium">推荐 2px (彻底去毛刺)</span>
                <span>8px (重度裁边)</span>
              </div>
            </div>

            {/* Frame Line Width */}
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-700 font-medium flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-stone-500" />
                  <span>框线消除粗细 (Thickness):</span>
                </span>
                <span className="font-mono font-bold text-stone-800 bg-stone-100 px-1.5 py-0.2 rounded text-[10px]">
                  {borderWidth} px
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={borderWidth}
                onChange={(e) => onChange({ frameBorderWidth: parseInt(e.target.value, 10) || 3 })}
                className="w-full accent-amber-600 cursor-pointer h-1.5 bg-stone-200 rounded"
              />
            </div>

            {/* Tolerance Slider */}
            {mode !== 'inset' && (
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-700 font-medium">框色识别容差 (Tolerance):</span>
                  <span className="font-mono font-bold text-stone-800 bg-stone-100 px-1.5 py-0.2 rounded text-[10px]">
                    {tolerance}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="1"
                  value={tolerance}
                  onChange={(e) => onChange({ frameBorderTolerance: parseInt(e.target.value, 10) || 35 })}
                  className="w-full accent-amber-600 cursor-pointer h-1.5 bg-stone-200 rounded"
                />
              </div>
            )}

            {/* Auto Scale Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-100">
              <div>
                <label className="text-[11px] font-medium text-stone-700 flex items-center gap-1.5">
                  <Maximize2 className="w-3 h-3 text-emerald-600" />
                  <span>图像保持原位不缩放（仅消除线，不碰文字）</span>
                </label>
                <p className="text-[10px] text-stone-500">关闭缩放以严格保留底部配文，避免文字被裁切或拉伸</p>
              </div>
              <input
                type="checkbox"
                checked={!autoScale}
                onChange={(e) => onChange({ frameBorderAutoScale: !e.target.checked })}
                className="w-3.5 h-3.5 rounded text-amber-600 accent-amber-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Feature Guarantee Notice */}
          <div className="p-2 bg-amber-50/80 rounded-lg border border-amber-200 text-[10px] text-amber-900 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>智能去框保障：</strong>鼠标点一下全删方框，仅识别并消除四周边框线条，绝对不缩放变形，完整保留所有角色画面与底部文字！
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
