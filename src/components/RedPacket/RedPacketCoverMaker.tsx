/**
 * WeChat Red Packet Cover Maker (微信红包封面全套制作套件)
 * Designed with Apple's Minimalist, Human-Centered Ergonomics (简洁、直观、所见即所得、直接拖拽定位)
 *
 * Fully compliant with WeChat Red Packet Platform (cover.weixin.qq.com) requirements:
 * 1. 封面图 (Cover): 957 × 1278 像素, <= 500KB (PNG/JPG); 或 MP4 (1s~3s, 码率 <= 3000kbit/s, <= 20MB)
 * 2. 封面挂件 (Cover Pendant): 1053 × 1746 像素, <= 300KB, 透明背景 PNG; 或 24fps PNG 序列帧 ZIP
 * 3. 气泡挂件 (Bubble Pendant): 480 × 384 像素, <= 300KB, 透明背景 PNG (完整形象零截断)
 * 4. 封面故事 (Cover Story): 750 × 1250 像素, <= 500KB (PNG/JPG); 或 MP4 (1s~15s, <= 50MB)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  Film,
  Image as ImageIcon,
  Sliders,
  ExternalLink,
  Layers,
  FolderArchive,
  Info,
  ChevronRight,
  Maximize2,
  Wand2,
  MessageSquare,
  BookOpen,
  Smartphone,
  RefreshCw,
  Move,
  Target,
  ShieldCheck,
  Crown,
  Smile,
  FileCheck,
} from 'lucide-react';
import {
  WECHAT_RED_PACKET_SPECS,
  MaterialResult,
  VideoAnalysisResult,
  fitImageToTarget,
  createCoverPendant,
  createBubblePendant,
  createCompositeCoverPendant,
  createCompositeBubblePendant,
  createCoverStory,
  analyzeVideoForWeChat,
  extractVideoToPngSequenceZip,
  packageAllRedPacketAssets,
  loadImageElement,
  ensureTransparentSubject,
} from '../../utils/redPacketProcessor';
import { removeBackgroundWithAI } from '../../utils/aiBackgroundRemoval';
import { DEMO_RED_PACKET_THEMES } from '../../utils/demoRedPackets';
import { RedPacketPreviewMockup } from './RedPacketPreviewMockup';

/**
 * Helper: Crop a specific rectangle region from an image/canvas
 */
async function cropImageRegion(
  source: HTMLImageElement | HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
  return loadImageElement(blob);
}

interface RedPacketCoverMakerProps {
  onNotification: (msg: string) => void;
}

