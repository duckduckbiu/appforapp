import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useIdentity } from "@/contexts/IdentityContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCreateComment } from "@/hooks/useComments";
import { cn } from "@/lib/utils";
import { EmojiPicker, EmojiTrigger } from "@/components/ui/emoji-picker";
import { MentionPicker, MentionPickerRef, MentionUser } from "@/components/ui/mention-picker";

interface CommentInputProps {
  postId: string;
  parentId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  className?: string;
}

export function CommentInput({
  postId,
  parentId,
  placeholder = "写下你的评论...",
  onSuccess,
  className,
}: CommentInputProps) {
  const { currentIdentity } = useIdentity();
  const [content, setContent] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPickerRef = useRef<MentionPickerRef>(null);
  const { mutate: createComment, isPending } = useCreateComment();

  // Mention 相关状态
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);

  const handleSubmit = () => {
    if (!content.trim()) return;

    createComment(
      { postId, content: content.trim(), parentId },
      {
        onSuccess: () => {
          setContent("");
          onSuccess?.();
        },
      }
    );
  };

  // 检测 @ 输入
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newContent);

    // 查找光标前最近的 @
    const textBeforeCursor = newContent.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // 检查 @ 后面是否只有字母数字下划线（正在输入用户名）
      if (/^[\w]*$/.test(textAfterAt) && !textAfterAt.includes(" ")) {
        setShowMentionPicker(true);
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        return;
      }
    }

    setShowMentionPicker(false);
    setMentionQuery("");
    setMentionStartPos(-1);
  }, []);

  // 选择提及用户
  const handleMentionSelect = useCallback((user: MentionUser) => {
    if (mentionStartPos === -1) return;

    const before = content.slice(0, mentionStartPos);
    const cursorPos = textareaRef.current?.selectionStart || content.length;
    const after = content.slice(cursorPos);

    const newContent = `${before}@${user.unique_username} ${after}`;
    setContent(newContent);
    setShowMentionPicker(false);
    setMentionQuery("");
    setMentionStartPos(-1);

    // 聚焦并移动光标
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const newPos = before.length + user.unique_username.length + 2; // @username + space
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [content, mentionStartPos]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果 MentionPicker 打开，优先处理其键盘事件
    if (showMentionPicker && mentionPickerRef.current?.handleKeyDown(e)) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setContent(prev => prev + emoji);
    }
  };

  return (
    <div className={cn("flex gap-3", className)}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={currentIdentity?.profile?.avatar_url || ""} />
        <AvatarFallback>
          {currentIdentity?.profile?.display_name?.[0] || "U"}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 flex gap-2 relative">
        {/* 表情选择器 */}
        <EmojiPicker
          open={emojiPickerOpen}
          onOpenChange={setEmojiPickerOpen}
          onSelect={handleEmojiSelect}
          position="top"
          className="left-0"
        />

        {/* @ 提及选择器 */}
        {showMentionPicker && (
          <MentionPicker
            ref={mentionPickerRef}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionPicker(false)}
            className="bottom-full mb-2 left-0"
          />
        )}
        
        <div className="flex-1 flex items-end gap-1">
          <EmojiTrigger 
            onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} 
            className="shrink-0 mb-1"
          />
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isPending}
            className="min-h-[40px] max-h-[120px] resize-none py-2"
            rows={1}
          />
        </div>
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!content.trim() || isPending}
          className="shrink-0"
        >
          {isPending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
