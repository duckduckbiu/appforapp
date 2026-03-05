import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { normalizeMaskRegion, type MaskRegion, type UnlockMode, type MaskShape, type MaskStyle } from "@/components/posts/MaskOverlay";

// 重新导出类型供其他模块使用
export type { MaskRegion, UnlockMode, MaskShape, MaskStyle };

export interface UnlockRule {
  id: string;
  post_id: string;
  unlock_type: string;
  unlock_mode: UnlockMode;
  required_count: number;
  blur_intensity: number;
  mask_regions: MaskRegion[];
  created_at: string;
}

// 获取帖子的解锁规则
export function useUnlockRule(postId: string | undefined) {
  return useQuery({
    queryKey: ["unlock-rule", postId],
    queryFn: async (): Promise<UnlockRule | null> => {
      if (!postId) return null;

      const { data, error } = await supabase
        .from("post_unlock_rules")
        .select("*")
        .eq("post_id", postId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // 使用 normalizeMaskRegion 转换旧数据
      const rawRegions = (data.mask_regions as unknown as any[]) || [];
      
      return {
        ...data,
        unlock_mode: (data.unlock_mode as UnlockMode) || "unified",
        mask_regions: rawRegions.map(normalizeMaskRegion),
      };
    },
    enabled: !!postId,
    staleTime: 10 * 60 * 1000, // 解锁规则不常变，10分钟缓存
    gcTime: 60 * 60 * 1000, // 1小时后清除
  });
}

// 检查用户是否已解锁帖子（统一模式）
export function useUnlockStatus(postId: string | undefined) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["unlock-status", postId, userId],
    queryFn: async (): Promise<boolean> => {
      if (!postId || !userId) return false;

      const { data, error } = await supabase
        .from("post_unlock_status")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .is("media_id", null) // 统一模式下 media_id 为 null
        .is("region_id", null) // 统一模式下 region_id 为 null
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!postId && !!userId,
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    gcTime: 30 * 60 * 1000, // 30分钟后清除缓存
  });
}

// 获取用户已解锁的区域列表（分区域模式）
export function useUnlockedRegions(postId: string | undefined) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["unlocked-regions", postId, userId],
    queryFn: async (): Promise<string[]> => {
      if (!postId || !userId) return [];

      const { data, error } = await supabase
        .from("post_unlock_status")
        .select("region_id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .not("region_id", "is", null);

      if (error) throw error;
      return data?.map(d => d.region_id!).filter(Boolean) || [];
    },
    enabled: !!postId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// 尝试解锁帖子（统一模式）
export function useUnlockPost() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      if (!userId) throw new Error("用户未登录");

      // 检查是否已解锁
      const { data: existingStatus } = await supabase
        .from("post_unlock_status")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .is("media_id", null)
        .is("region_id", null)
        .maybeSingle();

      if (existingStatus) {
        return { alreadyUnlocked: true };
      }

      // 获取解锁规则
      const { data: unlockRule } = await supabase
        .from("post_unlock_rules")
        .select("required_count")
        .eq("post_id", postId)
        .maybeSingle();

      if (!unlockRule) {
        throw new Error("没有解锁规则");
      }

      // 检查用户投币数是否满足条件
      const { data: userLike } = await supabase
        .from("post_likes")
        .select("amount")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .eq("is_paid", true)
        .maybeSingle();

      const paidAmount = userLike?.amount || 0;
      if (paidAmount < unlockRule.required_count) {
        throw new Error(`还需要 ${unlockRule.required_count - paidAmount} 枚硬币才能解锁`);
      }

      // 创建解锁记录
      const { error } = await supabase
        .from("post_unlock_status")
        .insert({
          post_id: postId,
          user_id: userId,
        });

      if (error) throw error;
      return { success: true, postId };
    },
    // 乐观更新：立即标记为已解锁
    onMutate: async ({ postId }) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ["unlock-status", postId, userId] });
      
      // 保存之前的值用于回滚
      const previousStatus = queryClient.getQueryData(["unlock-status", postId, userId]);
      
      // 乐观更新为已解锁
      queryClient.setQueryData(["unlock-status", postId, userId], true);
      
      return { previousStatus, postId };
    },
    onSuccess: (result, variables) => {
      if (!result.alreadyUnlocked) {
        // 确保缓存正确更新
        queryClient.setQueryData(["unlock-status", variables.postId, userId], true);
        // 刷新媒体访问权限
        queryClient.invalidateQueries({ queryKey: ["media-access"] });
      }
    },
    onError: (error: Error, variables, context) => {
      // 回滚乐观更新
      if (context?.previousStatus !== undefined) {
        queryClient.setQueryData(
          ["unlock-status", context.postId, userId], 
          context.previousStatus
        );
      }
      console.error("解锁失败:", error.message);
    },
  });
}

// 尝试解锁单个区域（分区域模式）
export function useUnlockRegion() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({ 
      postId, 
      mediaId, 
      regionId, 
      price 
    }: { 
      postId: string; 
      mediaId: string; 
      regionId: string; 
      price: number;
    }) => {
      if (!userId) throw new Error("用户未登录");

      // 检查是否已解锁该区域
      const { data: existingStatus } = await supabase
        .from("post_unlock_status")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .eq("media_id", mediaId)
        .eq("region_id", regionId)
        .maybeSingle();

      if (existingStatus) {
        return { alreadyUnlocked: true };
      }

      // 创建解锁记录
      const { error } = await supabase
        .from("post_unlock_status")
        .insert({
          post_id: postId,
          user_id: userId,
          media_id: mediaId,
          region_id: regionId,
        });

      if (error) throw error;
      return { success: true, postId, regionId };
    },
    // 乐观更新
    onMutate: async ({ postId, regionId }) => {
      await queryClient.cancelQueries({ queryKey: ["unlocked-regions", postId, userId] });
      
      const previousRegions = queryClient.getQueryData<string[]>(["unlocked-regions", postId, userId]) || [];
      
      // 乐观添加新解锁的区域
      queryClient.setQueryData(["unlocked-regions", postId, userId], [...previousRegions, regionId]);
      
      return { previousRegions, postId };
    },
    onSuccess: (result, variables) => {
      if (!result.alreadyUnlocked) {
        // 刷新媒体访问权限
        queryClient.invalidateQueries({ queryKey: ["media-access"] });
      }
    },
    onError: (error: Error, variables, context) => {
      // 回滚乐观更新
      if (context?.previousRegions !== undefined) {
        queryClient.setQueryData(
          ["unlocked-regions", context.postId, userId], 
          context.previousRegions
        );
      }
      console.error("区域解锁失败:", error.message);
    },
  });
}

// 创建解锁规则
export function useCreateUnlockRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, requiredCount, blurIntensity, unlockMode = "unified" }: {
      postId: string;
      requiredCount: number;
      blurIntensity: number;
      unlockMode?: UnlockMode;
    }) => {
      const { data, error } = await supabase
        .from("post_unlock_rules")
        .insert({
          post_id: postId,
          unlock_type: "likes",
          unlock_mode: unlockMode,
          required_count: requiredCount,
          blur_intensity: blurIntensity,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["unlock-rule", variables.postId] });
    },
  });
}
