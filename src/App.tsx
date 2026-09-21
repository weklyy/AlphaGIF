/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Sparkles,
  Layers,
  Download,
  Upload,
  CheckCircle2,
  FileImage,
  Sliders,
  ShieldCheck,
  Zap,
  Smile,
  Type,
  Film,
  FolderArchive,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import {
  GifItem,
  RemovalOptions,
  PreviewBgMode,
  GridConfig,
  ImageGridConfig,
  SlicedStickerItem,
  WeChatMaterialsState,
  BannerOptions,
  IconOptions,
} from './types';
import {
  decodeMediaFile,
  processMediaItem,
  isGifFile,
  detachFileToMemory,
} from './utils/gifProcessor';
import { UploadZone } from './components/UploadZone';
import { BatchControls } from './components/BatchControls';
import { GifCard } from './components/GifCard';
import { GridVideoUploader } from './components/WeChatSuite/GridVideoUploader';
import { GridSlicerControls } from './components/WeChatSuite/GridSlicerControls';
import { GridImageUploader } from './components/WeChatSuite/GridImageUploader';
import { GridImageSlicerControls } from './components/WeChatSuite/GridImageSlicerControls';
import { StickerGridResults } from './components/WeChatSuite/StickerGridResults';
import { MaterialsManager } from './components/WeChatSuite/MaterialsManager';
import { ImageRetouchWorkspace } from './components/WeChatSuite/ImageRetouchWorkspace';
import { sliceVideoIntoStickers } from './utils/videoGridSlicer';
import { sliceImageIntoStickers } from './utils/imageGridSlicer';
import {
  generateAllWeChatMaterials,
  generateBannerMaterial,
  generateCoverMaterial,
  generateIconMaterial,
  generateRewardGuideMaterial,
  generateRewardThanksMaterial,
} from './utils/materialGenerator';

