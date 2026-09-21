export interface WeChatStickerOptions {
  enabled: boolean; // whether to generate WeChat sticker format
  standardSize: '240' | 'max240' | 'original'; // 240x240 standard square, max 240px, or original
  addWhiteOutline: boolean; // WeChat official spec: 2px white outline for dark-mode visibility
  outlineWidth: number; // 1 - 4px (default 2px)
  outlineColor: string; // default '#ffffff'
  captionText?: string; // optional sticker text e.g. "收到", "点赞"
  captionPosition?: 'bottom' | 'top'; // default 'bottom'
  captionColor?: string; // default '#ffffff'
  captionStrokeColor?: string; // default '#000000'
  captionFontSize?: number; // 14 - 32px (default 22)
}

export type CompressionPreset = 'wechat-auto' | 'wechat-1mb' | 'wechat-500kb' | 'light-300kb' | 'custom';

export interface CompressionOptions {
  enabled: boolean; // 是否启用压缩 (默认开启)
  preset: CompressionPreset; // 预设模式
  targetSizeKb: number; // 目标体积限制 (KB)，如 1000 (微信动图上限 1MB) 或 500 (微信静态表情 500KB)
  maxColors: number; // 调色板颜色数 (32, 64, 128, 256)
  scaleRatio: number; // 画面缩放比例 (0.5 ~ 1.0)
  frameStep: number; // 动图抽帧步长：1=全帧，2=隔帧采样(延时相应翻倍保证播放速度不变，体积立减~50%)
  autoCompressUnderLimit: boolean; // 超出目标大小时自动多轮智能压缩至符合微信平台限制
}

export interface RemovalOptions {
  targetColor: string; // Hex string e.g. "#ffffff"
  tolerance: number; // 0 to 100
  contiguous: boolean; // Only remove from edges (flood fill)
  defringe: number; // 0 to 3 pixels erosion/defringe
  wechat?: WeChatStickerOptions; // WeChat Sticker formatting options
  compression?: CompressionOptions; // 微信平台体积压缩参数
}

export interface FrameInfo {
  imageData: ImageData;
  delay: number;
}

export interface ProcessedGifResult {
  blob: Blob;
  url: string;
  size: number;
  frameCount: number;
  width: number;
  height: number;
  format?: 'gif' | 'png';
  isWeChatSticker?: boolean;
  originalSize?: number;
  compressionRatio?: number; // 压缩减小百分比 (e.g. 68% saved)
  passedWeChatLimit?: boolean; // 是否符合微信平台上传限制 (动图<=1000KB, 静态图<=500KB)
  compressionSummary?: string; // 压缩详情说明
}

export type ProcessStatus = 'idle' | 'processing' | 'done' | 'error';

export type MediaType = 'gif' | 'image';

export interface GifItem {
  id: string;
  name: string;
  file: File;
  cachedBuffer?: ArrayBuffer;
  cachedFrames?: FrameInfo[];
  mediaType: MediaType;
  originalUrl: string;
  originalSize: number;
  width: number;
  height: number;
  frameCount: number;
  detectedBgColor: string;
  options: RemovalOptions;
  status: ProcessStatus;
  progress: number; // 0 to 100
  statusMessage?: string;
  result?: ProcessedGifResult;
  errorMessage?: string;
}

export type PreviewBgMode = 'checker' | 'checker-dark' | 'white' | 'dark' | 'neon' | 'wechat-chat' | 'wechat-dark';

export type GridPreset = '16' | '15' | '9' | '20' | 'custom';

export type SlicerLayoutMode = 'grid' | 'independent';

export interface GridCropArea {
  x: number; // 0 to 100 (% of video/image width)
  y: number; // 0 to 100 (% of video/image height)
  width: number; // 5 to 100 (% of video/image width)
  height: number; // 5 to 100 (% of video/image height)
}

export interface CellOverride {
  dx?: number; // X offset in natural pixels (positive = right, negative = left)
  dy?: number; // Y offset in natural pixels (positive = down, negative = up)
  dw?: number; // Width delta in natural pixels
  dh?: number; // Height delta in natural pixels
}

export interface GridConfig {
  preset: GridPreset;
  layoutMode?: SlicerLayoutMode; // 'grid' (linked N-grid) | 'independent' (N separate individual boxes)
  cols: number;
  rows: number;
  cropArea: GridCropArea; // Manual adjustable region for grid cropping
  independentBoxes?: Record<number, GridCropArea>; // per-cell independent { x, y, width, height } in 0..100% of media
  colSplits?: number[]; // [0..1] normalized positions of internal vertical dividers (length cols - 1)
  rowSplits?: number[]; // [0..1] normalized positions of internal horizontal dividers (length rows - 1)
  cellOverrides?: Record<number, CellOverride>; // per-cell fine-tune offsets keyed by cell index (0..totalCells-1)
  paddingInset: number; // 0 to 12 px margin inside each cell to avoid bleed
  startTime: number; // trim start in seconds
  endTime: number; // trim end in seconds
  speed: number; // playback speed multiplier (e.g. 1.0, 1.25, 1.5, 2.0, default 1.0)
  fps: number; // 8 - 15 fps (default 10)
  autoTransparent: boolean; // remove background color
  bgColor: string; // target background color (default '#ffffff')
  tolerance: number; // 0 - 100
  addWhiteOutline: boolean; // 2px white outline
  outlineWidth: number; // default 2
  lockSquare?: boolean; // Lock 1:1 square ratio for each cell (default true)
  transparentBorders?: boolean; // Ensure all unselected/padded border areas output as transparent (default true)
  loopMode?: 'normal' | 'boomerang' | 'crossfade'; // AI 动图循环模式: normal=常规, boomerang=往返首尾丝滑, crossfade=交叉淡入
  smartAutoCenter?: boolean; // AI 主体智能检测并居中对齐 (解决 AI 多宫格偏心忽大忽小)
  subjectScaleTarget?: number; // AI 主体画面占比 (例如 0.82 即 82%，保留微信安全边距)
}

