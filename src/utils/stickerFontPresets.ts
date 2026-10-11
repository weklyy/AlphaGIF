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

export interface StickerTextConfig {
  text: string;
  fontId: string;
  fontFamily?: string;
  fontSize: number; // 12 - 64
  color: string; // Hex color
  strokeEnabled: boolean; // default true
  strokeColor: string; // Hex color
  strokeWidth: number; // 0 - 8
  position: 'bottom' | 'top' | 'center' | 'custom';
  offsetY: number; // -50 ~ 50 px
  offsetX?: number;
  textAlign?: 'center' | 'left' | 'right';
  fontWeight?: string;
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
  position: 'bottom',
  offsetY: 0,
  offsetX: 0,
  textAlign: 'center',
  fontWeight: 'normal',
};

/**
 * Cleanly draws the stylized text overlay with fill & stroke on any 2D canvas context
 */
export function drawStickerText(
  ctx: CanvasRenderingContext2D,
  config: StickerTextConfig,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!config.text || config.text.trim().length === 0) return;

  const text = config.text.trim();
  const fontPreset = OPEN_SOURCE_FONTS.find((f) => f.id === config.fontId) || OPEN_SOURCE_FONTS[0];
  const fontFamily = config.fontFamily || fontPreset.cssFamily;
  const weight = config.fontWeight || fontPreset.defaultWeight;
  const fontSize = Math.max(10, config.fontSize || 24);

  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = (config.textAlign || 'center') as CanvasTextAlign;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;

  // Determine X coordinate
  let textX = canvasWidth / 2;
  if (config.textAlign === 'left') {
    textX = 16;
  } else if (config.textAlign === 'right') {
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

  ctx.restore();
}
