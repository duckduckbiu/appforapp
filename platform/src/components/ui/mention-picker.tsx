import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMentionSuggestions } from "@/hooks/useUserSearch";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

export interface MentionUser {
  id: string;
  display_name: string | null;
  unique_username: string;
  avatar_url: string | null;
  is_ai_avatar?: boolean | null;
}

export interface MentionPickerRef {
  isOpen: boolean;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

interface MentionPickerProps {
  query: string;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  position?: { top: number; left: number };
  className?: string;
}

export const MentionPicker = forwardRef<MentionPickerRef, MentionPickerProps>(
  ({ query, onSelect, onClose, position, className }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const { suggestions, isLoading } = useMentionSuggestions(query, {
      limit: 8,
      enabled: true,
    });

    const isOpen = suggestions.length > 0 || isLoading;

    // 重置选中索引
    useEffect(() => {
      setSelectedIndex(0);
    }, [query]);

    // 键盘导航
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent): boolean => {
        if (!isOpen) return false;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % suggestions.length);
            return true;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
            return true;
          case "Enter":
          case "Tab":
            e.preventDefault();
            if (suggestions[selectedIndex]) {
              onSelect(suggestions[selectedIndex]);
            }
            return true;
          case "Escape":
            e.preventDefault();
            onClose();
            return true;
          default:
            return false;
        }
      },
      [isOpen, suggestions, selectedIndex, onSelect, onClose]
    );

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      isOpen,
      handleKeyDown,
    }));

    // 点击外部关闭
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose();
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    if (!isOpen) return null;

    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute z-50 w-64 rounded-lg border bg-popover shadow-lg",
          className
        )}
        style={position ? { top: position.top, left: position.left } : undefined}
      >
        <ScrollArea className="max-h-64">
          {isLoading && suggestions.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              搜索中...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              未找到用户
            </div>
          ) : (
            <div className="py-1">
              {suggestions.map((user, index) => (
                <button
                  key={user.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => onSelect(user)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(user.display_name || user.unique_username)?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm truncate">
                        {user.display_name || user.unique_username}
                      </span>
                      {user.is_ai_avatar && (
                        <Bot className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      @{user.unique_username}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }
);

MentionPicker.displayName = "MentionPicker";

// 解析文本中的 @ 提及
export function parseMentions(text: string): Array<{ type: "text" | "mention"; content: string; username?: string }> {
  const mentionRegex = /@(\w+)/g;
  const parts: Array<{ type: "text" | "mention"; content: string; username?: string }> = [];
  
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // 添加前面的文本
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // 添加 @ 提及
    parts.push({
      type: "mention",
      content: match[0],
      username: match[1],
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return parts;
}

// 提取文本中的所有 @ 用户名
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (!mentions.includes(match[1])) {
      mentions.push(match[1]);
    }
  }

  return mentions;
}
