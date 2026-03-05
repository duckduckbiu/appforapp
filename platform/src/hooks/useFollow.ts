import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";

// 检查是否关注了某用户
export function useIsFollowing(targetUserId: string | undefined) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["isFollowing", userId, targetUserId],
    queryFn: async () => {
      if (!userId || !targetUserId || userId === targetUserId) return false;

      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("following_id", targetUserId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!userId && !!targetUserId && userId !== targetUserId,
  });
}

// 关注/取关操作
export function useFollowUser() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({
      targetUserId,
      isFollowing,
    }: {
      targetUserId: string;
      isFollowing: boolean;
    }) => {
      if (!userId) throw new Error("未登录");
      if (userId === targetUserId) throw new Error("不能关注自己");

      if (isFollowing) {
        // 取消关注
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", targetUserId);
        if (error) throw error;
      } else {
        // 关注
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: userId, following_id: targetUserId });
        if (error) throw error;
      }

      return !isFollowing;
    },
    onSuccess: (newIsFollowing, { targetUserId }) => {
      queryClient.setQueryData(
        ["isFollowing", userId, targetUserId],
        newIsFollowing
      );
      queryClient.invalidateQueries({ queryKey: ["followers", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["following", userId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      
      toast({
        title: newIsFollowing ? "已关注" : "已取消关注",
      });
    },
    onError: (error) => {
      console.error("Follow error:", error);
      toast({
        variant: "destructive",
        title: "操作失败",
        description: "请稍后重试",
      });
    },
  });
}

// 获取关注列表
export function useFollowing(userId: string | undefined) {
  return useQuery({
    queryKey: ["following", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("follows")
        .select(`
          id,
          created_at,
          following:profiles!follows_following_id_fkey (
            id,
            display_name,
            unique_username,
            avatar_url,
            bio
          )
        `)
        .eq("follower_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

// 获取粉丝列表
export function useFollowers(userId: string | undefined) {
  return useQuery({
    queryKey: ["followers", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("follows")
        .select(`
          id,
          created_at,
          follower:profiles!follows_follower_id_fkey (
            id,
            display_name,
            unique_username,
            avatar_url,
            bio
          )
        `)
        .eq("following_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

// 获取关注和粉丝数量
export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["followCounts", userId],
    queryFn: async () => {
      if (!userId) return { followingCount: 0, followersCount: 0 };

      const [followingRes, followersRes] = await Promise.all([
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", userId),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", userId),
      ]);

      return {
        followingCount: followingRes.count || 0,
        followersCount: followersRes.count || 0,
      };
    },
    enabled: !!userId,
  });
}
