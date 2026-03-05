import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAudioUrlReturn {
  url: string | null;
  loading: boolean;
  error: string | null;
}

const urlCache = new Map<string, { url: string; expiry: number }>();

export function useAudioUrl(filePath: string | null): UseAudioUrlReturn {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        // 检查缓存
        const cached = urlCache.get(filePath);
        if (cached && cached.expiry > Date.now()) {
          setUrl(cached.url);
          setLoading(false);
          return;
        }

        // 生成签名 URL（1小时有效期）
        const { data, error } = await supabase.storage
          .from('message-files')
          .createSignedUrl(filePath, 3600); // 3600秒 = 1小时

        if (error) throw error;

        if (data?.signedUrl) {
          // signedUrl 已经是完整的 URL，直接使用
          const fullUrl = data.signedUrl;
          
          // 缓存 URL（提前5分钟过期以确保安全）
          urlCache.set(filePath, {
            url: fullUrl,
            expiry: Date.now() + 55 * 60 * 1000, // 55分钟
          });
          setUrl(fullUrl);
        }
      } catch (err) {
        console.error('获取语音文件失败:', err);
        setError('无法加载语音文件');
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [filePath]);

  return { url, loading, error };
}
