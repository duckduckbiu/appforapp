import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PrivacySettings {
  profile_visibility: string;
  allow_friend_requests: boolean;
  posts_default_visibility: string;
}

interface PrivacySettingsTabProps {
  privacySettings: PrivacySettings;
  setPrivacySettings: (settings: PrivacySettings) => void;
  onSave: () => void;
}

export function PrivacySettingsTab({
  privacySettings,
  setPrivacySettings,
  onSave,
}: PrivacySettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>隐私设置</CardTitle>
        <CardDescription>管理您的隐私和可见性设置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 flex-1">
            <Label>个人资料可见性</Label>
            <p className="text-sm text-muted-foreground">控制谁可以查看您的个人资料</p>
          </div>
          <Select
            value={privacySettings.profile_visibility}
            onValueChange={(value) =>
              setPrivacySettings({ ...privacySettings, profile_visibility: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">公开</SelectItem>
              <SelectItem value="friends">仅好友</SelectItem>
              <SelectItem value="private">私密</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>允许好友请求</Label>
            <p className="text-sm text-muted-foreground">其他用户是否可以添加您为好友</p>
          </div>
          <Switch
            checked={privacySettings.allow_friend_requests}
            onCheckedChange={(checked) =>
              setPrivacySettings({ ...privacySettings, allow_friend_requests: checked })
            }
          />
        </div>
        <Separator />
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 flex-1">
            <Label>帖子默认可见性</Label>
            <p className="text-sm text-muted-foreground">发布内容的默认可见范围</p>
          </div>
          <Select
            value={privacySettings.posts_default_visibility}
            onValueChange={(value) =>
              setPrivacySettings({ ...privacySettings, posts_default_visibility: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">公开</SelectItem>
              <SelectItem value="friends">仅好友</SelectItem>
              <SelectItem value="private">私密</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="pt-4">
          <Button onClick={onSave} className="w-full">
            保存设置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
