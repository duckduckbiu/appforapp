import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { FollowListSheet } from "@/components/profile/FollowListSheet";
import { useUserStats } from "@/hooks/useUserStats";
import { useUserPosts } from "@/hooks/useUserPosts";
import { useUserCollections } from "@/hooks/useUserCollections";
import { useUserLikedPosts } from "@/hooks/useUserLikedPosts";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentIdentity } = useIdentity();
  const currentUserId = currentIdentity?.profile?.id;

  // 如果没有 userId 参数，重定向到当前用户主页
  const targetUserId = userId || currentUserId;

  const [activeTab, setActiveTab] = useState("posts");
  const [followListType, setFollowListType] = useState<"following" | "followers" | null>(null);

  // 获取用户资料
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, unique_username, avatar_url, bio, cover_url")
        .eq("id", targetUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  // 获取用户统计
  const { data: stats, isLoading: isLoadingStats } = useUserStats(targetUserId);

  // 获取用户帖子
  const {
    data: postsData,
    isLoading: isLoadingPosts,
    hasNextPage: hasMorePosts,
    fetchNextPage: fetchMorePosts,
    isFetchingNextPage: isFetchingMorePosts,
  } = useUserPosts(targetUserId, currentUserId);

  // 获取用户收藏
  const {
    data: collectionsData,
    isLoading: isLoadingCollections,
    hasNextPage: hasMoreCollections,
    fetchNextPage: fetchMoreCollections,
    isFetchingNextPage: isFetchingMoreCollections,
  } = useUserCollections(targetUserId, currentUserId);

  // 获取用户点赞的帖子
  const {
    data: likedPostsData,
    isLoading: isLoadingLiked,
    hasNextPage: hasMoreLiked,
    fetchNextPage: fetchMoreLiked,
    isFetchingNextPage: isFetchingMoreLiked,
  } = useUserLikedPosts(targetUserId, currentUserId);

  // 如果没有 userId 且没有登录，重定向到登录页
  if (!userId && !currentUserId) {
    return <Navigate to="/auth" replace />;
  }

  // 加载中状态
  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // 用户不存在
  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">用户不存在</p>
      </div>
    );
  }

  const isOwnProfile = currentUserId === profile.id;

  // 扁平化帖子数据
  const posts = postsData?.pages.flatMap((page) => page.posts) || [];
  const collections = collectionsData?.pages.flatMap((page) => page.posts) || [];
  const likedPosts = likedPostsData?.pages.flatMap((page) => page.posts) || [];

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto pb-8">
        {/* Header */}
        <ProfileHeader profile={profile} />

        {/* Stats */}
        <ProfileStats
          stats={stats}
          isLoading={isLoadingStats}
          onFollowingClick={() => setFollowListType("following")}
          onFollowersClick={() => setFollowListType("followers")}
        />

        {/* Tabs */}
        <div className="px-4 mt-4">
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            posts={posts}
            collections={collections}
            likedPosts={likedPosts}
            isLoadingPosts={isLoadingPosts || isFetchingMorePosts}
            isLoadingCollections={isLoadingCollections || isFetchingMoreCollections}
            isLoadingLiked={isLoadingLiked || isFetchingMoreLiked}
            hasMorePosts={hasMorePosts || false}
            hasMoreCollections={hasMoreCollections || false}
            hasMoreLiked={hasMoreLiked || false}
            onLoadMorePosts={() => fetchMorePosts()}
            onLoadMoreCollections={() => fetchMoreCollections()}
            onLoadMoreLiked={() => fetchMoreLiked()}
            isOwnProfile={isOwnProfile}
          />
        </div>

        {/* Follow List Sheet */}
        {targetUserId && (
          <FollowListSheet
            open={followListType !== null}
            onOpenChange={(open) => !open && setFollowListType(null)}
            userId={targetUserId}
            type={followListType || "following"}
          />
        )}
      </div>
    </ScrollArea>
  );
}
