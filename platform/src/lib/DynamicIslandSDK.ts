import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "@/contexts/NotificationContext";

export interface IslandNotification extends Omit<Notification, 'id'> {
  appId: string;
  icon?: React.ReactNode;
  priority?: number;
  duration?: number;
}

export interface AppRegistration {
  appId: string;
  appName: string;
}

class DynamicIslandSDK {
  private static instance: DynamicIslandSDK;
  private notificationCallback?: (notification: Notification) => void;

  private constructor() {}

  static getInstance(): DynamicIslandSDK {
    if (!DynamicIslandSDK.instance) {
      DynamicIslandSDK.instance = new DynamicIslandSDK();
    }
    return DynamicIslandSDK.instance;
  }

  /**
   * 注册应用到灵动岛系统 (使用 app_permissions 表)
   */
  async registerApp(userId: string, appId: string, appName: string): Promise<void> {
    const { error } = await supabase
      .from('app_permissions')
      .upsert({
        user_id: userId,
        app_id: appId,
        app_name: appName,
        permission_type: 'island_notification',
        permission_mode: 'never_allow', // 默认未启用，等待用户授权
      }, {
        onConflict: 'user_id,app_id,permission_type'
      });

    if (error) {
      console.error('Failed to register app:', error);
      throw error;
    }
  }

  /**
   * 检查应用是否已授权 (使用 app_permissions 表)
   */
  async isAuthorized(userId: string, appId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('app_permissions')
      .select('permission_mode')
      .eq('user_id', userId)
      .eq('app_id', appId)
      .eq('permission_type', 'island_notification')
      .maybeSingle();

    if (error) {
      console.error('Failed to check authorization:', error);
      return false;
    }

    // 只有 always_allow 或 allow_while_using 才算授权
    return data?.permission_mode === 'always_allow' || data?.permission_mode === 'allow_while_using';
  }

  /**
   * 发送通知到灵动岛
   */
  async notify(userId: string, notification: IslandNotification): Promise<void> {
    // 检查应用是否已授权
    const authorized = await this.isAuthorized(userId, notification.appId);
    
    if (!authorized) {
      console.warn(`App ${notification.appId} is not authorized to send notifications`);
      return;
    }

    // 触发通知回调
    if (this.notificationCallback) {
      this.notificationCallback({
        id: crypto.randomUUID(),
        ...notification,
      });
    }
  }

  /**
   * 设置通知回调（由 NotificationContext 调用）
   */
  setNotificationCallback(callback: (notification: Notification) => void): void {
    this.notificationCallback = callback;
  }
}

export const islandSDK = DynamicIslandSDK.getInstance();
