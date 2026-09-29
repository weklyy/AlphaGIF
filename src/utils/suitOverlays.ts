/**
 * Professional Formal Clothes / Suit Collar Overlays for ID Photos (智能正装换装)
 * Generates crisp vector SVG business suits and formal collars for men and women
 */

export interface SuitOverlayOption {
  id: string;
  name: string;
  gender: 'men' | 'women';
  description: string;
  svgContent: string;
  defaultScale: number;
  defaultOffsetY: number;
}

export const SUIT_OVERLAYS: SuitOverlayOption[] = [
  {
    id: 'men-dark-suit-tie',
    name: '男士经典深黑西装（蓝领带）',
    gender: 'men',
    description: '标准深色职业西服套装，搭配纯白翻领衬衫与商务领带，庄重大气',
    defaultScale: 1.0,
    defaultOffsetY: 0,
    svgContent: `
      <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="suitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#242830" />
            <stop offset="50%" stop-color="#181a1f" />
            <stop offset="100%" stop-color="#0f1115" />
          </linearGradient>
          <linearGradient id="lapelGradL" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#2d323b" />
            <stop offset="100%" stop-color="#1a1d22" />
          </linearGradient>
          <linearGradient id="tieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e3a8a" />
            <stop offset="60%" stop-color="#1e40af" />
            <stop offset="100%" stop-color="#172554" />
          </linearGradient>
          <filter id="suitShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" flood-opacity="0.35"/>
          </filter>
        </defs>

        <!-- Base Shoulders & Body -->
        <path d="M 0 320 L 0 170 C 80 145 170 120 205 110 L 250 140 L 295 110 C 330 120 420 145 500 170 L 500 320 Z" fill="url(#suitGrad)" />

        <!-- White Inner Shirt Collars -->
        <polygon points="215,90 250,145 235,160 195,115" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
        <polygon points="285,90 250,145 265,160 305,115" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>

        <!-- Shirt inner V -->
        <polygon points="220,110 250,150 280,110" fill="#f1f5f9"/>

        <!-- Neck Tie Knot & Body -->
        <!-- Knot -->
        <polygon points="240,140 260,140 265,165 250,172 235,165" fill="url(#tieGrad)" filter="url(#suitShadow)"/>
        <!-- Tie Blade -->
        <path d="M 242 170 L 258 170 L 268 290 L 250 315 L 232 290 Z" fill="url(#tieGrad)" filter="url(#suitShadow)"/>
        <!-- Tie pattern lines -->
        <line x1="240" y1="190" x2="260" y2="205" stroke="#3b82f6" stroke-width="2" opacity="0.6"/>
        <line x1="238" y1="225" x2="262" y2="240" stroke="#3b82f6" stroke-width="2" opacity="0.6"/>
        <line x1="235" y1="260" x2="265" y2="275" stroke="#3b82f6" stroke-width="2" opacity="0.6"/>

        <!-- Left Lapel -->
        <path d="M 185 105 L 232 210 L 200 215 L 140 135 Z" fill="url(#lapelGradL)" filter="url(#suitShadow)"/>
        <!-- Right Lapel -->
        <path d="M 315 105 L 268 210 L 300 215 L 360 135 Z" fill="url(#lapelGradL)" filter="url(#suitShadow)"/>

        <!-- Suit lower crossover -->
        <path d="M 230 210 L 270 210 L 285 320 L 215 320 Z" fill="#14171c" opacity="0.75"/>
      </svg>
    `,
  },
  {
    id: 'men-navy-suit',
    name: '男士藏蓝商务西服（红领带）',
    gender: 'men',
    description: '藏青色时尚西服，搭配红色端庄领带，更具朝气与活力',
    defaultScale: 1.0,
    defaultOffsetY: 0,
    svgContent: `
      <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="navySuit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="60%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </linearGradient>
          <linearGradient id="redTie" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#dc2626" />
            <stop offset="60%" stop-color="#b91c1c" />
            <stop offset="100%" stop-color="#7f1d1d" />
          </linearGradient>
        </defs>

        <path d="M 0 320 L 0 170 C 80 145 170 120 205 110 L 250 140 L 295 110 C 330 120 420 145 500 170 L 500 320 Z" fill="url(#navySuit)" />

        <!-- Crisp white collar -->
        <polygon points="215,90 250,145 235,160 195,115" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
        <polygon points="285,90 250,145 265,160 305,115" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>

        <!-- Tie -->
        <polygon points="240,140 260,140 265,165 250,172 235,165" fill="url(#redTie)"/>
        <path d="M 242 170 L 258 170 L 268 290 L 250 315 L 232 290 Z" fill="url(#redTie)"/>

        <!-- Lapels -->
        <path d="M 185 105 L 232 210 L 200 215 L 140 135 Z" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <path d="M 315 105 L 268 210 L 300 215 L 360 135 Z" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      </svg>
    `,
  },
  {
    id: 'women-black-suit',
    name: '女士职业黑西装（白内搭）',
    gender: 'women',
    description: '女士干练收腰剪裁职业西服，V领内衬纯白衬衫，尽显专业知性',
    defaultScale: 0.95,
    defaultOffsetY: -5,
    svgContent: `
      <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="womenSuit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#27272a" />
            <stop offset="60%" stop-color="#18181b" />
            <stop offset="100%" stop-color="#09090b" />
          </linearGradient>
          <linearGradient id="innerShirt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#f1f5f9" />
          </linearGradient>
        </defs>

        <!-- Shoulders & Coat -->
        <path d="M 0 320 L 0 175 C 70 150 160 125 210 115 L 250 155 L 290 115 C 340 125 430 150 500 175 L 500 320 Z" fill="url(#womenSuit)"/>

        <!-- White V-neck inner blouse -->
        <path d="M 215 105 Q 250 130 250 185 Q 250 130 285 105 Z" fill="url(#innerShirt)" stroke="#e2e8f0" stroke-width="1.5"/>

        <!-- Women's Slim Lapels -->
        <path d="M 195 110 L 240 220 L 210 225 L 155 140 Z" fill="#3f3f46" stroke="#27272a" stroke-width="1"/>
        <path d="M 305 110 L 260 220 L 290 225 L 345 140 Z" fill="#3f3f46" stroke="#27272a" stroke-width="1"/>
      </svg>
    `,
  },
  {
    id: 'formal-white-shirt',
    name: '经典翻领纯白正装衬衫',
    gender: 'men',
    description: '干净利索的白色翻领衬衫，百搭各类报名与学生考试证件照',
    defaultScale: 0.98,
    defaultOffsetY: -5,
    svgContent: `
      <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#e2e8f0" />
          </linearGradient>
        </defs>

        <!-- Base Shoulders -->
        <path d="M 0 320 L 0 170 C 80 145 170 120 205 110 L 250 140 L 295 110 C 330 120 420 145 500 170 L 500 320 Z" fill="url(#shirtGrad)" stroke="#cbd5e1" stroke-width="1.5"/>

        <!-- Collar Left -->
        <polygon points="210,88 248,140 230,165 185,115" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <!-- Collar Right -->
        <polygon points="290,88 252,140 270,165 315,115" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>

        <!-- Center Placket & Buttons -->
        <rect x="242" y="140" width="16" height="180" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        <circle cx="250" cy="180" r="4" fill="#cbd5e1"/>
        <circle cx="250" cy="230" r="4" fill="#cbd5e1"/>
        <circle cx="250" cy="280" r="4" fill="#cbd5e1"/>
      </svg>
    `,
  },
];

