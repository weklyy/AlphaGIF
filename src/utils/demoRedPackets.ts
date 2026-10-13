/**
 * Built-in Demo Assets & Procedural Generators for WeChat Red Packet Cover Maker
 * Generates festive, high-resolution Chinese New Year / Fortune / Business designs
 */

import { compressPngStrictUnderLimit } from './redPacketProcessor';

export interface DemoRedPacketTheme {
  id: string;
  name: string;
  tag: string;
  description: string;
  themeColor: string;
  generateAssets: () => Promise<{
    coverBlob: Blob;
    pendantBlob: Blob;
    bubbleBlob: Blob;
    storyBlob: Blob;
  }>;
}

/**
 * Helper to draw festive Chinese clouds / ruyi pattern
 */
function drawAuspiciousCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.arc(22, -10, 16, 0, Math.PI * 2);
  ctx.arc(42, 2, 18, 0, Math.PI * 2);
  ctx.arc(22, 14, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Generate Snake Year / Fortune Festive Theme
 */
async function generateFortuneFestiveTheme(): Promise<{
  coverBlob: Blob;
  pendantBlob: Blob;
  bubbleBlob: Blob;
  storyBlob: Blob;
}> {
  // 1. Cover Image: 957 x 1278
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 957;
  coverCanvas.height = 1278;
  const cctx = coverCanvas.getContext('2d')!;

  // Deep festive Chinese red with radial warmth
  const bgGrad = cctx.createRadialGradient(478, 600, 100, 478, 639, 700);
  bgGrad.addColorStop(0, '#e52d27');
  bgGrad.addColorStop(0.5, '#b31217');
  bgGrad.addColorStop(1, '#780206');
  cctx.fillStyle = bgGrad;
  cctx.fillRect(0, 0, 957, 1278);

  // Traditional subtle pattern / gold texture
  cctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
  cctx.lineWidth = 1.5;
  for (let r = 50; r < 600; r += 50) {
    cctx.beginPath();
    cctx.arc(478, 550, r, 0, Math.PI * 2);
    cctx.stroke();
  }

  // Draw gold border frame
  cctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  cctx.lineWidth = 3;
  cctx.strokeRect(36, 36, 957 - 72, 1278 - 72);
  cctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
  cctx.lineWidth = 1;
  cctx.strokeRect(46, 46, 957 - 92, 1278 - 92);

  // Decorative corner accents
  const drawCorner = (x: number, y: number, rot: number) => {
    cctx.save();
    cctx.translate(x, y);
    cctx.rotate(rot);
    cctx.strokeStyle = '#f59e0b';
    cctx.lineWidth = 4;
    cctx.beginPath();
    cctx.moveTo(0, 0);
    cctx.lineTo(30, 0);
    cctx.moveTo(0, 0);
    cctx.lineTo(0, 30);
    cctx.stroke();
    cctx.restore();
  };
  drawCorner(50, 50, 0);
  drawCorner(907, 50, Math.PI / 2);
  drawCorner(907, 1228, Math.PI);
  drawCorner(50, 1228, -Math.PI / 2);

  // Auspicious clouds
  drawAuspiciousCloud(cctx, 160, 220, 1.2, 'rgba(255, 223, 128, 0.35)');
  drawAuspiciousCloud(cctx, 720, 260, 1.4, 'rgba(255, 223, 128, 0.3)');
  drawAuspiciousCloud(cctx, 180, 950, 1.3, 'rgba(255, 223, 128, 0.35)');
  drawAuspiciousCloud(cctx, 740, 920, 1.1, 'rgba(255, 223, 128, 0.25)');

  // Main Center Artwork: Golden Fortune Badge & Snake/Dragon motif
  const centerGrad = cctx.createRadialGradient(478, 560, 20, 478, 560, 240);
  centerGrad.addColorStop(0, '#ffd700');
  centerGrad.addColorStop(0.7, '#d97706');
  centerGrad.addColorStop(1, '#92400e');
  cctx.fillStyle = centerGrad;
  cctx.beginPath();
  cctx.arc(478, 560, 190, 0, Math.PI * 2);
  cctx.fill();

  // Outer gold rim
  cctx.lineWidth = 8;
  cctx.strokeStyle = '#fef08a';
  cctx.stroke();

  // Inner Chinese character "福" or "吉"
  cctx.fillStyle = '#991b1b';
  cctx.font = 'bold 150px sans-serif';
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillText('福', 478, 560);

  // Subtitle / Blessing Banner
  cctx.fillStyle = '#fef08a';
  cctx.font = 'bold 44px sans-serif';
  cctx.fillText('万 事 如 意 · 招 财 进 宝', 478, 800);

  cctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  cctx.font = '24px sans-serif';
  cctx.fillText('2026 岁次乙巳 · 吉祥安康', 478, 850);

  // 2. Cover Pendant: 1053 x 1746 (Strictly in Top Rim Y: 60~320 and Bottom Spine Y: 1400~1680, matching Figure 2 & Figure 3)
  const pendantCanvas = document.createElement('canvas');
  pendantCanvas.width = 1053;
  pendantCanvas.height = 1746;
  const pctx = pendantCanvas.getContext('2d')!;

  // Clear transparent canvas
  pctx.clearRect(0, 0, 1053, 1746);

  // --- TOP EDITABLE ZONE (上端探头: Y 60 ~ 320) ---
  // Mascot / Golden Tiger Head peeking out over the top edge of cover (Figure 2 Style)
  pctx.save();
  pctx.translate(526.5, 210);
  pctx.shadowColor = 'rgba(255, 215, 0, 0.45)';
  pctx.shadowBlur = 18;

  // Tiger / Mascot Head
  const headGrad = pctx.createRadialGradient(0, 0, 10, 0, 0, 110);
  headGrad.addColorStop(0, '#fef08a');
  headGrad.addColorStop(0.7, '#f59e0b');
  headGrad.addColorStop(1, '#d97706');
  pctx.fillStyle = headGrad;
  pctx.beginPath();
  pctx.arc(0, 0, 95, 0, Math.PI * 2);
  pctx.fill();
  pctx.lineWidth = 5;
  pctx.strokeStyle = '#fef9c3';
  pctx.stroke();

  // Tiger Ears
  const drawEar = (ex: number, ey: number, rot: number) => {
    pctx.save();
    pctx.translate(ex, ey);
    pctx.rotate(rot);
    pctx.fillStyle = '#d97706';
    pctx.beginPath();
    pctx.ellipse(0, 0, 36, 48, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#fef08a';
    pctx.beginPath();
    pctx.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
  };
  drawEar(-75, -75, -0.4);
  drawEar(75, -75, 0.4);

  // Cute Mascot Eyes & Nose
  pctx.fillStyle = '#451a03';
  pctx.beginPath();
  pctx.arc(-32, -10, 10, 0, Math.PI * 2);
  pctx.arc(32, -10, 10, 0, Math.PI * 2);
  pctx.fill();
  // Nose
  pctx.fillStyle = '#ef4444';
  pctx.beginPath();
  pctx.ellipse(0, 16, 14, 10, 0, 0, Math.PI * 2);
  pctx.fill();
  // "王" mark on forehead
  pctx.fillStyle = '#78350f';
  pctx.font = 'bold 28px sans-serif';
  pctx.textAlign = 'center';
  pctx.fillText('王', 0, -42);

  // Left & Right top floating gold coins in top editable area
  const drawGoldCoin = (x: number, y: number, r: number) => {
    pctx.save();
    pctx.translate(x, y);
    pctx.fillStyle = '#f59e0b';
    pctx.beginPath();
    pctx.arc(0, 0, r, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#fef08a';
    pctx.beginPath();
    pctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#b45309';
    pctx.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5);
    pctx.restore();
  };
  drawGoldCoin(-240, 20, 35);
  drawGoldCoin(240, 10, 38);
  pctx.restore();

  // --- BOTTOM EDITABLE ZONE (脊端垂饰: Y 1400 ~ 1700) ---
  // Cute tiger paws & golden ingot hanging at spine (Figure 2 Style)
  pctx.save();
  pctx.translate(526.5, 1540);
  pctx.shadowColor = 'rgba(0,0,0,0.3)';
  pctx.shadowBlur = 16;

  // Ingot shape
  const ingotGrad = pctx.createLinearGradient(-110, -50, 110, 50);
  ingotGrad.addColorStop(0, '#fef08a');
  ingotGrad.addColorStop(0.5, '#f59e0b');
  ingotGrad.addColorStop(1, '#d97706');
  pctx.fillStyle = ingotGrad;
  pctx.beginPath();
  pctx.moveTo(-100, 0);
  pctx.quadraticCurveTo(-115, -45, -45, -45);
  pctx.quadraticCurveTo(0, -65, 45, -45);
  pctx.quadraticCurveTo(115, -45, 100, 0);
  pctx.quadraticCurveTo(120, 45, 0, 50);
  pctx.quadraticCurveTo(-120, 45, -100, 0);
  pctx.closePath();
  pctx.fill();
  pctx.lineWidth = 4;
  pctx.strokeStyle = '#fef9c3';
  pctx.stroke();

  // Two tiger paws gripping spine
  const drawPaw = (px: number) => {
    pctx.save();
    pctx.translate(px, -45);
    pctx.fillStyle = '#ffffff';
    pctx.beginPath();
    pctx.arc(0, 0, 32, 0, Math.PI * 2);
    pctx.fill();
    pctx.lineWidth = 3;
    pctx.strokeStyle = '#f59e0b';
    pctx.stroke();
    // pads
    pctx.fillStyle = '#f43f5e';
    pctx.beginPath();
    pctx.arc(0, 2, 14, 0, Math.PI * 2);
    pctx.arc(-14, -14, 7, 0, Math.PI * 2);
    pctx.arc(0, -18, 7, 0, Math.PI * 2);
    pctx.arc(14, -14, 7, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
  };
  drawPaw(-60);
  drawPaw(60);

  // Ingot blessing word
  pctx.fillStyle = '#991b1b';
  pctx.font = 'bold 36px sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText('招财', 0, 5);
  pctx.restore();

  // 3. Bubble Pendant: 480 x 384 (Figure 6: Upper editable zone Y: 0~96px with ZERO pixels in non-editable zone)
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 480;
  bubbleCanvas.height = 384;
  const bctx = bubbleCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, 480, 384);

  // Fortune Pouch centered at (240, 48), completely within Y: 4px ~ 92px
  bctx.save();
  bctx.translate(240, 52);
  bctx.scale(0.68, 0.68);
  bctx.shadowColor = 'rgba(0,0,0,0.25)';
  bctx.shadowBlur = 8;

  // Fortune Pouch
  const pouchGrad = bctx.createLinearGradient(-45, -35, 45, 50);
  pouchGrad.addColorStop(0, '#ef4444');
  pouchGrad.addColorStop(1, '#991b1b');
  bctx.fillStyle = pouchGrad;
  bctx.beginPath();
  bctx.ellipse(0, 16, 50, 54, 0, 0, Math.PI * 2);
  bctx.fill();

  // Gold tie ribbon
  bctx.fillStyle = '#fbbf24';
  bctx.beginPath();
  bctx.ellipse(0, -25, 24, 8, 0, 0, Math.PI * 2);
  bctx.fill();

  // Top frills
  bctx.fillStyle = '#dc2626';
  bctx.beginPath();
  bctx.moveTo(-25, -25);
  bctx.lineTo(-32, -50);
  bctx.lineTo(0, -40);
  bctx.lineTo(32, -50);
  bctx.lineTo(25, -25);
  bctx.closePath();
  bctx.fill();

  // Gold character "吉" on pouch
  bctx.fillStyle = '#fbbf24';
  bctx.font = 'bold 28px sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText('吉', 0, 18);
  bctx.restore();

  // 4. Cover Story: 750 x 1250 (Full poster / branding card)
  const storyCanvas = document.createElement('canvas');
  storyCanvas.width = 750;
  storyCanvas.height = 1250;
  const sctx = storyCanvas.getContext('2d')!;

  const sGrad = sctx.createLinearGradient(0, 0, 750, 1250);
  sGrad.addColorStop(0, '#1a0505');
  sGrad.addColorStop(0.3, '#7f1d1d');
  sGrad.addColorStop(0.7, '#991b1b');
  sGrad.addColorStop(1, '#450a0a');
  sctx.fillStyle = sGrad;
  sctx.fillRect(0, 0, 750, 1250);

  // Decorative border
  sctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  sctx.lineWidth = 2;
  sctx.strokeRect(30, 30, 750 - 60, 1250 - 60);

  // Top header
  sctx.fillStyle = '#fbbf24';
  sctx.font = 'bold 32px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('• 红包故事 · 岁岁平安 •', 375, 140);

  // Large Festive Artwork Container
  sctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  sctx.fillRect(80, 200, 590, 560);
  sctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
  sctx.strokeRect(80, 200, 590, 560);

  // Inner Illustration inside story
  sctx.fillStyle = '#fbbf24';
  sctx.font = 'bold 96px sans-serif';
  sctx.fillText('福 禄 寿 喜', 375, 420);

  sctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  sctx.font = '24px sans-serif';
  sctx.fillText('迎祥纳福 · 恭贺新禧', 375, 520);

  // Story Description paragraphs
  sctx.fillStyle = '#fef08a';
  sctx.font = 'bold 28px sans-serif';
  sctx.fillText('新 年 献 词 与 祝 福', 375, 840);

  sctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  sctx.font = '20px sans-serif';
  sctx.fillText('感谢一路相伴与支持，愿新的一年万事顺遂！', 375, 900);
  sctx.fillText('祥云瑞气迎面来，财源广进福满堂。', 375, 940);
  sctx.fillText('点击下方可进一步了解视频号与更多精彩故事。', 375, 980);

  // Convert all canvases to blobs (strictly under limits)
  const [coverBlob, pendantBlob, bubbleBlob, storyBlob] = await Promise.all([
    new Promise<Blob>((res) => coverCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)),
    compressPngStrictUnderLimit(pendantCanvas, 300 * 1024),
    compressPngStrictUnderLimit(bubbleCanvas, 300 * 1024),
    new Promise<Blob>((res) => storyCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)),
  ]);

  return {
    coverBlob,
    pendantBlob,
    bubbleBlob,
    storyBlob,
  };
}

