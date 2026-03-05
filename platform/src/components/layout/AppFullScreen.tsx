import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Floating [B] button for full-screen app mode.
 * Appears in top-left corner, semi-transparent, click to return to platform.
 */
export function FloatingReturnButton() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => navigate("/store")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed top-3 left-3 z-[200] flex items-center justify-center",
        "h-8 w-8 rounded-full transition-all duration-200",
        "bg-background/60 backdrop-blur border border-border/50 shadow-sm",
        "hover:bg-background hover:border-border hover:shadow-md hover:scale-110",
        "active:scale-95"
      )}
      title="返回 Bill.ai"
    >
      <span
        className={cn(
          "text-xs font-bold transition-colors",
          hovered ? "text-primary" : "text-muted-foreground"
        )}
      >
        B
      </span>
    </button>
  );
}
