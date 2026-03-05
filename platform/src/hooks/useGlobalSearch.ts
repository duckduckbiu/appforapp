import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { useDebounce } from "@/hooks/useUserSearch";

interface UserResult {
  id: string;
  display_name: string | null;
  unique_username: string;
  avatar_url: string | null;
  bio: string | null;
  is_ai_avatar: boolean | null;
}

interface PostResult {
  id: string;
  content: string | null;
  created_at: string;
  author_id: string;
  likes_count: number;
  comments_count: number;
  author: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
  };
  media: {
    id: string;
    media_url: string;
    media_type: string;
  }[];
}

interface HashtagResult {
  id: string;
  name: string;
  post_count: number;
}

export type SearchResultType = "all" | "users" | "posts" | "topics";

export function useGlobalSearch(query: string, type: SearchResultType = "all") {
  const { currentIdentity } = useIdentity();
  const debouncedQuery = useDebounce(query, 300);
  const userId = currentIdentity?.profile?.id;

  const { data: userResults = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["global-search", "users", debouncedQuery, userId],
    queryFn: async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) return [];
      
      const { data, error } = await supabase.rpc("search_users_by_name", {
        search_query: debouncedQuery,
        current_user_id: userId || "00000000-0000-0000-0000-000000000000",
        result_limit: 10,
      });

      if (error) throw error;
      return (data || []) as UserResult[];
    },
    enabled: !!debouncedQuery.trim() && debouncedQuery.length >= 2 && (type === "all" || type === "users"),
    staleTime: 30000,
  });

  const { data: postResults = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ["global-search", "posts", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) return [];

      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          created_at,
          author_id,
          likes_count,
          comments_count,
          author:profiles!posts_author_id_fkey (
            id,
            display_name,
            unique_username,
            avatar_url
          ),
          media:post_media (
            id,
            media_url,
            media_type
          )
        `)
        .ilike("content", `%${debouncedQuery}%`)
        .eq("is_deleted", false)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      return (data || []).map((post: any) => ({
        ...post,
        author: post.author,
        media: post.media || [],
      })) as PostResult[];
    },
    enabled: !!debouncedQuery.trim() && debouncedQuery.length >= 2 && (type === "all" || type === "posts"),
    staleTime: 30000,
  });

  const { data: hashtagResults = [], isLoading: isLoadingHashtags } = useQuery({
    queryKey: ["global-search", "hashtags", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 1) return [];

      // 移除 # 符号进行搜索
      const searchTerm = debouncedQuery.replace(/^#/, "");

      const { data, error } = await supabase
        .from("hashtags")
        .select("id, name, post_count")
        .ilike("name", `%${searchTerm}%`)
        .order("post_count", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as HashtagResult[];
    },
    enabled: !!debouncedQuery.trim() && debouncedQuery.length >= 1 && (type === "all" || type === "topics"),
    staleTime: 30000,
  });

  const isLoading = isLoadingUsers || isLoadingPosts || isLoadingHashtags;
  const hasResults = userResults.length > 0 || postResults.length > 0 || hashtagResults.length > 0;

  return {
    userResults,
    postResults,
    hashtagResults,
    isLoading,
    hasResults,
    query: debouncedQuery,
  };
}
