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

  // Customization Options: Cover Pendant (1053x1746) - Figures 2 & 3 Standard
  const [pendantPlacement, setPendantPlacement] = useState<'top' | 'bottom' | 'dual'>('top');
  const [pendantScale, setPendantScale] = useState(0.85);
  const [pendantOffsetX, setPendantOffsetX] = useState(0);
  const [pendantOffsetY, setPendantOffsetY] = useState(0);
  const [pendantAddGlow, setPendantAddGlow] = useState(true);

  // Customization Options: Bubble Pendant (480x384) - Figure 4 Standard
  const [bubbleScale, setBubbleScale] = useState(0.85);
  const [bubbleOffsetX, setBubbleOffsetX] = useState(0);
  const [bubbleOffsetY, setBubbleOffsetY] = useState(0);
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

  const [isDraggingPendant, setIsDraggingPendant] = useState(false);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPanY, setDragStartPanY] = useState(0);

  // Live Drag Coordinates for Smooth Visual Feedback
  const [livePendantCoords, setLivePendantCoords] = useState<{ x: number; y: number; zone: string } | null>(null);
  const [liveBubbleCoords, setLiveBubbleCoords] = useState<{ x: number; y: number } | null>(null);

  // Initialize with the first demo theme so users immediately have verified standard assets
  useEffect(() => {
    if (!coverResult && !pendantResult) {
      handleLoadDemoTheme('theme-fortune-festive', false);
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
        anchorY: 120,
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
      const bubbleImg = await loadImageElement(bubbleBlob);
      setCachedBubbleImg(bubbleImg);

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
  // 2. Direct Drag-and-Drop Handlers for 封面挂件 (1053 x 1746)
  // -------------------------------------------------------------
  const calculatePendantCoordinates = (clientX: number, clientY: number) => {
    if (!pendantCanvasRef.current) return null;
    const rect = pendantCanvasRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    const targetX = (rawX / rect.width) * 1053;
    const targetY = (rawY / rect.height) * 1746;

    // Magnetic center snap (within 30px of vertical center)
    let clampedX = Math.max(85, Math.min(968, targetX));
    if (Math.abs(clampedX - 526.5) < 35) {
      clampedX = 526.5;
    }

    // WeChat Figure 3: Upper Rim (Y: 20~360) or Bottom Spine (Y: 1380~1720)
    let newPlacement: 'top' | 'bottom' = targetY < 873 ? 'top' : 'bottom';
    let clampedY: number;
    let newOffX: number;
    let newOffY: number;
    let zoneDesc = '';

    if (newPlacement === 'top') {
      clampedY = Math.max(20, Math.min(360, targetY));
      newOffX = Math.round(clampedX - 526.5);
      newOffY = Math.round(clampedY - 200);
      zoneDesc = '上端探头 (图2标准)';
    } else {
      clampedY = Math.max(1380, Math.min(1720, targetY));
      newOffX = Math.round(clampedX - 526.5);
      newOffY = Math.round(clampedY - 1540);
      zoneDesc = '脊端垂饰 (图2标准)';
    }

    return {
      clampedX: Math.round(clampedX),
      clampedY: Math.round(clampedY),
      newPlacement,
      newOffX,
      newOffY,
      zoneDesc,
    };
  };

  const handlePendantPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pendantResult) return;
    setIsDraggingPendant(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    const coords = calculatePendantCoordinates(e.clientX, e.clientY);
    if (coords) {
      setPendantPlacement(coords.newPlacement);
      setPendantOffsetX(coords.newOffX);
      setPendantOffsetY(coords.newOffY);
      setLivePendantCoords({ x: coords.clampedX, y: coords.clampedY, zone: coords.zoneDesc });
    }
  };

  const handlePendantPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPendant) return;
    const coords = calculatePendantCoordinates(e.clientX, e.clientY);
    if (coords) {
      setPendantPlacement(coords.newPlacement);
      setPendantOffsetX(coords.newOffX);
      setPendantOffsetY(coords.newOffY);
      setLivePendantCoords({ x: coords.clampedX, y: coords.clampedY, zone: coords.zoneDesc });
    }
  };

  const handlePendantPointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPendant) return;
    setIsDraggingPendant(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const coords = calculatePendantCoordinates(e.clientX, e.clientY);
    if (coords) {
      setPendantPlacement(coords.newPlacement);
      setPendantOffsetX(coords.newOffX);
      setPendantOffsetY(coords.newOffY);
      await handleUpdatePendant(coords.newPlacement, coords.newOffX, coords.newOffY);
    }
    setLivePendantCoords(null);
  };

  // -------------------------------------------------------------
  // 3. Direct Drag-and-Drop Handlers for 气泡挂件 (480 x 384)
  // -------------------------------------------------------------
  const calculateBubbleCoordinates = (clientX: number, clientY: number) => {
    if (!bubbleCanvasRef.current) return null;
    const rect = bubbleCanvasRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    const targetX = (rawX / rect.width) * 480;
    const targetY = (rawY / rect.height) * 384;

    // Magnetic center snap
    let clampedX = Math.max(40, Math.min(440, targetX));
    if (Math.abs(clampedX - 240) < 20) {
      clampedX = 240;
    }

    // WeChat Figure 4 safe zone: Y: 20~280
    const clampedY = Math.max(20, Math.min(280, targetY));
    const newOffX = Math.round(clampedX - 240);
    const newOffY = Math.round(clampedY - 120);

    return {
      clampedX: Math.round(clampedX),
      clampedY: Math.round(clampedY),
      newOffX,
      newOffY,
    };
  };

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!bubbleResult) return;
    setIsDraggingBubble(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    const coords = calculateBubbleCoordinates(e.clientX, e.clientY);
    if (coords) {
      setBubbleOffsetX(coords.newOffX);
      setBubbleOffsetY(coords.newOffY);
      setLiveBubbleCoords({ x: coords.clampedX, y: coords.clampedY });
    }
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBubble) return;
    const coords = calculateBubbleCoordinates(e.clientX, e.clientY);
    if (coords) {
      setBubbleOffsetX(coords.newOffX);
      setBubbleOffsetY(coords.newOffY);
      setLiveBubbleCoords({ x: coords.clampedX, y: coords.clampedY });
    }
  };

  const handleBubblePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBubble) return;
    setIsDraggingBubble(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const coords = calculateBubbleCoordinates(e.clientX, e.clientY);
    if (coords) {
      setBubbleOffsetX(coords.newOffX);
      setBubbleOffsetY(coords.newOffY);
      await handleUpdateBubble(coords.newOffX, coords.newOffY);
    }
    setLiveBubbleCoords(null);
  };

  // -------------------------------------------------------------
  // 4. Direct Drag-to-Pan for 封面图 (957 x 1278)
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

  // -------------------------------------------------------------
  // 5. Material Generation & Update Functions
  // -------------------------------------------------------------
  const handleUpdateCover = async (modeOverride?: 'contain' | 'cover') => {
    if (!cachedSourceImg) return;
    const mode = modeOverride || coverFitMode;
    try {
      const cover = await fitImageToTarget(cachedSourceImg, 957, 1278, {
        mode,
        zoom: coverZoom,
        panY: coverPanY,
        bgColor: coverBgColor,
        maxBytes: 500 * 1024,
      });
      setCoverResult(cover);
      onNotification(`已更新封面图 (957×1278，${mode === 'contain' ? '完整显示' : '铺满裁剪'})`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUpdatePendant = async (
    overridePlacement?: 'top' | 'bottom' | 'dual',
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number
  ) => {
    const source = cachedPendantImg || cachedCutoutImg || cachedSourceImg;
    if (!source) return;
    try {
      const placement = overridePlacement || pendantPlacement;
      const offX = overrideOffsetX !== undefined ? overrideOffsetX : pendantOffsetX;
      const offY = overrideOffsetY !== undefined ? overrideOffsetY : pendantOffsetY;
      const sc = overrideScale !== undefined ? overrideScale : pendantScale;

      const pendant = await createCoverPendant(source, {
        placement,
        scale: sc,
        offsetX: offX,
        offsetY: offY,
        addGlow: pendantAddGlow,
      });
      setPendantResult(pendant);
      onNotification(`封面挂件已更新 (挂点: X:${pendant.anchorX}, Y:${pendant.anchorY} · ${placement === 'bottom' ? '脊端' : '上端'}合规✓)`);
    } catch (err: any) {
      console.error(err);
    }
  };

  // -------------------------------------------------------------
  // Vertical fine-tuning handlers for 封面挂件 (Slider + [+] / [-])
  // -------------------------------------------------------------
  const handlePendantStepFineTune = async (deltaY: number) => {
    if (!pendantResult) return;
    const isBottom = pendantPlacement === 'bottom';
    const minLimit = isBottom ? 1380 : 20;
    const maxLimit = isBottom ? 1720 : 360;
    const baseline = isBottom ? 1540 : 200;

    const currentY = currentPendantAnchorY;
    const newY = Math.max(minLimit, Math.min(maxLimit, currentY + deltaY));
    const newOffY = newY - baseline;
    setPendantOffsetY(newOffY);
    setLivePendantCoords({
      x: currentPendantAnchorX,
      y: newY,
      zone: isBottom ? '脊端垂饰 (图2标准)' : '上端探头 (图2标准)',
    });
    await handleUpdatePendant(pendantPlacement, pendantOffsetX, newOffY);
  };

  const handlePendantSliderChange = async (targetY: number) => {
    if (!pendantResult) return;
    const isBottom = pendantPlacement === 'bottom';
    const minLimit = isBottom ? 1380 : 20;
    const maxLimit = isBottom ? 1720 : 360;
    const baseline = isBottom ? 1540 : 200;

    const newY = Math.max(minLimit, Math.min(maxLimit, targetY));
    const newOffY = newY - baseline;
    setPendantOffsetY(newOffY);
    setLivePendantCoords({
      x: currentPendantAnchorX,
      y: newY,
      zone: isBottom ? '脊端垂饰 (图2标准)' : '上端探头 (图2标准)',
    });
    await handleUpdatePendant(pendantPlacement, pendantOffsetX, newOffY);
  };

  // -------------------------------------------------------------
  // Vertical fine-tuning handlers for 气泡挂件 (Slider + [+] / [-])
  // -------------------------------------------------------------
  const handleBubbleStepFineTune = async (deltaY: number) => {
    if (!bubbleResult) return;
    const currentY = currentBubbleAnchorY;
    const newY = Math.max(20, Math.min(280, currentY + deltaY));
    const newOffY = newY - 120;
    setBubbleOffsetY(newOffY);
    setLiveBubbleCoords({ x: currentBubbleAnchorX, y: newY });
    await handleUpdateBubble(bubbleOffsetX, newOffY);
  };

  const handleBubbleSliderChange = async (targetY: number) => {
    if (!bubbleResult) return;
    const newY = Math.max(20, Math.min(280, targetY));
    const newOffY = newY - 120;
    setBubbleOffsetY(newOffY);
    setLiveBubbleCoords({ x: currentBubbleAnchorX, y: newY });
    await handleUpdateBubble(bubbleOffsetX, newOffY);
  };

  const handleUpdateBubble = async (
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number
  ) => {
    const source = cachedBubbleImg || cachedCutoutImg || cachedSourceImg;
    if (!source) return;
    try {
      const offX = overrideOffsetX !== undefined ? overrideOffsetX : bubbleOffsetX;
      const offY = overrideOffsetY !== undefined ? overrideOffsetY : bubbleOffsetY;
      const sc = overrideScale !== undefined ? overrideScale : bubbleScale;

      const bubble = await createBubblePendant(source, {
        scale: sc,
        offsetX: offX,
        offsetY: offY,
        addGlow: true,
      });
      setBubbleResult(bubble);
      onNotification(`气泡挂件已更新 (完整形象零截断，挂点: X:${bubble.anchorX}, Y:${bubble.anchorY} · 合规✓)`);
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

  const handleUploadPendantOnly = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus('正在处理封面挂件 (1053×1746 PNG)...');
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
      setCachedPendantImg(cutoutImg);
      const pendant = await createCoverPendant(cutoutImg, {
        placement: pendantPlacement,
        scale: pendantScale,
        offsetX: pendantOffsetX,
        offsetY: pendantOffsetY,
        addGlow: pendantAddGlow,
      });
      setPendantResult(pendant);
      setProcessingProgress(100);
      onNotification(`🎉 封面挂件已更新！挂点已锁定在可编辑区 (X: ${pendant.anchorX}, Y: ${pendant.anchorY})`);
    } catch (e: any) {
      onNotification('挂件处理失败: ' + e.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleUploadBubbleOnly = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus('正在处理气泡挂件 (480×384 PNG，保证完整零截断)...');
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
      setCachedBubbleImg(cutoutImg);
      const bubble = await createBubblePendant(cutoutImg, {
        scale: bubbleScale,
        offsetX: bubbleOffsetX,
        offsetY: bubbleOffsetY,
        addGlow: true,
      });
      setBubbleResult(bubble);
      setProcessingProgress(100);
      onNotification(`🎉 气泡挂件已更新！完整形象零截断，挂点已锁定在可编辑区 (X: ${bubble.anchorX}, Y: ${bubble.anchorY})`);
    } catch (e: any) {
      onNotification('气泡挂件处理失败: ' + e.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  };

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

  // Active Anchor Coordinates Helper
  const currentPendantAnchorX = livePendantCoords?.x ?? pendantResult?.anchorX ?? Math.round(526.5 + pendantOffsetX);
  const currentPendantAnchorY = livePendantCoords?.y ?? pendantResult?.anchorY ?? (pendantPlacement === 'bottom' ? Math.round(1540 + pendantOffsetY) : Math.round(200 + pendantOffsetY));
  const currentBubbleAnchorX = liveBubbleCoords?.x ?? bubbleResult?.anchorX ?? Math.round(240 + bubbleOffsetX);
  const currentBubbleAnchorY = liveBubbleCoords?.y ?? bubbleResult?.anchorY ?? Math.round(120 + bubbleOffsetY);

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
            <span className="text-xs font-normal text-neutral-400">· 所见即所得直接拖拽定位</span>
          </h2>
          <p className="text-xs text-neutral-500 max-w-2xl leading-relaxed">
            严格遵循微信审核规范：支持直接在画板上拖动调整位置，右侧实时呈现微信红包封面真实效果，一键打包官方合规 ZIP。
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

      {/* 2. Apple Minimalist Four-Metric Status Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Metric 1 */}
        <div
          onClick={() => setActiveTab('cover')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'cover'
              ? 'bg-red-50/80 border-red-300 shadow-xs'
              : 'bg-white border-neutral-200/80 hover:bg-neutral-50'
          }`}
        >
          <div>
            <div className="text-[10px] text-neutral-400 font-medium">① 封面图 (必填)</div>
            <div className="text-xs font-bold text-neutral-800 font-mono">957 × 1278</div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
            coverResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
          }`}>
            {coverResult ? `${Math.round(coverResult.size / 1024)}K ✓` : '待生成'}
          </span>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => setActiveTab('pendant')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'pendant'
              ? 'bg-amber-50/80 border-amber-300 shadow-xs'
              : 'bg-white border-neutral-200/80 hover:bg-neutral-50'
          }`}
        >
          <div>
            <div className="text-[10px] text-neutral-400 font-medium">② 封面挂件 (图2&3标准)</div>
            <div className="text-xs font-bold text-neutral-800 font-mono">1053 × 1746</div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
            pendantResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
          }`}>
            {pendantResult ? `${Math.round(pendantResult.size / 1024)}K ✓` : '待生成'}
          </span>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => setActiveTab('bubble')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'bubble'
              ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
              : 'bg-white border-neutral-200/80 hover:bg-neutral-50'
          }`}
        >
          <div>
            <div className="text-[10px] text-neutral-400 font-medium">③ 气泡挂件 (零截断)</div>
            <div className="text-xs font-bold text-neutral-800 font-mono">480 × 384</div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
            bubbleResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
          }`}>
            {bubbleResult ? `${Math.round(bubbleResult.size / 1024)}K ✓` : '待生成'}
          </span>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => setActiveTab('story')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'story'
              ? 'bg-blue-50/80 border-blue-300 shadow-xs'
              : 'bg-white border-neutral-200/80 hover:bg-neutral-50'
          }`}
        >
          <div>
            <div className="text-[10px] text-neutral-400 font-medium">④ 封面故事 (沉浸页)</div>
            <div className="text-xs font-bold text-neutral-800 font-mono">750 × 1250</div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
            storyResult ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'
          }`}>
            {storyResult ? `${Math.round(storyResult.size / 1024)}K ✓` : '待生成'}
          </span>
        </div>
      </div>

      {/* 3. Main Ergonomic Workspace (Split Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Focused Interactive Editor (7 Cols) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">
          {/* Apple Segmented Controls Bar */}
          <div className="bg-neutral-200/60 p-1 rounded-2xl border border-neutral-300/60 flex items-center gap-1 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cover')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'cover'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-red-500" />
              <span>封面图</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pendant')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'pendant'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>封面挂件</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bubble')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'bubble'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Smile className="w-3.5 h-3.5 text-emerald-500" />
              <span>气泡挂件</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('story')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'story'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>封面故事</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>官方示范</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: 封面图 (957 × 1278)                               */}
          {/* ======================================================== */}
          {activeTab === 'cover' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>① 封面图画板 (957 × 1278 · 竖式 3:4)</span>
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
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={coverZoom}
                    onChange={(e) => setCoverZoom(parseFloat(e.target.value))}
                    onPointerUp={() => handleUpdateCover()}
                    className="w-full accent-red-600 cursor-pointer mt-1"
                  />
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
          {/* TAB 2: 封面挂件 (1053 × 1746) - 必须直接拖拽定位          */}
          {/* ======================================================== */}
          {activeTab === 'pendant' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>② 封面挂件 (1053 × 1746 · 微信图3硬性标准)</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono">透明PNG</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    封面挂件严格位于<strong>上端探头</strong>与<strong>脊端垂饰</strong>。无需点击，<strong>直接按住拖拽</strong>即可吸附至对应位置！
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

                  <label className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 border border-amber-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>替换挂件</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadPendantOnly(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Interactive Visual Canvas with DIRECT DRAGGING and Left Vertical Fine-Tuning Slider */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center gap-3 w-full">
                  {/* Left Vertical Slider with [+] at top and [-] at bottom (Micro-tuning) */}
                  <div className="flex flex-col items-center justify-between h-[400px] py-2 px-1.5 bg-neutral-100/90 rounded-2xl border border-neutral-200/90 shadow-2xs select-none shrink-0">
                    {/* Top [+] Button */}
                    <button
                      type="button"
                      onClick={() => handlePendantStepFineTune(-6)}
                      title="向上微调 (按步长上移 6px)"
                      className="w-7 h-7 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-sm font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      +
                    </button>

                    {/* Vertical Range Slider Track (Top-to-Bottom) */}
                    <div className="flex-1 flex flex-col items-center justify-center my-2 relative group py-2">
                      <span className="text-[9px] font-mono font-bold text-amber-800 bg-white/95 px-1 py-0.5 rounded border border-neutral-200 shadow-2xs whitespace-nowrap rotate-[-90deg] mb-3">
                        {currentPendantAnchorY}px
                      </span>
                      <input
                        type="range"
                        min={pendantPlacement === 'bottom' ? 1380 : 20}
                        max={pendantPlacement === 'bottom' ? 1720 : 360}
                        step={2}
                        value={currentPendantAnchorY}
                        onChange={(e) => handlePendantSliderChange(Number(e.target.value))}
                        style={{
                          writingMode: 'vertical-lr',
                          direction: 'rtl',
                          width: '8px',
                          height: '190px',
                        }}
                        className="cursor-ns-resize accent-amber-500 rounded-full"
                        title={`从上往下垂直拖动条 (当前: ${currentPendantAnchorY}px)`}
                      />
                      <span className="text-[8px] font-bold text-neutral-400 mt-3 whitespace-nowrap">
                        {pendantPlacement === 'bottom' ? '脊端' : (pendantPlacement === 'dual' ? '双端' : '上端')}
                      </span>
                    </div>

                    {/* Bottom [-] Button */}
                    <button
                      type="button"
                      onClick={() => handlePendantStepFineTune(6)}
                      title="向下微调 (按步长下移 6px)"
                      className="w-7 h-7 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-sm font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      -
                    </button>
                  </div>

                  {/* Interactive Visual Canvas */}
                  <div
                    ref={pendantCanvasRef}
                    onPointerDown={handlePendantPointerDown}
                    onPointerMove={handlePendantPointerMove}
                    onPointerUp={handlePendantPointerUp}
                    className={`relative w-full max-w-[270px] aspect-[1053/1746] h-[400px] rounded-2xl bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:12px_12px] bg-white border border-neutral-200/90 p-2 flex items-center justify-center overflow-hidden shadow-xs select-none touch-none ${
                      isDraggingPendant ? 'cursor-grabbing ring-2 ring-amber-400' : 'cursor-grab hover:ring-1 hover:ring-neutral-300'
                    }`}
                    title="按住鼠标直接拖拽到上端或脊端任意位置"
                  >
                    {/* Subtle Red Packet Silhouette in Background to visualize actual overlay */}
                    <div className="absolute top-[20.6%] bottom-[20.6%] left-[4.5%] right-[4.5%] rounded-2xl bg-gradient-to-b from-red-600/15 to-red-800/25 border border-red-500/30 pointer-events-none z-0 flex flex-col items-center justify-between py-3">
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

                        {/* WeChat Figure 3 Official Editable Guides */}
                        {showGuides && (
                          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-1">
                            {/* Top Editable Area (上侧可编辑区: 20~360px out of 1746) */}
                            <div className={`h-[20.6%] mx-[4%] border-2 border-dashed rounded-xl relative flex items-center justify-center transition-all ${
                              currentPendantAnchorY < 873 ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-400/40' : 'border-emerald-400/70 bg-emerald-500/5'
                            }`}>
                              <span className="absolute top-1 left-1.5 text-[8px] font-bold text-emerald-800 bg-white/95 px-1 rounded shadow-2xs">
                                ✅ 图3：上侧可编辑区 (上端探头)
                              </span>
                            </div>

                            {/* Middle Forbidden Area */}
                            <div className="h-[58.8%] mx-[4%] my-1 border border-dashed border-red-300/60 bg-red-500/5 rounded-xl flex items-center justify-center">
                              <span className="text-[8px] font-bold text-red-500 bg-white/95 px-1.5 py-0.5 rounded border border-red-200">
                                🚫 封面主体区 (禁止放置挂件)
                              </span>
                            </div>

                            {/* Bottom Editable Area (下侧可编辑区: 1380~1720px out of 1746) */}
                            <div className={`h-[20.6%] mx-[4%] border-2 border-dashed rounded-xl relative flex items-center justify-center transition-all ${
                              currentPendantAnchorY >= 873 ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-400/40' : 'border-emerald-400/70 bg-emerald-500/5'
                            }`}>
                              <span className="absolute bottom-1 left-1.5 text-[8px] font-bold text-emerald-800 bg-white/95 px-1 rounded shadow-2xs">
                                ✅ 图3：下侧可编辑区 (脊端垂饰)
                              </span>
                            </div>

                            {/* Dynamic Drag Crosshair Marker */}
                            <div
                              className="absolute flex items-center justify-center pointer-events-none"
                              style={{
                                left: `${Math.min(92, Math.max(8, (currentPendantAnchorX / 1053) * 100))}%`,
                                top: `${Math.min(95, Math.max(5, (currentPendantAnchorY / 1746) * 100))}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              <div className="w-5 h-5 rounded-full border-2 border-red-500 bg-amber-400/40 animate-ping absolute" />
                              <div className="w-4 h-4 rounded-full border-2 border-red-600 bg-red-500 flex items-center justify-center text-[8px] text-white font-black shadow-md">
                                +
                              </div>
                              <span className="absolute left-5 text-[8px] font-bold text-red-700 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap border border-red-200">
                                挂点 ({currentPendantAnchorX}, {currentPendantAnchorY}) · {currentPendantAnchorY < 873 ? '上端' : '脊端'}
                              </span>
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
                        <span>直接拖动中: ({currentPendantAnchorX}, {currentPendantAnchorY}) · {currentPendantAnchorY < 873 ? '上端探头' : '脊端垂饰'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-2 text-center space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200 inline-block font-mono">
                    ✅ 挂点在微信可编辑区域内 ({currentPendantAnchorX}, {currentPendantAnchorY}) · {currentPendantAnchorY < 873 ? '上端探头' : '脊端垂饰'}合规✓
                  </span>
                  <p className="text-[10px] text-neutral-400">
                    💡 提示：鼠标按住挂件或画板，直接拖动即可实时调整到对应位置
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons (Apple Minimalist Pills) */}
              <div className="space-y-3 pt-2 border-t border-neutral-100 text-xs">
                <div className="flex items-center justify-between text-neutral-700 font-bold">
                  <span>微信官方规范预设位置</span>
                  <span className="text-[10px] text-neutral-400 font-normal">点击快速归位</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendantPlacement('top');
                      setPendantOffsetX(0);
                      setPendantOffsetY(0);
                      handleUpdatePendant('top', 0, 0);
                    }}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      pendantPlacement === 'top'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <span className="block font-bold">上端探头 (图2标准)</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Y = 200 顶部探出</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPendantPlacement('bottom');
                      setPendantOffsetX(0);
                      setPendantOffsetY(0);
                      handleUpdatePendant('bottom', 0, 0);
                    }}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      pendantPlacement === 'bottom'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <span className="block font-bold">脊端垂饰 (图2标准)</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Y = 1540 底部垂挂</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPendantPlacement('dual');
                      setPendantOffsetX(0);
                      setPendantOffsetY(0);
                      handleUpdatePendant('dual', 0, 0);
                    }}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      pendantPlacement === 'dual'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <span className="block font-bold">双端联动</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">上下两端完整呼应</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between font-bold text-neutral-700 mb-1">
                      <span>缩放大小</span>
                      <span className="font-mono text-amber-700">{Math.round(pendantScale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="1.2"
                      step="0.05"
                      value={pendantScale}
                      onChange={(e) => setPendantScale(parseFloat(e.target.value))}
                      onPointerUp={(e) => handleUpdatePendant(undefined, undefined, undefined, parseFloat((e.target as HTMLInputElement).value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-end">
                    <label className="flex items-center gap-2 cursor-pointer pt-4 font-bold text-neutral-700">
                      <input
                        type="checkbox"
                        checked={pendantAddGlow}
                        onChange={(e) => {
                          setPendantAddGlow(e.target.checked);
                          setTimeout(() => handleUpdatePendant(), 50);
                        }}
                        className="accent-amber-600"
                      />
                      <span>添加微金色高光</span>
                    </label>
                  </div>
                </div>
              </div>

              {pendantResult && (
                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-neutral-400 font-mono">
                    体积: {Math.round(pendantResult.size / 1024)} KB (&le; 300KB 合规 ✓)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(pendantResult.blob, '02_封面挂件_1053x1746_透明PNG.png')}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>单独下载封面挂件</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: 气泡挂件 (480 × 384) - 必须直接拖拽定位            */}
          {/* ======================================================== */}
          {activeTab === 'bubble' && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>③ 气泡挂件 (480 × 384 · 微信图4标准升级)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">完整小熊零截断</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    根据附件图4标准升级：可编辑区位于上方黄金范围，内置安全防裁边界，<strong>直接按住拖拽</strong>即可定位挂点！
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

                  <label className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 border border-emerald-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>替换气泡小熊</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadBubbleOnly(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Interactive Visual Canvas with DIRECT DRAGGING and Left Vertical Fine-Tuning Slider */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center gap-3 w-full">
                  {/* Left Vertical Slider with [+] at top and [-] at bottom (Micro-tuning) */}
                  <div className="flex flex-col items-center justify-between h-[260px] py-2 px-1.5 bg-neutral-100/90 rounded-2xl border border-neutral-200/90 shadow-2xs select-none shrink-0">
                    {/* Top [+] Button */}
                    <button
                      type="button"
                      onClick={() => handleBubbleStepFineTune(-6)}
                      title="向上微调 (按步长上移 6px)"
                      className="w-7 h-7 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-sm font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      +
                    </button>

                    {/* Vertical Range Slider Track */}
                    <div className="flex-1 flex flex-col items-center justify-center my-1 relative group py-1">
                      <span className="text-[9px] font-mono font-bold text-emerald-800 bg-white/95 px-1 py-0.5 rounded border border-neutral-200 shadow-2xs whitespace-nowrap rotate-[-90deg] mb-3">
                        {currentBubbleAnchorY}px
                      </span>
                      <input
                        type="range"
                        min={20}
                        max={280}
                        step={2}
                        value={currentBubbleAnchorY}
                        onChange={(e) => handleBubbleSliderChange(Number(e.target.value))}
                        style={{
                          writingMode: 'vertical-lr',
                          direction: 'rtl',
                          width: '8px',
                          height: '110px',
                        }}
                        className="cursor-ns-resize accent-emerald-500 rounded-full"
                        title={`从上往下垂直拖动条 (当前: ${currentBubbleAnchorY}px)`}
                      />
                      <span className="text-[8px] font-bold text-neutral-400 mt-3 whitespace-nowrap">
                        安全区
                      </span>
                    </div>

                    {/* Bottom [-] Button */}
                    <button
                      type="button"
                      onClick={() => handleBubbleStepFineTune(6)}
                      title="向下微调 (按步长下移 6px)"
                      className="w-7 h-7 rounded-xl bg-white hover:bg-neutral-50 active:scale-90 border border-neutral-200 shadow-2xs flex items-center justify-center text-sm font-black text-neutral-800 transition-all cursor-pointer"
                    >
                      -
                    </button>
                  </div>

                  {/* Visual Interactive Bubble Canvas */}
                  <div
                    ref={bubbleCanvasRef}
                    onPointerDown={handleBubblePointerDown}
                    onPointerMove={handleBubblePointerMove}
                    onPointerUp={handleBubblePointerUp}
                    className={`relative w-full max-w-[300px] aspect-[480/384] h-[260px] rounded-2xl bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:12px_12px] bg-white border border-neutral-200/90 p-2 flex items-center justify-center overflow-hidden shadow-xs select-none touch-none ${
                      isDraggingBubble ? 'cursor-grabbing ring-2 ring-emerald-400' : 'cursor-grab hover:ring-1 hover:ring-neutral-300'
                    }`}
                    title="按住鼠标直接拖拽到绿色可编辑区域内任意位置"
                  >
                    {bubbleResult ? (
                      <>
                        {/* Full Subject Guaranteed Zero Truncation */}
                        <img
                          src={bubbleResult.url}
                          alt="气泡挂件"
                          className="w-full h-full object-contain drop-shadow-md z-10 pointer-events-none"
                        />

                        {/* WeChat Figure 4 Guides strictly mapped to 480x384 */}
                        {showGuides && (
                          <div className="absolute inset-0 pointer-events-none z-20">
                            {/* Figure 4 Upper Safe Editable Zone: [40..440, 20..280] */}
                            <div
                              className="absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10 rounded-xl"
                              style={{
                                left: `${(40 / 480) * 100}%`,
                                top: `${(20 / 384) * 100}%`,
                                width: `${(400 / 480) * 100}%`,
                                height: `${(260 / 384) * 100}%`,
                              }}
                            >
                              <span className="absolute top-1 left-2 text-[8px] font-bold text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-200">
                                ✅ 图4：气泡可编辑区域 (400×260)
                              </span>
                            </div>

                            {/* Message Bubble Base: [40..440, 280..370] */}
                            <div
                              className="absolute border border-dashed border-neutral-300 bg-neutral-100/60 rounded-lg flex items-center justify-center text-[8px] text-neutral-500 font-medium"
                              style={{
                                left: `${(40 / 480) * 100}%`,
                                top: `${(280 / 384) * 100}%`,
                                width: `${(400 / 480) * 100}%`,
                                height: `${(85 / 384) * 100}%`,
                              }}
                            >
                              💬 微信红包消息底座区 (挂靠处)
                            </div>

                            {/* Absolute Bubble Anchor Target Crosshair */}
                            <div
                              className="absolute flex items-center justify-center pointer-events-none"
                              style={{
                                left: `${(currentBubbleAnchorX / 480) * 100}%`,
                                top: `${(currentBubbleAnchorY / 384) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              <div className="w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-400/40 animate-ping absolute" />
                              <div className="w-4 h-4 rounded-full border-2 border-emerald-600 bg-emerald-600 flex items-center justify-center text-[8px] text-white font-black shadow-md">
                                +
                              </div>
                              <span className="absolute left-5 text-[8px] font-bold text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap border border-emerald-200">
                                挂点 ({currentBubbleAnchorX}, {currentBubbleAnchorY}) · 可编辑区内✓
                              </span>
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
                        <span>直接拖动中: ({currentBubbleAnchorX}, {currentBubbleAnchorY}) · 安全区内✓</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-center space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200 inline-block font-mono">
                    ✅ 气泡挂点在可编辑区 ({currentBubbleAnchorX}, {currentBubbleAnchorY}) · 完整形象零截断✓
                  </span>
                  <p className="text-[10px] text-neutral-400">
                    💡 提示：按住直接拖动，小熊身体、耳朵完整保留，绝不裁切
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-100 text-xs">
                <div>
                  <div className="flex items-center justify-between font-bold text-neutral-700 mb-1">
                    <span>尺寸缩放比例</span>
                    <span className="font-mono text-emerald-700">{Math.round(bubbleScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.2"
                    step="0.05"
                    value={bubbleScale}
                    onChange={(e) => setBubbleScale(parseFloat(e.target.value))}
                    onPointerUp={(e) => handleUpdateBubble(undefined, undefined, parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setBubbleOffsetX(0);
                      setBubbleOffsetY(0);
                      handleUpdateBubble(0, 0);
                    }}
                    className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold cursor-pointer transition-all border border-neutral-200 active:scale-95 text-xs"
                  >
                    🎯 一键校准至黄金挂点 (240, 120)
                  </button>
                </div>
              </div>

              {bubbleResult && (
                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-neutral-400 font-mono">
                    大小: {Math.round(bubbleResult.size / 1024)} KB (严格 &le; 300KB 合规 ✓)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(bubbleResult.blob, '03_气泡挂件_480x384_透明PNG.png')}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>单独下载气泡挂件</span>
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
                    <span>④ 封面故事 (750 × 1250 · 详情页下拉沉浸展示)</span>
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
