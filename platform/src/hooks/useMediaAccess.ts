import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MaskRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  price?: number;
}

export type UnlockMode = "unified" | "per_region";

export interface MediaUnlockStatus {
  isFullyUnlocked: boolean;
  unlockedRegions: string[];
  maskRegions: MaskRegion[];
}

export interface MediaAccessInfo {
  canViewOriginal: boolean;
  isOwner: boolean;
  isUnlocked: boolean;
  unlockRule: {
    unlock_mode: UnlockMode;
    required_count: number;
    mask_regions: MaskRegion[];
  } | null;
  unlockedRegions: string[];
  mediaUnlockStatus: { [mediaId: string]: MediaUnlockStatus };
  signedUrls: { [mediaId: string]: string };
}

export interface MediaAccessMap {
  [postId: string]: MediaAccessInfo;
}

export async function fetchBatchMediaAccess(postIds: string[]): Promise<MediaAccessMap> {
  if (postIds.length === 0) return {};

  // 直接调用 Edge Function，不再检查 session
  // Edge Function 内部会验证 token
  const { data, error } = await supabase.functions.invoke("batch-media-access", {
    body: { postIds },
  });

  if (error) {
    console.error("Batch media access error:", error);
    // 返回空权限而不是抛出错误
    return postIds.reduce((acc, id) => {
      acc[id] = {
        canViewOriginal: false,
        isOwner: false,
        isUnlocked: false,
        unlockRule: null,
        unlockedRegions: [],
        mediaUnlockStatus: {},
        signedUrls: {},
      };
      return acc;
    }, {} as MediaAccessMap);
  }

  return data as MediaAccessMap;
}

/**
 * 批量获取媒体访问权限
 * @param postIds 帖子 ID 数组
 * @returns 权限映射表
 */
export function useMediaAccess(postIds: string[]) {
  const stableKey = postIds.sort().join(",");

  return useQuery({
    queryKey: ["media-access", stableKey],
    queryFn: () => fetchBatchMediaAccess(postIds),
    enabled: postIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  });
}

/**
 * 方案 B：根据权限信息获取媒体显示 URL
 * 现在统一返回原始 URL，前端用 CSS 遮罩控制显示
 */
export function getMediaDisplayUrl(
  media: {
    id: string;
    media_url: string;
    thumbnail_url?: string | null;
    original_media_url?: string | null;
    masked_media_url?: string | null;
  },
  accessInfo?: MediaAccessInfo
): string {
  // 方案 B：Feed 显示时直接使用 media_url
  // 对于有打码内容的图片，media_url 也是原图 URL
  // CSS 遮罩在前端渲染
  
  // 如果有签名 URL（已授权访问原图），使用签名 URL
  if (accessInfo?.signedUrls[media.id]) {
    return accessInfo.signedUrls[media.id];
  }
  
  // 普通图片或默认情况
  return media.thumbnail_url || media.media_url;
}

/**
 * 获取单个媒体的解锁状态
 */
export function getMediaUnlockStatus(
  mediaId: string,
  accessInfo?: MediaAccessInfo
): MediaUnlockStatus | null {
  if (!accessInfo?.mediaUnlockStatus) return null;
  return accessInfo.mediaUnlockStatus[mediaId] || null;
}

/**
 * 计算解锁某个区域需要的价格
 */
export function getRegionUnlockPrice(
  regionId: string,
  accessInfo?: MediaAccessInfo,
  mediaId?: string
): number {
  if (!accessInfo?.unlockRule) return 0;
  
  const { unlock_mode, required_count, mask_regions } = accessInfo.unlockRule;
  
  if (unlock_mode === "unified") {
    return required_count;
  }
  
  // 分区域模式：查找区域价格
  if (mediaId && accessInfo.mediaUnlockStatus[mediaId]) {
    const region = accessInfo.mediaUnlockStatus[mediaId].maskRegions.find(r => r.id === regionId);
    if (region?.price !== undefined) {
      return region.price;
    }
  }
  
  const region = mask_regions.find(r => r.id === regionId);
  return region?.price || required_count;
}
