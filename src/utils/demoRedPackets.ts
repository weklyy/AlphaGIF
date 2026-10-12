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

  // 3. Bubble Pendant: 480 x 384 (Figure 4: Upper editable zone X: 240, Y: 120 with zero truncation)
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 480;
  bubbleCanvas.height = 384;
  const bctx = bubbleCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, 480, 384);

  // Cute Little Bear / Fortune Bag centered at (240, 120), safe padding 16px
  bctx.save();
  bctx.translate(240, 120);
  bctx.shadowColor = 'rgba(0,0,0,0.25)';
  bctx.shadowBlur = 12;

  // Fortune Pouch
  const pouchGrad = bctx.createLinearGradient(-50, -40, 50, 60);
  pouchGrad.addColorStop(0, '#ef4444');
  pouchGrad.addColorStop(1, '#991b1b');
  bctx.fillStyle = pouchGrad;
  bctx.beginPath();
  bctx.ellipse(0, 18, 55, 62, 0, 0, Math.PI * 2);
  bctx.fill();

  // Gold tie ribbon
  bctx.fillStyle = '#fbbf24';
  bctx.beginPath();
  bctx.ellipse(0, -28, 28, 10, 0, 0, Math.PI * 2);
  bctx.fill();

  // Top frills
  bctx.fillStyle = '#dc2626';
  bctx.beginPath();
  bctx.moveTo(-28, -28);
  bctx.lineTo(-36, -58);
  bctx.lineTo(0, -46);
  bctx.lineTo(36, -58);
  bctx.lineTo(28, -28);
  bctx.closePath();
  bctx.fill();

  // Gold character "吉" on pouch
  bctx.fillStyle = '#fbbf24';
  bctx.font = 'bold 32px sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText('吉', 0, 20);
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

  // 3. Bubble Pendant: 480 x 384 (X: 240, Y: 120 with zero truncation)
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 480;
  bubbleCanvas.height = 384;
  const bctx = bubbleCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, 480, 384);

  bctx.save();
  bctx.translate(240, 120);
  bctx.shadowColor = 'rgba(0,0,0,0.3)';
  bctx.shadowBlur = 14;
  bctx.fillStyle = '#fbbf24';
  bctx.beginPath();
  bctx.arc(0, 0, 60, 0, Math.PI * 2);
  bctx.fill();
  bctx.lineWidth = 4;
  bctx.strokeStyle = '#fef08a';
  bctx.stroke();

  bctx.fillStyle = '#e11d48';
  bctx.beginPath();
  bctx.arc(0, 0, 48, 0, Math.PI * 2);
  bctx.fill();

  bctx.fillStyle = '#fef08a';
  bctx.font = 'bold 46px sans-serif';
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

export const DEMO_RED_PACKET_THEMES: DemoRedPacketTheme[] = [
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
