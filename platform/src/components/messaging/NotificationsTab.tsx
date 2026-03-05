import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Heart, MessageCircle, UserPlus, AtSign } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useNavigate, useLocation } from "react-router-dom";
import {
  cacheNotifications,
  getCachedNotifications,
} from "@/lib/indexedDB";

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  created_at: string;
  sender?: {
    id: string;
    unique_username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface SocialNotification {
  id: string;
  user_id: string;
  type: "comment" | "like" | "follow" | "mention";
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  content: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    unique_username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface NotificationsTabProps {
  searchQuery?: string;
}

export function NotificationsTab({ searchQuery = "" }: NotificationsTabProps) {
  const { currentIdentity } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasAutoSelectedRef = useRef(false);

  // 自动选择第一个通知
  const autoSelectFirstNotification = useCallback((notifs: SocialNotification[]) => {
    // 只在基础路由或通知相关路由时自动选择
    const isBaseRoute = location.pathname === "/conversations";
    const isNotificationsRoute = location.pathname.startsWith("/conversations/post/") || 
                                  location.pathname.startsWith("/conversations/notifications");
    
    if (
      (isBaseRoute || isNotificationsRoute) &&
      !hasAutoSelectedRef.current &&
      notifs.length > 0
    ) {
      const firstWithPost = notifs.find(n => n.post_id);
      if (firstWithPost?.post_id) {
        hasAutoSelectedRef.current = true;
        navigate(`/conversations/post/${firstWithPost.post_id}`, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  // 当回到基础路由或离开 conversations 区域时，重置自动选择标记
  useEffect(() => {
    if (location.pathname === "/conversations" || !location.pathname.startsWith("/conversations")) {
      hasAutoSelectedRef.current = false;
    }
  }, [location.pathname]);
  
  // 当路由变为基础路由时，重新触发自动选择
  useEffect(() => {
    if (location.pathname === "/conversations" && notifications.length > 0 && !hasAutoSelectedRef.current) {
      autoSelectFirstNotification(notifications);
    }
  }, [location.pathname, notifications, autoSelectFirstNotification]);

  useEffect(() => {
    let mounted = true;
    let requestChannel: ReturnType<typeof supabase.channel> | null = null;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadData = async (useCache = false) => {
      if (!currentIdentity) return;

      const userId = currentIdentity.profile.id;

      // 首次加载时，先尝试从缓存获取数据实现秒开
      if (useCache) {
        try {
          const cached = await getCachedNotifications(userId);
          if (cached && mounted) {
            setRequests(cached.friendRequests);
            setNotifications(cached.socialNotifications);
            setIsLoading(false);
            autoSelectFirstNotification(cached.socialNotifications);
          }
        } catch {
          // 缓存读取失败，继续从服务器加载
        }
      }

      try {
        // 加载好友请求
        const { data: requestsData, error: requestsError } = await supabase
          .from("friend_requests")
          .select("*")
          .eq("receiver_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (requestsError) throw requestsError;

        // 加载发送者信息
        const requestsWithProfiles = await Promise.all(
          (requestsData || []).map(async (req) => {
            const { data: sender } = await supabase
              .from("profiles")
              .select("id, unique_username, display_name, avatar_url")
              .eq("id", req.sender_id)
              .single();
            return { ...req, sender };
          })
        );

        // 加载社交通知
        const { data: notificationsData, error: notificationsError } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (notificationsError) throw notificationsError;

        // 加载通知的触发者信息
        const notificationsWithProfiles = await Promise.all(
          (notificationsData || []).map(async (notif) => {
            const { data: actor } = await supabase
              .from("profiles")
              .select("id, unique_username, display_name, avatar_url")
              .eq("id", notif.actor_id)
              .single();
            return { ...notif, actor } as SocialNotification;
          })
        );

        if (mounted) {
          setRequests(requestsWithProfiles);
          setNotifications(notificationsWithProfiles);
          setIsLoading(false);
          // 自动选择第一个通知
          autoSelectFirstNotification(notificationsWithProfiles);
          
          // 更新缓存
          cacheNotifications(userId, requestsWithProfiles, notificationsWithProfiles);
        }

        // 订阅好友请求变化
        if (!requestChannel) {
          requestChannel = supabase
            .channel("friend-requests-notifications")
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "friend_requests",
                filter: `receiver_id=eq.${userId}`,
              },
              () => {
                if (mounted) loadData(false);
              }
            )
            .subscribe();
        }

        // 订阅社交通知变化
        if (!notificationChannel) {
          notificationChannel = supabase
            .channel("social-notifications")
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${userId}`,
              },
              () => {
                if (mounted) loadData(false);
              }
            )
            .subscribe();
        }
      } catch (error) {
        console.error("加载通知失败:", error);
        if (mounted) setIsLoading(false);
      }
    };

    // 首次加载使用缓存
    loadData(true);

    return () => {
      mounted = false;
      if (requestChannel) supabase.removeChannel(requestChannel);
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, [currentIdentity, autoSelectFirstNotification]);

  const handleAccept = async (requestId: string) => {
    if (!currentIdentity) return;

    try {
      const { error } = await supabase.rpc("accept_friend_request", {
        request_id: requestId,
      });

      if (error) throw error;

      toast.success("已接受好友请求");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "接受失败";
      toast.error(message);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已拒绝好友请求");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "拒绝失败";
      toast.error(message);
    }
  };

  const handleNotificationClick = async (notification: SocialNotification & { groupNotifications?: SocialNotification[] }) => {
    // 获取需要标记已读的通知 IDs
    const notificationIds = notification.groupNotifications 
      ? notification.groupNotifications.filter(n => !n.is_read).map(n => n.id)
      : (!notification.is_read ? [notification.id] : []);
    
    // 批量标记为已读
    if (notificationIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", notificationIds);
      
      setNotifications((prev) =>
        prev.map((n) =>
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
    }

    // 跳转到帖子详情（在右侧面板显示）
    if (notification.post_id) {
      navigate(`/conversations/post/${notification.post_id}`);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        locale: zhCN,
        addSuffix: true,
      });
    } catch {
      return "";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "comment":
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />;
      case "follow":
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case "mention":
        return <AtSign className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationText = (notification: SocialNotification, count: number = 1) => {
    const actorName = notification.actor?.display_name || notification.actor?.unique_username || "某用户";
    
    // 分组显示
    if (count > 1) {
      switch (notification.type) {
        case "comment":
          return `${actorName} 等 ${count} 人评论了你的帖子`;
        case "like":
          return `${actorName} 等 ${count} 人赞了你的帖子`;
        case "mention":
          return `${actorName} 等 ${count} 人提到了你`;
        default:
          return `${count} 条新通知`;
      }
    }
    
    switch (notification.type) {
      case "comment":
        return `${actorName} 评论了你的帖子`;
      case "like":
        return `${actorName} 赞了你的帖子`;
      case "follow":
        return `${actorName} 关注了你`;
      case "mention":
        return `${actorName} 在${notification.comment_id ? "评论" : "帖子"}中提到了你`;
      default:
        return "新通知";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  // 分组通知：同类型 + 同帖子的通知合并
  const groupedNotifications = (() => {
    const groups = new Map<string, SocialNotification[]>();
    const ungroupableTypes = ["follow"]; // follow 不分组
    
    notifications.forEach((notif) => {
      // follow 类型或没有 post_id 的不分组
      if (ungroupableTypes.includes(notif.type) || !notif.post_id) {
        groups.set(`single-${notif.id}`, [notif]);
      } else {
        const key = `${notif.type}-${notif.post_id}`;
        const existing = groups.get(key) || [];
        existing.push(notif);
        groups.set(key, existing);
      }
    });
    
    return Array.from(groups.values()).map((group) => ({
      notifications: group,
      latestNotification: group[0], // 已按时间排序，第一个是最新的
      count: group.length,
      hasUnread: group.some((n) => !n.is_read),
    }));
  })();

  // 合并并过滤所有通知
  const allItems = [
    ...requests.map((r) => ({ ...r, itemType: "request" as const, groupCount: 1, hasUnread: true })),
    ...groupedNotifications.map((g) => ({ 
      ...g.latestNotification, 
      itemType: "notification" as const,
      groupCount: g.count,
      groupNotifications: g.notifications,
      hasUnread: g.hasUnread,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredItems = allItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    if (item.itemType === "request") {
      const displayName = item.sender?.display_name || item.sender?.unique_username || "";
      return displayName.toLowerCase().includes(query) || item.message?.toLowerCase().includes(query);
    } else {
      const displayName = item.actor?.display_name || item.actor?.unique_username || "";
      return displayName.toLowerCase().includes(query) || item.content?.toLowerCase().includes(query);
    }
  });

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <Bell className="h-12 w-12 mb-2 opacity-50" />
        <p>暂无新通知</p>
        <p className="text-sm mt-1">好友请求和社交互动将显示在这里</p>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <Bell className="h-12 w-12 mb-2 opacity-50" />
        <p>未找到匹配的通知</p>
        <p className="text-sm mt-1">试试其他关键词</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {filteredItems.map((item) => {
          if (item.itemType === "request") {
            return (
              <div key={`request-${item.id}`} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={item.sender?.avatar_url || ""} />
                    <AvatarFallback>
                      {item.sender?.display_name?.[0] ||
                        item.sender?.unique_username?.[0] ||
                        "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">
                        {item.sender?.display_name || item.sender?.unique_username}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        好友请求
                      </Badge>
                    </div>
                    {item.message && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {getTimeAgo(item.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => handleAccept(item.id)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    接受
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleReject(item.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    拒绝
                  </Button>
                </div>
              </div>
            );
          } else {
            const groupCount = item.groupCount || 1;
            return (
              <div
                key={`notification-${item.id}`}
                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                  item.hasUnread ? "bg-primary/5" : ""
                }`}
                onClick={() => handleNotificationClick(item)}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.actor?.avatar_url || ""} />
                      <AvatarFallback>
                        {item.actor?.display_name?.[0] ||
                          item.actor?.unique_username?.[0] ||
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                      {getNotificationIcon(item.type)}
                    </div>
                    {groupCount > 1 && (
                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {groupCount}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {getNotificationText(item, groupCount)}
                    </p>
                    {item.content && groupCount === 1 && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        "{item.content}"
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {getTimeAgo(item.created_at)}
                    </p>
                  </div>

                  {item.hasUnread && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    </ScrollArea>
  );
}
