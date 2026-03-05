import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { compressImageWithPreset } from "@/lib/imageCompression";
import { generateMaskedImage, type MaskRegion } from "@/lib/imageMasking";

export type UnlockMode = "unified" | "per_region";

// 扩展 MaskRegion 添加价格
export interface MaskRegionWithPrice extends MaskRegion {
  price?: number;
}

export interface ImageMaskConfig {
  imageIndex: number;
  regions: MaskRegionWithPrice[];
}

export interface UnlockSettings {
  unlockMode: UnlockMode;
  unifiedPrice: number;
  images: ImageMaskConfig[];
}

interface CreatePostInput {
  content: string;
  visibility: "public" | "followers" | "friends" | "private";
  images: File[];
  video?: File;
  authorId: string;
  unlockSettings?: UnlockSettings;
  location?: {
    latitude: number;
    longitude: number;
    locationName?: string;
  };
  scheduledAt?: Date;
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

  const createPostMutation = useMutation({
    mutationFn: async ({ content, visibility, images, video, authorId, unlockSettings, location, scheduledAt }: CreatePostInput) => {
      // 1. 创建帖子记录
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          content,
          visibility,
          author_id: authorId,
          latitude: location?.latitude,
          longitude: location?.longitude,
          location_name: location?.locationName,
          scheduled_at: scheduledAt?.toISOString() || null,
        })
        .select()
        .single();

      if (postError) throw postError;

      const mediaRecords: Array<{
        post_id: string;
        media_type: string;
        media_url: string;
        thumbnail_url?: string;
        sort_order: number;
        duration?: number;
        original_media_url?: string;
        mask_regions?: any;
      }> = [];

      const hasMasking = unlockSettings && unlockSettings.images.some(img => img.regions.length > 0);

      // 2. 上传图片 - 同时生成缩略图和原图
      if (images.length > 0) {
        const totalFiles = images.length + (video ? 1 : 0);
        
        for (let i = 0; i < images.length; i++) {
          const file = images[i];
          setUploadProgress(Math.round(((i + 0.2) / totalFiles) * 100));

          // 压缩原图
          const compressedFile = await compressImageWithPreset(file, 'post');
          
          // 生成唯一文件名
          const fileExt = file.name.split(".").pop() || 'jpg';
          const timestamp = Date.now();
          
          // 检查这张图片是否有打码区域
          const imageMaskConfig = unlockSettings?.images.find(img => img.imageIndex === i);
          const hasRegions = imageMaskConfig && imageMaskConfig.regions.length > 0;
          
          setUploadProgress(Math.round(((i + 0.6) / totalFiles) * 100));
          
          if (hasMasking && hasRegions) {
            // Canvas 安全打码方案：
            // 1. 生成真正的打码图片上传到公开桶（作为 media_url）
            // 2. 从打码图生成缩略图上传到公开桶（作为 thumbnail_url）
            // 3. 原图上传到私有桶（作为 original_media_url）
            
            // 转换区域格式（添加必要的 shape 和 style 字段）
            const regionsForMasking = imageMaskConfig.regions.map(r => ({
              id: r.id,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              shape: r.shape || 'rectangle' as const,
              style: r.style || 'solid' as const,
              blurIntensity: r.blurIntensity,
              mosaicIntensity: r.mosaicIntensity,
              stickerUrl: r.stickerUrl,
              rotation: r.rotation,
              points: r.points,
              path: r.path,
            }));
            
            // 使用 Canvas 生成真正的打码图片
            const maskedBlob = await generateMaskedImage(compressedFile, regionsForMasking);
            
            // 从打码图生成缩略图（关键：缩略图也是打码的！）
            const maskedThumbnailFile = await compressImageWithPreset(
              new File([maskedBlob], 'masked.jpg', { type: 'image/jpeg' }), 
              'post_thumb'
            );
            
            // 上传打码缩略图到公开桶
            const thumbFileName = `${post.id}/thumb_${timestamp}_${i}.jpg`;
            const { error: thumbError } = await supabase.storage
              .from("post-media")
              .upload(thumbFileName, maskedThumbnailFile, {
                contentType: 'image/jpeg',
              });
            
            if (thumbError) {
              console.error("Masked thumbnail upload error:", thumbError);
              throw thumbError;
            }
            
            const { data: thumbUrlData } = supabase.storage
              .from("post-media")
              .getPublicUrl(thumbFileName);
            const maskedThumbnailUrl = thumbUrlData.publicUrl;
            
            // 打码图上传到公开桶
            const maskedFileName = `${post.id}/${timestamp}_masked_${i}.jpg`;
            const { error: maskedUploadError } = await supabase.storage
              .from("post-media")
              .upload(maskedFileName, maskedBlob, {
                contentType: 'image/jpeg',
              });
            
            if (maskedUploadError) {
              console.error("Masked image upload error:", maskedUploadError);
              throw maskedUploadError;
            }
            
            const { data: maskedUrlData } = supabase.storage
              .from("post-media")
              .getPublicUrl(maskedFileName);
            const maskedUrl = maskedUrlData.publicUrl;
            
            // 原图上传到私有桶
            const originalFileName = `${authorId}/${post.id}/${timestamp}_original.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from("post-media-protected")
              .upload(originalFileName, compressedFile, {
                contentType: compressedFile.type,
              });
            
            if (uploadError) {
              console.error("Original image upload error:", uploadError);
              throw uploadError;
            }
            
            const { data: urlData } = supabase.storage
              .from("post-media-protected")
              .getPublicUrl(originalFileName);
            const protectedUrl = urlData.publicUrl;
            
            // 存储区域信息（用于前端显示解锁交互位置）
            const regionsWithPrice = imageMaskConfig.regions.map(r => ({
              id: r.id,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              shape: r.shape || 'rectangle',
              style: r.style || 'solid',
              price: unlockSettings?.unlockMode === "per_region" ? (r.price || unlockSettings.unifiedPrice) : undefined,
            }));
            
            mediaRecords.push({
              post_id: post.id,
              media_type: "image",
              media_url: maskedUrl,              // 打码图（公开）
              thumbnail_url: maskedThumbnailUrl, // 打码缩略图（公开）- 关键修复！
              sort_order: i,
              original_media_url: protectedUrl,  // 原图（私有）
              mask_regions: regionsWithPrice,
            });
          } else {
            // 普通图片：原图和缩略图都上传到公开桶
            const thumbnailFile = await compressImageWithPreset(file, 'post_thumb');
            
            // 上传缩略图
            const thumbFileName = `${post.id}/thumb_${timestamp}_${i}.${fileExt}`;
            const { error: thumbError } = await supabase.storage
              .from("post-media")
              .upload(thumbFileName, thumbnailFile, {
                contentType: thumbnailFile.type,
              });
            
            if (thumbError) {
              console.error("Thumbnail upload error:", thumbError);
              throw thumbError;
            }
            
            const { data: thumbUrlData } = supabase.storage
              .from("post-media")
              .getPublicUrl(thumbFileName);
            const thumbnailUrl = thumbUrlData.publicUrl;
            
            // 上传原图
            const fileName = `${post.id}/${timestamp}_${i}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from("post-media")
              .upload(fileName, compressedFile, {
                contentType: compressedFile.type,
              });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from("post-media")
              .getPublicUrl(fileName);

            mediaRecords.push({
              post_id: post.id,
              media_type: "image",
              media_url: urlData.publicUrl,
              thumbnail_url: thumbnailUrl,
              sort_order: i,
            });
          }
          
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        }
      }

      // 3. 上传视频
      if (video) {
        setUploadProgress(images.length > 0 ? 90 : 50);
        
        const fileExt = video.name.split(".").pop();
        const fileName = `${post.id}/${Date.now()}_video.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(fileName, video, {
            contentType: video.type,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(fileName);

        mediaRecords.push({
          post_id: post.id,
          media_type: "video",
          media_url: urlData.publicUrl,
          sort_order: images.length,
        });
      }

      // 4. 批量插入媒体记录
      if (mediaRecords.length > 0) {
        const { error: mediaError } = await supabase
          .from("post_media")
          .insert(mediaRecords);

        if (mediaError) throw mediaError;
      }

      // 5. 创建解锁规则（如果启用且有遮挡区域）
      if (hasMasking && mediaRecords.length > 0) {
        // 合并所有图片的区域用于统一规则
        const allRegions = unlockSettings.images.flatMap(img => img.regions);
        
        const { error: unlockError } = await supabase
          .from("post_unlock_rules")
          .insert([{
            post_id: post.id,
            unlock_type: "likes",
            unlock_mode: unlockSettings.unlockMode,
            required_count: unlockSettings.unifiedPrice,
            blur_intensity: 0, // Canvas 生成打码图，不使用运行时模糊
            mask_regions: JSON.parse(JSON.stringify(allRegions)),
          }]);

        if (unlockError) throw unlockError;
      }

      setUploadProgress(0);
      return post;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({
        title: variables.scheduledAt ? "定时发布已设置" : "发布成功",
        description: variables.scheduledAt 
          ? `你的帖子将在 ${variables.scheduledAt.toLocaleString('zh-CN')} 发布`
          : "你的帖子已成功发布",
      });
    },
    onError: (error) => {
      console.error("Create post error:", error);
      toast({
        variant: "destructive",
        title: "发布失败",
        description: "无法发布帖子，请稍后重试",
      });
    },
  });

  return {
    createPost: createPostMutation.mutate,
    createPostAsync: createPostMutation.mutateAsync,
    isLoading: createPostMutation.isPending,
    uploadProgress,
  };
}
