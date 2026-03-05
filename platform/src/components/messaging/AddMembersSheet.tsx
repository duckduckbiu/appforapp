import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";

interface Friend {
  id: string;
  display_name: string | null;
  unique_username: string;
  avatar_url: string | null;
}

interface AddMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationType: string;
  onSuccess?: () => void;
  onBack?: () => void; // 返回上一页的回调
}

export function AddMembersSheet({
  open,
  onOpenChange,
  conversationId,
  conversationType,
  onSuccess,
  onBack,
}: AddMembersSheetProps) {
  const { currentIdentity } = useIdentity();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open && currentIdentity) {
      loadFriends();
    }
  }, [open, currentIdentity]);

  const loadFriends = async () => {
    if (!currentIdentity) return;

    setIsLoading(true);
    try {
      const userId = currentIdentity.profile.id;

      // 获取好友列表
      const { data: friendships } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", userId);

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        return;
      }

      const friendIds = friendships.map((f) => f.friend_id);

      // 获取已在会话中的成员
      const { data: existingMembers } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);

      const existingMemberIds = new Set(
        existingMembers?.map((m) => m.user_id) || []
      );

      // 获取好友资料，排除已在会话中的
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, unique_username, avatar_url")
        .in("id", friendIds);

      if (profiles) {
        // 过滤掉已在会话中的好友
        const availableFriends = profiles.filter(
          (p) => !existingMemberIds.has(p.id)
        );
        setFriends(availableFriends);
      }
    } catch (error) {
      console.error("加载好友列表失败:", error);
      toast.error("加载好友列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFriend = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleAddMembers = async () => {
    if (selectedFriends.size === 0) {
      toast.error("请选择要添加的成员");
      return;
    }

    setIsAdding(true);
    try {
      // 如果是私聊，需要先转换为群聊
      if (conversationType === "private") {
        // TODO: 实现私聊转群聊逻辑
        toast.info("私聊转群聊功能开发中");
        return;
      }

      // 添加成员到群聊
      const membersToAdd = Array.from(selectedFriends).map((friendId) => ({
        conversation_id: conversationId,
        user_id: friendId,
      }));

      const { error } = await supabase
        .from("conversation_participants")
        .insert(membersToAdd);

      if (error) throw error;

      toast.success(`成功添加 ${selectedFriends.size} 位成员`);
      setSelectedFriends(new Set());
      onSuccess?.();
      // 关闭当前Sheet，触发返回到上一页
      if (onBack) {
        onBack();
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("添加成员失败:", error);
      toast.error("添加成员失败");
    } finally {
      setIsAdding(false);
    }
  };

  const filteredFriends = friends.filter(
    (friend) =>
      friend.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.unique_username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClose = () => {
    if (onBack) {
      // 如果有返回回调，执行返回逻辑
      onBack();
    } else {
      // 否则正常关闭
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3">
          <SheetTitle>选择联系人</SheetTitle>
        </SheetHeader>

        {/* 搜索框 */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索好友"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 已选择计数 */}
        {selectedFriends.size > 0 && (
          <div className="px-4 py-2 bg-muted/50 text-sm">
            已选择 {selectedFriends.size} 位联系人
          </div>
        )}

        {/* 好友列表 */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="default" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              {friends.length === 0 ? "暂无可添加的好友" : "未找到匹配的好友"}
            </div>
          ) : (
            <div className="p-2">
              {filteredFriends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleToggleFriend(friend.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedFriends.has(friend.id)}
                    onCheckedChange={() => handleToggleFriend(friend.id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.avatar_url || ""} />
                    <AvatarFallback>
                      {friend.display_name?.[0]?.toUpperCase() ||
                        friend.unique_username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">
                      {friend.display_name || friend.unique_username}
                    </p>
                    {friend.display_name && (
                      <p className="text-sm text-muted-foreground">
                        @{friend.unique_username}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* 底部按钮 */}
        <div className="p-4 border-t">
          <Button
            className="w-full"
            onClick={handleAddMembers}
            disabled={selectedFriends.size === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                添加中...
              </>
            ) : (
              `确定(${selectedFriends.size})`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
