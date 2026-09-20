import JSZip from 'jszip';
import { SlicedStickerItem, WeChatMaterialsState } from '../types';

export const WECHAT_STATIC_SPEC_DOC_TEXT = `=======================================================
   微信开放平台 • 静态表情专辑全套审核物料规范对照表
=======================================================

【静态表情专辑物料清单与标准】：
1. 01_表情主图_240x240_PNG/
   - 格式：严格为 PNG 格式（微信官方静态表情专辑唯一接收格式，严禁使用GIF！）
   - 尺寸：严格 240 × 240 像素
   - 体积：每张必须小于 500KB（本工具生成文件均在 50KB ~ 250KB 间）
   - 背景：透明背景，必须具备清晰边缘，建议添加 2px 白色描边保护
   - 数量：8 / 16 / 24 张（切片套系已严格对应官方数量）
   - 审核红线：静态表情上传严禁提交 GIF 格式文件；深浅色聊天背景均需清晰可见。

2. 02_详情页横幅_750x400.png
   - 格式：PNG / JPG
   - 尺寸：严格 750 × 400 像素
   - 审核红线：
     * 严禁出现任何文字（包括表情名、IP 名、宣传语等）！
     * 严禁纯白背景（#FFFFFF）！
     * 严禁透明背景！
     * 色调活泼明朗，元素不得变形拉伸。

3. 03_表情封面图_240x240.png
   - 格式：PNG
   - 尺寸：严格 240 × 240 像素
   - 体积：小于 80KB
   - 审核红线：必须为透明背景，避免白色背景与锯齿描边；选取最具辨识度的正面半身/全身形象。

4. 04_聊天页图标_50x50.png
   - 格式：PNG
   - 尺寸：严格 50 × 50 像素
   - 体积：小于 30KB
   - 审核红线：必须为透明背景，严禁正方形边框/生硬直角；展示角色头部正面微距特写。

5. 05_赞赏引导图_750x560.png
   - 格式：PNG / JPG
   - 尺寸：严格 750 × 560 像素
   - 体积：小于 100KB
   - 审核红线：展示在赞赏金额选择页；风格与表情高度一致，无无关内容。

6. 06_赞赏致谢图_750x750.png
   - 格式：PNG / JPG
   - 尺寸：严格 750 × 750 像素
   - 体积：小于 200KB
   - 审核红线：赞赏后答谢卡片；正方形比例，画面吸引人激发分享意愿。

=======================================================
【上传流程说明】：
1. 登录微信表情开放平台 (sticker.weixin.qq.com)。
2. 创建表情专辑，选择「静态表情专辑」，填写表情名称与简介。
3. 进入「上传表情主图」，直接全选解压后 01_表情主图_240x240_PNG/ 文件夹内的全部 PNG 文件。
4. 进入「上传配套素材」，逐项对应上传：
   - 详情页横幅 ➔ 02_详情页横幅_750x400.png
   - 表情封面图 ➔ 03_表情封面图_240x240.png
   - 聊天页图标 ➔ 04_聊天页图标_50x50.png
   - 赞赏引导图 ➔ 05_赞赏引导图_750x560.png
   - 赞赏致谢图 ➔ 06_赞赏致谢图_750x750.png
5. 确认无误，提交微信官方人工审核。
=======================================================
`;

export const WECHAT_DYNAMIC_SPEC_DOC_TEXT = `=======================================================
   微信开放平台 • 动态表情专辑全套审核物料规范对照表
=======================================================

【动态表情专辑物料清单与标准】：
1. 01_表情主图_240x240_GIF/
   - 格式：严格为 GIF 格式（微信官方动态表情专辑规范格式）
   - 尺寸：严格 240 × 240 像素
   - 体积：每张必须小于 1MB（建议 500KB 以下）
   - 数量：8 / 16 / 24 张（切片套系已严格对应官方数量）
   - 审核红线：循环播放，节奏流畅不卡顿；必须有 2px 白色描边或统一风格，深浅色聊天背景均需清晰可见。

2. 02_详情页横幅_750x400.png
   - 格式：PNG / JPG
   - 尺寸：严格 750 × 400 像素
   - 审核红线：
     * 严禁出现任何文字（包括表情名、IP 名、宣传语等）！
     * 严禁纯白背景（#FFFFFF）！
     * 严禁透明背景！
     * 色调活泼明朗，元素不得变形拉伸。

3. 03_表情封面图_240x240.png
   - 格式：PNG
   - 尺寸：严格 240 × 240 像素
   - 体积：小于 80KB
   - 审核红线：必须为透明背景，避免白色背景与锯齿描边；选取最具辨识度的正面半身/全身形象。

4. 04_聊天页图标_50x50.png
   - 格式：PNG
   - 尺寸：严格 50 × 50 像素
   - 体积：小于 30KB
   - 审核红线：必须为透明背景，严禁正方形边框/生硬直角；展示角色头部正面微距特写。

5. 05_赞赏引导图_750x560.png
   - 格式：PNG / JPG
   - 尺寸：严格 750 × 560 像素
   - 体积：小于 100KB
   - 审核红线：展示在赞赏金额选择页；风格与表情高度一致，无无关内容。

6. 06_赞赏致谢图_750x750.png
   - 格式：PNG / JPG
   - 尺寸：严格 750 × 750 像素
   - 体积：小于 200KB
   - 审核红线：赞赏后答谢卡片；正方形比例，画面吸引人激发分享意愿。

=======================================================
【上传流程说明】：
1. 登录微信表情开放平台 (sticker.weixin.qq.com)。
2. 创建表情专辑，选择「动态表情专辑」，填写表情名称与简介。
3. 进入「上传表情主图」，直接全选解压后 01_表情主图_240x240_GIF/ 文件夹内的全部 GIF 文件。
4. 进入「上传配套素材」，逐项对应上传：
   - 详情页横幅 ➔ 02_详情页横幅_750x400.png
   - 表情封面图 ➔ 03_表情封面图_240x240.png
   - 聊天页图标 ➔ 04_聊天页图标_50x50.png
   - 赞赏引导图 ➔ 05_赞赏引导图_750x560.png
   - 赞赏致谢图 ➔ 06_赞赏致谢图_750x750.png
5. 确认无误，提交微信官方人工审核。
=======================================================
`;

