import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PenSquare, RefreshCw, MapPin } from "lucide-react";
import { PostList } from "@/components/posts/PostList";
import { ShareDialog } from "@/components/posts/ShareDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRecommendFeed, useFollowingFeed, useFriendsFeed, useNearbyFeed } from "@/hooks/useFeedTabs";
import { usePostLike, usePostCollection, useDeletePost } from "@/hooks/useFeed";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocationPermission } from "@/hooks/useLocationPermission";

type FeedTab = "recommend" | "following" | "friends" | "nearby";

const TABS: { key: FeedTab; label: string }[] = [
  { key: "recommend", label: "推荐" },
  { key: "following", label: "关注" },
  { key: "friends", label: "好友" },
  { key: "nearby", label: "附近" },
];

export default function Feed() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;
  const [activeTab, setActiveTab] = useState<FeedTab>("recommend");
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  // 位置权限
  const { location, getCurrentLocation, permissionStatus } = useLocationPermission();

  // 当切换到附近 Tab 时请求位置
  useEffect(() => {
    if (activeTab === "nearby" && !location && permissionStatus !== "denied") {
      getCurrentLocation();
    }
  }, [activeTab, location, permissionStatus, getCurrentLocation]);

  // 各Tab的数据
  const recommendQuery = useRecommendFeed();
  const followingQuery = useFollowingFeed();
  const friendsQuery = useFriendsFeed();
  const nearbyQuery = useNearbyFeed(location || undefined);

  const likeMutation = usePostLike();
  const collectMutation = usePostCollection();
  const deleteMutation = useDeletePost();

  // 根据当前Tab获取对应数据
  const getActiveQuery = () => {
    switch (activeTab) {
      case "recommend":
        return recommendQuery;
      case "following":
        return followingQuery;
      case "friends":
        return friendsQuery;
      case "nearby":
        return nearbyQuery;
      default:
        return recommendQuery;
    }
  };

  const activeQuery = getActiveQuery();
  const posts = activeQuery.data?.pages.flatMap((page) => page.posts) || [];

  const handleLike = (postId: string, isLiked: boolean) => {
    likeMutation.mutate({ postId, isLiked });
  };

  const handleCollect = (postId: string, isCollected: boolean) => {
    collectMutation.mutate({ postId, isCollected });
  };

  const handleDeleteClick = (postId: string) => {
    setDeletePostId(postId);
  };

  const handleDeleteConfirm = () => {
    if (!deletePostId) return;
    deleteMutation.mutate(deletePostId, {
      onSuccess: () => {
        toast({ title: "删除成功" });
        setDeletePostId(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: "删除失败" });
      },
    });
  };

  const handleShare = (postId: string) => {
    setSharePostId(postId);
  };

  const handleRefresh = () => {
    activeQuery.refetch();
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="w-10" /> {/* 占位 */}
          
          {/* Tab 切换 */}
          <div className="flex items-center gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative py-2 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-9 w-9">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5 px-3">
              <Link to="/post/create">
                <PenSquare className="h-4 w-4" />
                <span>发帖</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto flex-1 flex flex-col min-h-0">
        {/* 附近 Tab 位置提示 */}
        {activeTab === "nearby" && !location && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            {permissionStatus === "denied" ? (
              <>
                <h3 className="text-lg font-medium mb-2">位置权限被拒绝</h3>
                <p className="text-sm text-muted-foreground">
                  请在浏览器设置中允许位置访问，以查看附近的帖子
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">正在获取位置...</h3>
                <p className="text-sm text-muted-foreground">
                  请允许位置权限以查看附近的帖子
                </p>
              </>
            )}
          </div>
        )}

        {/* 帖子列表 */}
        {(activeTab !== "nearby" || location) && (
          <div className="flex-1 min-h-0">
            <PostList
              posts={posts}
              currentUserId={userId}
              isLoading={activeQuery.isLoading}
              isFetchingNextPage={activeQuery.isFetchingNextPage}
              hasNextPage={activeQuery.hasNextPage}
              onLoadMore={() => activeQuery.fetchNextPage()}
              onRefresh={handleRefresh}
              onLike={handleLike}
              onCollect={handleCollect}
              onShare={handleShare}
              onDelete={handleDeleteClick}
            />
          </div>
        )}
      </div>

      {/* 转发对话框 */}
      <ShareDialog
        open={!!sharePostId}
        onOpenChange={(open) => !open && setSharePostId(null)}
        postId={sharePostId || ""}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={!!deletePostId}
        onOpenChange={(open) => !open && setDeletePostId(null)}
        title="删除帖子"
        description="确定要删除这条帖子吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
