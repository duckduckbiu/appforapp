/**
 * 图片打码工具 - Canvas 实现
 * 支持模糊、马赛克、色块、贴纸等多种打码效果
 */

export interface MaskRegion {
  id: string;
  x: number;      // 百分比 0-100
  y: number;      // 百分比 0-100
  width: number;  // 百分比 0-100
  height: number; // 百分比 0-100
  shape: 'rectangle' | 'circle' | 'freehand' | 'lasso';
  style: 'solid' | 'blur' | 'mosaic' | 'sticker';
  blurIntensity?: number;    // 模糊强度 (1-100)
  mosaicIntensity?: number;  // 马赛克强度 (1-100)
  stickerUrl?: string;       // 贴纸图片 URL
  rotation?: number;         // 旋转角度
  path?: string;             // SVG path for freehand/lasso
  points?: { x: number; y: number }[]; // 百分比坐标点
  price?: number;
}

// 缓存已加载的图片
const imageCache = new Map<string, HTMLImageElement>();

/**
 * 加载图片
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * 应用马赛克效果 - 使用像素块平均色
 */
function applyMosaic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  pixelSize: number
): void {
  // 确保像素大小合理
  const blockSize = Math.max(4, Math.min(pixelSize, Math.min(width, height) / 2));
  
  // 获取区域图像数据
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  
  // 按块处理
  for (let py = 0; py < height; py += blockSize) {
    for (let px = 0; px < width; px += blockSize) {
      // 计算当前块的边界
      const blockW = Math.min(blockSize, width - px);
      const blockH = Math.min(blockSize, height - py);
      
      // 计算平均颜色
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
      }
      
      // 用平均颜色填充整个块
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);
      
      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }
  
  ctx.putImageData(imageData, x, y);
}

/**
 * 应用模糊效果 - 使用 StackBlur 算法
 */
function applyBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  
  // 简化的 Box Blur (多次迭代近似高斯模糊)
  const iterations = 3;
  const kernelSize = Math.max(1, Math.floor(radius / iterations));
  
  for (let iter = 0; iter < iterations; iter++) {
    // 水平模糊
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let k = -kernelSize; k <= kernelSize; k++) {
          const srcCol = Math.min(Math.max(col + k, 0), width - 1);
          const i = (row * width + srcCol) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
        
        const i = (row * width + col) * 4;
        data[i] = r / count;
        data[i + 1] = g / count;
        data[i + 2] = b / count;
        data[i + 3] = a / count;
      }
    }
    
    // 垂直模糊
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let k = -kernelSize; k <= kernelSize; k++) {
          const srcRow = Math.min(Math.max(row + k, 0), height - 1);
          const i = (srcRow * width + col) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
        
        const i = (row * width + col) * 4;
        data[i] = r / count;
        data[i + 1] = g / count;
        data[i + 2] = b / count;
        data[i + 3] = a / count;
      }
    }
  }
  
  ctx.putImageData(imageData, x, y);
}

/**
 * 绘制圆角矩形路径
 */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 绘制自由路径 (freehand/lasso)
 */
function drawFreePath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  imgWidth: number,
  imgHeight: number,
  close: boolean
): void {
  if (points.length < 2) return;
  
  ctx.beginPath();
  const startX = (points[0].x / 100) * imgWidth;
  const startY = (points[0].y / 100) * imgHeight;
  ctx.moveTo(startX, startY);
  
  for (let i = 1; i < points.length; i++) {
    const px = (points[i].x / 100) * imgWidth;
    const py = (points[i].y / 100) * imgHeight;
    ctx.lineTo(px, py);
  }
  
  if (close) {
    ctx.closePath();
  }
}

/**
 * 应用单个区域的遮罩效果
 */
