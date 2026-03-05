import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Users, Bot } from "lucide-react";

interface Conversation {
  id: string;
  type: string;
  display_name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  last_message_is_ai?: boolean;
}

interface ConversationListItemProps {
  conversation: Conversation;
  onClick: () => void;
}

export function ConversationListItem({ 
  conversation, 
  onClick,
}: ConversationListItemProps) {
  const getTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNow(new Date(timestamp), {
        locale: zhCN,
        addSuffix: false,
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          {conversation.type === "group" && !conversation.avatar_url ? (
            <AvatarFallback>
              <Users className="h-6 w-6" />
            </AvatarFallback>
          ) : (
            <>
              <AvatarImage src={conversation.avatar_url || ""} />
              <AvatarFallback>
                {conversation.display_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </>
          )}
        </Avatar>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium truncate">
            {conversation.display_name || "未命名"}
          </h3>
          {conversation.last_message_time && (
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {getTimeAgo(conversation.last_message_time)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {conversation.last_message_is_ai && (
              <Bot className="h-3 w-3 text-primary flex-shrink-0" />
            )}
            <p className="text-sm text-muted-foreground truncate">
              {conversation.last_message || "暂无消息"}
            </p>
          </div>
          {conversation.unread_count > 0 && (
            <Badge variant="destructive" className="ml-2 flex-shrink-0">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
