import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProfileSettingsTabProps {
  userId: string | null;
  isAIAvatar: boolean;
  profile: {
    unique_username: string;
    display_name: string;
    bio: string;
    avatar_url: string;
    cover_url: string;
  };
  setProfile: (profile: any) => void;
  avatarPreview: string;
  coverPreview: string;
  showQRCode: boolean;
  setShowQRCode: (show: boolean) => void;
  isSaving: boolean;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCoverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: (e: React.FormEvent) => void;
}

export function ProfileSettingsTab({
  userId,
  isAIAvatar,
  profile,
  setProfile,
  avatarPreview,
  coverPreview,
  showQRCode,
  setShowQRCode,
  isSaving,
  onAvatarChange,
  onCoverChange,
  onSave,
}: ProfileSettingsTabProps) {
  const qrCodeValue = userId ? `billai://user/${userId}` : "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>个人资料</CardTitle>
            <CardDescription>
              {isAIAvatar 
                ? `管理 AI 分身资料 - ${profile.display_name || profile.unique_username}` 
                : "管理您的账户信息"
              }
            </CardDescription>
          </div>
          {/* QR Code preview */}
          <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
            <DialogTrigger asChild>
              <button 
                className="bg-white p-2 rounded-lg hover:shadow-lg transition-shadow cursor-pointer border-2 border-muted"
                title="点击查看二维码"
              >
                <QRCodeSVG 
                  value={qrCodeValue}
                  size={80}
                  level="H"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>我的二维码</DialogTitle>
                <DialogDescription>
                  其他用户可以通过扫描此二维码添加你为好友
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG 
                    value={qrCodeValue}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="qr-text">二维码内容</Label>
                  <div className="flex gap-2">
                    <Input
                      id="qr-text"
                      value={qrCodeValue}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(qrCodeValue);
                        toast.success("已复制到剪贴板");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={profile.unique_username}
              onChange={(e) => setProfile({ ...profile, unique_username: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              测试阶段：可以随时修改用户名
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">显示名称</Label>
            <Input
              id="display_name"
              value={profile.display_name}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              placeholder="输入显示名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">个人简介</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="介绍一下自己..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>头像</Label>
            <div className="flex items-center gap-4">
              {avatarPreview && (
                <div className="relative w-20 h-20 rounded-full overflow-hidden border">
                  <img src={avatarPreview} alt="头像预览" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                  className="cursor-pointer"
                />
                <p className="text-sm text-muted-foreground mt-1">支持 JPG、PNG 格式</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>封面图</Label>
            <div className="space-y-2">
              {coverPreview && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                  <img src={coverPreview} alt="封面预览" className="w-full h-full object-cover" />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={onCoverChange}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">支持 JPG、PNG 格式，建议尺寸 1200x400</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
            保存修改
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
