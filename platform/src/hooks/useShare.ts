import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";

interface SharePostInput {
  originalPostId: string;
  content?: string;
  visibility?: string;
}

export function useSharePost() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({ originalPostId, content = "", visibility = "public" }: SharePostInput) => {
      if (!userId) throw new Error("未登录");

      // 创建转发帖子
      const { data: newPost, error: postError } = await supabase
        .from("posts")
        .insert({
          author_id: userId,
          content,
          visibility,
        })
        .select()
        .single();

      if (postError) throw postError;

      // 创建转发记录
      const { error: shareError } = await supabase
        .from("post_shares")
        .insert({
          user_id: userId,
          original_post_id: originalPostId,
          shared_post_id: newPost.id,
        });

      if (shareError) throw shareError;

      return newPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast({
        title: "转发成功",
        description: "帖子已成功转发到你的主页",
      });
    },
    onError: (error) => {
      console.error("Share error:", error);
      toast({
        title: "转发失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });
}
