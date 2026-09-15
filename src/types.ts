export interface RemovalOptions {
  targetColor: string; // Hex string e.g. "#ffffff"
  tolerance: number; // 0 to 100
  contiguous: boolean; // Only remove from edges (flood fill)
  defringe: number; // 0 to 3 pixels erosion/defringe
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
}

export type ProcessStatus = 'idle' | 'processing' | 'done' | 'error';

export interface GifItem {
  id: string;
  name: string;
  file: File;
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

export type PreviewBgMode = 'checker' | 'checker-dark' | 'white' | 'dark' | 'neon';
