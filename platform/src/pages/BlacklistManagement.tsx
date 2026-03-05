import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Ban } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface BlacklistUser {
  id: string;
  blocked_user_id: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
  };
}

export default function BlacklistManagement() {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const [blacklist, setBlacklist] = useState<BlacklistUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    loadBlacklist();
  }, [currentIdentity]);

  const loadBlacklist = async () => {
    if (!currentIdentity) return;

    try {
      const { data, error } = await supabase
        .from("blacklist")
        .select(`
          id,
          blocked_user_id,
          created_at
        `)
        .eq("user_id", currentIdentity.profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 获取被拉黑用户的资料
      if (data && data.length > 0) {
        const userIds = data.map(item => item.blocked_user_id);
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, unique_username, avatar_url")
          .in("id", userIds);

        if (profileError) throw profileError;

        // 合并数据
        const enrichedData = data.map(item => ({
          ...item,
          profile: profiles?.find(p => p.id === item.blocked_user_id) || {
            id: item.blocked_user_id,
            display_name: null,
            unique_username: "unknown",
            avatar_url: null,
          }
        }));

        setBlacklist(enrichedData);
      } else {
        setBlacklist([]);
      }
    } catch (error) {
      console.error("加载黑名单失败:", error);
      toast.error("加载黑名单失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromBlacklist = async (blacklistId: string, userName: string) => {
    setConfirmDialog({
      open: true,
      title: "移出黑名单",
      description: `确定要将 ${userName} 移出黑名单吗？`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from("blacklist")
            .delete()
            .eq("id", blacklistId);

          if (error) throw error;

          toast.success("已移出黑名单");
          loadBlacklist();
        } catch (error) {
          console.error("移出黑名单失败:", error);
          toast.error("移出黑名单失败");
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="border-b p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">黑名单管理</h1>
      </div>

      {/* 黑名单列表 */}
      <div className="flex-1 overflow-y-auto">
        {blacklist.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Ban className="h-12 w-12 mb-4 opacity-50" />
            <p>黑名单为空</p>
            <p className="text-sm mt-2">被拉黑的用户将无法给你发送消息</p>
          </div>
        ) : (
          <div className="divide-y">
            {blacklist.map((item) => {
              const profile = item.profile;
              
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback>
                        {profile?.display_name?.[0]?.toUpperCase() || 
                         profile?.unique_username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">
                        {profile?.display_name || profile?.unique_username || "未知用户"}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        @{profile?.unique_username || "unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        加入时间: {new Date(item.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveFromBlacklist(
                      item.id,
                      profile?.display_name || profile?.unique_username || "该用户"
                    )}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    移除
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部说明 */}
      {blacklist.length > 0 && (
        <div className="border-t p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            已拉黑 {blacklist.length} 个用户。被拉黑的用户无法给你发送消息。
          </p>
        </div>
      )}
      
      {/* 确认对话框 */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant="destructive"
      />
    </div>
  );
}
