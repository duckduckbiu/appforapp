import { useState, useEffect, useCallback, useRef } from 'react';

interface CameraPermissionState {
  isSupported: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported';
  isStreaming: boolean;
  error: string | null;
  isInitialized: boolean;
}

export const useCameraPermission = () => {
  const [state, setState] = useState<CameraPermissionState>({
    isSupported: false,
    permissionStatus: 'unsupported',
    isStreaming: false,
    error: null,
    isInitialized: false,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  // 使用 ref 跟踪 stream，避免闭包和竞态条件问题
  const streamRef = useRef<MediaStream | null>(null);

  // 检查浏览器支持
  useEffect(() => {
    const checkSupport = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState(prev => ({ 
          ...prev, 
          isSupported: false, 
          permissionStatus: 'unsupported',
          isInitialized: true 
        }));
        return;
      }

      setState(prev => ({ ...prev, isSupported: true }));

      // 检查权限状态
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setState(prev => ({ 
            ...prev, 
            permissionStatus: result.state as any,
            isInitialized: true 
          }));

          result.addEventListener('change', () => {
            setState(prev => ({ ...prev, permissionStatus: result.state as any }));
          });
        } else {
          setState(prev => ({ 
            ...prev, 
            permissionStatus: 'prompt',
            isInitialized: true 
          }));
        }
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          permissionStatus: 'prompt',
          isInitialized: true 
        }));
      }
    };

    checkSupport();
  }, []);

  // 请求相机权限并开启预览
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // 等待初始化完成
    if (!state.isInitialized) {
      console.log('Camera not initialized yet, waiting...');
      return false;
    }

    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: '当前浏览器不支持相机访问' }));
      return false;
    }

    // 如果已经有活跃的流，直接返回 true
    if (streamRef.current) {
      console.log('Camera stream already exists, reusing...');
      return true;
    }

    try {
      console.log('Requesting camera permission...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log('Camera permission granted, stream obtained');
      // 同时更新 ref 和 state
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setState(prev => ({ 
        ...prev, 
        permissionStatus: 'granted',
        isStreaming: true,
        error: null 
      }));
      return true;
    } catch (error: any) {
      console.error('Camera permission denied:', error);
      const errorMessage = error.name === 'NotAllowedError' 
        ? '相机权限被拒绝，请在浏览器设置中允许相机访问'
        : error.message || '相机访问失败';
      
      setState(prev => ({ 
        ...prev, 
        permissionStatus: 'denied',
        error: errorMessage
      }));
      return false;
    }
  }, [state.isInitialized, state.isSupported]);

  // 停止相机流 - 使用 ref 避免依赖问题
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      console.log('Stopping camera stream...');
      streamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      streamRef.current = null;
      setStream(null);
      setState(prev => ({ ...prev, isStreaming: false }));
    }
  }, []); // 无依赖项，避免闭包问题

  // 拍照
  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!stream) {
      setState(prev => ({ ...prev, error: '相机未开启' }));
      return null;
    }

    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('无法创建canvas上下文');
      }

      ctx.drawImage(video, 0, 0);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '拍照失败' }));
      return null;
    }
  }, [stream]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        console.log('Cleaning up camera stream on unmount...');
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    ...state,
    stream,
    requestPermission,
    stopCamera,
    takePhoto,
  };
};
