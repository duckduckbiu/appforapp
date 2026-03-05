import { Globe, Users, UserCheck, Lock, type LucideIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type VisibilityType = "public" | "followers" | "friends" | "private";

interface VisibilityOption {
  value: VisibilityType;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const visibilityOptions: VisibilityOption[] = [
  { value: "public", label: "公开", icon: Globe, description: "所有人可见" },
  { value: "followers", label: "关注者", icon: Users, description: "仅关注你的人可见" },
  { value: "friends", label: "好友", icon: UserCheck, description: "仅好友可见" },
  { value: "private", label: "私密", icon: Lock, description: "仅自己可见" },
];

interface VisibilitySelectorProps {
  value: VisibilityType;
  onChange: (value: VisibilityType) => void;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
}

export function VisibilitySelector({
  value,
  onChange,
  size = "default",
  className,
  disabled = false,
}: VisibilitySelectorProps) {
  const selectedOption = visibilityOptions.find((v) => v.value === value);
  const VisibilityIcon = selectedOption?.icon || Globe;

  return (
    <Select value={value} onValueChange={(v) => onChange(v as VisibilityType)} disabled={disabled}>
      <SelectTrigger
        className={cn(
          size === "sm" 
            ? "h-7 w-auto gap-1 border-none bg-muted/50 px-2 text-xs" 
            : "h-9 w-full gap-2",
          className
        )}
      >
        <VisibilityIcon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {visibilityOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              <option.icon className="h-4 w-4" />
              <span>{option.label}</span>
              {size === "default" && (
                <span className="text-xs text-muted-foreground ml-2">
                  {option.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
