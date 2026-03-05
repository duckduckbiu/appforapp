import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { useFriendRequests, type FriendRequest } from "@/hooks/useFriendRequests";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRejectedRequestsCount } from "@/hooks/useRejectedRequestsCount";

interface MessageHistoryItem {
  type: "request" | "reject";
  message: string;
  timestamp: string;
  user_id: string;
}

export function FriendRequestsView() {
  const { currentIdentity } = useIdentity();
  const queryClient = useQueryClient();
  
  // 使用优化的 React Query hook 获取好友请求
  const { data, isLoading } = useFriendRequests(currentIdentity?.profile.id);
  const receivedRequests = data?.received || [];
  const sentRequests = data?.sent || [];
  
  const [activeTab, setActiveTab] = useState("received");
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [resendMessages, setResendMessages] = useState<Record<string, string>>({});
  const { hasUnread: hasRejectedUnread, count: rejectedCount } = useRejectedRequestsCount();

  const handleTabChange = async (tab: string) => {
    setActiveTab(tab);
    
    // 切换到收到的请求标签时，标记所有收到的请求为已读
    if (tab === "received" && currentIdentity) {
      try {
        await supabase
          .from("friend_requests")
          .update({ is_read: true })
          .eq("receiver_id", currentIdentity.profile.id)
          .eq("is_read", false);
        
        // 刷新数据
        queryClient.invalidateQueries({ queryKey: ["friendRequests", currentIdentity.profile.id] });
      } catch (error) {
        console.error("标记已读失败:", error);
      }
    }
    
    // 切换到已发送标签时，标记所有被拒绝的请求为已读
    if (tab === "sent" && currentIdentity) {
      try {
        await supabase
          .from("friend_requests")
          .update({ is_read: true })
          .eq("sender_id", currentIdentity.profile.id)
          .eq("status", "rejected")
          .eq("is_read", false);
        
        // 刷新数据
        queryClient.invalidateQueries({ queryKey: ["friendRequests", currentIdentity.profile.id] });
      } catch (error) {
        console.error("标记已读失败:", error);
      }
    }
  };

  const handleAccept = async (requestId: string) => {
    if (!currentIdentity) return;

    try {
      // 先标记为已读
      await markAsRead(requestId);

      const { error } = await supabase.rpc("accept_friend_request", {
        request_id: requestId,
      });

      if (error) throw error;

      toast.success("已接受好友请求");
      
      // 刷新好友请求数据
      queryClient.invalidateQueries({ queryKey: ["friendRequests", currentIdentity.profile.id] });
    } catch (error: any) {
      toast.error(error.message || "接受失败");
    }
  };

  const handleReject = async (requestId: string) => {
    if (!currentIdentity) return;
    
    const reason = rejectReasons[requestId]?.trim() || "";

    try {
      // 先标记为已读
      await markAsRead(requestId);

      const request = receivedRequests.find((r) => r.id === requestId);
      if (!request) return;

      // 构建消息历史
      const messageHistory: MessageHistoryItem[] = request.message_history || [];
      
      // 添加初始请求消息（如果历史为空）
      if (messageHistory.length === 0 && request.message) {
        messageHistory.push({
          type: "request",
          message: request.message,
          timestamp: request.created_at,
          user_id: request.sender_id,
        });
      }

      // 如果有拒绝理由，添加到历史
      if (reason) {
        messageHistory.push({
          type: "reject",
          message: reason,
          timestamp: new Date().toISOString(),
          user_id: currentIdentity.profile.id,
        });
      }

      const { error } = await supabase
        .from("friend_requests")
        .update({
          status: "rejected",
          reject_reason: reason || null,
          message_history: messageHistory as any,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已拒绝好友请求");
      setRejectReasons((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      
      // 刷新好友请求数据
      queryClient.invalidateQueries({ queryKey: ["friendRequests", currentIdentity.profile.id] });
    } catch (error: any) {
      toast.error(error.message || "拒绝失败");
    }
  };

  const toggleExpand = (requestId: string) => {
    setExpandedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
        // 展开时标记为已读
        markAsRead(requestId);
      }
      return next;
    });
  };

  const markAsRead = async (requestId: string) => {
    try {
      await supabase
        .from("friend_requests")
        .update({ is_read: true })
        .eq("id", requestId);
    } catch (error) {
      console.error("标记已读失败:", error);
    }
  };

  const handleResendRequest = async (request: FriendRequest) => {
    if (!currentIdentity) return;

    const newMessage = resendMessages[request.id]?.trim() || "";

    try {
      // 先删除旧的被拒绝请求
      const { error: deleteError } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", request.id);

      if (deleteError) throw deleteError;

      // 创建新的好友请求
      const { error: insertError } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: currentIdentity.profile.id,
          receiver_id: request.receiver_id,
          message: newMessage || null,
          status: "pending",
        });

      if (insertError) throw insertError;

      toast.success("已重新发送好友请求");
      
      // 清理状态
      setResendMessages((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      setExpandedRequests((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
      
      // 刷新好友请求数据
      queryClient.invalidateQueries({ queryKey: ["friendRequests", currentIdentity.profile.id] });
    } catch (error: any) {
      toast.error(error.message || "发送失败");
    }
  };

  const handleClickResend = (requestId: string, originalMessage: string | null) => {
    // 展开请求
    setExpandedRequests((prev) => {
      const next = new Set(prev);
      next.add(requestId);
      return next;
    });
    
    // 初始化重发消息内容为原消息
    setResendMessages((prev) => ({
      ...prev,
      [requestId]: originalMessage || "",
    }));
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "待处理";
      case "accepted":
        return "已接受";
      case "rejected":
        return "已拒绝";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
          <TabsTrigger value="received" className="relative">
            收到的请求
            {receivedRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {receivedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="relative">
            已发送
            {hasRejectedUnread && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {rejectedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="flex-1 m-0">
          {receivedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
              <p>暂无请求</p>
              <p className="text-sm mt-1">好友请求将显示在这里</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">收到的好友请求</h2>
                <div className="space-y-4">
                  {receivedRequests.map((request) => {
                    const isExpanded = expandedRequests.has(request.id);
                    const isPending = request.status === "pending";
                    const messageHistory = request.message_history || [];
                    
                    return (
                      <Collapsible
                        key={request.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpand(request.id)}
                      >
                        <div className="rounded-lg border bg-card">
                          {/* 头部：始终显示 */}
                          <div className="flex items-center gap-4 p-4">
                            <Avatar className="h-12 w-12 flex-shrink-0">
                              <AvatarImage src={request.sender?.avatar_url || ""} />
                              <AvatarFallback>
                                {request.sender?.display_name?.[0] ||
                                  request.sender?.unique_username[0] ||
                                  "?"}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium">
                                  {request.sender?.display_name ||
                                    request.sender?.unique_username}
                                </h3>
                                <Badge
                                  variant={
                                    request.status === "accepted"
                                      ? "default"
                                      : request.status === "rejected"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-xs flex-shrink-0"
                                >
                                  {getStatusText(request.status)}
                                </Badge>
                                <span className="text-muted-foreground">·</span>
                                <p className="text-sm text-muted-foreground flex-shrink-0">
                                  {getTimeAgo(request.updated_at)}
                                </p>
                                {request.message && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                                      {request.message}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 操作按钮区 */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAccept(request.id)}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    接受
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isExpanded) {
                                        toggleExpand(request.id);
                                      }
                                    }}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    拒绝
                                  </Button>
                                </>
                              )}
                              <CollapsibleTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>

                          {/* 展开内容：对话历史 */}
                          <CollapsibleContent>
                            <div className="px-4 pb-4 border-t">
                              <div className="mt-4 space-y-3">
                                {/* 初始请求消息 */}
                                {request.message && messageHistory.length === 0 && (
                                  <div className="flex gap-3">
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                      <AvatarImage src={request.sender?.avatar_url || ""} />
                                      <AvatarFallback className="text-xs">
                                        {request.sender?.display_name?.[0] || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <div className="bg-muted rounded-lg p-3">
                                        <p className="text-sm">{request.message}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {getTimeAgo(request.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* 消息历史 */}
                                {messageHistory.map((msg, idx) => {
                                  const isSender = msg.user_id === request.sender_id;
                                  const user = isSender ? request.sender : request.receiver;
                                  
                                  return (
                                    <div key={idx} className="flex gap-3">
                                      <Avatar className="h-8 w-8 flex-shrink-0">
                                        <AvatarImage src={user?.avatar_url || ""} />
                                        <AvatarFallback className="text-xs">
                                          {user?.display_name?.[0] || "?"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div
                                          className={`rounded-lg p-3 ${
                                            msg.type === "reject"
                                              ? "bg-destructive/10"
                                              : "bg-muted"
                                          }`}
                                        >
                                          <p className="text-sm">{msg.message}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {getTimeAgo(msg.timestamp)}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* 拒绝输入框（仅待处理状态显示） */}
                                {isPending && (
                                  <div className="mt-4 space-y-2">
                                    <Textarea
                                      placeholder="输入拒绝理由..."
                                      value={rejectReasons[request.id] || ""}
                                      onChange={(e) =>
                                        setRejectReasons((prev) => ({
                                          ...prev,
                                          [request.id]: e.target.value,
                                        }))
                                      }
                                      className="min-h-[80px]"
                                    />
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleReject(request.id)}
                                      >
                                        发送拒绝理由
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="sent" className="flex-1 m-0">
          {sentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
              <p>暂无已发送请求</p>
              <p className="text-sm mt-1">你发送的请求将显示在这里</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">已发送</h2>
                <div className="space-y-4">
                  {sentRequests.map((request) => {
                    const isExpanded = expandedRequests.has(request.id);
                    const messageHistory = request.message_history || [];
                    
                    return (
                      <Collapsible
                        key={request.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpand(request.id)}
                      >
                        <div className="rounded-lg border bg-card">
                          {/* 头部：始终显示 */}
                          <div className="flex items-center gap-4 p-4">
                            <Avatar className="h-12 w-12 flex-shrink-0">
                              <AvatarImage src={request.receiver?.avatar_url || ""} />
                              <AvatarFallback>
                                {request.receiver?.display_name?.[0] ||
                                  request.receiver?.unique_username[0] ||
                                  "?"}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium">
                                  {request.receiver?.display_name ||
                                    request.receiver?.unique_username}
                                </h3>
                                <Badge
                                  variant={
                                    request.status === "accepted"
                                      ? "default"
                                      : request.status === "rejected"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-xs flex-shrink-0"
                                >
                                  {getStatusText(request.status)}
                                </Badge>
                                <span className="text-muted-foreground">·</span>
                                <p className="text-sm text-muted-foreground flex-shrink-0">
                                  {getTimeAgo(request.updated_at)}
                                </p>
                                {/* 显示拒绝理由或请求理由 */}
                                {request.status === "rejected" && request.reject_reason ? (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <p className="text-sm text-destructive/80 truncate max-w-[300px]">
                                      拒绝理由: {request.reject_reason}
                                    </p>
                                  </>
                                ) : request.message && request.status === "pending" ? (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                                      {request.message}
                                    </p>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {/* 操作按钮区 */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {request.status === "rejected" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClickResend(request.id, request.message);
                                  }}
                                >
                                  再次发起
                                </Button>
                              )}
                              <CollapsibleTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>

                          {/* 展开内容：对话历史 */}
                          <CollapsibleContent>
                            <div className="px-4 pb-4 border-t">
                              <div className="mt-4 space-y-3">
                                {/* 初始请求消息 */}
                                {request.message && messageHistory.length === 0 && (
                                  <div className="flex gap-3 justify-end">
                                    <div className="flex-1 flex flex-col items-end">
                                      <div className="bg-primary/10 rounded-lg p-3 max-w-[80%]">
                                        <p className="text-sm">{request.message}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {getTimeAgo(request.created_at)}
                                      </p>
                                    </div>
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                      <AvatarImage src={request.sender?.avatar_url || ""} />
                                      <AvatarFallback className="text-xs">
                                        {request.sender?.display_name?.[0] || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                )}

                                {/* 消息历史 */}
                                {messageHistory.map((msg, idx) => {
                                  const isSender = msg.user_id === request.sender_id;
                                  const user = isSender ? request.sender : request.receiver;
                                  
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex gap-3 ${isSender ? "justify-end" : ""}`}
                                    >
                                      {!isSender && (
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                          <AvatarImage src={user?.avatar_url || ""} />
                                          <AvatarFallback className="text-xs">
                                            {user?.display_name?.[0] || "?"}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <div className={`flex-1 flex flex-col ${isSender ? "items-end" : ""}`}>
                                        <div
                                          className={`rounded-lg p-3 max-w-[80%] ${
                                            msg.type === "reject"
                                              ? "bg-destructive/10"
                                              : isSender
                                              ? "bg-primary/10"
                                              : "bg-muted"
                                          }`}
                                        >
                                          <p className="text-sm">{msg.message}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {getTimeAgo(msg.timestamp)}
                                        </p>
                                      </div>
                                      {isSender && (
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                          <AvatarImage src={user?.avatar_url || ""} />
                                          <AvatarFallback className="text-xs">
                                            {user?.display_name?.[0] || "?"}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                    </div>
                                  );
                                })}
                                {/* 重新发送输入框（仅被拒绝状态显示） */}
                                {request.status === "rejected" && (
                                  <div className="mt-4 space-y-2">
                                    <Textarea
                                      placeholder="输入新的请求内容（可选）..."
                                      value={resendMessages[request.id] || ""}
                                      onChange={(e) =>
                                        setResendMessages((prev) => ({
                                          ...prev,
                                          [request.id]: e.target.value,
                                        }))
                                      }
                                      className="min-h-[80px]"
                                    />
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        onClick={() => handleResendRequest(request)}
                                      >
                                        确认发送
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
