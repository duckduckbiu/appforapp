import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function PrivacySettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    profile_visibility: "public",
    allow_friend_requests: true,
    posts_default_visibility: "public"
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
    await loadSettings(user.id);
  };

  const loadSettings = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("privacy_settings")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data?.privacy_settings) {
        setSettings(data.privacy_settings as any);
      }
    } catch (error) {
      console.error("加载隐私设置失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          privacy_settings: settings
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("隐私设置已保存");
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/profile")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回个人资料
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>隐私设置</CardTitle>
          <CardDescription>管理你的隐私和可见性设置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>个人资料可见性</Label>
            <Select
              value={settings.profile_visibility}
              onValueChange={(value) => 
                setSettings({ ...settings, profile_visibility: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">公开</SelectItem>
                <SelectItem value="friends">仅好友</SelectItem>
                <SelectItem value="private">私密</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              控制谁可以查看你的个人资料
            </p>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label>允许好友请求</Label>
              <p className="text-sm text-muted-foreground">
                其他用户可以向你发送好友请求
              </p>
            </div>
            <Switch
              checked={settings.allow_friend_requests}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, allow_friend_requests: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>帖子默认可见性</Label>
            <Select
              value={settings.posts_default_visibility}
              onValueChange={(value) => 
                setSettings({ ...settings, posts_default_visibility: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">公开</SelectItem>
                <SelectItem value="followers">关注者</SelectItem>
                <SelectItem value="friends">仅好友</SelectItem>
                <SelectItem value="private">私密</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              设置发布新帖子时的默认可见性
            </p>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
            保存设置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
