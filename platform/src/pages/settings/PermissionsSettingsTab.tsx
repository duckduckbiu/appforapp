import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  AlertCircle, Camera, Mic, HardDrive, MessageSquare, Sparkles, 
  Image as ImageIcon, MapPin, Bluetooth, Users, ClipboardList, 
  Wallet, RefreshCw, Activity, Download, Send, Zap, Settings2, Bell, Bot 
} from "lucide-react";

interface Permission {
  id: string;
  permission_type: string;
  is_enabled: boolean;
}

interface GroupedPermission {
  app_id: string;
  app_name: string;
  app_icon?: string;
  permissions: Permission[];
}

interface AIAvatar {
  id: string;
  name: string;
  display_name?: string;
  avatar_url?: string;
  is_active: boolean;
}

interface PermissionsSettingsTabProps {
  groupedPermissions: GroupedPermission[];
  permissionsLoading: boolean;
  updatePermission: (appId: string, permissionType: string, enabled: boolean) => void;
  isAIAvatar: boolean;
  aiAvatars: AIAvatar[];
  onToggleAIAvatar: (avatarId: string, currentActive: boolean) => void;
  onManageAIPermissions: (avatarId: string) => void;
}

const getPermissionIcon = (type: string) => {
  switch (type) {
    case 'camera': return <Camera className="h-4 w-4" />;
    case 'microphone': return <Mic className="h-4 w-4" />;
    case 'photo_library': return <ImageIcon className="h-4 w-4" />;
    case 'location': return <MapPin className="h-4 w-4" />;
    case 'biometric': return <Sparkles className="h-4 w-4" />;
    case 'bluetooth': return <Bluetooth className="h-4 w-4" />;
    case 'storage': return <HardDrive className="h-4 w-4" />;
    case 'contacts': return <Users className="h-4 w-4" />;
    case 'clipboard': return <ClipboardList className="h-4 w-4" />;
    case 'wallet_access': return <Wallet className="h-4 w-4" />;
    case 'island_notification': return <Bell className="h-4 w-4" />;
    case 'notification': return <Bell className="h-4 w-4" />;
    case 'background_refresh': return <RefreshCw className="h-4 w-4" />;
    case 'background_activity': return <Activity className="h-4 w-4" />;
    case 'background_download': return <Download className="h-4 w-4" />;
    case 'auto_reply': return <MessageSquare className="h-4 w-4" />;
    case 'auto_post': return <Send className="h-4 w-4" />;
    case 'auto_interact': return <Zap className="h-4 w-4" />;
    default: return <Settings2 className="h-4 w-4" />;
  }
};

const getPermissionName = (type: string) => {
  switch (type) {
    case 'camera': return '相机';
    case 'microphone': return '麦克风';
    case 'photo_library': return '相册';
    case 'location': return '位置';
    case 'biometric': return '生物识别';
    case 'bluetooth': return '蓝牙';
    case 'storage': return '存储空间';
    case 'contacts': return '通讯录';
    case 'clipboard': return '剪贴板';
    case 'wallet_access': return '钱包访问';
    case 'island_notification': return '灵动岛通知';
    case 'notification': return '系统通知';
    case 'background_refresh': return '后台刷新';
    case 'background_activity': return '后台活动';
    case 'background_download': return '后台下载';
    case 'auto_reply': return '自动回复';
    case 'auto_post': return '自动发帖';
    case 'auto_interact': return '自动互动';
    default: return type;
  }
};

const getPermissionDescription = (type: string) => {
  switch (type) {
    case 'camera': return '允许应用使用相机拍照或录像';
    case 'microphone': return '允许应用录制音频';
    case 'photo_library': return '允许应用访问和选择相册中的照片/视频';
    case 'location': return '允许应用获取设备位置信息';
    case 'biometric': return '允许应用使用指纹/面部识别';
    case 'bluetooth': return '允许应用使用蓝牙功能';
    case 'storage': return '允许应用读写本地存储';
    case 'contacts': return '允许应用访问通讯录';
    case 'clipboard': return '允许应用访问剪贴板内容';
    case 'wallet_access': return '允许应用访问钱包/支付信息';
    case 'island_notification': return '允许应用发送灵动岛通知';
    case 'notification': return '允许应用发送普通系统通知';
    case 'background_refresh': return '允许应用在后台刷新数据';
    case 'background_activity': return '允许应用在后台持续运行';
    case 'background_download': return '允许应用在后台下载文件';
    case 'auto_reply': return '允许 AI 自动回复消息';
    case 'auto_post': return '允许 AI 自动发布内容';
    case 'auto_interact': return '允许 AI 自动点赞/评论/转发';
    default: return '';
  }
};

export function PermissionsSettingsTab({
  groupedPermissions,
  permissionsLoading,
  updatePermission,
  isAIAvatar,
  aiAvatars,
  onToggleAIAvatar,
  onManageAIPermissions,
}: PermissionsSettingsTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>应用权限管理</CardTitle>
              <CardDescription>管理各个应用对系统资源的访问权限</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/permissions')}
              className="shrink-0"
            >
              查看所有权限
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {permissionsLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <LoadingSpinner size="default" className="mx-auto mb-2" />
              <p className="text-sm">加载权限设置中...</p>
            </div>
          ) : groupedPermissions.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">暂无应用权限</p>
                <p className="text-sm text-muted-foreground">
                  当应用请求使用系统权限时，相关权限设置将显示在这里
                </p>
              </div>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {groupedPermissions.map((app) => (
                <AccordionItem key={app.app_id} value={app.app_id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {app.app_icon ? (
                          <img src={app.app_icon} alt={app.app_name} className="h-6 w-6" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="text-left">
                        <h4 className="font-medium">{app.app_name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {app.permissions.filter(p => p.is_enabled).length} / {app.permissions.length} 项权限已启用
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {app.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-muted-foreground">
                              {getPermissionIcon(permission.permission_type)}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {getPermissionName(permission.permission_type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getPermissionDescription(permission.permission_type)}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={permission.is_enabled}
                            onCheckedChange={(checked) => 
                              updatePermission(app.app_id, permission.permission_type, checked)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* AI Avatar permissions - only for real users */}
      {!isAIAvatar && aiAvatars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI 分身权限管理</CardTitle>
            <CardDescription>
              管理您的 AI 分身的应用权限和自主策略
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiAvatars.map((avatar, index) => (
              <div key={avatar.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={avatar.avatar_url || undefined} />
                      <AvatarFallback>
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {avatar.display_name || avatar.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {avatar.is_active ? "已启用" : "已禁用"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onManageAIPermissions(avatar.id)}
                    >
                      管理权限
                    </Button>
                    <Switch
                      checked={avatar.is_active}
                      onCheckedChange={() => onToggleAIAvatar(avatar.id, avatar.is_active)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
