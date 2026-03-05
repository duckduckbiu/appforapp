import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import {
  ContentDialog,
  ContentDialogHeader,
  ContentDialogTitle,
  ContentDialogBody,
} from "@/components/ui/content-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Profile {
  id: string;
  unique_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_ai_avatar?: boolean;
  ai_avatar_id?: string;
}

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const { currentIdentity } = useIdentity();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestMessage, setRequestMessage] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setRequestMessage({});
    }
  }, [open]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentIdentity) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery.trim());
      
      if (isEmail) {
        const { data, error } = await supabase
          .rpc('search_user_by_email', { search_email: searchQuery.trim() });

        if (error) throw error;
        setSearchResults(data || []);
      } else {
        const { data, error } = await supabase
          .rpc('search_users_by_name', { 
            search_query: searchQuery.trim(),
            current_user_id: currentIdentity.profile.id,
            result_limit: 10
          });

        if (error) throw error;
        setSearchResults(data || []);
      }
    } catch (error: any) {
      toast.error("搜索失败");
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentIdentity) return;

    const message = requestMessage[receiverId] || "";

    try {
      // 首先检查是否已经是好友
      const { data: existingFriendship, error: friendshipError } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", currentIdentity.profile.id)
        .eq("friend_id", receiverId)
        .maybeSingle();

      // 只在有实际错误时抛出（不包括"没找到记录"的情况）
      if (friendshipError && friendshipError.code !== 'PGRST116') {
        throw friendshipError;
      }

      if (existingFriendship) {
        toast.error("你们已经是好友了");
        return;
      }

      // 检查好友请求记录
      const { data: existingRequest, error: requestError } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", currentIdentity.profile.id)
        .eq("receiver_id", receiverId)
        .maybeSingle();

      // 只在有实际错误时抛出
      if (requestError && requestError.code !== 'PGRST116') {
        throw requestError;
      }

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          toast.error("已经发送过好友请求，请等待对方处理");
          return;
        } else if (existingRequest.status === 'rejected') {
          // 被拒绝的请求，删除后可以重新发送
          const { error: deleteError } = await supabase
            .from("friend_requests")
            .delete()
            .eq("id", existingRequest.id);
          
          if (deleteError) throw deleteError;
        } else if (existingRequest.status === 'accepted') {
          // accepted 状态但 friendships 中没有记录，说明好友已被删除
          // 删除旧的请求记录，允许重新发送
          const { error: deleteError } = await supabase
            .from("friend_requests")
            .delete()
            .eq("id", existingRequest.id);
          
          if (deleteError) throw deleteError;
        }
      }

      const { error } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: currentIdentity.profile.id,
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
    } catch (error: any) {
      toast.error(error.message || "发送失败");
      console.error(error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <ContentDialog open={open} onOpenChange={onOpenChange}>
      <ContentDialogHeader onClose={() => onOpenChange(false)}>
        <ContentDialogTitle>添加好友</ContentDialogTitle>
      </ContentDialogHeader>

      <ContentDialogBody>
        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名、昵称或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? <LoadingSpinner size="sm" /> : "搜索"}
            </Button>
          </div>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 space-y-4">
                {searchResults.map((user) => (
                  <div key={user.id} className="flex gap-3 p-3 rounded-lg border bg-card">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || ""} />
                      <AvatarFallback>
                        {user.display_name?.[0] || user.unique_username[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {user.display_name || user.unique_username}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{user.unique_username}
                      </div>
                      {user.bio && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {user.bio}
                        </div>
                      )}
                      <Textarea
                        placeholder="验证消息（可选）"
                        value={requestMessage[user.id] || ""}
                        onChange={(e) =>
                          setRequestMessage((prev) => ({
                            ...prev,
                            [user.id]: e.target.value,
                          }))
                        }
                        className="mt-2"
                        rows={2}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => sendFriendRequest(user.id)}
                      className="self-start"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      添加
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* 无结果提示 */}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              未找到匹配的用户
            </div>
          )}
        </div>
      </ContentDialogBody>
    </ContentDialog>
  );
}
