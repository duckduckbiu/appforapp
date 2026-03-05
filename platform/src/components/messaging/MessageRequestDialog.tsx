import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMessageRequests } from "@/hooks/useMessageRequests";

interface MessageRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    id: string;
    display_name?: string;
    unique_username: string;
    avatar_url?: string;
  };
}

export function MessageRequestDialog({
  open,
  onOpenChange,
  targetUser,
}: MessageRequestDialogProps) {
  const { sendRequest, isSending } = useMessageRequests();
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) return;

    await sendRequest({
      receiverId: targetUser.id,
      message: message.trim(),
    });

    onOpenChange(false);
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>发送消息请求</DialogTitle>
          <DialogDescription>
            向非好友用户发送消息请求，对方接受后即可聊天
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* 目标用户信息 */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={targetUser.avatar_url} />
              <AvatarFallback>
                {targetUser.display_name?.[0] || targetUser.unique_username[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {targetUser.display_name || targetUser.unique_username}
              </p>
              <p className="text-sm text-muted-foreground">
                @{targetUser.unique_username}
              </p>
            </div>
          </div>

          {/* 消息输入 */}
          <Textarea
            placeholder="写一段自我介绍，让对方了解你..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none"
            rows={4}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {message.length}/200
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSending || !message.trim()}
          >
            {isSending ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            发送请求
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
