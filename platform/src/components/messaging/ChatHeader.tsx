import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Ban, Forward, Trash2 } from "lucide-react";

interface ConversationInfo {
  name: string;
  avatarUrl: string | null;
  type: string;
  friendId?: string | null;
}

interface ChatHeaderProps {
  conversationInfo: ConversationInfo | null;
  isBlocked: boolean;
  isMultiSelectMode: boolean;
  selectedMessageIds: Set<string>;
  onMoreClick: () => void;
  onExitMultiSelect: () => void;
  onSelectAll: () => void;
  onBatchForward: () => void;
  onBatchDeleteForMe: () => void;
  onBatchDeleteForAll: () => void;
}

export function ChatHeader({
  conversationInfo,
  isBlocked,
  isMultiSelectMode,
  selectedMessageIds,
  onMoreClick,
  onExitMultiSelect,
  onSelectAll,
  onBatchForward,
  onBatchDeleteForMe,
  onBatchDeleteForAll,
}: ChatHeaderProps) {
  return (
    <div className="border-b p-3 flex items-center gap-3 bg-black/40 backdrop-blur-md">
      {isMultiSelectMode ? (
        <>
          <Button variant="ghost" size="sm" onClick={onExitMultiSelect}>
            取消
          </Button>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-base">
              已选择 {selectedMessageIds.size} 条消息
            </h2>
          </div>

          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            全选
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onBatchForward}
            disabled={selectedMessageIds.size === 0}
            title="转发"
          >
            <Forward className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={selectedMessageIds.size === 0}
                title="删除"
              >
                <Trash2 className="h-5 w-5 text-destructive" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onBatchDeleteForMe}>
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onBatchDeleteForAll}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                双向删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversationInfo?.avatarUrl || ""} />
            <AvatarFallback>
              {conversationInfo?.name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h2 className="font-medium text-base truncate">
              {conversationInfo?.name || "加载中..."}
            </h2>
            {isBlocked && conversationInfo?.type === "private" && (
              <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
                <Ban className="h-3 w-3" />
                黑名单
              </Badge>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={onMoreClick}>
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  );
}
