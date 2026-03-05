import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Globe,
  Users,
  UserCheck,
  Lock,
  Trash2,
  Flag,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PostMediaGrid } from "./PostMediaGrid";
import { FollowButton } from "./FollowButton";
import { PostEditDialog } from "./PostEditDialog";
import { CommentInput } from "./CommentInput";
import { CommentList } from "./CommentList";
import { useUnlockStatus, useUnlockRule } from "@/hooks/usePostUnlock";
import { useComments } from "@/hooks/useComments";
import { MentionText } from "@/components/ui/mention-text";
import { HashtagText } from "@/components/ui/hashtag-text";

export interface PostAuthor {
  id: string;
  display_name: string | null;
  unique_username: string;
  avatar_url: string | null;
}

export interface PostMedia {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  original_media_url?: string | null;
  masked_media_url?: string | null;
}

export interface PostData {
  id: string;
  content: string | null;
  visibility: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  collections_count: number;
  created_at: string;
  author: PostAuthor;
  media: PostMedia[];
  is_liked?: boolean;
  is_collected?: boolean;
}

interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  showFollowButton?: boolean;
  onLike?: (postId: string) => void;
  onCollect?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  className?: string;
}

const visibilityIcons = {
  public: Globe,
  followers: Users,
  friends: UserCheck,
  private: Lock,
};

export function PostCard({
  post,
  currentUserId,
  showFollowButton = true,
  onLike,
  onCollect,
  onShare,
  onDelete,
  className,
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [isCollected, setIsCollected] = useState(post.is_collected || false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [collectionsCount, setCollectionsCount] = useState(post.collections_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // 获取评论数据
  const { data: comments, isLoading: isLoadingComments, refetch: refetchComments } = useComments(
    showComments ? post.id : undefined
  );

  // 获取解锁规则和状态 - 在组件内部获取，而不是依赖预取
  const { data: unlockRule } = useUnlockRule(post.id);
  const { data: isUnlocked } = useUnlockStatus(post.id);
  
  const isOwner = currentUserId === post.author.id;
  
  // 判断是否锁定：有解锁规则 + 不是作者 + 未解锁
  const isLocked = !!unlockRule && !isOwner && !isUnlocked;

  const VisibilityIcon = visibilityIcons[post.visibility as keyof typeof visibilityIcons] || Globe;

  const handleLike = () => {
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount((prev) => prev + (newIsLiked ? 1 : -1));
    onLike?.(post.id);
  };

  const handleCollect = () => {
    const newIsCollected = !isCollected;
    setIsCollected(newIsCollected);
    setCollectionsCount((prev) => prev + (newIsCollected ? 1 : -1));
    onCollect?.(post.id);
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <article className={cn("rounded-lg border bg-card p-4", className)}>
      {/* 头部：作者信息 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author.id}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author.avatar_url || ""} />
              <AvatarFallback>
                {post.author.display_name?.[0] || post.author.unique_username[0]}
              </AvatarFallback>
            </Avatar>
          </Link>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link 
                to={`/profile/${post.author.id}`}
                className="font-medium hover:underline"
              >
                {post.author.display_name || post.author.unique_username}
              </Link>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>@{post.author.unique_username}</span>
              <span>·</span>
              <span>{timeAgo}</span>
              <span>·</span>
              <VisibilityIcon className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* 右上角：关注按钮 */}
        {showFollowButton && !isOwner && (
          <FollowButton targetUserId={post.author.id} size="sm" />
        )}
      </div>

      {/* 内容 */}
      {post.content && (
        <Link to={`/post/${post.id}`}>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            <HashtagText content={post.content} />
          </p>
        </Link>
      )}

      {/* 媒体网格 */}
      {post.media && post.media.length > 0 && (
        <div className="mt-3">
          <PostMediaGrid 
            media={post.media}
            postId={post.id}
            isLocked={isLocked}
            isUnlocked={isUnlocked || false}
            maskRegions={unlockRule?.mask_regions || []}
            requiredLikes={unlockRule?.required_count || 0}
            currentLikes={likesCount}
            isOwner={isOwner}
            unlockMode={unlockRule?.unlock_mode || "unified"}
            unlockedRegions={[]}
          />
        </div>
      )}

      {/* 互动按钮 */}
      <div className="mt-4 flex items-center border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn(
            "gap-1",
            isLiked && "text-red-500 hover:text-red-600"
          )}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
          <span className="text-xs">{likesCount}</span>
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("gap-1", showComments && "text-primary")}
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className={cn("h-4 w-4", showComments && "fill-current")} />
          <span className="text-xs">{commentsCount}</span>
          {showComments ? (
            <ChevronUp className="h-3 w-3 ml-0.5" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-0.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShare?.(post.id)}
          className="gap-1"
        >
          <Share2 className="h-4 w-4" />
          <span className="text-xs">{post.shares_count}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCollect}
          className={cn(
            "gap-1",
            isCollected && "text-yellow-500 hover:text-yellow-600"
          )}
        >
          <Bookmark className={cn("h-4 w-4", isCollected && "fill-current")} />
          <span className="text-xs">{collectionsCount}</span>
        </Button>

        {/* 更多按钮 - 移到互动按钮右侧 */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner ? (
                <>
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    编辑帖子
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(post.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除帖子
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem>
                  <Flag className="h-4 w-4 mr-2" />
                  举报
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 内联评论区 */}
      {showComments && (
        <div className="mt-4 border-t pt-4 space-y-4">
          {/* 评论输入框 */}
          <CommentInput 
            postId={post.id} 
            onSuccess={() => {
              setCommentsCount((prev) => prev + 1);
              refetchComments();
            }}
          />
          
          {/* 评论列表 */}
          <CommentList
            comments={comments || []}
            postId={post.id}
            currentUserId={currentUserId}
            isLoading={isLoadingComments}
          />
        </div>
      )}

      {/* 编辑帖子对话框 */}
      <PostEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        post={post}
      />
    </article>
  );
}
