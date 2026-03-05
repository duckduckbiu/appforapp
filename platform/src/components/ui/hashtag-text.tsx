import { useMemo } from "react";
import { Link } from "react-router-dom";

interface HashtagTextProps {
  content: string;
  className?: string;
}

// Parse content and render hashtags as clickable links
export function HashtagText({ content, className }: HashtagTextProps) {
  const elements = useMemo(() => {
    if (!content) return [];

    const regex = /#([\u4e00-\u9fa5\w]+)/g;
    const parts: { type: "text" | "hashtag"; value: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before hashtag
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          value: content.slice(lastIndex, match.index),
        });
      }

      // Add hashtag
      parts.push({
        type: "hashtag",
        value: match[1],
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        value: content.slice(lastIndex),
      });
    }

    return parts;
  }, [content]);

  return (
    <span className={className}>
      {elements.map((part, index) => {
        if (part.type === "hashtag") {
          return (
            <Link
              key={index}
              to={`/hashtag/${encodeURIComponent(part.value)}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              #{part.value}
            </Link>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
}
