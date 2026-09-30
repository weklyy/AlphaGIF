/**
 * Built-in Demo Portraits for Instant Testing
 * Allows users to test AI matting, 1-inch, 2-inch, and background replacement with 1-click
 */

export interface DemoPortrait {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  avatarUrl: string;
  // Function to create real full-size File
  createFile: () => Promise<File>;
}

/**
 * Procedurally generates a clean photorealistic portrait image on Canvas for immediate testing
 */
function generateDemoPortraitBlob(
  gender: 'male' | 'female',
  style: 'young_man' | 'business_woman' | 'student' | 'mature_man'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d')!;

  // 1. Natural real-world uneven indoor background (to demonstrate AI matting power!)
  const bgGrad = ctx.createLinearGradient(0, 0, 600, 800);
  if (style === 'young_man') {
    bgGrad.addColorStop(0, '#CBD5E1'); // cool grey wall with slight shadow
    bgGrad.addColorStop(1, '#94A3B8');
  } else if (style === 'business_woman') {
    bgGrad.addColorStop(0, '#E2E8F0'); // beige indoor room
    bgGrad.addColorStop(1, '#CBD5E1');
  } else if (style === 'mature_man') {
    bgGrad.addColorStop(0, '#D1D5DB'); // light grey interior wall with soft ambient light
    bgGrad.addColorStop(1, '#9CA3AF');
  } else {
    bgGrad.addColorStop(0, '#F1F5F9'); // campus daylight
    bgGrad.addColorStop(1, '#E2E8F0');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 600, 800);

  // Soft room ambient lighting circle behind head
  const spotGrad = ctx.createRadialGradient(250, 280, 50, 250, 280, 400);
  spotGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
  spotGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, 600, 800);

  // Cast shadow of subject onto wall
  ctx.save();
  ctx.fillStyle = 'rgba(71, 85, 105, 0.18)';
  ctx.beginPath();
  ctx.ellipse(320, 450, 190, 240, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Draw Shoulders & Clothing
  ctx.save();
  if (gender === 'male') {
    // Shoulders (Navy polo shirt / black shirt for mature_man)
    const shirtGrad = ctx.createLinearGradient(100, 500, 500, 800);
    if (style === 'mature_man') {
      shirtGrad.addColorStop(0, '#1c1917');
      shirtGrad.addColorStop(1, '#0c0a09');
    } else {
      shirtGrad.addColorStop(0, '#334155');
      shirtGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = shirtGrad;

    ctx.beginPath();
    ctx.moveTo(100, 800);
    ctx.quadraticCurveTo(150, 560, 220, 520);
    ctx.quadraticCurveTo(300, 570, 380, 520);
    ctx.quadraticCurveTo(450, 560, 500, 800);
    ctx.closePath();
    ctx.fill();

    // Collar
    ctx.fillStyle = style === 'mature_man' ? '#292524' : '#475569';
    ctx.beginPath();
    ctx.moveTo(220, 520);
    ctx.lineTo(260, 580);
    ctx.lineTo(300, 550);
    ctx.lineTo(340, 580);
    ctx.lineTo(380, 520);
    ctx.closePath();
    ctx.fill();
  } else {
    // Female shoulders (Burgundy blouse / smart casual)
    const dressGrad = ctx.createLinearGradient(120, 500, 480, 800);
    dressGrad.addColorStop(0, '#881337');
    dressGrad.addColorStop(1, '#4c0519');
    ctx.fillStyle = dressGrad;

    ctx.beginPath();
    ctx.moveTo(120, 800);
    ctx.quadraticCurveTo(160, 580, 230, 530);
    ctx.quadraticCurveTo(300, 575, 370, 530);
    ctx.quadraticCurveTo(440, 580, 480, 800);
    ctx.closePath();
    ctx.fill();

    // V-neckline
    ctx.fillStyle = '#fb7185';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(235, 535);
    ctx.lineTo(300, 600);
    ctx.lineTo(365, 535);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Neck
  ctx.save();
  const neckGrad = ctx.createLinearGradient(250, 420, 350, 540);
  neckGrad.addColorStop(0, '#fcd34d');
  neckGrad.addColorStop(0.5, '#fbb778');
  neckGrad.addColorStop(1, '#e59b58');
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(250, 430);
  ctx.lineTo(250, 540);
  ctx.lineTo(350, 540);
  ctx.lineTo(350, 430);
  ctx.closePath();
  ctx.fill();

  // Neck shadow under chin
  ctx.fillStyle = 'rgba(163, 85, 45, 0.35)';
  ctx.beginPath();
  ctx.ellipse(300, 440, 60, 25, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // 4. Face Contour & Tone
  ctx.save();
  const faceGrad = ctx.createRadialGradient(280, 310, 30, 300, 330, 160);
  faceGrad.addColorStop(0, '#ffe4cf');
  faceGrad.addColorStop(0.7, '#fcd3af');
  faceGrad.addColorStop(1, '#f1b382');
  ctx.fillStyle = faceGrad;

  ctx.beginPath();
  // Head oval with defined chin
  ctx.moveTo(300, 150); // top
  ctx.bezierCurveTo(420, 150, 430, 280, 410, 370); // right temple & cheek
  ctx.bezierCurveTo(395, 435, 345, 470, 300, 470); // right chin to point
  ctx.bezierCurveTo(255, 470, 205, 435, 190, 370); // point to left chin & cheek
  ctx.bezierCurveTo(170, 280, 180, 150, 300, 150); // left temple back to top
  ctx.fill();

  // Subtle ear outlines
  ctx.fillStyle = '#f1b382';
  // Left ear
  ctx.beginPath();
  ctx.ellipse(180, 340, 18, 38, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Right ear
  ctx.beginPath();
  ctx.ellipse(420, 340, 18, 38, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // 5. Hair
  if (gender === 'male') {
    // Professional styled male short hair
    const hairGrad = ctx.createLinearGradient(200, 100, 400, 260);
    hairGrad.addColorStop(0, '#2d241e');
    hairGrad.addColorStop(1, '#1a1410');
    ctx.fillStyle = hairGrad;

    ctx.beginPath();
    ctx.moveTo(175, 320);
    ctx.quadraticCurveTo(170, 210, 220, 140);
    ctx.quadraticCurveTo(270, 110, 340, 115);
    ctx.quadraticCurveTo(425, 130, 425, 320);
    ctx.quadraticCurveTo(410, 240, 385, 230);
    ctx.quadraticCurveTo(340, 195, 270, 200);
    ctx.quadraticCurveTo(210, 215, 175, 320);
    ctx.closePath();
    ctx.fill();

    // Hair texture strands
    ctx.strokeStyle = '#3e322b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(220 + i * 20, 135 + (i % 3) * 5);
      ctx.quadraticCurveTo(250 + i * 18, 175, 270 + i * 15, 205);
      ctx.stroke();
    }
  } else {
    // Elegant female shoulder-length hair neatly tucked behind ears
    const hairGrad = ctx.createLinearGradient(160, 100, 440, 480);
    hairGrad.addColorStop(0, '#2b1d14');
    hairGrad.addColorStop(0.5, '#1e140d');
    hairGrad.addColorStop(1, '#110a06');
    ctx.fillStyle = hairGrad;

    ctx.beginPath();
    ctx.moveTo(160, 480);
    ctx.quadraticCurveTo(145, 250, 210, 130);
    ctx.quadraticCurveTo(300, 105, 390, 130);
    ctx.quadraticCurveTo(455, 250, 440, 480);
    ctx.quadraticCurveTo(425, 380, 415, 280);
    ctx.quadraticCurveTo(380, 180, 300, 185);
    ctx.quadraticCurveTo(220, 180, 185, 280);
    ctx.quadraticCurveTo(175, 380, 160, 480);
    ctx.closePath();
    ctx.fill();
  }

  // 6. Facial Features (Eyes, Eyebrows, Nose, Mouth)
  // Eyebrows
  ctx.fillStyle = '#261b14';
  // Left eyebrow
  ctx.beginPath();
  ctx.moveTo(225, 275);
  ctx.quadraticCurveTo(260, 260, 280, 273);
  ctx.lineTo(275, 278);
  ctx.quadraticCurveTo(255, 268, 225, 280);
  ctx.fill();
  // Right eyebrow
  ctx.beginPath();
  ctx.moveTo(375, 275);
  ctx.quadraticCurveTo(340, 260, 320, 273);
  ctx.lineTo(325, 278);
  ctx.quadraticCurveTo(345, 268, 375, 280);
  ctx.fill();

  // Eyes
  const drawEye = (cx: number, cy: number) => {
    // Sclera (White)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3d28';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Iris (Dark brown hazel)
    ctx.fillStyle = '#3d2516';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0f0905';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Catchlight (Glance highlight)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 2.5, cy - 2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };
  drawEye(250, 305);
  drawEye(350, 305);

  // Nose
  ctx.strokeStyle = '#c98a58';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(298, 310);
  ctx.lineTo(294, 365);
  ctx.quadraticCurveTo(300, 375, 306, 365);
  ctx.stroke();
  // Nostrils
  ctx.fillStyle = '#b87545';
  ctx.beginPath();
  ctx.ellipse(288, 370, 5, 2, -0.3, 0, Math.PI * 2);
  ctx.ellipse(312, 370, 5, 2, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Natural Smile Lips
  ctx.fillStyle = gender === 'female' ? '#d95368' : '#c9786a';
  // Upper lip
  ctx.beginPath();
  ctx.moveTo(265, 415);
  ctx.quadraticCurveTo(285, 408, 300, 412);
  ctx.quadraticCurveTo(315, 408, 335, 415);
  ctx.quadraticCurveTo(300, 420, 265, 415);
  ctx.fill();
  // Lower lip
  ctx.beginPath();
  ctx.moveTo(268, 416);
  ctx.quadraticCurveTo(300, 435, 332, 416);
  ctx.quadraticCurveTo(300, 422, 268, 416);
  ctx.fill();

  ctx.restore();

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95));
}

export const DEMO_PORTRAITS: DemoPortrait[] = [
  {
    id: 'demo-male-mature',
    name: '示范人像：自然发丝男士 (推荐测试)',
    gender: 'male',
    description: '标准正面免冠、微波浪发丝与自然纹理人像，黑色衬衫，适合测试发丝精细去白边、抗锯齿与智能超清优化',
    avatarUrl: '',
    createFile: async () => {
      const blob = await generateDemoPortraitBlob('male', 'mature_man');
      return new File([blob], 'demo_portrait_mature_man.jpg', { type: 'image/jpeg' });
    },
  },
  {
    id: 'demo-male-business',
    name: '示范人像：青年职场男士',
    gender: 'male',
    description: '标准正面免冠微表情人像，灰蓝室内生活背景，适合测试 AI 抠图换底与 1/2寸制作',
    avatarUrl: '',
    createFile: async () => {
      const blob = await generateDemoPortraitBlob('male', 'young_man');
      return new File([blob], 'demo_portrait_male.jpg', { type: 'image/jpeg' });
    },
  },
  {
    id: 'demo-female-business',
    name: '示范人像：知性职场女士',
    gender: 'female',
    description: '标准正面端庄人像，微乱发丝与室内自然光阴影，适合测试发丝精细扣除与西装换装',
    avatarUrl: '',
    createFile: async () => {
      const blob = await generateDemoPortraitBlob('female', 'business_woman');
      return new File([blob], 'demo_portrait_female.jpg', { type: 'image/jpeg' });
    },
  },
];
