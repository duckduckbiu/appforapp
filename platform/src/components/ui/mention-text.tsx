import { Link } from "react-router-dom";
import { parseMentions } from "./mention-picker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MentionTextProps {
  text: string;
  className?: string;
}

// 获取用户 ID 映射
function useMentionedUsers(usernames: string[]) {
  return useQuery({
    queryKey: ["mentionedUsers", usernames],
    queryFn: async () => {
      if (usernames.length === 0) return {};

      const { data, error } = await supabase
        .from("profiles")
        .select("id, unique_username")
        .in("unique_username", usernames);

      if (error) {
        console.error("Error fetching mentioned users:", error);
        return {};
      }

      const map: Record<string, string> = {};
      (data || []).forEach((user) => {
        map[user.unique_username] = user.id;
      });
      return map;
    },
    enabled: usernames.length > 0,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

export function MentionText({ text, className }: MentionTextProps) {
  const parts = parseMentions(text);
  const usernames = parts
    .filter((p) => p.type === "mention" && p.username)
    .map((p) => p.username!);

  const { data: userMap } = useMentionedUsers(usernames);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "mention" && part.username) {
          const userId = userMap?.[part.username];
          
          if (userId) {
            return (
              <Link
                key={index}
                to={`/profile/${userId}`}
                className={cn(
                  "text-primary hover:underline font-medium",
                  "inline-block"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {part.content}
              </Link>
            );
          }
          
          // 用户不存在，显示为普通文本但保持样式
          return (
            <span key={index} className="text-primary">
              {part.content}
            </span>
          );
        }

        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}
