import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheFriends, getCachedFriends } from "@/lib/indexedDB";

export interface Friend {
  id: string;
  friend_id: string;
  nickname: string | null;
  is_starred?: boolean;
  friend?: {
    id: string;
    unique_username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * React Query hook for fetching and caching friends list
 * 好友列表查询 hook，支持实时更新和智能缓存
 */
export function useFriends(userId: string | undefined) {
  const queryClient = useQueryClient();
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖失效函数：300ms内多次失效只执行一次
  const debouncedInvalidate = () => {
    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    reloadTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    }, 300);
  };

  // 使用 React Query 查询好友列表，依赖内存缓存（更可靠）
  const query = useQuery({
    queryKey: ["friends", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await loadFriends(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10分钟内不重新请求
    gcTime: 1000 * 60 * 30, // 缓存保留30分钟
    refetchOnWindowFocus: false, // 窗口聚焦时不重新请求
  });

  // 设置 Realtime 订阅
  useEffect(() => {
    if (!userId) return;

    let friendshipsChannel: any = null;
    let profilesChannel: any = null;

    // 订阅好友关系变化
    friendshipsChannel = supabase
      .channel(`friends-friendships-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedInvalidate();
        }
      )
      .subscribe();

    // 订阅用户资料变化（好友的资料可能更新）
    profilesChannel = supabase
      .channel(`friends-profiles-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          // 只在显示字段变化时失效
          if (
            payload.new &&
            (payload.new.display_name !== payload.old?.display_name ||
              payload.new.avatar_url !== payload.old?.avatar_url ||
              payload.new.unique_username !== payload.old?.unique_username)
          ) {
            debouncedInvalidate();
          }
        }
      )
      .subscribe();

    // 清理订阅
    return () => {
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      if (friendshipsChannel) {
        friendshipsChannel.unsubscribe();
        supabase.removeChannel(friendshipsChannel);
      }
      if (profilesChannel) {
        profilesChannel.unsubscribe();
        supabase.removeChannel(profilesChannel);
      }
    };
  }, [userId, queryClient]);

  return query;
}

/**
 * Load friends for a user
 * 加载用户的所有好友列表（使用 JOIN 避免 N+1 查询）
 */
async function loadFriends(userId: string): Promise<Friend[]> {
  try {
    // 使用 JOIN 一次性获取好友和 profile 信息
    const { data, error } = await supabase
      .from("friendships")
      .select(
        `
        id, 
        friend_id, 
        nickname, 
        is_starred,
        friend:profiles!friendships_friend_id_fkey(
          id,
          unique_username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 排序：星标好友置顶
    const sortedFriends = (data || []).sort((a, b) => {
      if (a.is_starred && !b.is_starred) return -1;
      if (!a.is_starred && b.is_starred) return 1;
      return 0;
    });

    return sortedFriends;
  } catch (error) {
    console.error("加载好友列表失败:", error);
    return [];
  }
}
