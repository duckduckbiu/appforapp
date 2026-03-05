import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserStats {
  postsCount: number;
  followingCount: number;
  followersCount: number;
  likesReceivedCount: number;
}

export function useUserStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["userStats", userId],
    queryFn: async (): Promise<UserStats> => {
      if (!userId) {
        return { postsCount: 0, followingCount: 0, followersCount: 0, likesReceivedCount: 0 };
      }

      const [postsRes, followingRes, followersRes, likesRes] = await Promise.all([
        // 帖子数量
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId)
          .eq("is_deleted", false),
        // 关注数量
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", userId),
        // 粉丝数量
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", userId),
        // 获赞总数（所有帖子的点赞数之和）
        supabase
          .from("posts")
          .select("likes_count")
          .eq("author_id", userId)
          .eq("is_deleted", false),
      ]);

      const likesReceivedCount = (likesRes.data || []).reduce(
        (sum, post) => sum + (post.likes_count || 0),
        0
      );

      return {
        postsCount: postsRes.count || 0,
        followingCount: followingRes.count || 0,
        followersCount: followersRes.count || 0,
        likesReceivedCount,
      };
    },
    enabled: !!userId,
  });
}
