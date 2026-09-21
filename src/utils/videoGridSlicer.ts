import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { GridConfig, SlicedStickerItem } from '../types';
import { removeBackgroundFromFrame, applyWhiteOutline, cleanEdgeBlackBordersAndMargins } from './gifProcessor';
import { calculateCellBounds } from './gridGeometry';
import { autoCenterAndScaleSubject } from './imageInpainting';

// Generate a demo 16-grid animated video file (4x4)
export async function generateDemo16GridVideo(): Promise<{ file: File; duration: number }> {
  const canvas = document.createElement('canvas');
  const width = 960;
  const height = 960;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const totalFrames = 24;
  const fps = 12;
  const duration = totalFrames / fps;

  // Character definitions for each of the 16 cells
  const cellConfigs = [
    { title: '卖萌眨眼', color: '#ffb703', type: 'wink' },
    { title: '收到点赞', color: '#2a9d8f', type: 'thumbsup' },
    { title: '比心发射', color: '#e76f51', type: 'heart' },
    { title: '哈哈大笑', color: '#f4a261', type: 'laugh' },
    { title: '挥手拜拜', color: '#3a86ff', type: 'wave' },
    { title: '思考问号', color: '#8338ec', type: 'think' },
    { title: '加油冲鸭', color: '#fb5607', type: 'cheer' },
    { title: '泪目痛哭', color: '#00b4d8', type: 'cry' },
    { title: '酷炫墨镜', color: '#4a4e69', type: 'cool' },
    { title: '汗颜尴尬', color: '#588157', type: 'sweat' },
    { title: '吃瓜看戏', color: '#d62828', type: 'melon' },
    { title: '熬夜修仙', color: '#3d405b', type: 'coffee' },
    { title: '致谢感恩', color: '#e07a5f', type: 'thanks' },
    { title: '生气质问', color: '#d00000', type: 'angry' },
    { title: '告辞溜了', color: '#7209b7', type: 'run' },
    { title: '乖巧躺平', color: '#48cae4', type: 'sleep' },
  ];

  const renderGridFrame = (f: number) => {
    const t = f / totalFrames;
    // Clear whole canvas with pure white background (simulating AI video generation)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const cellW = width / 4;
    const cellH = height / 4;

    for (let i = 0; i < 16; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const cfg = cellConfigs[i];

      // Subtle cell boundary separator
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);

      ctx.save();
      ctx.translate(cx, cy);

      const bounce = Math.sin((t + i * 0.125) * Math.PI * 2) * 6;
      const rot = Math.sin((t + i * 0.15) * Math.PI * 2) * 0.08;
      ctx.translate(0, bounce);
      ctx.rotate(rot);

      // Character Head Base
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.fillStyle = '#ffde59';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#e6af00';
      ctx.stroke();

      // Cheeks
      ctx.fillStyle = 'rgba(255, 107, 107, 0.45)';
      ctx.beginPath();
      ctx.arc(-28, 12, 10, 0, Math.PI * 2);
      ctx.arc(28, 12, 10, 0, Math.PI * 2);
      ctx.fill();

      // Expressions per type
      if (cfg.type === 'wink') {
        // Eye 1 open with shine
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-18, -6, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-16, -8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Eye 2 wink arc
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(18, -6, 8, Math.PI * 0.1, Math.PI * 0.9, false);
        ctx.stroke();
        // Big smile
        ctx.beginPath();
        ctx.arc(0, 8, 14, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.stroke();
      } else if (cfg.type === 'heart') {
        // Heart eyes
        const drawHeart = (hx: number, hy: number) => {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(hx - 5, hy - 4, 6, 0, Math.PI * 2);
          ctx.arc(hx + 5, hy - 4, 6, 0, Math.PI * 2);
          ctx.moveTo(hx - 11, hy - 2);
          ctx.lineTo(hx, hy + 9);
          ctx.lineTo(hx + 11, hy - 2);
          ctx.fill();
        };
        drawHeart(-18, -4);
        drawHeart(18, -4);
        // Kissy mouth
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(0, 14, 6, 0, Math.PI * 2);
        ctx.stroke();
        // Floating heart
        const floatY = -45 - Math.sin(t * Math.PI * 2) * 12;
        drawHeart(22, floatY);
      } else if (cfg.type === 'thumbsup') {
        // Big happy eyes
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-18, -6, 6, 0, Math.PI * 2);
        ctx.arc(18, -6, 6, 0, Math.PI * 2);
        ctx.fill();
        // Open happy mouth
        ctx.fillStyle = '#d90429';
        ctx.beginPath();
        ctx.arc(0, 10, 14, 0, Math.PI);
        ctx.fill();
        // Hand thumbs up on right
        ctx.save();
        ctx.translate(45, 10 + Math.sin(t * Math.PI * 2) * 8);
        ctx.fillStyle = '#ffde59';
        ctx.beginPath();
        ctx.roundRect(0, -16, 14, 26, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (cfg.type === 'laugh') {
        // Crescent eyes XD
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-18, -4, 8, Math.PI * 1.1, Math.PI * 1.9, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(18, -4, 8, Math.PI * 1.1, Math.PI * 1.9, false);
        ctx.stroke();
        // Wide open mouth with teeth
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(0, 6, 18, 0, Math.PI);
        ctx.fill();
        // Tears of joy shooting
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-36, -4, 6, 0, Math.PI * 2);
        ctx.arc(36, -4, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (cfg.type === 'thanks') {
        // Bowing eyes
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-16, -4, 7, Math.PI * 0.1, Math.PI * 0.9, false);
        ctx.arc(16, -4, 7, Math.PI * 0.1, Math.PI * 0.9, false);
        ctx.stroke();
        // Praying / clapping hands in front
        ctx.fillStyle = '#ffde59';
        ctx.beginPath();
        ctx.ellipse(0, 32, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Sparkles above
        ctx.fillStyle = '#f59e0b';
        ctx.font = '18px sans-serif';
        ctx.fillText('✨', -32, -26);
        ctx.fillText('✨', 22, -26);
      } else {
        // Standard expressive face
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-18, -6, 6, 0, Math.PI * 2);
        ctx.arc(18, -6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-16, -8, 2.5, 0, Math.PI * 2);
        ctx.arc(20, -8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Mouth
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 8, 12, 0.2 * Math.PI, 0.8 * Math.PI, false);
        ctx.stroke();
      }

      ctx.restore();
    }
  };

  // Check if MediaRecorder supports video/webm
  let stream = canvas.captureStream(fps);
  let mimeType = 'video/webm';
  if (!MediaRecorder.isTypeSupported('video/webm')) {
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    }
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });

  const recordPromise = new Promise<Blob>((resolve) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    recorder.onstop = () => {
      resolve(new Blob(recordedChunks, { type: mimeType }));
    };
  });

  recorder.start();

  // Play frames into canvas at fixed interval
  for (let f = 0; f < totalFrames; f++) {
    renderGridFrame(f);
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  recorder.stop();
  const videoBlob = await recordPromise;
  const file = new File([videoBlob], 'ai_sticker_16_grid_demo.webm', { type: mimeType });
  return { file, duration };
}

