import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

const PAGE_SIZE = 25;

export interface FeedImageInfo {
  url: string;
  storage_path: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface FeedVideoInfo {
  url: string;
  type: string; // youtube | vimeo | mp4 | embed
  thumbnail: string | null;
}

export interface AggregatedFeedItem {
  id: string;
  source: string;
  source_id: string;
  title: string | null;
  content: string | null;
  url: string | null;
  image_url: string | null;
  author_name: string | null;
  score: number;
  tags: string[];
  language: string;
  published_at: string | null;
  fetched_at: string;
  // Full content extraction fields
  full_content?: string | null;
  full_content_status?: string | null; // 'pending' | 'fetched' | 'failed' | 'skipped'
  images?: FeedImageInfo[] | null;
  videos?: FeedVideoInfo[] | null;
  word_count?: number | null;
  extraction_error?: string | null;
  extracted_at?: string | null;
  // Dedup fields (from deduplicated_feed view)
  similar_count?: number;
  cluster_id?: string;
}

interface FeedPage {
  items: AggregatedFeedItem[];
  nextCursor: string | null;
}

// ── DB fetch helper ──────────────────────────────────────────────────

async function fetchFeedPage(
  category: string | undefined,
  cursor: string | null,
  language?: string,
): Promise<FeedPage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Helper to apply common filters
  const applyFilters = (q: ReturnType<typeof sb.from>) => {
    if (category) q = q.contains("tags", [category]);
    if (language) q = q.eq("language", language);
    if (cursor) q = q.lt("published_at", cursor);
    return q;
  };

  // Try deduplicated_feed view first
  let query = sb
    .from("deduplicated_feed")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  query = applyFilters(query);
  const { data, error } = await query;

  if (!error && data && data.length > 0) {
    const hasMore = data.length > PAGE_SIZE;
    const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
    const lastItem = items[items.length - 1];
    return {
      items: items as AggregatedFeedItem[],
      nextCursor: hasMore && lastItem?.published_at ? lastItem.published_at : null,
    };
  }

  // Fallback to raw aggregated_feed
  if (error) {
    console.warn("[Feed] deduplicated_feed query failed, falling back:", error.message);
  }

  let rawQuery = sb
    .from("aggregated_feed")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  rawQuery = applyFilters(rawQuery);
  const { data: rawData, error: rawError } = await rawQuery;

  if (rawError) {
    console.warn("[Feed] aggregated_feed query failed:", rawError.message);
  }

  if (rawData && rawData.length > 0) {
    const hasMore = rawData.length > PAGE_SIZE;
    const items = hasMore ? rawData.slice(0, PAGE_SIZE) : rawData;
    const lastItem = items[items.length - 1];
    return {
      items: items as AggregatedFeedItem[],
      nextCursor: hasMore && lastItem?.published_at ? lastItem.published_at : null,
    };
  }

  return { items: [], nextCursor: null };
}

// ── Main Hook (infinite query with cursor pagination) ────────────────

/**
 * @param category - Filter by category tag.
 * @param language - Filter by content language (e.g. 'zh', 'en'). Omit for all languages.
 *   Tries deduplicated_feed view → aggregated_feed → HN fallback.
 *   Returns an infinite query with cursor-based pagination.
 */
export function useAggregatedFeed(category?: string, language?: string) {
  return useInfiniteQuery({
    queryKey: ["aggregated-feed", category, language],
    queryFn: async ({ pageParam }) => {
      if (isSupabaseConfigured) {
        return await fetchFeedPage(category, pageParam, language);
      }

      return { items: [], nextCursor: null } as FeedPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Similar articles hook ────────────────────────────────────────────

/**
 * Fetch all articles in a cluster (for "N similar articles" sheet)
 */
export function useSimilarArticles(clusterId: string | null) {
  return useQuery({
    queryKey: ["similar-articles", clusterId],
    queryFn: async () => {
      if (!clusterId || !isSupabaseConfigured) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("feed_cluster_items")
        .select("feed_id, similarity, aggregated_feed(*)")
        .eq("cluster_id", clusterId)
        .order("similarity", { ascending: false });

      if (error) {
        console.warn("[Feed] similar articles query failed:", error.message);
        return [];
      }

      return (data || []).map((row: { feed_id: string; similarity: number; aggregated_feed: AggregatedFeedItem }) => ({
        ...row.aggregated_feed,
        similarity: row.similarity,
      })) as (AggregatedFeedItem & { similarity: number })[];
    },
    enabled: !!clusterId,
    staleTime: 10 * 60 * 1000,
  });
}
