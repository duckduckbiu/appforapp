import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PermissionMode } from "@/lib/permissionConfig";
import { PermissionRequestDialog } from "@/components/permissions/PermissionRequestDialog";
import { ContentPortalContext } from "@/components/layout/ContentSandbox";
import type { Session } from "@supabase/supabase-js";

interface PendingPermissionRequest {
  appId: string;
  appName: string;
  permissionType: string;
  permissionName: string;
  permissionDescription: string;
  resolve: (value: boolean) => void;
}

export interface AppPermission {
  id: string;
  user_id: string;
  app_id: string;
  app_name: string;
  app_icon?: string;
  permission_type: string;
  is_enabled: boolean; // 保留用于向后兼容
  permission_mode: PermissionMode;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface GroupedAppPermissions {
  app_id: string;
  app_name: string;
  app_icon?: string;
  permissions: AppPermission[];
}

interface AppPermissionsContextType {
  permissions: AppPermission[];
  groupedPermissions: GroupedAppPermissions[];
  loading: boolean;
  updatePermission: (appId: string, permissionType: string, enabled: boolean) => Promise<void>;
  updatePermissionMode: (appId: string, permissionType: string, mode: PermissionMode) => Promise<void>;
  initializePermission: (
    appId: string, 
    appName: string, 
    permissionType: string, 
    enabled: boolean,
    appIcon?: string,
    defaultMode?: PermissionMode
  ) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  checkPermission: (appId: string, permissionType: string) => Promise<boolean>;
  requestPermission: (appId: string, appName: string, permissionType: string, permissionName: string, permissionDescription: string) => Promise<boolean>;
}

const AppPermissionsContext = createContext<AppPermissionsContextType | undefined>(undefined);

export const AppPermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<PendingPermissionRequest | null>(null);
  const { toast } = useToast();
  const portalContainer = useContext(ContentPortalContext);
  
  // 缓存 session，避免重复调用 getSession
  const cachedSessionRef = useRef<Session | null>(null);
  
  // 获取缓存的 session（同步，无 API 调用）
  const getCachedSession = useCallback(() => cachedSessionRef.current, []);

  const groupPermissionsByApp = (perms: AppPermission[]): GroupedAppPermissions[] => {
    const grouped = perms.reduce((acc, perm) => {
      if (!acc[perm.app_id]) {
        acc[perm.app_id] = {
          app_id: perm.app_id,
          app_name: perm.app_name,
          app_icon: perm.app_icon,
          permissions: [],
        };
      }
      acc[perm.app_id].permissions.push(perm);
      return acc;
    }, {} as Record<string, GroupedAppPermissions>);

    return Object.values(grouped);
  };

