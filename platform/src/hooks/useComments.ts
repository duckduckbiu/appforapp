import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  parent_id: string | null;
  author: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

export function useComments(postId: string | undefined) {
  const queryClient = useQueryClient();

  // 订阅实时更新
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["comments", postId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  return useQuery({
    queryKey: ["comments", postId],
    queryFn: async (): Promise<Comment[]> => {
      if (!postId) return [];

      const { data, error } = await supabase
        .from("post_comments")
        .select(`
          id,
          content,
          created_at,
          likes_count,
          parent_id,
          author:profiles!post_comments_author_id_fkey (
            id,
            display_name,
            unique_username,
            avatar_url
          )
        `)
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // 构建嵌套结构
      const comments = (data || []) as Comment[];
      const topLevel: Comment[] = [];
      const childMap = new Map<string, Comment[]>();

      comments.forEach((comment) => {
        if (comment.parent_id) {
          const children = childMap.get(comment.parent_id) || [];
          children.push(comment);
          childMap.set(comment.parent_id, children);
        } else {
          topLevel.push(comment);
        }
      });

      // 附加回复
      topLevel.forEach((comment) => {
        comment.replies = childMap.get(comment.id) || [];
      });

      return topLevel;
    },
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({
      postId,
      content,
      parentId,
    }: {
      postId: string;
      content: string;
      parentId?: string;
    }) => {
      if (!userId) throw new Error("未登录");

      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          author_id: userId,
          content,
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.postId] });
      queryClient.invalidateQueries({ queryKey: ["post", variables.postId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const { error } = await supabase
        .from("post_comments")
        .update({ is_deleted: true })
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.postId] });
      queryClient.invalidateQueries({ queryKey: ["post", variables.postId] });
    },
  });
}