// Slice a media video element or canvas into a grid of 240x240 GIFs
export async function sliceVideoIntoStickers(
  videoSource: HTMLVideoElement,
  config: GridConfig,
  onProgress?: (progress: number, currentCell: number, totalCells: number, statusText: string) => void
): Promise<SlicedStickerItem[]> {
  const {
    cols,
    rows,
    cropArea,
    paddingInset,
    startTime,
    endTime,
    speed,
    fps,
    autoTransparent,
    bgColor,
    tolerance,
    addWhiteOutline,
    outlineWidth,
    colSplits,
    rowSplits,
    cellOverrides,
    layoutMode,
    independentBoxes,
    loopMode = 'normal',
    smartAutoCenter,
    subjectScaleTarget = 0.82,
  } = config;

  const totalCells = cols * rows;
  const vidW = videoSource.videoWidth || 960;
  const vidH = videoSource.videoHeight || 960;

  // Active adjustable crop area (percentage 0 to 100)
  const activeCrop = cropArea || { x: 0, y: 0, width: 100, height: 100 };
  const gridX = (Math.max(0, Math.min(100, activeCrop.x)) / 100) * vidW;
  const gridY = (Math.max(0, Math.min(100, activeCrop.y)) / 100) * vidH;
  const gridW = (Math.max(1, Math.min(100, activeCrop.width)) / 100) * vidW;
  const gridH = (Math.max(1, Math.min(100, activeCrop.height)) / 100) * vidH;

  const cellW = gridW / cols;
  const cellH = gridH / rows;

  const playbackSpeed = Math.max(0.5, Math.min(5, speed || 1.0));
  const validStart = Math.max(0, startTime);
  const validEnd = Math.max(validStart + 0.1, Math.min(endTime || videoSource.duration || 3, videoSource.duration || 3));
  const sourceDuration = validEnd - validStart;
  const outputDuration = sourceDuration / playbackSpeed;

  const targetFps = Math.max(6, Math.min(20, fps || 10));
  // In video time, each output frame covers (1 / targetFps) * playbackSpeed seconds
  const videoStep = (1 / targetFps) * playbackSpeed;
  const sampleTimes: number[] = [];

  for (let t = validStart; t <= validEnd; t += videoStep) {
    sampleTimes.push(t);
  }
  if (sampleTimes.length === 0) sampleTimes.push(validStart);

  // We will capture raw ImageData frames for each cell: Array of cells, each cell has Array of frames
  const cellFrames: {
    cellIndex: number;
    row: number;
    col: number;
    frames: { imageData: ImageData; delay: number }[];
  }[] = [];

  for (let c = 0; c < totalCells; c++) {
    const row = Math.floor(c / cols);
    const col = c % cols;
    cellFrames.push({ cellIndex: c + 1, row, col, frames: [] });
  }

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 240;
  sampleCanvas.height = 240;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })!;

  // Frame delay in milliseconds for the output animation
  const frameDelayMs = Math.round((1 / targetFps) * 1000);

  // Seek and extract each time slice
  for (let timeIdx = 0; timeIdx < sampleTimes.length; timeIdx++) {
    const time = sampleTimes[timeIdx];

    // Seek video
    await new Promise<void>((resolve) => {
      const handleSeeked = () => {
        videoSource.removeEventListener('seeked', handleSeeked);
        resolve();
      };
      videoSource.addEventListener('seeked', handleSeeked);
      videoSource.currentTime = time;
    });

    const percentSeek = Math.round(((timeIdx + 1) / sampleTimes.length) * 40);
    onProgress?.(percentSeek, 0, totalCells, `正在截取视频时间帧 (${timeIdx + 1}/${sampleTimes.length})...`);

    // Crop each cell
    for (let c = 0; c < totalCells; c++) {
      const { col, row } = cellFrames[c];

      // Calculate crop rectangle with internal splits, padding inset, and per-cell overrides
      const cellBounds = calculateCellBounds({
        cropX: gridX,
        cropY: gridY,
        cropW: gridW,
        cropH: gridH,
        cols,
        rows,
        col,
        row,
        cellIndex: c,
        layoutMode,
        independentBox: independentBoxes?.[c],
        colSplits,
        rowSplits,
        cellOverride: cellOverrides?.[c],
        paddingInset: paddingInset || 0,
        sourceWidth: vidW,
        sourceHeight: vidH,
      });

      const sx = cellBounds.sx;
      const sy = cellBounds.sy;
      const sw = cellBounds.sw;
      const sh = cellBounds.sh;

      sampleCtx.clearRect(0, 0, 240, 240);
      // Center and scale inside 240x240 box
      const aspect = sw / sh;
      let dw = 240;
      let dh = 240;
      let dx = 0;
      let dy = 0;
      if (aspect > 1) {
        dh = Math.round(240 / aspect);
        dy = Math.round((240 - dh) / 2);
      } else if (aspect < 1) {
        dw = Math.round(240 * aspect);
        dx = Math.round((240 - dw) / 2);
      }

      sampleCtx.drawImage(videoSource, sx, sy, sw, sh, dx, dy, dw, dh);
      let imgData = sampleCtx.getImageData(0, 0, 240, 240);

      // Clean unselected margins & edge black bars so unpainted padding and video letterboxing
      // are completely transparent, while keeping 100% of internal content intact without keying ("内容保持原图完整不扣图")
      imgData = cleanEdgeBlackBordersAndMargins(imgData, 32);

      // Apply background transparency if enabled
      if (autoTransparent) {
        imgData = removeBackgroundFromFrame(imgData, {
          targetColor: bgColor,
          tolerance: tolerance || 20,
          contiguous: true,
          defringe: 1,
        });
      }

      // AI Smart Auto-Center for animated cell
      if (smartAutoCenter) {
        imgData = autoCenterAndScaleSubject(
          imgData,
          240,
          subjectScaleTarget || 0.82,
          bgColor,
          tolerance || 20
        );
      }

      // Add WeChat official 2px white outline if requested
      if (autoTransparent && addWhiteOutline) {
        imgData = applyWhiteOutline(imgData, outlineWidth || 2, '#ffffff');
      }

      cellFrames[c].frames.push({
        imageData: imgData,
        delay: frameDelayMs,
      });
    }
  }

  // Now encode each cell into a standard 240x240 GIF (<500KB)
  const slicedStickers: SlicedStickerItem[] = [];

  for (let c = 0; c < totalCells; c++) {
    const item = cellFrames[c];
    const cellNumStr = String(item.cellIndex).padStart(2, '0');
    const name = `${cellNumStr}_T.gif`;

    const progressBase = 40 + Math.round(((c + 1) / totalCells) * 58);
    onProgress?.(progressBase, c + 1, totalCells, `正在压缩编码第 ${c + 1}/${totalCells} 个表情 GIF...`);

    const gif = GIFEncoder();
    
    // Apply AI Loop Mode (Boomerang ping-pong loop)
    let frames = item.frames;
    if (loopMode === 'boomerang' && frames.length >= 3) {
      const returnFrames = frames.slice(1, -1).reverse();
      frames = [...frames, ...returnFrames];
    }

    for (let f = 0; f < frames.length; f++) {
      const frameData = frames[f].imageData.data;
      const totalPixels = 240 * 240;

      let opaqueCount = 0;
      for (let p = 0; p < totalPixels; p++) {
        if (frameData[p * 4 + 3] > 64) opaqueCount++;
      }

      if (opaqueCount === 0) {
        const palette = [[0, 0, 0]];
        const index = new Uint8Array(totalPixels);
        gif.writeFrame(index, 240, 240, {
          palette,
          delay: frames[f].delay,
          transparent: true,
          transparentIndex: 0,
          dispose: 2,
          repeat: 0,
        });
      } else {
        const opaquePixels = new Uint8Array(opaqueCount * 4);
        let opIdx = 0;
        for (let p = 0; p < totalPixels; p++) {
          if (frameData[p * 4 + 3] > 64) {
            opaquePixels[opIdx] = frameData[p * 4];
            opaquePixels[opIdx + 1] = frameData[p * 4 + 1];
            opaquePixels[opIdx + 2] = frameData[p * 4 + 2];
            opaquePixels[opIdx + 3] = 255;
            opIdx += 4;
          }
        }

        // Quantize colors (up to 128 colors to guarantee <500KB size)
        const opaquePalette = quantize(opaquePixels, 128, { format: 'rgb565' });
        const fullPalette = [[0, 0, 0], ...opaquePalette];
        const rawIndices = applyPalette(frameData, opaquePalette, 'rgb565');
        const finalIndices = new Uint8Array(totalPixels);

        for (let p = 0; p < totalPixels; p++) {
          if (frameData[p * 4 + 3] <= 64) {
            finalIndices[p] = 0;
          } else {
            finalIndices[p] = rawIndices[p] + 1;
          }
        }

        gif.writeFrame(finalIndices, 240, 240, {
          palette: fullPalette,
          delay: frames[f].delay,
          transparent: true, // Always transparent: index 0 is transparent background
          transparentIndex: 0,
          dispose: 2,
          repeat: 0,
        });
      }
    }

    gif.finish();
    const bytes = gif.bytes();
    const blob = new Blob([bytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);

    // Pick a representative frame (middle frame usually has the best pose)
    const midIdx = Math.floor(frames.length / 2);
    const representativeFrameData = frames[midIdx]?.imageData || frames[0].imageData;

    // Create DataURL for instant canvas rendering
    const repCanvas = document.createElement('canvas');
    repCanvas.width = 240;
    repCanvas.height = 240;
    const repCtx = repCanvas.getContext('2d')!;
    repCtx.putImageData(representativeFrameData, 0, 0);
    const representativeDataUrl = repCanvas.toDataURL('image/png');

    slicedStickers.push({
      index: item.cellIndex,
      name,
      row: item.row,
      col: item.col,
      blob,
      url,
      size: blob.size,
      width: 240,
      height: 240,
      frameCount: frames.length,
      duration: outputDuration,
      representativeFrameData,
      representativeDataUrl,
    });
  }

  onProgress?.(100, totalCells, totalCells, '切片完成！');
  return slicedStickers;
}
