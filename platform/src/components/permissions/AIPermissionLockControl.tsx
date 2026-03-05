import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIPermissionLockControlProps {
  avatarId: string;
  appId: string;
  permissionType: string;
  isLocked: boolean;
  lockedValue?: boolean;
  onLockChange: () => void;
}

export function AIPermissionLockControl({
  avatarId,
  appId,
  permissionType,
  isLocked,
  lockedValue,
  onLockChange,
}: AIPermissionLockControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleLock = async () => {
    setIsUpdating(true);
    try {
      if (isLocked) {
        // 解锁
        const { error } = await supabase
          .from("ai_avatar_permission_locks")
          .delete()
          .eq("avatar_id", avatarId)
          .eq("app_id", appId)
          .eq("permission_type", permissionType);

        if (error) throw error;

        // 记录审计日志
        await supabase.rpc("log_permission_change", {
          p_user_id: (await supabase.auth.getUser()).data.user?.id,
          p_avatar_id: avatarId,
          p_app_id: appId,
          p_permission_type: permissionType,
          p_action_type: "unlock",
          p_old_value: { is_locked: true, locked_value: lockedValue },
          p_new_value: { is_locked: false },
        });

        toast.success("已解锁权限");
      } else {
        // 锁定（锁定为当前值）
        const { data: currentPermission } = await supabase
          .from("app_permissions")
          .select("is_enabled, permission_mode")
          .eq("user_id", avatarId)
          .eq("app_id", appId)
          .eq("permission_type", permissionType)
          .single();

        const lockValue = currentPermission?.is_enabled ?? false;

        const { error } = await supabase
          .from("ai_avatar_permission_locks")
          .upsert({
            avatar_id: avatarId,
            app_id: appId,
            permission_type: permissionType,
            is_locked: true,
            locked_value: lockValue,
          });

        if (error) throw error;

        // 记录审计日志
        await supabase.rpc("log_permission_change", {
          p_user_id: (await supabase.auth.getUser()).data.user?.id,
          p_avatar_id: avatarId,
          p_app_id: appId,
          p_permission_type: permissionType,
          p_action_type: "lock",
          p_old_value: { is_locked: false },
          p_new_value: { is_locked: true, locked_value: lockValue },
        });

        toast.success("已锁定权限");
      }

      onLockChange();
    } catch (error) {
      console.error("切换锁定状态失败:", error);
      toast.error("操作失败");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggleLock}
            disabled={isUpdating}
          >
          {isUpdating ? (
            <LoadingSpinner size="sm" />
          ) : isLocked ? (
            <Lock className="h-4 w-4 text-destructive" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground" />
          )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isLocked ? "点击解锁（AI 可修改）" : "点击锁定（AI 无法修改）"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
