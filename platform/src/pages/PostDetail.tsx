import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/posts/PostCard";
import { CommentInput } from "@/components/posts/CommentInput";
import { CommentList } from "@/components/posts/CommentList";
import { usePost } from "@/hooks/usePost";
import { useComments, useDeleteComment } from "@/hooks/useComments";
import { usePostLike, usePostCollection, useDeletePost } from "@/hooks/useFeed";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  const { data: post, isLoading: postLoading } = usePost(postId);
  const { data: comments = [], isLoading: commentsLoading } = useComments(postId);

  const likeMutation = usePostLike();
  const collectMutation = usePostCollection();
  const deletePostMutation = useDeletePost();
  const deleteCommentMutation = useDeleteComment();

  const handleLike = () => {
    if (!postId || !post) return;
    likeMutation.mutate({ postId, isLiked: post.is_liked || false });
  };

  const handleCollect = () => {
    if (!postId || !post) return;
    collectMutation.mutate({ postId, isCollected: post.is_collected || false });
  };

  const handleDeletePost = () => {
    if (!postId) return;
    deletePostMutation.mutate(postId, {
      onSuccess: () => {
        toast({ title: "删除成功" });
        navigate("/feed");
      },
    });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!postId) return;
    deleteCommentMutation.mutate(
      { commentId, postId },
      {
        onSuccess: () => {
          toast({ title: "评论已删除" });
        },
      }
    );
  };

  if (postLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">帖子详情</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p>帖子不存在或已被删除</p>
          <Button variant="link" onClick={() => navigate("/feed")}>
            返回动态
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">帖子详情</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 帖子内容 */}
        <PostCard
          post={post}
          currentUserId={userId}
          onLike={handleLike}
          onCollect={handleCollect}
          onDelete={handleDeletePost}
        />

        <Separator />

        {/* 评论输入 */}
        <div>
          <h2 className="font-medium mb-3">
            评论 {post.comments_count > 0 && `(${post.comments_count})`}
          </h2>
          <CommentInput postId={post.id} />
        </div>

        <Separator />

        {/* 评论列表 */}
        <CommentList
          comments={comments}
          postId={post.id}
          currentUserId={userId}
          isLoading={commentsLoading}
          onDelete={handleDeleteComment}
        />
      </div>
    </div>
  );
}