export const WECHAT_SPEC_DOC_TEXT = WECHAT_STATIC_SPEC_DOC_TEXT;

/**
 * 判断表情是否为静态表情（单帧、PNG或无动画时长）
 */
export function isStaticStickerSet(stickers: SlicedStickerItem[]): boolean {
  if (stickers.length === 0) return true;
  return stickers.every(
    (s) =>
      s.name.toLowerCase().endsWith('.png') ||
      s.blob.type === 'image/png' ||
      (s.frameCount <= 1 && (!s.duration || s.duration === 0))
  );
}

/**
 * 确保 Blob 为标准的 PNG 格式
 */
async function ensurePngBlob(item: SlicedStickerItem): Promise<Blob> {
  if (item.blob.type === 'image/png') {
    return item.blob;
  }
  // If not png, convert via canvas to proper png
  return new Promise<Blob>((resolve) => {
    const img = new Image();
    const url = item.url || URL.createObjectURL(item.blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = item.width || 240;
      canvas.height = item.height || 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          if (url !== item.url) URL.revokeObjectURL(url);
          resolve(b || item.blob);
        }, 'image/png');
      } else {
        if (url !== item.url) URL.revokeObjectURL(url);
        resolve(item.blob);
      }
    };
    img.onerror = () => {
      if (url !== item.url) URL.revokeObjectURL(url);
      resolve(item.blob);
    };
    img.src = url;
  });
}

/**
 * 导出微信表情全套物料包（自动识别静态专辑 PNG 与动态专辑 GIF）
 */
export async function exportWeChatPackageZip(
  stickers: SlicedStickerItem[],
  materials: WeChatMaterialsState,
  packageName: string = '微信表情审核全套物料包'
): Promise<void> {
  const isStatic = isStaticStickerSet(stickers);
  const zip = new JSZip();
  const rootFolder = zip.folder(packageName) || zip;

  // 1. 01_表情主图（静态为 240x240 PNG，动态为 240x240 GIF）
  const folderName = isStatic ? '01_表情主图_240x240_PNG' : '01_表情主图_240x240_GIF';
  const stickersFolder = rootFolder.folder(folderName);
  if (stickersFolder) {
    for (let i = 0; i < stickers.length; i++) {
      const s = stickers[i];
      const numStr = String(s.index).padStart(2, '0');
      if (isStatic) {
        const pngBlob = await ensurePngBlob(s);
        const filename = `${numStr}_T.png`;
        stickersFolder.file(filename, pngBlob);
      } else {
        const filename = `${numStr}_T.gif`;
        stickersFolder.file(filename, s.blob);
      }
    }
  }

  // 2. 02_详情页横幅_750x400.png
  if (materials.banner.blob) {
    rootFolder.file('02_详情页横幅_750x400.png', materials.banner.blob);
  }

  // 3. 03_表情封面图_240x240.png
  if (materials.cover.blob) {
    rootFolder.file('03_表情封面图_240x240.png', materials.cover.blob);
  }

  // 4. 04_聊天页图标_50x50.png
  if (materials.icon.blob) {
    rootFolder.file('04_聊天页图标_50x50.png', materials.icon.blob);
  }

  // 5. 05_赞赏引导图_750x560.png
  if (materials.rewardGuide.blob) {
    rootFolder.file('05_赞赏引导图_750x560.png', materials.rewardGuide.blob);
  }

  // 6. 06_赞赏致谢图_750x750.png
  if (materials.rewardThanks.blob) {
    rootFolder.file('06_赞赏致谢图_750x750.png', materials.rewardThanks.blob);
  }

  // 7. 使用说明与微信审核规范对照表.txt
  const docText = isStatic ? WECHAT_STATIC_SPEC_DOC_TEXT : WECHAT_DYNAMIC_SPEC_DOC_TEXT;
  rootFolder.file('使用说明与微信审核规范对照表.txt', docText);

  // Generate and trigger download
  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = downloadUrl;
  const albumSuffix = isStatic ? '静态表情专辑_PNG' : '动态表情专辑_GIF';
  a.download = `${packageName}_${albumSuffix}_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * 仅导出表情主图切片包 ZIP（快速获取全部 240x240 PNG/GIF）
 */
export async function exportSlicedStickersOnlyZip(
  stickers: SlicedStickerItem[],
  customName?: string
): Promise<void> {
  if (stickers.length === 0) return;
  const isStatic = isStaticStickerSet(stickers);
  const zip = new JSZip();
  const folderName = isStatic ? '01_表情主图_240x240_PNG' : '01_表情主图_240x240_GIF';
  const folder = zip.folder(folderName) || zip;

  for (let i = 0; i < stickers.length; i++) {
    const s = stickers[i];
    const numStr = String(s.index).padStart(2, '0');
    if (isStatic) {
      const pngBlob = await ensurePngBlob(s);
      const filename = `${numStr}_T.png`;
      folder.file(filename, pngBlob);
    } else {
      const filename = `${numStr}_T.gif`;
      folder.file(filename, s.blob);
    }
  }

  const defaultTitle = isStatic ? '微信静态表情主图包_240x240_PNG' : '微信动态表情主图包_240x240_GIF';
  const fileName = (customName || defaultTitle) + `_${Date.now()}.zip`;

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

