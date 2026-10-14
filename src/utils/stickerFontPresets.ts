/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpenFontPreset {
  id: string;
  name: string;
  displayName: string;
  cssFamily: string;
  fallbackFamily: string;
  license: string;
  tag: string;
  category: 'comic' | 'bold' | 'calligraphy' | 'standard' | 'serif';
  defaultWeight: string;
}

export const OPEN_SOURCE_FONTS: OpenFontPreset[] = [
  {
    id: 'zcool-kuaile',
    name: '站酷快乐体',
    displayName: '站酷快乐体 (经典搞怪/爆款表情)',
    cssFamily: '"ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif',
    fallbackFamily: 'sans-serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '爆笑搞怪',
    category: 'comic',
    defaultWeight: 'normal',
  },
  {
    id: 'zcool-huangyou',
    name: '站酷黄油体',
    displayName: '站酷黄油体 (醒目厚重/圆润粗体)',
    cssFamily: '"ZCOOL QingKe HuangYou", "PingFang SC", "Microsoft YaHei", sans-serif',
    fallbackFamily: 'sans-serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '醒目粗体',
    category: 'bold',
    defaultWeight: 'normal',
  },
  {
    id: 'mashanzheng',
    name: '马善政毛笔楷书',
    displayName: '马善政毛笔楷书 (霸气豪放/热血书法)',
    cssFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive, serif',
    fallbackFamily: 'serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '豪气书法',
    category: 'calligraphy',
    defaultWeight: 'normal',
  },
  {
    id: 'longcang',
    name: '龙藏行草体',
    displayName: '龙藏行草体 (潇洒不羁/行云流水)',
    cssFamily: '"Long Cang", "STKaiti", "KaiTi", cursive, serif',
    fallbackFamily: 'serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '潇洒行草',
    category: 'calligraphy',
    defaultWeight: 'normal',
  },
  {
    id: 'noto-sans-sc',
    name: '思源黑体 Heavy',
    displayName: '思源黑体 Heavy (清晰现代/正规大气)',
    cssFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    fallbackFamily: 'sans-serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '清晰标准',
    category: 'standard',
    defaultWeight: '900',
  },
  {
    id: 'noto-serif-sc',
    name: '思源宋体 Bold',
    displayName: '思源宋体 Bold (典雅古风/高级文艺)',
    cssFamily: '"Noto Serif SC", "Songti SC", "SimSun", serif',
    fallbackFamily: 'serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '典雅复古',
    category: 'serif',
    defaultWeight: '700',
  },
  {
    id: 'zcool-xiaowei',
    name: '站酷小薇体',
    displayName: '站酷小薇体 (秀气清瘦/温柔文雅)',
    cssFamily: '"ZCOOL XiaoWei", "Songti SC", serif',
    fallbackFamily: 'serif',
    license: 'SIL Open Font License (开源免费可商用)',
    tag: '文艺清秀',
    category: 'serif',
    defaultWeight: 'normal',
  },
  {
    id: 'system-sans',
    name: '系统粗黑体',
    displayName: '系统粗黑体 (超强兼容/微软雅黑/苹果黑)',
    cssFamily: '"PingFang SC", "Microsoft YaHei", "SimHei", system-ui, sans-serif',
    fallbackFamily: 'sans-serif',
    license: '系统预装标准字体 (安全无侵权风险)',
    tag: '通用极速',
    category: 'standard',
    defaultWeight: '900',
  },
];

export interface TextColorPreset {
  name: string;
  value: string;
  isLight?: boolean;
}

export const TEXT_COLOR_PRESETS: TextColorPreset[] = [
  { name: '纯白 (推荐)', value: '#ffffff', isLight: true },
  { name: '爆笑金黄', value: '#ffe600', isLight: true },
  { name: '活力亮橙', value: '#ff6600', isLight: false },
  { name: '荧光绿', value: '#00e676', isLight: true },
  { name: '亮青蓝', value: '#00e5ff', isLight: true },
  { name: '烈焰红', value: '#ff2d55', isLight: false },
  { name: '甜心粉', value: '#ff69b4', isLight: true },
  { name: '深沉黑', value: '#111111', isLight: false },
];

