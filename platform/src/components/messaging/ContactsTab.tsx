import { useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useIdentity } from "@/contexts/IdentityContext";
import { useFriends } from "@/hooks/useFriends";
import { useUnreadFriendRequests } from "@/hooks/useUnreadFriendRequests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ContactsTabProps {
  searchQuery?: string;
}

export function ContactsTab({ searchQuery = "" }: ContactsTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentIdentity } = useIdentity();
  const hasAutoSelectedRef = useRef(false);

  // 使用 React Query hook 获取好友列表
  const { data: friends = [], isLoading } = useFriends(currentIdentity?.profile.id);
  
  // 获取未读好友请求数量
  const { hasUnread, count: requestCount } = useUnreadFriendRequests();

  // 自动选择第一项（好友请求入口）
  useEffect(() => {
    if (
      !isLoading &&
      location.pathname === "/conversations" &&
      !hasAutoSelectedRef.current
    ) {
      hasAutoSelectedRef.current = true;
      // 默认进入好友请求页面
      navigate("/conversations/requests", { replace: true });
    }
  }, [isLoading, location.pathname, navigate]);

  // 当回到基础路由或离开 conversations 区域时，重置自动选择标记
  useEffect(() => {
    if (location.pathname === "/conversations" || !location.pathname.startsWith("/conversations")) {
      hasAutoSelectedRef.current = false;
    }
  }, [location.pathname]);

  const viewProfile = (friendId: string) => {
    navigate(`/conversations/user/${friendId}`);
  };

  const viewFriendRequests = () => {
    navigate("/conversations/requests");
  };

  // 过滤好友（使用 useMemo 优化性能）
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;

    const query = searchQuery.toLowerCase();
    return friends.filter((friend) => {
      const displayName =
        friend.nickname ||
        friend.friend?.display_name ||
        friend.friend?.unique_username ||
        "";
      return displayName.toLowerCase().includes(query);
    });
  }, [friends, searchQuery]);

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  // 渲染好友列表和好友请求入口
  return (
    <ScrollArea className="h-full">
      {/* 好友请求入口 - 始终显示 */}
      <div
        className="flex items-center gap-3 p-4 border-b hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={viewFriendRequests}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">好友请求</h3>
            {hasUnread && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {requestCount}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {hasUnread ? `${requestCount} 条新请求` : "暂无新请求"}
          </p>
        </div>
      </div>

      {/* 好友列表或空状态 */}
      {filteredFriends.length > 0 ? (
        <div className="divide-y divide-border">
          {filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => viewProfile(friend.friend_id)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={friend.friend?.avatar_url || ""} />
                <AvatarFallback>
                  {friend.friend?.display_name?.[0] ||
                    friend.friend?.unique_username[0] ||
                    "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">
                  {friend.nickname ||
                    friend.friend?.display_name ||
                    friend.friend?.unique_username}
                </h3>
                {friend.nickname && (
                  <p className="text-sm text-muted-foreground truncate">
                    {friend.friend?.display_name || friend.friend?.unique_username}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-2 opacity-50" />
          <p>暂无好友</p>
          <p className="text-sm mt-1">去添加好友吧</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-2 opacity-50" />
          <p>未找到匹配的好友</p>
          <p className="text-sm mt-1">试试其他关键词</p>
        </div>
      )}
    </ScrollArea>
  );
}