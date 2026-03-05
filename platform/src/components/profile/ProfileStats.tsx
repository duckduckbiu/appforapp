import { Skeleton } from "@/components/ui/skeleton";

interface ProfileStatsProps {
  stats: {
    postsCount: number;
    followingCount: number;
    followersCount: number;
    likesReceivedCount: number;
  } | undefined;
  isLoading: boolean;
  onFollowingClick?: () => void;
  onFollowersClick?: () => void;
}

export function ProfileStats({
  stats,
  isLoading,
  onFollowingClick,
  onFollowersClick,
}: ProfileStatsProps) {
  if (isLoading) {
    return (
      <div className="flex justify-around py-4 border-y border-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center">
            <Skeleton className="h-6 w-12 mx-auto mb-1" />
            <Skeleton className="h-4 w-10 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    { label: "动态", value: stats?.postsCount || 0 },
    {
      label: "关注",
      value: stats?.followingCount || 0,
      onClick: onFollowingClick,
    },
    {
      label: "粉丝",
      value: stats?.followersCount || 0,
      onClick: onFollowersClick,
    },
    { label: "获赞", value: stats?.likesReceivedCount || 0 },
  ];

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + "万";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  return (
    <div className="flex justify-around py-4 border-y border-border">
      {statItems.map((item) => (
        <button
          key={item.label}
          className={`text-center transition-colors ${
            item.onClick
              ? "hover:text-primary cursor-pointer"
              : "cursor-default"
          }`}
          onClick={item.onClick}
          disabled={!item.onClick}
        >
          <div className="text-lg font-semibold">{formatNumber(item.value)}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </button>
      ))}
    </div>
  );
}
