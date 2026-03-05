import { useState, useEffect, useCallback, useRef } from 'react';

interface MicrophonePermissionState {
  isSupported: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported';
  isRecording: boolean;
  error: string | null;
}

export const useMicrophonePermission = () => {
  const [state, setState] = useState<MicrophonePermissionState>({
    isSupported: false,
    permissionStatus: 'unsupported',
    isRecording: false,
    error: null,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 检查浏览器支持
  useEffect(() => {
    const checkSupport = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState(prev => ({ ...prev, isSupported: false, permissionStatus: 'unsupported' }));
        return;
      }

      setState(prev => ({ ...prev, isSupported: true }));

      // 检查权限状态
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setState(prev => ({ ...prev, permissionStatus: result.state as any }));

          result.addEventListener('change', () => {
            setState(prev => ({ ...prev, permissionStatus: result.state as any }));
          });
        } else {
          setState(prev => ({ ...prev, permissionStatus: 'prompt' }));
        }
      } catch (error) {
        setState(prev => ({ ...prev, permissionStatus: 'prompt' }));
      }
    };

    checkSupport();
  }, []);

  // 请求麦克风权限
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: '当前浏览器不支持麦克风访问' }));
      return false;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setStream(mediaStream);
      setState(prev => ({ 
        ...prev, 
        permissionStatus: 'granted',
        error: null 
      }));
      return true;
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        permissionStatus: 'denied',
        error: error.message || '麦克风访问被拒绝'
      }));
      return false;
    }
  }, [state.isSupported]);

  // 开始录音
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!stream) {
      const granted = await requestPermission();
      if (!granted || !stream) return false;
    }

    try {
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = []; // 清空之前的录音数据

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setState(prev => ({ ...prev, isRecording: true, error: null }));
      return true;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '录音启动失败' }));
      return false;
    }
  }, [stream, requestPermission]);

  // 停止录音
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setState(prev => ({ ...prev, isRecording: false }));
        audioChunksRef.current = []; // 清空录音数据
        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }, [mediaRecorder]);

  // 停止麦克风
  const stopMicrophone = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setState(prev => ({ ...prev, isRecording: false }));
  }, [stream, mediaRecorder]);

  // 清理
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    ...state,
    stream,
    requestPermission,
    startRecording,
    stopRecording,
    stopMicrophone,
  };
};
