import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/contexts/IdentityContext";
import { useIsFollowing, useFollowUser } from "@/hooks/useFollow";
import { Edit, UserPlus, UserMinus, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProfileHeaderProps {
  profile: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
    bio: string | null;
    cover_url: string | null;
  };
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const currentUserId = currentIdentity?.profile?.id;
  const isOwnProfile = currentUserId === profile.id;

  const { data: isFollowing, isLoading: isFollowingLoading } = useIsFollowing(profile.id);
  const followMutation = useFollowUser();

  const handleFollow = () => {
    if (!currentUserId) {
      toast({ variant: "destructive", title: "请先登录" });
      return;
    }
    followMutation.mutate({
      targetUserId: profile.id,
      isFollowing: isFollowing || false,
    });
  };

  const handleMessage = async () => {
    if (!currentUserId) {
      toast({ variant: "destructive", title: "请先登录" });
      return;
    }

    try {
      const { data: conversationId, error } = await supabase.rpc(
        "create_private_conversation",
        { friend_uuid: profile.id }
      );

      if (error) throw error;
      navigate(`/conversations/chat/${conversationId}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "无法发起对话",
        description: error.message,
      });
    }
  };

  const handleEdit = () => {
    navigate("/settings");
  };

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="h-32 sm:h-48 bg-gradient-to-r from-primary/20 to-primary/10 relative overflow-hidden">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="relative -mt-16 sm:-mt-20 mb-4">
          <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-background shadow-lg">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-2xl sm:text-4xl bg-primary/10">
              {(profile.display_name || profile.unique_username)?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name & Username */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {profile.display_name || profile.unique_username}
            </h1>
            <p className="text-muted-foreground">@{profile.unique_username}</p>
            {profile.bio && (
              <p className="mt-2 text-sm text-foreground/80 max-w-md">{profile.bio}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isOwnProfile ? (
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                编辑资料
              </Button>
            ) : (
              <>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollow}
                  disabled={followMutation.isPending || isFollowingLoading}
                >
                  {followMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : isFollowing ? (
                    <UserMinus className="h-4 w-4 mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {isFollowing ? "取消关注" : "关注"}
                </Button>
                <Button variant="outline" onClick={handleMessage}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  私信
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