/**
 * Cache for loaded SVG images
 */
const suitImageCache = new Map<string, HTMLImageElement>();

/**
 * Get or load HTMLImageElement for a suit option
 */
export async function getSuitImage(suitId: string): Promise<HTMLImageElement | null> {
  if (suitImageCache.has(suitId)) {
    return suitImageCache.get(suitId)!;
  }
  const option = SUIT_OVERLAYS.find((s) => s.id === suitId);
  if (!option) return null;

  const blob = new Blob([option.svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load suit overlay SVG'));
    img.src = url;
  });

  suitImageCache.set(suitId, img);
  return img;
}

/**
 * Draw suit overlay onto ID photo canvas at chest/neck level
 */
export function drawSuitOverlay(
  ctx: CanvasRenderingContext2D,
  suitImg: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  scale: number = 1.0,
  offsetY: number = 0
) {
  ctx.save();
  // Suit target width matches or slightly spans canvas width
  const baseW = canvasW * 1.05 * scale;
  const aspect = suitImg.naturalWidth / suitImg.naturalHeight;
  const baseH = baseW / aspect;

  // Place suit so collar aligns with lower third of portrait canvas
  const x = (canvasW - baseW) / 2;
  const y = canvasH - baseH + offsetY;

  ctx.drawImage(suitImg, x, y, baseW, baseH);
  ctx.restore();
}