export default function App() {
  // Navigation state: Static Slicer, Dynamic Slicer, Consolidated Transparency & Retouch Tool
  const [activeTab, setActiveTab] = useState<'suite_image' | 'suite_video' | 'transparency'>('suite_image');
  const [transparencySubView, setTransparencySubView] = useState<'batch' | 'retouch'>('batch');

  // Retouch & Watermark Workspace State
  const [retouchImageFile, setRetouchImageFile] = useState<File | null>(null);
  const [activeRetouchItemId, setActiveRetouchItemId] = useState<string | null>(null);
  const [isRetouchImageLoaded, setIsRetouchImageLoaded] = useState<boolean>(false);
  const [manualShowBanner, setManualShowBanner] = useState<boolean>(false);

  // Tab 1: WeChat Dynamic Video Sticker Suite State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    preset: '16',
    cols: 4,
    rows: 4,
    cropArea: { x: 0, y: 0, width: 100, height: 100 },
    paddingInset: 2,
    startTime: 0,
    endTime: 3,
    speed: 1.0,
    fps: 10,
    autoTransparent: true,
    bgColor: '#ffffff',
    tolerance: 20,
    addWhiteOutline: true,
    outlineWidth: 2,
  });
  const [isSlicing, setIsSlicing] = useState(false);
  const [sliceProgress, setSliceProgress] = useState(0);
  const [sliceStatusText, setSliceStatusText] = useState('');
  const [slicedStickers, setSlicedStickers] = useState<SlicedStickerItem[]>([]);

  // Five Derivative Materials Configurations (Video)
  const [bannerOptions, setBannerOptions] = useState<BannerOptions>({
    themeColor: '#ff8a5b',
    colorPreset: 'orange',
    selectedStickerIndices: [1, 2, 3],
  });
  const [coverIndex, setCoverIndex] = useState(1);
  const [iconOptions, setIconOptions] = useState<IconOptions>({
    selectedStickerIndex: 1,
    zoom: 1.35,
    offsetY: 0,
  });
  const [rewardGuideIndex, setRewardGuideIndex] = useState(1);
  const [rewardThanksIndex, setRewardThanksIndex] = useState(3);
  const [materials, setMaterials] = useState<WeChatMaterialsState | null>(null);
  const [isGeneratingMaterials, setIsGeneratingMaterials] = useState(false);

  // Tab 2: WeChat Static Image Multi-Grid Slicer State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageGridConfig, setImageGridConfig] = useState<ImageGridConfig>({
    preset: '16',
    cols: 4,
    rows: 4,
    cropArea: { x: 0, y: 0, width: 100, height: 100 },
    paddingInset: 2,
    autoTransparent: true,
    bgColor: '#ffffff',
    tolerance: 20,
    addWhiteOutline: true,
    outlineWidth: 2,
    outputFormat: 'png',
    layoutMode: 'grid',
    lockSquare: true,
    transparentBorders: true,
  });
  const [isImageSlicing, setIsImageSlicing] = useState(false);
  const [imageSliceProgress, setImageSliceProgress] = useState(0);
  const [imageSliceStatusText, setImageSliceStatusText] = useState('');
  const [imageSlicedStickers, setImageSlicedStickers] = useState<SlicedStickerItem[]>([]);

  const [imageBannerOptions, setImageBannerOptions] = useState<BannerOptions>({
    themeColor: '#ff8a5b',
    colorPreset: 'orange',
    selectedStickerIndices: [1, 2, 3],
  });
  const [imageCoverIndex, setImageCoverIndex] = useState(1);
  const [imageIconOptions, setImageIconOptions] = useState<IconOptions>({
    selectedStickerIndex: 1,
    zoom: 1.35,
    offsetY: 0,
  });
  const [imageRewardGuideIndex, setImageRewardGuideIndex] = useState(1);
  const [imageRewardThanksIndex, setImageRewardThanksIndex] = useState(3);
  const [imageMaterials, setImageMaterials] = useState<WeChatMaterialsState | null>(null);
  const [isImageGeneratingMaterials, setIsImageGeneratingMaterials] = useState(false);

  // Tab 3: Batch Transparency Tool State
  const [items, setItems] = useState<GifItem[]>([]);
  const [previewBg, setPreviewBg] = useState<PreviewBgMode>('checker');
  const [isProcessingAny, setIsProcessingAny] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setGlobalNotification(msg);
    setTimeout(() => {
      setGlobalNotification((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Prevent browser default behavior of navigating to dropped files if dropped outside target areas
  useEffect(() => {
    const preventWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventWindowDrop);
    window.addEventListener('drop', preventWindowDrop);
    return () => {
      window.removeEventListener('dragover', preventWindowDrop);
      window.removeEventListener('drop', preventWindowDrop);
    };
  }, []);

  // -------------------------------------------------------------
  // Tab 1: Video Loading & Slicing Handlers
  // -------------------------------------------------------------
  const handleVideoLoaded = (file: File, url: string) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(url);
    setSlicedStickers([]);
    setMaterials(null);
    setActiveTab('suite_video');
    showNotification(`已载入视频「${file.name}」，请在下方调整宫格与修剪秒数`);
  };

  const handleResetVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setSlicedStickers([]);
    setMaterials(null);
  };

  // Perform Grid Slicing & Auto-generate 5 Derivative Materials
  const handleStartSlice = async (videoElement: HTMLVideoElement) => {
    if (isSlicing) return;
    setIsSlicing(true);
    setSliceProgress(5);
    setSliceStatusText('准备逐帧切片...');

    try {
      const stickers = await sliceVideoIntoStickers(
        videoElement,
        gridConfig,
        (progress, currentCell, totalCells, statusText) => {
          setSliceProgress(progress);
          setSliceStatusText(statusText);
        }
      );

      setSlicedStickers(stickers);

      // Auto-set reasonable default indices for materials
      const count = stickers.length;
      const newCoverIdx = 1;
      const newIconIdx = 1;
      const newGuideIdx = count >= 2 ? 2 : 1;
      const newThanksIdx = count >= 3 ? 3 : 1;
      const featuredIndices = count >= 3 ? [1, 2, 3] : count >= 2 ? [1, 2] : [1];

      setCoverIndex(newCoverIdx);
      setIconOptions((prev) => ({ ...prev, selectedStickerIndex: newIconIdx }));
      setRewardGuideIndex(newGuideIdx);
      setRewardThanksIndex(newThanksIdx);
      const newBannerOpts = { ...bannerOptions, selectedStickerIndices: featuredIndices };
      setBannerOptions(newBannerOpts);

      // Generate 5 Derivative Materials automatically
      setSliceStatusText('正在自动拼装 5 大微信官方衍生审核物料...');
      const generatedMaterials = await generateAllWeChatMaterials(
        stickers,
        newBannerOpts,
        newCoverIdx,
        { ...iconOptions, selectedStickerIndex: newIconIdx },
        newGuideIdx,
        newThanksIdx
      );
      setMaterials(generatedMaterials);

      showNotification(`🎉 成功切出 ${stickers.length} 个标准表情包，并自动生成全套 5 大微信审核物料！`);
    } catch (err: any) {
      console.error('Failed to slice video:', err);
      showNotification(`切片失败: ${err.message || '未知错误'}`);
    } finally {
      setIsSlicing(false);
    }
  };

  // Regenerate Derivative Materials on demand
  const handleRegenerateMaterials = async () => {
    if (slicedStickers.length === 0 || isGeneratingMaterials) return;
    setIsGeneratingMaterials(true);
    try {
      const generatedMaterials = await generateAllWeChatMaterials(
        slicedStickers,
        bannerOptions,
        coverIndex,
        iconOptions,
        rewardGuideIndex,
        rewardThanksIndex
      );
      setMaterials(generatedMaterials);
      showNotification('五大微信官方衍生审核物料已更新！');
    } catch (err) {
      console.error('Failed to regenerate materials', err);
    } finally {
      setIsGeneratingMaterials(false);
    }
  };

  // Material dynamic individual updates
  const handleBannerOptionsChange = async (newOpts: BannerOptions) => {
    setBannerOptions(newOpts);
    if (slicedStickers.length > 0 && materials) {
      try {
        const res = await generateBannerMaterial(slicedStickers, newOpts);
        setMaterials((prev) =>
          prev
            ? {
                ...prev,
                banner: { ...prev.banner, blob: res.blob, url: res.url, size: res.size },
              }
            : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCoverIndexChange = async (idx: number) => {
    setCoverIndex(idx);
    if (slicedStickers.length > 0 && materials) {
      try {
        const res = await generateCoverMaterial(slicedStickers, idx);
        setMaterials((prev) =>
          prev
            ? {
                ...prev,
                cover: { ...prev.cover, blob: res.blob, url: res.url, size: res.size },
              }
            : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleIconOptionsChange = async (newOpts: IconOptions) => {
    setIconOptions(newOpts);
    if (slicedStickers.length > 0 && materials) {
      try {
        const res = await generateIconMaterial(slicedStickers, newOpts);
        setMaterials((prev) =>
          prev
            ? {
                ...prev,
                icon: { ...prev.icon, blob: res.blob, url: res.url, size: res.size },
              }
            : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRewardGuideIndexChange = async (idx: number) => {
    setRewardGuideIndex(idx);
    if (slicedStickers.length > 0 && materials) {
      try {
        const res = await generateRewardGuideMaterial(slicedStickers, idx, bannerOptions.colorPreset);
        setMaterials((prev) =>
          prev
            ? {
                ...prev,
                rewardGuide: { ...prev.rewardGuide, blob: res.blob, url: res.url, size: res.size },
              }
            : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRewardThanksIndexChange = async (idx: number) => {
    setRewardThanksIndex(idx);
    if (slicedStickers.length > 0 && materials) {
      try {
        const res = await generateRewardThanksMaterial(slicedStickers, idx, 'pink');
        setMaterials((prev) =>
          prev
            ? {
                ...prev,
                rewardThanks: { ...prev.rewardThanks, blob: res.blob, url: res.url, size: res.size },
              }
            : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  // -------------------------------------------------------------
  // Tab 2: Static Image Slicing Handlers
  // -------------------------------------------------------------
  const handleImageLoaded = (file: File, url: string) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(url);
    setImageSlicedStickers([]);
    setImageMaterials(null);
    setActiveTab('suite_image');
    showNotification(`已载入静态大图: ${file.name}，可拖拽边框调节切片区域`);
  };

  const handleResetImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    setImageSlicedStickers([]);
    setImageMaterials(null);
  };

  const handleSendToRetouch = (file: File) => {
    setRetouchImageFile(file);
    setActiveRetouchItemId(null);
    setTransparencySubView('retouch');
    setActiveTab('transparency');
    showNotification('已将图片载入背景透明化工具的精细修图与透底画板！');
  };

  const handleRetouchSendToStaticSlicer = (file: File) => {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setActiveTab('suite_image');
    showNotification('已将修图去水印后的图片导入静态多宫格切片套件！');
  };

  const handleRetouchSyncToBatch = (file: File) => {
    if (activeRetouchItemId) {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === activeRetouchItemId) {
            const url = URL.createObjectURL(file);
            return {
              ...it,
              file,
              originalUrl: url,
              originalSize: file.size,
              status: 'idle',
              result: undefined,
            };
          }
          return it;
        })
      );
      showNotification(`已将修图与透底结果同步更新至表情「${file.name}」！`);
    } else {
      handleFilesSelected([file]);
      showNotification(`已将修图与透底结果添加至批量处理列表！`);
    }
    setTransparencySubView('batch');
  };

  const handleRetouchSendToTransparency = (file: File) => {
    handleRetouchSyncToBatch(file);
  };

  const handleStartImageSlice = async (imgElement: HTMLImageElement) => {
    setIsImageSlicing(true);
    setImageSliceProgress(0);
    setImageSliceStatusText('正在准备静态图切片...');

    try {
      const stickers = await sliceImageIntoStickers(
        imgElement,
        imageGridConfig,
        (progress, currentCell, totalCells, statusText) => {
          setImageSliceProgress(progress);
          setImageSliceStatusText(statusText);
        }
      );

      setImageSlicedStickers(stickers);
      setImageSliceStatusText('静态表情切片完成！正在生成全套 5 大微信衍生审核物料...');

      // Auto-generate all 5 WeChat official derivative materials
      setIsImageGeneratingMaterials(true);
      const generatedMaterials = await generateAllWeChatMaterials(
        stickers,
        imageBannerOptions,
        imageCoverIndex,
        imageIconOptions,
        imageRewardGuideIndex,
        imageRewardThanksIndex
      );
      setImageMaterials(generatedMaterials);
      showNotification(`成功切出 ${stickers.length} 个微信官方标准静态表情，并已生成全套 5 大审核物料！`);
    } catch (err) {
      console.error('Failed to slice image', err);
      showNotification('切片过程出错: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImageSlicing(false);
      setIsImageGeneratingMaterials(false);
    }
  };

  const handleRegenerateImageMaterials = async () => {
    if (imageSlicedStickers.length === 0) return;
    setIsImageGeneratingMaterials(true);
    try {
      const generatedMaterials = await generateAllWeChatMaterials(
        imageSlicedStickers,
        imageBannerOptions,
        imageCoverIndex,
        imageIconOptions,
        imageRewardGuideIndex,
        imageRewardThanksIndex
      );
      setImageMaterials(generatedMaterials);
      showNotification('五大微信官方衍生审核物料已更新！');
    } catch (err) {
      console.error('Failed to regenerate image materials', err);
    } finally {
      setIsImageGeneratingMaterials(false);
    }
  };

  const handleImageBannerOptionsChange = async (newOpts: BannerOptions) => {
    setImageBannerOptions(newOpts);
    if (imageSlicedStickers.length > 0 && imageMaterials) {
      try {
        const res = await generateBannerMaterial(imageSlicedStickers, newOpts);
        setImageMaterials((prev) =>
          prev ? { ...prev, banner: { ...prev.banner, blob: res.blob, url: res.url, size: res.size } } : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImageCoverIndexChange = async (idx: number) => {
    setImageCoverIndex(idx);
    if (imageSlicedStickers.length > 0 && imageMaterials) {
      try {
        const res = await generateCoverMaterial(imageSlicedStickers, idx);
        setImageMaterials((prev) =>
          prev ? { ...prev, cover: { ...prev.cover, blob: res.blob, url: res.url, size: res.size } } : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImageIconOptionsChange = async (newOpts: IconOptions) => {
    setImageIconOptions(newOpts);
    if (imageSlicedStickers.length > 0 && imageMaterials) {
      try {
        const res = await generateIconMaterial(imageSlicedStickers, newOpts);
        setImageMaterials((prev) =>
          prev ? { ...prev, icon: { ...prev.icon, blob: res.blob, url: res.url, size: res.size } } : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImageRewardGuideIndexChange = async (idx: number) => {
    setImageRewardGuideIndex(idx);
    if (imageSlicedStickers.length > 0 && imageMaterials) {
      try {
        const res = await generateRewardGuideMaterial(imageSlicedStickers, idx, 'gold');
        setImageMaterials((prev) =>
          prev ? { ...prev, rewardGuide: { ...prev.rewardGuide, blob: res.blob, url: res.url, size: res.size } } : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImageRewardThanksIndexChange = async (idx: number) => {
    setImageRewardThanksIndex(idx);
    if (imageSlicedStickers.length > 0 && imageMaterials) {
      try {
        const res = await generateRewardThanksMaterial(imageSlicedStickers, idx, 'pink');
        setImageMaterials((prev) =>
          prev ? { ...prev, rewardThanks: { ...prev.rewardThanks, blob: res.blob, url: res.url, size: res.size } } : null
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImportAllImageStickersToTab3 = () => {
    if (imageSlicedStickers.length === 0) return;
    const newItems: GifItem[] = imageSlicedStickers.map((s) => {
      const isGif = s.name.endsWith('.gif');
      const file = new File([s.blob], s.name, { type: isGif ? 'image/gif' : 'image/png' });
      const url = URL.createObjectURL(file);
      return {
        id: `wechat_img_${s.index}_${Date.now()}`,
        name: s.name,
        file,
        mediaType: isGif ? 'gif' : 'image',
        originalUrl: url,
        originalSize: s.size,
        width: s.width,
        height: s.height,
        frameCount: 1,
        detectedBgColor: '#ffffff',
        options: {
          targetColor: '#ffffff',
          tolerance: 20,
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
        },
        status: 'done',
        progress: 100,
        result: {
          blob: s.blob,
          url: s.url,
          size: s.size,
          frameCount: 1,
          width: s.width,
          height: s.height,
          format: isGif ? 'gif' : 'png',
          isWeChatSticker: true,
        },
      };
    });
    setItems((prev) => [...newItems, ...prev]);
    setActiveTab('transparency');
    showNotification(`已将 ${newItems.length} 个静态表情切片导入批量透明化工具`);
  };

  const handleImportSingleImageStickerToTab3 = (s: SlicedStickerItem) => {
    const isGif = s.name.endsWith('.gif');
    const file = new File([s.blob], s.name, { type: isGif ? 'image/gif' : 'image/png' });
    const url = URL.createObjectURL(file);
    const item: GifItem = {
      id: `wechat_img_${s.index}_${Date.now()}`,
      name: s.name,
      file,
      mediaType: isGif ? 'gif' : 'image',
      originalUrl: url,
      originalSize: s.size,
      width: s.width,
      height: s.height,
      frameCount: 1,
      detectedBgColor: '#ffffff',
      options: {
        targetColor: '#ffffff',
        tolerance: 20,
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
      },
      status: 'done',
      progress: 100,
      result: {
        blob: s.blob,
        url: s.url,
        size: s.size,
        frameCount: 1,
        width: s.width,
        height: s.height,
        format: isGif ? 'gif' : 'png',
        isWeChatSticker: true,
      },
    };
    setItems((prev) => [item, ...prev]);
    setActiveTab('transparency');
    showNotification(`已将表情 ${s.name} 导入批量透明化工具`);
  };

  const handleSendStickerToRetouch = (s: SlicedStickerItem) => {
    const isGif = s.name.endsWith('.gif');
    const file = new File([s.blob], s.name, { type: isGif ? 'image/gif' : 'image/png' });
    setRetouchImageFile(file);
    setActiveRetouchItemId(null);
    setTransparencySubView('retouch');
    setActiveTab('transparency');
    showNotification(`已将表情「${s.name}」导入背景透明化工具的精细修图与透底画板！`);
  };

  const handleSendMediaFileToRetouch = (file: File, itemId?: string) => {
    setRetouchImageFile(file);
    setActiveRetouchItemId(itemId || null);
    setTransparencySubView('retouch');
    setActiveTab('transparency');
    showNotification(`已将图片「${file.name}」导入背景透明化工具的精细修图与透底画板！`);
  };

  // -------------------------------------------------------------
  // Bi-directional Interconnection between Tab 1 & Tab 2
  // -------------------------------------------------------------
  const handleImportAllStickersToTab2 = () => {
    if (slicedStickers.length === 0) return;
    const newItems: GifItem[] = slicedStickers.map((s) => {
      const file = new File([s.blob], s.name, { type: 'image/gif' });
      const url = URL.createObjectURL(file);
      return {
        id: `wechat_${s.index}_${Date.now()}`,
        name: s.name,
        file,
        mediaType: 'gif',
        originalUrl: url,
        originalSize: s.size,
        width: s.width,
        height: s.height,
        frameCount: s.frameCount,
        detectedBgColor: '#ffffff',
        options: {
          targetColor: '#ffffff',
          tolerance: 20,
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
        },
        status: 'done',
        progress: 100,
        result: {
          blob: s.blob,
          url: s.url,
          size: s.size,
          frameCount: s.frameCount,
          width: s.width,
          height: s.height,
          format: 'gif',
          isWeChatSticker: true,
        },
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    setActiveTab('transparency');
    showNotification(`已将 ${slicedStickers.length} 个切片表情导入背景透明化工具，可继续微调底色或配字！`);
  };

  const handleImportSingleStickerToTab2 = (s: SlicedStickerItem) => {
    const file = new File([s.blob], s.name, { type: 'image/gif' });
    const url = URL.createObjectURL(file);
    const item: GifItem = {
      id: `wechat_${s.index}_${Date.now()}`,
      name: s.name,
      file,
      mediaType: 'gif',
      originalUrl: url,
      originalSize: s.size,
      width: s.width,
      height: s.height,
      frameCount: s.frameCount,
      detectedBgColor: '#ffffff',
      options: {
        targetColor: '#ffffff',
        tolerance: 20,
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
      },
      status: 'done',
      progress: 100,
      result: {
        blob: s.blob,
        url: s.url,
        size: s.size,
        frameCount: s.frameCount,
        width: s.width,
        height: s.height,
        format: 'gif',
        isWeChatSticker: true,
      },
    };

    setItems((prev) => [...prev, item]);
    setActiveTab('transparency');
    showNotification(`已将「${s.name}」导入背景透明化工具！`);
  };

  // -------------------------------------------------------------
  // Tab 2: Batch Transparency Handlers
  // -------------------------------------------------------------
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newItems: GifItem[] = [];

    for (const file of files) {
      // Detach DOM File to in-memory File + ArrayBuffer to prevent net::ERR_UPLOAD_FILE_CHANGED in Edge/Chrome
      const { safeFile, arrayBuffer } = await detachFileToMemory(file);
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const url = URL.createObjectURL(safeFile);
      const isGif = isGifFile(safeFile);

      const item: GifItem = {
        id,
        name: safeFile.name,
        file: safeFile,
        cachedBuffer: arrayBuffer,
        mediaType: isGif ? 'gif' : 'image',
        originalUrl: url,
        originalSize: safeFile.size,
        width: 0,
        height: 0,
        frameCount: isGif ? 0 : 1,
        detectedBgColor: '#ffffff',
        options: {
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
        },
        status: 'idle',
        progress: 0,
      };

      newItems.push(item);
    }

    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const decoded = await decodeMediaFile(item.file, item.cachedBuffer);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  width: decoded.width,
                  height: decoded.height,
                  frameCount: decoded.frames.length,
                  detectedBgColor: decoded.detectedBgColor,
                  cachedFrames: decoded.frames,
                  options: {
                    ...i.options,
                    targetColor: decoded.detectedBgColor || '#ffffff',
                  },
                }
              : i
          )
        );
      } catch (err) {
        console.error('Failed to parse media metadata for', item.name, err);
      }
    }
  }, []);

  const handleUpdateOptions = useCallback((id: string, options: RemovalOptions) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, options } : item))
    );
  }, []);

  const handleProcessItem = useCallback(async (id: string, asWeChat?: boolean) => {
    const currentItem = items.find((i) => i.id === id);
    if (!currentItem) return;

    const targetOptions: RemovalOptions = {
      ...currentItem.options,
      wechat:
        asWeChat !== undefined
          ? {
              standardSize: '240',
              addWhiteOutline: true,
              outlineWidth: 2,
              outlineColor: '#ffffff',
              captionText: currentItem.options.wechat?.captionText || '',
              captionPosition: 'bottom',
              captionColor: '#ffffff',
              captionStrokeColor: '#000000',
              captionFontSize: 22,
              ...currentItem.options.wechat,
              enabled: asWeChat,
            }
          : currentItem.options.wechat,
    };

    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              options: targetOptions,
              status: 'processing',
              progress: 10,
              statusMessage: asWeChat ? '正在生成微信表情包...' : '准备中...',
              errorMessage: undefined,
            }
          : i
      )
    );

    try {
      const result = await processMediaItem(
        currentItem.file,
        targetOptions,
        (progress, message) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === id ? { ...i, progress, statusMessage: message } : i
            )
          );
        },
        currentItem.cachedBuffer,
        currentItem.cachedFrames
      );

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'done',
                progress: 100,
                statusMessage: '完成',
                result,
              }
            : i
        )
      );

      showNotification(
        result.isWeChatSticker
          ? `「${currentItem.file.name}」已成功生成微信标准表情包！`
          : `「${currentItem.file.name}」透明化处理完成！`
      );
    } catch (err: any) {
      console.error('Failed to process media:', err);
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'error',
                errorMessage: err.message || '处理失败',
              }
            : i
        )
      );
    }
  }, [items]);

  const handleProcessAll = async (asWeChat?: boolean) => {
    if (items.length === 0 || isProcessingAny) return;
    setIsProcessingAny(true);

    const modeIsWeChat = asWeChat === true;

    for (const item of items) {
      const targetOptions: RemovalOptions = {
        ...item.options,
        wechat: modeIsWeChat
          ? {
              standardSize: '240',
              addWhiteOutline: true,
              outlineWidth: 2,
              outlineColor: '#ffffff',
              captionText: item.options.wechat?.captionText || '',
              captionPosition: 'bottom',
              captionColor: '#ffffff',
              captionStrokeColor: '#000000',
              captionFontSize: 22,
              ...item.options.wechat,
              enabled: true,
            }
          : asWeChat === false
          ? {
              ...item.options.wechat,
              enabled: false,
            }
          : item.options.wechat,
      };

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                options: targetOptions,
                status: 'processing',
                progress: 10,
                statusMessage: modeIsWeChat
                  ? '正在生成微信表情包...'
                  : '正在处理背景透明化...',
              }
            : i
        )
      );

      try {
        const result = await processMediaItem(
          item.file,
          targetOptions,
          (progress, message) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, progress, statusMessage: message }
                  : i
              )
            );
          },
          item.cachedBuffer,
          item.cachedFrames
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'done',
                  progress: 100,
                  statusMessage: '完成',
                  result,
                }
              : i
          )
        );
      } catch (err: any) {
        console.error('Failed to process item in batch:', item.name, err);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: err.message || '处理失败',
                }
              : i
          )
        );
      }
    }

    setIsProcessingAny(false);
    showNotification(
      modeIsWeChat
        ? '🎉 批量微信表情包已全部生成完毕！已按微信规范优化尺寸与体积。'
        : '批量透明化转换已全部完成！'
    );
  };

  const handleDownloadAllZip = async (onlyWeChat?: boolean) => {
    const completedItems = items.filter((i) => {
      if (i.status !== 'done' || !i.result?.blob) return false;
      if (onlyWeChat) return !!i.result.isWeChatSticker;
      return true;
    });
    if (completedItems.length === 0) {
      showNotification('当前没有已完成的项目可供下载');
      return;
    }

    showNotification('正在打包生成 ZIP 压缩包...');
    const zip = new JSZip();

    for (let index = 0; index < completedItems.length; index++) {
      const item = completedItems[index];
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const isGif =
        item.result?.format === 'gif' ||
        (item.result?.format === undefined && item.mediaType === 'gif');
      const ext = isGif ? 'gif' : 'png';
      const suffix = item.result?.isWeChatSticker ? '_wechat_sticker' : '_transparent';
      const fileName = `${baseName}${suffix}.${ext}`;
      if (item.result?.blob) {
        zip.file(fileName, item.result.blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `stickers_export_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    showNotification('ZIP 压缩包下载已启动！');
  };

  const handleClearAll = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.originalUrl);
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    });
    setItems([]);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.result?.url) URL.revokeObjectURL(target.result.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleApplyGlobalOptions = (options: RemovalOptions) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        options: { ...options },
      }))
    );
    showNotification('已成功将微信表情 & 压缩参数同步应用至全部项目');
  };

  // Batch compression for all items
  const handleCompressAll = async () => {
    if (items.length === 0 || isProcessingAny) return;
    setIsProcessingAny(true);
    showNotification('开始批量智能达标压缩处理...');

    for (const item of items) {
      const targetOptions: RemovalOptions = {
        ...item.options,
        compression: {
          enabled: true,
          preset: 'wechat-auto',
          targetSizeKb: item.mediaType === 'gif' ? 1000 : 500,
          maxColors: 256,
          scaleRatio: 1.0,
          frameStep: 1,
          autoCompressUnderLimit: true,
          ...item.options.compression,
        },
      };

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                options: targetOptions,
                status: 'processing',
                progress: 10,
                statusMessage: '正在进行微信体积优化压缩...',
              }
            : i
        )
      );

      try {
        const result = await processMediaItem(
          item.file,
          targetOptions,
          (progress, message) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, progress, statusMessage: message } : i
              )
            );
          },
          item.cachedBuffer,
          item.cachedFrames
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'done',
                  progress: 100,
                  statusMessage: '完成',
                  result,
                }
              : i
          )
        );
      } catch (err: any) {
        console.error('Failed to compress item in batch:', item.name, err);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: err.message || '压缩处理失败',
                }
              : i
          )
        );
      }
    }

    setIsProcessingAny(false);
    showNotification('🎉 批量智能压缩已全部完成！全部文件已按微信平台限制优化。');
  };

  // Batch compress only oversized items
  const handleCompressOversized = async () => {
    const oversized = items.filter(
      (i) =>
        i.status === 'done' &&
        i.result &&
        (i.result.size > 1024 * 1024 || (i.result.format === 'png' && i.result.size > 512 * 1024))
    );

    if (oversized.length === 0 || isProcessingAny) return;
    setIsProcessingAny(true);
    showNotification(`开始压缩 ${oversized.length} 个超标文件...`);

    for (const item of oversized) {
      const targetOptions: RemovalOptions = {
        ...item.options,
        compression: {
          enabled: true,
          preset: 'wechat-auto',
          targetSizeKb: item.mediaType === 'gif' ? 1000 : 500,
          maxColors: 128,
          scaleRatio: 1.0,
          frameStep: 1,
          autoCompressUnderLimit: true,
          ...item.options.compression,
        },
      };

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                options: targetOptions,
                status: 'processing',
                progress: 10,
                statusMessage: '正在压缩至微信规范...',
              }
            : i
        )
      );

      try {
        const result = await processMediaItem(
          item.file,
          targetOptions,
          (progress, message) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, progress, statusMessage: message } : i
              )
            );
          },
          item.cachedBuffer,
          item.cachedFrames
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'done',
                  progress: 100,
                  statusMessage: '完成',
                  result,
                }
              : i
          )
        );
      } catch (err: any) {
        console.error('Failed to compress oversized item:', item.name, err);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: err.message || '压缩失败',
                }
              : i
          )
        );
      }
    }

    setIsProcessingAny(false);
    showNotification('🎉 超标表情已全部压缩完毕，已符合微信平台上传规范！');
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      {/* Global Toast Notification */}
      {globalNotification && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-stone-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{globalNotification}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        {/* 顶部宣传 Banner：载入图片后自动隐藏以腾出 90px+ 垂直操作空间，同时支持用户手动切换展开/收起 */}
        {(!isRetouchImageLoaded || activeTab !== 'transparency' || transparencySubView !== 'retouch' || manualShowBanner) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#07c160] text-white flex items-center justify-center shadow-sm">
                <Smile className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-stone-900 leading-tight">
                    微信表情包一站式切片与全套审核物料生成器
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    6大物料自动生成 • 100%合规
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  多宫格视频切片 ➔ 240×240 GIF (&lt;500KB) ➔ 横幅/封面/图标/引导/致谢 ➔ 一键 ZIP 打包
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-500">
              <div className="hidden sm:flex items-center gap-1.5 text-stone-600 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>纯本地浏览器离线运算，安全隐私不过服务器</span>
              </div>
            </div>
          </div>
        )}

        {/* Three Tab Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-t border-stone-100 pt-1 -mb-px overflow-x-auto">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('suite_image')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'suite_image'
                    ? 'border-[#07c160] text-[#07c160]'
                    : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>静态表情（静态图多宫格切片）</span>
                {imageSlicedStickers.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
                    {imageSlicedStickers.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('suite_video')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'suite_video'
                    ? 'border-[#07c160] text-[#07c160]'
                    : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>动态表情（视频多宫格切片）</span>
                {slicedStickers.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
                    {slicedStickers.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('transparency')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'transparency'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>背景透明化与修图去水印</span>
                {items.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-mono">
                    {items.length}
                  </span>
                )}
                {retouchImageFile && (
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" title="画板有正在编辑的图片" />
                )}
              </button>
            </div>

            {/* 当处于修图画板且已载入图片时，显示微型横幅切换开关 */}
            {isRetouchImageLoaded && activeTab === 'transparency' && transparencySubView === 'retouch' && (
              <button
                type="button"
                onClick={() => setManualShowBanner((v) => !v)}
                className="shrink-0 ml-2 px-2.5 py-1 text-[11px] font-medium text-stone-500 hover:text-stone-800 rounded-md hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer whitespace-nowrap"
                title="已自动隐藏顶部横幅以最大化画板空间，可随时切换"
              >
                <span>{manualShowBanner ? '收起横幅' : '展开横幅'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 ${
        isRetouchImageLoaded && activeTab === 'transparency' && transparencySubView === 'retouch' ? 'py-1 sm:py-2' : 'py-6'
      }`}>
        {/* ======================================================== */}
        {/* TAB 1: 微信动态表情制作套件 (Multi-grid Video Slicer) */}
        {/* ======================================================== */}
        {activeTab === 'suite_video' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Step 1: Upload or Load Demo Video */}
            {!videoUrl ? (
              <div className="space-y-6">
                <GridVideoUploader
                  onVideoLoaded={handleVideoLoaded}
                  onImageDropped={handleImageLoaded}
                />

                {/* Workflow Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#07c160] flex items-center justify-center mb-3">
                      <Film className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      1. 多宫格智能对齐逐帧切片
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      支持 16、15、9、20 宫格及自定义排布，提供边缘内缩（Padding Inset）防穿帮与起止时间平滑修剪，强制按 240×240 标准抽帧。
                    </p>
                  </div>

                  <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      2. 自动生成 5 大官方审核物料
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      横幅 (750×400 实色无文字)、封面 (240×240 透明底)、图标 (50×50 微距特写)、赞赏引导 (750×560) 与赞赏致谢 (750×750)。
                    </p>
                  </div>

                  <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                      <FolderArchive className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      3. 一键微信规范 ZIP 打包导出
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      直接打包出官方规范目录树，全部 GIF 严格压缩于 500KB 以内，并附赠微信官方审核避坑对照表，无需改名直接上传！
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Grid Video Slicer Controls */
              <div className="space-y-6">
                <GridSlicerControls
                  videoUrl={videoUrl}
                  videoFile={videoFile!}
                  config={gridConfig}
                  onConfigChange={setGridConfig}
                  onStartSlice={handleStartSlice}
                  isSlicing={isSlicing}
                  sliceProgress={sliceProgress}
                  sliceStatusText={sliceStatusText}
                  onResetVideo={handleResetVideo}
                />

                {/* Sliced Stickers Grid Results */}
                {slicedStickers.length > 0 && (
                  <StickerGridResults
                    stickers={slicedStickers}
                    onImportAllToTab2={handleImportAllStickersToTab2}
                    onImportSingleToTab2={handleImportSingleStickerToTab2}
                    onSendToRetouch={handleSendStickerToRetouch}
                    onSetAsCover={handleCoverIndexChange}
                    onSetAsIcon={(idx) => handleIconOptionsChange({ ...iconOptions, selectedStickerIndex: idx })}
                    onSetAsGuide={handleRewardGuideIndexChange}
                    onSetAsThanks={handleRewardThanksIndexChange}
                    currentCoverIndex={coverIndex}
                    currentIconIndex={iconOptions.selectedStickerIndex}
                    currentGuideIndex={rewardGuideIndex}
                    currentThanksIndex={rewardThanksIndex}
                  />
                )}

                {/* 5 Official Derivative Materials Manager */}
                {slicedStickers.length > 0 && materials && (
                  <MaterialsManager
                    stickers={slicedStickers}
                    materials={materials}
                    bannerOptions={bannerOptions}
                    onBannerOptionsChange={handleBannerOptionsChange}
                    coverIndex={coverIndex}
                    onCoverIndexChange={handleCoverIndexChange}
                    iconOptions={iconOptions}
                    onIconOptionsChange={handleIconOptionsChange}
                    rewardGuideIndex={rewardGuideIndex}
                    onRewardGuideIndexChange={handleRewardGuideIndexChange}
                    rewardThanksIndex={rewardThanksIndex}
                    onRewardThanksIndexChange={handleRewardThanksIndexChange}
                    onRegenerateMaterials={handleRegenerateMaterials}
                    isGeneratingMaterials={isGeneratingMaterials}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: 微信静态图多宫格切片套件 (Static Image Slicer)   */}
        {/* ======================================================== */}
        {activeTab === 'suite_image' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {!imageUrl ? (
              <div className="space-y-6">
                <GridImageUploader
                  onImageLoaded={handleImageLoaded}
                  onVideoDropped={handleVideoLoaded}
                />

                {/* Workflow Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#07c160] flex items-center justify-center mb-3">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      1. 静态多宫格智能对齐裁切
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      支持拖拽调节裁切区域避开顶部/底部黑边，自适应 16/15/9 宫格，一键切成 240×240 微信官方标准静态表情。
                    </p>
                  </div>

                  <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      2. 自动透明化与 2px 白边
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      一键智能去除白底或纯色背景，自动添加微信官方审核强推的 2px 白色描边，防止深色模式聊天背景下表情被吞。
                    </p>
                  </div>

                  <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                      <FolderArchive className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      3. 同步生成 5 大官方审核物料
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      根据切出的静态表情，自动同步生成 750×400 横幅、240×240 封面、50×50 图标及赞赏图，一键导出完整规范 ZIP 包。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Grid Image Slicer Controls */
              <div className="space-y-6">
                <GridImageSlicerControls
                  imageUrl={imageUrl}
                  imageFile={imageFile!}
                  config={imageGridConfig}
                  onConfigChange={setImageGridConfig}
                  onStartSlice={handleStartImageSlice}
                  onSendToRetouch={handleSendToRetouch}
                  isSlicing={isImageSlicing}
                  sliceProgress={imageSliceProgress}
                  sliceStatusText={imageSliceStatusText}
                  onResetImage={handleResetImage}
                />

                {/* Sliced Stickers Grid Results */}
                {imageSlicedStickers.length > 0 && (
                  <StickerGridResults
                    stickers={imageSlicedStickers}
                    onImportAllToTab2={handleImportAllImageStickersToTab3}
                    onImportSingleToTab2={handleImportSingleImageStickerToTab3}
                    onSendToRetouch={handleSendStickerToRetouch}
                    onSetAsCover={handleImageCoverIndexChange}
                    onSetAsIcon={(idx) => handleImageIconOptionsChange({ ...imageIconOptions, selectedStickerIndex: idx })}
                    onSetAsGuide={handleImageRewardGuideIndexChange}
                    onSetAsThanks={handleImageRewardThanksIndexChange}
                    currentCoverIndex={imageCoverIndex}
                    currentIconIndex={imageIconOptions.selectedStickerIndex}
                    currentGuideIndex={imageRewardGuideIndex}
                    currentThanksIndex={imageRewardThanksIndex}
                  />
                )}

                {/* 5 Official Derivative Materials Manager */}
                {imageSlicedStickers.length > 0 && imageMaterials && (
                  <MaterialsManager
                    stickers={imageSlicedStickers}
                    materials={imageMaterials}
                    bannerOptions={imageBannerOptions}
                    onBannerOptionsChange={handleImageBannerOptionsChange}
                    coverIndex={imageCoverIndex}
                    onCoverIndexChange={handleImageCoverIndexChange}
                    iconOptions={imageIconOptions}
                    onIconOptionsChange={handleImageIconOptionsChange}
                    rewardGuideIndex={imageRewardGuideIndex}
                    onRewardGuideIndexChange={handleImageRewardGuideIndexChange}
                    rewardThanksIndex={imageRewardThanksIndex}
                    onRewardThanksIndexChange={handleImageRewardThanksIndexChange}
                    onRegenerateMaterials={handleRegenerateImageMaterials}
                    isGeneratingMaterials={isImageGeneratingMaterials}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: 背景透明化与修图去水印 (Integrated Transparency & Retouch) */}
        {/* ======================================================== */}
        {activeTab === 'transparency' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top link notice to return to Tab 1 / Tab 2 if sliced items exist */}
            {(slicedStickers.length > 0 || imageSlicedStickers.length > 0) && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-[#07c160]" />
                  <span>
                    您已在切片套件中生成了表情切片（动态: {slicedStickers.length} 个 / 静态: {imageSlicedStickers.length} 个），随时可返回一键打包全套物料
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {slicedStickers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('suite_video')}
                      className="px-3 py-1 bg-white hover:bg-emerald-100 text-[#07c160] font-bold rounded-lg border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>返回视频切片套件</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {imageSlicedStickers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('suite_image')}
                      className="px-3 py-1 bg-white hover:bg-emerald-100 text-[#07c160] font-bold rounded-lg border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>返回静态图切片套件</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sub-view Switcher: 批量透明化与压缩列表 VS 精细修图去水印与局部透底画板 */}
            <div className={`flex items-center justify-between bg-white border border-stone-200 shadow-2xs flex-wrap gap-2 transition-all ${
              transparencySubView === 'retouch' ? 'p-1.5 rounded-xl' : 'p-2.5 rounded-2xl'
            }`}>
              <div className="flex items-center gap-1.5 p-1 bg-stone-100/90 border border-stone-200/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransparencySubView('batch')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
                    transparencySubView === 'batch'
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/25'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <Sliders className={`w-4 h-4 ${transparencySubView === 'batch' ? 'text-white' : 'text-stone-400'}`} />
                  <span>批量透明化与压缩列表</span>
                  {items.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      transparencySubView === 'batch' ? 'bg-indigo-700 text-white' : 'bg-stone-200 text-stone-700'
                    }`}>
                      {items.length}
                    </span>
                  )}
                  {transparencySubView === 'batch' && (
                    <span className="text-[10px] bg-indigo-500/80 text-white px-1.5 py-0.5 rounded font-medium ml-0.5">
                      当前视图
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTransparencySubView('retouch')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
                    transparencySubView === 'retouch'
                      ? 'bg-pink-600 text-white shadow-sm ring-2 ring-pink-600/25'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${transparencySubView === 'retouch' ? 'text-white' : 'text-stone-400'}`} />
                  <span>精细修图去水印与局部透底画板</span>
                  {retouchImageFile && (
                    <span className={`w-2 h-2 rounded-full ${transparencySubView === 'retouch' ? 'bg-white' : 'bg-pink-500'} animate-pulse`} />
                  )}
                  {transparencySubView === 'retouch' && (
                    <span className="text-[10px] bg-pink-500/80 text-white px-1.5 py-0.5 rounded font-medium ml-0.5">
                      当前视图
                    </span>
                  )}
                </button>
              </div>

              <div className="text-xs text-stone-500 flex items-center gap-2 pr-2">
                {transparencySubView === 'batch' ? (
                  <span className="hidden sm:inline">💡 针对单张图需局部抹除水印或边缘精修，可点击卡片上的「去水印/修图」画笔或切换至画板</span>
                ) : (
                  <span className="hidden md:inline text-stone-400">💡 圈选或涂抹快速消除水印，处理完可一键同步回列表或送往切片</span>
                )}
              </div>
            </div>

            {/* Sub-view 1: 精细修图去水印与透底画板 */}
            {transparencySubView === 'retouch' && (
              <div className="space-y-2">
                <ImageRetouchWorkspace
                  initialFile={retouchImageFile}
                  onSyncToBatch={handleRetouchSyncToBatch}
                  onSendToStaticSlicer={handleRetouchSendToStaticSlicer}
                  onSendToTransparency={handleRetouchSendToTransparency}
                  onImageLoadedStateChange={setIsRetouchImageLoaded}
                  showToast={showNotification}
                />
              </div>
            )}

            {/* Sub-view 2: 批量透明化与压缩列表 */}
            {transparencySubView === 'batch' && (
              <div className="space-y-6">
                {/* Upload Zone */}
                <UploadZone
                  onFilesSelected={handleFilesSelected}
                  disabled={isProcessingAny}
                />

                {/* If items exist: Batch Controls + Grid of GIF cards */}
                {items.length > 0 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <BatchControls
                      items={items}
                      isProcessingAny={isProcessingAny}
                      onProcessAll={handleProcessAll}
                      onCompressAll={handleCompressAll}
                      onCompressOversized={handleCompressOversized}
                      onDownloadAllZip={handleDownloadAllZip}
                      onClearAll={handleClearAll}
                      onApplyGlobalOptions={handleApplyGlobalOptions}
                      previewBg={previewBg}
                      onPreviewBgChange={setPreviewBg}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {items.map((item) => (
                        <GifCard
                          key={item.id}
                          item={item}
                          previewBg={previewBg}
                          onUpdateOptions={handleUpdateOptions}
                          onProcessItem={handleProcessItem}
                          onDeleteItem={handleDeleteItem}
                          onSendToRetouch={(file) => handleSendMediaFileToRetouch(file, item.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state hints */}
                {items.length === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-stone-900 mb-1">
                        边缘向内泛洪消除算法
                      </h4>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        智能从画面四周边缘向内扩散抠图，完整保护人物眼白、高光与衣服内部白色图案。
                      </p>
                    </div>

                    <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                        <Smile className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-stone-900 mb-1">
                        微信标准 2px 白色描边
                      </h4>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        自适应 240×240 缩放并生成均匀外轮廓白边，在微信深色和浅色聊天背景中均清晰呈现。
                      </p>
                    </div>

                    <div className="bg-white p-4.5 rounded-xl border border-stone-200 shadow-2xs">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                        <Type className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-stone-900 mb-1">
                        文字配字与黑色描边
                      </h4>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        支持在动图下方或上方添加粗体字，配备深色反衬描边，聊天传情生动有趣。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-stone-200 bg-white text-center text-xs text-stone-400">
        <p>
          微信表情包一站式切片与全套审核物料生成器 • 严格遵循 240×240 / &lt;500KB / 750×400横幅 / 50×50图标 / 赞赏引导与致谢规范 • 纯本地离线运算
        </p>
      </footer>
    </div>
  );
}
