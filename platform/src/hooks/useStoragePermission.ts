import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface StorageEstimate {
  quota: number;      // 总配额（字节）
  usage: number;      // 已使用（字节）
  usagePercentage: number; // 使用百分比
  quotaFormatted: string;  // 格式化的配额
  usageFormatted: string;  // 格式化的使用量
}

interface UseStoragePermissionReturn {
  isSupported: boolean;
  estimate: StorageEstimate | null;
  loading: boolean;
  refreshEstimate: () => Promise<void>;
}

/**
 * 存储空间权限管理 Hook
 * 
 * 使用 Storage API 检查存储配额和使用情况
 * 
 * @returns {UseStoragePermissionReturn} 存储状态和操作方法
 * 
 * @example
 * ```tsx
 * const { isSupported, estimate, refreshEstimate } = useStoragePermission();
 * 
 * if (estimate) {
 *   console.log(`已使用: ${estimate.usageFormatted}`);
 *   console.log(`总配额: ${estimate.quotaFormatted}`);
 *   console.log(`使用率: ${estimate.usagePercentage}%`);
 * }
 * ```
 */
export function useStoragePermission(): UseStoragePermissionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 格式化字节数为人类可读格式
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  /**
   * 刷新存储估算数据
   */
  const refreshEstimate = async (): Promise<void> => {
    if (!isSupported) {
      return;
    }

    setLoading(true);
    
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const storageEstimate = await navigator.storage.estimate();
        
        const quota = storageEstimate.quota || 0;
        const usage = storageEstimate.usage || 0;
        const usagePercentage = quota > 0 ? Math.round((usage / quota) * 100) : 0;
        
        setEstimate({
          quota,
          usage,
          usagePercentage,
          quotaFormatted: formatBytes(quota),
          usageFormatted: formatBytes(usage),
        });
      }
    } catch (error) {
      console.error('获取存储估算失败:', error);
      toast.error('获取存储信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 检查浏览器是否支持 Storage API
    const checkSupport = () => {
      const hasStorage = 'storage' in navigator;
      const hasEstimate = hasStorage && 'estimate' in navigator.storage;
      
      setIsSupported(hasEstimate);
      
      if (!hasEstimate) {
        setLoading(false);
      }
    };

    checkSupport();
  }, []);

  // 初始加载存储估算
  useEffect(() => {
    if (isSupported) {
      refreshEstimate();
    }
  }, [isSupported]);

  return {
    isSupported,
    estimate,
    loading,
    refreshEstimate,
  };
}
