import { useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PostCard, type PostData } from "./PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface PostListProps {
  posts: PostData[];
  currentUserId?: string;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  onLike?: (postId: string, isLiked: boolean) => void;
  onCollect?: (postId: string, isCollected: boolean) => void;
  onShare?: (postId: string) => void;
  onDelete?: (postId: string) => void;
}

// 骨架屏组件
function PostSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-20 w-full mb-3" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

export function PostList({
  posts,
  currentUserId,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onRefresh,
  onLike,
  onCollect,
  onShare,
  onDelete,
}: PostListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // 估算每个帖子高度
    overscan: 3, // 预渲染前后 3 个
  });
  
  const virtualItems = virtualizer.getVirtualItems();

  // 监听滚动到 50% 位置时预加载下一页
  useEffect(() => {
    if (isLoading || isFetchingNextPage || !hasNextPage || posts.length === 0) return;
    
    const scrollElement = parentRef.current;
    if (!scrollElement) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
      
      // 滚动到 50% 时预加载
      if (scrollPercentage > 0.5 && hasNextPage && !isFetchingNextPage) {
        onLoadMore?.();
      }
    };
    
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [isLoading, isFetchingNextPage, hasNextPage, onLoadMore, posts.length]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">暂无社交内容</p>
        <p className="text-sm text-muted-foreground mb-4">
          关注更多用户或发布你的第一条内容
        </p>
        {onRefresh && (
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        <div
          className="absolute top-0 left-0 w-full"
          style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}
        >
          {virtualItems.map((virtualRow) => {
            const post = posts[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="pb-4 px-4"
              >
                <PostCard
                  post={post}
                  currentUserId={currentUserId}
                  onLike={() => onLike?.(post.id, post.is_liked || false)}
                  onCollect={() => onCollect?.(post.id, post.is_collected || false)}
                  onShare={() => onShare?.(post.id)}
                  onDelete={() => onDelete?.(post.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="default" />
        </div>
      )}
      
      {!hasNextPage && posts.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          没有更多了
        </p>
      )}
    </div>
  );
}
