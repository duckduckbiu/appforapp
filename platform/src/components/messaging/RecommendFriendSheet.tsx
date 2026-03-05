import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Friend {
  id: string;
  friend_id: string;
  nickname: string | null;
  friend: {
    id: string;
    unique_username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface RecommendFriendSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendedUserId: string;
  recommendedUserName: string;
}

export function RecommendFriendSheet({
  open,
  onOpenChange,
  recommendedUserId,
  recommendedUserName,
}: RecommendFriendSheetProps) {
  const { currentIdentity } = useIdentity();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open && currentIdentity) {
      loadFriends();
    }
  }, [open, currentIdentity]);

  const loadFriends = async () => {
    if (!currentIdentity) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("friendships")
        .select(`
          id,
          friend_id,
          nickname,
          friend:profiles!friendships_friend_id_fkey(
            id,
            unique_username,
            display_name,
            avatar_url
          )
        `)
        .eq("user_id", currentIdentity.profile.id)
        .neq("friend_id", recommendedUserId); // 排除要推荐的用户本身

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error("加载好友列表失败:", error);
      toast.error("加载好友列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    const newSelected = new Set(selectedFriendIds);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriendIds(newSelected);
  };

  const handleRecommend = async () => {
    if (selectedFriendIds.size === 0) {
      toast.error("请选择要推荐的朋友");
      return;
    }

    setIsSending(true);
    try {
      // 为每个选中的好友创建或获取会话，并发送推荐消息
      for (const friendId of selectedFriendIds) {
        // 创建或获取私聊会话
        const { data: conversationId, error: convError } = await supabase
          .rpc("create_private_conversation", { 
            friend_uuid: friendId,
            sender_uuid: currentIdentity!.profile.id
          });

        if (convError) throw convError;

        // 发送推荐消息（使用特殊的消息类型）
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: currentIdentity!.profile.id,
            message_type: "recommendation",
            content: `推荐了一个朋友给你`,
            metadata: {
              recommended_user_id: recommendedUserId,
              recommended_user_name: recommendedUserName,
            },
          });

        if (msgError) throw msgError;
      }

      toast.success(`已推荐给 ${selectedFriendIds.size} 位朋友`);
      setSelectedFriendIds(new Set());
      onOpenChange(false);
    } catch (error) {
      console.error("推荐失败:", error);
      toast.error("推荐失败");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>推荐给朋友</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="default" />
          </div>
        ) : friends.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            暂无好友
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2 pr-4">
                {friends.map((friend) => (
                  <div
                    key={friend.friend_id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                    onClick={() => toggleFriend(friend.friend_id)}
                  >
                    <Checkbox
                      checked={selectedFriendIds.has(friend.friend_id)}
                      onCheckedChange={() => toggleFriend(friend.friend_id)}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.friend.avatar_url || ""} />
                      <AvatarFallback>
                        {(friend.nickname || friend.friend.display_name || friend.friend.unique_username)[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {friend.nickname || friend.friend.display_name || friend.friend.unique_username}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleRecommend}
                disabled={selectedFriendIds.size === 0 || isSending}
              >
                {isSending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    推荐中...
                  </>
                ) : (
                  `推荐 (${selectedFriendIds.size})`
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
