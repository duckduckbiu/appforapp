import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { useFriends } from "@/hooks/useFriends";

interface SearchUser {
  id: string;
  display_name: string | null;
  unique_username: string;
  avatar_url: string | null;
  is_ai_avatar: boolean | null;
  isFriend: boolean;
}

// 简单的防抖 hook - 导出供其他模块使用
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 内部使用的别名
const useDebounceValue = useDebounce;

export function useUserSearch(query: string, options?: { limit?: number; enabled?: boolean }) {
  const { currentIdentity } = useIdentity();
  const currentUserId = currentIdentity?.profile?.id;
  const limit = options?.limit ?? 10;
  const enabled = options?.enabled ?? true;

  // 防抖搜索词
  const debouncedQuery = useDebounceValue(query.trim(), 200);

  // 获取好友列表
  const { data: friends } = useFriends(currentUserId);
  const friendIds = useMemo(() => {
    return new Set((friends || []).map((f) => f.friend?.id).filter(Boolean));
  }, [friends]);

  // 搜索用户
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["userSearch", debouncedQuery, currentUserId, limit],
    queryFn: async (): Promise<SearchUser[]> => {
      if (!debouncedQuery || debouncedQuery.length < 1) {
        return [];
      }

      // 使用数据库函数搜索用户
      const { data, error } = await supabase.rpc("search_users_by_name", {
        search_query: debouncedQuery,
        current_user_id: currentUserId || "00000000-0000-0000-0000-000000000000",
        result_limit: limit,
      });

      if (error) {
        console.error("User search error:", error);
        return [];
      }

      // 添加好友标记
      return (data || []).map((user) => ({
        ...user,
        isFriend: friendIds.has(user.id),
      }));
    },
    enabled: enabled && !!debouncedQuery && debouncedQuery.length >= 1,
    staleTime: 30 * 1000, // 30秒缓存
  });

  // 好友优先排序
  const sortedResults = useMemo(() => {
    if (!searchResults) return [];
    return [...searchResults].sort((a, b) => {
      // 好友优先
      if (a.isFriend && !b.isFriend) return -1;
      if (!a.isFriend && b.isFriend) return 1;
      return 0;
    });
  }, [searchResults]);

  return {
    results: sortedResults,
    isLoading,
    query: debouncedQuery,
  };
}

// 快速获取好友列表用于 @ 提及（无需搜索）
export function useMentionSuggestions(query: string, options?: { limit?: number; enabled?: boolean }) {
  const { currentIdentity } = useIdentity();
  const currentUserId = currentIdentity?.profile?.id;
  const limit = options?.limit ?? 8;
  const enabled = options?.enabled ?? true;

  // 获取好友列表
  const { data: friends, isLoading: isLoadingFriends } = useFriends(currentUserId);

  // 防抖搜索词
  const debouncedQuery = useDebounceValue(query.trim().toLowerCase(), 150);

  // 过滤好友
  const suggestions = useMemo(() => {
    if (!friends || !enabled) return [];

    const filtered = friends
      .filter((f) => {
        if (!f.friend) return false;
        if (!debouncedQuery) return true;

        const displayName = f.friend.display_name?.toLowerCase() || "";
        const username = f.friend.unique_username?.toLowerCase() || "";
        const nickname = f.nickname?.toLowerCase() || "";

        return (
          displayName.includes(debouncedQuery) ||
          username.includes(debouncedQuery) ||
          nickname.includes(debouncedQuery)
        );
      })
      .slice(0, limit)
      .map((f) => ({
        id: f.friend!.id,
        display_name: f.nickname || f.friend!.display_name,
        unique_username: f.friend!.unique_username,
        avatar_url: f.friend!.avatar_url,
        is_ai_avatar: (f.friend as any)?.is_ai_avatar || false,
        isFriend: true,
      }));

    return filtered;
  }, [friends, debouncedQuery, enabled, limit]);

  // 如果好友列表为空或搜索词较长，使用全局搜索
  const { results: searchResults, isLoading: isSearching } = useUserSearch(debouncedQuery, {
    limit,
    enabled: enabled && debouncedQuery.length >= 2 && suggestions.length < 3,
  });

  // 合并结果，好友优先
  const mergedResults = useMemo(() => {
    if (suggestions.length >= limit) return suggestions;

    const suggestionIds = new Set(suggestions.map((s) => s.id));
    const additionalResults = (searchResults || [])
      .filter((r) => !suggestionIds.has(r.id))
      .slice(0, limit - suggestions.length);

    return [...suggestions, ...additionalResults];
  }, [suggestions, searchResults, limit]);

  return {
    suggestions: mergedResults,
    isLoading: isLoadingFriends || isSearching,
  };
}
