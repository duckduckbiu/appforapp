import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, Unlock, Check, X } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AuditLog {
  id: string;
  user_id: string;
  avatar_id: string | null;
  app_id: string;
  permission_type: string;
  action_type: string;
  old_value: any;
  new_value: any;
  created_at: string;
}

interface PermissionAuditLogProps {
  avatarId?: string;
  limit?: number;
}

export function PermissionAuditLog({ avatarId, limit = 50 }: PermissionAuditLogProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [avatarId]);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("permission_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (avatarId) {
        query = query.eq("avatar_id", avatarId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("加载审计日志失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "lock":
        return <Lock className="h-4 w-4" />;
      case "unlock":
        return <Unlock className="h-4 w-4" />;
      case "grant":
        return <Check className="h-4 w-4" />;
      case "revoke":
        return <X className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "lock":
        return "destructive";
      case "unlock":
        return "default";
      case "grant":
        return "default";
      case "revoke":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getActionText = (actionType: string) => {
    switch (actionType) {
      case "lock":
        return "锁定";
      case "unlock":
        return "解锁";
      case "grant":
        return "授予";
      case "revoke":
        return "撤销";
      case "update_mode":
        return "修改模式";
      case "update_enabled":
        return "修改状态";
      default:
        return actionType;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner size="default" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>权限审计日志</CardTitle>
          <CardDescription>记录所有权限变更历史</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            暂无审计日志记录
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>权限审计日志</CardTitle>
        <CardDescription>
          共 {logs.length} 条记录，最近 {limit} 条
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
              >
                <div className="flex-shrink-0 mt-1">
                  <Badge variant={getActionColor(log.action_type) as any}>
                    <span className="flex items-center gap-1">
                      {getActionIcon(log.action_type)}
                      {getActionText(log.action_type)}
                    </span>
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{log.app_id}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {log.permission_type}
                    </span>
                  </div>
                  {log.old_value && log.new_value && (
                    <div className="text-xs text-muted-foreground">
                      {JSON.stringify(log.old_value)} → {JSON.stringify(log.new_value)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