export const STROKE_COLOR_PRESETS: TextColorPreset[] = [
  { name: '纯黑描边 (最醒目防吃字)', value: '#000000', isLight: false },
  { name: '纯白描边 (适合深色字)', value: '#ffffff', isLight: true },
  { name: '深褐红', value: '#660000', isLight: false },
  { name: '藏青蓝', value: '#091e3a', isLight: false },
  { name: '暗墨绿', value: '#003314', isLight: false },
  { name: '深暗紫', value: '#3a0842', isLight: false },
];

export const QUICK_MEME_TEXTS: string[] = [
  '收到',
  '好的',
  '哈哈哈哈',
  '点赞',
  '哭死',
  '无语',
  '冲鸭',
  '栓Q',
  '绝了',
  '退！退！退！',
  '大笑',
  '暗中观察',
  '告辞',
  '干饭',
  '安排',
  '震惊',
  '芜湖起飞',
  '裂开',
];

export interface EraseAction {
  id?: string;
  type: 'brush' | 'rect';
  fillType: 'color' | 'transparent';
  color: string; // Hex color if color fill
  size: number; // brush diameter
  points?: { x: number; y: number }[]; // for brush strokes
  rect?: { x: number; y: number; w: number; h: number }; // for box erase
}

export interface StickerTextConfig {
  text: string;
  fontId: string;
  fontFamily?: string;
  fontSize: number; // 12 - 64
  color: string; // Hex color
  strokeEnabled: boolean; // default true
  strokeColor: string; // Hex color
  strokeWidth: number; // 0 - 8
  orientation?: 'horizontal' | 'vertical'; // Horizontal or Vertical layout
  position: 'bottom' | 'top' | 'center' | 'left' | 'right' | 'custom';
  offsetY: number; // -50 ~ 50 px
  offsetX?: number;
  textAlign?: 'center' | 'left' | 'right';
  fontWeight?: string;
  eraseActions?: EraseAction[]; // Saved eraser operations to wipe out original text
}

export const DEFAULT_STICKER_TEXT_CONFIG: StickerTextConfig = {
  text: '',
  fontId: 'zcool-kuaile',
  fontFamily: '"ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: 26,
  color: '#ffffff',
  strokeEnabled: true,
  strokeColor: '#000000',
  strokeWidth: 4,
  orientation: 'horizontal',
  position: 'bottom',
  offsetY: 0,
  offsetX: 0,
  textAlign: 'center',
  fontWeight: 'normal',
  eraseActions: [],
};

/**
 * Applies all recorded manual erase actions (brush strokes or box wipes)
 * onto a 2D canvas context. Supports transparent punching and solid/color masking.
 */
