import { useNavigate } from "react-router-dom";
import {
  Settings, Shield, Users, Bell, Ban,
  Radio, TrendingUp, DollarSign, ChevronRight,
  LogOut, Moon, Sun, User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { useIdentity } from "@/contexts/IdentityContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: string;
  danger?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, badge, danger }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
    >
      <Icon className={`h-5 w-5 shrink-0 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      <span className={`flex-1 text-sm ${danger ? "text-destructive" : ""}`}>{label}</span>
      {badge && (
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{badge}</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
    </button>
  );
}

export default function Me() {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const { theme, setTheme } = useTheme();
  const profile = currentIdentity?.profile;

  // Check admin role
  const { data: isAdmin } = useQuery({
    queryKey: ["user-role-admin", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!profile?.id,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={() => navigate("/auth")}>登录</Button>
      </div>
    );
  }

  const displayName = profile.display_name || profile.unique_username || "用户";

  return (
    <ScrollArea className="h-full">
      <div className="max-w-lg mx-auto pb-20">
        {/* Profile Card */}
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-4 w-full px-4 py-6 hover:bg-muted/30 transition-colors text-left"
        >
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-lg">{displayName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{displayName}</h2>
            {profile.unique_username && (
              <p className="text-sm text-muted-foreground">@{profile.unique_username}</p>
            )}
            {profile.bio && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{profile.bio}</p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
        </button>

        <Separator />

        {/* General */}
        <div className="py-2">
          <MenuItem icon={Settings} label="设置" onClick={() => navigate("/settings")} />
          <MenuItem icon={Shield} label="隐私" onClick={() => navigate("/privacy")} />
          <MenuItem icon={Users} label="好友" onClick={() => navigate("/friends")} />
          <MenuItem icon={Bell} label="通知" onClick={() => navigate("/notifications")} />
          <MenuItem icon={Ban} label="黑名单" onClick={() => navigate("/blacklist")} />
        </div>

        <Separator />

        {/* Creator Tools */}
        <div className="py-2">
          <p className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">创作者工具</p>
          <MenuItem icon={Radio} label="我的频道" onClick={() => navigate("/my-channels")} />
          <MenuItem icon={TrendingUp} label="推广中心" onClick={() => navigate("/promoter")} />
          <MenuItem icon={DollarSign} label="收益统计" onClick={() => navigate("/earnings")} />
        </div>

        {/* Admin */}
        {isAdmin && (
          <>
            <Separator />
            <div className="py-2">
              <p className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">管理</p>
              <MenuItem icon={Shield} label="平台管理" onClick={() => navigate("/admin/overview")} />
            </div>
          </>
        )}

        <Separator />

        {/* Theme Toggle */}
        <div className="flex items-center gap-3 px-4 py-3">
          {theme === "dark" ? (
            <Moon className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Sun className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="flex-1 text-sm">深色模式</span>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>

        <Separator />

        {/* Logout */}
        <div className="py-2">
          <MenuItem icon={LogOut} label="退出登录" onClick={handleLogout} danger />
        </div>
      </div>
    </ScrollArea>
  );
}
