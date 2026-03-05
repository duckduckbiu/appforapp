import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export type ClipboardPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface UseClipboardPermissionReturn {
  permission: ClipboardPermissionStatus;
  isSupported: boolean;
  canRead: boolean;
  canWrite: boolean;
  checkPermission: () => Promise<ClipboardPermissionStatus>;
  readText: () => Promise<string | null>;
  writeText: (text: string) => Promise<boolean>;
}

/**
 * 剪贴板权限管理 Hook
 * 
 * 使用 Clipboard API 管理剪贴板读写权限
 * 
 * @returns {UseClipboardPermissionReturn} 权限状态和操作方法
 * 
 * @example
 * ```tsx
 * const { canRead, canWrite, readText, writeText } = useClipboardPermission();
 * 
 * // 读取剪贴板
 * const text = await readText();
 * 
 * // 写入剪贴板
 * await writeText("Hello World");
 * ```
 */
export function useClipboardPermission(): UseClipboardPermissionReturn {
  const [permission, setPermission] = useState<ClipboardPermissionStatus>('prompt');
  const [isSupported, setIsSupported] = useState(false);
  const [canRead, setCanRead] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    // 检查浏览器是否支持 Clipboard API
    const checkSupport = () => {
      const hasClipboard = 'clipboard' in navigator;
      const hasRead = hasClipboard && 'readText' in navigator.clipboard;
      const hasWrite = hasClipboard && 'writeText' in navigator.clipboard;
      
      setIsSupported(hasClipboard);
      setCanRead(hasRead);
      setCanWrite(hasWrite);
      
      if (!hasClipboard) {
        setPermission('unsupported');
      }
    };

    checkSupport();
  }, []);

  /**
   * 检查剪贴板权限状态
   */
  const checkPermission = async (): Promise<ClipboardPermissionStatus> => {
    if (!isSupported) {
      return 'unsupported';
    }

    // Clipboard API 不需要显式请求权限
    // 权限检查在实际使用时进行
    try {
      if ('permissions' in navigator) {
        // 检查读取权限
        const readPermission = await navigator.permissions.query({ 
          name: 'clipboard-read' as PermissionName 
        });
        
        // 检查写入权限
        const writePermission = await navigator.permissions.query({ 
          name: 'clipboard-write' as PermissionName 
        });
        
        if (readPermission.state === 'granted' || writePermission.state === 'granted') {
          setPermission('granted');
          return 'granted';
        } else if (readPermission.state === 'denied' && writePermission.state === 'denied') {
          setPermission('denied');
          return 'denied';
        } else {
          setPermission('prompt');
          return 'prompt';
        }
      } else {
        // 如果不支持 permissions API，假设需要提示
        setPermission('prompt');
        return 'prompt';
      }
    } catch (error) {
      // 某些浏览器不支持 clipboard-read/write 权限查询
      // 静默失败，在实际使用时检查
      setPermission('prompt');
      return 'prompt';
    }
  };

  /**
   * 读取剪贴板文本
   */
  const readText = async (): Promise<string | null> => {
    if (!isSupported || !canRead) {
      toast.error('您的浏览器不支持读取剪贴板');
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();
      setPermission('granted');
      return text;
    } catch (error) {
      console.error('读取剪贴板失败:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermission('denied');
          toast.error('剪贴板读取权限被拒绝');
        } else {
          toast.error('读取剪贴板失败');
        }
      } else {
        toast.error('读取剪贴板失败');
      }
      
      return null;
    }
  };

  /**
   * 写入文本到剪贴板
   */
  const writeText = async (text: string): Promise<boolean> => {
    if (!isSupported || !canWrite) {
      toast.error('您的浏览器不支持写入剪贴板');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setPermission('granted');
      toast.success('已复制到剪贴板');
      return true;
    } catch (error) {
      console.error('写入剪贴板失败:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermission('denied');
          toast.error('剪贴板写入权限被拒绝');
        } else {
          toast.error('写入剪贴板失败');
        }
      } else {
        toast.error('写入剪贴板失败');
      }
      
      return false;
    }
  };

  // 初始检查权限
  useEffect(() => {
    if (isSupported) {
      checkPermission();
    }
  }, [isSupported]);

  return {
    permission,
    isSupported,
    canRead,
    canWrite,
    checkPermission,
    readText,
    writeText,
  };
}