  const refreshPermissions = async () => {
    try {
      const session = getCachedSession();
      if (!session?.user) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("app_permissions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("app_name", { ascending: true })
        .order("priority", { ascending: false });

      if (error) throw error;

      // 类型转换和默认值处理
      const typedData = (data || []).map(perm => ({
        ...perm,
        permission_mode: (perm.permission_mode || 'never_allow') as PermissionMode
      }));

      setPermissions(typedData);
    } catch (error) {
      console.error("Error fetching app permissions:", error);
      toast({
        title: "加载失败",
        description: "无法加载应用权限设置",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializePermission = async (
    appId: string, 
    appName: string, 
    permissionType: string, 
    enabled: boolean,
    appIcon?: string,
    defaultMode?: PermissionMode
  ) => {
    try {
      const session = getCachedSession();
      if (!session?.user) throw new Error("未登录");

      // 使用 defaultMode 或根据 enabled 确定模式
      const mode = defaultMode || (enabled ? 'always_allow' : 'never_allow');

      const { error } = await supabase
        .from("app_permissions")
        .insert({
          user_id: session.user.id,
          app_id: appId,
          app_name: appName,
          app_icon: appIcon,
          permission_type: permissionType,
          is_enabled: mode === 'always_allow',
          permission_mode: mode,
        });

      if (error) throw error;

      await refreshPermissions();
    } catch (error) {
      console.error("Error initializing app permission:", error);
      throw error;
    }
  };

  const updatePermission = async (appId: string, permissionType: string, enabled: boolean) => {
    const mode: PermissionMode = enabled ? 'always_allow' : 'never_allow';
    await updatePermissionMode(appId, permissionType, mode);
  };

  const updatePermissionMode = async (appId: string, permissionType: string, mode: PermissionMode) => {
    try {
      const session = getCachedSession();
      if (!session?.user) throw new Error("未登录");

      // 获取旧值
      const { data: oldPermission } = await supabase
        .from("app_permissions")
        .select("permission_mode, is_enabled")
        .eq("user_id", session.user.id)
        .eq("app_id", appId)
        .eq("permission_type", permissionType)
        .maybeSingle();

      const { error } = await supabase
        .from("app_permissions")
        .update({ 
          permission_mode: mode,
          is_enabled: mode === 'always_allow',
        })
        .eq("user_id", session.user.id)
        .eq("app_id", appId)
        .eq("permission_type", permissionType);

      if (error) throw error;

      // 记录审计日志
      if (oldPermission) {
        await supabase.rpc("log_permission_change", {
          p_user_id: session.user.id,
          p_avatar_id: null,
          p_app_id: appId,
          p_permission_type: permissionType,
          p_action_type: "update_mode",
          p_old_value: { permission_mode: oldPermission.permission_mode, is_enabled: oldPermission.is_enabled },
          p_new_value: { permission_mode: mode, is_enabled: mode === 'always_allow' },
        });
      }

      toast({
        title: "权限已更新",
        description: `权限设置已更改`,
      });

      await refreshPermissions();
    } catch (error) {
      console.error("Error updating app permission:", error);
      toast({
        title: "更新失败",
        description: "无法更新权限设置",
        variant: "destructive",
      });
    }
  };

  const checkPermission = useCallback(async (appId: string, permissionType: string): Promise<boolean> => {
    try {
      const session = getCachedSession();
      if (!session?.user) return false;

      const { data, error } = await supabase
        .from("app_permissions")
        .select("permission_mode")
        .eq("user_id", session.user.id)
        .eq("app_id", appId)
        .eq("permission_type", permissionType)
        .maybeSingle();

      if (error || !data) return false;

      const mode = data.permission_mode as PermissionMode;

      switch (mode) {
        case 'always_allow':
          return true;
        case 'never_allow':
          return false;
        case 'allow_once': {
          // 检查是否有有效的会话权限
          const { data: sessionData } = await supabase
            .from("session_permissions")
            .select("*")
            .eq("user_id", session.user.id)
            .eq("app_id", appId)
            .eq("permission_type", permissionType)
            .maybeSingle();

          if (sessionData) {
            if (sessionData.expires_at) {
              const isExpired = new Date(sessionData.expires_at) < new Date();
              if (!isExpired) return true;
              // 清理过期的会话权限
              await supabase
                .from("session_permissions")
                .delete()
                .eq("id", sessionData.id);
            }
          }
          // 会话权限不存在或已过期，需要请求
          return false;
        }
        case 'ask_every_time':
        case 'allow_while_using':
          // 这些模式需要运行时请求，返回 false 触发请求流程
          return false;
        default:
          return false;
      }
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (
    appId: string,
    appName: string,
    permissionType: string,
    permissionName: string,
    permissionDescription: string
  ): Promise<boolean> => {
    try {
      const session = getCachedSession();
      if (!session?.user) return false;

      // 检查当前权限模式
      const { data } = await supabase
        .from("app_permissions")
        .select("permission_mode")
        .eq("user_id", session.user.id)
        .eq("app_id", appId)
        .eq("permission_type", permissionType)
        .maybeSingle();

      // 如果权限记录不存在，自动初始化
      if (!data) {
        console.log(`Permission record not found for ${appId} + ${permissionType}, auto-initializing...`);
        
        // 默认使用 ask_every_time 模式
        const defaultMode: PermissionMode = 'ask_every_time';
        
        // 创建权限记录
        await supabase.from("app_permissions").insert({
          user_id: session.user.id,
          app_id: appId,
          app_name: appName,
          permission_type: permissionType,
          permission_mode: defaultMode,
          is_enabled: false,
        });
        
        // 刷新权限列表
        await refreshPermissions();
        
        // 显示权限请求对话框
        return new Promise<boolean>((resolve) => {
          setPendingRequest({
            appId,
            appName,
            permissionType,
            permissionName,
            permissionDescription,
            resolve,
          });
        });
      }

      const mode = data.permission_mode as PermissionMode;

      // 如果是 always_allow，直接返回 true
      if (mode === 'always_allow') return true;
      
      // 如果是 never_allow，直接返回 false
      if (mode === 'never_allow') return false;

      // 对于 ask_every_time, allow_once, allow_while_using，显示请求对话框
      return new Promise<boolean>((resolve) => {
        setPendingRequest({
          appId,
          appName,
          permissionType,
          permissionName,
          permissionDescription,
          resolve,
        });
      });
    } catch (error) {
      console.error("Error requesting permission:", error);
      return false;
    }
  }, []);

  const handlePermissionAllow = useCallback(async () => {
    if (!pendingRequest) return;

    try {
      const session = getCachedSession();
      if (!session?.user) {
        pendingRequest.resolve(false);
        setPendingRequest(null);
        return;
      }

      // 更新为 always_allow
      await updatePermissionMode(pendingRequest.appId, pendingRequest.permissionType, 'always_allow');
      
      toast({
        title: "权限已授予",
        description: `${pendingRequest.appName} 现在可以访问 ${pendingRequest.permissionName}`,
      });

      pendingRequest.resolve(true);
      setPendingRequest(null);
    } catch (error) {
      console.error("Error allowing permission:", error);
      pendingRequest.resolve(false);
      setPendingRequest(null);
    }
  }, [pendingRequest, updatePermissionMode, toast]);

  const handlePermissionAllowOnce = useCallback(async () => {
    if (!pendingRequest) return;

    try {
      const session = getCachedSession();
      if (!session?.user) {
        pendingRequest.resolve(false);
        setPendingRequest(null);
        return;
      }

      // 创建会话权限，30分钟后过期
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      await supabase
        .from("session_permissions")
        .insert({
          user_id: session.user.id,
          app_id: pendingRequest.appId,
          permission_type: pendingRequest.permissionType,
          expires_at: expiresAt.toISOString(),
        });

      toast({
        title: "权限已授予（本次有效）",
        description: `${pendingRequest.appName} 在接下来 30 分钟内可以访问 ${pendingRequest.permissionName}`,
      });

      pendingRequest.resolve(true);
      setPendingRequest(null);
    } catch (error) {
      console.error("Error allowing permission once:", error);
      pendingRequest.resolve(false);
      setPendingRequest(null);
    }
  }, [pendingRequest, toast]);

  const handlePermissionDeny = useCallback(() => {
    if (!pendingRequest) return;

    toast({
      title: "权限已拒绝",
      description: `${pendingRequest.appName} 无法访问 ${pendingRequest.permissionName}`,
    });

    pendingRequest.resolve(false);
    setPendingRequest(null);
  }, [pendingRequest, toast]);

  // 初始化 session 缓存并设置监听
  useEffect(() => {
    // 先设置监听器
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedSessionRef.current = session;
      // 当认证状态变化时刷新权限
      if (session?.user) {
        refreshPermissions();
      } else {
        setPermissions([]);
        setLoading(false);
      }
    });

    // 然后获取当前 session（从 localStorage 读取，速度快）
    supabase.auth.getSession().then(({ data: { session } }) => {
      cachedSessionRef.current = session;
      if (session?.user) {
        refreshPermissions();
      } else {
        setLoading(false);
      }
    });

    // 订阅实时更新
    const setupSubscription = () => {
      const session = cachedSessionRef.current;
      if (!session?.user) return () => {};

      const channel = supabase
        .channel("app_permissions_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "app_permissions",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            refreshPermissions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupSubscription = setupSubscription();
    
    return () => {
      subscription.unsubscribe();
      cleanupSubscription();
    };
  }, []);

  const groupedPermissions = groupPermissionsByApp(permissions);

  // 使用 Portal 将弹窗渲染到 ContentSandbox 内部，避免遮挡顶部栏和侧边栏
  const permissionDialog = pendingRequest && (
    <PermissionRequestDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          handlePermissionDeny();
        }
      }}
      appName={pendingRequest.appName}
      permissionName={pendingRequest.permissionName}
      permissionDescription={pendingRequest.permissionDescription}
      onAllow={handlePermissionAllow}
      onDeny={handlePermissionDeny}
      onAllowOnce={handlePermissionAllowOnce}
    />
  );

  return (
    <AppPermissionsContext.Provider
      value={{
        permissions,
        groupedPermissions,
        loading,
        updatePermission,
        updatePermissionMode,
        initializePermission,
        refreshPermissions,
        checkPermission,
        requestPermission,
      }}
    >
      {children}
      {/* 运行时权限请求对话框 - 使用 Portal 渲染到内容区 */}
      {portalContainer && permissionDialog ? createPortal(permissionDialog, portalContainer) : null}
    </AppPermissionsContext.Provider>
  );
};

export const useAppPermissions = () => {
  const context = useContext(AppPermissionsContext);
  if (context === undefined) {
    throw new Error("useAppPermissions must be used within AppPermissionsProvider");
  }
  return context;
};