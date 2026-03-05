import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// 表情列表常量
export const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
  "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
  "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜",
  "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
  "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
  "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒",
  "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "😶‍🌫️", "😵",
  "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙",
  "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "💔", "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗", "💖",
  "🌹", "🌸", "🌺", "🌻", "🌼", "🌷", "🌱", "🌿",
  "⭐", "✨", "🌟", "💫", "⚡", "🔥", "💧", "🌈",
];

interface EmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  position?: "top" | "bottom";
  className?: string;
}

export function EmojiPicker({
  open,
  onOpenChange,
  onSelect,
  position = "top",
  className,
}: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute w-80 p-2 bg-background/95 backdrop-blur-md border border-border/20 rounded-md shadow-lg z-20",
        position === "top" ? "bottom-full mb-2" : "top-full mt-2",
        className
      )}
    >
      <div className="grid grid-cols-8 gap-1 max-h-60 overflow-y-auto">
        {EMOJI_LIST.map((emoji, index) => (
          <button
            key={index}
            type="button"
            className="h-10 w-10 flex items-center justify-center text-2xl hover:bg-accent rounded-md transition-colors"
            onClick={() => handleEmojiClick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

interface EmojiTriggerProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "default" | "icon";
}

export function EmojiTrigger({ onClick, className, size = "icon" }: EmojiTriggerProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn("h-8 w-8", className)}
      onClick={onClick}
    >
      <Smile className="h-5 w-5" />
    </Button>
  );
}
