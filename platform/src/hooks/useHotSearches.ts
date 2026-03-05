import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HotSearchItem {
  id: string;
  name: string;
  count: number;
  type: "hashtag";
}

export function useHotSearches() {
  return useQuery({
    queryKey: ["hot-searches"],
    queryFn: async (): Promise<HotSearchItem[]> => {
      // 获取热门话题（按 post_count 排序）
      const { data: hashtags, error } = await supabase
        .from("hashtags")
        .select("id, name, post_count")
        .order("post_count", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Failed to fetch hot searches:", error);
        return [];
      }

      return (hashtags || []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        count: tag.post_count,
        type: "hashtag" as const,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 30 * 60 * 1000,
  });
}
