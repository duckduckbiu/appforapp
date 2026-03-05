import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { compressImageWithPreset, CompressionPreset } from '@/lib/imageCompression';
import { toast } from 'sonner';

export interface ImageUploadOptions {
  bucket: string;
  pathPrefix?: string;
  preset?: CompressionPreset;
  upsert?: boolean;
}

export interface UseImageUploadResult {
  uploadImage: (file: File, options: ImageUploadOptions) => Promise<string | null>;
  uploadImages: (files: File[], options: ImageUploadOptions) => Promise<string[]>;
  isUploading: boolean;
  progress: number;
}

export function useImageUpload(): UseImageUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = useCallback(async (
    file: File,
    options: ImageUploadOptions
  ): Promise<string | null> => {
    const { bucket, pathPrefix = '', preset, upsert = false } = options;

    try {
      setIsUploading(true);
      setProgress(0);

      // 压缩图片（如果有预设且是图片文件）
      let processedFile = file;
      if (preset && file.type.startsWith('image/')) {
        setProgress(10);
        processedFile = await compressImageWithPreset(file, preset);
        setProgress(30);
      }

      // 生成文件路径
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

      setProgress(50);

      // 上传到 Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, processedFile, { upsert });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(80);

      // 获取公开 URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setProgress(100);
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Image upload failed:', error);
      toast.error(error.message || '图片上传失败');
      return null;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  const uploadImages = useCallback(async (
    files: File[],
    options: ImageUploadOptions
  ): Promise<string[]> => {
    const urls: string[] = [];
    
    setIsUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadImage(file, options);
        if (url) {
          urls.push(url);
        }
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
    } finally {
      setIsUploading(false);
      setProgress(0);
    }

    return urls;
  }, [uploadImage]);

  return {
    uploadImage,
    uploadImages,
    isUploading,
    progress,
  };
}