/**
 * Generate Modern Lion Dance (国潮醒狮) Theme
 */
async function generateLionDanceTheme(): Promise<{
  coverBlob: Blob;
  pendantBlob: Blob;
  bubbleBlob: Blob;
  storyBlob: Blob;
}> {
  // 1. Cover Image: 957 x 1278
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 957;
  coverCanvas.height = 1278;
  const cctx = coverCanvas.getContext('2d')!;

  const bgGrad = cctx.createLinearGradient(0, 0, 957, 1278);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.3, '#1e1b4b');
  bgGrad.addColorStop(0.7, '#312e81');
  bgGrad.addColorStop(1, '#831843');
  cctx.fillStyle = bgGrad;
  cctx.fillRect(0, 0, 957, 1278);

  // Modern cyber-gold geometric rays
  cctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
  cctx.lineWidth = 2;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    cctx.beginPath();
    cctx.moveTo(478, 600);
    cctx.lineTo(478 + Math.cos(a) * 900, 600 + Math.sin(a) * 900);
    cctx.stroke();
  }

  // Neon Lion Mask Silhouette / Badge
  cctx.save();
  cctx.translate(478, 540);
  cctx.fillStyle = '#f59e0b';
  cctx.beginPath();
  cctx.arc(0, 0, 180, 0, Math.PI * 2);
  cctx.fill();

  cctx.fillStyle = '#be123c';
  cctx.beginPath();
  cctx.arc(0, 0, 160, 0, Math.PI * 2);
  cctx.fill();

  cctx.fillStyle = '#ffffff';
  cctx.font = 'bold 120px sans-serif';
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillText('🦁', 0, 0);
  cctx.restore();

  cctx.fillStyle = '#fde047';
  cctx.font = 'bold 50px sans-serif';
  cctx.textAlign = 'center';
  cctx.fillText('国 潮 醒 狮 · 大 吉 大 利', 478, 800);

  cctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  cctx.font = '24px sans-serif';
  cctx.fillText('LION DANCE · FORTUNE 2026', 478, 860);

  // 2. Cover Pendant: 1053 x 1746 (Strictly in Top Rim Y: 60~320 and Bottom Spine Y: 1400~1680)
  const pendantCanvas = document.createElement('canvas');
  pendantCanvas.width = 1053;
  pendantCanvas.height = 1746;
  const pctx = pendantCanvas.getContext('2d')!;
  pctx.clearRect(0, 0, 1053, 1746);

  // --- TOP EDITABLE ZONE (上端探头: Y 60 ~ 320) ---
  // Cyber Lion Crown / Head peeking out over cover
  pctx.save();
  pctx.translate(526.5, 200);
  pctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
  pctx.shadowBlur = 18;

  // Lion crown head
  pctx.fillStyle = '#f59e0b';
  pctx.beginPath();
  pctx.arc(0, 0, 90, 0, Math.PI * 2);
  pctx.fill();
  pctx.fillStyle = '#e11d48';
  pctx.beginPath();
  pctx.arc(0, 0, 75, 0, Math.PI * 2);
  pctx.fill();

  pctx.fillStyle = '#ffffff';
  pctx.font = 'bold 70px sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText('🦁', 0, 0);

  // Festive ribbons in top zone
  const colors = ['#f43f5e', '#fbbf24', '#38bdf8', '#a855f7'];
  for (let i = 0; i < 12; i++) {
    pctx.save();
    pctx.translate(-350 + i * 65, -80 + (i % 3) * 40);
    pctx.rotate((i % 2 === 0 ? 0.3 : -0.3));
    pctx.fillStyle = colors[i % colors.length];
    pctx.fillRect(-12, -5, 24, 10);
    pctx.restore();
  }
  pctx.restore();

  // --- BOTTOM EDITABLE ZONE (脊端垂饰: Y 1400 ~ 1700) ---
  // Lion paws & golden tassel pendant at spine
  pctx.save();
  pctx.translate(526.5, 1540);
  pctx.shadowColor = 'rgba(0,0,0,0.3)';
  pctx.shadowBlur = 16;

  // Bottom Golden Badge
  pctx.fillStyle = '#f59e0b';
  pctx.beginPath();
  pctx.arc(0, 30, 65, 0, Math.PI * 2);
  pctx.fill();
  pctx.fillStyle = '#be123c';
  pctx.beginPath();
  pctx.arc(0, 30, 52, 0, Math.PI * 2);
  pctx.fill();
  pctx.fillStyle = '#fef08a';
  pctx.font = 'bold 44px sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText('吉', 0, 30);

  // Two Lion Paws
  const drawLionPaw = (lx: number) => {
    pctx.save();
    pctx.translate(lx, -35);
    pctx.fillStyle = '#fbbf24';
    pctx.beginPath();
    pctx.arc(0, 0, 30, 0, Math.PI * 2);
    pctx.fill();
    pctx.lineWidth = 3;
    pctx.strokeStyle = '#d97706';
    pctx.stroke();
    // pads
    pctx.fillStyle = '#881337';
    pctx.beginPath();
    pctx.arc(0, 0, 14, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
  };
  drawLionPaw(-75);
  drawLionPaw(75);
  pctx.restore();

  // 3. Bubble Pendant: 480 x 384 (Figure 6: Upper zone Y: 0~96px strictly)
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 480;
  bubbleCanvas.height = 384;
  const bctx = bubbleCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, 480, 384);

  bctx.save();
  bctx.translate(240, 48);
  bctx.shadowColor = 'rgba(0,0,0,0.25)';
  bctx.shadowBlur = 8;
  bctx.fillStyle = '#fbbf24';
  bctx.beginPath();
  bctx.arc(0, 0, 38, 0, Math.PI * 2);
  bctx.fill();
  bctx.lineWidth = 3;
  bctx.strokeStyle = '#fef08a';
  bctx.stroke();

  bctx.fillStyle = '#e11d48';
  bctx.beginPath();
  bctx.arc(0, 0, 30, 0, Math.PI * 2);
  bctx.fill();

  bctx.fillStyle = '#fef08a';
  bctx.font = 'bold 30px sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText('發', 0, 0);
  bctx.restore();

  // 4. Cover Story: 750 x 1250
  const storyCanvas = document.createElement('canvas');
  storyCanvas.width = 750;
  storyCanvas.height = 1250;
  const sctx = storyCanvas.getContext('2d')!;
  const sGrad = sctx.createLinearGradient(0, 0, 750, 1250);
  sGrad.addColorStop(0, '#0f172a');
  sGrad.addColorStop(1, '#4c0519');
  sctx.fillStyle = sGrad;
  sctx.fillRect(0, 0, 750, 1250);

  sctx.fillStyle = '#fde047';
  sctx.font = 'bold 36px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('醒狮贺岁 · 鸿运当头', 375, 200);

  sctx.fillStyle = '#ffffff';
  sctx.font = '22px sans-serif';
  sctx.fillText('醒狮点睛，富贵吉祥。狮跃龙腾，如日方升。', 375, 280);

  const [coverBlob, pendantBlob, bubbleBlob, storyBlob] = await Promise.all([
    new Promise<Blob>((res) => coverCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)),
    compressPngStrictUnderLimit(pendantCanvas, 300 * 1024),
    compressPngStrictUnderLimit(bubbleCanvas, 300 * 1024),
    new Promise<Blob>((res) => storyCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)),
  ]);

  return {
    coverBlob,
    pendantBlob,
    bubbleBlob,
    storyBlob,
  };
}

