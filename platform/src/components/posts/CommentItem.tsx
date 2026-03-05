import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CommentInput } from "./CommentInput";
import type { Comment } from "@/hooks/useComments";
import { cn } from "@/lib/utils";
import { MentionText } from "@/components/ui/mention-text";

interface CommentItemProps {
  comment: Comment;
  postId: string;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
  isReply?: boolean;
  rootParentId?: string;
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
}

export function CommentItem({
  comment,
  postId,
  currentUserId,
  onDelete,
  isReply = false,
  rootParentId,
  selectedCommentId,
  onSelectComment,
}: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const isOwner = currentUserId === comment.author.id;
  const isSelected = selectedCommentId === comment.id;

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: zhCN,
  });

  const replyParentId = rootParentId || comment.id;

  const handleClick = () => {
    onSelectComment(isSelected ? null : comment.id);
  };

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReplyInput(!showReplyInput);
  };

  return (
    <div className={cn("flex gap-3", isReply && "ml-11")}>
      <Link to={`/profile/${comment.author.id}`} onClick={(e) => e.stopPropagation()}>
        <Avatar className={cn("shrink-0", isReply ? "h-7 w-7" : "h-8 w-8")}>
          <AvatarImage src={comment.author.avatar_url || ""} />
          <AvatarFallback>
            {comment.author.display_name?.[0] || comment.author.unique_username[0]}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={handleClick}
      >
        {/* 第一行：用户名、时间 */}
        <div className="flex items-center gap-2">
          <Link
            to={`/profile/${comment.author.id}`}
            className="font-medium text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {comment.author.display_name || comment.author.unique_username}
          </Link>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        {/* 第二行：评论内容 + 操作按钮 */}
        <div className="flex items-start justify-between gap-2 mt-1">
          <p className="text-sm whitespace-pre-wrap break-words flex-1">
            <MentionText text={comment.content} />
          </p>
          
          {/* 操作按钮：点击评论后显示 */}
          {isSelected && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReplyClick}
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                回复
              </Button>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(comment.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 回复输入框 */}
        {showReplyInput && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <CommentInput
              postId={postId}
              parentId={replyParentId}
              placeholder={`回复 @${comment.author.display_name || comment.author.unique_username}`}
              onSuccess={() => setShowReplyInput(false)}
            />
          </div>
        )}

        {/* 嵌套回复 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                currentUserId={currentUserId}
                onDelete={onDelete}
                isReply
                rootParentId={comment.id}
                selectedCommentId={selectedCommentId}
                onSelectComment={onSelectComment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
