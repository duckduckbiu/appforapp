import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/posts/PostCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FileText, Bookmark, Heart } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

interface Post {
  id: string;
  content: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  collections_count: number;
  shares_count: number;
  author: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
  };
  media: Array<{
    id: string;
    media_type: string;
    media_url: string;
    thumbnail_url: string | null;
    masked_media_url: string | null;
    original_media_url: string | null;
    mask_regions: any;
    sort_order: number;
  }>;
  isLiked?: boolean;
  isCollected?: boolean;
}

interface ProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  posts: Post[];
  collections: Post[];
  likedPosts: Post[];
  isLoadingPosts: boolean;
  isLoadingCollections: boolean;
  isLoadingLiked: boolean;
  hasMorePosts: boolean;
  hasMoreCollections: boolean;
  hasMoreLiked: boolean;
  onLoadMorePosts: () => void;
  onLoadMoreCollections: () => void;
  onLoadMoreLiked: () => void;
  isOwnProfile: boolean;
}

function PostList({
  posts,
  isLoading,
  hasMore,
  onLoadMore,
  emptyMessage,
}: {
  posts: Post[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  emptyMessage: string;
}) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "200px",
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleIntersection]);

  if (!isLoading && posts.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={{
            id: post.id,
            content: post.content,
            visibility: post.visibility,
            likes_count: post.likes_count,
            comments_count: post.comments_count,
            shares_count: post.shares_count,
            collections_count: post.collections_count,
            created_at: post.created_at,
            author: post.author,
            media: post.media,
            is_liked: post.isLiked,
            is_collected: post.isCollected,
          }}
        />
      ))}

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {isLoading && <LoadingSpinner />}
        {!hasMore && posts.length > 0 && (
          <p className="text-sm text-muted-foreground">没有更多了</p>
        )}
      </div>
    </div>
  );
}

export function ProfileTabs({
  activeTab,
  onTabChange,
  posts,
  collections,
  likedPosts,
  isLoadingPosts,
  isLoadingCollections,
  isLoadingLiked,
  hasMorePosts,
  hasMoreCollections,
  hasMoreLiked,
  onLoadMorePosts,
  onLoadMoreCollections,
  onLoadMoreLiked,
  isOwnProfile,
}: ProfileTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0">
        <TabsTrigger
          value="posts"
          className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
        >
          <FileText className="h-4 w-4 mr-2" />
          动态
        </TabsTrigger>
        {isOwnProfile && (
          <>
            <TabsTrigger
              value="collections"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <Bookmark className="h-4 w-4 mr-2" />
              收藏
            </TabsTrigger>
            <TabsTrigger
              value="likes"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <Heart className="h-4 w-4 mr-2" />
              喜欢
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="posts" className="mt-4">
        <PostList
          posts={posts}
          isLoading={isLoadingPosts}
          hasMore={hasMorePosts}
          onLoadMore={onLoadMorePosts}
          emptyMessage="暂无动态"
        />
      </TabsContent>

      {isOwnProfile && (
        <>
          <TabsContent value="collections" className="mt-4">
            <PostList
              posts={collections}
              isLoading={isLoadingCollections}
              hasMore={hasMoreCollections}
              onLoadMore={onLoadMoreCollections}
              emptyMessage="暂无收藏"
            />
          </TabsContent>

          <TabsContent value="likes" className="mt-4">
            <PostList
              posts={likedPosts}
              isLoading={isLoadingLiked}
              hasMore={hasMoreLiked}
              onLoadMore={onLoadMoreLiked}
              emptyMessage="暂无喜欢"
            />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
