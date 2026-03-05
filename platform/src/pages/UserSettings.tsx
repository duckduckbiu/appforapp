import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bot, Settings2, Shield, Bell, Lock } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, QrCode } from "lucide-react";
import { useIdentity } from "@/contexts/IdentityContext";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppPermissions } from "@/contexts/AppPermissionsContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Camera, Mic, HardDrive, MessageSquare, Sparkles, Image as ImageIcon, MapPin, Bluetooth, Users, ClipboardList, Wallet, RefreshCw, Activity, Download, Send, Zap } from "lucide-react";

export default function UserSettings() {
  const navigate = useNavigate();
  const { currentIdentity, refreshIdentities } = useIdentity();
  const { groupedPermissions, loading: permissionsLoading, updatePermission } = useAppPermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAIAvatar, setIsAIAvatar] = useState(false);
  const [profile, setProfile] = useState({
    unique_username: "",
    display_name: "",
    bio: "",
    avatar_url: "",
    cover_url: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string>("");
  const [aiAvatars, setAiAvatars] = useState<any[]>([]);
  const [privacySettings, setPrivacySettings] = useState({
    profile_visibility: "public",
    allow_friend_requests: true,
    posts_default_visibility: "public",
  });

  const qrCodeValue = userId ? `billai://user/${userId}` : "";

  useEffect(() => {
    checkAuth();
    if (!isAIAvatar) {
      loadAIAvatars();
    }
  }, [currentIdentity]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserEmail(session.user.email || "");
    
    // 使用当前身份 ID 加载资料
    const identityId = currentIdentity?.profile.id || session.user.id;
    const isAI = currentIdentity?.type === "ai_avatar";
    
    setUserId(identityId);
    setIsAIAvatar(isAI);
    await loadProfile(identityId);
  };

  const loadProfile = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          unique_username: data.unique_username || "",
          display_name: data.display_name || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
          cover_url: data.cover_url || "",
        });
        setAvatarPreview(data.avatar_url || "");
        setCoverPreview(data.cover_url || "");
        
        // 加载隐私设置
        const privacy = data.privacy_settings as any;
        if (privacy) {
          setPrivacySettings({
            profile_visibility: privacy.profile_visibility || "public",
            allow_friend_requests: privacy.allow_friend_requests ?? true,
            posts_default_visibility: privacy.posts_default_visibility || "public",
          });
        }
      } else {
        // Profile doesn't exist, create it
        const randomUsername = 'user_' + Math.random().toString(36).substring(2, 10);
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: id,
            unique_username: randomUsername,
            display_name: randomUsername,
          });

        if (insertError) throw insertError;

        setProfile({
          unique_username: randomUsername,
          display_name: randomUsername,
          bio: "",
          avatar_url: "",
          cover_url: "",
        });
        toast.success("已为您创建个人资料");
      }
    } catch (error: any) {
      toast.error("加载个人资料失败");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAIAvatars = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("ai_avatars")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAiAvatars(data || []);
    } catch (error) {
      console.error("Error loading AI avatars:", error);
    }
  };

  const toggleAIAvatarActive = async (avatarId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_avatars")
        .update({ is_active: !currentActive })
        .eq("id", avatarId);

      if (error) throw error;

      toast.success(currentActive ? "AI 分身已禁用" : "AI 分身已启用");
      await loadAIAvatars();
    } catch (error) {
      console.error("Error toggling AI avatar:", error);
      toast.error("操作失败");
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setTempImageSrc(imageUrl);
      setShowCropDialog(true);
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    setAvatarFile(croppedFile);
    setAvatarPreview(URL.createObjectURL(croppedFile));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, bucket: string, userId: string, preset?: 'avatar' | 'cover') => {
    // 使用统一图片压缩
    const { compressImageWithPreset } = await import('@/lib/imageCompression');
    const compressedFile = preset ? await compressImageWithPreset(file, preset) : file;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, compressedFile, { upsert: true });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_url;

      if (avatarFile) {
        avatarUrl = await uploadFile(avatarFile, 'avatars', userId, 'avatar');
      }

      if (coverFile) {
        coverUrl = await uploadFile(coverFile, 'covers', userId, 'cover');
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          unique_username: profile.unique_username,
          display_name: profile.display_name,
          bio: profile.bio,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
        })
        .eq("id", userId);

      if (error) throw error;

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl, cover_url: coverUrl }));
      setAvatarFile(null);
      setCoverFile(null);
      toast.success("个人资料已更新");
      
      await loadProfile(userId);
      // 刷新身份数据，同步头像到顶部导航栏
      await refreshIdentities();
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          privacy_settings: privacySettings,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("隐私设置已保存");
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  return (
    <div className="bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">用户设置</h1>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">个人资料</TabsTrigger>
            <TabsTrigger value="privacy">隐私设置</TabsTrigger>
            <TabsTrigger value="notifications">通知设置</TabsTrigger>
            <TabsTrigger value="permissions">权限管理</TabsTrigger>
            <TabsTrigger value="security">账号安全</TabsTrigger>
          </TabsList>

          {/* 个人资料 Tab */}
          <TabsContent value="profile">
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
                  {/* 右上角二维码预览 */}
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
                <form onSubmit={handleSave} className="space-y-4">
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
                          onChange={handleAvatarChange}
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
                        onChange={handleCoverChange}
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
          </TabsContent>

          {/* 隐私设置 Tab */}
          <TabsContent value="privacy">
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
                  <Button onClick={handleSavePrivacy} className="w-full">
                    保存设置
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 通知设置 Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>通知设置</CardTitle>
                <CardDescription>管理您的通知偏好</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>消息通知</Label>
                    <p className="text-sm text-muted-foreground">接收新消息时显示通知</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>好友请求通知</Label>
                    <p className="text-sm text-muted-foreground">有新的好友请求时提醒</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI 分身活动通知</Label>
                    <p className="text-sm text-muted-foreground">AI 分身有重要活动时通知</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>灵动岛通知</Label>
                    <p className="text-sm text-muted-foreground">在灵动岛区域显示通知</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 权限管理 Tab */}
          <TabsContent value="permissions">
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
                              {app.permissions.map((permission) => {
                                const getPermissionIcon = (type: string) => {
                                  switch (type) {
                                    // 硬件权限
                                    case 'camera': return <Camera className="h-4 w-4" />;
                                    case 'microphone': return <Mic className="h-4 w-4" />;
                                    case 'photo_library': return <ImageIcon className="h-4 w-4" />;
                                    case 'location': return <MapPin className="h-4 w-4" />;
                                    case 'biometric': return <Sparkles className="h-4 w-4" />;
                                    case 'bluetooth': return <Bluetooth className="h-4 w-4" />;
                                    // 数据权限
                                    case 'storage': return <HardDrive className="h-4 w-4" />;
                                    case 'contacts': return <Users className="h-4 w-4" />;
                                    case 'clipboard': return <ClipboardList className="h-4 w-4" />;
                                    case 'wallet_access': return <Wallet className="h-4 w-4" />;
                                    // 通知权限
                                    case 'island_notification': return <Bell className="h-4 w-4" />;
                                    case 'notification': return <Bell className="h-4 w-4" />;
                                    // 运行时权限
                                    case 'background_refresh': return <RefreshCw className="h-4 w-4" />;
                                    case 'background_activity': return <Activity className="h-4 w-4" />;
                                    case 'background_download': return <Download className="h-4 w-4" />;
                                    // AI 特定权限
                                    case 'auto_reply': return <MessageSquare className="h-4 w-4" />;
                                    case 'auto_post': return <Send className="h-4 w-4" />;
                                    case 'auto_interact': return <Zap className="h-4 w-4" />;
                                    default: return <Settings2 className="h-4 w-4" />;
                                  }
                                };

                                const getPermissionName = (type: string) => {
                                  switch (type) {
                                    // 硬件权限
                                    case 'camera': return '相机';
                                    case 'microphone': return '麦克风';
                                    case 'photo_library': return '相册';
                                    case 'location': return '位置';
                                    case 'biometric': return '生物识别';
                                    case 'bluetooth': return '蓝牙';
                                    // 数据权限
                                    case 'storage': return '存储空间';
                                    case 'contacts': return '通讯录';
                                    case 'clipboard': return '剪贴板';
                                    case 'wallet_access': return '钱包访问';
                                    // 通知权限
                                    case 'island_notification': return '灵动岛通知';
                                    case 'notification': return '系统通知';
                                    // 运行时权限
                                    case 'background_refresh': return '后台刷新';
                                    case 'background_activity': return '后台活动';
                                    case 'background_download': return '后台下载';
                                    // AI 特定权限
                                    case 'auto_reply': return '自动回复';
                                    case 'auto_post': return '自动发帖';
                                    case 'auto_interact': return '自动互动';
                                    default: return type;
                                  }
                                };

                                const getPermissionDescription = (type: string) => {
                                  switch (type) {
                                    // 硬件权限
                                    case 'camera': return '允许应用使用相机拍照或录像';
                                    case 'microphone': return '允许应用录制音频';
                                    case 'photo_library': return '允许应用访问和选择相册中的照片/视频';
                                    case 'location': return '允许应用获取设备位置信息';
                                    case 'biometric': return '允许应用使用指纹/面部识别';
                                    case 'bluetooth': return '允许应用使用蓝牙功能';
                                    // 数据权限
                                    case 'storage': return '允许应用读写本地存储';
                                    case 'contacts': return '允许应用访问通讯录';
                                    case 'clipboard': return '允许应用访问剪贴板内容';
                                    case 'wallet_access': return '允许应用访问钱包/支付信息';
                                    // 通知权限
                                    case 'island_notification': return '允许应用发送灵动岛通知';
                                    case 'notification': return '允许应用发送普通系统通知';
                                    // 运行时权限
                                    case 'background_refresh': return '允许应用在后台刷新数据';
                                    case 'background_activity': return '允许应用在后台持续运行';
                                    case 'background_download': return '允许应用在后台下载文件';
                                    // AI 特定权限
                                    case 'auto_reply': return '允许 AI 自动回复消息';
                                    case 'auto_post': return '允许 AI 自动发布内容';
                                    case 'auto_interact': return '允许 AI 自动点赞/评论/转发';
                                    default: return '';
                                  }
                                };

                                return (
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
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>

              {/* AI 分身权限管理 - 仅真人模式显示 */}
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
                            <Switch
                              checked={avatar.is_active}
                              onCheckedChange={() =>
                                toggleAIAvatarActive(avatar.id, avatar.is_active)
                              }
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/ai-permission/${avatar.id}`)}
                            >
                              <Settings2 className="h-4 w-4 mr-1" />
                              编辑权限
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 账号安全 Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>账号安全</CardTitle>
                <CardDescription>管理您的账号安全设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isAIAvatar && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">登录邮箱</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userEmail}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        邮箱不可修改
                      </p>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>修改密码</Label>
                        <p className="text-sm text-muted-foreground">更改您的登录密码</p>
                      </div>
                      <Button variant="outline">
                        <Lock className="mr-2 h-4 w-4" />
                        修改密码
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>两步验证</Label>
                        <p className="text-sm text-muted-foreground">为账号添加额外的安全保护</p>
                      </div>
                      <Switch />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ImageCropDialog
          open={showCropDialog}
          onClose={() => setShowCropDialog(false)}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
        />
      </div>
    </div>
  );
}