async function applyRegionMask(
  ctx: CanvasRenderingContext2D,
  region: MaskRegion,
  imgWidth: number,
  imgHeight: number,
  maskColor: string = '#8B5CF6'
): Promise<void> {
  const x = (region.x / 100) * imgWidth;
  const y = (region.y / 100) * imgHeight;
  const w = (region.width / 100) * imgWidth;
  const h = (region.height / 100) * imgHeight;
  const radius = Math.min(w, h) * 0.05;
  
  // 保存当前状态
  ctx.save();
  
  // 应用旋转
  if (region.rotation) {
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((region.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }
  
  // 创建裁剪路径
  if (region.shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if ((region.shape === 'freehand' || region.shape === 'lasso') && region.points) {
    drawFreePath(ctx, region.points, imgWidth, imgHeight, region.shape === 'lasso');
  } else {
    roundedRectPath(ctx, x, y, w, h, radius);
  }
  
  // 应用效果
  switch (region.style) {
    case 'blur': {
      // 裁剪区域
      ctx.clip();
      // 获取区域边界
      const clipX = Math.max(0, Math.floor(x - 2));
      const clipY = Math.max(0, Math.floor(y - 2));
      const clipW = Math.min(imgWidth - clipX, Math.ceil(w + 4));
      const clipH = Math.min(imgHeight - clipY, Math.ceil(h + 4));
      // 将 1-100 范围转换为实际模糊半径
      // 100 时应该完全看不清，使用更大的半径和更多迭代
      const intensity = region.blurIntensity || 30;
      const blurRadius = Math.max(2, Math.round(intensity * 1.5));
      // 多次应用模糊以增强效果
      const iterations = intensity > 50 ? 3 : intensity > 25 ? 2 : 1;
      for (let i = 0; i < iterations; i++) {
        applyBlur(ctx, clipX, clipY, clipW, clipH, blurRadius);
      }
      break;
    }
    
    case 'mosaic': {
      // 裁剪区域
      ctx.clip();
      // 获取区域边界
      const clipX = Math.max(0, Math.floor(x));
      const clipY = Math.max(0, Math.floor(y));
      const clipW = Math.min(imgWidth - clipX, Math.ceil(w));
      const clipH = Math.min(imgHeight - clipY, Math.ceil(h));
      // 将 1-100 范围转换为像素块大小
      // 100 时块应该非常大，完全看不清细节
      const intensity = region.mosaicIntensity || 30;
      // 块大小基于区域尺寸的比例，100时块占区域的20%
      const maxBlockSize = Math.min(clipW, clipH) * 0.25;
      const minBlockSize = 4;
      const pixelSize = Math.round(minBlockSize + (maxBlockSize - minBlockSize) * (intensity / 100));
      applyMosaic(ctx, clipX, clipY, clipW, clipH, pixelSize);
      break;
    }
    
    case 'sticker': {
      if (region.stickerUrl) {
        try {
          const stickerImg = await loadImage(region.stickerUrl);
          // 先裁剪区域
          ctx.clip();
          // 填充白色背景
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, w, h);
          // 计算贴纸大小（基于区域大小）
          const stickerSize = Math.max(16, Math.min(w, h) * 0.25);
          // 平铺贴纸
          for (let sy = y; sy < y + h; sy += stickerSize) {
            for (let sx = x; sx < x + w; sx += stickerSize) {
              ctx.drawImage(stickerImg, sx, sy, stickerSize, stickerSize);
            }
          }
        } catch {
          // 贴纸加载失败，使用色块代替
          ctx.fillStyle = maskColor;
          ctx.fill();
        }
      } else {
        // 没有贴纸 URL，使用色块
        ctx.fillStyle = maskColor;
        ctx.fill();
      }
      break;
    }
    
    case 'solid':
    default: {
      // 纯色块填充，完全不透明，不显示锁图标
      ctx.fillStyle = maskColor;
      ctx.fill();
      break;
    }
  }
  
  ctx.restore();
}

/**
 * 生成打码图片
 * @param imageSource 原始图片（File, Blob 或 URL）
 * @param regions 需要遮挡的区域
 * @param maskColor 遮挡颜色，默认使用主题色
 * @returns 打码后的图片 Blob
 */
export async function generateMaskedImage(
  imageSource: File | Blob | string,
  regions: MaskRegion[],
  maskColor: string = '#8B5CF6'
): Promise<Blob> {
  // 加载图片
  let img: HTMLImageElement;
  
  if (typeof imageSource === 'string') {
    img = await loadImage(imageSource);
  } else {
    const objectUrl = URL.createObjectURL(imageSource);
    try {
      img = await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  
  // 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // 绘制原图
  ctx.drawImage(img, 0, 0);
  
  // 应用所有遮罩区域
  for (const region of regions) {
    await applyRegionMask(ctx, region, img.width, img.height, maskColor);
  }
  
  // 导出为 Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate masked image blob'));
        }
      },
      'image/jpeg',
      0.92
    );
  });
}

/**
 * 生成预览用的打码图片 URL
 * 用于编辑器实时预览
 */
export async function generateMaskedPreviewUrl(
  imageSource: string,
  regions: MaskRegion[],
  maskColor: string = '#8B5CF6'
): Promise<string> {
  const blob = await generateMaskedImage(imageSource, regions, maskColor);
  return URL.createObjectURL(blob);
}

/**
 * 从 URL 加载图片并生成打码版本
 */
export async function generateMaskedImageFromUrl(
  imageUrl: string,
  regions: MaskRegion[],
  maskColor: string = '#8B5CF6'
): Promise<Blob> {
  return generateMaskedImage(imageUrl, regions, maskColor);
}
