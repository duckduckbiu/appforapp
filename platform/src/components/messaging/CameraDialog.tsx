import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCameraPermission } from "@/hooks/useCameraPermission";

interface CameraDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraDialog({ open, onClose, onCapture }: CameraDialogProps) {
  const { permissionStatus, requestPermission, stream, stopCamera, isInitialized, error } = useCameraPermission();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  // 使用 ref 防止重复请求
  const hasRequestedRef = useRef(false);

  // 当对话框打开时，请求浏览器相机权限
  useEffect(() => {
    if (!open) {
      // 对话框关闭时重置
      hasRequestedRef.current = false;
      setIsCameraReady(false);
      return;
    }
    
    if (!isInitialized || hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    
    const startCamera = async () => {
      console.log('Starting camera...');
      console.log('Permission status:', permissionStatus);
      
      const granted = await requestPermission();
      if (!granted) {
        toast.error("相机权限被拒绝，请在浏览器设置中允许相机访问");
        hasRequestedRef.current = false;
        onClose();
      }
    };

    startCamera();
  }, [open, isInitialized, permissionStatus, requestPermission, onClose]);

  // 单独处理清理逻辑
  useEffect(() => {
    if (!open) {
      stopCamera();
    }
  }, [open, stopCamera]);

  // 将视频流绑定到 video 元素
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log('Binding stream to video element...');
      videoRef.current.srcObject = stream;
      // 等待视频元数据加载完成后再标记为就绪
      videoRef.current.onloadedmetadata = () => {
        console.log('Video metadata loaded, camera ready');
        setIsCameraReady(true);
      };
    }
  }, [stream]);

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      toast.error("相机权限被拒绝，请在浏览器设置中允许相机访问");
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      handleClose();
    }, "image/jpeg", 0.95);
  };

  const handleClose = () => {
    stopCamera();
    setIsCameraReady(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl h-[600px] bg-background/5 backdrop-blur-md rounded-lg overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-black/60 backdrop-blur-md">
          <h3 className="text-lg font-semibold">拍照</h3>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Camera View */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* video 元素始终渲染，用 opacity 控制可见性 */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
              isCameraReady ? "opacity-100" : "opacity-0"
            }`}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* 加载状态覆盖层 - z-10 确保显示在 video 上方 */}
          {!isInitialized ? (
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">正在初始化...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center z-10">
              <AlertCircle className="h-16 w-16 text-destructive" />
              <div>
                <h4 className="font-semibold mb-2">相机启动失败</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {error}
                </p>
              </div>
              <Button onClick={handleRequestPermission}>
                <Camera className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          ) : permissionStatus !== "granted" ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center z-10">
              <Camera className="h-16 w-16 text-muted-foreground" />
              <div>
                <h4 className="font-semibold mb-2">需要相机权限</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  点击授权后，浏览器会请求相机访问权限
                </p>
              </div>
              <Button onClick={handleRequestPermission}>
                <Camera className="mr-2 h-4 w-4" />
                授予权限
              </Button>
            </div>
          ) : !isCameraReady ? (
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">正在启动相机...</p>
            </div>
          ) : null}
        </div>

        {/* Controls */}
        {permissionStatus === "granted" && isCameraReady && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-8 p-6 bg-black/60 backdrop-blur-md">
            <Button
              size="icon"
              className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
              onClick={handleCapture}
            >
              <div className="h-12 w-12 rounded-full border-4 border-white"></div>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
