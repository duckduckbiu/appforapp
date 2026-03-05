import { useState } from "react";
import { CommentItem } from "./CommentItem";
import { Skeleton } from "@/components/ui/skeleton";
import type { Comment } from "@/hooks/useComments";

interface CommentListProps {
  comments: Comment[];
  postId: string;
  currentUserId?: string;
  isLoading?: boolean;
  onDelete?: (commentId: string) => void;
}

export function CommentList({
  comments,
  postId,
  currentUserId,
  isLoading,
  onDelete,
}: CommentListProps) {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>暂无评论</p>
        <p className="text-sm mt-1">成为第一个评论的人</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          currentUserId={currentUserId}
          onDelete={onDelete}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
        />
      ))}
    </div>
  );
}
