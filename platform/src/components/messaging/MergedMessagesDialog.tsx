import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ContentDialog,
  ContentDialogHeader,
  ContentDialogTitle,
  ContentDialogBody,
} from "@/components/ui/content-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface MergedMessage {
  id: string;
  content: string | null;
  message_type: string;
  metadata: any;
  sender_id: string;
  created_at: string;
}

interface MergedMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mergedMessages: MergedMessage[];
  messageCount: number;
  conversationName?: string;
}

export function MergedMessagesDialog({
  open,
  onOpenChange,
  mergedMessages,
  messageCount,
  conversationName,
}: MergedMessagesDialogProps) {
  const [senderProfiles, setSenderProfiles] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (open && mergedMessages.length > 0) {
      loadSenderProfiles();
    }
  }, [open, mergedMessages]);

  const loadSenderProfiles = async () => {
    const senderIds = [...new Set(mergedMessages.map(m => m.sender_id))];
    
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", senderIds);

    if (data) {
      const profilesMap = new Map(data.map(p => [p.id, p]));
      setSenderProfiles(profilesMap);
    }
  };

  return (
    <ContentDialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <ContentDialogHeader onClose={() => onOpenChange(false)}>
        <ContentDialogTitle>
          {conversationName ? `${conversationName}的聊天记录` : "聊天记录"} ({messageCount}条)
        </ContentDialogTitle>
      </ContentDialogHeader>

      <ContentDialogBody className="space-y-4">
        {mergedMessages.map((message) => {
          const sender = senderProfiles.get(message.sender_id);
          const senderName = sender?.display_name || "未知用户";
          const senderAvatar = sender?.avatar_url;

          return (
            <div key={message.id} className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={senderAvatar || ""} />
                <AvatarFallback>{senderName[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">{senderName}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.created_at), "MM月dd日 HH:mm", { locale: zhCN })}
                  </span>
                </div>

                {message.message_type === "text" ? (
                  <div className="bg-muted rounded-lg px-3 py-2 inline-block">
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                ) : message.message_type === "image" && message.metadata?.image_url ? (
                  <div className="rounded-lg overflow-hidden max-w-xs">
                    <img
                      src={message.metadata.image_url}
                      alt="消息图片"
                      className="w-full h-auto max-h-40 object-contain"
                    />
                  </div>
                ) : message.message_type === "file" && message.metadata?.file_name ? (
                  <div className="bg-muted rounded-lg px-3 py-2 inline-block">
                    <p className="text-sm text-muted-foreground">
                      [文件] {message.metadata.file_name}
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg px-3 py-2 inline-block">
                    <p className="text-sm text-muted-foreground">
                      [不支持的消息类型]
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </ContentDialogBody>
    </ContentDialog>
  );
}
