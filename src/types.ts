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
  eraseOriginalBottomText?: boolean; // 自动擦除原图底部旧文字区（防旧字重叠）
}

export type CompressionPreset = 'original' | 'wechat-auto' | 'wechat-1mb' | 'wechat-500kb' | 'light-300kb' | 'custom';

export interface ArbitrarySizeOptions {
  enabled?: boolean; // 是否启用尺寸重设/自定规格
  mode: 'original' | 'wechat' | 'scale' | 'custom'; // original=原尺寸, wechat=微信240x240, scale=百分比, custom=自定义像素
  scalePercent: number; // 缩放百分比 (100, 85, 75, 50, 25)
  customWidth: number; // 目标宽度 px
  customHeight: number; // 目标高度 px
  lockAspectRatio: boolean; // 是否锁定原始宽高比
  fitMode?: 'contain' | 'cover' | 'stretch'; // contain=等比居中留白(防裁切), stretch=自由拉伸, cover=填充裁剪
}

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
  enableRemoval?: boolean; // 是否启用抠图与去底 (默认为 true, 取消勾选则不扣除背景直接保留原底色)
  removalMethod?: 'color' | 'ai'; // 'color' for eyedropper/chroma key, 'ai' for neural subject matting
  targetColor: string; // Hex string e.g. "#ffffff"
  targetColors?: string[]; // Multiple target colors support (e.g. simultaneous multi-selection)
  tolerance: number; // 0 to 100
  contiguous: boolean; // Only remove from edges (flood fill)
  defringe: number; // 0 to 3 pixels erosion/defringe
  edgeBarrier?: boolean; // 智能边缘阻隔：利用灰度梯度阻断穿透，防止容差过大误删人物/衣服 (默认开启)
  edgeThreshold?: number; // 边缘敏感度 (10 ~ 40, 默认 20)
  protectTorsoBottom?: boolean; // 保护底部躯干不被底边洪水填充穿透
  removeFrameBorder?: boolean; // 一键去除正方形黑框/彩色框线
  frameBorderMode?: 'auto' | 'black' | 'color' | 'inset'; // 去框模式: auto=智能全自动, black=去黑框, color=去彩色框, inset=内缩切除
  frameBorderColor?: string; // 框线目标颜色 (默认 '#000000')
  frameBorderColors?: string[]; // 累计已消除的多处/多种框线颜色 (支持连续点击点选，互不覆盖)
  frameBorderTolerance?: number; // 框线容差 0 - 100 (默认 35)
  frameBorderWidth?: number; // 框线消除厚度 1 - 12px (默认 3)
  frameBorderInset?: number; // 边缘安全内缩切除 0 - 8px (默认 2)
  frameBorderAutoScale?: boolean; // 是否自动裁剪至内框并自适应填充 240x240 (默认 true)
  wechat?: WeChatStickerOptions; // WeChat Sticker formatting options (白色描边与文字等微信规范)
  sizeConfig?: ArbitrarySizeOptions; // 导出任意图片尺寸规格 (自定义宽高、百分比、微信或原始)
  compression?: CompressionOptions; // 微信平台/自定义体积压缩参数
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
  isAiMatting?: boolean; // 是否采用 AI 智能人物主体分割
}

export type ProcessStatus = 'idle' | 'processing' | 'done' | 'error';

export type MediaType = 'gif' | 'image';

export interface GifItem {
  id: string;
  name: string;
  file: File;
  cachedBuffer?: ArrayBuffer;
  cachedFrames?: FrameInfo[];
  aiTransparentFrames?: FrameInfo[]; // 缓存 AI 抠图后的透明帧数据
  aiMattingStatus?: 'idle' | 'processing' | 'done' | 'error';
  aiMattingMessage?: string;
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
  bgColors?: string[]; // Multiple target background colors for simultaneous multi-point removal
  tolerance: number; // 0 - 100
  addWhiteOutline: boolean; // 2px white outline
  outlineWidth: number; // default 2
  lockSquare?: boolean; // Lock 1:1 square ratio for each cell (default true)
  transparentBorders?: boolean; // Ensure all unselected/padded border areas output as transparent (default true)
  loopMode?: 'normal' | 'boomerang' | 'crossfade'; // AI 动图循环模式: normal=常规, boomerang=往返首尾丝滑, crossfade=交叉淡入
  smartAutoCenter?: boolean; // AI 主体智能检测并居中对齐 (解决 AI 多宫格偏心忽大忽小)
  subjectScaleTarget?: number; // AI 主体画面占比 (例如 0.82 即 82%，保留微信安全边距)
  removeFrameBorder?: boolean; // 一键去除正方形黑框/彩色框线 (默认可选开启)
  frameBorderMode?: 'auto' | 'black' | 'color' | 'inset'; // 去框模式: auto=智能全自动, black=去黑框, color=去彩色框, inset=内缩切除
  frameBorderColor?: string; // 框线目标颜色 (默认 '#000000')
  frameBorderColors?: string[]; // 累计已消除的多处/多种框线颜色 (支持连续点击点选，互不覆盖)
  frameBorderTolerance?: number; // 框线容差 0 - 100 (默认 35)
  frameBorderWidth?: number; // 框线消除厚度 1 - 12px (默认 3)
  frameBorderInset?: number; // 边缘安全内缩切除 0 - 8px (默认 2)
  frameBorderAutoScale?: boolean; // 是否自动裁剪至内框并自适应填充 240x240 (默认 true)
  frameEraserMaskUrl?: string; // 画笔涂抹消框蒙版 (PNG DataURL，非透明像素表示已抹除)
  frameEraserSyncAllCells?: boolean; // 涂抹消框是否同步应用至全图所有格子 (默认 true)
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
  bgColors?: string[]; // Multiple target background colors for simultaneous multi-point removal
  tolerance: number; // 0 - 100
  addWhiteOutline: boolean; // 2px white outline
  outlineWidth: number; // default 2
  outputFormat: 'png' | 'gif'; // default 'png' (240x240 PNG is WeChat static sticker official standard)
  lockSquare?: boolean; // Lock 1:1 square ratio for each cell (default true)
  transparentBorders?: boolean; // Ensure all unselected/padded border areas output as transparent (default true)
  smartAutoCenter?: boolean; // AI 主体智能检测并居中对齐 (解决 AI 九宫格/16格偏心忽大忽小)
  subjectScaleTarget?: number; // AI 主体画面占比 (默认 0.82 即 82%)
  removeFrameBorder?: boolean; // 一键去除正方形黑框/彩色框线
  frameBorderMode?: 'auto' | 'black' | 'color' | 'inset'; // 去框模式: auto=智能全自动, black=去黑框, color=去彩色框, inset=内缩切除
  frameBorderColor?: string; // 框线目标颜色 (默认 '#000000')
  frameBorderColors?: string[]; // 累计已消除的多处/多种框线颜色 (支持连续点击点选，互不覆盖)
  frameBorderTolerance?: number; // 框线容差 0 - 100 (默认 35)
  frameBorderWidth?: number; // 框线消除厚度 1 - 12px (默认 3)
  frameBorderInset?: number; // 边缘安全内缩切除 0 - 8px (默认 2)
  frameBorderAutoScale?: boolean; // 是否自动裁剪至内框并自适应填充 240x240 (默认 true)
  frameEraserMaskUrl?: string; // 画笔涂抹消框蒙版 (PNG DataURL，非透明像素表示已抹除)
  frameEraserSyncAllCells?: boolean; // 涂抹消框是否同步应用至全图所有格子 (默认 true)
}

