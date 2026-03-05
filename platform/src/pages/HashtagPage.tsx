import { useParams } from "react-router-dom";
import { Hash, TrendingUp } from "lucide-react";
import { useHashtagPosts, useTrendingHashtags } from "@/hooks/useHashtags";
import { PostCard } from "@/components/posts/PostCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Link } from "react-router-dom";
import { useIdentity } from "@/contexts/IdentityContext";

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const { currentIdentity } = useIdentity();
  const { data, isLoading } = useHashtagPosts(tag || "");
  const { data: trendingHashtags } = useTrendingHashtags(10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Hash className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">#{tag}</h1>
                {data?.hashtag && (
                  <p className="text-muted-foreground text-sm">
                    {data.hashtag.post_count} 条帖子
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Posts */}
          {!data?.hashtag ? (
            <div className="text-center py-12 text-muted-foreground">
              <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无相关帖子</p>
            </div>
          ) : data.posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>该话题下暂无帖子</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.posts.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    content: post.content,
                    visibility: post.visibility,
                    likes_count: post.likes_count,
                    comments_count: post.comments_count,
                    shares_count: post.shares_count,
                    collections_count: post.collections_count || 0,
                    created_at: post.created_at,
                    author: {
                      id: post.author?.id || post.author_id,
                      display_name: post.author?.display_name,
                      unique_username: post.author?.unique_username || "unknown",
                      avatar_url: post.author?.avatar_url,
                    },
                    media: (post.media || []).map((m: any) => ({
                      id: m.id,
                      media_type: m.media_type,
                      media_url: m.media_url,
                      thumbnail_url: m.thumbnail_url,
                      original_media_url: m.original_media_url,
                      masked_media_url: m.masked_media_url,
                    })),
                  }}
                  currentUserId={currentIdentity?.profile?.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Trending */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20 bg-card border rounded-lg p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4" />
              热门话题
            </h3>
            <div className="space-y-2">
              {(trendingHashtags || []).map((hashtag) => (
                <Link
                  key={hashtag.id}
                  to={`/hashtag/${encodeURIComponent(hashtag.name)}`}
                  className="block p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="font-medium text-primary">#{hashtag.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {hashtag.post_count} 条帖子
                  </div>
                </Link>
              ))}
              {(!trendingHashtags || trendingHashtags.length === 0) && (
                <p className="text-sm text-muted-foreground">暂无热门话题</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
