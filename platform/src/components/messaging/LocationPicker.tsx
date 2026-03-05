import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, X, Send } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useLocationPermission } from "@/hooks/useLocationPermission";

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
  onSend: (location: { latitude: number; longitude: number; address?: string }) => void;
}

export function LocationPicker({ open, onClose, onSend }: LocationPickerProps) {
  const { permissionStatus, location, getCurrentLocation } = useLocationPermission();
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState<string>("");

  useEffect(() => {
    if (open && permissionStatus === "granted" && !location) {
      handleGetLocation();
    } else if (open && permissionStatus === "prompt") {
      handleGetLocation();
    }
  }, [open]);

  useEffect(() => {
    if (location) {
      // 尝试获取地址（使用反向地理编码）
      fetchAddress(location.latitude, location.longitude);
    }
  }, [location]);

  const handleGetLocation = async () => {
    setIsLoading(true);
    try {
      const pos = await getCurrentLocation();
      if (!pos) {
        toast.error("无法获取位置信息");
      }
    } catch (error) {
      console.error("Failed to get location:", error);
      toast.error("获取位置失败");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      // 使用 OpenStreetMap Nominatim API（免费）进行反向地理编码
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN`
      );
      const data = await response.json();
      
      if (data.display_name) {
        setAddress(data.display_name);
      }
    } catch (error) {
      console.error("Failed to fetch address:", error);
      setAddress("地址解析失败");
    }
  };

  const handleSend = () => {
    if (!location) return;

    onSend({
      latitude: location.latitude,
      longitude: location.longitude,
      address: address || undefined,
    });
    handleClose();
  };

  const handleClose = () => {
    setAddress("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-background/5 backdrop-blur-md rounded-lg overflow-hidden p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">分享位置</h3>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        {permissionStatus !== "granted" && permissionStatus !== "prompt" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <MapPin className="h-16 w-16 text-muted-foreground" />
            <div>
              <h4 className="font-semibold mb-2">位置访问被拒绝</h4>
              <p className="text-sm text-muted-foreground mb-4">
                请在浏览器设置中允许位置访问
              </p>
            </div>
            <Button onClick={handleClose}>
              关闭
            </Button>
          </div>
        ) : isLoading || !location ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <LoadingSpinner size="lg" text="正在获取位置信息..." />
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-4">
            {/* Map Placeholder / Preview */}
            <div className="relative h-48 bg-muted/20 rounded-lg border border-border overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="h-12 w-12 text-primary" />
              </div>
              {/* 实际项目中可以集成真实地图组件，如 Leaflet 或 Google Maps */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3">
                <p className="text-xs text-muted-foreground">
                  纬度: {location.latitude.toFixed(6)}
                </p>
                <p className="text-xs text-muted-foreground">
                  经度: {location.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Address */}
            {address && (
              <div className="space-y-2">
                <label className="text-sm font-medium">地址</label>
                <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg border border-border">
                  {address}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleGetLocation}
              >
                刷新位置
              </Button>
              <Button
                className="flex-1"
                onClick={handleSend}
              >
                <Send className="mr-2 h-4 w-4" />
                发送位置
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