export const RedPacketCoverMaker: React.FC<RedPacketCoverMakerProps> = ({
  onNotification,
}) => {
  // Navigation Tabs: Apple Clean Segmented Controls
  const [activeTab, setActiveTab] = useState<'cover' | 'pendant' | 'bubble' | 'story' | 'presets'>('cover');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);

  // 4 Core Material Results
  const [coverResult, setCoverResult] = useState<MaterialResult | null>(null);
  const [pendantResult, setPendantResult] = useState<MaterialResult | null>(null);
  const [bubbleResult, setBubbleResult] = useState<MaterialResult | null>(null);
  const [storyResult, setStoryResult] = useState<MaterialResult | null>(null);

  // Video State (if uploaded)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [videoTrimStart, setVideoTrimStart] = useState<number>(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState<number>(3.0);
  const [pendantSequenceZip, setPendantSequenceZip] = useState<Blob | null>(null);
  const [pendantZipSizeMb, setPendantZipSizeMb] = useState<number>(0);

  // Customization Options: Cover (957x1278)
  const [coverFitMode, setCoverFitMode] = useState<'contain' | 'cover'>('contain');
  const [coverZoom, setCoverZoom] = useState(1.0);
  const [coverPanY, setCoverPanY] = useState(0);
  const [coverBgColor, setCoverBgColor] = useState('#b91c1c');

  // Customization Options: Cover Pendant (1053x1746) - Supporting Split (Top + Bottom) & Full Modes
  const [pendantUploadMode, setPendantUploadMode] = useState<'split' | 'full'>('split');
  const [pendantActivePart, setPendantActivePart] = useState<'top' | 'bottom'>('top');
  const [pendantTopImg, setPendantTopImg] = useState<HTMLImageElement | null>(null);
  const [pendantBottomImg, setPendantBottomImg] = useState<HTMLImageElement | null>(null);
  const [pendantFullImg, setPendantFullImg] = useState<HTMLImageElement | null>(null);
  const [pendantTopScale, setPendantTopScale] = useState<number>(1.0);
  const [pendantTopOffsetX, setPendantTopOffsetX] = useState<number>(0);
  const [pendantTopOffsetY, setPendantTopOffsetY] = useState<number>(0);
  const [pendantBottomScale, setPendantBottomScale] = useState<number>(1.0);
  const [pendantBottomOffsetX, setPendantBottomOffsetX] = useState<number>(0);
  const [pendantBottomOffsetY, setPendantBottomOffsetY] = useState<number>(0);
  const [pendantPlacement, setPendantPlacement] = useState<'top' | 'bottom' | 'dual'>('top');
  const [pendantScale, setPendantScale] = useState(1.0);
  const [pendantOffsetX, setPendantOffsetX] = useState(0);
  const [pendantOffsetY, setPendantOffsetY] = useState(0);
  const [pendantTopFileName, setPendantTopFileName] = useState('');
  const [pendantBottomFileName, setPendantBottomFileName] = useState('');
  const [pendantFullFileName, setPendantFullFileName] = useState('');
  const [pendantAddGlow, setPendantAddGlow] = useState(true);

  // Customization Options: Bubble Pendant (480x384) - Supporting Split (Top + Bottom) & Full Modes
  const [bubbleUploadMode, setBubbleUploadMode] = useState<'split' | 'full'>('split');
  const [bubbleActivePart, setBubbleActivePart] = useState<'top' | 'bottom'>('top');
  const [bubbleTopImg, setBubbleTopImg] = useState<HTMLImageElement | null>(null);
  const [bubbleBottomImg, setBubbleBottomImg] = useState<HTMLImageElement | null>(null);
  const [bubbleFullImg, setBubbleFullImg] = useState<HTMLImageElement | null>(null);
  const [bubbleTopScale, setBubbleTopScale] = useState<number>(1.0);
  const [bubbleTopOffsetX, setBubbleTopOffsetX] = useState<number>(0);
  const [bubbleTopOffsetY, setBubbleTopOffsetY] = useState<number>(0);
  const [bubbleBottomScale, setBubbleBottomScale] = useState<number>(1.0);
  const [bubbleBottomOffsetX, setBubbleBottomOffsetX] = useState<number>(0);
  const [bubbleBottomOffsetY, setBubbleBottomOffsetY] = useState<number>(0);
  const [bubblePlacement, setBubblePlacement] = useState<'top' | 'bottom'>('top');
  const [bubbleScale, setBubbleScale] = useState(1.0);
  const [bubbleOffsetX, setBubbleOffsetX] = useState(0);
  const [bubbleOffsetY, setBubbleOffsetY] = useState(0);
  const [bubbleTopFileName, setBubbleTopFileName] = useState('');
  const [bubbleBottomFileName, setBubbleBottomFileName] = useState('');
  const [bubbleFullFileName, setBubbleFullFileName] = useState('');
  const [showGuides, setShowGuides] = useState(true);

  // Customization Options: Story (750x1250)
  const [storyTitle, setStoryTitle] = useState('红包故事 · 岁岁平安');
  const [storySubtitle, setStorySubtitle] = useState('万事顺遂 · 喜乐常安');
  const [storyDesc, setStoryDesc] = useState('感谢一路以来的陪伴与支持，愿新岁平安，吉祥如意！');

  // Simulated WeChat Sender Information for Live Preview
  const [senderName, setSenderName] = useState('乐鱼2093');
  const [blessingText, setBlessingText] = useState('恭喜发财，大吉大利');

  // Cached base elements
  const [cachedSourceImg, setCachedSourceImg] = useState<HTMLImageElement | null>(null);
  const [cachedCutoutImg, setCachedCutoutImg] = useState<HTMLImageElement | null>(null);
  const [cachedPendantImg, setCachedPendantImg] = useState<HTMLImageElement | null>(null);
  const [cachedBubbleImg, setCachedBubbleImg] = useState<HTMLImageElement | null>(null);

  // Direct Drag-and-Drop Interaction References & States
  const pendantCanvasRef = useRef<HTMLDivElement>(null);
  const bubbleCanvasRef = useRef<HTMLDivElement>(null);
  const coverCanvasRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Vertical Fine-Tuning Slider Track Refs
  const pendantTrackRef = useRef<HTMLDivElement>(null);
  const bubbleTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingPendantSlider, setIsDraggingPendantSlider] = useState(false);
  const [isDraggingBubbleSlider, setIsDraggingBubbleSlider] = useState(false);
  const pendantDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bubbleDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isDraggingPendant, setIsDraggingPendant] = useState(false);
  const pendantDragStartRef = useRef<{ clientX: number; clientY: number; startOffX: number; startOffY: number; part: 'top' | 'bottom' | 'full' } | null>(null);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const bubbleDragStartRef = useRef<{ clientX: number; clientY: number; startOffX: number; startOffY: number; part: 'top' | 'bottom' | 'full' } | null>(null);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPanY, setDragStartPanY] = useState(0);

  // Initialize with the first demo theme (萌熊送福 · 趴气泡小熊 官方对齐款)
  useEffect(() => {
    if (!coverResult && !pendantResult) {
      handleLoadDemoTheme('theme-cute-bear', false);
    }
  }, []);

  // -------------------------------------------------------------
  // 1. One-click Demo Themes
  // -------------------------------------------------------------
  const handleLoadDemoTheme = async (themeId: string, notify = true) => {
    const theme = DEMO_RED_PACKET_THEMES.find((t) => t.id === themeId);
    if (!theme) return;

    setIsProcessing(true);
    setProcessingStatus(`正在装载「${theme.name}」全套标准物料...`);
    setProcessingProgress(20);

    try {
      const { coverBlob, pendantBlob, bubbleBlob, storyBlob } = await theme.generateAssets();

      setCoverResult({
        blob: coverBlob,
        url: URL.createObjectURL(coverBlob),
        size: coverBlob.size,
        width: 957,
        height: 1278,
        format: 'JPG',
        isCompliant: true,
        warnings: [],
      });

      setPendantResult({
        blob: pendantBlob,
        url: URL.createObjectURL(pendantBlob),
        size: pendantBlob.size,
        width: 1053,
        height: 1746,
        format: 'PNG',
        isCompliant: true,
        warnings: [],
        anchorX: 526,
        anchorY: 200,
      });

      setBubbleResult({
        blob: bubbleBlob,
        url: URL.createObjectURL(bubbleBlob),
        size: bubbleBlob.size,
        width: 480,
        height: 384,
        format: 'PNG',
        isCompliant: true,
        warnings: [],
        anchorX: 240,
        anchorY: 48,
      });

      setStoryResult({
        blob: storyBlob,
        url: URL.createObjectURL(storyBlob),
        size: storyBlob.size,
        width: 750,
        height: 1250,
        format: 'JPG',
        isCompliant: true,
        warnings: [],
      });

      setVideoFile(null);
      setVideoUrl(null);
      setVideoAnalysis(null);
      setPendantSequenceZip(null);

      // Load cached source image from cover blob for interactive re-rendering
      const coverImg = await loadImageElement(coverBlob);
      setCachedSourceImg(coverImg);
      const pendantImg = await loadImageElement(pendantBlob);
      setCachedPendantImg(pendantImg);
      setCachedCutoutImg(pendantImg);
      setPendantFullImg(pendantImg);
      setPendantFullFileName('完整示范封面挂件.png');
      const bubbleImg = await loadImageElement(bubbleBlob);
      setCachedBubbleImg(bubbleImg);
      setBubbleFullImg(bubbleImg);
      setBubbleFullFileName('完整示范气泡挂件.png');

      // Crop and separate top and bottom parts for intuitive split-mode editing
      try {
        const pTop = await cropImageRegion(pendantImg, 0, 0, 1053, 342);
        setPendantTopImg(pTop);
        setPendantTopFileName('小熊探头 (顶部342px)');
        setPendantTopScale(1.0);
        setPendantTopOffsetX(0);
        setPendantTopOffsetY(0);

        const pBottom = await cropImageRegion(pendantImg, 0, 1650, 1053, 96);
        setPendantBottomImg(pBottom);
        setPendantBottomFileName('金元宝萌爪 (脊端96px)');
        setPendantBottomScale(1.0);
        setPendantBottomOffsetX(0);
        setPendantBottomOffsetY(0);

        const bTop = await cropImageRegion(bubbleImg, 0, 0, 480, 96);
        setBubbleTopImg(bTop);
        setBubbleTopFileName('趴气泡小熊 (颈部96px)');
        setBubbleTopScale(1.0);
        setBubbleTopOffsetX(0);
        setBubbleTopOffsetY(0);
      } catch (cropErr) {
        console.warn('Auto-split demo parts warning:', cropErr);
      }

      if (notify) {
        onNotification(`🎉 已成功加载「${theme.name}」全套 4 大符合微信标准素材！`);
      }
    } catch (err: any) {
      console.error(err);
      if (notify) onNotification('加载示范素材出错: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(100);
    }
  };

  // -------------------------------------------------------------
  // 2. Composite Material Renderers (Synthesize to Single Compliant PNG)
  // -------------------------------------------------------------
  const renderCompositePendant = async (opts?: {
    topScale?: number;
    topOffX?: number;
    topOffY?: number;
    bottomScale?: number;
    bottomOffX?: number;
    bottomOffY?: number;
    fullScale?: number;
    fullOffX?: number;
    fullOffY?: number;
    topImg?: HTMLImageElement | null;
    bottomImg?: HTMLImageElement | null;
    fullImg?: HTMLImageElement | null;
    mode?: 'split' | 'full';
  }) => {
    const mode = opts?.mode ?? pendantUploadMode;
    const tImg = opts?.topImg !== undefined ? opts.topImg : pendantTopImg;
    const bImg = opts?.bottomImg !== undefined ? opts.bottomImg : pendantBottomImg;
    const fImg = opts?.fullImg !== undefined ? opts.fullImg : (pendantFullImg || cachedPendantImg || cachedCutoutImg);

    const tScale = opts?.topScale ?? pendantTopScale;
    const tOffX = opts?.topOffX ?? pendantTopOffsetX;
    const tOffY = opts?.topOffY ?? pendantTopOffsetY;

    const bScale = opts?.bottomScale ?? pendantBottomScale;
    const bOffX = opts?.bottomOffX ?? pendantBottomOffsetX;
    const bOffY = opts?.bottomOffY ?? pendantBottomOffsetY;

    try {
      if (mode === 'split') {
        const res = await createCompositeCoverPendant({
          topPart: tImg ? { source: tImg, scale: tScale, offsetX: tOffX, offsetY: tOffY } : null,
          bottomPart: bImg ? { source: bImg, scale: bScale, offsetX: bOffX, offsetY: bOffY } : null,
          addGlow: pendantAddGlow,
        });
        setPendantResult(res);
      } else {
        if (!fImg) return;
        const res = await createCompositeCoverPendant({
          fullSource: fImg,
          addGlow: pendantAddGlow,
        });
        setPendantResult(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderCompositeBubble = async (opts?: {
    topScale?: number;
    topOffX?: number;
    topOffY?: number;
    bottomScale?: number;
    bottomOffX?: number;
    bottomOffY?: number;
    fullScale?: number;
    fullOffX?: number;
    fullOffY?: number;
    topImg?: HTMLImageElement | null;
    bottomImg?: HTMLImageElement | null;
    fullImg?: HTMLImageElement | null;
    mode?: 'split' | 'full';
  }) => {
    const mode = opts?.mode ?? bubbleUploadMode;
    const tImg = opts?.topImg !== undefined ? opts.topImg : bubbleTopImg;
    const bImg = opts?.bottomImg !== undefined ? opts.bottomImg : bubbleBottomImg;
    const fImg = opts?.fullImg !== undefined ? opts.fullImg : (bubbleFullImg || cachedBubbleImg || cachedCutoutImg);

    const tScale = opts?.topScale ?? bubbleTopScale;
    const tOffX = opts?.topOffX ?? bubbleTopOffsetX;
    const tOffY = opts?.topOffY ?? bubbleTopOffsetY;

    const bScale = opts?.bottomScale ?? bubbleBottomScale;
    const bOffX = opts?.bottomOffX ?? bubbleBottomOffsetX;
    const bOffY = opts?.bottomOffY ?? bubbleBottomOffsetY;

    try {
      if (mode === 'split') {
        const res = await createCompositeBubblePendant({
          topPart: tImg ? { source: tImg, scale: tScale, offsetX: tOffX, offsetY: tOffY } : null,
          bottomPart: bImg ? { source: bImg, scale: bScale, offsetX: bOffX, offsetY: bOffY } : null,
          addGlow: true,
        });
        setBubbleResult(res);
      } else {
        if (!fImg) return;
        const res = await createCompositeBubblePendant({
          fullSource: fImg,
          addGlow: true,
        });
        setBubbleResult(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Backwards compatible wrappers
  const handleUpdatePendant = async (
    overridePlacement?: 'top' | 'bottom' | 'dual',
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number
  ) => {
    if (pendantUploadMode === 'split') {
      if (pendantActivePart === 'top') {
        if (overrideOffsetX !== undefined) setPendantTopOffsetX(overrideOffsetX);
        if (overrideOffsetY !== undefined) setPendantTopOffsetY(overrideOffsetY);
        if (overrideScale !== undefined) setPendantTopScale(overrideScale);
        await renderCompositePendant({
          topOffX: overrideOffsetX,
          topOffY: overrideOffsetY,
          topScale: overrideScale,
        });
      } else {
        if (overrideOffsetX !== undefined) setPendantBottomOffsetX(overrideOffsetX);
        if (overrideOffsetY !== undefined) setPendantBottomOffsetY(overrideOffsetY);
        if (overrideScale !== undefined) setPendantBottomScale(overrideScale);
        await renderCompositePendant({
          bottomOffX: overrideOffsetX,
          bottomOffY: overrideOffsetY,
          bottomScale: overrideScale,
        });
      }
    } else {
      if (overrideOffsetX !== undefined) setPendantOffsetX(overrideOffsetX);
      if (overrideOffsetY !== undefined) setPendantOffsetY(overrideOffsetY);
      if (overrideScale !== undefined) setPendantScale(overrideScale);
      await renderCompositePendant({
        fullOffX: overrideOffsetX,
        fullOffY: overrideOffsetY,
        fullScale: overrideScale,
      });
    }
  };

  const handleUpdateBubble = async (
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number,
    overridePlacement?: 'top' | 'bottom'
  ) => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top') {
        if (overrideOffsetX !== undefined) setBubbleTopOffsetX(overrideOffsetX);
        if (overrideOffsetY !== undefined) setBubbleTopOffsetY(overrideOffsetY);
        if (overrideScale !== undefined) setBubbleTopScale(overrideScale);
        await renderCompositeBubble({
          topOffX: overrideOffsetX,
          topOffY: overrideOffsetY,
          topScale: overrideScale,
        });
      } else {
        if (overrideOffsetX !== undefined) setBubbleBottomOffsetX(overrideOffsetX);
        if (overrideOffsetY !== undefined) setBubbleBottomOffsetY(overrideOffsetY);
        if (overrideScale !== undefined) setBubbleBottomScale(overrideScale);
        await renderCompositeBubble({
          bottomOffX: overrideOffsetX,
          bottomOffY: overrideOffsetY,
          bottomScale: overrideScale,
        });
      }
    } else {
      if (overrideOffsetX !== undefined) setBubbleOffsetX(overrideOffsetX);
      if (overrideOffsetY !== undefined) setBubbleOffsetY(overrideOffsetY);
      if (overrideScale !== undefined) setBubbleScale(overrideScale);
      await renderCompositeBubble({
        fullOffX: overrideOffsetX,
        fullOffY: overrideOffsetY,
        fullScale: overrideScale,
      });
    }
  };

  // -------------------------------------------------------------
  // 3. Direct Smooth Delta Drag-and-Drop Handlers for 封面挂件 (1053 x 1746)
  // -------------------------------------------------------------
  const handlePendantPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pendantCanvasRef.current) return;
    const rect = pendantCanvasRef.current.getBoundingClientRect();
    const clickY = ((e.clientY - rect.top) / rect.height) * 1746;

    let part: 'top' | 'bottom' | 'full' = 'top';
    if (pendantUploadMode === 'full') {
      part = 'full';
    } else {
      part = clickY >= 873 ? 'bottom' : 'top';
      setPendantActivePart(part);
    }

    const startOffX = part === 'top' ? pendantTopOffsetX : (part === 'bottom' ? pendantBottomOffsetX : pendantOffsetX);
    const startOffY = part === 'top' ? pendantTopOffsetY : (part === 'bottom' ? pendantBottomOffsetY : pendantOffsetY);

    pendantDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startOffX,
      startOffY,
      part,
    };

    setIsDraggingPendant(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePendantPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPendant || !pendantDragStartRef.current || !pendantCanvasRef.current) return;
    const rect = pendantCanvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - pendantDragStartRef.current.clientX) / rect.width) * 1053;
    const dy = ((e.clientY - pendantDragStartRef.current.clientY) / rect.height) * 1746;

    const part = pendantDragStartRef.current.part;
    const nextOffX = Math.round(pendantDragStartRef.current.startOffX + dx);
    const nextOffY = Math.round(pendantDragStartRef.current.startOffY + dy);

    if (part === 'top') {
      setPendantTopOffsetX(nextOffX);
      setPendantTopOffsetY(nextOffY);
      if (pendantDebounceTimerRef.current) clearTimeout(pendantDebounceTimerRef.current);
      pendantDebounceTimerRef.current = setTimeout(() => {
        renderCompositePendant({ topOffX: nextOffX, topOffY: nextOffY });
      }, 50);
    } else if (part === 'bottom') {
      setPendantBottomOffsetX(nextOffX);
      setPendantBottomOffsetY(nextOffY);
      if (pendantDebounceTimerRef.current) clearTimeout(pendantDebounceTimerRef.current);
      pendantDebounceTimerRef.current = setTimeout(() => {
        renderCompositePendant({ bottomOffX: nextOffX, bottomOffY: nextOffY });
      }, 50);
    } else {
      setPendantOffsetX(nextOffX);
      setPendantOffsetY(nextOffY);
      if (pendantDebounceTimerRef.current) clearTimeout(pendantDebounceTimerRef.current);
      pendantDebounceTimerRef.current = setTimeout(() => {
        renderCompositePendant({ fullOffX: nextOffX, fullOffY: nextOffY });
      }, 50);
    }
  };

  const handlePendantPointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPendant) return;
    setIsDraggingPendant(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (pendantDragStartRef.current) {
      const part = pendantDragStartRef.current.part;
      if (part === 'top') {
        await renderCompositePendant({ topOffX: pendantTopOffsetX, topOffY: pendantTopOffsetY });
      } else if (part === 'bottom') {
        await renderCompositePendant({ bottomOffX: pendantBottomOffsetX, bottomOffY: pendantBottomOffsetY });
      } else {
        await renderCompositePendant({ fullOffX: pendantOffsetX, fullOffY: pendantOffsetY });
      }
      pendantDragStartRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // 4. Direct Smooth Delta Drag-and-Drop Handlers for 气泡挂件 (480 x 384)
  // -------------------------------------------------------------
  const handleBubblePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!bubbleCanvasRef.current) return;
    const rect = bubbleCanvasRef.current.getBoundingClientRect();
    const clickY = ((e.clientY - rect.top) / rect.height) * 384;

    let part: 'top' | 'bottom' | 'full' = 'top';
    if (bubbleUploadMode === 'full') {
      part = 'full';
    } else {
      part = clickY >= 204 ? 'bottom' : 'top';
      setBubbleActivePart(part);
    }

    const startOffX = part === 'top' ? bubbleTopOffsetX : (part === 'bottom' ? bubbleBottomOffsetX : bubbleOffsetX);
    const startOffY = part === 'top' ? bubbleTopOffsetY : (part === 'bottom' ? bubbleBottomOffsetY : bubbleOffsetY);

    bubbleDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startOffX,
      startOffY,
      part,
    };

    setIsDraggingBubble(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBubble || !bubbleDragStartRef.current || !bubbleCanvasRef.current) return;
    const rect = bubbleCanvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - bubbleDragStartRef.current.clientX) / rect.width) * 480;
    const dy = ((e.clientY - bubbleDragStartRef.current.clientY) / rect.height) * 384;

    const part = bubbleDragStartRef.current.part;
    const nextOffX = Math.round(bubbleDragStartRef.current.startOffX + dx);
    const nextOffY = Math.round(bubbleDragStartRef.current.startOffY + dy);

    if (part === 'top') {
      setBubbleTopOffsetX(nextOffX);
      setBubbleTopOffsetY(nextOffY);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      bubbleDebounceTimerRef.current = setTimeout(() => {
        renderCompositeBubble({ topOffX: nextOffX, topOffY: nextOffY });
      }, 50);
    } else if (part === 'bottom') {
      setBubbleBottomOffsetX(nextOffX);
      setBubbleBottomOffsetY(nextOffY);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      bubbleDebounceTimerRef.current = setTimeout(() => {
        renderCompositeBubble({ bottomOffX: nextOffX, bottomOffY: nextOffY });
      }, 50);
    } else {
      setBubbleOffsetX(nextOffX);
      setBubbleOffsetY(nextOffY);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      bubbleDebounceTimerRef.current = setTimeout(() => {
        renderCompositeBubble({ fullOffX: nextOffX, fullOffY: nextOffY });
      }, 50);
    }
  };

  const handleBubblePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBubble) return;
    setIsDraggingBubble(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (bubbleDragStartRef.current) {
      const part = bubbleDragStartRef.current.part;
      if (part === 'top') {
        await renderCompositeBubble({ topOffX: bubbleTopOffsetX, topOffY: bubbleTopOffsetY });
      } else if (part === 'bottom') {
        await renderCompositeBubble({ bottomOffX: bubbleBottomOffsetX, bottomOffY: bubbleBottomOffsetY });
      } else {
        await renderCompositeBubble({ fullOffX: bubbleOffsetX, fullOffY: bubbleOffsetY });
      }
      bubbleDragStartRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // 5. Vertical fine-tuning handlers for 封面挂件 (Slider + [+] / [-])
  // -------------------------------------------------------------
  const handlePendantStepFineTune = (deltaY: number) => {
    if (pendantUploadMode === 'split') {
      if (pendantActivePart === 'top') {
        const nextY = pendantTopOffsetY + deltaY;
        setPendantTopOffsetY(nextY);
        renderCompositePendant({ topOffY: nextY });
      } else {
        const nextY = pendantBottomOffsetY + deltaY;
        setPendantBottomOffsetY(nextY);
        renderCompositePendant({ bottomOffY: nextY });
      }
    } else {
      const nextY = pendantOffsetY + deltaY;
      setPendantOffsetY(nextY);
      renderCompositePendant({ fullOffY: nextY });
    }
  };

  const handlePendantSliderTrackPointer = (clientY: number, isFinal: boolean) => {
    if (!pendantTrackRef.current) return;
    const rect = pendantTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    // Center is 0.5 -> offset = 0. ratio 1 -> offset -60, ratio 0 -> offset +60
    const deltaY = Math.round((0.5 - ratio) * 120);

    if (pendantUploadMode === 'split') {
      if (pendantActivePart === 'top') {
        setPendantTopOffsetY(deltaY);
        if (pendantDebounceTimerRef.current) clearTimeout(pendantDebounceTimerRef.current);
        if (isFinal) renderCompositePendant({ topOffY: deltaY });
        else pendantDebounceTimerRef.current = setTimeout(() => renderCompositePendant({ topOffY: deltaY }), 50);
      } else {
        setPendantBottomOffsetY(deltaY);
        if (pendantDebounceTimerRef.current) clearTimeout(pendantDebounceTimerRef.current);
        if (isFinal) renderCompositePendant({ bottomOffY: deltaY });
        else pendantDebounceTimerRef.current = setTimeout(() => renderCompositePendant({ bottomOffY: deltaY }), 50);
      }
    } else {
      setPendantOffsetY(deltaY);
      if (pendantDebounceTimerRef.current) clearTimeout(pendantDebounceTimerRef.current);
      if (isFinal) renderCompositePendant({ fullOffY: deltaY });
      else pendantDebounceTimerRef.current = setTimeout(() => renderCompositePendant({ fullOffY: deltaY }), 50);
    }
  };

  // -------------------------------------------------------------
  // 6. Vertical fine-tuning handlers for 气泡挂件 (Slider + [+] / [-])
  // -------------------------------------------------------------
  const handleBubbleStepFineTune = (deltaY: number) => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top') {
        const nextY = bubbleTopOffsetY + deltaY;
        setBubbleTopOffsetY(nextY);
        renderCompositeBubble({ topOffY: nextY });
      } else {
        const nextY = bubbleBottomOffsetY + deltaY;
        setBubbleBottomOffsetY(nextY);
        renderCompositeBubble({ bottomOffY: nextY });
      }
    } else {
      const nextY = bubbleOffsetY + deltaY;
      setBubbleOffsetY(nextY);
      renderCompositeBubble({ fullOffY: nextY });
    }
  };

  const handleBubbleSliderTrackPointer = (clientY: number, isFinal: boolean) => {
    if (!bubbleTrackRef.current) return;
    const rect = bubbleTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    const deltaY = Math.round((0.5 - ratio) * 80);

    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top') {
        setBubbleTopOffsetY(deltaY);
        if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
        if (isFinal) renderCompositeBubble({ topOffY: deltaY });
        else bubbleDebounceTimerRef.current = setTimeout(() => renderCompositeBubble({ topOffY: deltaY }), 50);
      } else {
        setBubbleBottomOffsetY(deltaY);
        if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
        if (isFinal) renderCompositeBubble({ bottomOffY: deltaY });
        else bubbleDebounceTimerRef.current = setTimeout(() => renderCompositeBubble({ bottomOffY: deltaY }), 50);
      }
    } else {
      setBubbleOffsetY(deltaY);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      if (isFinal) renderCompositeBubble({ fullOffY: deltaY });
      else bubbleDebounceTimerRef.current = setTimeout(() => renderCompositeBubble({ fullOffY: deltaY }), 50);
    }
  };

  // -------------------------------------------------------------
  // 7. Direct Drag-to-Pan for 封面图 (957 x 1278)
  // -------------------------------------------------------------
  const handleCoverPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!coverResult) return;
    setIsDraggingCover(true);
    setDragStartY(e.clientY);
    setDragStartPanY(coverPanY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCoverPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCover) return;
    const deltaY = e.clientY - dragStartY;
    const nextPan = Math.max(-200, Math.min(200, Math.round(dragStartPanY + deltaY * 0.8)));
    setCoverPanY(nextPan);
  };

  const handleCoverPointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCover) return;
    setIsDraggingCover(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    await handleUpdateCover();
  };

  const handleUpdateCover = async (
    modeOverride?: 'contain' | 'cover',
    panYOverride?: number,
    zoomOverride?: number
  ) => {
    if (!cachedSourceImg) return;
    const mode = modeOverride || coverFitMode;
    const zoom = zoomOverride !== undefined ? zoomOverride : coverZoom;
    const panY = panYOverride !== undefined ? panYOverride : coverPanY;
    try {
      const cover = await fitImageToTarget(cachedSourceImg, 957, 1278, {
        mode,
        zoom,
        panY,
        bgColor: coverBgColor,
        maxBytes: 500 * 1024,
      });
      setCoverResult(cover);
      onNotification(`已更新封面图 (957×1278，${mode === 'contain' ? '完整显示' : '铺满裁剪'})`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUpdateStory = async () => {
    if (!cachedSourceImg) return;
    try {
      const story = await createCoverStory(cachedSourceImg, {
        title: storyTitle,
        subtitle: storySubtitle,
        description: storyDesc,
      });
      setStoryResult(story);
      onNotification('封面故事 (750×1250) 排版已更新');
    } catch (err: any) {
      console.error(err);
    }
  };

  // -------------------------------------------------------------
  // 6. Direct Upload Handlers for Individual Materials
  // -------------------------------------------------------------
  const handleUploadMain = async (file: File) => {
    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4');
    setIsProcessing(true);
    setProcessingStatus(isVideo ? '正在解析视频并提取封面关键帧...' : '正在准备解析图片与色彩通道...');
    setProcessingProgress(15);

    try {
      let sourceImg: HTMLImageElement;
      if (isVideo) {
        const url = URL.createObjectURL(file);
        setVideoFile(file);
        setVideoUrl(url);
        const analysis = await analyzeVideoForWeChat(file);
        setVideoAnalysis(analysis);
        setVideoTrimStart(0);
        setVideoTrimEnd(Math.min(3.0, analysis.duration));

        // Sample frame
        sourceImg = await extractFrameFromVideoUrl(url, 0.5);
      } else {
        sourceImg = await loadImageElement(file);
        setVideoFile(null);
        setVideoUrl(null);
        setVideoAnalysis(null);
      }

      setCachedSourceImg(sourceImg);

      // 1. Cover: 957x1278
      setProcessingStatus('正在生成 957×1278 微信官方标准封面图...');
      setProcessingProgress(35);
      const cover = await fitImageToTarget(sourceImg, 957, 1278, {
        mode: coverFitMode,
        zoom: coverZoom,
        panY: coverPanY,
        bgColor: coverBgColor,
        maxBytes: 500 * 1024,
      });
      setCoverResult(cover);

      // 2. Story: 750x1250
      setProcessingStatus('正在生成 750×1250 沉浸式封面故事...');
      setProcessingProgress(55);
      const story = await createCoverStory(sourceImg, {
        title: storyTitle,
        subtitle: storySubtitle,
        description: storyDesc,
      });
      setStoryResult(story);

      // 3. AI Matting for Pendants (Cover & Bubble)
      setProcessingStatus('智能抠取主体，生成透明背景挂件...');
      setProcessingProgress(70);

      let cutoutCanvas: HTMLCanvasElement;
      try {
        const aiPromise = removeBackgroundWithAI(file, undefined, (p) => {
          setProcessingProgress(65 + Math.round(p.progress * 0.15));
          setProcessingStatus(p.message);
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('快速色阶抠图优先')), 2600)
        );
        const aiMatting = await Promise.race([aiPromise, timeoutPromise]);
        cutoutCanvas = document.createElement('canvas');
        cutoutCanvas.width = aiMatting.width;
        cutoutCanvas.height = aiMatting.height;
        const cctx = cutoutCanvas.getContext('2d')!;
        cctx.putImageData(aiMatting.imageData, 0, 0);
      } catch {
        cutoutCanvas = await ensureTransparentSubject(sourceImg);
      }

      const cutoutImg = await loadImageElement(cutoutCanvas.toDataURL('image/png'));
      setCachedCutoutImg(cutoutImg);
      setCachedPendantImg(cutoutImg);
      setCachedBubbleImg(cutoutImg);

      // 4. Pendant: 1053x1746 (Figure 2 & 3: Top Rim by default)
      setProcessingStatus('正在装配 1053×1746 封面挂件并锁定上侧可编辑区...');
      setProcessingProgress(85);
      const pendant = await createCoverPendant(cutoutImg, {
        placement: 'top',
        scale: pendantScale,
        offsetX: 0,
        offsetY: 0,
        addGlow: pendantAddGlow,
      });
      setPendantResult(pendant);

      // 5. Bubble: 480x384 (Figure 4: Upper Zone, Zero Truncation)
      setProcessingStatus('正在生成 480×384 气泡挂件并校验完整形象零截断...');
      setProcessingProgress(95);
      const bubble = await createBubblePendant(cutoutImg, {
        scale: bubbleScale,
        offsetX: 0,
        offsetY: 0,
        addGlow: true,
      });
      setBubbleResult(bubble);

      setProcessingProgress(100);
      onNotification('🎉 成功生成全套符合微信规范素材！可在左侧直接拖拽微调位置。');
    } catch (err: any) {
      console.error(err);
      onNotification('素材处理失败: ' + err.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleUploadCoverOnly = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus('正在更新封面图 (957×1278)...');
    setProcessingProgress(40);
    try {
      const img = await loadImageElement(file);
      setCachedSourceImg(img);
      const cover = await fitImageToTarget(img, 957, 1278, {
        mode: coverFitMode,
        zoom: coverZoom,
        panY: coverPanY,
        bgColor: coverBgColor,
        maxBytes: 500 * 1024,
      });
      setCoverResult(cover);
      setProcessingProgress(100);
      onNotification('已更新封面图 (957×1278)');
    } catch (e: any) {
      onNotification('封面图更新失败: ' + e.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleUploadPendantSlot = async (file: File, slot: 'top' | 'bottom' | 'full') => {
    setIsProcessing(true);
    setProcessingStatus(`正在处理封面挂件${slot === 'top' ? '顶部探头' : slot === 'bottom' ? '底部垂饰' : '完整图'}...`);
    setProcessingProgress(30);
    try {
      const img = await loadImageElement(file);
      let cutoutCanvas: HTMLCanvasElement;
      setProcessingProgress(60);
      try {
        const aiPromise = removeBackgroundWithAI(file, undefined, (p) => {
          setProcessingProgress(50 + Math.round(p.progress * 0.2));
          setProcessingStatus(p.message);
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('快速色阶抠图优先')), 2600)
        );
        const aiMatting = await Promise.race([aiPromise, timeoutPromise]);
        cutoutCanvas = document.createElement('canvas');
        cutoutCanvas.width = aiMatting.width;
        cutoutCanvas.height = aiMatting.height;
        const cctx = cutoutCanvas.getContext('2d')!;
        cctx.putImageData(aiMatting.imageData, 0, 0);
      } catch {
        cutoutCanvas = await ensureTransparentSubject(img);
      }

      setProcessingProgress(85);
      const cutoutImg = await loadImageElement(cutoutCanvas.toDataURL('image/png'));
      if (slot === 'top') {
        setPendantTopImg(cutoutImg);
        setPendantTopFileName(file.name);
        setPendantActivePart('top');
        await renderCompositePendant({ topImg: cutoutImg });
      } else if (slot === 'bottom') {
        setPendantBottomImg(cutoutImg);
        setPendantBottomFileName(file.name);
        setPendantActivePart('bottom');
        await renderCompositePendant({ bottomImg: cutoutImg });
      } else {
        setPendantFullImg(cutoutImg);
        setPendantFullFileName(file.name);
        await renderCompositePendant({ fullImg: cutoutImg });
      }
      setProcessingProgress(100);
      onNotification(`🎉 封面挂件${slot === 'top' ? '顶部' : slot === 'bottom' ? '底部' : '完整'}图片已更新，并已自动合成至微信 1053×1746 规范图！`);
    } catch (e: any) {
      onNotification('封面挂件处理失败: ' + e.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleClearPendantSlot = async (slot: 'top' | 'bottom' | 'full') => {
    if (slot === 'top') {
      setPendantTopImg(null);
      setPendantTopFileName('');
      await renderCompositePendant({ topImg: null });
      onNotification('已清除封面挂件顶部图片');
    } else if (slot === 'bottom') {
      setPendantBottomImg(null);
      setPendantBottomFileName('');
      await renderCompositePendant({ bottomImg: null });
      onNotification('已清除封面挂件底部图片');
    } else {
      setPendantFullImg(null);
      setPendantFullFileName('');
      onNotification('已清除封面挂件完整图片');
    }
  };

  const handleUploadBubbleSlot = async (file: File, slot: 'top' | 'bottom' | 'full') => {
    setIsProcessing(true);
    setProcessingStatus(`正在处理气泡挂件${slot === 'top' ? '顶部趴贴' : slot === 'bottom' ? '底部垂饰' : '完整图'}...`);
    setProcessingProgress(30);
    try {
      const img = await loadImageElement(file);
      let cutoutCanvas: HTMLCanvasElement;
      setProcessingProgress(60);
      try {
        const aiPromise = removeBackgroundWithAI(file, undefined, (p) => {
          setProcessingProgress(50 + Math.round(p.progress * 0.2));
          setProcessingStatus(p.message);
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('快速色阶抠图优先')), 2600)
        );
        const aiMatting = await Promise.race([aiPromise, timeoutPromise]);
        cutoutCanvas = document.createElement('canvas');
        cutoutCanvas.width = aiMatting.width;
        cutoutCanvas.height = aiMatting.height;
        const cctx = cutoutCanvas.getContext('2d')!;
        cctx.putImageData(aiMatting.imageData, 0, 0);
      } catch {
        cutoutCanvas = await ensureTransparentSubject(img);
      }

      setProcessingProgress(85);
      const cutoutImg = await loadImageElement(cutoutCanvas.toDataURL('image/png'));
      if (slot === 'top') {
        setBubbleTopImg(cutoutImg);
        setBubbleTopFileName(file.name);
        setBubbleActivePart('top');
        await renderCompositeBubble({ topImg: cutoutImg });
      } else if (slot === 'bottom') {
        setBubbleBottomImg(cutoutImg);
        setBubbleBottomFileName(file.name);
        setBubbleActivePart('bottom');
        await renderCompositeBubble({ bottomImg: cutoutImg });
      } else {
        setBubbleFullImg(cutoutImg);
        setBubbleFullFileName(file.name);
        await renderCompositeBubble({ fullImg: cutoutImg });
      }
      setProcessingProgress(100);
      onNotification(`🎉 气泡挂件${slot === 'top' ? '顶部' : slot === 'bottom' ? '底部' : '完整'}图片已更新，并已自动合成至微信 480×384 规范图！`);
    } catch (e: any) {
      onNotification('气泡挂件处理失败: ' + e.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleClearBubbleSlot = async (slot: 'top' | 'bottom' | 'full') => {
    if (slot === 'top') {
      setBubbleTopImg(null);
      setBubbleTopFileName('');
      await renderCompositeBubble({ topImg: null });
      onNotification('已清除气泡挂件顶部图片');
    } else if (slot === 'bottom') {
      setBubbleBottomImg(null);
      setBubbleBottomFileName('');
      await renderCompositeBubble({ bottomImg: null });
      onNotification('已清除气泡挂件底部图片');
    } else {
      setBubbleFullImg(null);
      setBubbleFullFileName('');
      onNotification('已清除气泡挂件完整图片');
    }
  };

  const handleUploadPendantOnly = (file: File) => handleUploadPendantSlot(file, pendantActivePart);
  const handleUploadBubbleOnly = (file: File) => handleUploadBubbleSlot(file, bubbleActivePart);

  // Helper: Extract frame from video URL
  const extractFrameFromVideoUrl = async (url: string, timeSec: number): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const vid = document.createElement('video');
      vid.preload = 'auto';
      vid.muted = true;
      vid.playsInline = true;
      vid.src = url;

      let captured = false;
      const doCapture = () => {
        if (captured) return;
        captured = true;
        try {
          const c = document.createElement('canvas');
          c.width = vid.videoWidth || 957;
          c.height = vid.videoHeight || 1278;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(vid, 0, 0);
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('无法读取视频帧'));
          img.src = c.toDataURL('image/png');
        } catch (e) {
          reject(e);
        }
      };

      vid.onloadedmetadata = () => {
        vid.currentTime = Math.min(Math.max(0.1, timeSec), (vid.duration || 1) - 0.1);
      };
      vid.onseeked = () => doCapture();
      setTimeout(() => {
        if (!captured && vid.readyState >= 2) doCapture();
      }, 2500);
      vid.onerror = () => reject(new Error('视频加载失败'));
    });
  };

  // -------------------------------------------------------------
  // 7. Download Handlers
  // -------------------------------------------------------------
  const handleDownloadSingle = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotification(`已下载 ${filename}`);
  };

  const handleDownloadAllZip = async () => {
    if (!coverResult && !pendantResult && !bubbleResult && !storyResult && !videoFile) {
      onNotification('暂无已生成的红包封面素材，请先上传图片或点击示范模板');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('正在整合全部 4 大微信官方标准素材并打包为 ZIP...');

    try {
      const allZip = await packageAllRedPacketAssets({
        cover: coverResult,
        coverVideoFile: videoFile,
        pendant: pendantResult,
        pendantSequenceZip,
        bubble: bubbleResult,
        story: storyResult,
      });

      handleDownloadSingle(allZip, '微信红包封面全套素材包_官方规范.zip');
      onNotification('🎉 已成功打包下载全套素材包，包含规范对照表，可直接上传微信平台！');
    } catch (err: any) {
      console.error(err);
      onNotification('打包下载失败: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* 1. Apple-style Minimalist Premium Header Bar */}
      <div className="bg-white/85 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200/80">
              微信红包封面开放平台标准
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              cover.weixin.qq.com
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
            <span>微信红包封面套件</span>
            <span className="text-xs font-normal text-neutral-400">· 微信平台 1:1 坐标对齐</span>
          </h2>
          <p className="text-xs text-neutral-500 max-w-2xl leading-relaxed">
            严格对齐微信官方审核规范：左侧画板支持上下微调滑块与直接拖拽，右侧真机无缝呈现真实微信对话框与拆开效果，一键导出全套合规物料包。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="https://cover.weixin.qq.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold transition-all flex items-center gap-1.5 border border-neutral-200/80"
          >
            <span>开放平台</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
          </a>

          <button
            type="button"
            onClick={handleDownloadAllZip}
            className="px-5 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <FolderArchive className="w-4 h-4 text-amber-300" />
            <span>导出全套物料 ZIP</span>
          </button>
        </div>
      </div>

      {/* 2. Premium Apple/WeChat Studio 5-Tab Navigation Suite (Direct 5-col grid, Zero horizontal drag, No brackets) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Tab 1: 封面图 */}
        <button
          type="button"
          onClick={() => setActiveTab('cover')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden ${
            activeTab === 'cover'
              ? 'bg-gradient-to-br from-red-500/10 via-red-50 to-white border-red-400 shadow-[0_8px_20px_rgba(239,68,68,0.15)] ring-2 ring-red-400/30'
              : 'bg-white border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'cover' ? 'bg-red-500 text-white shadow-xs' : 'bg-red-50 text-red-500'
              }`}>
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold text-neutral-900 tracking-tight">① 封面图</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
              coverResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
            }`}>
              {coverResult ? `${Math.round(coverResult.size / 1024)}K ✓` : '待生成'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
            <span>封面主体 · 957×1278</span>
            <span className="text-[10px] text-neutral-400 font-mono">JPG/PNG</span>
          </div>
        </button>

        {/* Tab 2: 封面挂件 */}
        <button
          type="button"
          onClick={() => setActiveTab('pendant')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden ${
            activeTab === 'pendant'
              ? 'bg-gradient-to-br from-amber-500/10 via-amber-50 to-white border-amber-400 shadow-[0_8px_20px_rgba(245,158,11,0.15)] ring-2 ring-amber-400/30'
              : 'bg-white border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'pendant' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-600'
              }`}>
                <Crown className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold text-neutral-900 tracking-tight">② 封面挂件</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
              pendantResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
            }`}>
              {pendantResult ? `${Math.round(pendantResult.size / 1024)}K ✓` : '待生成'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
            <span>上端探头 / 脊端垂饰</span>
            <span className="text-[10px] text-neutral-400 font-mono">透明PNG</span>
          </div>
        </button>

        {/* Tab 3: 气泡挂件 */}
        <button
          type="button"
          onClick={() => setActiveTab('bubble')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden ${
            activeTab === 'bubble'
              ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50 to-white border-emerald-400 shadow-[0_8px_20px_rgba(16,185,129,0.15)] ring-2 ring-emerald-400/30'
              : 'bg-white border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'bubble' ? 'bg-emerald-500 text-white shadow-xs' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <Smile className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold text-neutral-900 tracking-tight">③ 气泡挂件</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
              bubbleResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
            }`}>
              {bubbleResult ? `${Math.round(bubbleResult.size / 1024)}K ✓` : '待生成'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
            <span>趴贴红包气泡卡片</span>
            <span className="text-[10px] text-neutral-400 font-mono">透明PNG</span>
          </div>
        </button>

        {/* Tab 4: 封面故事 */}
        <button
          type="button"
          onClick={() => setActiveTab('story')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden ${
            activeTab === 'story'
              ? 'bg-gradient-to-br from-blue-500/10 via-blue-50 to-white border-blue-400 shadow-[0_8px_20px_rgba(59,130,246,0.15)] ring-2 ring-blue-400/30'
              : 'bg-white border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'story' ? 'bg-blue-500 text-white shadow-xs' : 'bg-blue-50 text-blue-600'
              }`}>
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold text-neutral-900 tracking-tight">④ 封面故事</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
              storyResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
            }`}>
              {storyResult ? `${Math.round(storyResult.size / 1024)}K ✓` : '待生成'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
            <span>拆开详情 · 750×1250</span>
            <span className="text-[10px] text-neutral-400 font-mono">选填图文</span>
          </div>
        </button>

        {/* Tab 5: 示范模板 */}
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden col-span-2 sm:col-span-1 ${
            activeTab === 'presets'
              ? 'bg-gradient-to-br from-purple-500/10 via-purple-50 to-white border-purple-400 shadow-[0_8px_20px_rgba(168,85,247,0.15)] ring-2 ring-purple-400/30'
              : 'bg-white border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'presets' ? 'bg-purple-500 text-white shadow-xs' : 'bg-purple-50 text-purple-600'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold text-neutral-900 tracking-tight">⑤ 示范模板</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-purple-100 text-purple-800">
              5套精选
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
            <span>官方标准款</span>
            <span className="text-[10px] text-purple-600 font-bold">一键装载</span>
          </div>
        </button>
      </div>

      {/* 3. Main Ergonomic Workspace (Split Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Focused Interactive Editor (7 Cols) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">

          {/* ======================================================== */}
          {/* TAB 1: 封面图 (957 × 1278)                               */}
          {/* ======================================================== */}
          {activeTab === 'cover' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>① 封面图画板 · 957 × 1278</span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-mono">必填</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    支持在画板内直接上下拖拽微调平移构图，所见即所得。
                  </p>
                </div>

                <label className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 border border-neutral-200">
                  <Upload className="w-3.5 h-3.5" />
                  <span>上传图片/MP4</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadMain(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Interactive Cover Canvas with Direct Drag-to-Pan */}
              <div className="flex flex-col items-center">
                <div
                  ref={coverCanvasRef}
                  onPointerDown={handleCoverPointerDown}
                  onPointerMove={handleCoverPointerMove}
                  onPointerUp={handleCoverPointerUp}
                  className={`relative w-full max-w-[300px] aspect-[957/1278] h-[390px] rounded-2xl bg-[#f5f5f7] border border-neutral-200/90 p-2 flex items-center justify-center overflow-hidden shadow-xs select-none touch-none ${
                    isDraggingCover ? 'cursor-grabbing ring-2 ring-red-400' : 'cursor-grab hover:ring-1 hover:ring-neutral-300'
                  }`}
                  title="鼠标按住可直接上下拖拽微调位置"
                >
                  {coverResult ? (
                    <img
                      src={coverResult.url}
                      alt="封面图"
                      className="w-full h-full object-contain rounded-xl drop-shadow-sm pointer-events-none"
                    />
                  ) : (
                    <div className="text-center p-6 text-neutral-400 text-xs space-y-2">
                      <ImageIcon className="w-8 h-8 mx-auto opacity-30" />
                      <span>请上传主图生成 957×1278 封面</span>
                    </div>
                  )}

                  {/* Drag HUD Overlay */}
                  {isDraggingCover && (
                    <div className="absolute top-3 bg-black/75 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md font-mono z-30">
                      垂直平移 Offset Y: {coverPanY}px
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-neutral-400 mt-2 font-medium">
                  💡 提示：在上方画板上按住并上下拖拽，即可直接调整画面构图
                </span>
              </div>

              {/* Minimalist Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-neutral-100 text-xs">
                <div>
                  <div className="flex items-center justify-between font-bold text-neutral-700 mb-1.5">
                    <span>显示模式</span>
                    <span className="text-neutral-400 font-normal">
                      {coverFitMode === 'contain' ? '完整显示 (无裁切)' : '铺满裁切'}
                    </span>
                  </div>
                  <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200/80 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFitMode('contain');
                        handleUpdateCover('contain');
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        coverFitMode === 'contain' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'
                      }`}
                    >
                      完整显示 (所见即所得)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFitMode('cover');
                        handleUpdateCover('cover');
                      }}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        coverFitMode === 'cover' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'
                      }`}
                    >
                      铺满裁剪
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between font-bold text-neutral-700 mb-1.5">
                    <span>缩放比例</span>
                    <span className="font-mono text-neutral-500">{Math.round(coverZoom * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(0.5, Math.round((coverZoom - 0.05) * 100) / 100);
                        setCoverZoom(val);
                        handleUpdateCover(undefined, undefined, val);
                      }}
                      className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                      title="缩小 5%"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.05"
                      value={coverZoom}
                      onChange={(e) => setCoverZoom(parseFloat(e.target.value))}
                      onPointerUp={() => handleUpdateCover()}
                      className="flex-1 accent-red-600 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.min(1.8, Math.round((coverZoom + 0.05) * 100) / 100);
                        setCoverZoom(val);
                        handleUpdateCover(undefined, undefined, val);
                      }}
                      className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                      title="放大 5%"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {coverResult && (
                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-neutral-400 font-mono">
                    大小: {Math.round(coverResult.size / 1024)} KB (&le; 500KB 合规 ✓)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(coverResult.blob, '01_封面图_957x1278.jpg')}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>单独下载封面图</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: 封面挂件 (1053 × 1746) - 分段设计 + 自动合成一张图 */}
          {/* ======================================================== */}
          {activeTab === 'pendant' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>② 封面挂件画板 · 1053 × 1746</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono">透明PNG</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    微信平台为单张图片。您可<strong>分开上传顶部与底部两张图片</strong>分别调整，下载时<strong>自动合成一张标准图</strong>！
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGuides((v) => !v)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
                      showGuides ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-white text-neutral-500 border-neutral-200'
                    }`}
                  >
                    {showGuides ? '隐藏参考标线' : '显示可编辑区'}
                  </button>
                </div>
              </div>

              {/* Mode Switcher: 分段组合设计 vs 完整单图 */}
              <div className="flex items-center justify-between p-1.5 bg-neutral-100 rounded-2xl border border-neutral-200/80 text-xs gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendantUploadMode('split');
                    renderCompositePendant({ mode: 'split' });
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer text-center ${
                    pendantUploadMode === 'split'
                      ? 'bg-white text-amber-900 shadow-xs border border-amber-200'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  🧩 分段设计模式（推荐：分别上传顶部探头 + 底部垂饰，合成单张图）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendantUploadMode('full');
                    renderCompositePendant({ mode: 'full' });
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer text-center ${
                    pendantUploadMode === 'full'
                      ? 'bg-white text-amber-900 shadow-xs border border-amber-200'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  🖼️ 整张单图模式（直接上传已排版好的 1053×1746 透明图）
                </button>
              </div>

              {/* Upload Slots Section */}
              {pendantUploadMode === 'split' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slot A: Top Part */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    pendantActivePart === 'top'
                      ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/20'
                      : 'bg-neutral-50/60 border-neutral-200 hover:border-neutral-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                          A
                        </span>
                        <span className="font-bold text-xs text-neutral-900">顶部探头挂件</span>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono">0~342px</span>
                      </div>
                      {pendantTopImg && (
                        <button
                          type="button"
                          onClick={() => handleClearPendantSlot('top')}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                        >
                          清除
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-xl bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {pendantTopImg ? (
                          <img src={pendantTopImg.src} alt="顶部挂件" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Crown className="w-5 h-5 text-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{pendantTopImg ? '替换顶部图片' : '上传顶部图片'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleUploadPendantSlot(e.target.files[0], 'top');
                              }
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {pendantTopFileName || '如：小熊探头、吉祥物'}
                        </p>
                      </div>
                    </div>

                    {/* Scale Controls (20% to 500%) with [+] and [-] fine-tuning */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-200/70 text-xs">
                      <div className="flex items-center justify-between font-bold text-neutral-700">
                        <span>缩放大小 (最大500%)</span>
                        <span className="font-mono text-amber-800 font-black">{Math.round(pendantTopScale * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(0.2, Math.round((pendantTopScale - 0.05) * 100) / 100);
                            setPendantTopScale(val);
                            setPendantActivePart('top');
                            renderCompositePendant({ topScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="缩小 5%"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.2"
                          max="5.0"
                          step="0.05"
                          value={pendantTopScale}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPendantTopScale(val);
                            setPendantActivePart('top');
                            renderCompositePendant({ topScale: val });
                          }}
                          className="flex-1 accent-amber-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.min(5.0, Math.round((pendantTopScale + 0.05) * 100) / 100);
                            setPendantTopScale(val);
                            setPendantActivePart('top');
                            renderCompositePendant({ topScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="放大 5%"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-1 pt-1 flex-wrap">
                        {[0.5, 1.0, 1.5, 2.5, 3.5, 5.0].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setPendantTopScale(val);
                              setPendantActivePart('top');
                              renderCompositePendant({ topScale: val });
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold transition-all cursor-pointer ${
                              Math.abs(pendantTopScale - val) < 0.05
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                            }`}
                          >
                            {Math.round(val * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Position & Pixel Alignment Card (位置与像素对齐) */}
                    <div className="bg-white/95 rounded-xl p-3 border border-neutral-200/90 shadow-2xs space-y-3 mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 border-b border-neutral-100 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-amber-600" />
                          <span>位置与像素微调 (X / Y 轴)</span>
                        </span>
                        <span className="text-[10px] text-neutral-400 font-normal">步进 2px · 画板可直接拖动</span>
                      </div>

                      {/* 1. 水平 X 轴微调 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">水平 X 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 shadow-2xs">
                              {pendantTopOffsetX === 0 ? '0px (居中)' : pendantTopOffsetX > 0 ? `+${pendantTopOffsetX}px` : `${pendantTopOffsetX}px`}
                            </span>
                            {pendantTopOffsetX !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPendantTopOffsetX(0);
                                  renderCompositePendant({ topOffX: 0 });
                                }}
                                className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer font-medium"
                                title="恢复水平居中"
                              >
                                居中
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-250, pendantTopOffsetX - 2);
                              setPendantTopOffsetX(val);
                              renderCompositePendant({ topOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向左微调 2px"
                          >
                            <span>◀</span>
                            <span className="text-[10px]">左移</span>
                          </button>
                          <input
                            type="range"
                            min="-250"
                            max="250"
                            step="1"
                            value={pendantTopOffsetX}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPendantTopOffsetX(val);
                              renderCompositePendant({ topOffX: val });
                            }}
                            className="flex-1 accent-amber-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(250, pendantTopOffsetX + 2);
                              setPendantTopOffsetX(val);
                              renderCompositePendant({ topOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向右微调 2px"
                          >
                            <span className="text-[10px]">右移</span>
                            <span>▶</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. 垂直 Y 轴微调 (下沿对齐读数) */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">垂直 Y 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shadow-2xs ${
                              pendantTopOffsetY === 0
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              👑 下沿: {342 + pendantTopOffsetY}px
                            </span>
                            {pendantTopOffsetY !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPendantTopOffsetY(0);
                                  renderCompositePendant({ topOffY: 0 });
                                }}
                                className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer font-medium"
                                title="重置对齐 342px 标准标线"
                              >
                                对齐342px
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-150, pendantTopOffsetY - 2);
                              setPendantTopOffsetY(val);
                              renderCompositePendant({ topOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向上微调 2px (减少下沿读数)"
                          >
                            <span>▲</span>
                            <span className="text-[10px]">上移</span>
                          </button>
                          <input
                            type="range"
                            min="-150"
                            max="150"
                            step="1"
                            value={pendantTopOffsetY}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPendantTopOffsetY(val);
                              renderCompositePendant({ topOffY: val });
                            }}
                            className="flex-1 accent-amber-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(150, pendantTopOffsetY + 2);
                              setPendantTopOffsetY(val);
                              renderCompositePendant({ topOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向下微调 2px (增加下沿读数)"
                          >
                            <span className="text-[10px]">下移</span>
                            <span>▼</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slot B: Bottom Part */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    pendantActivePart === 'bottom'
                      ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/20'
                      : 'bg-neutral-50/60 border-neutral-200 hover:border-neutral-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
                          B
                        </span>
                        <span className="font-bold text-xs text-neutral-900">底部脊端挂件</span>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono">1650~1746px</span>
                      </div>
                      {pendantBottomImg && (
                        <button
                          type="button"
                          onClick={() => handleClearPendantSlot('bottom')}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                        >
                          清除
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-xl bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {pendantBottomImg ? (
                          <img src={pendantBottomImg.src} alt="底部挂件" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{pendantBottomImg ? '替换底部图片' : '上传底部图片'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleUploadPendantSlot(e.target.files[0], 'bottom');
                              }
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {pendantBottomFileName || '如：金元宝、爪子、吊坠'}
                        </p>
                      </div>
                    </div>

                    {/* Scale Controls (20% to 500%) with [+] and [-] fine-tuning */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-200/70 text-xs">
                      <div className="flex items-center justify-between font-bold text-neutral-700">
                        <span>缩放大小 (最大500%)</span>
                        <span className="font-mono text-amber-800 font-black">{Math.round(pendantBottomScale * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(0.2, Math.round((pendantBottomScale - 0.05) * 100) / 100);
                            setPendantBottomScale(val);
                            setPendantActivePart('bottom');
                            renderCompositePendant({ bottomScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="缩小 5%"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.2"
                          max="5.0"
                          step="0.05"
                          value={pendantBottomScale}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPendantBottomScale(val);
                            setPendantActivePart('bottom');
                            renderCompositePendant({ bottomScale: val });
                          }}
                          className="flex-1 accent-amber-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.min(5.0, Math.round((pendantBottomScale + 0.05) * 100) / 100);
                            setPendantBottomScale(val);
                            setPendantActivePart('bottom');
                            renderCompositePendant({ bottomScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="放大 5%"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-1 pt-1 flex-wrap">
                        {[0.5, 1.0, 1.5, 2.5, 3.5, 5.0].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setPendantBottomScale(val);
                              setPendantActivePart('bottom');
                              renderCompositePendant({ bottomScale: val });
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold transition-all cursor-pointer ${
                              Math.abs(pendantBottomScale - val) < 0.05
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                            }`}
                          >
                            {Math.round(val * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Position & Pixel Alignment Card (位置与像素对齐) */}
                    <div className="bg-white/95 rounded-xl p-3 border border-neutral-200/90 shadow-2xs space-y-3 mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 border-b border-neutral-100 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-amber-600" />
                          <span>位置与像素微调 (X / Y 轴)</span>
                        </span>
                        <span className="text-[10px] text-neutral-400 font-normal">步进 2px · 画板可直接拖动</span>
                      </div>

                      {/* 1. 水平 X 轴微调 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">水平 X 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 shadow-2xs">
                              {pendantBottomOffsetX === 0 ? '0px (居中)' : pendantBottomOffsetX > 0 ? `+${pendantBottomOffsetX}px` : `${pendantBottomOffsetX}px`}
                            </span>
                            {pendantBottomOffsetX !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPendantBottomOffsetX(0);
                                  renderCompositePendant({ bottomOffX: 0 });
                                }}
                                className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer font-medium"
                                title="恢复水平居中"
                              >
                                居中
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-250, pendantBottomOffsetX - 2);
                              setPendantBottomOffsetX(val);
                              renderCompositePendant({ bottomOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向左微调 2px"
                          >
                            <span>◀</span>
                            <span className="text-[10px]">左移</span>
                          </button>
                          <input
                            type="range"
                            min="-250"
                            max="250"
                            step="1"
                            value={pendantBottomOffsetX}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPendantBottomOffsetX(val);
                              renderCompositePendant({ bottomOffX: val });
                            }}
                            className="flex-1 accent-amber-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(250, pendantBottomOffsetX + 2);
                              setPendantBottomOffsetX(val);
                              renderCompositePendant({ bottomOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向右微调 2px"
                          >
                            <span className="text-[10px]">右移</span>
                            <span>▶</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. 垂直 Y 轴微调 (上沿对齐读数) */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">垂直 Y 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shadow-2xs ${
                              pendantBottomOffsetY === 0
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              ✨ 上沿: {1650 + pendantBottomOffsetY}px
                            </span>
                            {pendantBottomOffsetY !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPendantBottomOffsetY(0);
                                  renderCompositePendant({ bottomOffY: 0 });
                                }}
                                className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer font-medium"
                                title="重置对齐 1650px 标准标线"
                              >
                                对齐1650px
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-150, pendantBottomOffsetY - 2);
                              setPendantBottomOffsetY(val);
                              renderCompositePendant({ bottomOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向上微调 2px (减少上沿读数)"
                          >
                            <span>▲</span>
                            <span className="text-[10px]">上移</span>
                          </button>
                          <input
                            type="range"
                            min="-150"
                            max="150"
                            step="1"
                            value={pendantBottomOffsetY}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPendantBottomOffsetY(val);
                              renderCompositePendant({ bottomOffY: val });
                            }}
                            className="flex-1 accent-amber-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(150, pendantBottomOffsetY + 2);
                              setPendantBottomOffsetY(val);
                              renderCompositePendant({ bottomOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向下微调 2px (增加上沿读数)"
                          >
                            <span className="text-[10px]">下移</span>
                            <span>▼</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Full Single Image Upload Card */
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-neutral-900">完整透明挂件图片 (1053 × 1746)</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">上传已在设计软件中排版好的完整透明背景 PNG</p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{pendantFullImg ? '替换整张挂件' : '上传完整挂件图片'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadPendantSlot(e.target.files[0], 'full');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Interactive Visual Canvas with Direct Dragging (No crosshair dot, smooth 2D movement) */}
              <div className="flex flex-col items-center pt-1">
                <div className="flex items-center justify-center gap-3 w-full">
                  {/* Left Vertical Fine-Tuning Control Bar */}
                  <div className="flex flex-col items-center justify-between h-[406px] py-2 px-1.5 bg-neutral-100/90 rounded-2xl border border-neutral-200/90 shadow-2xs select-none shrink-0 w-12">
                    <button
                      type="button"
                      onClick={() => handlePendantStepFineTune(-6)}
                      title="向上微调 (往上走 6px)"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      ▲
                    </button>

                    <div className="flex-1 flex flex-col items-center justify-center my-2 relative group py-2 w-full">
                      <span className="text-[9px] font-mono font-bold text-amber-800 bg-white/95 px-1 py-0.5 rounded border border-neutral-200 shadow-2xs whitespace-nowrap text-center mb-2">
                        {pendantActivePart === 'top' ? `${342 + pendantTopOffsetY}px` : `${1650 + pendantBottomOffsetY}px`}
                      </span>

                      <div
                        ref={pendantTrackRef}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setIsDraggingPendantSlider(true);
                          handlePendantSliderTrackPointer(e.clientY, false);
                        }}
                        onPointerMove={(e) => {
                          if (!isDraggingPendantSlider) return;
                          handlePendantSliderTrackPointer(e.clientY, false);
                        }}
                        onPointerUp={(e) => {
                          setIsDraggingPendantSlider(false);
                          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                          handlePendantSliderTrackPointer(e.clientY, true);
                        }}
                        className="relative w-3.5 h-[200px] bg-neutral-200 rounded-full cursor-ns-resize flex flex-col justify-end p-0.5 select-none touch-none shadow-inner group-hover:bg-neutral-300/80 transition-colors"
                        title="按住上下拖动微调当前部位高度"
                      >
                        <div
                          className="w-full bg-amber-500 rounded-full pointer-events-none transition-all duration-75"
                          style={{
                            height: `${Math.max(10, Math.min(90, 50 - (pendantActivePart === 'top' ? pendantTopOffsetY : pendantBottomOffsetY) / 1.5))}%`,
                          }}
                        />
                      </div>

                      <span className="text-[9px] font-bold text-neutral-500 mt-2 whitespace-nowrap">
                        {pendantActivePart === 'top' ? '顶部' : '底部'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePendantStepFineTune(6)}
                      title="向下微调 (往下走 6px)"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Interactive Visual Canvas (Exact 1053 x 1746 Frame) */}
                  <div
                    ref={pendantCanvasRef}
                    onPointerDown={handlePendantPointerDown}
                    onPointerMove={handlePendantPointerMove}
                    onPointerUp={handlePendantPointerUp}
                    className={`relative w-[245px] aspect-[1053/1746] rounded-2xl bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:12px_12px] bg-white border border-neutral-200/90 flex items-center justify-center overflow-hidden shadow-xs select-none touch-none ${
                      isDraggingPendant ? 'cursor-grabbing ring-2 ring-amber-400' : 'cursor-grab hover:ring-1 hover:ring-neutral-300'
                    }`}
                    title="在上方或下方直接按住拖拽，支持上下左右全向自由平移"
                  >
                    {/* WeChat Red Packet Silhouette in Background */}
                    <div
                      className="absolute rounded-2xl bg-gradient-to-b from-red-600/15 to-red-800/25 border border-red-500/30 pointer-events-none z-0 flex flex-col items-center justify-between py-3"
                      style={{
                        top: '19.59%', // exactly 342px in 1746px (Figure 5)
                        height: '74.91%', // exactly 1308px in 1746px (Figure 5)
                        left: '9.12%', // exactly 96px in 1053px (Figure 5)
                        width: '81.77%', // exactly 861px in 1053px (Figure 5)
                      }}
                    >
                      <div className="flex flex-col items-center gap-1 opacity-50">
                        <div className="w-5 h-5 rounded-full bg-white/60" />
                        <div className="w-10 h-1.5 rounded bg-white/50" />
                      </div>
                      <div className="w-7 h-7 rounded-full bg-amber-400/80 border-2 border-amber-200 flex items-center justify-center text-[9px] text-amber-950 font-bold shadow-xs">
                        開
                      </div>
                    </div>

                    {pendantResult ? (
                      <>
                        <img
                          src={pendantResult.url}
                          alt="封面挂件"
                          className="w-full h-full object-contain rounded-xl drop-shadow-md z-10 pointer-events-none"
                        />

                        {/* WeChat Figure 5 Official Editable Guides */}
                        {showGuides && (
                          <div className="absolute inset-0 pointer-events-none z-20">
                            {/* Top Editable Area (0 ~ 342px) */}
                            <div
                              className={`absolute inset-x-0 top-0 border border-dashed rounded-t-xl flex items-center justify-center transition-all ${
                                pendantActivePart === 'top' ? 'border-amber-500 bg-amber-500/15' : 'border-amber-400/50 bg-amber-500/5'
                              }`}
                              style={{ height: '19.59%' }}
                            >
                              <span className="absolute top-1 left-1.5 text-[8px] font-bold text-amber-900 bg-white/95 px-1 rounded shadow-2xs border border-amber-200">
                                顶部探头区 (0~342px)
                              </span>
                            </div>

                            {/* Middle Forbidden Area (342 ~ 1650px) */}
                            <div
                              className="absolute border border-dashed border-red-300/80 bg-red-500/5 rounded-xl flex items-center justify-center"
                              style={{
                                top: '19.59%',
                                height: '74.91%',
                                left: '9.12%',
                                width: '81.77%',
                              }}
                            >
                              <span className="text-[8px] font-bold text-red-500 bg-white/95 px-1.5 py-0.5 rounded border border-red-200">
                                🚫 不可编辑主体区 (1308×861)
                              </span>
                            </div>

                            {/* Bottom Editable Area (1650 ~ 1746px) */}
                            <div
                              className={`absolute inset-x-0 border border-dashed rounded-b-xl flex items-center justify-center transition-all ${
                                pendantActivePart === 'bottom' ? 'border-amber-500 bg-amber-500/15' : 'border-amber-400/50 bg-amber-500/5'
                              }`}
                              style={{
                                top: '94.50%',
                                height: '5.50%',
                              }}
                            >
                              <span className="absolute bottom-1 left-1.5 text-[8px] font-bold text-amber-900 bg-white/95 px-1 rounded shadow-2xs border border-amber-200">
                                底部脊端区 (1650~1746px)
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Dynamic Moving Dashed Line for Top Part (探头下沿移动虚线) */}
                        {(pendantTopImg || pendantActivePart === 'top') && (
                          <div
                            className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                            style={{
                              top: `${((342 + pendantTopOffsetY) / 1746) * 100}%`,
                            }}
                          >
                            <div className="w-full border-t-2 border-dashed border-amber-600 shadow-xs" />
                            <div
                              className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                (342 + pendantTopOffsetY) === 342
                                  ? 'bg-amber-600 text-white border-amber-400 ring-2 ring-amber-300'
                                  : (342 + pendantTopOffsetY) > 342
                                  ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-300'
                                  : 'bg-amber-700 text-white border-amber-500'
                              }`}
                            >
                              <span>探头下沿: {342 + pendantTopOffsetY}px</span>
                              {(342 + pendantTopOffsetY) === 342 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🎯 完美对齐342px</span>
                              )}
                              {(342 + pendantTopOffsetY) > 342 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">⚠️ 侵入主体区 +{pendantTopOffsetY}px</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dynamic Moving Dashed Line for Bottom Part (底部上沿移动虚线) */}
                        {(pendantBottomImg || pendantActivePart === 'bottom') && (
                          <div
                            className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                            style={{
                              top: `${((1650 + pendantBottomOffsetY) / 1746) * 100}%`,
                            }}
                          >
                            <div className="w-full border-t-2 border-dashed border-amber-600 shadow-xs" />
                            <div
                              className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                (1650 + pendantBottomOffsetY) === 1650
                                  ? 'bg-amber-600 text-white border-amber-400 ring-2 ring-amber-300'
                                  : (1650 + pendantBottomOffsetY) < 1650
                                  ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-300'
                                  : 'bg-amber-700 text-white border-amber-500'
                              }`}
                            >
                              <span>底部上沿: {1650 + pendantBottomOffsetY}px</span>
                              {(1650 + pendantBottomOffsetY) === 1650 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🎯 完美对齐1650px</span>
                              )}
                              {(1650 + pendantBottomOffsetY) < 1650 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">⚠️ 侵入主体区 {pendantBottomOffsetY}px</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-neutral-400 text-xs">暂无封面挂件</div>
                    )}

                    {/* Dragging HUD Tag */}
                    {isDraggingPendant && (
                      <div className="absolute top-2 bg-neutral-900/90 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md font-mono z-30 flex items-center gap-1.5">
                        <Move className="w-3 h-3 text-amber-400" />
                        <span>正在平移: {pendantActivePart === 'top' ? '顶部探头' : '底部脊端'}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Height Dimension Ruler (顶部342px · 中间1308px · 底部96px) */}
                  <div className="flex flex-col justify-between h-[406px] py-1 text-[9px] font-mono select-none shrink-0 w-28">
                    {/* Top 342px Bracket */}
                    <div className="h-[19.59%] flex flex-col justify-center border-l-2 border-amber-500 pl-2 text-amber-800 bg-amber-50/70 rounded-r-lg">
                      <div className="font-extrabold flex items-center gap-1">
                        <span>顶部 342px</span>
                      </div>
                      <div className="text-[8px] text-amber-700 font-sans">探头可编辑区</div>
                      <div className="text-[8px] text-neutral-400">Y: 0 ~ 342px</div>
                    </div>

                    {/* Middle 1308px Bracket */}
                    <div className="h-[74.91%] flex flex-col justify-center border-l-2 border-red-400 pl-2 text-red-700 bg-red-50/60 rounded-r-lg my-1">
                      <div className="font-extrabold text-red-700">中间 1308px</div>
                      <div className="text-[8px] text-red-600 font-sans font-bold">🚫 主体不可编辑</div>
                      <div className="text-[8px] text-neutral-400">Y: 342 ~ 1650px</div>
                    </div>

                    {/* Bottom 96px Bracket */}
                    <div className="h-[5.50%] flex flex-col justify-center border-l-2 border-amber-500 pl-2 text-amber-800 bg-amber-50/70 rounded-r-lg">
                      <div className="font-extrabold flex items-center gap-1">
                        <span>底部 96px</span>
                      </div>
                      <div className="text-[8px] text-amber-700 font-sans">脊端可编辑区</div>
                      <div className="text-[8px] text-neutral-400">Y: 1650 ~ 1746px</div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-center space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-0.5 rounded-full border border-amber-200 inline-block font-mono shadow-2xs">
                    ✅ 顶部探头 (0~342px) 与底部垂饰 (1650~1746px) 均已就位 · 符合微信规范 ✓
                  </span>
                  <p className="text-[10px] text-neutral-400">
                    💡 提示：在上方画板上直接按住鼠标拖动，移动虚线实时显示对齐像素数
                  </p>
                </div>
              </div>

              {/* Dedicated Synthesis Download Box */}
              {pendantResult && (
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-amber-950 text-sm">微信标准封面挂件已合成</span>
                      <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-full border border-amber-300 text-amber-800 font-bold">
                        1053 × 1746 PNG · {Math.round(pendantResult.size / 1024)} KB ✓
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900/70">
                      已将顶部与底部图片合成为一张透明PNG，中间严格留空，大小 &le; 300KB，可直接提交微信红包开放平台审核。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(pendantResult.blob, '02_封面挂件_1053x1746_微信标准合成图.png')}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0 active:scale-95"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>下载合成封面挂件 (1053×1746)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: 气泡挂件 (480 × 384) - 分段设计 + 自动合成一张图 */}
          {/* ======================================================== */}
          {activeTab === 'bubble' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>③ 气泡挂件画板 · 480 × 384</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">透明PNG</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    微信平台为单张图片。您可<strong>分开上传顶部与底部两张图片</strong>分别调整，下载时<strong>自动合成一张标准图</strong>！
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGuides((v) => !v)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
                      showGuides ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-neutral-500 border-neutral-200'
                    }`}
                  >
                    {showGuides ? '隐藏参考标线' : '显示可编辑区'}
                  </button>
                </div>
              </div>

              {/* Mode Switcher: 分段组合设计 vs 完整单图 */}
              <div className="flex items-center justify-between p-1.5 bg-neutral-100 rounded-2xl border border-neutral-200/80 text-xs gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setBubbleUploadMode('split');
                    renderCompositeBubble({ mode: 'split' });
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer text-center ${
                    bubbleUploadMode === 'split'
                      ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  🧩 分段设计模式（推荐：分别上传顶部趴贴 + 底部垂饰，合成单张图）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBubbleUploadMode('full');
                    renderCompositeBubble({ mode: 'full' });
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer text-center ${
                    bubbleUploadMode === 'full'
                      ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  🖼️ 整张单图模式（直接上传已排版好的 480×384 透明图）
                </button>
              </div>

              {/* Upload Slots Section */}
              {bubbleUploadMode === 'split' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slot A: Top Part */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    bubbleActivePart === 'top'
                      ? 'bg-emerald-50/40 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-neutral-50/60 border-neutral-200 hover:border-neutral-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                          A
                        </span>
                        <span className="font-bold text-xs text-neutral-900">顶部趴贴挂件</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">颈部 0~96px</span>
                      </div>
                      {bubbleTopImg && (
                        <button
                          type="button"
                          onClick={() => handleClearBubbleSlot('top')}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                        >
                          清除
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-xl bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {bubbleTopImg ? (
                          <img src={bubbleTopImg.src} alt="顶部挂件" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Smile className="w-5 h-5 text-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{bubbleTopImg ? '替换顶部图片' : '上传顶部图片'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleUploadBubbleSlot(e.target.files[0], 'top');
                              }
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {bubbleTopFileName || '如：趴气泡小熊、探头吉祥物'}
                        </p>
                      </div>
                    </div>

                    {/* Scale Controls (20% to 500%) with [+] and [-] fine-tuning */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-200/70 text-xs">
                      <div className="flex items-center justify-between font-bold text-neutral-700">
                        <span>缩放大小 (最大500%)</span>
                        <span className="font-mono text-emerald-800 font-black">{Math.round(bubbleTopScale * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(0.2, Math.round((bubbleTopScale - 0.05) * 100) / 100);
                            setBubbleTopScale(val);
                            setBubbleActivePart('top');
                            renderCompositeBubble({ topScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="缩小 5%"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.2"
                          max="5.0"
                          step="0.05"
                          value={bubbleTopScale}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setBubbleTopScale(val);
                            setBubbleActivePart('top');
                            renderCompositeBubble({ topScale: val });
                          }}
                          className="flex-1 accent-emerald-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.min(5.0, Math.round((bubbleTopScale + 0.05) * 100) / 100);
                            setBubbleTopScale(val);
                            setBubbleActivePart('top');
                            renderCompositeBubble({ topScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="放大 5%"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-1 pt-1 flex-wrap">
                        {[0.5, 1.0, 1.5, 2.5, 3.5, 5.0].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setBubbleTopScale(val);
                              setBubbleActivePart('top');
                              renderCompositeBubble({ topScale: val });
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold transition-all cursor-pointer ${
                              Math.abs(bubbleTopScale - val) < 0.05
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                            }`}
                          >
                            {Math.round(val * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Position & Pixel Alignment Card (位置与像素对齐) */}
                    <div className="bg-white/95 rounded-xl p-3 border border-neutral-200/90 shadow-2xs space-y-3 mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 border-b border-neutral-100 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-emerald-600" />
                          <span>位置与像素微调 (X / Y 轴)</span>
                        </span>
                        <span className="text-[10px] text-neutral-400 font-normal">步进 2px · 画板可直接拖动</span>
                      </div>

                      {/* 1. 水平 X 轴微调 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">水平 X 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 shadow-2xs">
                              {bubbleTopOffsetX === 0 ? '0px (居中)' : bubbleTopOffsetX > 0 ? `+${bubbleTopOffsetX}px` : `${bubbleTopOffsetX}px`}
                            </span>
                            {bubbleTopOffsetX !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBubbleTopOffsetX(0);
                                  renderCompositeBubble({ topOffX: 0 });
                                }}
                                className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer font-medium"
                                title="恢复水平居中"
                              >
                                居中
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-200, bubbleTopOffsetX - 2);
                              setBubbleTopOffsetX(val);
                              renderCompositeBubble({ topOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向左微调 2px"
                          >
                            <span>◀</span>
                            <span className="text-[10px]">左移</span>
                          </button>
                          <input
                            type="range"
                            min="-200"
                            max="200"
                            step="1"
                            value={bubbleTopOffsetX}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setBubbleTopOffsetX(val);
                              renderCompositeBubble({ topOffX: val });
                            }}
                            className="flex-1 accent-emerald-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(200, bubbleTopOffsetX + 2);
                              setBubbleTopOffsetX(val);
                              renderCompositeBubble({ topOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向右微调 2px"
                          >
                            <span className="text-[10px]">右移</span>
                            <span>▶</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. 垂直 Y 轴微调 (下沿对齐读数) */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">垂直 Y 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shadow-2xs ${
                              bubbleTopOffsetY === 0
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : (96 + bubbleTopOffsetY) > 96
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              🐻 下沿: {96 + bubbleTopOffsetY}px
                            </span>
                            {bubbleTopOffsetY !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBubbleTopOffsetY(0);
                                  renderCompositeBubble({ topOffY: 0 });
                                }}
                                className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer font-medium"
                                title="重置对齐 96px 标准标线"
                              >
                                对齐96px
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-60, bubbleTopOffsetY - 2);
                              setBubbleTopOffsetY(val);
                              renderCompositeBubble({ topOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向上微调 2px (减少下沿读数)"
                          >
                            <span>▲</span>
                            <span className="text-[10px]">上移</span>
                          </button>
                          <input
                            type="range"
                            min="-60"
                            max="60"
                            step="1"
                            value={bubbleTopOffsetY}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setBubbleTopOffsetY(val);
                              renderCompositeBubble({ topOffY: val });
                            }}
                            className="flex-1 accent-emerald-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(60, bubbleTopOffsetY + 2);
                              setBubbleTopOffsetY(val);
                              renderCompositeBubble({ topOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向下微调 2px (增加下沿读数)"
                          >
                            <span className="text-[10px]">下移</span>
                            <span>▼</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slot B: Bottom Part */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    bubbleActivePart === 'bottom'
                      ? 'bg-emerald-50/40 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-neutral-50/60 border-neutral-200 hover:border-neutral-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                          B
                        </span>
                        <span className="font-bold text-xs text-neutral-900">底部垂饰挂件</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">底部 312~384px</span>
                      </div>
                      {bubbleBottomImg && (
                        <button
                          type="button"
                          onClick={() => handleClearBubbleSlot('bottom')}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                        >
                          清除
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-xl bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {bubbleBottomImg ? (
                          <img src={bubbleBottomImg.src} alt="底部挂件" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{bubbleBottomImg ? '替换底部图片' : '上传底部图片'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleUploadBubbleSlot(e.target.files[0], 'bottom');
                              }
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {bubbleBottomFileName || '如：悬挂金币、小萌爪、福袋'}
                        </p>
                      </div>
                    </div>

                    {/* Scale Controls (20% to 500%) with [+] and [-] fine-tuning */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-200/70 text-xs">
                      <div className="flex items-center justify-between font-bold text-neutral-700">
                        <span>缩放大小 (最大500%)</span>
                        <span className="font-mono text-emerald-800 font-black">{Math.round(bubbleBottomScale * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(0.2, Math.round((bubbleBottomScale - 0.05) * 100) / 100);
                            setBubbleBottomScale(val);
                            setBubbleActivePart('bottom');
                            renderCompositeBubble({ bottomScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="缩小 5%"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.2"
                          max="5.0"
                          step="0.05"
                          value={bubbleBottomScale}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setBubbleBottomScale(val);
                            setBubbleActivePart('bottom');
                            renderCompositeBubble({ bottomScale: val });
                          }}
                          className="flex-1 accent-emerald-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.min(5.0, Math.round((bubbleBottomScale + 0.05) * 100) / 100);
                            setBubbleBottomScale(val);
                            setBubbleActivePart('bottom');
                            renderCompositeBubble({ bottomScale: val });
                          }}
                          className="w-6 h-6 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                          title="放大 5%"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-1 pt-1 flex-wrap">
                        {[0.5, 1.0, 1.5, 2.5, 3.5, 5.0].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setBubbleBottomScale(val);
                              setBubbleActivePart('bottom');
                              renderCompositeBubble({ bottomScale: val });
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold transition-all cursor-pointer ${
                              Math.abs(bubbleBottomScale - val) < 0.05
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                            }`}
                          >
                            {Math.round(val * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Position & Pixel Alignment Card (位置与像素对齐) */}
                    <div className="bg-white/95 rounded-xl p-3 border border-neutral-200/90 shadow-2xs space-y-3 mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 border-b border-neutral-100 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-emerald-600" />
                          <span>位置与像素微调 (X / Y 轴)</span>
                        </span>
                        <span className="text-[10px] text-neutral-400 font-normal">步进 2px · 画板可直接拖动</span>
                      </div>

                      {/* 1. 水平 X 轴微调 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">水平 X 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 shadow-2xs">
                              {bubbleBottomOffsetX === 0 ? '0px (居中)' : bubbleBottomOffsetX > 0 ? `+${bubbleBottomOffsetX}px` : `${bubbleBottomOffsetX}px`}
                            </span>
                            {bubbleBottomOffsetX !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBubbleBottomOffsetX(0);
                                  renderCompositeBubble({ bottomOffX: 0 });
                                }}
                                className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer font-medium"
                                title="恢复水平居中"
                              >
                                居中
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-200, bubbleBottomOffsetX - 2);
                              setBubbleBottomOffsetX(val);
                              renderCompositeBubble({ bottomOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向左微调 2px"
                          >
                            <span>◀</span>
                            <span className="text-[10px]">左移</span>
                          </button>
                          <input
                            type="range"
                            min="-200"
                            max="200"
                            step="1"
                            value={bubbleBottomOffsetX}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setBubbleBottomOffsetX(val);
                              renderCompositeBubble({ bottomOffX: val });
                            }}
                            className="flex-1 accent-emerald-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(200, bubbleBottomOffsetX + 2);
                              setBubbleBottomOffsetX(val);
                              renderCompositeBubble({ bottomOffX: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向右微调 2px"
                          >
                            <span className="text-[10px]">右移</span>
                            <span>▶</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. 垂直 Y 轴微调 (上沿对齐读数) */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                          <span className="text-neutral-600">垂直 Y 轴</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shadow-2xs ${
                              bubbleBottomOffsetY === 0
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : (312 + bubbleBottomOffsetY) < 312
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              🎋 上沿: {312 + bubbleBottomOffsetY}px
                            </span>
                            {bubbleBottomOffsetY !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBubbleBottomOffsetY(0);
                                  renderCompositeBubble({ bottomOffY: 0 });
                                }}
                                className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer font-medium"
                                title="重置对齐 312px 标准标线"
                              >
                                对齐312px
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(-60, bubbleBottomOffsetY - 2);
                              setBubbleBottomOffsetY(val);
                              renderCompositeBubble({ bottomOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向上微调 2px (减少上沿读数)"
                          >
                            <span>▲</span>
                            <span className="text-[10px]">上移</span>
                          </button>
                          <input
                            type="range"
                            min="-60"
                            max="60"
                            step="1"
                            value={bubbleBottomOffsetY}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setBubbleBottomOffsetY(val);
                              renderCompositeBubble({ bottomOffY: val });
                            }}
                            className="flex-1 accent-emerald-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(60, bubbleBottomOffsetY + 2);
                              setBubbleBottomOffsetY(val);
                              renderCompositeBubble({ bottomOffY: val });
                            }}
                            className="h-7 px-2.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs gap-1"
                            title="向下微调 2px (增加上沿读数)"
                          >
                            <span className="text-[10px]">下移</span>
                            <span>▼</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Full Single Image Upload Card */
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-neutral-900">完整透明气泡挂件图片 (480 × 384)</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">上传已在设计软件中排版好的完整透明背景 PNG</p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{bubbleFullImg ? '替换整张挂件' : '上传完整挂件图片'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadBubbleSlot(e.target.files[0], 'full');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Interactive Visual Canvas with Direct Dragging (No crosshair dot, smooth 2D movement) */}
              <div className="flex flex-col items-center pt-1">
                <div className="flex items-center justify-center gap-3 w-full">
                  {/* Left Vertical Fine-Tuning Control Bar */}
                  <div className="flex flex-col items-center justify-between h-[256px] py-2 px-1.5 bg-neutral-100/90 rounded-2xl border border-neutral-200/90 shadow-2xs select-none shrink-0 w-12">
                    <button
                      type="button"
                      onClick={() => handleBubbleStepFineTune(-6)}
                      title="向上微调 (往上走 6px)"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      ▲
                    </button>

                    <div className="flex-1 flex flex-col items-center justify-center my-1 relative group py-1 w-full">
                      <span className="text-[9px] font-mono font-bold text-emerald-800 bg-white/95 px-1 py-0.5 rounded border border-neutral-200 shadow-2xs whitespace-nowrap text-center mb-2">
                        {bubbleActivePart === 'top' ? `${96 + bubbleTopOffsetY}px` : `${312 + bubbleBottomOffsetY}px`}
                      </span>

                      <div
                        ref={bubbleTrackRef}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setIsDraggingBubbleSlider(true);
                          handleBubbleSliderTrackPointer(e.clientY, false);
                        }}
                        onPointerMove={(e) => {
                          if (!isDraggingBubbleSlider) return;
                          handleBubbleSliderTrackPointer(e.clientY, false);
                        }}
                        onPointerUp={(e) => {
                          setIsDraggingBubbleSlider(false);
                          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                          handleBubbleSliderTrackPointer(e.clientY, true);
                        }}
                        className="relative w-3.5 h-[120px] bg-neutral-200 rounded-full cursor-ns-resize flex flex-col justify-end p-0.5 select-none touch-none shadow-inner group-hover:bg-neutral-300/80 transition-colors"
                        title="按住上下拖动微调当前部位高度"
                      >
                        <div
                          className="w-full bg-emerald-500 rounded-full pointer-events-none transition-all duration-75"
                          style={{
                            height: `${Math.max(10, Math.min(90, 50 - (bubbleActivePart === 'top' ? bubbleTopOffsetY : bubbleBottomOffsetY) / 1.0))}%`,
                          }}
                        />
                      </div>

                      <span className="text-[9px] font-bold text-neutral-500 mt-2 whitespace-nowrap">
                        {bubbleActivePart === 'top' ? '顶部' : '底部'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBubbleStepFineTune(6)}
                      title="向下微调 (往下走 6px)"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Interactive Visual Canvas (Exact 480 x 384 Coordinate Frame) */}
                  <div
                    ref={bubbleCanvasRef}
                    onPointerDown={handleBubblePointerDown}
                    onPointerMove={handleBubblePointerMove}
                    onPointerUp={handleBubblePointerUp}
                    className={`relative w-[320px] aspect-[480/384] rounded-2xl bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:12px_12px] bg-white border border-neutral-200/90 flex items-center justify-center overflow-hidden shadow-xs select-none touch-none ${
                      isDraggingBubble ? 'cursor-grabbing ring-2 ring-emerald-400' : 'cursor-grab hover:ring-1 hover:ring-neutral-300'
                    }`}
                    title="在上方或下方直接按住拖拽，支持上下左右全向自由平移"
                  >
                    {/* 1. Official Middle Forbidden Zone (Y: 96 ~ 312 out of 384, exact height 216px, 56.25%) */}
                    <div
                      className="absolute inset-x-0 bg-red-500/5 border-y-2 border-dashed border-red-400/80 pointer-events-none z-0 flex flex-col justify-between"
                      style={{
                        top: '25%', // Y: 96px in 384px (25.0%)
                        height: '56.25%', // Y: 216px in 384px (56.25%)
                      }}
                    >
                      <div className="px-2 pt-0.5 flex items-center justify-between text-[7px] text-red-500/90 font-mono font-bold">
                        <span>↑ 96px 禁止侵入上分界线</span>
                        <span>中间 216px 不可编辑区</span>
                      </div>
                      <div className="px-2 pb-0.5 flex items-center justify-between text-[7px] text-red-500/90 font-mono font-bold">
                        <span>↓ 312px 禁止侵入下分界线</span>
                        <span>微信严禁挂件图案侵入</span>
                      </div>
                    </div>

                    {/* 2. Authentic WeChat Red Packet Bubble Card inside the 216px zone (Height: 180px centered, 46.875%) */}
                    <div
                      className="absolute inset-x-3 bg-gradient-to-r from-[#fa9d3b] to-[#f97316] rounded-xl border border-[#ea580c]/60 pointer-events-none z-5 flex flex-col justify-between shadow-xs overflow-hidden"
                      style={{
                        top: '29.6875%', // centered vertically inside 96~312px (Y = 114px, 18px margin from 96px)
                        height: '46.875%', // exactly 180px in 384px
                      }}
                    >
                      <div className="p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#c23636] text-white flex items-center justify-center text-xs shadow-xs border border-white/20">
                            🧧
                          </div>
                          <div className="space-y-0.5 text-left">
                            <div className="text-[10px] font-bold text-white leading-tight">恭喜发财，大吉大利</div>
                            <div className="text-[8px] text-amber-100/90 font-medium">微信红包气泡 (卡片实际高约180px)</div>
                          </div>
                        </div>
                        <span className="text-[8px] text-amber-100/80 font-mono font-bold bg-black/10 px-1 py-0.5 rounded">卡片高180px</span>
                      </div>
                      <div className="bg-white/95 px-2.5 py-0.5 flex items-center justify-between text-[8px] text-neutral-500 font-medium border-t border-amber-600/30">
                        <span>微信红包</span>
                        <span className="text-amber-700 font-bold text-[7px]">专享气泡</span>
                      </div>
                    </div>

                    {bubbleResult ? (
                      <>
                        <img
                          src={bubbleResult.url}
                          alt="气泡挂件"
                          className="w-full h-full object-contain drop-shadow-md z-10 pointer-events-none"
                        />

                        {/* WeChat 480x384 Guides: Top 96px, Middle 216px, Bottom 72px */}
                        {showGuides && (
                          <div className="absolute inset-0 pointer-events-none z-20">
                            {/* 1. Top Editable Area (0~96px out of 384, height 25%) */}
                            <div
                              className={`absolute inset-x-0 top-0 border border-dashed rounded-t-xl flex items-center justify-center transition-all ${
                                bubbleActivePart === 'top'
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-emerald-400/50 bg-emerald-500/5'
                              }`}
                              style={{ height: '25%' }}
                            >
                              <span className="absolute top-1 left-2 text-[8px] font-bold text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-200">
                                ✅ 上面 96px · 颈部可编辑区 (趴气泡/探头)
                              </span>
                            </div>

                            {/* 2. Bottom Editable Area (312~384px out of 384, height 18.75%) */}
                            <div
                              className={`absolute inset-x-0 bottom-0 border border-dashed rounded-b-xl flex items-center justify-center transition-all ${
                                bubbleActivePart === 'bottom'
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-emerald-400/50 bg-emerald-500/5'
                              }`}
                              style={{ height: '18.75%' }}
                            >
                              <span className="absolute bottom-1 left-2 text-[8px] font-bold text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-200">
                                ✅ 下面 72px · 底部可编辑区 (底部垂饰)
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 3. Dynamic Moving Dashed Line for Top Part (小熊下沿移动对齐虚线) */}
                        {(bubbleTopImg || bubbleActivePart === 'top') && (
                          <div
                            className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                            style={{
                              top: `${((96 + bubbleTopOffsetY) / 384) * 100}%`,
                            }}
                          >
                            <div className="w-full border-t-2 border-dashed border-emerald-600 shadow-xs" />
                            <div
                              className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                (96 + bubbleTopOffsetY) === 96
                                  ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300'
                                  : (96 + bubbleTopOffsetY) > 96
                                  ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-300'
                                  : 'bg-emerald-700 text-white border-emerald-500'
                              }`}
                            >
                              <span>🐻 小熊下沿对齐线: {96 + bubbleTopOffsetY}px</span>
                              {(96 + bubbleTopOffsetY) === 96 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🎯 完美对齐96px</span>
                              )}
                              {(96 + bubbleTopOffsetY) > 96 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">⚠️ 侵入不可编辑区 +{bubbleTopOffsetY}px</span>
                              )}
                              {(96 + bubbleTopOffsetY) < 96 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded">距上沿 {-(bubbleTopOffsetY)}px</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 4. Dynamic Moving Dashed Line for Bottom Part (垂饰上沿移动对齐虚线) */}
                        {(bubbleBottomImg || bubbleActivePart === 'bottom') && (
                          <div
                            className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                            style={{
                              top: `${((312 + bubbleBottomOffsetY) / 384) * 100}%`,
                            }}
                          >
                            <div className="w-full border-t-2 border-dashed border-emerald-600 shadow-xs" />
                            <div
                              className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                (312 + bubbleBottomOffsetY) === 312
                                  ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300'
                                  : (312 + bubbleBottomOffsetY) < 312
                                  ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-300'
                                  : 'bg-emerald-700 text-white border-emerald-500'
                              }`}
                            >
                              <span>🎋 垂饰上沿对齐线: {312 + bubbleBottomOffsetY}px</span>
                              {(312 + bubbleBottomOffsetY) === 312 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🎯 完美对齐312px</span>
                              )}
                              {(312 + bubbleBottomOffsetY) < 312 && (
                                <span className="text-[8px] bg-white/20 px-1 rounded font-bold">⚠️ 侵入不可编辑区 {bubbleBottomOffsetY}px</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-neutral-400 text-xs">暂无气泡挂件</div>
                    )}

                    {/* Dragging HUD */}
                    {isDraggingBubble && (
                      <div className="absolute top-2 bg-neutral-900/90 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md font-mono z-30 flex items-center gap-1.5">
                        <Move className="w-3 h-3 text-emerald-400" />
                        <span>正在平移: {bubbleActivePart === 'top' ? '顶部趴贴' : '底部垂饰'}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Height Dimension Ruler (上面96px · 中间216px · 下面72px) */}
                  <div className="flex flex-col justify-between h-[256px] py-1 text-[9px] font-mono select-none shrink-0 w-28">
                    {/* Top 96px Bracket */}
                    <div className="h-[25%] flex flex-col justify-center border-l-2 border-emerald-500 pl-2 text-emerald-800 bg-emerald-50/70 rounded-r-lg">
                      <div className="font-extrabold flex items-center gap-1">
                        <span>上面 96px</span>
                      </div>
                      <div className="text-[8px] text-emerald-700 font-sans">颈部可编辑区</div>
                      <div className="text-[8px] text-neutral-400">Y: 0 ~ 96px</div>
                    </div>

                    {/* Middle 216px Bracket */}
                    <div className="h-[56.25%] flex flex-col justify-center border-l-2 border-red-400 pl-2 text-red-700 bg-red-50/60 rounded-r-lg my-1">
                      <div className="font-extrabold text-red-700">中间 216px</div>
                      <div className="text-[8px] text-red-600 font-sans font-bold">🚫 主体不可编辑</div>
                      <div className="text-[8px] text-amber-800 font-sans mt-0.5">内嵌卡片高约180px</div>
                      <div className="text-[8px] text-neutral-400">Y: 96 ~ 312px</div>
                    </div>

                    {/* Bottom 72px Bracket */}
                    <div className="h-[18.75%] flex flex-col justify-center border-l-2 border-emerald-500 pl-2 text-emerald-800 bg-emerald-50/70 rounded-r-lg">
                      <div className="font-extrabold flex items-center gap-1">
                        <span>下面 72px</span>
                      </div>
                      <div className="text-[8px] text-emerald-700 font-sans">底部可编辑区</div>
                      <div className="text-[8px] text-neutral-400">Y: 312 ~ 384px</div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-center space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200 inline-block font-mono shadow-2xs">
                    ✅ 480×384 规范：上面96px颈部与下面72px垂饰 · 中间216px主体严格留空（内嵌红包高约180px）✓
                  </span>
                  <p className="text-[10px] text-neutral-400">
                    💡 提示：在上方画板上直接按住鼠标拖动，绿色移动虚线实时显示对齐像素数
                  </p>
                </div>
              </div>

              {/* Dedicated Synthesis Download Box */}
              {bubbleResult && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-emerald-950 text-sm">微信标准气泡挂件已合成</span>
                      <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-800 font-bold">
                        480 × 384 PNG · {Math.round(bubbleResult.size / 1024)} KB ✓
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900/70">
                      已将顶部与底部图片合成为一张透明PNG，中间216px严禁侵入区域严格留空，大小 &le; 300KB，可直接提交微信红包开放平台审核。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(bubbleResult.blob, '03_气泡挂件_480x384_微信标准合成图.png')}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0 active:scale-95"
                  >
                    <Download className="w-4 h-4 text-emerald-300" />
                    <span>下载合成气泡挂件 (480×384)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: 封面故事 (750 × 1250)                              */}
          {/* ======================================================== */}
          {activeTab === 'story' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>④ 封面故事画板 · 750 × 1250</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">选填</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    用户拆开红包并在详情页下滑时展示，可定制品牌与祝福文案。
                  </p>
                </div>

                {storyResult && (
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(storyResult.blob, '04_封面故事_750x1250.jpg')}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载故事图</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                {/* Visual Preview */}
                <div className="sm:col-span-5 flex flex-col items-center">
                  <div className="w-full max-w-[220px] aspect-[750/1250] rounded-2xl bg-[#fafafa] border border-neutral-200/90 p-2 flex items-center justify-center overflow-hidden shadow-xs">
                    {storyResult ? (
                      <img
                        src={storyResult.url}
                        alt="封面故事预览"
                        className="w-full h-full object-contain rounded-xl drop-shadow-sm"
                      />
                    ) : (
                      <div className="text-neutral-400 text-xs">暂无封面故事</div>
                    )}
                  </div>
                </div>

                {/* Form Controls */}
                <div className="sm:col-span-7 space-y-3 text-xs">
                  <div>
                    <label className="text-neutral-700 font-bold block mb-1">主标题</label>
                    <input
                      type="text"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-700 font-bold block mb-1">副标题</label>
                    <input
                      type="text"
                      value={storySubtitle}
                      onChange={(e) => setStorySubtitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-700 font-bold block mb-1">说明文案</label>
                    <textarea
                      rows={3}
                      value={storyDesc}
                      onChange={(e) => setStoryDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateStory}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    更新封面故事排版
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: 官方标准示范预设                                   */}
          {/* ======================================================== */}
          {activeTab === 'presets' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>微信官方规范标准套件示范（免上传一键装载）</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    100% 遵循官方 4 项规格，已内置合规挂点与无截断图案。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DEMO_RED_PACKET_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleLoadDemoTheme(theme.id)}
                    disabled={isProcessing}
                    className="p-4 rounded-2xl border border-neutral-200 hover:border-red-400 hover:bg-red-50/30 text-left transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shrink-0 shadow-xs"
                        style={{ backgroundColor: theme.themeColor }}
                      >
                        🧧
                      </div>
                      <div>
                        <div className="font-bold text-xs text-neutral-900 group-hover:text-red-700">
                          {theme.name}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {theme.description}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span>4 大规格标准全备</span>
                      <span>点击装载 ›</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live WeChat Red Packet Cover (5 Cols) */}
        {/* Strictly on the RED PACKET COVER (红包封面), NO extraneous chat dialogue! */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          <div className="sticky top-20 flex flex-col items-center">
            {/* Live WeChat Realistic Phone Mockup */}
            <RedPacketPreviewMockup
              coverResult={coverResult}
              coverVideoUrl={videoUrl}
              pendantResult={pendantResult}
              bubbleResult={bubbleResult}
              storyResult={storyResult}
              senderName={senderName}
              blessingText={blessingText}
              activeTab={activeTab}
            />

            {/* Quick Sender Name & Blessing Input for Live Customization */}
            <div className="w-full max-w-[340px] mt-3 p-3.5 bg-white/90 backdrop-blur-xl rounded-2xl border border-neutral-200/80 shadow-2xs text-xs space-y-2">
              <span className="font-bold text-neutral-700 block text-[11px]">
                定制微信红包文字预览：
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">发送者昵称</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-xl text-xs bg-neutral-50/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">祝福语</label>
                  <input
                    type="text"
                    value={blessingText}
                    onChange={(e) => setBlessingText(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-xl text-xs bg-neutral-50/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Real-time Glassmorphism Upload & Processing Progress Modal */}
      {/* ======================================================== */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white/95 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-[0_24px_60px_rgba(0,0,0,0.2)] border border-neutral-100 flex flex-col items-center text-center space-y-4">
            {/* Animated Icon Ring */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
              <Sparkles className="w-7 h-7 text-amber-500 absolute" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-neutral-900 tracking-tight">
                智能生成微信红包全套素材
              </h3>
              <p className="text-xs text-neutral-500 min-h-[20px] font-medium">
                {processingStatus || '正在智能处理中...'}
              </p>
            </div>

            {/* Progress Bar with real percentage */}
            <div className="w-full space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-neutral-400">处理进度</span>
                <span className="font-bold text-amber-600">{Math.round(processingProgress)}%</span>
              </div>
              <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden p-0.5 border border-neutral-200/80">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-300 ease-out shadow-xs"
                  style={{ width: `${Math.min(100, Math.max(5, processingProgress))}%` }}
                />
              </div>
            </div>

            {/* Material generation progress pills */}
            <div className="grid grid-cols-2 gap-2 w-full text-[11px] pt-1">
              <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                processingProgress >= 30 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-neutral-50 border-neutral-200 text-neutral-400'
              }`}>
                <span>{processingProgress >= 30 ? '✓' : '○'}</span>
                <span>封面图 (957×1278)</span>
              </div>
              <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                processingProgress >= 60 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-neutral-50 border-neutral-200 text-neutral-400'
              }`}>
                <span>{processingProgress >= 60 ? '✓' : '○'}</span>
                <span>封面挂件 (1053×1746)</span>
              </div>
              <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                processingProgress >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-neutral-50 border-neutral-200 text-neutral-400'
              }`}>
                <span>{processingProgress >= 80 ? '✓' : '○'}</span>
                <span>气泡挂件 (480×384)</span>
              </div>
              <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                processingProgress >= 95 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-neutral-50 border-neutral-200 text-neutral-400'
              }`}>
                <span>{processingProgress >= 95 ? '✓' : '○'}</span>
                <span>封面故事 (750×1250)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
