import { useNavigate } from "react-router-dom";
import { ChevronLeft, Send, Copy, HardDrive, RefreshCw, Camera, Mic, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppPermissions } from "@/contexts/AppPermissionsContext";
import { allPermissions, allApps, PermissionMode } from "@/lib/permissionConfig";
import { PermissionModeSelector } from "@/components/permissions/PermissionModeSelector";
import { PermissionStatusBadge } from "@/components/permissions/PermissionStatusBadge";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useClipboardPermission } from "@/hooks/useClipboardPermission";
import { useStoragePermission } from "@/hooks/useStoragePermission";
import { useCameraPermission } from "@/hooks/useCameraPermission";
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PermissionsList() {
  const navigate = useNavigate();
  const { permissions, loading, updatePermission, updatePermissionMode, initializePermission } = useAppPermissions();
  const { permission: notificationPermission, isSupported: notificationSupported, requestPermission, sendTestNotification } = useNotificationPermission();
  const { permission: clipboardPermission, isSupported: clipboardSupported, canRead: clipboardCanRead, canWrite: clipboardCanWrite, readText, writeText } = useClipboardPermission();
  const { isSupported: storageSupported, estimate: storageEstimate, loading: storageLoading, refreshEstimate } = useStoragePermission();
  const { isSupported: cameraSupported, permissionStatus: cameraPermissionStatus, isStreaming: cameraIsStreaming, requestPermission: requestCameraPermission, stopCamera } = useCameraPermission();
  const { isSupported: microphoneSupported, permissionStatus: microphonePermissionStatus, isRecording: microphoneIsRecording, requestPermission: requestMicrophonePermission, stopMicrophone } = useMicrophonePermission();
  const { isSupported: locationSupported, permissionStatus: locationPermissionStatus, location, getCurrentLocation, formatLocation } = useLocationPermission();
  const [permissionStats, setPermissionStats] = useState<Record<string, number>>({});
  const [appStats, setAppStats] = useState<Record<string, number>>({});

  // 计算统计数据
  useEffect(() => {
    const permStats: Record<string, number> = {};
    const appSts: Record<string, number> = {};

    permissions.forEach((perm) => {
      // 统计每个权限被多少应用使用（使用 permission_mode）
      if (perm.permission_mode === 'always_allow' || perm.permission_mode === 'allow_while_using') {
        permStats[perm.permission_type] = (permStats[perm.permission_type] || 0) + 1;
      }
      
      // 统计每个应用开启了多少权限
      if (perm.permission_mode === 'always_allow' || perm.permission_mode === 'allow_while_using') {
        appSts[perm.app_id] = (appSts[perm.app_id] || 0) + 1;
      }
    });

    setPermissionStats(permStats);
    setAppStats(appSts);
  }, [permissions]);

  // 获取或初始化权限
  const getOrInitPermission = async (appId: string, appName: string, appIcon: string, permissionType: string) => {
    const existing = permissions.find(
      (p) => p.app_id === appId && p.permission_type === permissionType
    );
    
    if (!existing) {
      // 如果权限不存在，使用配置中的 defaultMode 初始化
      const permConfig = allPermissions.find(p => p.id === permissionType);
      const defaultMode = permConfig?.defaultMode || 'never_allow';
      await initializePermission(appId, appName, permissionType, false, appIcon, defaultMode);
      return false;
    }
    
    return existing.permission_mode === 'always_allow' || existing.permission_mode === 'allow_while_using';
  };

  // 切换权限状态
  const togglePermission = async (appId: string, appName: string, permissionType: string, currentEnabled: boolean) => {
    // 如果是通知权限，需要先请求浏览器权限
    if (permissionType === 'notification' && !currentEnabled) {
      if (!notificationSupported) {
        toast.error('您的浏览器不支持系统通知');
        return;
      }
      
      const result = await requestPermission();
      if (result !== 'granted') {
        // 浏览器权限被拒绝，不更新数据库
        return;
      }
    }
    
    // 如果是剪贴板权限，检查浏览器支持
    if (permissionType === 'clipboard' && !currentEnabled) {
      if (!clipboardSupported) {
        toast.error('您的浏览器不支持剪贴板 API');
        return;
      }
      // Clipboard API 在实际使用时才检查权限，这里仅提示
      toast.info('剪贴板权限将在首次使用时请求授权');
    }
    
    // 如果是存储权限，检查浏览器支持
    if (permissionType === 'storage' && !currentEnabled) {
      if (!storageSupported) {
        toast.error('您的浏览器不支持存储 API');
        return;
      }
    }
    
    // 如果是相机权限，需要先请求浏览器权限
    if (permissionType === 'camera' && !currentEnabled) {
      if (!cameraSupported) {
        toast.error('您的浏览器不支持相机访问');
        return;
      }
      const result = await requestCameraPermission();
      if (!result) {
        return;
      }
    }
    
    // 如果是麦克风权限，需要先请求浏览器权限
    if (permissionType === 'microphone' && !currentEnabled) {
      if (!microphoneSupported) {
        toast.error('您的浏览器不支持麦克风访问');
        return;
      }
      const result = await requestMicrophonePermission();
      if (!result) {
        return;
      }
    }
    
    // 如果是位置权限，需要先请求浏览器权限
    if (permissionType === 'location' && !currentEnabled) {
      if (!locationSupported) {
        toast.error('您的浏览器不支持地理位置访问');
        return;
      }
      const result = await getCurrentLocation();
      if (!result) {
        return;
      }
      toast.success('位置权限已授权');
    }
    
    const existing = permissions.find(
      (p) => p.app_id === appId && p.permission_type === permissionType
    );
    
    if (!existing) {
      await initializePermission(appId, appName, permissionType, !currentEnabled);
    } else {
      await updatePermission(appId, permissionType, !currentEnabled);
    }
  };

  // 按分类分组权限
  const groupedByCategory = allPermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof allPermissions>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部标题栏 */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">权限管理</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* 标签页 */}
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b bg-background">
          <TabsTrigger value="permissions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            权限
          </TabsTrigger>
          <TabsTrigger value="apps" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            应用
          </TabsTrigger>
        </TabsList>

        {/* 权限视角：按权限类型分组 */}
        <TabsContent value="permissions" className="mt-0 p-4 space-y-4">
          {Object.entries(groupedByCategory).map(([category, perms]) => (
            <Card key={category} className="overflow-hidden bg-card/50">
              <div className="px-4 py-2 bg-muted/30">
                <h3 className="text-sm font-medium text-muted-foreground">{category}</h3>
              </div>
              <Accordion type="multiple" className="w-full">
                {perms.map((permission) => {
                  // 找到使用该权限的应用
                  const appsUsingPermission = allApps.filter((app) =>
                    app.permissions.includes(permission.id)
                  );
                  const enabledCount = permissionStats[permission.id] || 0;

                  return (
                    <AccordionItem key={permission.id} value={permission.id} className="border-b last:border-b-0">
                      <AccordionTrigger className={`px-4 py-3 hover:bg-muted/50 ${permission.unsupported ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <div className="text-muted-foreground">
                              {permission.icon}
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{permission.name}</div>
                                {permission.unsupported && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    {permission.unsupportedReason}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{permission.description}</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {enabledCount}/{appsUsingPermission.length} 应用
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-2 pt-2">
                          {appsUsingPermission.map((app) => {
                            const perm = permissions.find(
                              (p) => p.app_id === app.id && p.permission_type === permission.id
                            );
                            const isEnabled = perm?.is_enabled || false;
                            
                            // 检查是否为特殊权限类型，显示浏览器权限状态
                            const isNotificationPerm = permission.id === 'notification';
                            const isClipboardPerm = permission.id === 'clipboard';
                            const isStoragePerm = permission.id === 'storage';
                            const isCameraPerm = permission.id === 'camera';
                            const isMicrophonePerm = permission.id === 'microphone';
                            const isLocationPerm = permission.id === 'location';
                            
                            const showNotificationStatus = isNotificationPerm && notificationSupported;
                            const showClipboardStatus = isClipboardPerm && clipboardSupported;
                            const showStorageStatus = isStoragePerm && storageSupported;
                            const showCameraStatus = isCameraPerm && cameraSupported;
                            const showMicrophoneStatus = isMicrophonePerm && microphoneSupported;
                            const showLocationStatus = isLocationPerm && locationSupported;

                            return (
                              <div
                                key={`${app.id}-${permission.id}`}
                                className="flex items-center justify-between p-3 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="text-muted-foreground">{app.icon}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium">{app.name}</span>
                                      {showNotificationStatus && (
                                        <PermissionStatusBadge 
                                          permissionStatus={notificationPermission}
                                          className="text-xs"
                                        />
                                      )}
                                      {showClipboardStatus && (
                                        <Badge 
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {clipboardCanRead && clipboardCanWrite ? '读写' : 
                                           clipboardCanWrite ? '仅写' : 
                                           clipboardCanRead ? '仅读' : '未授权'}
                                        </Badge>
                                      )}
                                      {showStorageStatus && storageEstimate && (
                                        <Badge 
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {storageEstimate.usagePercentage}% 已用
                                        </Badge>
                                      )}
                                      {showCameraStatus && (
                                        <PermissionStatusBadge 
                                          permissionStatus={cameraPermissionStatus}
                                          className="text-xs"
                                        />
                                      )}
                                      {showMicrophoneStatus && (
                                        <PermissionStatusBadge 
                                          permissionStatus={microphonePermissionStatus}
                                          className="text-xs"
                                        />
                                      )}
                                      {showLocationStatus && (
                                        <PermissionStatusBadge 
                                          permissionStatus={locationPermissionStatus}
                                          className="text-xs"
                                        />
                                      )}
                                    </div>
                                    
                                    {/* 通知权限测试按钮 */}
                                    {isNotificationPerm && isEnabled && notificationPermission === 'granted' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 mt-1 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          sendTestNotification(
                                            `来自 ${app.name} 的测试通知`,
                                            '这是一条测试通知消息'
                                          );
                                        }}
                                      >
                                        <Send className="h-3 w-3 mr-1" />
                                        发送测试
                                      </Button>
                                    )}
                                    
                                    {/* 剪贴板权限测试按钮 */}
                                    {isClipboardPerm && isEnabled && clipboardCanWrite && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 mt-1 text-xs"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const success = await writeText(`测试文本 - ${new Date().toLocaleTimeString()}`);
                                          if (success) {
                                            toast.success('已复制测试文本到剪贴板');
                                          }
                                        }}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        测试复制
                                      </Button>
                                    )}
                                    
                                    {/* 存储权限刷新按钮 */}
                                    {isStoragePerm && isEnabled && storageEstimate && (
                                      <div className="mt-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <Progress value={storageEstimate.usagePercentage} className="h-1 flex-1" />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              refreshEstimate();
                                              toast.success('存储信息已刷新');
                                            }}
                                            disabled={storageLoading}
                                          >
                                            <RefreshCw className={`h-3 w-3 ${storageLoading ? 'animate-spin' : ''}`} />
                                          </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {storageEstimate.usageFormatted} / {storageEstimate.quotaFormatted}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* 相机权限状态显示 */}
                                    {isCameraPerm && isEnabled && cameraIsStreaming && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 mt-1 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          stopCamera();
                                          toast.success('相机已关闭');
                                        }}
                                      >
                                        <Camera className="h-3 w-3 mr-1" />
                                        关闭相机
                                      </Button>
                                    )}
                                    
                                    {/* 麦克风权限状态显示 */}
                                    {isMicrophonePerm && isEnabled && microphoneIsRecording && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 mt-1 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          stopMicrophone();
                                          toast.success('麦克风已关闭');
                                        }}
                                      >
                                        <Mic className="h-3 w-3 mr-1" />
                                        关闭麦克风
                                      </Button>
                                    )}
                                    
                                    {/* 位置权限信息显示 */}
                                    {isLocationPerm && isEnabled && location && (
                                      <div className="mt-1">
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {formatLocation(location)}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <PermissionModeSelector
                                  value={perm?.permission_mode || permission.defaultMode}
                                  supportedModes={permission.supportedModes}
                                  onChange={async (mode) => {
                                    if (perm) {
                                      await updatePermissionMode(app.id, permission.id, mode);
                                    } else {
                                      await initializePermission(app.id, app.name, permission.id, mode === 'always_allow');
                                    }
                                  }}
                                  disabled={permission.unsupported}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </Card>
          ))}
        </TabsContent>

        {/* 应用视角：按应用分组 */}
        <TabsContent value="apps" className="mt-0 p-4 space-y-4">
          <Card className="overflow-hidden bg-card/50">
            <div className="px-4 py-2 bg-muted/30">
              <h3 className="text-sm font-medium text-muted-foreground">所有应用</h3>
            </div>
            <Accordion type="multiple" className="w-full">
              {allApps.map((app) => {
                const enabledCount = appStats[app.id] || 0;
                const totalCount = app.permissions.length;

                return (
                  <AccordionItem key={app.id} value={app.id} className="border-b last:border-b-0">
                    <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground">{app.icon}</div>
                          <span className="text-sm font-medium">{app.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {enabledCount}/{totalCount} 权限
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2 pt-2">
                        {app.permissions.map((permissionId) => {
                          const permissionConfig = allPermissions.find((p) => p.id === permissionId);
                          if (!permissionConfig) return null;

                          const perm = permissions.find(
                            (p) => p.app_id === app.id && p.permission_type === permissionId
                          );
                          const isEnabled = perm?.is_enabled || false;
                          
                          // 检查是否为特殊权限类型，显示浏览器权限状态
                          const isNotificationPerm = permissionId === 'notification';
                          const isClipboardPerm = permissionId === 'clipboard';
                          const isStoragePerm = permissionId === 'storage';
                          const isCameraPerm = permissionId === 'camera';
                          const isMicrophonePerm = permissionId === 'microphone';
                          const isLocationPerm = permissionId === 'location';
                          
                          const showNotificationStatus = isNotificationPerm && notificationSupported;
                          const showClipboardStatus = isClipboardPerm && clipboardSupported;
                          const showStorageStatus = isStoragePerm && storageSupported;
                          const showCameraStatus = isCameraPerm && cameraSupported;
                          const showMicrophoneStatus = isMicrophonePerm && microphoneSupported;
                          const showLocationStatus = isLocationPerm && locationSupported;

                          return (
                            <div
                              key={`${app.id}-${permissionId}`}
                              className="flex items-center justify-between p-3 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="text-muted-foreground">{permissionConfig.icon}</div>
                                <div className="text-left flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="text-sm font-medium">{permissionConfig.name}</div>
                                    {permissionConfig.unsupported && (
                                      <Badge variant="outline" className="text-xs text-muted-foreground">
                                        {permissionConfig.unsupportedReason}
                                      </Badge>
                                    )}
                                    {showNotificationStatus && (
                                      <PermissionStatusBadge 
                                        permissionStatus={notificationPermission}
                                        className="text-xs"
                                      />
                                    )}
                                    {showClipboardStatus && (
                                      <Badge 
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {clipboardCanRead && clipboardCanWrite ? '读写' : 
                                         clipboardCanWrite ? '仅写' : 
                                         clipboardCanRead ? '仅读' : '未授权'}
                                      </Badge>
                                    )}
                                    {showStorageStatus && storageEstimate && (
                                      <Badge 
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {storageEstimate.usagePercentage}% 已用
                                      </Badge>
                                    )}
                                    {showCameraStatus && (
                                      <PermissionStatusBadge 
                                        permissionStatus={cameraPermissionStatus}
                                        className="text-xs"
                                      />
                                    )}
                                    {showMicrophoneStatus && (
                                      <PermissionStatusBadge 
                                        permissionStatus={microphonePermissionStatus}
                                        className="text-xs"
                                      />
                                    )}
                                    {showLocationStatus && (
                                      <PermissionStatusBadge 
                                        permissionStatus={locationPermissionStatus}
                                        className="text-xs"
                                      />
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{permissionConfig.description}</div>
                                  
                                  {/* 通知权限测试按钮 */}
                                  {isNotificationPerm && isEnabled && notificationPermission === 'granted' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 mt-1 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sendTestNotification(
                                          `来自 ${app.name} 的测试通知`,
                                          '这是一条测试通知消息'
                                        );
                                      }}
                                    >
                                      <Send className="h-3 w-3 mr-1" />
                                      发送测试
                                    </Button>
                                  )}
                                  
                                  {/* 剪贴板权限测试按钮 */}
                                  {isClipboardPerm && isEnabled && clipboardCanWrite && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 mt-1 text-xs"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const success = await writeText(`测试文本 - ${new Date().toLocaleTimeString()}`);
                                        if (success) {
                                          toast.success('已复制测试文本到剪贴板');
                                        }
                                      }}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      测试复制
                                    </Button>
                                  )}
                                  
                                  {/* 存储权限信息显示 */}
                                  {isStoragePerm && isEnabled && storageEstimate && (
                                    <div className="mt-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Progress value={storageEstimate.usagePercentage} className="h-1 flex-1" />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            refreshEstimate();
                                            toast.success('存储信息已刷新');
                                          }}
                                          disabled={storageLoading}
                                        >
                                          <RefreshCw className={`h-3 w-3 ${storageLoading ? 'animate-spin' : ''}`} />
                                        </Button>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {storageEstimate.usageFormatted} / {storageEstimate.quotaFormatted}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* 相机权限状态显示 */}
                                  {isCameraPerm && isEnabled && cameraIsStreaming && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 mt-1 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        stopCamera();
                                        toast.success('相机已关闭');
                                      }}
                                    >
                                      <Camera className="h-3 w-3 mr-1" />
                                      关闭相机
                                    </Button>
                                  )}
                                  
                                  {/* 麦克风权限状态显示 */}
                                  {isMicrophonePerm && isEnabled && microphoneIsRecording && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 mt-1 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        stopMicrophone();
                                        toast.success('麦克风已关闭');
                                      }}
                                    >
                                      <Mic className="h-3 w-3 mr-1" />
                                      关闭麦克风
                                    </Button>
                                  )}
                                  
                                  {/* 位置权限信息显示 */}
                                  {isLocationPerm && isEnabled && location && (
                                    <div className="mt-1">
                                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {formatLocation(location)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <PermissionModeSelector
                                value={perm?.permission_mode || permissionConfig.defaultMode}
                                supportedModes={permissionConfig.supportedModes}
                                onChange={async (mode) => {
                                  if (perm) {
                                    await updatePermissionMode(app.id, permissionId, mode);
                                  } else {
                                    await initializePermission(app.id, app.name, permissionId, mode === 'always_allow');
                                  }
                                }}
                                disabled={permissionConfig.unsupported}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
