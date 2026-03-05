import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

interface UseNotificationPermissionReturn {
  permission: NotificationPermissionStatus;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermissionStatus>;
  sendTestNotification: (title: string, body: string) => void;
}

/**
 * 系统通知权限管理 Hook
 * 
 * 使用 Web Notification API 管理浏览器通知权限
 * 
 * @returns {UseNotificationPermissionReturn} 权限状态和操作方法
 * 
 * @example
 * ```tsx
 * const { permission, requestPermission, sendTestNotification } = useNotificationPermission();
 * 
 * // 请求权限
 * await requestPermission();
 * 
 * // 发送测试通知
 * sendTestNotification("测试标题", "测试内容");
 * ```
 */
export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 检查浏览器是否支持 Notification API
    if (!('Notification' in window)) {
      setIsSupported(false);
      setPermission('unsupported');
      return;
    }

    setIsSupported(true);
    setPermission(Notification.permission as NotificationPermissionStatus);

    // 监听权限变化（部分浏览器支持）
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then((permissionStatus) => {
        setPermission(permissionStatus.state as NotificationPermissionStatus);
        
        permissionStatus.onchange = () => {
          setPermission(permissionStatus.state as NotificationPermissionStatus);
        };
      }).catch(() => {
        // 某些浏览器不支持 permissions.query，静默失败
      });
    }
  }, []);

  /**
   * 请求通知权限
   */
  const requestPermission = async (): Promise<NotificationPermissionStatus> => {
    if (!isSupported) {
      toast.error('您的浏览器不支持系统通知');
      return 'unsupported';
    }

    if (permission === 'granted') {
      toast.info('通知权限已授予');
      return 'granted';
    }

    if (permission === 'denied') {
      toast.error('通知权限已被拒绝，请在浏览器设置中手动启用');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionStatus);
      
      if (result === 'granted') {
        toast.success('通知权限已授予');
      } else if (result === 'denied') {
        toast.error('通知权限被拒绝');
      }
      
      return result as NotificationPermissionStatus;
    } catch (error) {
      console.error('请求通知权限失败:', error);
      toast.error('请求通知权限失败');
      return 'denied';
    }
  };

  /**
   * 发送测试通知
   */
  const sendTestNotification = (title: string, body: string) => {
    if (!isSupported) {
      toast.error('您的浏览器不支持系统通知');
      return;
    }

    if (permission !== 'granted') {
      toast.error('请先授予通知权限');
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'test-notification',
        requireInteraction: false,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 3秒后自动关闭
      setTimeout(() => notification.close(), 3000);
      
      toast.success('测试通知已发送');
    } catch (error) {
      console.error('发送通知失败:', error);
      toast.error('发送通知失败');
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    sendTestNotification,
  };
}