export interface ImageGridConfig {
  preset: GridPreset;
  layoutMode?: SlicerLayoutMode; // 'grid' | 'independent'
  cols: number;
  rows: number;
  cropArea: GridCropArea; // Manual adjustable region for grid cropping
  independentBoxes?: Record<number, GridCropArea>; // per-cell independent { x, y, width, height } in 0..100% of media
  colSplits?: number[]; // [0..1] normalized positions of internal vertical dividers (length cols - 1)
  rowSplits?: number[]; // [0..1] normalized positions of internal horizontal dividers (length rows - 1)
  cellOverrides?: Record<number, CellOverride>; // per-cell fine-tune offsets keyed by cell index (0..totalCells-1)
  paddingInset: number; // 0 to 12 px margin inside each cell to avoid bleed
  autoTransparent: boolean; // remove background color
  bgColor: string; // target background color (default '#ffffff')
  tolerance: number; // 0 - 100
  addWhiteOutline: boolean; // 2px white outline
  outlineWidth: number; // default 2
  outputFormat: 'png' | 'gif'; // default 'png' (240x240 PNG is WeChat static sticker official standard)
  lockSquare?: boolean; // Lock 1:1 square ratio for each cell (default true)
  transparentBorders?: boolean; // Ensure all unselected/padded border areas output as transparent (default true)
  smartAutoCenter?: boolean; // AI 主体智能检测并居中对齐 (解决 AI 九宫格/16格偏心忽大忽小)
  subjectScaleTarget?: number; // AI 主体画面占比 (默认 0.82 即 82%)
}

export interface SlicedStickerItem {
  index: number; // 1 to N
  name: string; // e.g. '01_T.gif'
  row: number;
  col: number;
  blob: Blob;
  url: string;
  size: number;
  width: number;
  height: number;
  frameCount: number;
  duration: number;
  representativeFrameData: ImageData;
  representativeDataUrl: string;
}

export interface BannerOptions {
  themeColor: string; // background color
  colorPreset: string;
  selectedStickerIndices: number[]; // 2 or 3 stickers to display horizontally
}

export interface IconOptions {
  selectedStickerIndex: number;
  zoom: number; // 1.0 - 2.2
  offsetY: number; // -30 to 30 %
}

export interface MaterialItemInfo {
  name: string;
  typeCode: string;
  fileName: string;
  format: 'png' | 'gif' | 'jpg';
  width: number;
  height: number;
  sizeLimitStr: string;
  sizeLimitBytes: number;
  blob?: Blob;
  url?: string;
  size?: number;
  auditPassed: boolean;
  auditDetails: string[];
}

export interface WeChatMaterialsState {
  banner: MaterialItemInfo;
  cover: MaterialItemInfo;
  icon: MaterialItemInfo;
  rewardGuide: MaterialItemInfo;
  rewardThanks: MaterialItemInfo;
}

// -----------------------------------------------------------------
// Image Retouch & Watermark Removal Types
// -----------------------------------------------------------------
export type RetouchTool =
  | 'brush-remove'      // 智能涂抹消除 (纹理修复)
  | 'rect-remove'       // 矩形圈选消除 (纹理修复)
  | 'lasso-remove'      // 自由套索圈选消除 (纹理修复)
  | 'brush-transparent' // 涂抹擦除透底 (直接消抹为透明)
  | 'brush-restore'     // 消除透底 / 涂抹恢复原图 (将透明底恢复为不透明原图)
  | 'rect-transparent'  // 矩形框选清除透底 (直接消抹为透明)
  | 'color-transparent' // 吸管点除去背景 (直接消抹为透明)
  | 'mosaic'            // 像素马赛克打码
  | 'blur'              // 柔和毛玻璃模糊打码
  | 'eraser'            // 选区橡皮擦 (修正涂抹蒙版)
  | 'pan';              // 抓手平移移动画布

export interface RetouchOptions {
  tool: RetouchTool;
  brushSize: number;            // 4px ~ 120px
  eraserSize: number;           // 4px ~ 120px
  mosaicSize: number;           // 4px ~ 64px 像素块颗粒度
  blurRadius: number;           // 2px ~ 30px 高斯模糊半径
  mosaicStyle: 'pixel' | 'blur';// 像素马赛克 vs 毛玻璃
  autoFeather: boolean;         // 边缘平滑自适应羽化
  colorTolerance?: number;      // 吸管去底容差 (0 - 100)
  contiguous?: boolean;         // 仅清除连通边缘 (保护主体内部)
  whiteOutlinePreview?: boolean;// 微信 2px 白描边实时叠加预览
}

