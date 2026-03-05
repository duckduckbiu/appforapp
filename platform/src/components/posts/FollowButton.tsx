import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus } from "lucide-react";
import { useIsFollowing, useFollowUser } from "@/hooks/useFollow";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useIdentity } from "@/contexts/IdentityContext";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  targetUserId: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function FollowButton({ targetUserId, className, size = "sm" }: FollowButtonProps) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;
  
  const { data: isFollowing, isLoading: checkLoading } = useIsFollowing(targetUserId);
  const { mutate: toggleFollow, isPending } = useFollowUser();

  // 不显示关注自己的按钮
  if (userId === targetUserId) return null;

  const handleClick = () => {
    toggleFollow({ targetUserId, isFollowing: !!isFollowing });
  };

  const loading = checkLoading || isPending;

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "rounded-full px-3 py-1 h-7 text-xs gap-1",
        className
      )}
    >
      {loading ? (
        <LoadingSpinner size="sm" />
      ) : isFollowing ? (
        <>
          <UserMinus className="h-3 w-3" />
          已关注
        </>
      ) : (
        <>
          <UserPlus className="h-3 w-3" />
          关注
        </>
      )}
    </Button>
  );
}
