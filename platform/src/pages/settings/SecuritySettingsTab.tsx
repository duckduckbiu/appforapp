import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface SecuritySettingsTabProps {
  userEmail: string;
}

export function SecuritySettingsTab({ userEmail }: SecuritySettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>账号安全</CardTitle>
        <CardDescription>管理您的账号安全设置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>登录邮箱</Label>
          <Input value={userEmail} disabled />
          <p className="text-xs text-muted-foreground">邮箱是您的登录凭证，无法修改</p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>修改密码</Label>
            <p className="text-sm text-muted-foreground">定期更换密码可以提高账号安全性</p>
          </div>
          <Button variant="outline">修改</Button>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>两步验证</Label>
            <p className="text-sm text-muted-foreground">开启后登录时需要额外验证</p>
          </div>
          <Switch />
        </div>
      </CardContent>
    </Card>
  );
}