/**
 * 3. 萌熊送福 · 趴气泡小熊 (官方对齐示范款)
 * 专门对齐微信官方图2、图4、图5、图6规范：
 * - 封面挂件：小熊趴在红包顶部探头 (图2标准，离主体区域很近，探头挂点在 Y=220，底部趴在 Y=338，紧贴 342px 主体区)
 * - 气泡挂件：小熊双爪刚好趴在对话框气泡上 (图3标准，趴在 Y=278，全部像素 100% 严格在 [40..440, 20..280] 可编辑区内，图6零报错)
 */
async function generateCuteBearTheme() {
  // 1. 封面图 (957 x 1278)
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 957;
  coverCanvas.height = 1278;
  const ctx = coverCanvas.getContext('2d')!;

  // Festive warm gradient
  const grad = ctx.createLinearGradient(0, 0, 957, 1278);
  grad.addColorStop(0, '#e11d48');
  grad.addColorStop(0.5, '#be123c');
  grad.addColorStop(1, '#881337');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 957, 1278);

  // Soft festive circle patterns
  ctx.save();
  ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
  ctx.beginPath();
  ctx.arc(478, 500, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw cute bear illustration on cover
  drawCuteBear(ctx, 478, 620, 280);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('萌熊送福 · 岁岁喜乐', 478, 860);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText('新春大吉 · 好事连连', 478, 920);

  // 2. 封面挂件 (1053 x 1746) - 微信官方图2 & 图5 规范
  // 小熊趴在红包顶部探头 (底边在 Y = 338，紧靠 Y = 342 红包上沿)，底部脊端配有金元宝萌爪 (Y = 1650~1746)
  const pendantCanvas = document.createElement('canvas');
  pendantCanvas.width = 1053;
  pendantCanvas.height = 1746;
  const pctx = pendantCanvas.getContext('2d')!;
  pctx.clearRect(0, 0, 1053, 1746);

  // Top Zone (0 ~ 342px): Cute bear peeking over top envelope rim (paws at Y = 338)
  drawCuteBearPeeking(pctx, 526.5, 220, 260, 338);

  // Bottom Zone (1650 ~ 1746px): Cute golden ingot & paws at spine
  pctx.save();
  pctx.translate(526.5, 1698);
  const bGrad = pctx.createLinearGradient(-100, -25, 100, 25);
  bGrad.addColorStop(0, '#fef08a');
  bGrad.addColorStop(0.5, '#f59e0b');
  bGrad.addColorStop(1, '#d97706');
  pctx.fillStyle = bGrad;
  pctx.beginPath();
  pctx.roundRect(-80, -20, 160, 42, 21);
  pctx.fill();
  pctx.lineWidth = 2.5;
  pctx.strokeStyle = '#fef9c3';
  pctx.stroke();

  // Cute bear paws hanging over bottom spine
  const pawR = 16;
  pctx.fillStyle = '#ffffff';
  pctx.beginPath();
  pctx.arc(-42, 18, pawR, 0, Math.PI * 2);
  pctx.arc(42, 18, pawR, 0, Math.PI * 2);
  pctx.fill();
  pctx.fillStyle = '#f43f5e';
  pctx.beginPath();
  pctx.arc(-42, 18, 6, 0, Math.PI * 2);
  pctx.arc(42, 18, 6, 0, Math.PI * 2);
  pctx.fill();
  pctx.restore();

  // Clean forbidden area Y: 342..1650
  pctx.clearRect(96, 342, 861, 1308);

  // 3. 气泡挂件 (480 x 384) - 微信官方严格规范
  // 小熊双爪刚好趴在对话框气泡卡片顶缘 (Y = 96，爪子贴齐 Y = 96，严禁侵入 Y > 96)
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 480;
  bubbleCanvas.height = 384;
  const bctx = bubbleCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, 480, 384);

  // Draw cute bear with paws directly resting on Y = 96 (card top edge)
  drawCuteBearOnBubble(bctx, 240, 52, 94, 96);

  // Strict clear of non-editable middle (96~312) and bottom
  bctx.clearRect(0, 96, 480, 288);

  // 4. 封面故事 (750 x 1250)
  const storyCanvas = document.createElement('canvas');
  storyCanvas.width = 750;
  storyCanvas.height = 1250;
  const sctx = storyCanvas.getContext('2d')!;
  const sGrad = sctx.createLinearGradient(0, 0, 750, 1250);
  sGrad.addColorStop(0, '#881337');
  sGrad.addColorStop(1, '#4c0519');
  sctx.fillStyle = sGrad;
  sctx.fillRect(0, 0, 750, 1250);

  drawCuteBear(sctx, 375, 520, 240);

  sctx.fillStyle = '#fef08a';
  sctx.font = 'bold 36px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('萌熊送福 · 岁岁平安', 375, 780);

  sctx.fillStyle = '#ffffff';
  sctx.font = '22px sans-serif';
  sctx.fillText('万事顺遂 · 喜乐常安 · 诸事顺遂', 375, 840);

  const [coverBlob, pendantBlob, bubbleBlob, storyBlob] = await Promise.all([
    new Promise<Blob>((res) => coverCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)),
    compressPngStrictUnderLimit(pendantCanvas, 300 * 1024),
    compressPngStrictUnderLimit(bubbleCanvas, 300 * 1024),
    new Promise<Blob>((res) => storyCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)),
  ]);

  return {
    coverBlob,
    pendantBlob,
    bubbleBlob,
    storyBlob,
  };
}

