import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ChevronRight, MessageSquare, Phone, Video, Check, X, MoreHorizontal, Star, UserPlus, Shield, Ban, Trash2, Users } from "lucide-react";
import { RecommendFriendSheet } from "./RecommendFriendSheet";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface UserProfile {
  id: string;
  display_name: string | null;
  unique_username: string;
  avatar_url: string | null;
  bio: string | null;
}

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  onSendMessage?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onViewMoments?: () => void;
  onRemarkUpdated?: () => void;
  onContactDeleted?: () => void;
  onBlacklistUpdated?: () => void;
}

export function UserProfileDialog({
  open,
  onOpenChange,
  profile,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onViewMoments,
  onRemarkUpdated,
  onContactDeleted,
  onBlacklistUpdated,
}: UserProfileDialogProps) {
  const { currentIdentity } = useIdentity();
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remark, setRemark] = useState("");
  const [tempRemark, setTempRemark] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [showRecommendSheet, setShowRecommendSheet] = useState(false);
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (open && profile && currentIdentity) {
      loadRemark();
    }
  }, [open, profile, currentIdentity]);

  const loadRemark = async () => {
    if (!profile || !currentIdentity) return;

    try {
      const { data } = await supabase
        .from("friendships")
        .select("nickname, is_starred")
        .eq("user_id", currentIdentity.profile.id)
        .eq("friend_id", profile.id)
        .maybeSingle();

      if (data) {
        setRemark(data.nickname || "");
        setIsStarred(data.is_starred || false);
      }
    } catch (error) {
      console.error("加载备注失败:", error);
    }
  };

  const handleSaveRemark = async () => {
    if (!profile || !currentIdentity) return;

    try {
      const { error } = await supabase
        .from("friendships")
        .update({ nickname: tempRemark.trim() || null })
        .eq("user_id", currentIdentity.profile.id)
        .eq("friend_id", profile.id);

      if (error) throw error;

      setRemark(tempRemark.trim());
      setIsEditingRemark(false);
      toast.success("备注修改成功");
      
      // 通知父组件刷新
      if (onRemarkUpdated) {
        onRemarkUpdated();
      }
    } catch (error) {
      console.error("保存备注失败:", error);
      toast.error("保存备注失败");
    }
  };

  const handleStartEdit = () => {
    setTempRemark(remark);
    setIsEditingRemark(true);
  };

  const handleCancelEdit = () => {
    setTempRemark("");
    setIsEditingRemark(false);
  };

  const handleToggleStarred = async () => {
    if (!profile || !currentIdentity) return;

    try {
      const { error } = await supabase
        .from("friendships")
        .update({ is_starred: !isStarred })
        .eq("user_id", currentIdentity.profile.id)
        .eq("friend_id", profile.id);

      if (error) throw error;

      setIsStarred(!isStarred);
      toast.success(isStarred ? "已取消星标" : "已设为星标朋友");
    } catch (error) {
      console.error("设置星标失败:", error);
      toast.error("设置星标失败");
    }
  };

  const handleDeleteFriend = async () => {
    if (!profile || !currentIdentity) return;

    try {
      // 删除双向好友关系
      const { error: error1 } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", currentIdentity.profile.id)
        .eq("friend_id", profile.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", profile.id)
        .eq("friend_id", currentIdentity.profile.id);

      if (error2) throw error2;

      toast.success("已删除联系人");
      onOpenChange(false);
      onContactDeleted?.();
    } catch (error) {
      console.error("删除联系人失败:", error);
      toast.error("删除联系人失败");
    }
  };

  if (!profile) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">用户资料</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 头像和基本信息 */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback>
                {profile.display_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-lg">
                  {remark || profile.display_name || profile.unique_username}
                </h3>
                
                {/* 更多按钮 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      更多
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleStartEdit}>
                      设置备注和标签
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info("设置朋友权限功能开发中")}>
                      <Shield className="mr-2 h-4 w-4" />
                      设置朋友权限
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowRecommendSheet(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      把他推荐给朋友
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleStarred}>
                      <Star className={`mr-2 h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                      {isStarred ? "取消星标朋友" : "设为星标朋友"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      if (!profile || !currentIdentity) return;
                      
                      setConfirmDialog({
                        open: true,
                        title: "加入黑名单",
                        description: "确定要将该用户加入黑名单吗？加入后对方将无法给你发送消息。",
                        variant: "destructive",
                        onConfirm: async () => {
                          try {
                            // 检查是否已在黑名单中
                            const { data: existing } = await supabase
                              .from("blacklist")
                              .select("id")
                              .eq("user_id", currentIdentity.profile.id)
                              .eq("blocked_user_id", profile.id)
                              .maybeSingle();

                            if (existing) {
                              toast.info("该用户已在黑名单中");
                              return;
                            }

                            // 添加到黑名单
                            const { error } = await supabase
                              .from("blacklist")
                              .insert({
                                user_id: currentIdentity.profile.id,
                                blocked_user_id: profile.id,
                              });

                            if (error) throw error;

                            toast.success("已加入黑名单");
                            onBlacklistUpdated?.();
                          } catch (error) {
                            console.error("加入黑名单失败:", error);
                            toast.error("加入黑名单失败");
                          }
                        },
                      });
                    }}>
                      <Ban className="mr-2 h-4 w-4" />
                      加入黑名单
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setConfirmDialog({
                          open: true,
                          title: "删除联系人",
                          description: "确定要删除该联系人吗？",
                          variant: "destructive",
                          onConfirm: handleDeleteFriend,
                        });
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除联系人
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-sm text-muted-foreground">
                用户名: {profile.unique_username}
              </p>
              <p className="text-sm text-muted-foreground">
                地区: 未设置
              </p>
            </div>
          </div>

          <Separator />

          {/* 备注 */}
          {isEditingRemark ? (
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="text-sm flex-shrink-0">备注</span>
              <Input
                value={tempRemark}
                onChange={(e) => setTempRemark(e.target.value)}
                placeholder="输入备注名"
                className="flex-1 h-8"
                autoFocus
                maxLength={50}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleSaveRemark}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={handleStartEdit}
              className="flex items-center justify-between w-full px-2 py-2 hover:bg-muted/50 rounded-md transition-colors"
            >
              <span className="text-sm">备注</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {remark || "添加备注名"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          )}

          <Separator />

          {/* 朋友圈 */}
          <button
            onClick={onViewMoments}
            className="flex items-center justify-between w-full px-2 py-2 hover:bg-muted/50 rounded-md transition-colors"
          >
            <span className="text-sm">朋友圈</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <Separator />

          {/* 共同群聊 */}
          <div className="space-y-2 px-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">共同群聊</span>
              <span className="text-sm text-muted-foreground">0个</span>
            </div>
          </div>

          <Separator />

          {/* 个性签名 */}
          <div className="space-y-1 px-2">
            <span className="text-sm text-muted-foreground">个性签名</span>
            <p className="text-sm">
              {profile.bio || "这个人很懒，什么都没留下"}
            </p>
          </div>

          <Separator />

          {/* 来源 */}
          <div className="space-y-1 px-2">
            <span className="text-sm text-muted-foreground">来源</span>
            <p className="text-sm">通过搜索添加</p>
          </div>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              variant="default"
              onClick={onSendMessage}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              发消息
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onVoiceCall}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onVideoCall}
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* 确认对话框 */}
    <ConfirmDialog
      open={confirmDialog.open}
      onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      title={confirmDialog.title}
      description={confirmDialog.description}
      onConfirm={confirmDialog.onConfirm}
      variant={confirmDialog.variant}
    />
    
    {/* 推荐给朋友 */}
    <RecommendFriendSheet
      open={showRecommendSheet}
      onOpenChange={setShowRecommendSheet}
      recommendedUserId={profile.id}
      recommendedUserName={remark || profile.display_name || profile.unique_username}
    />
    </>
  );
}