export interface SlicedStickerItem {
  index: number; // 1 to N
  name: string; // e.g. '01_T.gif'
  row: number;
  col: number;
  blob: Blob;
  url: string;
  rawBlob?: Blob; // 原始未处理切片备份 (去框/去底叠加时防止还原或多次重复剪裁退化)
  rawUrl?: string;
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
  | 'clone-stamp'       // 仿制图章 (取样仿制纹理与图案)
  | 'brush-transparent' // 涂抹擦除透底 (直接消抹为透明)
  | 'brush-restore'     // 消除透底 / 涂抹恢复原图 (将透明底恢复为不透明原图)
  | 'rect-transparent'  // 矩形框选清除透底 (直接消抹为透明)
  | 'color-transparent' // 吸管点除去背景 (直接消抹为透明)
  | 'text'              // 表情包配字/重新打字 (自定义文字、字号、颜色、粗黑描边)
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
  pickedColors?: string[];      // 多选吸色列表 (支持同时选中多种底色)
  whiteOutlinePreview?: boolean;// 微信 2px 白描边实时叠加预览
  cloneStampSize?: number;      // 仿制图章粗细 2px ~ 120px
  cloneStampFeather?: number;   // 仿制图章羽化柔边 0% ~ 100%
  cloneStampOpacity?: number;   // 仿制图章不透明度 10% ~ 100%
  cloneStampAligned?: boolean;  // 仿制图章连续对齐模式 (true=相对位移对齐)
  // Text Tool options
  textString?: string;          // 当前输入的文字内容
  textFontSize?: number;        // 文字大小 (14 - 48px)
  textColor?: string;           // 文字颜色 (默认 '#ffffff')
  textStrokeColor?: string;     // 文字描边颜色 (默认 '#000000')
  textStrokeWidth?: number;     // 描边粗细 (0 - 6px)
  textPosition?: 'bottom' | 'top' | 'custom'; // 文字位置
  textCustomX?: number;         // 自定义 X 坐标
  textCustomY?: number;         // 自定义 Y 坐标
}

// -----------------------------------------------------------------
// ID Photo (证件照) Types
// -----------------------------------------------------------------
export type IdPhotoPresetKey =
  | '1-inch'       // 标准 1 寸 (25x35mm -> 295x413px @ 300DPI)
  | 'small-1-inch' // 小 1 寸 (22x32mm -> 260x378px @ 300DPI)
  | 'large-1-inch' // 大 1 寸 (33x48mm -> 390x567px @ 300DPI)
  | '2-inch'       // 标准 2 寸 (35x49mm -> 413x579px @ 300DPI)
  | 'small-2-inch' // 小 2 寸 / 护照 (35x45mm -> 413x531px @ 300DPI)
  | 'large-2-inch' // 大 2 寸 (35x53mm -> 413x626px @ 300DPI)
  | 'gwy'          // 国家公务员报名 (35x45mm, <20KB / <50KB)
  | 'ky'           // 全国研究生入学考试 (480x640px)
  | 'cet'          // 英语四六级考试 (240x320px)
  | 'teacher'      // 教师资格证 (295x413px, <200KB)
  | 'driver'       // 机动车驾驶证 (22x32mm -> 260x378px)
  | 'custom';      // 自定义尺寸

export interface IdPhotoPresetSpec {
  key: IdPhotoPresetKey;
  name: string;
  category: 'common' | 'exam' | 'visa' | 'custom';
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
  description: string;
  recommendedSizeKb?: number;
}

export type IdPhotoBgType = 'transparent' | 'color' | 'gradient';

export interface IdPhotoState {
  file: File | null;
  originalUrl: string | null;
  transparentUrl: string | null;
  transparentBlob: Blob | null;
  transparentImageData: ImageData | null;
  isMatting: boolean;
  mattingProgress: number;
  mattingMessage: string;
}

