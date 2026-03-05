import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Friend {
  id: string;
  unique_username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function GroupChatCreate() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: friendships, error } = await supabase
        .from("friendships")
        .select(`
          friend_id,
          profiles:friend_id (
            id,
            unique_username,
            display_name,
            avatar_url
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const friendsList = friendships
        ?.map((f: any) => f.profiles)
        .filter(Boolean) || [];

      setFriends(friendsList);
    } catch (error: any) {
      console.error("加载好友失败:", error);
      toast.error("加载好友失败");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      toast.error("请输入群聊名称");
      return;
    }

    if (selectedFriends.size === 0) {
      toast.error("请至少选择一个好友");
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // 创建会话
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({ type: "group" })
        .select()
        .single();

      if (convError) throw convError;

      // 创建群聊
      const { data: groupChat, error: groupError } = await supabase
        .from("group_chats")
        .insert({
          conversation_id: conversation.id,
          creator_id: user.id,
          name: groupName.trim(),
          description: groupDescription.trim() || null
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 添加创建者为管理员
      const { error: adminError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupChat.id,
          user_id: user.id,
          role: "admin"
        });

      if (adminError) throw adminError;

      // 添加创建者到会话参与者
      const { error: participantError } = await supabase
        .from("conversation_participants")
        .insert({
          conversation_id: conversation.id,
          user_id: user.id
        });

      if (participantError) throw participantError;

      // 添加选中的好友为成员
      const memberInserts = Array.from(selectedFriends).map(friendId => ({
        group_id: groupChat.id,
        user_id: friendId,
        role: "member"
      }));

      const { error: membersError } = await supabase
        .from("group_members")
        .insert(memberInserts);

      if (membersError) throw membersError;

      // 添加好友到会话参与者
      const participantInserts = Array.from(selectedFriends).map(friendId => ({
        conversation_id: conversation.id,
        user_id: friendId
      }));

      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .insert(participantInserts);

      if (participantsError) throw participantsError;

      toast.success("群聊创建成功");
      navigate(`/group-chat/${groupChat.id}`);
    } catch (error: any) {
      console.error("创建群聊失败:", error);
      toast.error(error.message || "创建群聊失败");
    } finally {
      setIsCreating(false);
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
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background p-4">
        <div className="container max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/conversations")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <h1 className="text-xl font-semibold">创建群聊</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        {/* 群聊信息 */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">群聊名称 *</Label>
            <Input
              id="groupName"
              placeholder="请输入群聊名称"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="groupDescription">群聊简介</Label>
            <Input
              id="groupDescription"
              placeholder="请输入群聊简介（可选）"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              maxLength={200}
            />
          </div>
        </Card>

        {/* 选择成员 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            选择成员 ({selectedFriends.size} 人)
          </h2>
          
          {friends.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              暂无好友，请先添加好友
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleFriend(friend.id)}
                >
                  <Checkbox
                    checked={selectedFriends.has(friend.id)}
                    onCheckedChange={() => toggleFriend(friend.id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.avatar_url || ""} />
                    <AvatarFallback>
                      {friend.display_name?.[0] || friend.unique_username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {friend.display_name || friend.unique_username}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @{friend.unique_username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 创建按钮 */}
        <Button
          onClick={createGroupChat}
          disabled={isCreating || !groupName.trim() || selectedFriends.size === 0}
          className="w-full"
          size="lg"
        >
          {isCreating ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              创建中...
            </>
          ) : (
            "创建群聊"
          )}
        </Button>
      </div>
    </div>
  );
}
