import { useState, useEffect, useCallback } from 'react';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface LocationPermissionState {
  isSupported: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported';
  isWatching: boolean;
  location: LocationData | null;
  error: string | null;
}

export const useLocationPermission = () => {
  const [state, setState] = useState<LocationPermissionState>({
    isSupported: false,
    permissionStatus: 'unsupported',
    isWatching: false,
    location: null,
    error: null,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  // 检查浏览器支持
  useEffect(() => {
    const checkSupport = async () => {
      if (!navigator.geolocation) {
        setState(prev => ({ ...prev, isSupported: false, permissionStatus: 'unsupported' }));
        return;
      }

      setState(prev => ({ ...prev, isSupported: true }));

      // 检查权限状态
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
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

  // 获取当前位置（一次性）
  const getCurrentLocation = useCallback((): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!state.isSupported) {
        setState(prev => ({ ...prev, error: '当前浏览器不支持地理位置访问' }));
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          };

          setState(prev => ({
            ...prev,
            permissionStatus: 'granted',
            location: locationData,
            error: null,
          }));

          resolve(locationData);
        },
        (error) => {
          let errorMessage = '位置获取失败';
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = '位置访问被拒绝';
            setState(prev => ({ ...prev, permissionStatus: 'denied' }));
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = '位置信息不可用';
          } else if (error.code === error.TIMEOUT) {
            errorMessage = '位置请求超时';
          }

          setState(prev => ({ ...prev, error: errorMessage }));
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [state.isSupported]);

  // 开始持续监听位置
  const startWatchingLocation = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: '当前浏览器不支持地理位置访问' }));
      return;
    }

    if (watchId !== null) {
      return; // 已经在监听
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        setState(prev => ({
          ...prev,
          permissionStatus: 'granted',
          isWatching: true,
          location: locationData,
          error: null,
        }));
      },
      (error) => {
        let errorMessage = '位置获取失败';
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = '位置访问被拒绝';
          setState(prev => ({ ...prev, permissionStatus: 'denied' }));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = '位置信息不可用';
        } else if (error.code === error.TIMEOUT) {
          errorMessage = '位置请求超时';
        }

        setState(prev => ({ ...prev, error: errorMessage, isWatching: false }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    setWatchId(id);
  }, [state.isSupported, watchId]);

  // 停止监听位置
  const stopWatchingLocation = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setState(prev => ({ ...prev, isWatching: false }));
    }
  }, [watchId]);

  // 格式化位置信息
  const formatLocation = useCallback((loc: LocationData | null): string => {
    if (!loc) return '未获取';
    return `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)} (±${Math.round(loc.accuracy)}m)`;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    ...state,
    getCurrentLocation,
    startWatchingLocation,
    stopWatchingLocation,
    formatLocation,
  };
};
