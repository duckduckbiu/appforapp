import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EditPostInput {
  postId: string;
  content: string;
  visibility: "public" | "followers" | "friends" | "private";
}

export function useEditPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, visibility }: EditPostInput) => {
      const { data, error } = await supabase
        .from("posts")
        .update({
          content,
          visibility,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", variables.postId] });
      toast({ title: "帖子已更新" });
    },
    onError: (error) => {
      console.error("Edit post error:", error);
      toast({
        variant: "destructive",
        title: "更新失败",
        description: "无法更新帖子，请稍后重试",
      });
    },
  });
}