export function applyEraseActions(
  ctx: CanvasRenderingContext2D,
  actions?: EraseAction[]
) {
  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    ctx.save();
    if (action.fillType === 'transparent') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = action.color || '#ffffff';
      ctx.strokeStyle = action.color || '#ffffff';
    }

    if (action.type === 'rect' && action.rect) {
      const { x, y, w, h } = action.rect;
      const rx = Math.min(x, x + w);
      const ry = Math.min(y, y + h);
      const rw = Math.abs(w);
      const rh = Math.abs(h);
      ctx.fillRect(rx, ry, rw, rh);
    } else if (action.type === 'brush' && action.points && action.points.length > 0) {
      const pts = action.points;
      const radius = Math.max(1, (action.size || 16) / 2);

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = action.size || 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/**
 * Cleanly draws the stylized text overlay with fill & stroke on any 2D canvas context.
 * Supports both horizontal (横排) and vertical (竖排) layouts.
 */
export function drawStickerText(
  ctx: CanvasRenderingContext2D,
  config: StickerTextConfig,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!config.text || config.text.trim().length === 0) return;

  const fontPreset = OPEN_SOURCE_FONTS.find((f) => f.id === config.fontId) || OPEN_SOURCE_FONTS[0];
  const fontFamily = config.fontFamily || fontPreset.cssFamily;
  const weight = config.fontWeight || fontPreset.defaultWeight;
  const fontSize = Math.max(10, config.fontSize || 24);
  const orientation = config.orientation || 'horizontal';

  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;

  if (orientation === 'vertical') {
    // -------------------------------------------------------------
    // VERTICAL LAYOUT (竖排文字)
    // -------------------------------------------------------------
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Support multiline (\n) or single line vertical column
    const rawLines = config.text.split('\n');
    const lines = rawLines.length > 0 ? rawLines : [config.text];
    const colStepX = Math.round(fontSize * 1.25);
    const charStepY = Math.round(fontSize * 1.12);

    // Compute base X coordinate
    // For vertical Chinese, default right side or centered
    let startX = canvasWidth - 18 - fontSize / 2; // default right side
    if (config.position === 'left') {
      startX = 18 + fontSize / 2 + (lines.length - 1) * colStepX;
    } else if (config.position === 'center' || config.position === 'top' || config.position === 'bottom') {
      const totalColsW = (lines.length - 1) * colStepX;
      startX = Math.round((canvasWidth + totalColsW) / 2);
    } else if (config.position === 'right') {
      startX = canvasWidth - 18 - fontSize / 2;
    }

    if (config.offsetX) {
      startX += config.offsetX;
    }

    // Draw each vertical column (standard right-to-left column progression)
    lines.forEach((line, colIdx) => {
      const colX = startX - colIdx * colStepX;
      const chars = Array.from(line);
      if (chars.length === 0) return;

      const totalColH = chars.length * charStepY;

      // Base Y coordinate
      let startY = Math.round((canvasHeight - totalColH) / 2) + charStepY / 2; // default center
      if (config.position === 'top') {
        startY = 14 + charStepY / 2;
      } else if (config.position === 'bottom') {
        startY = canvasHeight - totalColH + charStepY / 2 - 12;
      }
      if (config.offsetY) {
        startY += config.offsetY;
      }

      chars.forEach((char, charIdx) => {
        const charY = startY + charIdx * charStepY;

        // Outline stroke
        if (config.strokeEnabled && config.strokeWidth > 0) {
          ctx.lineWidth = Math.max(1, config.strokeWidth * 2);
          ctx.strokeStyle = config.strokeColor || '#000000';
          ctx.strokeText(char, colX, charY);
        }

        // Solid fill
        ctx.fillStyle = config.color || '#ffffff';
        ctx.fillText(char, colX, charY);
      });
    });
  } else {
    // -------------------------------------------------------------
    // HORIZONTAL LAYOUT (横排文字)
    // -------------------------------------------------------------
    const text = config.text.trim();
    ctx.textAlign = (config.textAlign || 'center') as CanvasTextAlign;
    ctx.textBaseline = 'alphabetic';

    // Determine X coordinate
    let textX = canvasWidth / 2;
    if (config.position === 'left' || config.textAlign === 'left') {
      textX = 16;
    } else if (config.position === 'right' || config.textAlign === 'right') {
      textX = canvasWidth - 16;
    }
    if (config.offsetX) {
      textX += config.offsetX;
    }

    // Determine Y coordinate based on position
    let textY = canvasHeight - 12; // default bottom
    if (config.position === 'top') {
      textY = fontSize + 8;
    } else if (config.position === 'center') {
      textY = Math.round(canvasHeight / 2 + fontSize / 3);
    } else if (config.position === 'bottom') {
      textY = canvasHeight - 10;
    }
    if (config.offsetY) {
      textY += config.offsetY;
    }

    // Draw stroke outline if enabled
    if (config.strokeEnabled && config.strokeWidth > 0) {
      ctx.lineWidth = Math.max(1, config.strokeWidth * 2); // 2x because stroke is centered on glyph boundary
      ctx.strokeStyle = config.strokeColor || '#000000';
      ctx.strokeText(text, textX, textY);
    }

    // Draw solid fill
    ctx.fillStyle = config.color || '#ffffff';
    ctx.fillText(text, textX, textY);
  }

  ctx.restore();
}

