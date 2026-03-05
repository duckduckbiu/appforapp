import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserX, Check, X, MessageCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMessageRequests } from "@/hooks/useMessageRequests";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface StrangersTabProps {
  searchQuery?: string;
}

export function StrangersTab({ searchQuery = "" }: StrangersTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasAutoSelectedRef = useRef(false);
  const {
    receivedRequests,
    isLoading,
    acceptRequest,
    isAccepting,
    rejectRequest,
    isRejecting,
  } = useMessageRequests();

  // 过滤搜索结果
  const filteredRequests = receivedRequests?.filter((req) => {
    if (!searchQuery) return true;
    const sender = req.sender;
    if (!sender) return false;
    const query = searchQuery.toLowerCase();
    return (
      sender.display_name?.toLowerCase().includes(query) ||
      sender.unique_username.toLowerCase().includes(query)
    );
  });

  // 自动选择第一个请求
  useEffect(() => {
    if (
      !hasAutoSelectedRef.current &&
      filteredRequests &&
      filteredRequests.length > 0 &&
      location.pathname === "/conversations"
    ) {
      hasAutoSelectedRef.current = true;
      // 可以导航到请求详情或保持当前视图
    }
  }, [filteredRequests, location.pathname]);

  // 当回到基础路由或离开 conversations 区域时，重置自动选择标记
  useEffect(() => {
    if (location.pathname === "/conversations" || !location.pathname.startsWith("/conversations")) {
      hasAutoSelectedRef.current = false;
    }
  }, [location.pathname]);

  // 处理接受请求
  const handleAccept = async (requestId: string) => {
    const conversationId = await acceptRequest(requestId);
    if (conversationId) {
      navigate(`/conversations/chat/${conversationId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!filteredRequests || filteredRequests.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
          <UserX className="h-12 w-12 mb-2 opacity-50" />
          <p>暂无陌生人消息</p>
          <p className="text-sm mt-1">来自非好友的消息请求将显示在这里</p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {filteredRequests.map((request) => {
          const sender = request.sender;
          if (!sender) return null;

          return (
            <div
              key={request.id}
              className="p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  className="h-10 w-10 cursor-pointer"
                  onClick={() => navigate(`/profile/${sender.id}`)}
                >
                  <AvatarImage src={sender.avatar_url} />
                  <AvatarFallback>
                    {sender.display_name?.[0] || sender.unique_username[0]}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className="font-medium truncate cursor-pointer hover:underline"
                      onClick={() => navigate(`/profile/${sender.id}`)}
                    >
                      {sender.display_name || sender.unique_username}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), {
                        locale: zhCN,
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{sender.unique_username}
                  </p>
                  <p className="text-sm mt-1 line-clamp-2">{request.message}</p>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(request.id)}
                      disabled={isAccepting || isRejecting}
                      className="gap-1"
                    >
                      {isAccepting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      接受
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectRequest(request.id)}
                      disabled={isAccepting || isRejecting}
                      className="gap-1"
                    >
                      {isRejecting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      拒绝
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}