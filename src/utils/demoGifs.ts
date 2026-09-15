import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// Helper to encode a sequence of canvas frames into a GIF File object
async function canvasFramesToFile(
  renderFrame: (ctx: CanvasRenderingContext2D, width: number, height: number, frameIndex: number, totalFrames: number) => void,
  width: number,
  height: number,
  totalFrames: number,
  delay: number,
  fileName: string
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const gif = GIFEncoder();

  for (let i = 0; i < totalFrames; i++) {
    ctx.clearRect(0, 0, width, height);
    renderFrame(ctx, width, height, i, totalFrames);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const palette = quantize(data, 256, { format: 'rgb565' });
    const index = applyPalette(data, palette, 'rgb565');

    gif.writeFrame(index, width, height, {
      palette,
      delay,
      repeat: 0,
    });
  }

  gif.finish();
  const bytes = gif.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });
  return new File([blob], fileName, { type: 'image/gif' });
}

// 1. Star / Emoji with white background (has white highlights to showcase contiguous protection)
export async function generateWhiteBgDemoGif(): Promise<File> {
  return canvasFramesToFile(
    (ctx, w, h, frame, total) => {
      // Solid White Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const progress = frame / total;
      const bounceY = Math.sin(progress * Math.PI * 2) * 12;
      const angle = Math.sin(progress * Math.PI * 2) * 0.15;

      ctx.save();
      ctx.translate(w / 2, h / 2 + bounceY);
      ctx.rotate(angle);

      // Yellow Star Body
      ctx.beginPath();
      const points = 5;
      const outerR = 36;
      const innerR = 18;
      for (let p = 0; p < points * 2; p++) {
        const r = p % 2 === 0 ? outerR : innerR;
        const theta = (p * Math.PI) / points - Math.PI / 2;
        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r;
        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#b45309';
      ctx.stroke();

      // Cute Eyes with white reflection highlight
      // Left eye
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-10, -3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff'; // White eye shine
      ctx.beginPath();
      ctx.arc(-8.5, -4.5, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Right eye
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(10, -3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff'; // White eye shine
      ctx.beginPath();
      ctx.arc(11.5, -4.5, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Happy Smile
      ctx.beginPath();
      ctx.arc(0, 5, 8, 0.1 * Math.PI, 0.9 * Math.PI, false);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#b45309';
      ctx.stroke();

      // Cheeks
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(-16, 4, 3.5, 0, Math.PI * 2);
      ctx.arc(16, 4, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
    120,
    120,
    12,
    90,
    'star_white_bg.gif'
  );
}

// 2. Spinning Gold Coin with solid black background
export async function generateBlackBgDemoGif(): Promise<File> {
  return canvasFramesToFile(
    (ctx, w, h, frame, total) => {
      // Solid Black Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      const progress = frame / total;
      const scaleX = Math.cos(progress * Math.PI * 2);

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(scaleX) < 0.08 ? 0.08 : scaleX, 1);

      // Outer rim
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ca8a04';
      ctx.stroke();

      // Inner rim
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();

      // Coin Star / Currency Symbol
      ctx.fillStyle = '#ca8a04';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 2);

      ctx.restore();
    },
    110,
    110,
    14,
    80,
    'spinning_coin_black_bg.gif'
  );
}

// 3. Green Screen Character / Rocket with Chroma Key Green
export async function generateGreenScreenDemoGif(): Promise<File> {
  return canvasFramesToFile(
    (ctx, w, h, frame, total) => {
      // Chroma Green Background
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, w, h);

      const progress = frame / total;
      const rocketY = Math.sin(progress * Math.PI * 2) * 6;
      const flameFlicker = (frame % 3) * 4;

      ctx.save();
      ctx.translate(w / 2, h / 2 + rocketY - 6);

      // Rocket flame
      ctx.beginPath();
      ctx.moveTo(-10, 26);
      ctx.lineTo(0, 42 + flameFlicker);
      ctx.lineTo(10, 26);
      ctx.closePath();
      ctx.fillStyle = '#f97316';
      ctx.fill();

      // Inner flame
      ctx.beginPath();
      ctx.moveTo(-5, 26);
      ctx.lineTo(0, 34 + flameFlicker * 0.7);
      ctx.lineTo(5, 26);
      ctx.closePath();
      ctx.fillStyle = '#fde047';
      ctx.fill();

      // Rocket fins
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-16, 26);
      ctx.lineTo(-26, 32);
      ctx.lineTo(-14, 10);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(16, 26);
      ctx.lineTo(26, 32);
      ctx.lineTo(14, 10);
      ctx.closePath();
      ctx.fill();

      // Rocket fuselage
      ctx.beginPath();
      ctx.ellipse(0, 6, 16, 30, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      // Rocket tip
      ctx.beginPath();
      ctx.ellipse(0, -10, 15, 14, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Porthole
      ctx.beginPath();
      ctx.arc(0, 4, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();

      ctx.restore();
    },
    120,
    130,
    12,
    80,
    'rocket_greenscreen.gif'
  );
}

// 4. Static photo/sticker demo (PNG image on solid white background)
export async function generateDemoStaticImage(): Promise<File> {
  const canvas = document.createElement('canvas');
  const w = 180;
  const h = 180;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Coffee cup / icon badge in center
  ctx.save();
  ctx.translate(w / 2, h / 2 + 10);

  // Cup saucer
  ctx.beginPath();
  ctx.ellipse(0, 48, 55, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#475569';
  ctx.stroke();

  // Cup body
  ctx.beginPath();
  ctx.moveTo(-36, -10);
  ctx.lineTo(36, -10);
  ctx.quadraticCurveTo(34, 40, 0, 42);
  ctx.quadraticCurveTo(-34, 40, -36, -10);
  ctx.closePath();
  ctx.fillStyle = '#6366f1';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#312e81';
  ctx.stroke();

  // Cup handle
  ctx.beginPath();
  ctx.arc(38, 12, 16, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#312e81';
  ctx.stroke();

  // Inner coffee & white foam heart (tests contiguous edge flood fill - inner white shouldn't vanish!)
  ctx.beginPath();
  ctx.ellipse(0, -10, 34, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#78350f';
  ctx.fill();

  // White latte art heart
  ctx.beginPath();
  ctx.arc(-5, -12, 4, 0, Math.PI * 2);
  ctx.arc(5, -12, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Steam (white clouds above)
  ctx.beginPath();
  ctx.arc(-10, -32, 7, 0, Math.PI * 2);
  ctx.arc(0, -38, 9, 0, Math.PI * 2);
  ctx.arc(12, -32, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#cbd5e1';
  ctx.fill();

  ctx.restore();

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png');
  });

  return new File([blob], 'coffee_sticker.png', { type: 'image/png' });
}

