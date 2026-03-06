import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, description, onClick, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative min-h-[140px] p-6 flex flex-col justify-between transition-all duration-200",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>

      <div className="mt-3">
        <div className="text-3xl font-extrabold tabular-nums font-mono tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {onClick && (
        <span className="absolute right-3 bottom-3 text-[10px] text-muted-foreground/30 font-semibold">
          DETAIL →
        </span>
      )}
    </Card>
  );
}
