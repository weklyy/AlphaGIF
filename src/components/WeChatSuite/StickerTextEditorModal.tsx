/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Type,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Palette,
  Eye,
  Layers,
  Smile,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Loader2,
  Eraser,
  Square,
  Pipette,
  Undo2,
  Redo2,
  Trash2,
  Paintbrush,
  ArrowDownUp,
  ArrowLeftRight,
} from 'lucide-react';
import { SlicedStickerItem } from '../../types';
import {
  OPEN_SOURCE_FONTS,
  TEXT_COLOR_PRESETS,
  STROKE_COLOR_PRESETS,
  QUICK_MEME_TEXTS,
  StickerTextConfig,
  DEFAULT_STICKER_TEXT_CONFIG,
  drawStickerText,
  EraseAction,
  applyEraseActions,
} from '../../utils/stickerFontPresets';
import { burnTextToStickerItem, revertStickerText } from '../../utils/stickerTextBurner';
import { decodeGif } from '../../utils/gifProcessor';

interface StickerTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickers: SlicedStickerItem[];
  initialStickerIndex?: number;
  onUpdateSticker: (updatedSticker: SlicedStickerItem) => void;
  onBatchUpdateStickers?: (updatedStickers: SlicedStickerItem[]) => void;
}

export const StickerTextEditorModal: React.FC<StickerTextEditorModalProps> = ({
  isOpen,
  onClose,
  stickers,
  initialStickerIndex = 1,
  onUpdateSticker,
  onBatchUpdateStickers,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialStickerIndex);
  const currentSticker = stickers.find((s) => s.index === currentIndex) || stickers[0];

  // Tool mode: Text adding vs Original Text Erasing
  const [activeToolMode, setActiveToolMode] = useState<'text' | 'erase'>('text');

  // Text configuration state
  const [config, setConfig] = useState<StickerTextConfig>(() => {
    return currentSticker?.textConfig || { ...DEFAULT_STICKER_TEXT_CONFIG };
  });

  // Eraser state (wiping out original text)
  const [eraseActions, setEraseActions] = useState<EraseAction[]>(() => {
    return currentSticker?.textConfig?.eraseActions || [];
  });
  const [eraseTool, setEraseTool] = useState<'brush' | 'rect' | 'eyedropper'>('brush');
  const [eraseFillType, setEraseFillType] = useState<'color' | 'transparent'>('color');
  const [eraseColor, setEraseColor] = useState<string>('#ffffff');
  const [brushSize, setBrushSize] = useState<number>(18);
  const [eraseHistory, setEraseHistory] = useState<EraseAction[][]>([
    currentSticker?.textConfig?.eraseActions || [],
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<EraseAction | null>(null);
  const [activeRect, setActiveRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [eyedropperToast, setEyedropperToast] = useState<string | null>(null);

  // Background preview mode in modal
  const [previewBg, setPreviewBg] = useState<'checker' | 'white' | 'dark' | 'wechat'>('wechat');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchApplying, setIsBatchApplying] = useState(false);

  // Animated GIF playback state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [decodedFrames, setDecodedFrames] = useState<{ imageData: ImageData; delay: number }[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const animTimerRef = useRef<number | null>(null);

  // Sync index when initialStickerIndex changes
  useEffect(() => {
    if (initialStickerIndex && stickers.some((s) => s.index === initialStickerIndex)) {
      setCurrentIndex(initialStickerIndex);
    }
  }, [initialStickerIndex, stickers]);

  // Load configuration for current sticker
  useEffect(() => {
    if (currentSticker) {
      if (currentSticker.textConfig) {
        setConfig({ ...currentSticker.textConfig });
        const existingErase = currentSticker.textConfig.eraseActions || [];
        setEraseActions(existingErase);
        setEraseHistory([existingErase]);
        setHistoryIndex(0);
      } else {
        setConfig((prev) => ({
          ...DEFAULT_STICKER_TEXT_CONFIG,
          text: prev.text || '', // keep current draft text if user was typing
          eraseActions: [],
        }));
        setEraseActions([]);
        setEraseHistory([[]]);
        setHistoryIndex(0);
      }
    }
  }, [currentIndex]);

  // Decode GIF or static image frames for smooth live preview
  useEffect(() => {
    let cancelled = false;
    async function loadFrames() {
      if (!currentSticker) return;
      const isGif =
        currentSticker.frameCount > 1 ||
        currentSticker.name.toLowerCase().endsWith('.gif') ||
        currentSticker.blob.type === 'image/gif';

      const sourceBlob = currentSticker.rawBlob || currentSticker.blob;

      if (isGif) {
        try {
          const buf = await sourceBlob.arrayBuffer();
          const decoded = await decodeGif(buf);
          if (cancelled) return;
          setDecodedFrames(decoded.frames);
          setCurrentFrameIdx(0);
        } catch (err) {
          console.error('Failed to decode GIF for preview', err);
        }
      } else {
        // Static image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled) return;
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, c.width, c.height);
            setDecodedFrames([{ imageData: imgData, delay: 1000 }]);
            setCurrentFrameIdx(0);
          }
        };
        img.src = currentSticker.rawUrl || currentSticker.url;
      }
    }

    loadFrames();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentSticker]);

  // Loop animated playback of decoded frames
  useEffect(() => {
    if (decodedFrames.length <= 1) return;
    const currentFrame = decodedFrames[currentFrameIdx];
    const delay = currentFrame ? Math.max(30, currentFrame.delay) : 100;

    animTimerRef.current = window.setTimeout(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % decodedFrames.length);
    }, delay);

    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [currentFrameIdx, decodedFrames]);

  // Render composite image with manual erase & stylized text on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || decodedFrames.length === 0) return;

    const frame = decodedFrames[currentFrameIdx] || decodedFrames[0];
    if (!frame) return;

    const w = frame.imageData.width;
    const h = frame.imageData.height;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(frame.imageData, 0, 0);

    // 1. Apply committed manual erase actions (wipe out original text)
    if (eraseActions.length > 0) {
      applyEraseActions(ctx, eraseActions);
    }

    // 2. Render live preview of active stroke while dragging
    if (currentStroke && currentStroke.points && currentStroke.points.length > 0) {
      applyEraseActions(ctx, [currentStroke]);
    }

    // 3. Render live preview of active box wipe while dragging
    if (activeRect) {
      applyEraseActions(ctx, [
        {
          type: 'rect',
          fillType: eraseFillType,
          color: eraseColor,
          size: brushSize,
          rect: {
            x: activeRect.startX,
            y: activeRect.startY,
            w: activeRect.currentX - activeRect.startX,
            h: activeRect.currentY - activeRect.startY,
          },
        },
      ]);
      // Draw temporary dashed guide box around the selection
      ctx.save();
      ctx.strokeStyle = '#07c160';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      const rx = Math.min(activeRect.startX, activeRect.currentX);
      const ry = Math.min(activeRect.startY, activeRect.currentY);
      const rw = Math.abs(activeRect.currentX - activeRect.startX);
      const rh = Math.abs(activeRect.currentY - activeRect.startY);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    // 4. Draw live stylized text overlay (if text is entered)
    if (config.text && config.text.trim().length > 0) {
      drawStickerText(ctx, config, w, h);
    }
  }, [
    currentFrameIdx,
    decodedFrames,
    config,
    eraseActions,
    currentStroke,
    activeRect,
    eraseFillType,
    eraseColor,
    brushSize,
  ]);

  if (!isOpen || !currentSticker) return null;

  // Coordinate helper converting pointer screen position to natural canvas pixels
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y)),
    };
  };

  // Commit an erase action to current state and history
  const commitNewEraseAction = (action: EraseAction) => {
    const updated = [...eraseActions, action];
    setEraseActions(updated);
    setConfig((prev) => ({ ...prev, eraseActions: updated }));

    const truncated = eraseHistory.slice(0, historyIndex + 1);
    truncated.push(updated);
    setEraseHistory(truncated);
    setHistoryIndex(truncated.length - 1);
  };

  // Undo manual erase
  const handleUndoErase = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const prevActions = eraseHistory[nextIdx];
      setHistoryIndex(nextIdx);
      setEraseActions(prevActions);
      setConfig((prev) => ({ ...prev, eraseActions: prevActions }));
    }
  };

  // Redo manual erase
  const handleRedoErase = () => {
    if (historyIndex < eraseHistory.length - 1) {
      const nextIdx = historyIndex + 1;
      const nextActions = eraseHistory[nextIdx];
      setHistoryIndex(nextIdx);
      setEraseActions(nextActions);
      setConfig((prev) => ({ ...prev, eraseActions: nextActions }));
    }
  };

  // Clear all erase actions on current sticker
  const handleClearAllErase = () => {
    if (eraseActions.length === 0) return;
    setEraseActions([]);
    setConfig((prev) => ({ ...prev, eraseActions: [] }));
    const truncated = [...eraseHistory.slice(0, historyIndex + 1), []];
    setEraseHistory(truncated);
    setHistoryIndex(truncated.length - 1);
  };

  // Pointer event handlers on Canvas for drawing & wiping
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeToolMode !== 'erase') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCanvasCoords(e);

    // Eyedropper sampling
    if (eraseTool === 'eyedropper') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pixel = ctx.getImageData(coords.x, coords.y, 1, 1).data;
          const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
          setEraseColor(hex);
          setEraseFillType('color');
          setEraseTool('brush');
          setEyedropperToast(`已吸取颜色: ${hex.toUpperCase()}`);
          setTimeout(() => setEyedropperToast(null), 2200);
        }
      }
      return;
    }

    // Box Rect wipe
    if (eraseTool === 'rect') {
      setIsDrawing(true);
      setActiveRect({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
      return;
    }

    // Brush wipe
    setIsDrawing(true);
    setCurrentStroke({
      id: Math.random().toString(36).substring(2),
      type: 'brush',
      fillType: eraseFillType,
      color: eraseColor,
      size: brushSize,
      points: [coords],
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeToolMode !== 'erase' || !isDrawing) return;
    const coords = getCanvasCoords(e);

    if (eraseTool === 'rect' && activeRect) {
      setActiveRect((prev) => (prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null));
    } else if (eraseTool === 'brush' && currentStroke) {
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...(prev.points || []), coords] } : null
      );
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeToolMode !== 'erase' || !isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(false);

    if (eraseTool === 'rect' && activeRect) {
      const w = activeRect.currentX - activeRect.startX;
      const h = activeRect.currentY - activeRect.startY;
      if (Math.abs(w) > 2 || Math.abs(h) > 2) {
        commitNewEraseAction({
          id: Math.random().toString(36).substring(2),
          type: 'rect',
          fillType: eraseFillType,
          color: eraseColor,
          size: brushSize,
          rect: {
            x: activeRect.startX,
            y: activeRect.startY,
            w,
            h,
          },
        });
      }
      setActiveRect(null);
    } else if (eraseTool === 'brush' && currentStroke) {
      if (currentStroke.points && currentStroke.points.length > 0) {
        commitNewEraseAction(currentStroke);
      }
      setCurrentStroke(null);
    }
  };

  // Apply text & erase to current sticker
  const handleApplyCurrent = async () => {
    if (!currentSticker || isProcessing) return;
    setIsProcessing(true);
    try {
      const currentConfig: StickerTextConfig = {
        ...config,
        eraseActions,
      };

      const hasText = config.text && config.text.trim().length > 0;
      const hasErase = eraseActions.length > 0;

      if (!hasText && !hasErase) {
        // Clear text & eraser, revert to raw image
        const restored = revertStickerText(currentSticker);
        onUpdateSticker(restored);
      } else {
        const updated = await burnTextToStickerItem(currentSticker, currentConfig);
        onUpdateSticker(updated);
      }
    } catch (err) {
      console.error('Failed to apply text or erase', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear text & erase on current sticker
  const handleClearTextAndErase = () => {
    setConfig((prev) => ({ ...prev, text: '', eraseActions: [] }));
    setEraseActions([]);
    setEraseHistory([[]]);
    setHistoryIndex(0);
    if (currentSticker.textConfig) {
      const restored = revertStickerText(currentSticker);
      onUpdateSticker(restored);
    }
  };

  // Batch apply current font & orientation styles to all stickers in set
  const handleBatchApplyAll = async () => {
    if (stickers.length === 0 || isBatchApplying) return;
    setIsBatchApplying(true);
    try {
      const updatedList: SlicedStickerItem[] = [];
      for (const s of stickers) {
        const targetText = s.textConfig?.text || config.text;
        const targetErase = s.textConfig?.eraseActions || [];

        if ((targetText && targetText.trim().length > 0) || targetErase.length > 0) {
          const itemConfig: StickerTextConfig = {
            ...config,
            text: targetText,
            eraseActions: targetErase,
          };
          const updated = await burnTextToStickerItem(s, itemConfig);
          updatedList.push(updated);
        } else {
          updatedList.push(s);
        }
      }
      if (onBatchUpdateStickers) {
        onBatchUpdateStickers(updatedList);
      } else {
        updatedList.forEach((it) => onUpdateSticker(it));
      }
    } catch (err) {
      console.error('Failed to batch apply text style', err);
    } finally {
      setIsBatchApplying(false);
    }
  };

  const getBgStyle = () => {
    switch (previewBg) {
      case 'white':
        return { backgroundColor: '#ffffff' };
      case 'dark':
        return { backgroundColor: '#191919' };
      case 'wechat':
        return { backgroundColor: '#ededed' }; // WeChat mobile chat grey
      case 'checker':
      default:
        return {
          backgroundImage: `
            linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
            linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
            linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
          `,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#ffffff',
        };
    }
  };

  const currentFont = OPEN_SOURCE_FONTS.find((f) => f.id === config.fontId) || OPEN_SOURCE_FONTS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden border border-stone-200">
        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#07c160] flex items-center justify-center shadow-2xs">
              <Type className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900">表情包文字与旧文字抹除工作台</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#07c160]" />
                  开源商用免费字体
                </span>
              </div>
              <p className="text-xs text-stone-500">
                支持手动抹除原有旧文字/水印 · 横排与竖排任意切换 · 实时动图逐帧同步渲染
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sticker Navigation */}
            <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev > 1 ? prev - 1 : stickers.length))}
                className="p-1 hover:bg-stone-100 rounded text-stone-600 transition-colors cursor-pointer"
                title="上一个表情"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-xs font-bold text-stone-800">
                {String(currentIndex).padStart(2, '0')} / {String(stickers.length).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev < stickers.length ? prev + 1 : 1))}
                className="p-1 hover:bg-stone-100 rounded text-stone-600 transition-colors cursor-pointer"
                title="下一个表情"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {/* LEFT COLUMN: LIVE STAGE & ERASER TOOLBOX (md:col-span-5) */}
          <div className="md:col-span-5 p-4.5 bg-stone-50/50 flex flex-col justify-between gap-3 overflow-y-auto">
            {/* Header info & background switches */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs font-bold text-stone-700">
                <span>正在编辑:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-900 shadow-2xs">
                  {currentSticker.name}
                </span>
                <span className="text-[10px] text-stone-400">
                  ({currentSticker.width}×{currentSticker.height}
                  {currentSticker.frameCount > 1 ? ` · ${currentSticker.frameCount}帧` : ''})
                </span>
              </div>

              {/* Background preview mode */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-stone-200 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewBg('wechat')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    previewBg === 'wechat' ? 'bg-[#ededed] font-bold text-stone-900' : 'text-stone-500'
                  }`}
                  title="微信聊天浅灰背景 (237,237,237)"
                >
                  微信底
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('white')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    previewBg === 'white'
                      ? 'bg-white font-bold text-stone-900 border border-stone-300'
                      : 'text-stone-500'
                  }`}
                  title="纯白底"
                >
                  白底
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('dark')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    previewBg === 'dark' ? 'bg-stone-800 text-white font-bold' : 'text-stone-500'
                  }`}
                  title="夜间暗黑底"
                >
                  暗底
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('checker')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    previewBg === 'checker' ? 'bg-stone-200 font-bold text-stone-900' : 'text-stone-500'
                  }`}
                  title="透明棋盘格"
                >
                  透底
                </button>
              </div>
            </div>

            {/* MODE SWITCHER TABS: 🔤 配字设计 vs 🧹 抹除原有文字 */}
            <div className="w-full flex items-center p-1 bg-stone-200/70 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveToolMode('text')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeToolMode === 'text'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Type className="w-3.5 h-3.5 text-[#07c160]" />
                <span>🔤 添加新文字</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveToolMode('erase')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                  activeToolMode === 'erase'
                    ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-400'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Eraser className="w-3.5 h-3.5 text-emerald-600" />
                <span>🧹 手动抹除原有文字</span>
                {eraseActions.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                    {eraseActions.length}处
                  </span>
                )}
              </button>
            </div>

            {/* ERASER TOOLBAR (Visible when Erase Mode is active) */}
            {activeToolMode === 'erase' && (
              <div className="w-full bg-white rounded-xl p-2.5 border border-emerald-300 shadow-xs space-y-2.5 animate-in fade-in duration-150">
                {/* 1. Tools: Brush / Box Rect / Eyedropper */}
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEraseTool('brush')}
                      className={`h-7 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        eraseTool === 'brush'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                      title="自由画笔涂抹消除旧文字"
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      <span>涂抹画笔</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEraseTool('rect')}
                      className={`h-7 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        eraseTool === 'rect'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                      title="框选矩形区域，一键瞬间消除文字"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>框选消除</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEraseTool('eyedropper')}
                      className={`h-7 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        eraseTool === 'eyedropper'
                          ? 'bg-emerald-700 text-white shadow-2xs ring-2 ring-emerald-400'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                      title="点击画面吸取底色，消除后与背景完全浑然一体"
                    >
                      <Pipette className="w-3.5 h-3.5" />
                      <span>吸底色</span>
                    </button>
                  </div>

                  {/* Undo / Redo / Clear */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleUndoErase}
                      disabled={historyIndex <= 0}
                      className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                      title="撤销上一步涂抹"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedoErase}
                      disabled={historyIndex >= eraseHistory.length - 1}
                      className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                      title="重做"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                    {eraseActions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllErase}
                        className="h-7 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="清空所有抹除区域，恢复原图底版"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>清空</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Fill Type & Color Selection */}
                <div className="flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-stone-100 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-stone-600">消除填充:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEraseFillType('color');
                        setEraseColor('#ffffff');
                      }}
                      className={`h-6 px-2 rounded-md border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        eraseFillType === 'color' && eraseColor.toLowerCase() === '#ffffff'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-stone-300 bg-white" />
                      <span>纯白遮盖</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEraseFillType('color');
                        setEraseColor('#ededed');
                      }}
                      className={`h-6 px-2 rounded-md border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        eraseFillType === 'color' && eraseColor.toLowerCase() === '#ededed'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-stone-300 bg-[#ededed]" />
                      <span>微信灰</span>
                    </button>

                    {/* Custom Color Picker */}
                    <label className="h-6 px-1.5 rounded-md border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-[10px] font-medium flex items-center gap-1 cursor-pointer">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-stone-300 shrink-0"
                        style={{ backgroundColor: eraseColor }}
                      />
                      <input
                        type="color"
                        value={eraseColor}
                        onChange={(e) => {
                          setEraseFillType('color');
                          setEraseColor(e.target.value);
                        }}
                        className="opacity-0 w-0 h-0"
                      />
                      <span>自选色</span>
                    </label>

                    {/* Transparent Eraser */}
                    <button
                      type="button"
                      onClick={() => setEraseFillType('transparent')}
                      className={`h-6 px-2 rounded-md border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        eraseFillType === 'transparent'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                      title="直接将像素抹为完全透明，适用于透明背景贴纸"
                    >
                      <span>🏁 透明消除</span>
                    </button>
                  </div>
                </div>

                {/* 3. Brush Size Slider */}
                {eraseTool === 'brush' && (
                  <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                    <span className="text-[11px] text-stone-500 shrink-0">画笔粗细:</span>
                    <input
                      type="range"
                      min="6"
                      max="48"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value, 10) || 16)}
                      className="w-full accent-emerald-600 cursor-pointer h-1.5"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      {[10, 18, 28, 40].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setBrushSize(sz)}
                          className={`w-6 h-5 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                            brushSize === sz
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Eyedropper toast */}
                {eyedropperToast && (
                  <div className="p-1 px-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold text-center animate-in fade-in">
                    {eyedropperToast}
                  </div>
                )}
              </div>
            )}

            {/* STAGE CANVAS */}
            <div className="flex-1 w-full flex items-center justify-center min-h-[250px] py-1">
              <div
                className={`relative rounded-2xl overflow-hidden border-2 shadow-lg flex items-center justify-center transition-all max-w-[280px] max-h-[280px] w-full aspect-square ${
                  activeToolMode === 'erase'
                    ? 'border-emerald-500 ring-2 ring-emerald-400/30'
                    : 'border-stone-300'
                }`}
                style={getBgStyle()}
              >
                <canvas
                  ref={canvasRef}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  className={`w-full h-full object-contain touch-none select-none ${
                    activeToolMode === 'erase'
                      ? eraseTool === 'eyedropper'
                        ? 'cursor-crosshair'
                        : 'cursor-crosshair'
                      : 'pointer-events-none'
                  }`}
                  title={
                    activeToolMode === 'erase'
                      ? eraseTool === 'rect'
                        ? '按住鼠标拖拽框选，一键抹除选定区域文字'
                        : eraseTool === 'eyedropper'
                        ? '点击画面取色'
                        : '直接在画面上涂抹以消除旧文字'
                      : '表情包预览'
                  }
                />

                {/* Interactive Erase Guide Badge */}
                {activeToolMode === 'erase' && (
                  <div className="absolute top-2 inset-x-2 pointer-events-none flex justify-center">
                    <span className="text-[10px] font-bold text-emerald-900 bg-white/90 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-xs backdrop-blur-2xs flex items-center gap-1">
                      {eraseTool === 'rect' ? (
                        <>
                          <Square className="w-3 h-3 text-emerald-600" />
                          <span>拖动框选旧文字区域，松手瞬间抹除</span>
                        </>
                      ) : eraseTool === 'eyedropper' ? (
                        <>
                          <Pipette className="w-3 h-3 text-emerald-600" />
                          <span>点击画面中任意位置吸取底色</span>
                        </>
                      ) : (
                        <>
                          <Paintbrush className="w-3 h-3 text-emerald-600" />
                          <span>直接在旧文字上涂抹覆盖抹除</span>
                        </>
                      )}
                    </span>
                  </div>
                )}

                {/* Empty text notice when in text mode */}
                {activeToolMode === 'text' && (!config.text || config.text.trim().length === 0) && (
                  <div className="absolute inset-x-2 bottom-3 pointer-events-none text-center">
                    <span className="text-[11px] font-medium text-stone-500/80 bg-white/80 px-2 py-0.5 rounded-full border border-stone-200/50 backdrop-blur-2xs">
                      在右侧输入新文字 (支持横排 / 竖排)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* QUICK ACTIONS UNDER PREVIEW */}
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyCurrent}
                  disabled={isProcessing}
                  className="flex-1 py-2 px-3 bg-[#07c160] hover:bg-[#06ad56] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>写入并更新此表情</span>
                </button>

                {(currentSticker.textConfig || eraseActions.length > 0) && (
                  <button
                    type="button"
                    onClick={handleClearTextAndErase}
                    className="py-2 px-2.5 bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 border border-stone-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    title="恢复原样，清除写入的文字和涂抹"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Batch Apply button */}
              {stickers.length > 1 && (
                <button
                  type="button"
                  onClick={handleBatchApplyAll}
                  disabled={isBatchApplying}
                  className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="将当前选择的字体、字号、颜色、排版方向与描边样式一键批量应用到全部表情包"
                >
                  {isBatchApplying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>将字体与排版样式批量应用到全部 {stickers.length} 个表情</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: CONTROLS & SETTINGS (md:col-span-7) */}
          <div className="md:col-span-7 p-5 space-y-4.5 overflow-y-auto max-h-[78vh]">
            {/* 1. TEXT INPUT & QUICK MEME PHRASES */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-[#07c160]" />
                  <span>1. 配字文案 (Text)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveToolMode('erase')}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Eraser className="w-3 h-3 text-emerald-600" />
                    <span>先抹除旧字</span>
                  </button>
                  {config.text && (
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, text: '' }))}
                      className="text-[11px] text-stone-400 hover:text-red-500 cursor-pointer"
                    >
                      清空输入
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={config.text}
                onChange={(e) => setConfig((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="在此输入文字（如：收到、哈哈哈哈、点赞、绝了）"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#07c160] focus:border-transparent font-bold text-stone-900 shadow-2xs"
              />

              {/* Quick meme buttons */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[10px] text-stone-400 mr-0.5">常用词:</span>
                {QUICK_MEME_TEXTS.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, text: phrase }))}
                    className="px-2 py-0.5 rounded-md text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. OPEN SOURCE COMMERCIALLY USABLE FONT PICKER */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>2. 开源可商用艺术字体 (Font Family)</span>
                </label>
                <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {currentFont.license}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                {OPEN_SOURCE_FONTS.map((font) => {
                  const isSelected = config.fontId === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          fontId: font.id,
                          fontFamily: font.cssFamily,
                          fontWeight: font.defaultWeight,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#07c160] bg-emerald-50/60 ring-2 ring-[#07c160]/20 shadow-xs'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-stone-800 truncate">{font.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                            isSelected
                              ? 'bg-[#07c160] text-white'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {font.tag}
                        </span>
                      </div>
                      <div
                        className="text-stone-900 text-base font-bold truncate tracking-wide py-0.5"
                        style={{ fontFamily: font.cssFamily }}
                      >
                        {config.text ? config.text : '点赞收到 666'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. FONT SIZE & POSITION & ORIENTATION */}
            <div className="space-y-3 bg-stone-50/70 p-3 rounded-xl border border-stone-200">
              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700">3. 字号大小 (Font Size)</span>
                  <span className="text-xs font-mono font-bold text-[#07c160] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    {config.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="56"
                  value={config.fontSize}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, fontSize: parseInt(e.target.value, 10) || 24 }))
                  }
                  className="w-full accent-[#07c160] cursor-pointer h-2"
                />
                <div className="flex items-center gap-1">
                  {[18, 22, 26, 32, 40].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, fontSize: sz }))}
                      className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                        config.fontSize === sz
                          ? 'bg-[#07c160] text-white border-[#07c160]'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Orientation: Horizontal vs Vertical */}
              <div className="space-y-2 pt-2 border-t border-stone-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#07c160]" />
                    <span>4. 排版方向与位置 (Position)</span>
                  </span>
                  <span className="text-[10px] font-bold text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {config.orientation === 'vertical' ? '↕️ 竖向排版' : '↔️ 横向排版'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        orientation: 'horizontal',
                        position:
                          prev.position === 'left' || prev.position === 'right' ? 'bottom' : prev.position,
                      }))
                    }
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      config.orientation !== 'vertical'
                        ? 'bg-[#07c160] text-white border-[#07c160] shadow-2xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>↔️ 横排文字</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        orientation: 'vertical',
                        position:
                          prev.position === 'top' || prev.position === 'bottom' ? 'right' : prev.position,
                      }))
                    }
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      config.orientation === 'vertical'
                        ? 'bg-[#07c160] text-white border-[#07c160] shadow-2xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowDownUp className="w-3.5 h-3.5" />
                    <span>↕️ 竖排文字 (表情包推荐)</span>
                  </button>
                </div>

                {/* Preset Position Buttons */}
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  {(config.orientation === 'vertical'
                    ? [
                        { id: 'right', label: '右侧竖排' },
                        { id: 'center', label: '居中竖排' },
                        { id: 'left', label: '左侧竖排' },
                      ]
                    : [
                        { id: 'bottom', label: '底部居中' },
                        { id: 'top', label: '顶部居中' },
                        { id: 'center', label: '画面正中' },
                      ]
                  ).map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          position: pos.id as any,
                        }))
                      }
                      className={`py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        config.position === pos.id
                          ? 'bg-[#07c160] text-white border-[#07c160] shadow-2xs'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>

                {/* Position Fine-Tuning: X & Y */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200/50">
                  {/* Vertical Y Offset */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>上下垂直微调</span>
                      <span className="font-mono text-[10px] text-stone-500 font-bold">
                        {config.offsetY || 0}px
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={config.offsetY || 0}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, offsetY: parseInt(e.target.value, 10) || 0 }))
                        }
                        className="w-full accent-stone-700 cursor-pointer h-1.5"
                      />
                      {(config.offsetY || 0) !== 0 && (
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offsetY: 0 }))}
                          className="text-[10px] text-stone-400 hover:text-stone-700 underline shrink-0 cursor-pointer"
                        >
                          归零
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Horizontal X Offset */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>左右水平微调</span>
                      <span className="font-mono text-[10px] text-stone-500 font-bold">
                        {config.offsetX || 0}px
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={config.offsetX || 0}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, offsetX: parseInt(e.target.value, 10) || 0 }))
                        }
                        className="w-full accent-stone-700 cursor-pointer h-1.5"
                      />
                      {(config.offsetX || 0) !== 0 && (
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, offsetX: 0 }))}
                          className="text-[10px] text-stone-400 hover:text-stone-700 underline shrink-0 cursor-pointer"
                        >
                          归零
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. TEXT COLOR PALETTE & CUSTOM COLOR */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-500" />
                  <span>5. 文字填充颜色 (Color)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-stone-300 shadow-2xs inline-block"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="font-mono text-xs font-bold text-stone-700">{config.color}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {TEXT_COLOR_PRESETS.map((color) => {
                  const isSelected = config.color.toLowerCase() === color.value.toLowerCase();
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, color: color.value }))}
                      className={`h-7 px-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 ring-2 ring-stone-900/20 bg-stone-100 shadow-2xs scale-102'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-stone-300 shrink-0"
                        style={{ backgroundColor: color.value }}
                      />
                      <span className="text-[11px] text-stone-700">{color.name}</span>
                    </button>
                  );
                })}

                {/* Custom Native Color Picker */}
                <label className="h-7 px-2 rounded-lg border border-dashed border-stone-300 bg-white hover:bg-stone-50 text-stone-600 text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => setConfig((prev) => ({ ...prev, color: e.target.value }))}
                    className="opacity-0 w-0 h-0"
                  />
                  <span>自选色...</span>
                </label>
              </div>
            </div>

            {/* 5. STROKE & OUTLINE OPTIONS */}
            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.strokeEnabled}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, strokeEnabled: e.target.checked }))
                    }
                    className="rounded text-[#07c160] focus:ring-[#07c160] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-amber-600" />
                    <span>6. 开启抗吃字描边 (Stroke / Outline)</span>
                  </span>
                </label>

                <span className="text-[10px] text-amber-800 font-medium">
                  {config.strokeEnabled ? `粗细: ${config.strokeWidth}px` : '已禁用描边'}
                </span>
              </div>

              {config.strokeEnabled && (
                <div className="space-y-2 pt-1 border-t border-amber-200/60">
                  {/* Stroke Width Slider */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-600 shrink-0">描边粗细:</span>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={config.strokeWidth}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          strokeWidth: parseInt(e.target.value, 10) || 3,
                        }))
                      }
                      className="w-full accent-amber-600 cursor-pointer h-1.5"
                    />
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 6].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, strokeWidth: w }))}
                          className={`w-5 h-5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                            config.strokeWidth === w
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stroke Color */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-stone-600 shrink-0">描边颜色:</span>
                    {STROKE_COLOR_PRESETS.map((sc) => {
                      const isSel = config.strokeColor.toLowerCase() === sc.value.toLowerCase();
                      return (
                        <button
                          key={sc.value}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, strokeColor: sc.value }))}
                          className={`h-6 px-2 rounded-md border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isSel
                              ? 'border-amber-700 bg-white ring-1 ring-amber-600 text-stone-900 shadow-2xs'
                              : 'border-stone-200 bg-white/80 text-stone-600 hover:bg-white'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-stone-400"
                            style={{ backgroundColor: sc.value }}
                          />
                          <span>{sc.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}

                    <label className="h-6 px-1.5 rounded-md border border-dashed border-stone-300 bg-white text-[10px] text-stone-600 flex items-center gap-1 cursor-pointer">
                      <input
                        type="color"
                        value={config.strokeColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, strokeColor: e.target.value }))}
                        className="opacity-0 w-0 h-0"
                      />
                      <span>自选色...</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 bg-stone-50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">
              当前表情: <span className="font-bold text-stone-800">{currentSticker.name}</span>
            </span>
            {eraseActions.length > 0 && (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                已抹除 {eraseActions.length} 处旧文字
              </span>
            )}
            {config.text && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                新文字:「{config.text}」({config.orientation === 'vertical' ? '竖排' : '横排'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-4 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleApplyCurrent}
              disabled={isProcessing}
              className="py-1.5 px-5 bg-[#07c160] hover:bg-[#06ad56] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>保存并完成</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
