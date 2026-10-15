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
  Scissors,
  Crop,
  Plus,
  Trash2,
  Copy,
  FlipHorizontal,
  Pipette,
  Eraser,
  Paintbrush,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  WECHAT_RED_PACKET_SPECS,
  BUBBLE_PENDANT_COORDS,
  MaterialResult,
  VideoAnalysisResult,
  PendantPartConfig,
  ManualTransparencyConfig,
  FullBubbleSplitConfig,
  NormalizedCropBox,
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
  processImageTransparency,
  cropImageByBox,
  splitSingleImageIntoTopAndBottom,
  trimImageTransparentBorders,
  getAlphaBoundingBox,
  AlphaBoundingBox,
} from '../../utils/redPacketProcessor';
import { removeBackgroundWithAI } from '../../utils/aiBackgroundRemoval';
import { DEMO_RED_PACKET_THEMES } from '../../utils/demoRedPackets';
import { RedPacketPreviewMockup } from './RedPacketPreviewMockup';

export interface BubbleLayerItem {
  id: string;
  name: string;
  rawSource: HTMLImageElement;
  source: HTMLImageElement;
  scale: number;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
  bottomCropPercent: number;
  topCropPercent: number;
  bgConfig: ManualTransparencyConfig;
}

const DEFAULT_BG_CONFIG: ManualTransparencyConfig = {
  mode: 'auto',
  tolerance: 38,
  feather: 8,
  defringe: 1,
};

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
  const [pendantTopBottomCrop, setPendantTopBottomCrop] = useState<number>(0); // 0 ~ 0.8
  const [pendantTopFileName, setPendantTopFileName] = useState('');
  const [pendantBottomFileName, setPendantBottomFileName] = useState('');
  const [pendantFullFileName, setPendantFullFileName] = useState('');
  const [pendantAddGlow, setPendantAddGlow] = useState(true);

  // Customization Options: Bubble Pendant (480x384) - Multi-Layer Top + Bottom & Full Mid-Split Modes
  const [bubbleUploadMode, setBubbleUploadMode] = useState<'split' | 'full'>('split');
  const [bubbleActivePart, setBubbleActivePart] = useState<'top' | 'bottom'>('top');

  // Multi-image Layer Lists for Top (顶部趴贴小熊) & Bottom (底部垂饰)
  const [bubbleTopLayers, setBubbleTopLayers] = useState<BubbleLayerItem[]>([]);
  const [bubbleActiveTopId, setBubbleActiveTopId] = useState<string>('');
  const [bubbleBottomLayers, setBubbleBottomLayers] = useState<BubbleLayerItem[]>([]);
  const [bubbleActiveBottomId, setBubbleActiveBottomId] = useState<string>('');

  // Full Single Image + Mid-Split State
  const [bubbleFullRawImg, setBubbleFullRawImg] = useState<HTMLImageElement | null>(null);
  const [bubbleFullImg, setBubbleFullImg] = useState<HTMLImageElement | null>(null);
  const [bubbleFullFileName, setBubbleFullFileName] = useState('');
  const [bubbleFullBgConfig, setBubbleFullBgConfig] = useState<ManualTransparencyConfig>(DEFAULT_BG_CONFIG);
  const [bubbleFullSplitConfig, setBubbleFullSplitConfig] = useState<FullBubbleSplitConfig>({
    enabled: true, // 默认支持从中间截开调整位置
    splitRatio: 0.5, // 默认从 50% 正中间截开
    topScale: 1.0,
    topOffsetX: 0,
    topOffsetY: 0,
    bottomScale: 1.0,
    bottomOffsetX: 0,
    bottomOffsetY: 0,
    fullScale: 1.0,
    fullOffsetX: 0,
    fullOffsetY: 0,
  });
  const [bubbleFullEditPart, setBubbleFullEditPart] = useState<'top' | 'bottom'>('top');

  // Backwards-compatible convenience state synced with active layer
  const [bubbleTopImg, setBubbleTopImg] = useState<HTMLImageElement | null>(null);
  const [bubbleBottomImg, setBubbleBottomImg] = useState<HTMLImageElement | null>(null);
  const [bubbleTopScale, setBubbleTopScale] = useState<number>(1.0);
  const [bubbleTopOffsetX, setBubbleTopOffsetX] = useState<number>(0);
  const [bubbleTopOffsetY, setBubbleTopOffsetY] = useState<number>(0);
  const [bubbleTopBottomCrop, setBubbleTopBottomCrop] = useState<number>(0);
  const [bubbleBottomScale, setBubbleBottomScale] = useState<number>(1.0);
  const [bubbleBottomOffsetX, setBubbleBottomOffsetX] = useState<number>(0);
  const [bubbleBottomOffsetY, setBubbleBottomOffsetY] = useState<number>(0);
  const [bubbleBottomTopCrop, setBubbleBottomTopCrop] = useState<number>(0);
  const [bubblePlacement, setBubblePlacement] = useState<'top' | 'bottom'>('top');
  const [bubbleScale, setBubbleScale] = useState(1.0);
  const [bubbleOffsetX, setBubbleOffsetX] = useState(0);
  const [bubbleOffsetY, setBubbleOffsetY] = useState(0);
  const [bubbleTopFileName, setBubbleTopFileName] = useState('');
  const [bubbleBottomFileName, setBubbleBottomFileName] = useState('');
  const [showGuides, setShowGuides] = useState(true);

  // Derived active layers for Top and Bottom
  const activeTopLayer = bubbleTopLayers.find((l) => l.id === bubbleActiveTopId) || bubbleTopLayers[0] || null;
  const activeBottomLayer = bubbleBottomLayers.find((l) => l.id === bubbleActiveBottomId) || bubbleBottomLayers[0] || null;

  // Keep legacy states synced when activeTopLayer or activeBottomLayer changes
  useEffect(() => {
    if (activeTopLayer) {
      setBubbleTopImg(activeTopLayer.source);
      setBubbleTopFileName(activeTopLayer.name);
      setBubbleTopScale(activeTopLayer.scale);
      setBubbleTopOffsetX(activeTopLayer.offsetX);
      setBubbleTopOffsetY(activeTopLayer.offsetY);
      setBubbleTopBottomCrop(activeTopLayer.bottomCropPercent);
    } else {
      setBubbleTopImg(null);
      setBubbleTopFileName('');
    }
  }, [activeTopLayer]);

  useEffect(() => {
    if (activeBottomLayer) {
      setBubbleBottomImg(activeBottomLayer.source);
      setBubbleBottomFileName(activeBottomLayer.name);
      setBubbleBottomScale(activeBottomLayer.scale);
      setBubbleBottomOffsetX(activeBottomLayer.offsetX);
      setBubbleBottomOffsetY(activeBottomLayer.offsetY);
      setBubbleBottomTopCrop(activeBottomLayer.topCropPercent);
    } else {
      setBubbleBottomImg(null);
      setBubbleBottomFileName('');
    }
  }, [activeBottomLayer]);

  // Crop & Trim Modal States (Arbitrary 4-Sided Rectangular Box Selection)
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropModalTarget, setCropModalTarget] = useState<'bubbleTop' | 'bubbleBottom' | 'pendantTop' | 'pendantBottom'>('bubbleTop');
  const [cropModalImg, setCropModalImg] = useState<HTMLImageElement | null>(null);
  const [cropBox, setCropBox] = useState<NormalizedCropBox>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropImgRect, setCropImgRect] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isDraggingCropBox, setIsDraggingCropBox] = useState(false);
  const [activeCropHandle, setActiveCropHandle] = useState<'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const cropDragStartRef = useRef<{ clientX: number; clientY: number; startBox: NormalizedCropBox; boxPixelWidth: number; boxPixelHeight: number } | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);

  // Manual Background Transparency Modal States (自动化透明 + 吸管连通漫水/全图取色 + 叠加吸取 + 撤销历史 + 圆形笔刷)
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [bgModalTarget, setBgModalTarget] = useState<'bubbleTop' | 'bubbleBottom' | 'bubbleFull'>('bubbleTop');
  const [bgModalRawImg, setBgModalRawImg] = useState<HTMLImageElement | null>(null);
  const [bgModalConfig, setBgModalConfig] = useState<ManualTransparencyConfig>(DEFAULT_BG_CONFIG);
  const [bgModalDetectedHex, setBgModalDetectedHex] = useState<string>('#ffffff');
  const [bgModalTool, setBgModalTool] = useState<'eyedropper' | 'eraser' | 'restore'>('eyedropper');
  const [bgBrushSize, setBgBrushSize] = useState<number>(22);
  const [isPaintingBgModal, setIsPaintingBgModal] = useState(false);
  const bgModalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Requirement 1 Enhancements:
  const [bgContiguous, setBgContiguous] = useState<boolean>(true); // 连续 (漫水连通) vs 不连续 (全图取色)
  const [bgPickedColors, setBgPickedColors] = useState<string[]>([]); // 叠加吸取的颜色列表
  const [bgUndoStack, setBgUndoStack] = useState<ImageData[]>([]); // 撤销历史栈
  const [bgRedoStack, setBgRedoStack] = useState<ImageData[]>([]); // 重做历史栈
  const [bgCursorPos, setBgCursorPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [bgAiLoading, setBgAiLoading] = useState(false);

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
  const bubbleDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startOffX: number;
    startOffY: number;
    part: 'top' | 'bottom' | 'full';
    layerId?: string;
    fullSubPart?: 'top' | 'bottom';
  } | null>(null);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPanY, setDragStartPanY] = useState(0);

  // Initialize with the first demo theme (萌熊送福 · 趴气泡小熊 官方对齐款)
  useEffect(() => {
    if (!coverResult && !pendantResult) {
      handleLoadDemoTheme('theme-cute-bear', false);
    }
  }, []);

  // Re-render bgModalCanvas whenever bgModalOpen, bgModalRawImg, or bgModalConfig changes
  useEffect(() => {
    if (!bgModalOpen || !bgModalRawImg) return;
    let cancelled = false;
    (async () => {
      const res = await processImageTransparency(bgModalRawImg, bgModalConfig);
      if (cancelled) return;
      setBgModalDetectedHex(res.detectedBgHex);
      const canvas = bgModalCanvasRef.current;
      if (canvas) {
        canvas.width = res.canvas.width;
        canvas.height = res.canvas.height;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(res.canvas, 0, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bgModalOpen, bgModalRawImg, bgModalConfig]);

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
      setBubbleFullRawImg(bubbleImg);
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

        const bTopRaw = await cropImageRegion(bubbleImg, 0, 0, 480, 96);
        const bTopTrimmed = await trimImageTransparentBorders(bTopRaw, { alphaThreshold: 24, padding: 0 });
        const initTopLayer: BubbleLayerItem = {
          id: 'top-demo-1',
          name: '趴气泡小熊 #1',
          rawSource: bTopTrimmed.img,
          source: bTopTrimmed.img,
          scale: 1.0,
          offsetX: 0,
          offsetY: 0,
          flipX: false,
          bottomCropPercent: 0,
          topCropPercent: 0,
          bgConfig: { ...DEFAULT_BG_CONFIG },
        };
        setBubbleTopLayers([initTopLayer]);
        setBubbleActiveTopId(initTopLayer.id);

        // Check if demo bubble has bottom ornament in 312~384px
        const bBottomRaw = await cropImageRegion(bubbleImg, 0, 312, 480, 72);
        const bBottomTrimmed = await trimImageTransparentBorders(bBottomRaw, { alphaThreshold: 24, padding: 0 });
        let initBottomLayers: BubbleLayerItem[] = [];
        if (bBottomTrimmed.bbox.hasContent) {
          const initBotLayer: BubbleLayerItem = {
            id: 'bot-demo-1',
            name: '底部迎福垂饰 #1',
            rawSource: bBottomTrimmed.img,
            source: bBottomTrimmed.img,
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            flipX: false,
            bottomCropPercent: 0,
            topCropPercent: 0,
            bgConfig: { ...DEFAULT_BG_CONFIG },
          };
          initBottomLayers = [initBotLayer];
          setBubbleBottomLayers(initBottomLayers);
          setBubbleActiveBottomId(initBotLayer.id);
        } else {
          setBubbleBottomLayers([]);
          setBubbleActiveBottomId('');
        }

        const compBubble = await createCompositeBubblePendant({
          topLayers: [initTopLayer],
          bottomLayers: initBottomLayers,
          addGlow: false,
        });
        setBubbleResult(compBubble);
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
    topBottomCrop?: number;
  }) => {
    const mode = opts?.mode ?? pendantUploadMode;
    const tImg = opts?.topImg !== undefined ? opts.topImg : pendantTopImg;
    const bImg = opts?.bottomImg !== undefined ? opts.bottomImg : pendantBottomImg;
    const fImg = opts?.fullImg !== undefined ? opts.fullImg : (pendantFullImg || cachedPendantImg || cachedCutoutImg);

    const tScale = opts?.topScale ?? pendantTopScale;
    const tOffX = opts?.topOffX ?? pendantTopOffsetX;
    const tOffY = opts?.topOffY ?? pendantTopOffsetY;
    const tCrop = opts?.topBottomCrop !== undefined ? opts.topBottomCrop : pendantTopBottomCrop;

    const bScale = opts?.bottomScale ?? pendantBottomScale;
    const bOffX = opts?.bottomOffX ?? pendantBottomOffsetX;
    const bOffY = opts?.bottomOffY ?? pendantBottomOffsetY;

    try {
      if (mode === 'split') {
        const res = await createCompositeCoverPendant({
          topPart: tImg ? { source: tImg, scale: tScale, offsetX: tOffX, offsetY: tOffY, bottomCropPercent: tCrop } : null,
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
    topLayers?: BubbleLayerItem[];
    bottomLayers?: BubbleLayerItem[];
    fullImg?: HTMLImageElement | null;
    fullSplitConfig?: FullBubbleSplitConfig;
    mode?: 'split' | 'full';
  }) => {
    const mode = opts?.mode ?? bubbleUploadMode;
    const tLayers = opts?.topLayers ?? bubbleTopLayers;
    const bLayers = opts?.bottomLayers ?? bubbleBottomLayers;
    const fImg = opts?.fullImg !== undefined ? opts.fullImg : (bubbleFullImg || cachedBubbleImg || cachedCutoutImg);
    const fSplit = opts?.fullSplitConfig ?? bubbleFullSplitConfig;

    try {
      if (mode === 'split') {
        const res = await createCompositeBubblePendant({
          topLayers: tLayers.map((l) => ({
            id: l.id,
            name: l.name,
            source: l.source,
            scale: l.scale,
            offsetX: l.offsetX,
            offsetY: l.offsetY,
            flipX: l.flipX,
            bottomCropPercent: l.bottomCropPercent,
            topCropPercent: l.topCropPercent,
            baseHeight: 96,
          })),
          bottomLayers: bLayers.map((l) => ({
            id: l.id,
            name: l.name,
            source: l.source,
            scale: l.scale,
            offsetX: l.offsetX,
            offsetY: l.offsetY,
            flipX: l.flipX,
            bottomCropPercent: l.bottomCropPercent,
            topCropPercent: l.topCropPercent,
            baseHeight: 72,
          })),
          addGlow: false,
        });
        setBubbleResult(res);
      } else {
        if (!fImg) return;
        const res = await createCompositeBubblePendant({
          fullSource: fImg,
          fullSplitConfig: fSplit,
          addGlow: false,
        });
        setBubbleResult(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Helper to update the currently active layer in Top or Bottom and re-render immediately
   */
  const updateActiveBubbleLayer = (
    part: 'top' | 'bottom',
    patch: Partial<BubbleLayerItem>,
    targetLayerId?: string
  ) => {
    if (part === 'top') {
      const targetId = targetLayerId || activeTopLayer?.id;
      const nextLayers = bubbleTopLayers.map((l) => (l.id === targetId ? { ...l, ...patch } : l));
      setBubbleTopLayers(nextLayers);
      renderCompositeBubble({ topLayers: nextLayers });
    } else {
      const targetId = targetLayerId || activeBottomLayer?.id;
      const nextLayers = bubbleBottomLayers.map((l) => (l.id === targetId ? { ...l, ...patch } : l));
      setBubbleBottomLayers(nextLayers);
      renderCompositeBubble({ bottomLayers: nextLayers });
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
  // Supports Multi-Layer Hit-Testing on Canvas + Full Mid-Split Dragging
  // -------------------------------------------------------------
  const handleBubblePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!bubbleCanvasRef.current) return;
    const rect = bubbleCanvasRef.current.getBoundingClientRect();
    const clickXRelCenter = ((e.clientX - rect.left) / rect.width) * 480 - 240;
    const clickY = ((e.clientY - rect.top) / rect.height) * 384;

    if (bubbleUploadMode === 'full') {
      const subPart: 'top' | 'bottom' = clickY >= 204 ? 'bottom' : 'top';
      setBubbleFullEditPart(subPart);
      const startOffX = bubbleFullSplitConfig.enabled
        ? (subPart === 'top' ? bubbleFullSplitConfig.topOffsetX : bubbleFullSplitConfig.bottomOffsetX)
        : (bubbleFullSplitConfig.fullOffsetX || 0);
      const startOffY = bubbleFullSplitConfig.enabled
        ? (subPart === 'top' ? bubbleFullSplitConfig.topOffsetY : bubbleFullSplitConfig.bottomOffsetY)
        : (bubbleFullSplitConfig.fullOffsetY || 0);

      bubbleDragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startOffX,
        startOffY,
        part: 'full',
        fullSubPart: subPart,
      };
    } else {
      let part: 'top' | 'bottom' = clickY >= 204 ? 'bottom' : 'top';
      if (part === 'bottom' && bubbleBottomLayers.length === 0 && bubbleTopLayers.length > 0) {
        part = 'top';
      } else if (part === 'top' && bubbleTopLayers.length === 0 && bubbleBottomLayers.length > 0) {
        part = 'bottom';
      }
      setBubbleActivePart(part);

      const layers = part === 'top' ? bubbleTopLayers : bubbleBottomLayers;
      if (layers.length === 0) return;

      // Auto-select the layer in that zone closest horizontally to where the user clicked!
      let chosenLayer = part === 'top' ? (activeTopLayer || layers[0]) : (activeBottomLayer || layers[0]);
      if (layers.length > 1) {
        let minDist = Infinity;
        for (const l of layers) {
          const dist = Math.abs(l.offsetX - clickXRelCenter);
          if (dist < minDist) {
            minDist = dist;
            chosenLayer = l;
          }
        }
        if (part === 'top') setBubbleActiveTopId(chosenLayer.id);
        else setBubbleActiveBottomId(chosenLayer.id);
      }

      bubbleDragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startOffX: chosenLayer.offsetX,
        startOffY: chosenLayer.offsetY,
        part,
        layerId: chosenLayer.id,
      };
    }

    setIsDraggingBubble(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBubble || !bubbleDragStartRef.current || !bubbleCanvasRef.current) return;
    const rect = bubbleCanvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - bubbleDragStartRef.current.clientX) / rect.width) * 480;
    const dy = ((e.clientY - bubbleDragStartRef.current.clientY) / rect.height) * 384;

    const { part, layerId, fullSubPart } = bubbleDragStartRef.current;
    const nextOffX = Math.round(bubbleDragStartRef.current.startOffX + dx);
    const nextOffY = Math.round(bubbleDragStartRef.current.startOffY + dy);

    if (part === 'top') {
      const nextLayers = bubbleTopLayers.map((l) =>
        l.id === layerId ? { ...l, offsetX: nextOffX, offsetY: nextOffY } : l
      );
      setBubbleTopLayers(nextLayers);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      bubbleDebounceTimerRef.current = setTimeout(() => {
        renderCompositeBubble({ topLayers: nextLayers });
      }, 35);
    } else if (part === 'bottom') {
      const nextLayers = bubbleBottomLayers.map((l) =>
        l.id === layerId ? { ...l, offsetX: nextOffX, offsetY: nextOffY } : l
      );
      setBubbleBottomLayers(nextLayers);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      bubbleDebounceTimerRef.current = setTimeout(() => {
        renderCompositeBubble({ bottomLayers: nextLayers });
      }, 35);
    } else {
      const nextSplit: FullBubbleSplitConfig = { ...bubbleFullSplitConfig };
      if (nextSplit.enabled) {
        if (fullSubPart === 'bottom') {
          nextSplit.bottomOffsetX = nextOffX;
          nextSplit.bottomOffsetY = nextOffY;
        } else {
          nextSplit.topOffsetX = nextOffX;
          nextSplit.topOffsetY = nextOffY;
        }
      } else {
        nextSplit.fullOffsetX = nextOffX;
        nextSplit.fullOffsetY = nextOffY;
      }
      setBubbleFullSplitConfig(nextSplit);
      if (bubbleDebounceTimerRef.current) clearTimeout(bubbleDebounceTimerRef.current);
      bubbleDebounceTimerRef.current = setTimeout(() => {
        renderCompositeBubble({ fullSplitConfig: nextSplit });
      }, 35);
    }
  };

  const handleBubblePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBubble) return;
    setIsDraggingBubble(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (bubbleDragStartRef.current) {
      await renderCompositeBubble();
      bubbleDragStartRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // 5. Vertical fine-tuning handlers for 封面挂件
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
  // 6. Step Fine-Tuning & Scale Handlers for 气泡挂件 (4-Direction D-Pad + Right Zoom Bar)
  // -------------------------------------------------------------
  const handleBubbleStepFineTune = (deltaY: number) => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top' && activeTopLayer) {
        updateActiveBubbleLayer('top', { offsetY: activeTopLayer.offsetY + deltaY });
      } else if (bubbleActivePart === 'bottom' && activeBottomLayer) {
        updateActiveBubbleLayer('bottom', { offsetY: activeBottomLayer.offsetY + deltaY });
      }
    } else {
      const next = { ...bubbleFullSplitConfig };
      if (next.enabled) {
        if (bubbleFullEditPart === 'top') next.topOffsetY += deltaY;
        else next.bottomOffsetY += deltaY;
      } else {
        next.fullOffsetY = (next.fullOffsetY || 0) + deltaY;
      }
      setBubbleFullSplitConfig(next);
      renderCompositeBubble({ fullSplitConfig: next });
    }
  };

  const handleBubbleStepFineTuneX = (deltaX: number) => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top' && activeTopLayer) {
        updateActiveBubbleLayer('top', { offsetX: activeTopLayer.offsetX + deltaX });
      } else if (bubbleActivePart === 'bottom' && activeBottomLayer) {
        updateActiveBubbleLayer('bottom', { offsetX: activeBottomLayer.offsetX + deltaX });
      }
    } else {
      const next = { ...bubbleFullSplitConfig };
      if (next.enabled) {
        if (bubbleFullEditPart === 'top') next.topOffsetX += deltaX;
        else next.bottomOffsetX += deltaX;
      } else {
        next.fullOffsetX = (next.fullOffsetX || 0) + deltaX;
      }
      setBubbleFullSplitConfig(next);
      renderCompositeBubble({ fullSplitConfig: next });
    }
  };

  const handleBubbleStepScale = (deltaScale: number) => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top' && activeTopLayer) {
        const nextScale = Math.min(2.5, Math.max(0.2, Math.round((activeTopLayer.scale + deltaScale) * 100) / 100));
        updateActiveBubbleLayer('top', { scale: nextScale });
      } else if (bubbleActivePart === 'bottom' && activeBottomLayer) {
        const nextScale = Math.min(2.5, Math.max(0.2, Math.round((activeBottomLayer.scale + deltaScale) * 100) / 100));
        updateActiveBubbleLayer('bottom', { scale: nextScale });
      }
    } else {
      const next = { ...bubbleFullSplitConfig };
      if (next.enabled) {
        if (bubbleFullEditPart === 'top') {
          next.topScale = Math.min(2.5, Math.max(0.2, Math.round((next.topScale + deltaScale) * 100) / 100));
        } else {
          next.bottomScale = Math.min(2.5, Math.max(0.2, Math.round((next.bottomScale + deltaScale) * 100) / 100));
        }
      } else {
        next.fullScale = Math.min(2.5, Math.max(0.2, Math.round(((next.fullScale || 1.0) + deltaScale) * 100) / 100));
      }
      setBubbleFullSplitConfig(next);
      renderCompositeBubble({ fullSplitConfig: next });
    }
  };

  const handleBubbleResetScale100 = () => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top' && activeTopLayer) {
        updateActiveBubbleLayer('top', { scale: 1.0 });
      } else if (bubbleActivePart === 'bottom' && activeBottomLayer) {
        updateActiveBubbleLayer('bottom', { scale: 1.0 });
      }
    } else {
      const next = { ...bubbleFullSplitConfig };
      if (next.enabled) {
        if (bubbleFullEditPart === 'top') next.topScale = 1.0;
        else next.bottomScale = 1.0;
      } else {
        next.fullScale = 1.0;
      }
      setBubbleFullSplitConfig(next);
      renderCompositeBubble({ fullSplitConfig: next });
    }
  };

  const handleBubbleResetCenter = () => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top' && activeTopLayer) {
        updateActiveBubbleLayer('top', { offsetX: 0 });
      } else if (bubbleActivePart === 'bottom' && activeBottomLayer) {
        updateActiveBubbleLayer('bottom', { offsetX: 0 });
      }
    } else {
      const next = { ...bubbleFullSplitConfig };
      if (next.enabled) {
        if (bubbleFullEditPart === 'top') next.topOffsetX = 0;
        else next.bottomOffsetX = 0;
      } else {
        next.fullOffsetX = 0;
      }
      setBubbleFullSplitConfig(next);
      renderCompositeBubble({ fullSplitConfig: next });
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
  // 8. Upload & Multi-Layer / Transparency Processing Handlers
  // -------------------------------------------------------------
  const processUploadedFileToTransparentLayer = async (
    file: File,
    progressCallback?: (p: number, msg: string) => void
  ): Promise<{ rawImg: HTMLImageElement; cutoutImg: HTMLImageElement }> => {
    // Yield immediately to let browser render upload modal progress
    await new Promise((r) => setTimeout(r, 20));
    progressCallback?.(15, '正在读取并解析图片通道...');
    const rawImg = await loadImageElement(file);
    await new Promise((r) => setTimeout(r, 20));

    const rw = rawImg.naturalWidth || rawImg.width;
    const rh = rawImg.naturalHeight || rawImg.height;

    // Fast check: sample to see if image is already a transparent PNG
    const testCanvas = document.createElement('canvas');
    testCanvas.width = Math.min(300, rw);
    testCanvas.height = Math.min(300, rh);
    const testCtx = testCanvas.getContext('2d')!;
    testCtx.drawImage(rawImg, 0, 0, testCanvas.width, testCanvas.height);
    const testData = testCtx.getImageData(0, 0, testCanvas.width, testCanvas.height).data;
    let transparentCount = 0;
    for (let i = 0; i < testData.length; i += 4) {
      if (testData[i + 3] < 24) transparentCount++;
    }
    const isAlreadyTransparent = transparentCount / (testCanvas.width * testCanvas.height) > 0.05;

    let cutoutCanvas: HTMLCanvasElement;
    if (isAlreadyTransparent) {
      progressCallback?.(85, '检测到素材已自带透明通道，正在紧凑贴合裁边...');
      cutoutCanvas = testCanvas.width === rw && testCanvas.height === rh ? testCanvas : document.createElement('canvas');
      if (cutoutCanvas !== testCanvas) {
        cutoutCanvas.width = rw;
        cutoutCanvas.height = rh;
        cutoutCanvas.getContext('2d')!.drawImage(rawImg, 0, 0);
      }
    } else {
      progressCallback?.(50, '智能识别背景颜色与边缘轮廓...');
      await new Promise((r) => setTimeout(r, 20));
      // Fast, non-blocking edge-flood transparency (downscaled if > 1200px)
      const autoTrans = await processImageTransparency(rawImg, DEFAULT_BG_CONFIG);
      cutoutCanvas = autoTrans.canvas;
    }

    await new Promise((r) => setTimeout(r, 20));
    progressCallback?.(92, '消除透明冗余留白...');
    const trimmed = await trimImageTransparentBorders(cutoutCanvas, { alphaThreshold: 24, padding: 0 });
    return { rawImg, cutoutImg: trimmed.img };
  };

  const handleUploadMain = async (file: File) => {
    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4');
    setIsProcessing(true);
    setProcessingStatus(isVideo ? '正在解析视频并提取封面关键帧...' : '正在准备解析图片与色彩通道...');
    setProcessingProgress(15);
    await new Promise((r) => setTimeout(r, 20));

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
        sourceImg = await extractFrameFromVideoUrl(url, 0.5);
      } else {
        sourceImg = await loadImageElement(file);
        setVideoFile(null);
        setVideoUrl(null);
        setVideoAnalysis(null);
      }

      setCachedSourceImg(sourceImg);
      await new Promise((r) => setTimeout(r, 20));

      // 1. Cover: 957x1278
      setProcessingStatus('正在生成 957×1278 微信官方标准封面图...');
      setProcessingProgress(35);
      await new Promise((r) => setTimeout(r, 20));
      const cover = await fitImageToTarget(sourceImg, 957, 1278, {
        mode: coverFitMode,
        zoom: coverZoom,
        panY: coverPanY,
        bgColor: coverBgColor,
        maxBytes: 500 * 1024,
      });
      setCoverResult(cover);
      await new Promise((r) => setTimeout(r, 20));

      // 2. Story: 750x1250
      setProcessingStatus('正在生成 750×1250 沉浸式封面故事...');
      setProcessingProgress(55);
      await new Promise((r) => setTimeout(r, 20));
      const story = await createCoverStory(sourceImg, {
        title: storyTitle,
        subtitle: storySubtitle,
        description: storyDesc,
      });
      setStoryResult(story);
      await new Promise((r) => setTimeout(r, 20));

      // 3. AI Matting for Pendants (Cover & Bubble)
      setProcessingStatus('智能抠取主体，生成透明背景挂件...');
      setProcessingProgress(70);
      await new Promise((r) => setTimeout(r, 20));

      const { cutoutImg } = await processUploadedFileToTransparentLayer(file, (p, msg) => {
        setProcessingProgress(60 + Math.round(p * 0.2));
        setProcessingStatus(msg);
      });

      setCachedCutoutImg(cutoutImg);
      setCachedPendantImg(cutoutImg);
      setCachedBubbleImg(cutoutImg);

      // 4. Pendant: 1053x1746
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

      // 5. Bubble: 480x384
      setProcessingStatus('正在生成 480×384 气泡挂件并校验完整形象零截断...');
      setProcessingProgress(95);
      const newTopLayer: BubbleLayerItem = {
        id: `top-${Date.now()}`,
        name: file.name || '主挂件 #1',
        rawSource: sourceImg,
        source: cutoutImg,
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        flipX: false,
        bottomCropPercent: 0,
        topCropPercent: 0,
        bgConfig: { ...DEFAULT_BG_CONFIG },
      };
      setBubbleTopLayers([newTopLayer]);
      setBubbleActiveTopId(newTopLayer.id);

      const bubble = await createCompositeBubblePendant({
        topLayers: [newTopLayer],
        bottomLayers: bubbleBottomLayers,
        addGlow: false,
      });
      setBubbleResult(bubble);

      setProcessingProgress(100);
      onNotification('🎉 成功生成全套符合微信规范素材！已自动去除背景透明化，支持多图叠加与微调。');
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
      const { cutoutImg } = await processUploadedFileToTransparentLayer(file, (p, msg) => {
        setProcessingProgress(50 + Math.round(p * 0.2));
        setProcessingStatus(msg);
      });

      setProcessingProgress(85);
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

  /**
   * 支持顶部趴贴小熊 & 底部垂饰同时或分批上传多张图片，并自动抠图透明化 + 合成一张 480×384 规范图
   */
  const handleUploadBubbleMultipleFiles = async (
    fileList: FileList | File[],
    slot: 'top' | 'bottom' | 'full',
    replaceActive = false
  ) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(`正在自动化透明抠图并处理 ${files.length} 张气泡挂件素材...`);
    setProcessingProgress(25);

    try {
      if (slot === 'full') {
        const file = files[0];
        const { rawImg, cutoutImg } = await processUploadedFileToTransparentLayer(file, (p, msg) => {
          setProcessingProgress(40 + Math.round(p * 0.4));
          setProcessingStatus(msg);
        });
        setBubbleFullRawImg(rawImg);
        setBubbleFullImg(cutoutImg);
        setBubbleFullFileName(file.name);
        setBubbleFullBgConfig({ ...DEFAULT_BG_CONFIG });
        setBubbleUploadMode('full');
        await renderCompositeBubble({ fullImg: cutoutImg, mode: 'full' });
        setProcessingProgress(100);
        onNotification('🎉 整张单图已自动透明化加载！可从中间截开分别调节上下位置并导出一张 480×384 规范 PNG。');
        return;
      }

      const existingLayers = slot === 'top' ? [...bubbleTopLayers] : [...bubbleBottomLayers];
      const newItems: BubbleLayerItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProcessingStatus(`正在处理第 ${i + 1}/${files.length} 张图片 (${f.name}) · 自动去背景透明化...`);
        setProcessingProgress(25 + Math.round(((i + 0.5) / files.length) * 60));
        const { rawImg, cutoutImg } = await processUploadedFileToTransparentLayer(f);

        newItems.push({
          id: `${slot}-${Date.now()}-${i}`,
          name: f.name.replace(/\.[^.]+$/, '') || `${slot === 'top' ? '顶部小熊' : '底部垂饰'} #${existingLayers.length + i + 1}`,
          rawSource: rawImg,
          source: cutoutImg,
          scale: 1.0,
          offsetX: 0,
          offsetY: 0,
          flipX: false,
          bottomCropPercent: 0,
          topCropPercent: 0,
          bgConfig: { ...DEFAULT_BG_CONFIG },
        });
      }

      let combined: BubbleLayerItem[];
      if (replaceActive && existingLayers.length > 0 && newItems.length === 1) {
        const activeId = slot === 'top' ? activeTopLayer?.id : activeBottomLayer?.id;
        combined = existingLayers.map((l) =>
          l.id === activeId
            ? { ...newItems[0], id: l.id, offsetX: l.offsetX, offsetY: l.offsetY, scale: l.scale }
            : l
        );
      } else {
        combined = [...existingLayers, ...newItems];
        // Smart auto-distribute X offsets when multiple images are present so they don't overlap 100%
        if (combined.length > 1) {
          const span = Math.min(200, (combined.length - 1) * 84);
          combined = combined.map((item, idx) => ({
            ...item,
            offsetX: Math.round(-span / 2 + (span / (combined.length - 1)) * idx),
          }));
        }
      }

      const latestActiveId = newItems[newItems.length - 1].id;
      if (slot === 'top') {
        setBubbleTopLayers(combined);
        if (!replaceActive) setBubbleActiveTopId(latestActiveId);
        setBubbleActivePart('top');
        await renderCompositeBubble({ topLayers: combined, mode: 'split' });
      } else {
        setBubbleBottomLayers(combined);
        if (!replaceActive) setBubbleActiveBottomId(latestActiveId);
        setBubbleActivePart('bottom');
        await renderCompositeBubble({ bottomLayers: combined, mode: 'split' });
      }

      setProcessingProgress(100);
      onNotification(
        `🎉 已成功上传并自动透明化 ${files.length} 张${slot === 'top' ? '顶部趴贴' : '底部垂饰'}图片！当前共 ${combined.length} 个图层合成一张规范图。`
      );
    } catch (e: any) {
      onNotification('气泡挂件处理失败: ' + e.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleUploadBubbleSlot = async (file: File, slot: 'top' | 'bottom' | 'full') => {
    await handleUploadBubbleMultipleFiles([file], slot, false);
  };

  /**
   * 复制当前图层并水平对称排布（一键把单张小熊拓展为饱满的多图组合！）
   */
  const handleDuplicateBubbleLayer = async (part: 'top' | 'bottom') => {
    const target = part === 'top' ? activeTopLayer : activeBottomLayer;
    if (!target) return;

    const layers = part === 'top' ? [...bubbleTopLayers] : [...bubbleBottomLayers];
    const newId = `${part}-dup-${Date.now()}`;
    const cloned: BubbleLayerItem = {
      ...target,
      id: newId,
      name: `${target.name} (副本)`,
      flipX: !target.flipX,
      offsetX: target.offsetX === 0 ? 58 : -target.offsetX,
    };

    // If original was at X=0, shift original to -58 and clone to +58 for instant 210px+ symmetric fullness!
    const updatedLayers = layers.map((l) =>
      l.id === target.id && l.offsetX === 0 ? { ...l, offsetX: -58 } : l
    );
    updatedLayers.push(cloned);

    if (part === 'top') {
      setBubbleTopLayers(updatedLayers);
      setBubbleActiveTopId(newId);
      await renderCompositeBubble({ topLayers: updatedLayers });
    } else {
      setBubbleBottomLayers(updatedLayers);
      setBubbleActiveBottomId(newId);
      await renderCompositeBubble({ bottomLayers: updatedLayers });
    }
    onNotification(`✨ 已复制并对称排布「${target.name}」！多张图片将自动合成为一张 480×384 规范 PNG。`);
  };

  /**
   * 删除指定图层
   */
  const handleDeleteBubbleLayer = async (part: 'top' | 'bottom', layerId: string) => {
    if (part === 'top') {
      const next = bubbleTopLayers.filter((l) => l.id !== layerId);
      setBubbleTopLayers(next);
      setBubbleActiveTopId(next[0]?.id || '');
      await renderCompositeBubble({ topLayers: next });
      onNotification('已移除该顶部图层');
    } else {
      const next = bubbleBottomLayers.filter((l) => l.id !== layerId);
      setBubbleBottomLayers(next);
      setBubbleActiveBottomId(next[0]?.id || '');
      await renderCompositeBubble({ bottomLayers: next });
      onNotification('已移除该底部图层');
    }
  };

  /**
   * 将整张单图从中间截开，直接转为「顶部趴贴小熊」+「底部垂饰」独立可编辑图层！
   */
  const handleSplitFullImageToLayers = async () => {
    const fImg = bubbleFullImg || cachedBubbleImg;
    if (!fImg) {
      onNotification('请先上传整张单图');
      return;
    }
    setIsProcessing(true);
    setProcessingStatus('正在按分割线从中间截开，并生成顶部与底部独立图层...');
    setProcessingProgress(50);
    try {
      const { topImg, bottomImg } = await splitSingleImageIntoTopAndBottom(fImg, bubbleFullSplitConfig.splitRatio);
      const topItem: BubbleLayerItem = {
        id: `top-split-${Date.now()}`,
        name: '上半截 · 顶部趴贴',
        rawSource: topImg,
        source: topImg,
        scale: bubbleFullSplitConfig.topScale || 1.0,
        offsetX: bubbleFullSplitConfig.topOffsetX || 0,
        offsetY: bubbleFullSplitConfig.topOffsetY || 0,
        flipX: false,
        bottomCropPercent: 0,
        topCropPercent: 0,
        bgConfig: { ...DEFAULT_BG_CONFIG },
      };
      const botItem: BubbleLayerItem = {
        id: `bot-split-${Date.now()}`,
        name: '下半截 · 底部垂饰',
        rawSource: bottomImg,
        source: bottomImg,
        scale: bubbleFullSplitConfig.bottomScale || 1.0,
        offsetX: bubbleFullSplitConfig.bottomOffsetX || 0,
        offsetY: bubbleFullSplitConfig.bottomOffsetY || 0,
        flipX: false,
        bottomCropPercent: 0,
        topCropPercent: 0,
        bgConfig: { ...DEFAULT_BG_CONFIG },
      };

      setBubbleTopLayers([topItem]);
      setBubbleActiveTopId(topItem.id);
      setBubbleBottomLayers([botItem]);
      setBubbleActiveBottomId(botItem.id);
      setBubbleUploadMode('split');
      setBubbleActivePart('top');

      await renderCompositeBubble({
        topLayers: [topItem],
        bottomLayers: [botItem],
        mode: 'split',
      });
      onNotification('✂️ 已成功从中间截开为「顶部趴贴」与「底部垂饰」两个图层！可分别微调位置后导出一张合成图。');
    } catch (e: any) {
      onNotification('截开图片失败: ' + e.message);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(100);
    }
  };

  const handleAutoTightTrim = async (slot: 'bubbleTop' | 'bubbleBottom' | 'pendantTop') => {
    setIsProcessing(true);
    setProcessingStatus('正在智能检测主体轮廓，清除周围空白与接触阴影...');
    try {
      if (slot === 'bubbleTop') {
        if (!activeTopLayer) return;
        const trimmed = await trimImageTransparentBorders(activeTopLayer.source, { alphaThreshold: 35, padding: 0 });
        updateActiveBubbleLayer('top', { source: trimmed.img, bottomCropPercent: 0, topCropPercent: 0 });
        onNotification('✨ 已成功紧凑裁切顶部图层！底部多余空白与阴影已清除，紧密贴齐 Y=96px 卡片顶边');
      } else if (slot === 'bubbleBottom') {
        if (!activeBottomLayer) return;
        const trimmed = await trimImageTransparentBorders(activeBottomLayer.source, { alphaThreshold: 35, padding: 0 });
        updateActiveBubbleLayer('bottom', { source: trimmed.img, bottomCropPercent: 0, topCropPercent: 0 });
        onNotification('✨ 已成功紧凑裁切底部垂饰！顶部多余空白已清除，紧密贴齐 Y=312px 卡片底边');
      } else {
        if (!pendantTopImg) return;
        const trimmed = await trimImageTransparentBorders(pendantTopImg, { alphaThreshold: 35, padding: 0 });
        setPendantTopImg(trimmed.img);
        setPendantTopBottomCrop(0);
        await renderCompositePendant({ topImg: trimmed.img, topBottomCrop: 0 });
        onNotification('✨ 已成功紧凑裁切！挂件底部多余空白与阴影已清除');
      }
    } catch (e: any) {
      onNotification('裁切失败: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 「一键均匀排布」辅助功能：将多张图层水平均匀分布在 210px 黄金宽度内并贴齐边缘
   */
  const handleSpreadLayersBestWidth = async (part: 'top' | 'bottom') => {
    const layers = part === 'top' ? [...bubbleTopLayers] : [...bubbleBottomLayers];
    if (layers.length === 0) return;
    const span = layers.length === 1 ? 0 : Math.min(200, Math.max(120, (layers.length - 1) * 72));
    const updated = layers.map((item, idx) => ({
      ...item,
      offsetY: 0,
      offsetX: layers.length === 1 ? 0 : Math.round(-span / 2 + (span / (layers.length - 1)) * idx),
    }));
    if (part === 'top') {
      setBubbleTopLayers(updated);
      await renderCompositeBubble({ topLayers: updated });
    } else {
      setBubbleBottomLayers(updated);
      await renderCompositeBubble({ bottomLayers: updated });
    }
    onNotification('↔️ 已将全部图层均匀分布在真机最佳饱满宽度区间，并精准对齐卡片边缘！');
  };

  /**
   * 「一键真机最佳比例」辅助功能 (Req 5.3):
   * 点击后，自动将当前小熊/挂件等比放大至高度约 90~95px (取 94px, 约 0.98~1.0)、宽度自动适配，并贴齐 Y=96 卡片顶沿。
   */
  const handleApplyMobileBestProportion = async () => {
    if (bubbleUploadMode === 'split') {
      if (bubbleActivePart === 'top' && activeTopLayer) {
        // 94px height (~98% of 96px), strictly snapped to Y=96 (offsetY = 0)
        const targetScale = 0.98;
        updateActiveBubbleLayer('top', { scale: targetScale, offsetY: 0 });
        onNotification('🎯 已应用「真机最佳比例」：小熊高度锁定为 94px (90~95px 黄金区间)，下沿精准贴齐 Y=96 红包顶边！');
      } else if (bubbleActivePart === 'bottom' && activeBottomLayer) {
        updateActiveBubbleLayer('bottom', { scale: 0.98, offsetY: 0 });
        onNotification('🎯 已应用底部垂饰「真机最佳比例」：高度锁定 70px，顶沿精准贴齐 Y=312 红包底边！');
      }
    } else {
      const next: FullBubbleSplitConfig = {
        ...bubbleFullSplitConfig,
        enabled: true,
        topScale: 0.98,
        topOffsetY: 0,
        bottomScale: 0.98,
        bottomOffsetY: 0,
      };
      setBubbleFullSplitConfig(next);
      await renderCompositeBubble({ fullSplitConfig: next });
      onNotification('🎯 已应用「真机最佳比例」并贴齐卡片上下沿！');
    }
  };

  // 满格合规 96px / 72px
  const handleResetStandard96 = () => {
    if (bubbleActivePart === 'bottom' && activeBottomLayer) {
      updateActiveBubbleLayer('bottom', { scale: 1.0, offsetY: 0, offsetX: 0 });
      onNotification('🎯 已重置为底部垂饰 72px 满格规范：顶沿贴齐 Y=312，底沿对齐 Y=384，完全合规！');
      return;
    }
    if (activeTopLayer) {
      updateActiveBubbleLayer('top', { scale: 1.0, offsetY: 0, offsetX: 0 });
      onNotification('🎯 已重置为微信官方 96px 满格规范：小熊高 96px，头顶对齐 Y=0，下沿贴齐 Y=96 气泡卡片，完全合规零截断！');
    }
  };

  // 一键贴齐 96px 下沿 或 312px 顶沿
  const handleSnapTo96 = () => {
    if (bubbleActivePart === 'bottom' && activeBottomLayer) {
      updateActiveBubbleLayer('bottom', { offsetY: 0 });
      onNotification('✅ 已一键贴齐 312px 气泡卡片底边！符合微信审核规范。');
      return;
    }
    if (activeTopLayer) {
      updateActiveBubbleLayer('top', { offsetY: 0 });
      onNotification('✅ 已一键贴齐 96px 气泡卡片顶边！下沿精准对齐 Y=96px，符合微信审核规范。');
    }
  };

  // -------------------------------------------------------------
  // 9. Manual Background Transparency Modal Handlers (Requirement 1)
  // -------------------------------------------------------------
  const pushBgHistory = () => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setBgUndoStack((prev) => [...prev.slice(-20), snap]);
    setBgRedoStack([]);
  };

  const handleBgUndo = () => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas || bgUndoStack.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lastSnap = bgUndoStack[bgUndoStack.length - 1];
    setBgUndoStack((prev) => prev.slice(0, -1));
    setBgRedoStack((prev) => [...prev, currentSnap]);
    ctx.putImageData(lastSnap, 0, 0);
    onNotification('↶ 已撤销上一步操作');
  };

  const handleBgRedo = () => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas || bgRedoStack.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const nextSnap = bgRedoStack[bgRedoStack.length - 1];
    setBgRedoStack((prev) => prev.slice(0, -1));
    setBgUndoStack((prev) => [...prev, currentSnap]);
    ctx.putImageData(nextSnap, 0, 0);
    onNotification('↷ 已恢复上一步操作');
  };

  // Keyboard shortcut Ctrl+Z / Cmd+Z for undo & redo inside modal
  useEffect(() => {
    if (!bgModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleBgRedo();
        } else {
          handleBgUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bgModalOpen, bgUndoStack, bgRedoStack]);

  const handleOpenBgModal = (target: 'bubbleTop' | 'bubbleBottom' | 'bubbleFull') => {
    let raw: HTMLImageElement | null = null;
    let cfg: ManualTransparencyConfig = { ...DEFAULT_BG_CONFIG };

    if (target === 'bubbleTop') {
      if (!activeTopLayer) {
        onNotification('请先上传顶部图片');
        return;
      }
      raw = activeTopLayer.rawSource || activeTopLayer.source;
      cfg = { ...activeTopLayer.bgConfig };
    } else if (target === 'bubbleBottom') {
      if (!activeBottomLayer) {
        onNotification('请先上传底部垂饰图片');
        return;
      }
      raw = activeBottomLayer.rawSource || activeBottomLayer.source;
      cfg = { ...activeBottomLayer.bgConfig };
    } else {
      raw = bubbleFullRawImg || bubbleFullImg;
      cfg = { ...bubbleFullBgConfig };
      if (!raw) {
        onNotification('请先上传完整挂件图片');
        return;
      }
    }

    setBgModalTarget(target);
    setBgModalRawImg(raw);
    setBgModalConfig(cfg);
    setBgModalTool('eyedropper');
    setBgContiguous(true);
    setBgPickedColors(cfg.customColors || (cfg.customColor ? [cfg.customColor] : []));
    setBgUndoStack([]);
    setBgRedoStack([]);
    setBgCursorPos({ x: 0, y: 0, visible: false });
    setBgModalOpen(true);
  };

  const handleRunAiBackgroundRemovalInModal = async () => {
    if (!bgModalRawImg || bgAiLoading) return;
    pushBgHistory();
    setBgAiLoading(true);
    try {
      const tempC = document.createElement('canvas');
      tempC.width = bgModalRawImg.naturalWidth || bgModalRawImg.width;
      tempC.height = bgModalRawImg.naturalHeight || bgModalRawImg.height;
      tempC.getContext('2d')!.drawImage(bgModalRawImg, 0, 0);
      const blob = await new Promise<Blob>((res) => tempC.toBlob((b) => res(b!), 'image/png'));
      const aiRes = await removeBackgroundWithAI(blob);
      const outCanvas = document.createElement('canvas');
      outCanvas.width = aiRes.width;
      outCanvas.height = aiRes.height;
      outCanvas.getContext('2d')!.putImageData(aiRes.imageData, 0, 0);
      const cleaned = await ensureTransparentSubject(outCanvas);
      const canvas = bgModalCanvasRef.current;
      if (canvas) {
        canvas.width = cleaned.width;
        canvas.height = cleaned.height;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cleaned, 0, 0);
      }
      onNotification('✨ AI 神经网络深度抠图完成！可继续使用橡皮擦或画笔微调细节。');
    } catch {
      onNotification('AI 深度抠图超时，已切换为智能色阶模式，请使用吸管或容差滑块微调。');
    } finally {
      setBgAiLoading(false);
    }
  };

  const handleRemovePickedColor = async (colorToRemove: string) => {
    pushBgHistory();
    const nextColors = bgPickedColors.filter((c) => c !== colorToRemove);
    setBgPickedColors(nextColors);
    const nextConfig: ManualTransparencyConfig = {
      ...bgModalConfig,
      mode: nextColors.length > 0 ? 'custom' : 'auto',
      customColors: nextColors,
      customColor: nextColors[nextColors.length - 1] || undefined,
      contiguous: bgContiguous,
    };
    setBgModalConfig(nextConfig);
    if (bgModalRawImg) {
      const res = await processImageTransparency(bgModalRawImg, nextConfig);
      const canvas = bgModalCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(res.canvas, 0, 0);
      }
    }
    onNotification(`已移除吸取颜色 ${colorToRemove.toUpperCase()}`);
  };

  const handleClearAllPickedColors = async () => {
    pushBgHistory();
    setBgPickedColors([]);
    const nextConfig: ManualTransparencyConfig = {
      ...bgModalConfig,
      mode: 'auto',
      customColors: [],
      customColor: undefined,
      seedPoint: undefined,
    };
    setBgModalConfig(nextConfig);
    if (bgModalRawImg) {
      const res = await processImageTransparency(bgModalRawImg, nextConfig);
      const canvas = bgModalCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(res.canvas, 0, 0);
      }
    }
    onNotification('已重置所有吸取颜色，恢复自动去底');
  };

  const handleBgModalCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas || !bgModalRawImg) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round((clientX / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round((clientY / rect.height) * canvas.height)));

    if (bgModalTool === 'eyedropper') {
      pushBgHistory();
      // Sample color from raw image at (x, y)
      const tempC = document.createElement('canvas');
      tempC.width = canvas.width;
      tempC.height = canvas.height;
      const tCtx = tempC.getContext('2d')!;
      tCtx.drawImage(bgModalRawImg, 0, 0, canvas.width, canvas.height);
      const pixel = tCtx.getImageData(x, y, 1, 1).data;
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      const pickedHex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;

      const nextColors = bgPickedColors.includes(pickedHex) ? bgPickedColors : [...bgPickedColors, pickedHex];
      setBgPickedColors(nextColors);

      const nextConfig: ManualTransparencyConfig = {
        ...bgModalConfig,
        mode: 'custom',
        customColor: pickedHex,
        customColors: nextColors,
        contiguous: bgContiguous,
        seedPoint: { x, y },
      };
      setBgModalConfig(nextConfig);

      (async () => {
        const res = await processImageTransparency(bgModalRawImg, nextConfig);
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(res.canvas, 0, 0);
      })();

      onNotification(
        bgContiguous
          ? `💧 [连续漫水] 已吸取 ${pickedHex.toUpperCase()}，仅删除该连通区域，保护主体内部同色！支持叠加继续吸色或撤销。`
          : `💧 [全图取色] 已吸取 ${pickedHex.toUpperCase()}，全图该颜色已变透明！支持叠加继续吸色或撤销。`
      );
      return;
    }

    pushBgHistory();
    setIsPaintingBgModal(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    paintOnBgModalCanvas(x, y);
  };

  const handleBgModalCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    setBgCursorPos({ x: clientX, y: clientY, visible: true });

    if (!isPaintingBgModal) return;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round((clientX / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round((clientY / rect.height) * canvas.height)));
    paintOnBgModalCanvas(x, y);
  };

  const handleBgModalCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPaintingBgModal) return;
    setIsPaintingBgModal(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const paintOnBgModalCanvas = (cx: number, cy: number) => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas || !bgModalRawImg) return;
    const ctx = canvas.getContext('2d')!;
    const scaleFactor = Math.max(1, canvas.width / 320);
    const radius = bgBrushSize * scaleFactor;

    ctx.save();
    if (bgModalTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (bgModalTool === 'restore') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(bgModalRawImg, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  };

  const handleApplyBgModal = async () => {
    const canvas = bgModalCanvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);
    setProcessingStatus('正在应用透明背景并紧凑裁切主体轮廓...');
    try {
      const trimmed = await trimImageTransparentBorders(canvas, { alphaThreshold: 22, padding: 0 });
      if (bgModalTarget === 'bubbleTop' && activeTopLayer) {
        updateActiveBubbleLayer('top', {
          source: trimmed.img,
          bgConfig: bgModalConfig,
        });
      } else if (bgModalTarget === 'bubbleBottom' && activeBottomLayer) {
        updateActiveBubbleLayer('bottom', {
          source: trimmed.img,
          bgConfig: bgModalConfig,
        });
      } else if (bgModalTarget === 'bubbleFull') {
        const fullOut = await loadImageElement(canvas.toDataURL('image/png'));
        setBubbleFullImg(fullOut);
        setBubbleFullBgConfig(bgModalConfig);
        await renderCompositeBubble({ fullImg: fullOut, mode: 'full' });
      }
      setBgModalOpen(false);
      onNotification('✨ 透明背景调整已生效！已同步更新至 480×384 规范画布与真机预览。');
    } catch (e: any) {
      onNotification('应用透明处理失败: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // 10. Interactive 4-Sided Crop Modal Handlers (Requirement 3)
  // -------------------------------------------------------------
  const handleOpenCropModal = (slot: 'bubbleTop' | 'bubbleBottom' | 'pendantTop' | 'pendantBottom') => {
    let img: HTMLImageElement | null = null;
    if (slot === 'bubbleTop') {
      img = activeTopLayer?.source || null;
    } else if (slot === 'bubbleBottom') {
      img = activeBottomLayer?.source || null;
    } else if (slot === 'pendantTop') {
      img = pendantTopImg;
    } else {
      img = pendantBottomImg;
    }

    if (!img) {
      onNotification('请先上传图片再进行裁剪');
      return;
    }
    setCropModalTarget(slot);
    setCropModalImg(img);
    setCropBox({ x: 0, y: 0, width: 1, height: 1 });
    setCropModalOpen(true);
  };

  const handleCropPointerDown = (
    handle: 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se',
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropImgRef.current) return;
    const rect = cropImgRef.current.getBoundingClientRect();
    setActiveCropHandle(handle);
    setIsDraggingCropBox(true);
    cropDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startBox: { ...cropBox },
      boxPixelWidth: rect.width,
      boxPixelHeight: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCropContainerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCropBox || !activeCropHandle || !cropDragStartRef.current) return;
    const { clientX: startX, clientY: startY, startBox, boxPixelWidth, boxPixelHeight } = cropDragStartRef.current;
    if (boxPixelWidth <= 0 || boxPixelHeight <= 0) return;

    const dx = (e.clientX - startX) / boxPixelWidth;
    const dy = (e.clientY - startY) / boxPixelHeight;

    let { x, y, width, height } = startBox;
    const minSize = 0.05;

    if (activeCropHandle === 'move') {
      x = Math.max(0, Math.min(1 - width, startBox.x + dx));
      y = Math.max(0, Math.min(1 - height, startBox.y + dy));
    } else {
      if (activeCropHandle === 'e' || activeCropHandle === 'ne' || activeCropHandle === 'se') {
        width = Math.max(minSize, Math.min(1 - x, startBox.width + dx));
      }
      if (activeCropHandle === 's' || activeCropHandle === 'se' || activeCropHandle === 'sw') {
        height = Math.max(minSize, Math.min(1 - y, startBox.height + dy));
      }
      if (activeCropHandle === 'w' || activeCropHandle === 'nw' || activeCropHandle === 'sw') {
        const maxLeftX = startBox.x + startBox.width - minSize;
        const newX = Math.max(0, Math.min(maxLeftX, startBox.x + dx));
        width = startBox.width - (newX - startBox.x);
        x = newX;
      }
      if (activeCropHandle === 'n' || activeCropHandle === 'nw' || activeCropHandle === 'ne') {
        const maxTopY = startBox.y + startBox.height - minSize;
        const newY = Math.max(0, Math.min(maxTopY, startBox.y + dy));
        height = startBox.height - (newY - startBox.y);
        y = newY;
      }
    }

    setCropBox({
      x: Math.max(0, Math.min(0.95, x)),
      y: Math.max(0, Math.min(0.95, y)),
      width: Math.max(minSize, Math.min(1 - x, width)),
      height: Math.max(minSize, Math.min(1 - y, height)),
    });
  };

  const handleCropContainerPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingCropBox) return;
    setIsDraggingCropBox(false);
    setActiveCropHandle(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    cropDragStartRef.current = null;
  };

  const handleApplyCropModal = async () => {
    if (!cropModalImg) return;
    setIsProcessing(true);
    setProcessingStatus('正在按框选区域裁切素材并重新合成...');
    try {
      const cropped = await cropImageByBox(cropModalImg, cropBox);
      const trimmed = await trimImageTransparentBorders(cropped.canvas, {
        alphaThreshold: 20,
        padding: 0,
      });

      if (cropModalTarget === 'bubbleTop') {
        updateActiveBubbleLayer('top', {
          source: trimmed.img,
          bottomCropPercent: 0,
          topCropPercent: 0,
        });
        onNotification('🎉 裁剪完成！顶部挂件已更新并精准紧贴 Y=96px');
      } else if (cropModalTarget === 'pendantTop') {
        setPendantTopImg(trimmed.img);
        setPendantTopBottomCrop(0);
        await renderCompositePendant({ topImg: trimmed.img, topBottomCrop: 0 });
        onNotification('🎉 封面挂件顶部裁剪完成！');
      } else if (cropModalTarget === 'bubbleBottom') {
        updateActiveBubbleLayer('bottom', {
          source: trimmed.img,
          bottomCropPercent: 0,
          topCropPercent: 0,
        });
        onNotification('🎉 底部垂饰裁剪完成！已更新并紧贴 Y=312px');
      } else {
        setPendantBottomImg(trimmed.img);
        await renderCompositePendant({ bottomImg: trimmed.img });
        onNotification('🎉 封面挂件底部裁剪完成！');
      }
      setCropModalOpen(false);
    } catch (e: any) {
      onNotification('裁剪失败: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearBubbleSlot = async (slot: 'top' | 'bottom' | 'full') => {
    if (slot === 'top') {
      setBubbleTopLayers([]);
      setBubbleActiveTopId('');
      await renderCompositeBubble({ topLayers: [] });
      onNotification('已清空顶部所有图层');
    } else if (slot === 'bottom') {
      setBubbleBottomLayers([]);
      setBubbleActiveBottomId('');
      await renderCompositeBubble({ bottomLayers: [] });
      onNotification('已清空底部所有图层');
    } else {
      setBubbleFullRawImg(null);
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
          {/* TAB 3: 气泡挂件 1:1 像素级工作台 (480 × 384 px)          */}
          {/* ======================================================== */}
          {activeTab === 'bubble' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              {/* 1. Header & Title Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                    <span>③ 气泡挂件 1:1 像素级工作台 · 480 × 384 px</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold">
                      所见即所得 · 真机 0.6x 锚点映射
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono font-bold">
                      支持多图合成 & 单图截开 & 智能抠图
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    微信平台规范：画布 480×384px，红包卡片主体 <code className="text-neutral-600 font-mono">rect(48, 96, 384, 216)</code>，文字禁入区 <code className="text-red-500 font-mono">rect(68, 120, 272, 100)</code>，顶部挂件区 <code className="text-emerald-700 font-mono">0~96px</code>，底部装饰区 <code className="text-emerald-700 font-mono">312~384px</code>。
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleApplyMobileBestProportion}
                    className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    title="自动将当前小熊/挂件等比放大至高度约 94px，并贴齐 Y=96 卡片顶沿"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>一键真机最佳比例</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGuides((v) => !v)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
                      showGuides ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs' : 'bg-white text-neutral-500 border-neutral-200'
                    }`}
                  >
                    {showGuides ? '隐藏参考标线' : '显示微信标线'}
                  </button>
                </div>
              </div>

              {/* 2. Real-Time WeChat Compliance & True Mobile Size Warning Banner */}
              {(() => {
                const currentBottomY = 96 + bubbleTopOffsetY;
                const approxH = Math.round(96 * bubbleTopScale);
                const currentTopY = currentBottomY - approxH;
                const isBottomOver96 = bubbleUploadMode === 'split' && bubbleActivePart === 'top' && currentBottomY > 96;
                const isBottomIntrude312 = bubbleUploadMode === 'split' && bubbleActivePart === 'bottom' && (312 + bubbleBottomOffsetY) < 312;
                const isTopOverCanvas = bubbleUploadMode === 'split' && bubbleActivePart === 'top' && currentTopY < 0;

                const opaqueW = bubbleResult?.topOpaqueWidth || bubbleResult?.opaqueWidth || 0;
                const isNarrowOnMobile = opaqueW > 0 && opaqueW < 160;
                const cardRatioPercent = opaqueW > 0 ? Math.round((opaqueW / 384) * 100) : 0;

                return (
                  <div className="space-y-2">
                    {/* Compliance Status Bar */}
                    <div className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs ${
                      isBottomOver96 || isBottomIntrude312
                        ? 'bg-red-50/90 border-red-300 text-red-950'
                        : isTopOverCanvas
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    }`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold flex items-center gap-1 font-mono">
                          {isBottomOver96 || isBottomIntrude312 ? '🚨 平台驳回风险' : isTopOverCanvas ? '⚠️ 顶沿溢出提醒' : '✅ 微信审核合规'}
                        </span>
                        {bubbleUploadMode === 'split' && bubbleActivePart === 'top' && (
                          <>
                            <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                              isBottomOver96 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                            }`}>
                              顶部下沿: {currentBottomY}px {isBottomOver96 ? `(超标 ${currentBottomY - 96}px 必拒)` : '(<= 96px 合规)'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/90 border border-neutral-200 font-mono text-[11px] text-neutral-700">
                              高度: {approxH}px ({Math.round(bubbleTopScale * 100)}%)
                            </span>
                          </>
                        )}
                        {bubbleUploadMode === 'split' && bubbleActivePart === 'bottom' && (
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            isBottomIntrude312 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            底部上沿: {312 + bubbleBottomOffsetY}px {isBottomIntrude312 ? `(侵入卡片 ${312 - (312 + bubbleBottomOffsetY)}px)` : '(>= 312px 合规)'}
                          </span>
                        )}
                        {opaqueW > 0 && (
                          <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] border ${
                            isNarrowOnMobile
                              ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                              : 'bg-white/90 text-emerald-800 border-emerald-200 font-bold'
                          }`}>
                            挂件有效宽: {opaqueW}px (真机 {Math.round(opaqueW * 0.6)}pt · 占卡片 {cardRatioPercent}%)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {isBottomOver96 && (
                          <button
                            type="button"
                            onClick={handleSnapTo96}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all"
                          >
                            🎯 一键贴齐 96px 下沿
                          </button>
                        )}
                        {isBottomIntrude312 && (
                          <button
                            type="button"
                            onClick={() => updateActiveBubbleLayer('bottom', { offsetY: 0 })}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all"
                          >
                            🎯 一键贴齐 312px 底沿
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleApplyMobileBestProportion}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-1"
                          title="自动将当前小熊/挂件等比放大至高度约 94px，并贴齐 Y=96 卡片顶沿"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>一键真机最佳比例</span>
                        </button>
                      </div>
                    </div>

                    {/* 真机视觉预警 (< 160px) */}
                    {isNarrowOnMobile && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
                        <div className="flex items-start sm:items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                          <div>
                            <span className="font-bold">
                              ⚠️ 当前挂件在真机上仅占红包宽度的 {Math.max(15, cardRatioPercent)}%（有效宽度 {opaqueW}px &lt; 160px），视觉可能偏小。
                            </span>
                            <span className="text-amber-800 block sm:inline sm:ml-1">
                              建议宽度拓展至 <strong>190~230px</strong>（可上传多张小熊组合排列，或使用「复制多一只并排」）。
                            </span>
                          </div>
                        </div>
                        {bubbleUploadMode === 'split' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDuplicateBubbleLayer(bubbleActivePart)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-[11px] cursor-pointer transition-all shadow-2xs flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>复制多一只并排</span>
                            </button>
                            {(bubbleActivePart === 'top' ? bubbleTopLayers.length : bubbleBottomLayers.length) > 1 && (
                              <button
                                type="button"
                                onClick={() => handleSpreadLayersBestWidth(bubbleActivePart)}
                                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-[11px] cursor-pointer transition-all"
                              >
                                ↔️ 一键 210px 饱满排布
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 3. FRONT-AND-CENTER: 1:1 Pixel Canvas & Ruler (横向480px, 竖向384px) */}
              <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-neutral-50/90 border border-neutral-200/90 shadow-2xs">
                <div className="w-full flex items-center justify-between mb-2 text-xs text-neutral-500 px-1 font-medium flex-wrap gap-1">
                  <span className="flex items-center gap-1.5 font-bold text-neutral-700">
                    <Move className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1:1 标准画布 (480 × 384 px) · 直接点击画布中任意小熊/垂饰即可选中并拖拽</span>
                  </span>
                  <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                    {bubbleUploadMode === 'full'
                      ? bubbleFullSplitConfig.enabled
                        ? `当前编辑: 整图中间截开 (${bubbleActivePart === 'top' ? '上半截' : '下半截'})`
                        : '当前编辑: 整张单图 (480×384)'
                      : bubbleActivePart === 'top'
                      ? `当前编辑: 顶部小熊 (${activeTopLayer?.name || '图层'}) · 共${bubbleTopLayers.length}层`
                      : `当前编辑: 底部垂饰 (${activeBottomLayer?.name || '图层'}) · 共${bubbleBottomLayers.length}层`}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 sm:gap-3 w-full overflow-x-auto pb-1">
                  {/* Left 4-Direction Control Pad (上下左右方向键，控制小熊平移) */}
                  <div className="flex flex-col items-center justify-between h-[307px] sm:h-[384px] py-3 px-1.5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs select-none shrink-0 w-16 sm:w-20">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-neutral-700 font-sans">平移微调</span>
                      <span className="text-[8px] text-neutral-400 font-mono">2px/步</span>
                    </div>

                    {/* D-Pad Buttons (Up, Left, Center/Reset, Right, Down) */}
                    <div className="flex flex-col items-center gap-1.5 my-auto">
                      {/* 上方向键 */}
                      <button
                        type="button"
                        onClick={() => handleBubbleStepFineTune(-2)}
                        title="向上微调 2px"
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-100 hover:bg-emerald-100 hover:text-emerald-900 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-700 transition-all cursor-pointer"
                      >
                        ▲
                      </button>

                      {/* 中间行：左、中心重置、右 */}
                      <div className="flex items-center gap-1.5">
                        {/* 左方向键 */}
                        <button
                          type="button"
                          onClick={() => handleBubbleStepFineTuneX(-2)}
                          title="向左微调 2px"
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-100 hover:bg-emerald-100 hover:text-emerald-900 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-700 transition-all cursor-pointer"
                        >
                          ◀
                        </button>

                        {/* 中心归位/贴齐按钮 */}
                        <button
                          type="button"
                          onClick={() => {
                            if (bubbleActivePart === 'top') {
                              handleSnapTo96();
                            } else {
                              handleBubbleResetCenter();
                            }
                          }}
                          title={bubbleActivePart === 'top' ? "🎯 一键贴齐 96px 卡片顶边" : "🎯 一键贴齐 312px 卡片底边"}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 hover:bg-emerald-200 active:scale-90 border border-emerald-300 shadow-2xs flex items-center justify-center text-[10px] font-black text-emerald-800 transition-all cursor-pointer"
                        >
                          🎯
                        </button>

                        {/* 右方向键 */}
                        <button
                          type="button"
                          onClick={() => handleBubbleStepFineTuneX(2)}
                          title="向右微调 2px"
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-100 hover:bg-emerald-100 hover:text-emerald-900 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-700 transition-all cursor-pointer"
                        >
                          ▶
                        </button>
                      </div>

                      {/* 下方向键 */}
                      <button
                        type="button"
                        onClick={() => handleBubbleStepFineTune(2)}
                        title="向下微调 2px"
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-100 hover:bg-emerald-100 hover:text-emerald-900 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-xs font-black text-neutral-700 transition-all cursor-pointer"
                      >
                        ▼
                      </button>
                    </div>

                    {/* 坐标实时读数 */}
                    <div className="flex flex-col items-center gap-0.5 text-center w-full">
                      <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border shadow-2xs w-full truncate ${
                        bubbleActivePart === 'top' && (96 + bubbleTopOffsetY) > 96
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : bubbleActivePart === 'bottom' && (312 + bubbleBottomOffsetY) < 312
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {bubbleActivePart === 'top' ? `Y:${96 + bubbleTopOffsetY}` : `Y:${312 + bubbleBottomOffsetY}`}
                      </span>
                      <span className="text-[8px] text-neutral-400 font-mono">
                        {bubbleActivePart === 'top' ? `X:${bubbleTopOffsetX}` : `X:${bubbleBottomOffsetX}`}
                      </span>
                    </div>
                  </div>

                  {/* 1:1 Standardized Canvas: width 480px, height 384px */}
                  <div
                    ref={bubbleCanvasRef}
                    onPointerDown={handleBubblePointerDown}
                    onPointerMove={handleBubblePointerMove}
                    onPointerUp={handleBubblePointerUp}
                    className={`relative w-[340px] sm:w-[480px] aspect-[480/384] rounded-2xl bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:12px_12px] bg-white border border-neutral-300 flex items-center justify-center overflow-hidden shadow-sm select-none touch-none ${
                      isDraggingBubble ? 'cursor-grabbing ring-2 ring-emerald-500' : 'cursor-grab hover:ring-1 hover:ring-neutral-400'
                    }`}
                    title="按住鼠标拖拽，可在 480×384 画布内自由平移微调"
                  >
                    {/* Standardized Reference Coordinates Layer */}
                    {showGuides && (
                      <>
                        {/* 1. 顶部挂件区: rect(x: 0, y: 0, w: 480, h: 96) */}
                        <div
                          className={`absolute inset-x-0 top-0 border-b-2 border-dashed transition-colors pointer-events-none z-0 flex items-start justify-between px-2 pt-1 ${
                            bubbleActivePart === 'top'
                              ? 'border-emerald-500 bg-emerald-500/8'
                              : 'border-emerald-500/50 bg-emerald-500/4'
                          }`}
                          style={{
                            left: `${(BUBBLE_PENDANT_COORDS.topZone.x / 480) * 100}%`,
                            top: `${(BUBBLE_PENDANT_COORDS.topZone.y / 384) * 100}%`,
                            width: `${(BUBBLE_PENDANT_COORDS.topZone.w / 480) * 100}%`,
                            height: `${(BUBBLE_PENDANT_COORDS.topZone.h / 384) * 100}%`,
                          }}
                        >
                          <span className="text-[8px] font-bold text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-200 font-mono">
                            ✅ 顶部挂件区 rect(0, 0, 480, 96)
                          </span>
                          <span className="text-[7px] text-emerald-700 font-mono bg-white/80 px-1 rounded">
                            推荐宽 190~230px
                          </span>
                        </div>

                        {/* 4. 底部装饰区: rect(x: 0, y: 312, w: 480, h: 72) */}
                        <div
                          className={`absolute inset-x-0 bottom-0 border-t-2 border-dashed transition-colors pointer-events-none z-0 flex items-end justify-between px-2 pb-1 ${
                            bubbleActivePart === 'bottom'
                              ? 'border-emerald-500 bg-emerald-500/8'
                              : 'border-emerald-500/50 bg-emerald-500/4'
                          }`}
                          style={{
                            left: `${(BUBBLE_PENDANT_COORDS.bottomZone.x / 480) * 100}%`,
                            top: `${(BUBBLE_PENDANT_COORDS.bottomZone.y / 384) * 100}%`,
                            width: `${(BUBBLE_PENDANT_COORDS.bottomZone.w / 480) * 100}%`,
                            height: `${(BUBBLE_PENDANT_COORDS.bottomZone.h / 384) * 100}%`,
                          }}
                        >
                          <span className="text-[8px] font-bold text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-200 font-mono">
                            ✅ 底部装饰区 rect(0, 312, 480, 72)
                          </span>
                          <span className="text-[7px] text-emerald-700 font-mono bg-white/80 px-1 rounded">
                            上沿 Y=312px
                          </span>
                        </div>
                      </>
                    )}

                    {/* 2. 红包卡片主体: rect(x: 48, y: 96, w: 384, h: 216) */}
                    <div
                      className="absolute bg-gradient-to-r from-[#fa9d3b] to-[#f97316] rounded-xl border border-[#ea580c]/70 pointer-events-none z-5 flex flex-col justify-between shadow-xs overflow-hidden"
                      style={{
                        left: `${(BUBBLE_PENDANT_COORDS.cardBody.x / 480) * 100}%`, // 48 / 480 = 10%
                        top: `${(BUBBLE_PENDANT_COORDS.cardBody.y / 384) * 100}%`, // 96 / 384 = 25%
                        width: `${(BUBBLE_PENDANT_COORDS.cardBody.w / 480) * 100}%`, // 384 / 480 = 80%
                        height: `${(BUBBLE_PENDANT_COORDS.cardBody.h / 384) * 100}%`, // 216 / 384 = 56.25%
                      }}
                    >
                      <div className="p-2 sm:p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#c23636] text-white flex items-center justify-center text-xs shadow-xs border border-white/20">
                            🧧
                          </div>
                          <div className="space-y-0.5 text-left">
                            <div className="text-[11px] font-bold text-white leading-tight">{blessingText || '恭喜发财，大吉大利'}</div>
                            <div className="text-[8px] text-amber-100/90 font-mono">红包卡片主体 rect(48, 96, 384, 216)</div>
                          </div>
                        </div>
                        <span className="text-[7px] text-amber-100 font-mono font-bold bg-black/15 px-1.5 py-0.5 rounded">
                          真机 0.6x = 230×129.6pt
                        </span>
                      </div>
                      <div className="bg-white/95 px-2.5 py-1 flex items-center justify-between text-[8px] text-neutral-500 font-medium border-t border-amber-600/30">
                        <span>微信红包</span>
                        <span className="text-amber-700 font-bold text-[7px]">锚点 (X:48, Y:96)</span>
                      </div>
                    </div>

                    {/* 3. 文字及交互禁入区: rect(x: 68, y: 120, w: 272, h: 100) */}
                    {showGuides && (
                      <div
                        className="absolute border-2 border-dashed border-red-300/90 bg-red-600/15 rounded-lg pointer-events-none z-6 flex flex-col items-center justify-center text-center px-2"
                        style={{
                          left: `${(BUBBLE_PENDANT_COORDS.textForbiddenZone.x / 480) * 100}%`, // 68/480 = 14.17%
                          top: `${(BUBBLE_PENDANT_COORDS.textForbiddenZone.y / 384) * 100}%`, // 120/384 = 31.25%
                          width: `${(BUBBLE_PENDANT_COORDS.textForbiddenZone.w / 480) * 100}%`, // 272/480 = 56.67%
                          height: `${(BUBBLE_PENDANT_COORDS.textForbiddenZone.h / 384) * 100}%`, // 100/384 = 26.04%
                        }}
                      >
                        <span className="text-[8px] font-bold text-white bg-red-600/90 px-1.5 py-0.5 rounded shadow-2xs font-mono">
                          🚫 文字及交互禁入区 rect(68, 120, 272, 100)
                        </span>
                        <span className="text-[7px] text-white/90 mt-0.5 drop-shadow">
                          严禁挂件遮挡红包图标与祝福文字
                        </span>
                      </div>
                    )}

                    {/* Rendered Composite Result Overlay */}
                    {bubbleResult ? (
                      <>
                        <img
                          src={bubbleResult.url}
                          alt="气泡挂件"
                          className="w-full h-full object-contain drop-shadow-md z-10 pointer-events-none"
                        />

                        {/* Top Moving Dashed Line Indicators */}
                        {showGuides && (bubbleTopLayers.length > 0 || (bubbleUploadMode === 'full' && bubbleFullSplitConfig.enabled)) && bubbleActivePart === 'top' && (() => {
                          const topBottomY = 96 + (bubbleUploadMode === 'full' ? bubbleFullSplitConfig.topOffsetY : bubbleTopOffsetY);
                          const scaleVal = bubbleUploadMode === 'full' ? bubbleFullSplitConfig.topScale : bubbleTopScale;
                          const approxH = Math.round(96 * scaleVal);
                          const topTopY = topBottomY - approxH;
                          const isTopOverflow = topTopY < 0;
                          const isBottomIntrusion = topBottomY > 96;

                          return (
                            <>
                              {/* 头部顶沿移动虚线 */}
                              <div
                                className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                                style={{
                                  top: `${Math.max(0, Math.min(100, (topTopY / 384) * 100))}%`,
                                }}
                              >
                                <div className={`w-full border-t-2 border-dashed ${isTopOverflow ? 'border-amber-500' : 'border-emerald-400/80'}`} />
                                <div
                                  className={`absolute px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                    isTopOverflow
                                      ? 'bg-amber-600 text-white border-amber-300 ring-1 ring-amber-300'
                                      : topTopY === 0
                                      ? 'bg-emerald-600 text-white border-emerald-400'
                                      : 'bg-neutral-800 text-neutral-200 border-neutral-600'
                                  }`}
                                >
                                  <span>顶沿: Y={topTopY}px</span>
                                  {isTopOverflow && (
                                    <span className="text-[7px] bg-black/30 px-1 rounded font-bold">⚠️ 超出顶部 {Math.abs(topTopY)}px</span>
                                  )}
                                  {topTopY === 0 && (
                                    <span className="text-[7px] bg-white/20 px-1 rounded font-bold">🎯 满格对齐 0px</span>
                                  )}
                                </div>
                              </div>

                              {/* 小熊下边缘移动虚线 */}
                              <div
                                className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                                style={{
                                  top: `${((topBottomY) / 384) * 100}%`,
                                }}
                              >
                                <div className={`w-full border-t-2 border-dashed ${isBottomIntrusion ? 'border-red-500' : 'border-emerald-600'} shadow-xs`} />
                                <div
                                  className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                    topBottomY === 96
                                      ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300'
                                      : isBottomIntrusion
                                      ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-300'
                                      : 'bg-emerald-700 text-white border-emerald-500'
                                  }`}
                                >
                                  <span>🐻 下沿对齐线: {topBottomY}px</span>
                                  {topBottomY === 96 && (
                                    <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🎯 完美贴齐96px卡片顶边</span>
                                  )}
                                  {isBottomIntrusion && (
                                    <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🚨 超过96px (微信必拒)</span>
                                  )}
                                  {topBottomY < 96 && (
                                    <span className="text-[8px] bg-white/20 px-1 rounded">悬空 {96 - topBottomY}px</span>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        {/* Bottom Moving Dashed Line Indicators */}
                        {showGuides && (bubbleBottomLayers.length > 0 || (bubbleUploadMode === 'full' && bubbleFullSplitConfig.enabled)) && bubbleActivePart === 'bottom' && (() => {
                          const bottomTopY = 312 + (bubbleUploadMode === 'full' ? bubbleFullSplitConfig.bottomOffsetY : bubbleBottomOffsetY);
                          const isIntrudeCard = bottomTopY < 312;
                          return (
                            <div
                              className="absolute inset-x-0 pointer-events-none z-30 transition-all duration-75 flex items-center justify-center"
                              style={{
                                top: `${(bottomTopY / 384) * 100}%`,
                              }}
                            >
                              <div className={`w-full border-t-2 border-dashed ${isIntrudeCard ? 'border-red-500' : 'border-emerald-600'} shadow-xs`} />
                              <div
                                className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                                  bottomTopY === 312
                                    ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300'
                                    : isIntrudeCard
                                    ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-300'
                                    : 'bg-emerald-700 text-white border-emerald-500'
                                }`}
                              >
                                <span>🎋 底部上沿对齐线: {bottomTopY}px</span>
                                {bottomTopY === 312 && (
                                  <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🎯 完美贴齐312px卡片底沿</span>
                                )}
                                {isIntrudeCard && (
                                  <span className="text-[8px] bg-white/20 px-1 rounded font-bold">🚨 侵入卡片区 {312 - bottomTopY}px</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-neutral-400 text-xs">请上传顶部小熊或底部垂饰图片</div>
                    )}

                    {/* Dragging HUD */}
                    {isDraggingBubble && (
                      <div className="absolute top-2 bg-neutral-900/90 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md font-mono z-30 flex items-center gap-1.5">
                        <Move className="w-3 h-3 text-emerald-400" />
                        <span>
                          正在平移: {bubbleActivePart === 'top' ? `顶部 (${activeTopLayer?.name || '小熊'})` : `底部 (${activeBottomLayer?.name || '垂饰'})`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Zoom Control Bar (上是放大，下是缩小) + Height Dimension Ruler */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Vertical Zoom Controls (上是放大，下是缩小) */}
                    <div className="flex flex-col items-center justify-between h-[307px] sm:h-[384px] py-3 px-1.5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs select-none w-14 sm:w-16">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-neutral-700 font-sans">缩放</span>
                        <span className="text-[8px] text-neutral-400 font-mono">5%/步</span>
                      </div>

                      {/* Zoom Buttons: 上是放大，下是缩小 */}
                      <div className="flex flex-col items-center gap-2 my-auto w-full">
                        {/* 上：放大按键 */}
                        <button
                          type="button"
                          onClick={() => handleBubbleStepScale(0.05)}
                          title="放大 5%"
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 active:scale-90 border border-emerald-300 shadow-2xs flex flex-col items-center justify-center text-neutral-800 transition-all cursor-pointer font-bold gap-0.5"
                        >
                          <span className="text-sm font-black leading-none">＋</span>
                          <span className="text-[7px] font-extrabold text-emerald-800">放大</span>
                        </button>

                        {/* 中间显示当前比例 & 快速 100% 满格 */}
                        <button
                          type="button"
                          onClick={handleBubbleResetScale100}
                          title="点击快速重置为 100% 满格标准"
                          className="px-1.5 py-1 rounded-lg bg-neutral-100 hover:bg-emerald-50 border border-neutral-200 flex flex-col items-center justify-center cursor-pointer transition-all w-full shadow-2xs"
                        >
                          <span className="text-[10px] font-black font-mono text-emerald-900">
                            {Math.round((bubbleActivePart === 'top' ? bubbleTopScale : bubbleBottomScale) * 100)}%
                          </span>
                          <span className="text-[7px] text-emerald-700 font-bold">100%</span>
                        </button>

                        {/* 下：缩小按键 */}
                        <button
                          type="button"
                          onClick={() => handleBubbleStepScale(-0.05)}
                          title="缩小 5%"
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-900 active:scale-90 border border-neutral-200 shadow-2xs flex flex-col items-center justify-center text-neutral-700 transition-all cursor-pointer font-bold gap-0.5"
                        >
                          <span className="text-sm font-black leading-none">－</span>
                          <span className="text-[7px] font-extrabold text-neutral-600">缩小</span>
                        </button>
                      </div>

                      <div className="text-[8px] font-mono text-neutral-400 text-center">
                        {Math.round((bubbleActivePart === 'top' ? 96 * bubbleTopScale : 72 * bubbleBottomScale))}px
                      </div>
                    </div>

                    {/* Right Height Dimension Ruler (96px · 216px · 72px) */}
                    <div className="flex flex-col justify-between h-[307px] sm:h-[384px] py-1 text-[9px] font-mono select-none w-20 sm:w-24">
                      {/* Top 96px Bracket */}
                      <div className="h-[25%] flex flex-col justify-center border-l-2 border-emerald-500 pl-1.5 text-emerald-800 bg-emerald-50/70 rounded-r-lg">
                        <div className="font-extrabold flex items-center gap-0.5">
                          <span>上 96px</span>
                        </div>
                        <div className="text-[8px] text-emerald-700 font-sans font-bold">顶部挂件区</div>
                        <div className="text-[7px] text-neutral-400">0~96px</div>
                      </div>

                      {/* Middle 216px Bracket */}
                      <div className="h-[56.25%] flex flex-col justify-center border-l-2 border-red-400 pl-1.5 text-red-700 bg-red-50/60 rounded-r-lg my-1">
                        <div className="font-extrabold text-red-700">中 216px</div>
                        <div className="text-[8px] text-red-600 font-sans font-bold leading-tight">红包卡片区</div>
                        <div className="text-[7px] text-amber-800 font-sans mt-0.5">384×216</div>
                        <div className="text-[7px] text-neutral-400">96~312px</div>
                      </div>

                      {/* Bottom 72px Bracket */}
                      <div className="h-[18.75%] flex flex-col justify-center border-l-2 border-emerald-500 pl-1.5 text-emerald-800 bg-emerald-50/70 rounded-r-lg">
                        <div className="font-extrabold flex items-center gap-0.5">
                          <span>下 72px</span>
                        </div>
                        <div className="text-[8px] text-emerald-700 font-sans">底部装饰区</div>
                        <div className="text-[7px] text-neutral-400">312~384px</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. UNIFIED MULTI-LAYER & SPLIT CONTROL DECK */}
              <div className="space-y-3">
                {/* Mode Selector Tabs */}
                <div className="flex items-center justify-between p-1 bg-neutral-100 rounded-xl border border-neutral-200/80 text-xs gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBubbleUploadMode('split');
                      setBubbleActivePart('top');
                      renderCompositeBubble({ mode: 'split' });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all cursor-pointer text-center text-xs flex items-center justify-center gap-1.5 ${
                      bubbleUploadMode === 'split' && bubbleActivePart === 'top'
                        ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-200'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>🐻 顶部趴贴小熊 (多图合成 · 96px)</span>
                    {bubbleTopLayers.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-mono">
                        {bubbleTopLayers.length}张
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBubbleUploadMode('split');
                      setBubbleActivePart('bottom');
                      renderCompositeBubble({ mode: 'split' });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all cursor-pointer text-center text-xs flex items-center justify-center gap-1.5 ${
                      bubbleUploadMode === 'split' && bubbleActivePart === 'bottom'
                        ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-200'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>🎋 底部垂饰挂件 (多图合成 · 72px)</span>
                    {bubbleBottomLayers.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-mono">
                        {bubbleBottomLayers.length}张
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBubbleUploadMode('full');
                      renderCompositeBubble({ mode: 'full' });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all cursor-pointer text-center text-xs flex items-center justify-center gap-1.5 ${
                      bubbleUploadMode === 'full'
                        ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-200'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>✂️ 整张单图 / 中间截开 (480×384)</span>
                  </button>
                </div>

                {/* ===================================================================== */}
                {/* SHARED PARITY WORKBENCH FOR TOP (顶部趴贴小熊) & BOTTOM (底部垂饰)       */}
                {/* ===================================================================== */}
                {bubbleUploadMode === 'split' && (() => {
                  const isTop = bubbleActivePart === 'top';
                  const layers = isTop ? bubbleTopLayers : bubbleBottomLayers;
                  const activeLayer = isTop ? activeTopLayer : activeBottomLayer;
                  const activeId = isTop ? bubbleActiveTopId : bubbleActiveBottomId;
                  const setActiveId = isTop ? setBubbleActiveTopId : setBubbleActiveBottomId;
                  const updateLayer = (patch: Partial<BubbleLayerItem>) => updateActiveBubbleLayer(isTop ? 'top' : 'bottom', patch);
                  const zoneHeight = isTop ? 96 : 72;
                  const anchorY = isTop ? 96 : 312;

                  return (
                    <div className="space-y-3">
                      {/* Multi-Layer Strip & Multi-Image Upload Bar */}
                      <div className="p-3.5 bg-neutral-50/90 rounded-2xl border border-neutral-200/90 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-neutral-200/70 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                              {isTop ? '🐻' : '🎋'}
                            </span>
                            <div>
                              <div className="font-bold text-xs text-neutral-900 flex items-center gap-2">
                                <span>{isTop ? '顶部趴贴小熊图层管理 (0~96px)' : '底部垂饰图层管理 (312~384px)'}</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded-full font-bold">
                                  已加载 {layers.length} 张 · 自动合并输出
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400">
                                支持一次上传多张图片（左中右组合排布），上传非透明背景图将自动智能去底，也可点击「背景透明处理 / 手动抠图」精修。
                              </p>
                            </div>
                          </div>

                          {/* Upload Multiple / Add Layer / Spread Buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ 添加图片 (支持多选)</span>
                              <input
                                type="file"
                                multiple
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleUploadBubbleMultipleFiles(e.target.files, isTop ? 'top' : 'bottom', false);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>

                            {layers.length > 0 && (
                              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-100 active:scale-95 text-neutral-700 font-bold text-xs rounded-xl cursor-pointer transition-all border border-neutral-200 shadow-2xs">
                                <Upload className="w-3 h-3" />
                                <span>替换当前</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                      handleUploadBubbleMultipleFiles(e.target.files, isTop ? 'top' : 'bottom', true);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            )}

                            {layers.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleDuplicateBubbleLayer(isTop ? 'top' : 'bottom')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 font-bold text-xs rounded-xl cursor-pointer transition-all border border-amber-300 shadow-2xs"
                                title="复制当前选中的图片并自动水平错开，快速做出双熊/三熊饱满战队效果"
                              >
                                <Copy className="w-3 h-3 text-amber-700" />
                                <span>复制多一只</span>
                              </button>
                            )}

                            {layers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleSpreadLayersBestWidth(isTop ? 'top' : 'bottom')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-900 font-bold text-xs rounded-xl cursor-pointer transition-all border border-emerald-300 shadow-2xs"
                                title="将多张图层自动均匀分布在 210px 黄金宽度内并对齐边缘"
                              >
                                <span>↔️ 一键均匀排布</span>
                              </button>
                            )}

                            {layers.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearBubbleSlot(isTop ? 'top' : 'bottom')}
                                className="text-[11px] text-red-500 hover:text-red-700 font-bold cursor-pointer px-2 py-1"
                              >
                                清空全部
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Layer Cards List */}
                        {layers.length > 0 ? (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {layers.map((layer, idx) => {
                              const isSelected = layer.id === (activeLayer?.id || activeId);
                              return (
                                <div
                                  key={layer.id}
                                  onClick={() => setActiveId(layer.id)}
                                  className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer shrink-0 min-w-[165px] ${
                                    isSelected
                                      ? 'bg-white border-emerald-500 ring-2 ring-emerald-400/50 shadow-xs'
                                      : 'bg-white/70 border-neutral-200 hover:border-neutral-300'
                                  }`}
                                >
                                  <div className="w-10 h-10 rounded-lg bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:6px_6px] bg-neutral-50 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                                    <img
                                      src={layer.source.src}
                                      alt={layer.name}
                                      className={`w-full h-full object-contain p-0.5 ${layer.flipX ? '-scale-x-100' : ''}`}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-mono font-bold px-1 rounded bg-emerald-100 text-emerald-900">
                                        #{idx + 1}
                                      </span>
                                      <span className="text-xs font-bold text-neutral-800 truncate">
                                        {layer.name}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                                      {Math.round(layer.scale * 100)}% · X:{layer.offsetX > 0 ? `+${layer.offsetX}` : layer.offsetX}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBubbleLayer(isTop ? 'top' : 'bottom', layer.id);
                                    }}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="删除此图层"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-5 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl bg-white/50">
                            当前部位暂无图层，请点击右上角「+ 添加图片 (支持多选)」上传小熊或挂饰素材
                          </div>
                        )}

                        {/* Active Layer Action Toolbar (去背景透明、紧致去留白、手动裁剪、水平翻转) */}
                        {activeLayer && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200/70">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-bold text-emerald-950">
                                当前选中：{activeLayer.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                (基准高 {zoneHeight}px)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleOpenBgModal(isTop ? 'bubbleTop' : 'bubbleBottom')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-900 font-bold text-xs rounded-xl cursor-pointer transition-all border border-purple-300 shadow-2xs"
                                title="自动或手动调整背景透明容差、吸管取色抠图、橡皮擦去杂边"
                              >
                                <Wand2 className="w-3.5 h-3.5 text-purple-700" />
                                <span>背景透明处理 / 手动抠图</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAutoTightTrim(isTop ? 'bubbleTop' : 'bubbleBottom')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-900 font-bold text-xs rounded-xl cursor-pointer transition-all border border-emerald-300 shadow-2xs"
                                title="一键切除四周透明留白与底部阴影，让挂件严丝合缝贴合边缘"
                              >
                                <Scissors className="w-3 h-3 text-emerald-700" />
                                <span>智能紧凑去留白</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenCropModal(isTop ? 'bubbleTop' : 'bubbleBottom')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-50 active:scale-95 text-neutral-700 font-bold text-xs rounded-xl cursor-pointer transition-all border border-neutral-200 shadow-2xs"
                                title="打开精确可视化裁剪工具"
                              >
                                <Crop className="w-3 h-3 text-neutral-600" />
                                <span>手动裁剪</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateLayer({ flipX: !activeLayer.flipX })}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-bold text-xs rounded-xl cursor-pointer transition-all border shadow-2xs ${
                                  activeLayer.flipX
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200'
                                }`}
                                title="水平镜像翻转当前图层（适合对称摆放两只小熊）"
                              >
                                <FlipHorizontal className="w-3 h-3" />
                                <span>镜像翻转</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dual-Column Immediate Controls for Selected Layer (Top and Bottom 100% Aligned) */}
                      {activeLayer && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Left Column: 尺寸与缩放 + 留白裁切 */}
                          <div className="p-3 bg-neutral-50/80 rounded-2xl border border-neutral-200/80 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between font-bold text-neutral-700 border-b border-neutral-200/60 pb-1.5">
                              <span className="flex items-center gap-1 text-emerald-900">
                                <span>{isTop ? '小熊缩放大小' : '垂饰缩放大小'} ({activeLayer.name})</span>
                              </span>
                              <span className="font-mono text-emerald-800 font-black">
                                {Math.round(activeLayer.scale * 100)}% (高 {Math.round(zoneHeight * activeLayer.scale)}px)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const val = Math.max(0.2, Math.round((activeLayer.scale - 0.05) * 100) / 100);
                                  updateLayer({ scale: val });
                                }}
                                className="w-7 h-7 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                                title="缩小 5%"
                              >
                                -
                              </button>
                              <input
                                type="range"
                                min="0.2"
                                max="2.5"
                                step="0.02"
                                value={activeLayer.scale}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  updateLayer({ scale: val });
                                }}
                                className="flex-1 accent-emerald-600 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = Math.min(2.5, Math.round((activeLayer.scale + 0.05) * 100) / 100);
                                  updateLayer({ scale: val });
                                }}
                                className="w-7 h-7 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 active:scale-95 flex items-center justify-center font-black text-xs text-neutral-700 shrink-0 cursor-pointer shadow-2xs"
                                title="放大 5%"
                              >
                                +
                              </button>
                            </div>

                            {/* Scale Presets */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {[
                                { val: 0.8, label: `80% (${Math.round(zoneHeight * 0.8)}px)` },
                                { val: 0.98, label: `⭐ 真机最佳 (${Math.round(zoneHeight * 0.98)}px)` },
                                { val: 1.0, label: `100% 满格 (${zoneHeight}px)` },
                                { val: 1.15, label: `115% (${Math.round(zoneHeight * 1.15)}px)` },
                              ].map((item) => (
                                <button
                                  key={item.val}
                                  type="button"
                                  onClick={() => updateLayer({ scale: item.val })}
                                  className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                                    Math.abs(activeLayer.scale - item.val) < 0.02
                                      ? 'bg-emerald-600 text-white border-emerald-600 ring-1 ring-emerald-400'
                                      : item.val === 0.98
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-extrabold shadow-2xs'
                                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>

                            {/* 边缘留白/阴影切除 */}
                            <div className="pt-2 border-t border-neutral-200/60 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600">
                                <span className="flex items-center gap-1">
                                  <Scissors className="w-3 h-3 text-emerald-600" />
                                  <span>{isTop ? '去除底部空隙与阴影' : '去除边缘空隙与阴影'}</span>
                                </span>
                                <span className="font-mono text-neutral-700 font-bold">
                                  {activeLayer.bottomCropPercent > 0 ? `裁 ${Math.round(activeLayer.bottomCropPercent * 100)}%` : '0% (原图)'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="0.8"
                                  step="0.05"
                                  value={activeLayer.bottomCropPercent}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    updateLayer({ bottomCropPercent: val });
                                  }}
                                  className="flex-1 accent-emerald-600 cursor-pointer"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  {[0, 0.15, 0.3, 0.45].map((cp) => (
                                    <button
                                      key={cp}
                                      type="button"
                                      onClick={() => updateLayer({ bottomCropPercent: cp })}
                                      className={`text-[9px] px-1.5 py-0.5 rounded border font-mono cursor-pointer ${
                                        Math.abs(activeLayer.bottomCropPercent - cp) < 0.03
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'bg-white text-neutral-600 border-neutral-200'
                                      }`}
                                    >
                                      {cp === 0 ? '原图' : `${Math.round(cp * 100)}%`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: 位置与对齐 (X / Y 轴) */}
                          <div className="p-3 bg-neutral-50/80 rounded-2xl border border-neutral-200/80 space-y-2.5 text-xs">
                            {/* 1. 垂直 Y 轴 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between font-bold text-neutral-700 border-b border-neutral-200/60 pb-1.5">
                                <span className="text-neutral-700">
                                  {isTop ? '垂直 Y 轴 (卡片顶沿 Y=96)' : '垂直 Y 轴 (卡片底沿 Y=312)'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shadow-2xs ${
                                    (isTop && anchorY + activeLayer.offsetY > 96) || (!isTop && anchorY + activeLayer.offsetY < 312)
                                      ? 'bg-red-100 text-red-900 border-red-300'
                                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  }`}>
                                    {isTop ? `下沿: ${96 + activeLayer.offsetY}px` : `上沿: ${312 + activeLayer.offsetY}px`}{' '}
                                    {(isTop && anchorY + activeLayer.offsetY > 96) || (!isTop && anchorY + activeLayer.offsetY < 312) ? '🚨' : '✓'}
                                  </span>
                                  {activeLayer.offsetY !== 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateLayer({ offsetY: 0 })}
                                      className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-emerald-300 cursor-pointer font-bold"
                                    >
                                      贴齐{anchorY}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-neutral-400 font-mono w-7 text-right">-80</span>
                                <input
                                  type="range"
                                  min="-80"
                                  max="80"
                                  step="1"
                                  value={activeLayer.offsetY}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateLayer({ offsetY: val });
                                  }}
                                  className="flex-1 accent-emerald-600 cursor-pointer"
                                />
                                <span className="text-[10px] text-neutral-400 font-mono w-7">+80</span>
                              </div>
                            </div>

                            {/* 2. 水平 X 轴微调 */}
                            <div className="space-y-1.5 pt-2 border-t border-neutral-200/60">
                              <div className="flex items-center justify-between font-bold text-neutral-700">
                                <span className="text-neutral-700">水平 X 轴平移</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs font-bold text-neutral-800 bg-white px-2 py-0.5 rounded border border-neutral-200 shadow-2xs">
                                    {activeLayer.offsetX === 0 ? '0px (居中)' : activeLayer.offsetX > 0 ? `+${activeLayer.offsetX}px` : `${activeLayer.offsetX}px`}
                                  </span>
                                  {activeLayer.offsetX !== 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateLayer({ offsetX: 0 })}
                                      className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer font-medium"
                                    >
                                      居中
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-neutral-400 font-mono w-7 text-right">-180</span>
                                <input
                                  type="range"
                                  min="-180"
                                  max="180"
                                  step="1"
                                  value={activeLayer.offsetX}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateLayer({ offsetX: val });
                                  }}
                                  className="flex-1 accent-emerald-600 cursor-pointer"
                                />
                                <span className="text-[10px] text-neutral-400 font-mono w-7">+180</span>
                              </div>
                              {/* Quick Left / Center / Right Position Presets */}
                              <div className="flex items-center gap-1.5 pt-1">
                                {[
                                  { label: '居左 (-75px)', val: -75 },
                                  { label: '正中 (0px)', val: 0 },
                                  { label: '居右 (+75px)', val: 75 },
                                ].map((pos) => (
                                  <button
                                    key={pos.val}
                                    type="button"
                                    onClick={() => updateLayer({ offsetX: pos.val })}
                                    className={`flex-1 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                                      activeLayer.offsetX === pos.val
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                    }`}
                                  >
                                    {pos.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ===================================================================== */}
                {/* SUB-PANEL 3: 整张单图 & 中间一刀切模式 (Full Image & Mid-Split)         */}
                {/* ===================================================================== */}
                {bubbleUploadMode === 'full' && (
                  <div className="p-4 rounded-2xl bg-neutral-50/90 border border-neutral-200 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/70 pb-3">
                      <div>
                        <h4 className="font-bold text-xs text-neutral-900 flex items-center gap-2">
                          <span>✂️ 整张单图上传 & 从中间截开上下独立对位 (480 × 384)</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold">
                            单图切分神器
                          </span>
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          上传任意一整张角色或装饰图，开启「从中间截开」即可将上半部分自动贴齐顶部 0~96px、下半部分自动贴齐底部 312~384px，中间气泡区严格留空，调好后导出一张合规 PNG！
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{bubbleFullImg ? '替换整张单图' : '上传整张单图'}</span>
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

                        {bubbleFullImg && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenBgModal('bubbleFull')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs rounded-xl border border-purple-300 cursor-pointer transition-all"
                            >
                              <Wand2 className="w-3.5 h-3.5 text-purple-700" />
                              <span>背景透明处理</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSplitFullImageToLayers}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 cursor-pointer transition-all"
                              title="按当前截断比例将单图真正切分为「顶部小熊图层」和「底部垂饰图层」进入多图模式精修"
                            >
                              <Scissors className="w-3.5 h-3.5 text-amber-700" />
                              <span>切分转入上下图层</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {bubbleFullImg ? (
                      <div className="space-y-3">
                        {/* Toggle Mid-Split Mode */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-neutral-200">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              id="toggle-full-split"
                              checked={bubbleFullSplitConfig.enabled}
                              onChange={(e) => {
                                const next = { ...bubbleFullSplitConfig, enabled: e.target.checked };
                                setBubbleFullSplitConfig(next);
                                renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                              }}
                              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                            />
                            <label htmlFor="toggle-full-split" className="font-bold text-neutral-900 cursor-pointer">
                              启用「从中间横向截开」上下分置模式（上半截归入 0~96px 顶部区，下半截归入 312~384px 底部区）
                            </label>
                          </div>

                          {bubbleFullSplitConfig.enabled && (
                            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg shrink-0">
                              <button
                                type="button"
                                onClick={() => setBubbleActivePart('top')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                                  bubbleActivePart === 'top' ? 'bg-emerald-600 text-white' : 'text-neutral-600'
                                }`}
                              >
                                调上半截 (顶部)
                              </button>
                              <button
                                type="button"
                                onClick={() => setBubbleActivePart('bottom')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                                  bubbleActivePart === 'bottom' ? 'bg-emerald-600 text-white' : 'text-neutral-600'
                                }`}
                              >
                                调下半截 (底部)
                              </button>
                            </div>
                          )}
                        </div>

                        {bubbleFullSplitConfig.enabled && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Column 1: 截开位置比例 */}
                            <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                              <div className="flex items-center justify-between font-bold text-neutral-800">
                                <span>✂️ 原图中间截开位置</span>
                                <span className="font-mono text-emerald-700">{Math.round(bubbleFullSplitConfig.splitRatio * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.15"
                                max="0.85"
                                step="0.01"
                                value={bubbleFullSplitConfig.splitRatio}
                                onChange={(e) => {
                                  const next = { ...bubbleFullSplitConfig, splitRatio: parseFloat(e.target.value) };
                                  setBubbleFullSplitConfig(next);
                                  renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                }}
                                className="w-full accent-emerald-600 cursor-pointer"
                              />
                              <div className="flex items-center gap-1">
                                {[
                                  { label: '上40%/下60%', val: 0.4 },
                                  { label: '正中对半 50%', val: 0.5 },
                                  { label: '上60%/下40%', val: 0.6 },
                                ].map((preset) => (
                                  <button
                                    key={preset.val}
                                    type="button"
                                    onClick={() => {
                                      const next = { ...bubbleFullSplitConfig, splitRatio: preset.val };
                                      setBubbleFullSplitConfig(next);
                                      renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                    }}
                                    className={`flex-1 py-1 rounded border text-[10px] font-bold cursor-pointer ${
                                      Math.abs(bubbleFullSplitConfig.splitRatio - preset.val) < 0.02
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Column 2: 上半截独立微调 */}
                            <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                              <div className="flex items-center justify-between font-bold text-emerald-900">
                                <span>🔼 上半截 (顶部 0~96px)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...bubbleFullSplitConfig, topScale: 1.0, topOffsetX: 0, topOffsetY: 0 };
                                    setBubbleFullSplitConfig(next);
                                    renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                  }}
                                  className="text-[10px] text-emerald-700 underline cursor-pointer"
                                >
                                  重置贴齐96
                                </button>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span>缩放: {Math.round(bubbleFullSplitConfig.topScale * 100)}%</span>
                                  <span>下沿Y: {96 + bubbleFullSplitConfig.topOffsetY}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.3"
                                  max="2.2"
                                  step="0.05"
                                  value={bubbleFullSplitConfig.topScale}
                                  onChange={(e) => {
                                    const next = { ...bubbleFullSplitConfig, topScale: parseFloat(e.target.value) };
                                    setBubbleFullSplitConfig(next);
                                    renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                  }}
                                  className="w-full accent-emerald-600 cursor-pointer"
                                />
                                <input
                                  type="range"
                                  min="-60"
                                  max="60"
                                  step="1"
                                  value={bubbleFullSplitConfig.topOffsetY}
                                  onChange={(e) => {
                                    const next = { ...bubbleFullSplitConfig, topOffsetY: parseInt(e.target.value) };
                                    setBubbleFullSplitConfig(next);
                                    renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                  }}
                                  className="w-full accent-emerald-600 cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Column 3: 下半截独立微调 */}
                            <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                              <div className="flex items-center justify-between font-bold text-emerald-900">
                                <span>🔽 下半截 (底部 312~384px)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...bubbleFullSplitConfig, bottomScale: 1.0, bottomOffsetX: 0, bottomOffsetY: 0 };
                                    setBubbleFullSplitConfig(next);
                                    renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                  }}
                                  className="text-[10px] text-emerald-700 underline cursor-pointer"
                                >
                                  重置贴齐312
                                </button>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span>缩放: {Math.round(bubbleFullSplitConfig.bottomScale * 100)}%</span>
                                  <span>上沿Y: {312 + bubbleFullSplitConfig.bottomOffsetY}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.3"
                                  max="2.2"
                                  step="0.05"
                                  value={bubbleFullSplitConfig.bottomScale}
                                  onChange={(e) => {
                                    const next = { ...bubbleFullSplitConfig, bottomScale: parseFloat(e.target.value) };
                                    setBubbleFullSplitConfig(next);
                                    renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                  }}
                                  className="w-full accent-emerald-600 cursor-pointer"
                                />
                                <input
                                  type="range"
                                  min="-60"
                                  max="60"
                                  step="1"
                                  value={bubbleFullSplitConfig.bottomOffsetY}
                                  onChange={(e) => {
                                    const next = { ...bubbleFullSplitConfig, bottomOffsetY: parseInt(e.target.value) };
                                    setBubbleFullSplitConfig(next);
                                    renderCompositeBubble({ mode: 'full', fullSplitConfig: next });
                                  }}
                                  className="w-full accent-emerald-600 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-neutral-400 border border-dashed border-neutral-200 rounded-xl bg-white/60">
                        请点击右上角「上传整张单图」，上传后即可从中间一刀截开并分别对位顶部与底部区域
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Dedicated Synthesis Download Box (Strict 480×384 PNG <= 300KB) */}
                {bubbleResult && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-emerald-950 text-sm">微信标准气泡挂件已合成就绪</span>
                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-800 font-bold">
                          {bubbleResult.width} × {bubbleResult.height} PNG · {(bubbleResult.size / 1024).toFixed(1)} KB (&le; 300KB ✓)
                        </span>
                        <span className="font-mono text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
                          所见即所得 1:1 导出
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900/70">
                        已将全部顶部小熊与底部垂饰合成为一张严格 480×384 像素透明 PNG，与右侧 375pt 手机真机视窗 100% 同步一致，可直接上传微信红包封面平台通过审核。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(bubbleResult.blob, '03_气泡挂件_480x384_微信标准合成图.png')}
                      className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0 active:scale-95"
                    >
                      <Download className="w-4 h-4 text-emerald-300" />
                      <span>下载 480×384 合成图</span>
                    </button>
                  </div>
                )}
              </div>
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
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          <div className="sticky top-20 flex flex-col items-center">
            {/* Live WeChat Realistic Phone Mockup (Strict 375px 1:1 Mobile Viewport) */}
            <RedPacketPreviewMockup
              coverResult={coverResult}
              coverVideoUrl={videoUrl}
              pendantResult={pendantResult}
              bubbleResult={bubbleResult}
              storyResult={storyResult}
              senderName={senderName}
              blessingText={blessingText}
              activeTab={activeTab}
              showSafeAreaGuide={showGuides}
            />

            {/* Quick Sender Name & Blessing Input for Live Customization */}
            <div className="w-full max-w-[375px] mt-3 p-3.5 bg-white/90 backdrop-blur-xl rounded-2xl border border-neutral-200/80 shadow-2xs text-xs space-y-2">
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

      {/* ======================================================== */}
      {/* 4-Sided Interactive Box Crop Modal (Requirement 3)       */}
      {/* ======================================================== */}
      {cropModalOpen && cropModalImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl border border-neutral-200 flex flex-col space-y-3.5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-1.5">
                    <span>自由框选裁剪</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      想切哪里就切哪里 · 四向自由调节
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    拖动选框中间可整体平移，拖动 4 条边或 4 个角手柄可任意缩放裁剪尺寸。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Interactive Crop Viewport with Dimmed Masks & 8 Drag Handles */}
            <div
              ref={cropContainerRef}
              onPointerMove={handleCropContainerPointerMove}
              onPointerUp={handleCropContainerPointerUp}
              className="relative w-full h-[280px] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px] bg-neutral-100 rounded-2xl border border-neutral-300 flex items-center justify-center overflow-hidden select-none touch-none p-2"
            >
              <div className="relative max-h-[260px] max-w-full flex items-center justify-center">
                <img
                  ref={cropImgRef}
                  src={cropModalImg.src}
                  alt="待裁剪素材"
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setCropImgRect({ width: el.clientWidth, height: el.clientHeight });
                  }}
                  className="max-h-[250px] max-w-full object-contain pointer-events-none select-none drop-shadow-sm"
                />

                {/* Overlaid Visual Crop Box & 4-Sided Masks */}
                {cropImgRect.width > 0 && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      width: `${cropImgRect.width}px`,
                      height: `${cropImgRect.height}px`,
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Top Mask */}
                    <div
                      className="absolute top-0 left-0 right-0 bg-black/60 pointer-events-none transition-none"
                      style={{ height: `${cropBox.y * 100}%` }}
                    />
                    {/* Bottom Mask */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-black/60 pointer-events-none transition-none"
                      style={{ height: `${(1 - (cropBox.y + cropBox.height)) * 100}%` }}
                    />
                    {/* Left Mask */}
                    <div
                      className="absolute left-0 bg-black/60 pointer-events-none transition-none"
                      style={{
                        top: `${cropBox.y * 100}%`,
                        height: `${cropBox.height * 100}%`,
                        width: `${cropBox.x * 100}%`,
                      }}
                    />
                    {/* Right Mask */}
                    <div
                      className="absolute right-0 bg-black/60 pointer-events-none transition-none"
                      style={{
                        top: `${cropBox.y * 100}%`,
                        height: `${cropBox.height * 100}%`,
                        width: `${(1 - (cropBox.x + cropBox.width)) * 100}%`,
                      }}
                    />

                    {/* Active Crop Box with Rule-of-Thirds Grid */}
                    <div
                      onPointerDown={(e) => handleCropPointerDown('move', e)}
                      className="absolute border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] cursor-move pointer-events-auto transition-none select-none"
                      style={{
                        left: `${cropBox.x * 100}%`,
                        top: `${cropBox.y * 100}%`,
                        width: `${cropBox.width * 100}%`,
                        height: `${cropBox.height * 100}%`,
                      }}
                    >
                      {/* 3x3 Grid Lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        <div className="border-r border-b border-emerald-300/40" />
                        <div className="border-r border-b border-emerald-300/40" />
                        <div className="border-b border-emerald-300/40" />
                        <div className="border-r border-b border-emerald-300/40" />
                        <div className="border-r border-b border-emerald-300/40" />
                        <div className="border-b border-emerald-300/40" />
                        <div className="border-r border-emerald-300/40" />
                        <div className="border-r border-emerald-300/40" />
                        <div />
                      </div>

                      {/* 4 Corner Handles */}
                      <div
                        onPointerDown={(e) => handleCropPointerDown('nw', e)}
                        className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown('ne', e)}
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown('sw', e)}
                        className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown('se', e)}
                        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                      />

                      {/* 4 Edge Handles */}
                      <div
                        onPointerDown={(e) => handleCropPointerDown('n', e)}
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-white border-2 border-emerald-600 rounded-md cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown('s', e)}
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-white border-2 border-emerald-600 rounded-md cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown('w', e)}
                        className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-4 bg-white border-2 border-emerald-600 rounded-md cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                      />
                      <div
                        onPointerDown={(e) => handleCropPointerDown('e', e)}
                        className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-4 bg-white border-2 border-emerald-600 rounded-md cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time Dimensions & Crop Percentages */}
            <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200 text-xs font-mono text-neutral-700">
              <span className="font-bold text-neutral-800 flex items-center gap-1">
                <span>裁剪尺寸:</span>
                <span className="text-emerald-700 font-extrabold">
                  {Math.round(cropBox.width * (cropModalImg.naturalWidth || cropModalImg.width))} × {Math.round(cropBox.height * (cropModalImg.naturalHeight || cropModalImg.height))} px
                </span>
              </span>
              <div className="flex items-center gap-2.5 text-[11px] text-neutral-500">
                <span>上切: <strong className="text-neutral-800">{Math.round(cropBox.y * 100)}%</strong></span>
                <span>下切: <strong className="text-neutral-800">{Math.round((1 - cropBox.y - cropBox.height) * 100)}%</strong></span>
                <span>左切: <strong className="text-neutral-800">{Math.round(cropBox.x * 100)}%</strong></span>
                <span>右切: <strong className="text-neutral-800">{Math.round((1 - cropBox.x - cropBox.width) * 100)}%</strong></span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-600 block">
                快捷裁剪预设（点击即自动框选）：
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 0, width: 1, height: 1 })}
                  className="py-1.5 px-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-bold cursor-pointer text-center"
                >
                  全选原图 (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 0, width: 1, height: 0.8 })}
                  className="py-1.5 px-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold cursor-pointer text-center"
                >
                  切除底部 (20%)
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 0.2, width: 1, height: 0.8 })}
                  className="py-1.5 px-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold cursor-pointer text-center"
                >
                  切除顶部 (20%)
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0.15, y: 0, width: 0.7, height: 1 })}
                  className="py-1.5 px-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold cursor-pointer text-center"
                >
                  切除左右 (各15%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nw = cropModalImg.naturalWidth || cropModalImg.width;
                    const nh = cropModalImg.naturalHeight || cropModalImg.height;
                    if (nw > nh) {
                      const ratio = nh / nw;
                      setCropBox({ x: (1 - ratio) / 2, y: 0, width: ratio, height: 1 });
                    } else {
                      const ratio = nw / nh;
                      setCropBox({ x: 0, y: (1 - ratio) / 2, width: 1, height: ratio });
                    }
                  }}
                  className="py-1.5 px-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-bold cursor-pointer text-center"
                >
                  1:1 正方形
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setCropBox({ x: 0, y: 0, width: 1, height: 1 })}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-800 cursor-pointer"
              >
                重置全图框选
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCropModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleApplyCropModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-300" />
                  <span>确认并应用裁剪</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Interactive Background Transparency & Manual Brush Modal */}
      {/* Requirement 1: Contiguous vs Discontiguous, Additive Picking, Undo/Redo, Circular Brush */}
      {/* ======================================================== */}
      {bgModalOpen && bgModalRawImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl border border-neutral-200 flex flex-col space-y-3.5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900">
                    图片背景透明化处理 & 手动精修工作台
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    支持吸管连续漫水/全图取色、叠加继续吸色、返回上一步撤销，以及圆形橡皮擦与画笔微调。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBgModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Interactive Canvas + Brush Toolbar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Mode Selector */}
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setBgModalTool('eyedropper')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      bgModalTool === 'eyedropper'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-white/60'
                    }`}
                    title="点击图片上的背景颜色即可将该颜色抠除为透明"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    <span>吸管点选背景色</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgModalTool('eraser')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      bgModalTool === 'eraser'
                        ? 'bg-red-600 text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-white/60'
                    }`}
                    title="按住鼠标涂抹即可手动擦除残留背景杂边 (圆形笔刷)"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>橡皮擦去杂边</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgModalTool('restore')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      bgModalTool === 'restore'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-white/60'
                    }`}
                    title="按住鼠标涂抹即可恢复被误删的小熊细节 (圆形画笔)"
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    <span>画笔恢复原图</span>
                  </button>
                </div>

                {/* Undo / Redo Buttons (Requirement 1) */}
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs">
                  <button
                    type="button"
                    onClick={handleBgUndo}
                    disabled={bgUndoStack.length === 0}
                    className="px-2 py-1 rounded-lg font-bold text-neutral-700 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1 cursor-pointer transition-all"
                    title="撤销上一步操作 (快捷键 Ctrl+Z)"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>返回上一步</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBgRedo}
                    disabled={bgRedoStack.length === 0}
                    className="px-2 py-1 rounded-lg font-bold text-neutral-700 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1 cursor-pointer transition-all"
                    title="恢复重做 (快捷键 Ctrl+Shift+Z)"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    <span>重做</span>
                  </button>
                </div>

                {/* Brush Size Slider */}
                {(bgModalTool === 'eraser' || bgModalTool === 'restore') && (
                  <div className="flex items-center gap-2 text-xs bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200">
                    <span className="font-bold text-neutral-600">圆形笔刷: {bgBrushSize}px</span>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      step="2"
                      value={bgBrushSize}
                      onChange={(e) => setBgBrushSize(parseInt(e.target.value))}
                      className="w-24 accent-purple-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* Deep AI Matting Trigger */}
                <button
                  type="button"
                  onClick={handleRunAiBackgroundRemovalInModal}
                  disabled={bgAiLoading}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{bgAiLoading ? 'AI 深度抠图中...' : 'AI 神经网络一键重抠'}</span>
                </button>
              </div>

              {/* Eyedropper Options: Contiguous / Discontiguous Toggle & Multi-Color Accumulation (Requirement 1) */}
              {bgModalTool === 'eyedropper' && (
                <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <span>🎯 吸管取色选项：</span>
                    </span>

                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-purple-200">
                      <button
                        type="button"
                        onClick={() => setBgContiguous(true)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                          bgContiguous
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title="只删除与点击点直接相连的同色背景，保护主体内部相同颜色的细节（如小金蟾的金黄内部、眼睛等）"
                      >
                        ✓ 连续 (仅删除相连背景，保护主体内部)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBgContiguous(false)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                          !bgContiguous
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title="全局删除全图中所有相近颜色"
                      >
                        🌐 不连续 (全图同色全部清除)
                      </button>
                    </div>
                  </div>

                  {/* Additive Picked Colors Chips */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-purple-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-purple-800">
                        叠加吸取颜色 ({bgPickedColors.length}):
                      </span>
                      {bgPickedColors.length === 0 ? (
                        <span className="text-[11px] text-purple-400">
                          请在画面背景上点击即可吸取颜色（没吸干净可继续点击其他部位叠加吸取）
                        </span>
                      ) : (
                        bgPickedColors.map((hex) => (
                          <span
                            key={hex}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-purple-300 bg-white text-[11px] font-mono font-bold shadow-2xs"
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-neutral-300 shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                            <span>{hex.toUpperCase()}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePickedColor(hex)}
                              className="text-neutral-400 hover:text-red-600 ml-0.5 cursor-pointer font-bold"
                              title="移除此颜色"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {bgPickedColors.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllPickedColors}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        清空所有吸色
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Checkerboard Interactive Canvas with Following Circular Brush Indicator (Requirement 1) */}
              <div
                className="relative w-full h-[270px] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px] bg-neutral-100 rounded-2xl border border-neutral-300 flex items-center justify-center overflow-hidden p-2 select-none touch-none"
                onPointerLeave={() => setBgCursorPos((p) => ({ ...p, visible: false }))}
              >
                <canvas
                  ref={bgModalCanvasRef}
                  onPointerDown={handleBgModalCanvasPointerDown}
                  onPointerMove={handleBgModalCanvasPointerMove}
                  onPointerUp={handleBgModalCanvasPointerUp}
                  className={`max-h-[250px] max-w-full object-contain shadow-sm rounded-lg ${
                    bgModalTool === 'eyedropper'
                      ? 'cursor-crosshair'
                      : 'cursor-none'
                  }`}
                />

                {/* Real-time Circular Brush Cursor Follower (告别十字形，所见即所得真实圆形笔刷) */}
                {bgCursorPos.visible && (bgModalTool === 'eraser' || bgModalTool === 'restore') && (
                  <div
                    className="pointer-events-none absolute rounded-full border-2 shadow-[0_0_8px_rgba(0,0,0,0.6)] z-30 transition-none"
                    style={{
                      left: `${bgCursorPos.x}px`,
                      top: `${bgCursorPos.y}px`,
                      width: `${bgBrushSize * 2}px`,
                      height: `${bgBrushSize * 2}px`,
                      transform: 'translate(-50%, -50%)',
                      borderColor: bgModalTool === 'eraser' ? '#ef4444' : '#10b981',
                      backgroundColor: bgModalTool === 'eraser' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                    }}
                  />
                )}

                <div className="absolute bottom-2 left-2.5 bg-neutral-900/80 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-xs pointer-events-none font-mono">
                  {bgModalTool === 'eyedropper'
                    ? `💡 吸管模式：点击需要变透明的背景（当前：${bgContiguous ? '连续漫水' : '全图取色'}，支持叠加吸取与 Ctrl+Z 撤销）`
                    : bgModalTool === 'eraser'
                    ? `💡 圆形橡皮擦：按住鼠标涂抹即可擦除杂边（光圈大小为擦除范围）`
                    : '💡 圆形恢复画笔：按住鼠标涂抹即可恢复原图被误删细节'}
                </div>
              </div>
            </div>

            {/* Algorithm Mode Selection & Parameter Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Left: Mode Selection */}
              <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-800">1. 自动去背景模式：</span>
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                    <span>检测底色:</span>
                    <span
                      className="w-3 h-3 rounded-full border border-neutral-300 inline-block"
                      style={{ backgroundColor: bgModalConfig.customColor || bgModalDetectedHex }}
                    />
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { mode: 'flood' as const, label: '🌊 四角边缘漫水去底 (推荐)' },
                    { mode: 'global' as const, label: '🌐 全图同色镂空去底' },
                    { mode: 'white' as const, label: '⬜ 专去纯白/浅灰背景' },
                    { mode: 'black' as const, label: '⬛ 专去纯黑/深暗背景' },
                    { mode: 'custom' as const, label: '🎨 吸管指定颜色去底' },
                    { mode: 'keep' as const, label: '🛡️ 保持原图不自动抠除' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setBgModalConfig((prev) => ({ ...prev, mode: item.mode }))}
                      className={`py-1.5 px-2 rounded-xl font-bold text-[11px] text-left border transition-all cursor-pointer truncate ${
                        bgModalConfig.mode === item.mode
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Sliders (Tolerance, Feather, Defringe) */}
              <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-neutral-700">
                    <span>色彩容差 (Tolerance)</span>
                    <span className="font-mono text-purple-800">{bgModalConfig.tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="120"
                    step="1"
                    value={bgModalConfig.tolerance}
                    onChange={(e) => setBgModalConfig((prev) => ({ ...prev, tolerance: parseInt(e.target.value) }))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-neutral-700">
                    <span>边缘柔和羽化 (Feather)</span>
                    <span className="font-mono text-purple-800">{bgModalConfig.feather}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={bgModalConfig.feather}
                    onChange={(e) => setBgModalConfig((prev) => ({ ...prev, feather: parseInt(e.target.value) }))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-neutral-700">
                    <span>收缩去白边/黑边 (Defringe)</span>
                    <span className="font-mono text-purple-800">{bgModalConfig.defringe}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={bgModalConfig.defringe}
                    onChange={(e) => setBgModalConfig((prev) => ({ ...prev, defringe: parseInt(e.target.value) }))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setBgModalConfig({ ...DEFAULT_BG_CONFIG, mode: 'flood' })}
                className="px-3 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-all cursor-pointer"
              >
                恢复默认参数
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBgModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleApplyBgModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>确认应用透明效果</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
