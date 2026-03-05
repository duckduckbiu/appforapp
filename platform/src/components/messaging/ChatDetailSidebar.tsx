import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plus, Search, Star, UserPlus, Shield, Ban, Trash2, Edit, Image, Eraser, EyeOff, X, List } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ChatDetailSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationInfo: {
    name: string;
    avatarUrl: string | null;
    type: string;
  } | null;
  isMuted: boolean;
  isPinned: boolean;
  isStarred?: boolean;
  onMuteChange?: (muted: boolean) => void;
  onPinChange?: (pinned: boolean) => void;
  onStarChange?: (starred: boolean) => void;
  onSearchMessages?: () => void;
  onAddMembers?: () => void;
  onHideConversation?: () => void;
  onDeleteConversationForMe?: () => void;
  onDeleteConversationForAll?: () => void;
  onChangeBackground?: () => void;
  onResetBackground?: () => void;
  hasCustomBackground?: boolean;
  // 好友管理功能
  onEditRemark?: () => void;
  onSetPermissions?: () => void;
  onRecommendFriend?: () => void;
  onAddToBlacklist?: () => void;
  onDeleteContact?: () => void;
  onManageBlacklist?: () => void;
}

export function ChatDetailSidebar({
  open,
  onOpenChange,
  conversationInfo,
  isMuted,
  isPinned,
  isStarred,
  onMuteChange,
  onPinChange,
  onStarChange,
  onSearchMessages,
  onAddMembers,
  onHideConversation,
  onDeleteConversationForMe,
  onDeleteConversationForAll,
  onChangeBackground,
  onResetBackground,
  hasCustomBackground,
  onEditRemark,
  onSetPermissions,
  onRecommendFriend,
  onAddToBlacklist,
  onDeleteContact,
  onManageBlacklist,
}: ChatDetailSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle>聊天详情</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* 聊天成员 */}
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={conversationInfo?.avatarUrl || ""} />
                <AvatarFallback>
                  {conversationInfo?.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              
              {conversationInfo?.type === "group" && (
                <>
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>U1</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>U2</AvatarFallback>
                  </Avatar>
                </>
              )}
              
              {/* 添加成员按钮 - 私聊和群聊都显示 */}
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={onAddMembers}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* 查找聊天内容 */}
          <button
            onClick={onSearchMessages}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <span>查找聊天内容</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <Separator />

          {/* 设置选项 */}
          <div className="px-4 py-3 space-y-4">
            {conversationInfo?.type === "private" && (
              <div className="flex items-center justify-between">
                <span>设为星标朋友</span>
                <Switch
                  checked={isStarred}
                  onCheckedChange={onStarChange}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>消息免打扰</span>
              <Switch
                checked={isMuted}
                onCheckedChange={onMuteChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>置顶聊天</span>
              <Switch
                checked={isPinned}
                onCheckedChange={onPinChange}
              />
            </div>
          </div>

          <Separator />

          {/* 好友管理功能 - 仅私聊显示 */}
          {conversationInfo?.type === "private" && (
            <>
              <div className="px-4 py-3 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-muted/50"
                  onClick={onEditRemark}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  设置备注和标签
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-muted/50"
                  onClick={onSetPermissions}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  设置朋友权限
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-muted/50"
                  onClick={onRecommendFriend}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  把他推荐给朋友
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-muted/50"
                  onClick={onAddToBlacklist}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  加入黑名单
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-muted/50"
                  onClick={onManageBlacklist}
                >
                  <List className="mr-2 h-4 w-4" />
                  黑名单管理
                </Button>
              </div>

              <Separator />
            </>
          )}

          {/* 操作按钮 */}
          <div className="px-4 py-3 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-muted/50"
              onClick={onChangeBackground}
            >
              <Image className="mr-2 h-4 w-4" />
              修改聊天背景
            </Button>
            {hasCustomBackground && (
              <Button
                variant="ghost"
                className="w-full justify-start text-foreground hover:bg-muted/50"
                onClick={onResetBackground}
              >
                <Eraser className="mr-2 h-4 w-4" />
                恢复默认背景
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-muted/50"
              onClick={onHideConversation}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              不显示此会话
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="mr-2 h-4 w-4" />
                  删除会话
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="left">
                <DropdownMenuItem
                  onClick={onDeleteConversationForMe}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDeleteConversationForAll}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  双向删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 删除联系人 - 仅私聊显示，放在最下方 */}
          {conversationInfo?.type === "private" && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onDeleteContact}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除联系人
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
