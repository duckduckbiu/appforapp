import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Search, UserPlus, Users, MessageSquare, MoreVertical, UserMinus, QrCode } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import QRCodeScanner from "@/components/QRCodeScanner";
import { useIdentity } from "@/contexts/IdentityContext";

interface Profile {
  id: string;
  unique_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_ai_avatar?: boolean;
  ai_avatar_id?: string;
  owner_id?: string;
  ai_avatar?: {
    id: string;
    name: string;
    display_name: string | null;
  };
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  reject_reason?: string | null;
  message_history?: Array<{
    type: 'request' | 'rejection' | 'resend';
    content: string;
    timestamp: string;
  }>;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  nickname: string | null;
  created_at: string;
  friend?: Profile;
}

export default function Friends() {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // 搜索相关
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 好友请求相关
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [requestMessage, setRequestMessage] = useState<{ [key: string]: string }>({});
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resendingRequestId, setResendingRequestId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState("");
  
  // 好友列表相关
  const [friends, setFriends] = useState<Friendship[]>([]);
  
  // 备注对话框
  const [nicknameDialog, setNicknameDialog] = useState<{ open: boolean; friendId: string; currentNickname: string }>({
    open: false,
    friendId: "",
    currentNickname: ""
  });
  const [newNickname, setNewNickname] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let requestsChannel: any = null;
    let friendshipsChannel: any = null;
    
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!isMounted) return;
      
      // 使用当前身份 ID
      const identityId = currentIdentity?.profile.id || user.id;
      setUserId(identityId);
      await Promise.all([
        loadFriendRequests(identityId),
        loadFriends(identityId)
      ]);
      if (!isMounted) return;
      
      setIsLoading(false);
      
      // 订阅实时更新 - 同时监听作为发送方和接收方的请求
      requestsChannel = supabase
        .channel('friend-requests-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests'
          },
          (payload: any) => {
            // 只在与当前用户相关的请求变化时重新加载
            const record = payload.new || payload.old;
            if (record && (record.sender_id === user.id || record.receiver_id === user.id)) {
              if (isMounted) loadFriendRequests(user.id);
            }
          }
        )
        .subscribe();

      friendshipsChannel = supabase
        .channel('friendships-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            if (isMounted) loadFriends(user.id);
          }
        )
        .subscribe();
    };
    
    checkAuth();
    
    return () => {
      isMounted = false;
      if (requestsChannel) {
        supabase.removeChannel(requestsChannel);
      }
      if (friendshipsChannel) {
        supabase.removeChannel(friendshipsChannel);
      }
    };
  }, [currentIdentity]);


  const loadFriendRequests = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // 手动加载发送者和接收者信息
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (req) => {
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, unique_username, display_name, avatar_url, bio")
            .eq("id", req.sender_id)
            .single();
          
          const { data: receiver } = await supabase
            .from("profiles")
            .select("id, unique_username, display_name, avatar_url, bio")
            .eq("id", req.receiver_id)
            .single();
          
          // 处理 message_history 类型转换
          const messageHistory = Array.isArray(req.message_history) 
            ? req.message_history as Array<{type: 'request' | 'rejection' | 'resend'; content: string; timestamp: string}>
            : [];
          
          return { 
            ...req, 
            sender, 
            receiver,
            message_history: messageHistory
          };
        })
      );
      
      // 分离收到的和发送的请求
      const received = requestsWithProfiles.filter(req => req.receiver_id === userId);
      const sent = requestsWithProfiles.filter(req => req.sender_id === userId);
      
      setFriendRequests(requestsWithProfiles as FriendRequest[]);
      setReceivedRequests(received as FriendRequest[]);
      setSentRequests(sent as FriendRequest[]);
      setPendingCount(received.filter(req => req.status === 'pending').length);
    } catch (error: any) {
      console.error("加载好友请求失败:", error);
    }
  };

  const loadFriends = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // 手动加载好友信息
      const friendshipsWithProfiles = await Promise.all(
        (data || []).map(async (friendship) => {
          const { data: friend } = await supabase
            .from("profiles")
            .select("id, unique_username, display_name, avatar_url, bio")
            .eq("id", friendship.friend_id)
            .single();
          
          return { ...friendship, friend };
        })
      );
      
      setFriends(friendshipsWithProfiles);
    } catch (error: any) {
      console.error("加载好友列表失败:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // 检查是否是邮箱格式
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery.trim());
      
      if (isEmail) {
        // 通过邮箱精确搜索
        const { data, error } = await supabase
          .rpc('search_user_by_email', { search_email: searchQuery.trim() });

        if (error) throw error;
        setSearchResults(data || []);
      } else {
        // 通过用户名或显示名称模糊搜索（使用优化的数据库函数）
        const { data, error } = await supabase
          .rpc('search_users_by_name', { 
            search_query: searchQuery.trim(),
            current_user_id: userId,
            result_limit: 10
          });

        if (error) throw error;
        setSearchResults(data || []);
      }
    } catch (error: any) {
      toast.error("搜索失败");
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!userId) return;

    const message = requestMessage[receiverId] || "";

    try {
      // 先检查是否存在已拒绝或待处理的请求
      const { data: existingRequest } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", userId)
        .eq("receiver_id", receiverId)
        .single();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          toast.error("已经发送过好友请求，请等待对方处理");
          return;
        } else if (existingRequest.status === 'rejected') {
          // 如果被拒绝，先删除旧请求，再创建新请求
          await supabase
            .from("friend_requests")
            .delete()
            .eq("id", existingRequest.id);
        } else if (existingRequest.status === 'accepted') {
          toast.error("你们已经是好友了");
          return;
        }
      }

      // 创建新的好友请求
      const { error } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          status: 'pending',
          message: message || null
        });

      if (error) throw error;

      toast.success("好友请求已发送");
      setRequestMessage((prev) => {
        const newState = { ...prev };
        delete newState[receiverId];
        return newState;
      });
      setSearchResults([]);
      setSearchQuery("");
      await loadFriendRequests(userId);
    } catch (error: any) {
      toast.error(error.message || "发送失败");
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject', senderId: string) => {
    if (!userId) return;

    try {
      if (action === 'accept') {
        // 使用数据库函数处理双向好友关系
        const { error } = await supabase.rpc('accept_friend_request', {
          request_id: requestId
        });

        if (error) throw error;
        toast.success("已添加为好友");
        await loadFriendRequests(userId);
        await loadFriends(userId);
      } else {
        // 显示拒绝输入框
        setRejectingRequestId(requestId);
      }
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const confirmReject = async (requestId: string) => {
    if (!userId) return;

    try {
      // 获取当前请求以获取消息历史
      const { data: currentRequest } = await supabase
        .from("friend_requests")
        .select("message_history")
        .eq("id", requestId)
        .single();

      const messageHistory = currentRequest?.message_history || [];
      
      // 确保 messageHistory 是数组类型
      const historyArray = Array.isArray(messageHistory) ? messageHistory : [];
      
      // 添加拒绝消息到历史
      const newHistory = [
        ...historyArray,
        {
          type: 'rejection' as const,
          content: rejectReason || "对方拒绝了你的好友请求",
          timestamp: new Date().toISOString()
        }
      ];

      // 拒绝请求并保存拒绝理由和消息历史
      const { error } = await supabase
        .from("friend_requests")
        .update({ 
          status: 'rejected',
          reject_reason: rejectReason || null,
          message_history: newHistory
        })
        .eq("id", requestId);

      if (error) throw error;
      toast.success("已拒绝请求");
      
      setRejectingRequestId(null);
      setRejectReason("");
      await loadFriendRequests(userId);
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const cancelReject = () => {
    setRejectingRequestId(null);
    setRejectReason("");
  };

  const cancelFriendRequest = async (requestId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已撤销好友请求");
      await loadFriendRequests(userId);
    } catch (error: any) {
      toast.error(error.message || "撤销失败");
    }
  };

  const deleteFriend = async (friendshipId: string, friendId: string) => {
    if (!userId) return;

    try {
      // 删除双向好友关系
      const { error: error1 } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      const { error: error2 } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", friendId)
        .eq("friend_id", userId);

      if (error1 || error2) throw error1 || error2;

      toast.success("已删除好友");
      await loadFriends(userId);
    } catch (error: any) {
      toast.error(error.message || "删除失败");
    }
  };

  const updateNickname = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("friendships")
        .update({ nickname: newNickname || null })
        .eq("id", nicknameDialog.friendId);

      if (error) throw error;

      toast.success("备注已更新");
      setNicknameDialog({ open: false, friendId: "", currentNickname: "" });
      setNewNickname("");
      await loadFriends(userId);
    } catch (error: any) {
      toast.error(error.message || "更新失败");
    }
  };

  const startChat = (friendId: string) => {
    navigate(`/conversations/user/${friendId}`);
  };

  const resendFriendRequest = async (requestId: string, receiverId: string) => {
    if (!userId) return;

    try {
      // 获取当前请求以获取消息历史
      const { data: currentRequest } = await supabase
        .from("friend_requests")
        .select("message_history")
        .eq("id", requestId)
        .single();

      const messageHistory = currentRequest?.message_history || [];
      
      // 确保 messageHistory 是数组类型
      const historyArray = Array.isArray(messageHistory) ? messageHistory : [];
      
      // 添加新消息到历史
      const newHistory = [
        ...historyArray,
        {
          type: 'resend' as const,
          content: resendMessage || "再次发送好友请求",
          timestamp: new Date().toISOString()
        }
      ];

      // 使用 DELETE + INSERT 模式绕过 RLS 限制
      // 发送者无法 UPDATE 请求，但可以 DELETE 后重新 INSERT
      const { error: deleteError } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (deleteError) throw deleteError;

      // 插入新的待处理请求，包含完整的消息历史
      const { error: insertError } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          status: 'pending',
          message_history: newHistory,
          message: resendMessage || "再次发送好友请求"
        });

      if (insertError) throw insertError;

      toast.success("好友请求已重新发送");
      setResendingRequestId(null);
      setResendMessage("");
      await loadFriendRequests(userId);
    } catch (error: any) {
      toast.error(error.message || "发送失败");
    }
  };

  const handleQRCodeUser = async (scannedUserId: string) => {
    if (!userId) return;

    try {
      // 查询用户信息
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", scannedUserId)
        .single();

      if (error) throw error;

      if (!profile) {
        toast.error("用户不存在");
        return;
      }

      // 检查是否是自己
      if (profile.id === userId) {
        toast.error("不能添加自己为好友");
        return;
      }

      // 将用户添加到搜索结果
      setSearchResults([profile]);
      setSearchQuery(profile.unique_username);
      toast.success("已找到用户，请发送好友请求");
    } catch (error: any) {
      toast.error("查找用户失败");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回首页
      </Button>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            <Users className="mr-2 h-4 w-4" />
            好友列表
          </TabsTrigger>
          <TabsTrigger value="requests">
            <UserPlus className="mr-2 h-4 w-4" />
            好友请求
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            搜索好友
          </TabsTrigger>
        </TabsList>

        {/* 好友列表 */}
        <TabsContent value="friends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>我的好友</CardTitle>
              <CardDescription>共 {friends.length} 位好友</CardDescription>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  还没有好友，去搜索添加吧！
                </p>
              ) : (
                <div className="space-y-4">
                  {friends.map((friendship) => (
                    <div
                      key={friendship.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={friendship.friend?.avatar_url || ""} />
                          <AvatarFallback>
                            {friendship.friend?.display_name?.[0] || friendship.friend?.unique_username[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {friendship.nickname || friendship.friend?.display_name || friendship.friend?.unique_username}
                          </p>
                          {friendship.nickname && (
                            <p className="text-sm text-muted-foreground">
                              @{friendship.friend?.unique_username}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => startChat(friendship.friend_id)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => {
                                setNicknameDialog({
                                  open: true,
                                  friendId: friendship.id,
                                  currentNickname: friendship.nickname || ""
                                });
                                setNewNickname(friendship.nickname || "");
                              }}
                            >
                              设置备注
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteFriend(friendship.id, friendship.friend_id)}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              删除好友
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 好友请求 */}
        <TabsContent value="requests" className="space-y-4">
          <Tabs defaultValue="received">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="received">
                收到的请求
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent">
                已发送
                {sentRequests.filter(r => r.status === 'pending').length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {sentRequests.filter(r => r.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* 收到的请求 */}
            <TabsContent value="received">
              <Card>
                <CardHeader>
                  <CardTitle>收到的好友请求</CardTitle>
                </CardHeader>
                <CardContent>
                  {receivedRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">暂无好友请求</p>
                  ) : (
                    <div className="space-y-4">
                      {receivedRequests.map((request) => (
                        <Card key={request.id}>
                          <CardContent className="pt-6">
                            <div className="space-y-4">
                              {/* 用户信息头部 */}
                              <div className="flex items-center justify-between pb-3 border-b">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarImage src={request.sender?.avatar_url || ""} />
                                    <AvatarFallback>
                                      {request.sender?.display_name?.[0] || request.sender?.unique_username[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">
                                      {request.sender?.display_name || request.sender?.unique_username}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      @{request.sender?.unique_username}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={
                                  request.status === 'pending' ? 'default' :
                                  request.status === 'accepted' ? 'secondary' : 'destructive'
                                }>
                                  {request.status === 'pending' ? '待处理' :
                                   request.status === 'accepted' ? '已接受' : '已拒绝'}
                                </Badge>
                              </div>

                              {/* 聊天式对话 - 显示完整消息历史 */}
                              <div className="space-y-3">
                                {/* 兼容旧数据：如果有 message 但 message_history 为空，显示原始消息 */}
                                {(!request.message_history || request.message_history.length === 0) && request.message && (
                                  <div className="flex justify-start">
                                    <div className="max-w-[70%] bg-muted rounded-lg px-4 py-2">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {request.sender?.display_name || request.sender?.unique_username}:
                                      </p>
                                      <p className="text-sm">{request.message}</p>
                                    </div>
                                  </div>
                                )}

                                {/* 显示消息历史 */}
                                {request.message_history && request.message_history.map((msg, index) => (
                                  <div key={index} className={`flex ${msg.type === 'rejection' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                      msg.type === 'rejection' 
                                        ? 'bg-primary text-primary-foreground' 
                                        : 'bg-muted'
                                    }`}>
                                      <p className={`text-xs mb-1 ${
                                        msg.type === 'rejection' 
                                          ? 'opacity-70' 
                                          : 'text-muted-foreground'
                                      }`}>
                                        {msg.type === 'rejection' 
                                          ? '我:' 
                                          : (request.sender?.display_name || request.sender?.unique_username) + ':'}
                                      </p>
                                      <p className="text-sm">{msg.content}</p>
                                    </div>
                                  </div>
                                ))}

                                {/* 兼容旧数据：如果有 reject_reason 但没有在 message_history 中，显示拒绝理由 */}
                                {request.status === 'rejected' && request.reject_reason && 
                                 (!request.message_history || !request.message_history.some(m => m.type === 'rejection')) && (
                                  <div className="flex justify-end">
                                    <div className="max-w-[70%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                                      <p className="text-xs opacity-70 mb-1">我:</p>
                                      <p className="text-sm">{request.reject_reason}</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 操作按钮 */}
                              {request.status === 'pending' && rejectingRequestId !== request.id && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleFriendRequest(request.id, 'accept', request.sender_id)}
                                    className="flex-1"
                                  >
                                    接受
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleFriendRequest(request.id, 'reject', request.sender_id)}
                                    className="flex-1"
                                  >
                                    拒绝
                                  </Button>
                                </div>
                              )}
                              
                              {/* 拒绝输入框 */}
                              {rejectingRequestId === request.id && (
                                <div className="space-y-2 pt-2 border-t">
                                  <Textarea
                                    placeholder="说明拒绝的理由（可选）..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="min-h-[80px] resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelReject}
                                      className="flex-1"
                                    >
                                      取消
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => confirmReject(request.id)}
                                      className="flex-1"
                                    >
                                      确认拒绝
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 已发送的请求 */}
            <TabsContent value="sent">
              <Card>
                <CardHeader>
                  <CardTitle>已发送的好友请求</CardTitle>
                  <CardDescription>这些是你发送给其他用户的好友请求</CardDescription>
                </CardHeader>
                <CardContent>
                  {sentRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">暂无已发送的请求</p>
                  ) : (
                    <div className="space-y-4">
                      {sentRequests.map((request) => (
                        <Card key={request.id}>
                          <CardContent className="pt-6">
                            <div className="space-y-4">
                              {/* 用户信息头部 */}
                              <div className="flex items-center justify-between pb-3 border-b">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarImage src={request.receiver?.avatar_url || ""} />
                                    <AvatarFallback>
                                      {request.receiver?.display_name?.[0] || request.receiver?.unique_username[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">
                                      {request.receiver?.display_name || request.receiver?.unique_username}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      @{request.receiver?.unique_username}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={
                                  request.status === 'pending' ? 'secondary' :
                                  request.status === 'accepted' ? 'default' : 'destructive'
                                }>
                                  {request.status === 'pending' ? '待对方接受' :
                                   request.status === 'accepted' ? '已接受' : '已拒绝'}
                                </Badge>
                              </div>

                              {/* 聊天式对话 - 显示完整消息历史 */}
                              <div className="space-y-3">
                                {/* 兼容旧数据：如果有 message 但 message_history 为空，显示原始消息 */}
                                {(!request.message_history || request.message_history.length === 0) && request.message && (
                                  <div className="flex justify-end">
                                    <div className="max-w-[70%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                                      <p className="text-xs opacity-70 mb-1">我:</p>
                                      <p className="text-sm">{request.message}</p>
                                    </div>
                                  </div>
                                )}

                                {/* 显示消息历史 */}
                                {request.message_history && request.message_history.map((msg, index) => (
                                  <div key={index} className={`flex ${msg.type === 'rejection' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                      msg.type === 'rejection' 
                                        ? 'bg-muted' 
                                        : 'bg-primary text-primary-foreground'
                                    }`}>
                                      <p className={`text-xs mb-1 ${
                                        msg.type === 'rejection' 
                                          ? 'text-muted-foreground' 
                                          : 'opacity-70'
                                      }`}>
                                        {msg.type === 'rejection' 
                                          ? (request.receiver?.display_name || request.receiver?.unique_username) + ':' 
                                          : '我:'}
                                      </p>
                                      <p className="text-sm">{msg.content}</p>
                                    </div>
                                  </div>
                                ))}

                                {/* 兼容旧数据：如果有 reject_reason 但没有在 message_history 中，显示拒绝理由 */}
                                {request.status === 'rejected' && request.reject_reason && 
                                 (!request.message_history || !request.message_history.some(m => m.type === 'rejection')) && (
                                  <div className="flex justify-start">
                                    <div className="max-w-[70%] bg-muted rounded-lg px-4 py-2">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {request.receiver?.display_name || request.receiver?.unique_username}:
                                      </p>
                                      <p className="text-sm">{request.reject_reason}</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 操作按钮 */}
                              {request.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelFriendRequest(request.id)}
                                  className="w-full"
                                >
                                  撤销请求
                                </Button>
                              )}

                              {/* 再次发送请求 */}
                              {request.status === 'rejected' && (
                                <div className="space-y-2 pt-2 border-t">
                                  {resendingRequestId === request.id ? (
                                    <>
                                      <Textarea
                                        placeholder="再发送一条消息..."
                                        value={resendMessage}
                                        onChange={(e) => setResendMessage(e.target.value)}
                                        className="min-h-[80px] resize-none"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setResendingRequestId(null);
                                            setResendMessage("");
                                          }}
                                          className="flex-1"
                                        >
                                          取消
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => resendFriendRequest(request.id, request.receiver_id)}
                                          className="flex-1"
                                        >
                                          发送
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setResendingRequestId(request.id)}
                                      className="w-full"
                                    >
                                      再次发送请求
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* 搜索好友 */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>搜索用户</CardTitle>
              <CardDescription>通过邮箱、用户名或昵称搜索</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入邮箱、用户名或昵称"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowQRScanner(true)}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground text-center">
                  或扫描二维码添加好友
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  {searchResults.map((profile) => (
                    <Card key={profile.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={profile.avatar_url || ""} />
                              <AvatarFallback>
                                {profile.display_name?.[0] || profile.unique_username[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {profile.display_name || profile.unique_username}
                                </p>
                                {profile.is_ai_avatar && (
                                  <Badge variant="secondary" className="text-xs">
                                    AI 分身
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                @{profile.unique_username}
                              </p>
                              {profile.bio && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {profile.bio}
                                </p>
                              )}
                            </div>
                          </div>
                          <Textarea
                            placeholder="介绍一下你自己..."
                            value={requestMessage[profile.id] || ""}
                            onChange={(e) => setRequestMessage((prev) => ({
                              ...prev,
                              [profile.id]: e.target.value
                            }))}
                            className="min-h-[80px] resize-none"
                          />
                          <Button
                            onClick={() => sendFriendRequest(profile.id)}
                            className="w-full"
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            发送好友请求
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 备注对话框 */}
      <Dialog open={nicknameDialog.open} onOpenChange={(open) => setNicknameDialog({ ...nicknameDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置备注</DialogTitle>
            <DialogDescription>给好友设置一个备注名称</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>备注名称</Label>
              <Input
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="输入备注名称"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNicknameDialog({ open: false, friendId: "", currentNickname: "" })}>
              取消
            </Button>
            <Button onClick={updateNickname}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二维码扫描器 */}
      <QRCodeScanner 
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onUserFound={handleQRCodeUser}
      />
    </div>
  );
}
