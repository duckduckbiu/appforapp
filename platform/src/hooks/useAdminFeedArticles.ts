import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ArticleFilters {
  search?: string;
  source?: string;
  category?: string;
  language?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedArticle {
  id: string;
  source: string;
  source_id: string;
  title: string;
  content: string | null;
  url: string | null;
  image_url: string | null;
  author_name: string | null;
  score: number;
  tags: string[] | null;
  language: string | null;
  published_at: string | null;
  fetched_at: string | null;
  like_count: number;
  bookmark_count: number;
  comment_count: number;
  status: string;
  summary: string | null;
  reading_time_minutes: number | null;
  // Full content extraction fields
  full_content: string | null;
  full_content_status: string | null;
  word_count: number | null;
  extraction_error: string | null;
  extracted_at: string | null;
  images: unknown[] | null;
  videos: unknown[] | null;
}

const PAGE_SIZE = 20;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useAdminFeedArticles(filters: ArticleFilters, page: number) {
  return useQuery({
    queryKey: ["admin-feed-articles", filters, page],
    queryFn: async () => {
      let query = sb
        .from("aggregated_feed")
        .select("*", { count: "exact" })
        .order("published_at", { ascending: false });

      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }
      if (filters.source) {
        query = query.eq("source", filters.source);
      }
      if (filters.category) {
        query = query.contains("tags", [filters.category]);
      }
      if (filters.language) {
        query = query.eq("language", filters.language);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte("published_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("published_at", filters.dateTo);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        items: (data || []) as FeedArticle[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useDistinctSources() {
  return useQuery({
    queryKey: ["admin-feed-distinct-sources"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("feed_sources")
        .select("name")
        .order("name");
      if (error) throw error;
      // Also get distinct source values from aggregated_feed for sources not in feed_sources
      const names = (data || []).map((d: { name: string }) => d.name);
      return [...new Set(names)] as string[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
