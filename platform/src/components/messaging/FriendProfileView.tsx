import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface FriendProfileViewProps {
  friendId: string;
}

interface Profile {
  id: string;
  unique_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
}

export function FriendProfileView({ friendId }: FriendProfileViewProps) {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadProfile();
    checkFriendship();
  }, [friendId, currentIdentity]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, unique_username, display_name, avatar_url, bio, cover_url")
        .eq("id", friendId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("加载资料失败:", error);
      toast.error("加载资料失败");
    } finally {
      setIsLoading(false);
    }
  };

  const checkFriendship = async () => {
    if (!currentIdentity) return;

    try {
      const { data, error } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", currentIdentity.profile.id)
        .eq("friend_id", friendId)
        .single();

      if (data) {
        setIsFriend(true);
        setFriendshipId(data.id);
      }
    } catch (error) {
      // 不是好友关系，保持默认状态
    }
  };

  const startChat = async () => {
    if (!currentIdentity) return;

    try {
      const { data: conversationId, error } = await supabase.rpc(
        "create_private_conversation",
        { 
          friend_uuid: friendId,
          sender_uuid: currentIdentity.profile.id
        }
      );

      if (error) throw error;

      navigate(`/conversations/chat/${conversationId}`);
    } catch (error) {
      console.error("创建会话失败:", error);
      toast.error("创建会话失败");
    }
  };

  const deleteFriend = async () => {
    if (!currentIdentity || !friendshipId) return;

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
        .eq("friend_id", currentIdentity.profile.id);

      if (error1 || error2) throw error1 || error2;

      toast.success("已删除好友");
      setShowDeleteDialog(false);
      setIsFriend(false);
      setFriendshipId(null);
      
      // 返回到会话列表
      navigate("/conversations");
    } catch (error: any) {
      toast.error(error.message || "删除失败");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载失败
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* 封面图 - 较低层级 */}
      <div className="relative h-40 bg-muted overflow-hidden z-0">
        {profile.cover_url ? (
          <>
            <img
              src={profile.cover_url}
              alt="封面"
              className="w-full h-full object-cover"
            />
            {/* 渐变遮罩 - 创建柔和边缘 */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
      </div>

      {/* 头像 - 绝对定位，与封面图同级，确保在封面图上方 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-28 z-20">
        <Avatar className="h-24 w-24 border-4 border-background shadow-xl ring-2 ring-background/50 bg-background">
          <AvatarImage src={profile.avatar_url || ""} />
          <AvatarFallback className="text-2xl">
            {profile.display_name?.[0] || profile.unique_username[0] || "?"}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* 资料内容 - 增加顶部间距给头像留空间 */}
      <div className="flex-1 p-6 pt-16 space-y-6 overflow-y-auto">
        {/* 名称居中显示 */}
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-semibold text-center">
            {profile.display_name || profile.unique_username}
          </h2>

          {profile.display_name && (
            <p className="text-sm text-muted-foreground">
              @{profile.unique_username}
            </p>
          )}
        </div>

        {/* 个人简介 */}
        {profile.bio && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">个人简介</h3>
            <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="pt-4 space-y-3">
          <Button
            onClick={startChat}
            className="w-full"
            size="lg"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            发送消息
          </Button>

          {isFriend && (
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <UserMinus className="mr-2 h-4 w-4" />
              删除好友
            </Button>
          )}
        </div>
      </div>

      {/* 删除好友确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除好友？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将不再是好友关系，需要重新添加才能恢复好友关系。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFriend} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
