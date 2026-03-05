// 压缩预设配置
export const COMPRESSION_PRESETS = {
  avatar: { maxWidth: 400, maxHeight: 400, quality: 0.85 },
  cover: { maxWidth: 1920, maxHeight: 640, quality: 0.85 },
  post: { maxWidth: 1920, maxHeight: 1920, quality: 0.85 },
  post_thumb: { maxWidth: 400, maxHeight: 400, quality: 0.7 }, // Feed 缩略图
  message: { maxWidth: 1200, maxHeight: 1200, quality: 0.8 },
  background: { maxWidth: 1920, maxHeight: 1080, quality: 0.8 },
} as const;

export type CompressionPreset = keyof typeof COMPRESSION_PRESETS;

/**
 * 检测浏览器是否支持 WebP 格式
 */
const checkWebPSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height > 0);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
};

// 缓存 WebP 支持检测结果
let webpSupportedCache: boolean | null = null;

const isWebPSupported = async (): Promise<boolean> => {
  if (webpSupportedCache === null) {
    webpSupportedCache = await checkWebPSupport();
  }
  return webpSupportedCache;
};

export const compressImage = async (
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<File> => {
  // 非图片文件直接返回
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // 检测 WebP 支持
  const useWebP = await isWebPSupported();
  const outputType = useWebP ? 'image/webp' : 'image/jpeg';
  const extension = useWebP ? '.webp' : '.jpg';

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // 释放 Object URL
      URL.revokeObjectURL(img.src);
      
      // 计算压缩后的尺寸
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // 替换文件扩展名
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], baseName + extension, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // 压缩失败则返回原文件
          }
        },
        outputType,
        quality
      );
    };
    
    img.onerror = () => resolve(file); // 出错则返回原文件
    img.src = URL.createObjectURL(file);
  });
};

// 使用预设压缩图片
export const compressImageWithPreset = async (
  file: File,
  preset: CompressionPreset
): Promise<File> => {
  const config = COMPRESSION_PRESETS[preset];
  return compressImage(file, config.maxWidth, config.maxHeight, config.quality);
};
