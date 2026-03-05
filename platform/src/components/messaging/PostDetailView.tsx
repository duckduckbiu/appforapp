import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PostCard } from "@/components/posts/PostCard";
import { CommentInput } from "@/components/posts/CommentInput";
import { CommentList } from "@/components/posts/CommentList";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { usePost } from "@/hooks/usePost";
import { useComments, useDeleteComment } from "@/hooks/useComments";
import { useIdentity } from "@/contexts/IdentityContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PostDetailViewProps {
  postId: string;
}

export function PostDetailView({ postId }: PostDetailViewProps) {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const queryClient = useQueryClient();
  
  const { data: post, isLoading: postLoading } = usePost(postId);
  const { data: comments = [], isLoading: commentsLoading } = useComments(postId);
  const deleteComment = useDeleteComment();

  const userId = currentIdentity?.profile?.id;

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("未登录");
      const isLiked = post?.is_liked;
      
      if (isLiked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
        await supabase.from("posts").update({ likes_count: (post?.likes_count || 1) - 1 }).eq("id", postId);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
        await supabase.from("posts").update({ likes_count: (post?.likes_count || 0) + 1 }).eq("id", postId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  // Collect mutation
  const collectMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("未登录");
      const isCollected = post?.is_collected;
      
      if (isCollected) {
        await supabase.from("post_collections").delete().eq("post_id", postId).eq("user_id", userId);
        await supabase.from("posts").update({ collections_count: (post?.collections_count || 1) - 1 }).eq("id", postId);
      } else {
        await supabase.from("post_collections").insert({ post_id: postId, user_id: userId });
        await supabase.from("posts").update({ collections_count: (post?.collections_count || 0) + 1 }).eq("id", postId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("posts")
        .update({ is_deleted: true })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("帖子已删除");
      navigate("/conversations/notifications");
    },
  });

  const handleLike = (postId: string) => {
    likeMutation.mutate(postId);
  };

  const handleCollect = (postId: string) => {
    collectMutation.mutate(postId);
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate({ commentId, postId });
  };

  const handleBack = () => {
    navigate("/conversations/notifications");
  };

  if (postLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">帖子不存在或已被删除</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold">帖子详情</h2>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <PostCard
            post={post}
            currentUserId={userId}
            onLike={handleLike}
            onCollect={handleCollect}
            onDelete={handleDeletePost}
          />

          {/* Comment Input */}
          <div className="pt-4 border-t border-border">
            <CommentInput postId={postId} />
          </div>

          {/* Comments */}
          <CommentList
            comments={comments}
            postId={postId}
            currentUserId={userId}
            isLoading={commentsLoading}
            onDelete={handleDeleteComment}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
