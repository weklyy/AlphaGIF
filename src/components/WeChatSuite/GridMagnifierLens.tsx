import React, { useEffect, useRef } from 'react';
import { ZoomIn, Square, CheckCheck } from 'lucide-react';

export interface MagnifierData {
  active: boolean;
  clientX: number;
  clientY: number;
  focalNormX: number; // 0 - 100%
  focalNormY: number; // 0 - 100%
  handle: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e';
  cellIndex: number;
  boxPixelW: number;
  boxPixelH: number;
  isSquare: boolean;
}

interface GridMagnifierLensProps {
  data: MagnifierData | null;
  sourceElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
  sourceWidth: number;
  sourceHeight: number;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
}

const HANDLE_LABELS: Record<string, string> = {
  nw: '左上角 (NW)',
  ne: '右上角 (NE)',
  se: '右下角 (SE)',
  sw: '左下角 (SW)',
  n: '上边缘 (N)',
  s: '下边缘 (S)',
  w: '左边缘 (W)',
  e: '右边缘 (E)',
  move: '整体移动',
};

const LENS_SIZE = 192; // 192x192 px canvas

export const GridMagnifierLens: React.FC<GridMagnifierLensProps> = ({
  data,
  sourceElement,
  sourceWidth,
  sourceHeight,
  zoomLevel = 3.5,
  onZoomChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render loop to keep the magnified view updated with the video/image frame
  useEffect(() => {
    if (!data || !data.active || !sourceElement) return;

    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const vidW = sourceWidth || 960;
      const vidH = sourceHeight || 960;

      // Focal coordinate in source pixels
      const focalX = Math.round((data.focalNormX / 100) * vidW);
      const focalY = Math.round((data.focalNormY / 100) * vidH);

      const zoom = Math.max(1.5, Math.min(6, zoomLevel));
      const sampleW = LENS_SIZE / zoom;
      const sampleH = LENS_SIZE / zoom;

      const srcLeft = focalX - sampleW / 2;
      const srcTop = focalY - sampleH / 2;

      // 1. Clear background with subtle checkered pattern for transparency/out-of-bounds
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, LENS_SIZE, LENS_SIZE);

      // 2. Draw zoomed image/video slice (nearest-neighbor pixelated for max clarity)
      ctx.imageSmoothingEnabled = false;

      const clampSrcX = Math.max(0, srcLeft);
      const clampSrcY = Math.max(0, srcTop);
      const clampSrcRight = Math.min(vidW, srcLeft + sampleW);
      const clampSrcBottom = Math.min(vidH, srcTop + sampleH);

      const actualW = clampSrcRight - clampSrcX;
      const actualH = clampSrcBottom - clampSrcY;

      if (actualW > 0 && actualH > 0) {
        const destX = (clampSrcX - srcLeft) * zoom;
        const destY = (clampSrcY - srcTop) * zoom;
        const destW = actualW * zoom;
        const destH = actualH * zoom;

        try {
          ctx.drawImage(sourceElement, clampSrcX, clampSrcY, actualW, actualH, destX, destY, destW, destH);
        } catch {
          // Ignore transient draw errors if video is seeking
        }
      }

      // 3. Draw sub-pixel grid lines if zoomed enough (helps see pixel boundaries)
      if (zoom >= 3.0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        const startSubX = (Math.ceil(srcLeft) - srcLeft) * zoom;
        for (let x = startSubX; x < LENS_SIZE; x += zoom) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, LENS_SIZE);
          ctx.stroke();
        }
        const startSubY = (Math.ceil(srcTop) - srcTop) * zoom;
        for (let y = startSubY; y < LENS_SIZE; y += zoom) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(LENS_SIZE, y);
          ctx.stroke();
        }
      }

      const cx = LENS_SIZE / 2;
      const cy = LENS_SIZE / 2;

      // 4. Highlight excluded/cut-out regions with a dark semi-transparent mask
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      const h = data.handle;
      if (h === 'nw') {
        // Outside is left and top
        ctx.fillRect(0, 0, cx, LENS_SIZE);
        ctx.fillRect(cx, 0, LENS_SIZE - cx, cy);
      } else if (h === 'ne') {
        // Outside is right and top
        ctx.fillRect(cx, 0, LENS_SIZE - cx, LENS_SIZE);
        ctx.fillRect(0, 0, cx, cy);
      } else if (h === 'se') {
        // Outside is right and bottom
        ctx.fillRect(cx, 0, LENS_SIZE - cx, LENS_SIZE);
        ctx.fillRect(0, cy, cx, LENS_SIZE - cy);
      } else if (h === 'sw') {
        // Outside is left and bottom
        ctx.fillRect(0, 0, cx, LENS_SIZE);
        ctx.fillRect(cx, cy, LENS_SIZE - cx, LENS_SIZE - cy);
      } else if (h === 'n') {
        ctx.fillRect(0, 0, LENS_SIZE, cy);
      } else if (h === 's') {
        ctx.fillRect(0, cy, LENS_SIZE, LENS_SIZE - cy);
      } else if (h === 'w') {
        ctx.fillRect(0, 0, cx, LENS_SIZE);
      } else if (h === 'e') {
        ctx.fillRect(cx, 0, LENS_SIZE - cx, LENS_SIZE);
      }

      // 5. Draw high-contrast cutting boundary lines
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;

      // Outer glowing guideline
      ctx.strokeStyle = '#fbbf24'; // Amber-400
      ctx.lineWidth = 2;

      if (h === 'nw') {
        // Top edge: to the right of center; Left edge: down from center
        ctx.beginPath();
        ctx.moveTo(cx, LENS_SIZE);
        ctx.lineTo(cx, cy);
        ctx.lineTo(LENS_SIZE, cy);
        ctx.stroke();
      } else if (h === 'ne') {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, LENS_SIZE);
        ctx.stroke();
      } else if (h === 'se') {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, 0);
        ctx.stroke();
      } else if (h === 'sw') {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, cy);
        ctx.lineTo(LENS_SIZE, cy);
        ctx.stroke();
      } else if (h === 'n' || h === 's') {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(LENS_SIZE, cy);
        ctx.stroke();
      } else if (h === 'w' || h === 'e') {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, LENS_SIZE);
        ctx.stroke();
      } else {
        // 'move' mode: draw full crosshair
        ctx.strokeStyle = '#34d399'; // Emerald
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(LENS_SIZE, cy);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, LENS_SIZE);
        ctx.stroke();
      }
      ctx.restore();

      // 6. Draw center target crosshair dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; // Red center target dot
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Continue animation loop (for playing video)
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [data, sourceElement, sourceWidth, sourceHeight, zoomLevel]);

  if (!data || !data.active) return null;

  // Calculate smart floating position near the pointer / handle
  const HUD_WIDTH = 224;
  const HUD_HEIGHT = 296;

  let posLeft = data.clientX + 28;
  let posTop = data.clientY - 120;

  // Viewport bounds checking
  if (typeof window !== 'undefined') {
    if (posLeft + HUD_WIDTH > window.innerWidth - 16) {
      posLeft = data.clientX - HUD_WIDTH - 28;
    }
    if (posLeft < 16) {
      posLeft = 16;
    }
    if (posTop + HUD_HEIGHT > window.innerHeight - 16) {
      posTop = window.innerHeight - HUD_HEIGHT - 16;
    }
    if (posTop < 16) {
      posTop = 16;
    }
  }

  const vidW = sourceWidth || 960;
  const vidH = sourceHeight || 960;
  const focalPxX = Math.round((data.focalNormX / 100) * vidW);
  const focalPxY = Math.round((data.focalNormY / 100) * vidH);

  return (
    <div
      className="fixed z-9999 pointer-events-auto select-none transition-all duration-75 ease-out shadow-[0_12px_40px_rgba(0,0,0,0.85)] rounded-2xl bg-stone-950/95 border-2 border-amber-400/80 backdrop-blur-md overflow-hidden text-white"
      style={{
        left: `${posLeft}px`,
        top: `${posTop}px`,
        width: `${HUD_WIDTH}px`,
      }}
    >
      {/* Lens Header */}
      <div className="px-3 py-2 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <ZoomIn className="w-3.5 h-3.5" />
          <span>边缘放大镜</span>
        </div>
        <div className="flex items-center gap-1">
          {[2.5, 3.5, 5.0].map((z) => (
            <button
              key={z}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onZoomChange?.(z);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                Math.abs(zoomLevel - z) < 0.1
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
              title={`切换至 ${z}x 放大倍率`}
            >
              {z}x
            </button>
          ))}
        </div>
      </div>

      {/* Center Canvas Viewport with Precision Bezel */}
      <div className="p-2.5 flex flex-col items-center justify-center bg-stone-950">
        <div className="relative rounded-xl overflow-hidden ring-1 ring-white/20 shadow-inner bg-stone-900">
          <canvas
            ref={canvasRef}
            width={LENS_SIZE}
            height={LENS_SIZE}
            className="block w-[192px] h-[192px]"
          />

          {/* Target Handle Tag in top corner of lens */}
          <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-semibold text-amber-300 border border-amber-400/30 flex items-center gap-1">
            <span>第 {(data.cellIndex + 1).toString().padStart(2, '0')} 格</span>
            <span className="text-white/60">·</span>
            <span>{HANDLE_LABELS[data.handle] || data.handle}</span>
          </div>
        </div>
      </div>

      {/* Lens Footer Telemetry Readout */}
      <div className="px-3 py-2 bg-stone-900/95 border-t border-stone-800 text-[11px] space-y-1">
        <div className="flex items-center justify-between text-stone-300">
          <span className="text-stone-400">切割点坐标:</span>
          <span className="font-mono font-bold text-amber-400">
            X:{focalPxX} Y:{focalPxY} px
          </span>
        </div>
        <div className="flex items-center justify-between text-stone-300">
          <span className="text-stone-400">当前单格尺寸:</span>
          <div className="flex items-center gap-1">
            <span className="font-mono font-bold text-white">
              {data.boxPixelW}×{data.boxPixelH} px
            </span>
            {data.isSquare ? (
              <span className="inline-flex items-center text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-1 rounded">
                <CheckCheck className="w-2.5 h-2.5 mr-0.5" />
                1:1
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] text-amber-400 font-medium bg-amber-500/20 px-1 rounded">
                <Square className="w-2.5 h-2.5 mr-0.5" />
                非正方
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
