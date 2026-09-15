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

export interface RemovalOptions {
  targetColor: string; // Hex string e.g. "#ffffff"
  tolerance: number; // 0 to 100
  contiguous: boolean; // Only remove from edges (flood fill)
  defringe: number; // 0 to 3 pixels erosion/defringe
  wechat?: WeChatStickerOptions; // WeChat Sticker formatting options
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
}

export type ProcessStatus = 'idle' | 'processing' | 'done' | 'error';

export type MediaType = 'gif' | 'image';

export interface GifItem {
  id: string;
  name: string;
  file: File;
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
