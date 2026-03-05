import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useFollowing, useFollowers, useFollowUser, useIsFollowing } from "@/hooks/useFollow";
import { useIdentity } from "@/contexts/IdentityContext";
import { useNavigate } from "react-router-dom";
import { UserPlus, UserMinus } from "lucide-react";

interface FollowListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: "following" | "followers";
}

interface UserItemProps {
  user: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
    bio: string | null;
  };
  onNavigate: () => void;
}

function UserItem({ user, onNavigate }: UserItemProps) {
  const { currentIdentity } = useIdentity();
  const currentUserId = currentIdentity?.profile?.id;
  const isOwnProfile = currentUserId === user.id;

  const { data: isFollowing } = useIsFollowing(user.id);
  const followMutation = useFollowUser();

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    followMutation.mutate({
      targetUserId: user.id,
      isFollowing: isFollowing || false,
    });
  };

  return (
    <div
      className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-lg cursor-pointer transition-colors"
      onClick={onNavigate}
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={user.avatar_url || undefined} />
        <AvatarFallback>
          {(user.display_name || user.unique_username)?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {user.display_name || user.unique_username}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          @{user.unique_username}
        </p>
        {user.bio && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {user.bio}
          </p>
        )}
      </div>

      {!isOwnProfile && currentUserId && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          onClick={handleFollow}
          disabled={followMutation.isPending}
        >
          {followMutation.isPending ? (
            <LoadingSpinner size="sm" />
          ) : isFollowing ? (
            <UserMinus className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}

export function FollowListSheet({
  open,
  onOpenChange,
  userId,
  type,
}: FollowListSheetProps) {
  const navigate = useNavigate();
  
  const { data: following, isLoading: isLoadingFollowing } = useFollowing(
    type === "following" ? userId : undefined
  );
  const { data: followers, isLoading: isLoadingFollowers } = useFollowers(
    type === "followers" ? userId : undefined
  );

  const isLoading = type === "following" ? isLoadingFollowing : isLoadingFollowers;
  const users = type === "following"
    ? (following || []).map((f) => f.following as any)
    : (followers || []).map((f) => f.follower as any);

  const handleNavigateToProfile = (targetUserId: string) => {
    onOpenChange(false);
    navigate(`/profile/${targetUserId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{type === "following" ? "关注" : "粉丝"}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {type === "following" ? "暂无关注" : "暂无粉丝"}
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => (
                <UserItem
                  key={user.id}
                  user={user}
                  onNavigate={() => handleNavigateToProfile(user.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