/**
 * Helper: Draw full cute bear illustration
 */
function drawCuteBear(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  const r = size / 2;

  // Ears
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cx - r * 0.65, cy - r * 0.65, r * 0.32, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.65, cy - r * 0.65, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx - r * 0.65, cy - r * 0.65, r * 0.18, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.65, cy - r * 0.65, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.42, cy + r * 0.12, r * 0.14, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.42, cy + r * 0.12, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.15, r * 0.28, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.08, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx - r * 0.08, cy + r * 0.2, r * 0.08, 0.1, Math.PI * 0.9);
  ctx.arc(cx + r * 0.08, cy + r * 0.2, r * 0.08, 0.1, Math.PI * 0.9);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(cx - r * 0.26, cy - r * 0.1, r * 0.08, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.26, cy - r * 0.1, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.13, r * 0.03, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.24, cy - r * 0.13, r * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Helper: Draw peeking cute bear resting at bottom Y (Figure 2 / Figure 5)
 */
function drawCuteBearPeeking(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, bottomY: number) {
  ctx.save();
  const r = size / 2;

  // Ears
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cx - r * 0.62, cy - r * 0.55, r * 0.28, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.62, cy - r * 0.55, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx - r * 0.62, cy - r * 0.55, r * 0.16, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.62, cy - r * 0.55, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.4, cy + r * 0.1, r * 0.13, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.4, cy + r * 0.1, r * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, r * 0.26, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.06, r * 0.09, r * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx - r * 0.07, cy + r * 0.17, r * 0.07, 0.1, Math.PI * 0.9);
  ctx.arc(cx + r * 0.07, cy + r * 0.17, r * 0.07, 0.1, Math.PI * 0.9);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(cx - r * 0.24, cy - r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.24, cy - r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.26, cy - r * 0.12, r * 0.025, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.22, cy - r * 0.12, r * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Two cute paws resting along bottomY (peeking paws)
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  const pawR = r * 0.18;
  const pawY = bottomY - pawR * 0.7;

  ctx.beginPath();
  ctx.ellipse(cx - r * 0.42, pawY, pawR * 1.1, pawR * 0.8, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx + r * 0.42, pawY, pawR * 1.1, pawR * 0.8, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Paw pads
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cx - r * 0.42, pawY, pawR * 0.35, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.42, pawY, pawR * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Helper: Draw cute bear趴在气泡上 (Figure 3 & Figure 6)
 * Paws strictly rest at bubbleRimY (e.g. 276px), with 0 pixels in Y >= 280
 */
function drawCuteBearOnBubble(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, bubbleRimY: number) {
  ctx.save();
  const r = size / 2;

  // Ears
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cx - r * 0.6, cy - r * 0.55, r * 0.27, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.6, cy - r * 0.55, r * 0.27, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx - r * 0.6, cy - r * 0.55, r * 0.15, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.6, cy - r * 0.55, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = 'rgba(244, 63, 94, 0.5)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.38, cy + r * 0.1, r * 0.13, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.38, cy + r * 0.1, r * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, r * 0.25, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.05, r * 0.08, r * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx - r * 0.07, cy + r * 0.16, r * 0.06, 0.1, Math.PI * 0.9);
  ctx.arc(cx + r * 0.07, cy + r * 0.16, r * 0.06, 0.1, Math.PI * 0.9);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(cx - r * 0.22, cy - r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.22, cy - r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.24, cy - r * 0.12, r * 0.025, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.2, cy - r * 0.12, r * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Two cute little paws hanging directly over the bubble rim (趴在气泡上, Figure 3)
  // Paws touch bubbleRimY (e.g. 276px), strictly staying above 280px
  const pawR = r * 0.17;
  const pawY = bubbleRimY - pawR * 0.8;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.ellipse(cx - r * 0.38, pawY, pawR * 1.1, pawR * 0.8, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx + r * 0.38, pawY, pawR * 1.1, pawR * 0.8, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pink paw pads
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cx - r * 0.38, pawY, pawR * 0.32, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.38, pawY, pawR * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export const DEMO_RED_PACKET_THEMES: DemoRedPacketTheme[] = [
  {
    id: 'theme-cute-bear',
    name: '萌熊送福 · 趴气泡小熊 (官方对齐示范款)',
    tag: '官方对齐推荐',
    description: '严格按照微信图2、图4、图5、图6对齐：小熊封面挂件探头贴近红包主体，气泡挂件双爪刚好趴在气泡上且 100% 落在可编辑区，上传微信零报错！',
    themeColor: '#e11d48',
    generateAssets: generateCuteBearTheme,
  },
  {
    id: 'theme-fortune-festive',
    name: '福气满满 · 新春万象 (经典红金)',
    tag: '新年热款',
    description: '标准微信红包经典正红底色，配备祥云金纹、飘动金币挂件与吉祥福袋气泡，一键符合 100% 官方规范',
    themeColor: '#b91c1c',
    generateAssets: generateFortuneFestiveTheme,
  },
  {
    id: 'theme-lion-dance',
    name: '国潮醒狮 · 大吉大利 (时尚国潮)',
    tag: '潮流人气',
    description: '深邃夜幕紫金流光与国潮醒狮元素，金币彩带挂件与“發”字金牌气泡，适合年轻与个性化红包',
    themeColor: '#4338ca',
    generateAssets: generateLionDanceTheme,
  },
];
