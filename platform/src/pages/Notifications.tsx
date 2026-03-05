import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, MessageSquare, UserPlus, Settings2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  created_at: string;
  read: boolean;
  data?: any;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [aiPermissionRequests, setAiPermissionRequests] = useState<any[]>([]);

  useEffect(() => {
    loadNotifications();
    loadFriendRequests();
    loadAIPermissionRequests();
  }, []);

  const loadNotifications = async () => {
    try {
      // 这里可以从数据库加载通知
      // 暂时使用模拟数据
      const mockNotifications: Notification[] = [
        {
          id: "1",
          type: "message",
          title: "新消息",
          content: "张三给你发送了一条消息",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          read: false,
        },
        {
          id: "2",
          type: "system",
          title: "系统通知",
          content: "您的账号安全设置已更新",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          read: true,
        },
      ];
      setNotifications(mockNotifications);
    } catch (error) {
      console.error("加载通知失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey(id, display_name, unique_username, avatar_url)
        `)
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFriendRequests(data || []);
    } catch (error) {
      console.error("加载好友请求失败:", error);
    }
  };

  const loadAIPermissionRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("ai_permission_requests")
        .select(`
          *,
          avatar:ai_avatars!ai_permission_requests_avatar_id_fkey(id, name, display_name, avatar_url)
        `)
        .eq("owner_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAiPermissionRequests(data || []);
    } catch (error) {
      console.error("加载 AI 权限请求失败:", error);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc("accept_friend_request", {
        request_id: requestId,
      });

      if (error) throw error;

      toast.success("已接受好友请求");
      await loadFriendRequests();
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已拒绝好友请求");
      await loadFriendRequests();
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const handleApproveAIPermission = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("ai_permission_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已批准 AI 权限请求");
      await loadAIPermissionRequests();
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const handleRejectAIPermission = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("ai_permission_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已拒绝 AI 权限请求");
      await loadAIPermissionRequests();
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    toast.success("已全部标记为已读");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "message":
        return <MessageSquare className="h-5 w-5 text-primary" />;
      case "friend_request":
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case "ai_permission":
        return <Settings2 className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  const totalPendingCount = friendRequests.length + aiPermissionRequests.length;

  return (
    <div className="bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">通知中心</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalPendingCount > 0 && `${totalPendingCount} 条待处理请求`}
              {unreadCount > 0 && ` · ${unreadCount} 条未读通知`}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              全部已读
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {/* AI 权限请求 */}
          {aiPermissionRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-purple-500" />
                  AI 权限请求
                  <Badge variant="secondary">{aiPermissionRequests.length}</Badge>
                </CardTitle>
                <CardDescription>您的 AI 分身请求以下权限</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiPermissionRequests.map((request, index) => (
                  <div key={request.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.avatar?.avatar_url} />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="font-medium">
                            {request.avatar?.display_name || request.avatar?.name}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            请求类型: {request.request_type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(request.created_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveAIPermission(request.id)}
                          >
                            批准
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectAIPermission(request.id)}
                          >
                            拒绝
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 好友请求 */}
          {friendRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-500" />
                  好友请求
                  <Badge variant="secondary">{friendRequests.length}</Badge>
                </CardTitle>
                <CardDescription>以下用户想添加您为好友</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {friendRequests.map((request, index) => (
                  <div key={request.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.sender?.avatar_url} />
                        <AvatarFallback>
                          {request.sender?.display_name?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="font-medium">
                            {request.sender?.display_name || request.sender?.unique_username}
                          </div>
                          {request.message && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {request.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(request.created_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptFriendRequest(request.id)}
                          >
                            接受
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectFriendRequest(request.id)}
                          >
                            拒绝
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 系统通知 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                系统通知
                {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
              </CardTitle>
              <CardDescription>站内信和其他通知</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无通知
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <div key={notification.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {notification.title}
                              {!notification.read && (
                                <Badge variant="default" className="h-5 text-xs">
                                  新
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.content}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
