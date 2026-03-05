import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageIcon } from "lucide-react";

interface MessageQuoteCardProps {
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  messageType: string;
  metadata?: any;
  onClick?: () => void;
}

export function MessageQuoteCard({
  senderName,
  senderAvatar,
  content,
  messageType,
  metadata,
  onClick,
}: MessageQuoteCardProps) {
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border-l-2 border-primary cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={onClick}
    >
      <Avatar className="h-6 w-6 flex-shrink-0">
        <AvatarImage src={senderAvatar || ""} />
        <AvatarFallback className="text-xs">{senderName[0]}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {senderName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {messageType === "text" ? (
            content
          ) : messageType === "image" ? (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              图片
            </span>
          ) : (
            "消息"
          )}
        </p>
      </div>
    </div>
  );
}
