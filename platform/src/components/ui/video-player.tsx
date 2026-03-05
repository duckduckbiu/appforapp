import { useState, useRef, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, X, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentPortalContext } from "@/components/layout/ContentSandbox";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  aspectRatio?: "video" | "square" | "auto";
  maxHeight?: string;
}

// 内嵌式视频播放器 - 用于 Feed 等列表场景
export function FeedVideoPlayer({ 
  src, 
  poster,
  className,
  autoPlay = true,
  loop = true,
  muted: initialMuted = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isHovered, setIsHovered] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const portalContainer = useContext(ContentPortalContext);

  // 使用 IntersectionObserver 自动播放
  useEffect(() => {
    if (!autoPlay) return;
    
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            video.play().catch(() => {});
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const container = e.currentTarget;
    if (!video || !container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    video.currentTime = percent * duration;
  };

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(true);
  };

  const fullscreenContent = isFullscreen && (
    <div
      className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-md flex items-center justify-center pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsFullscreen(false);
        }
      }}
    >
      <button
        onClick={() => setIsFullscreen(false)}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      <video
        src={src}
        className="max-w-[90vw] max-h-[90vh] rounded-lg"
        controls
        autoPlay
        playsInline
      />
    </div>
  );

  return (
    <>
      <div 
        className={cn("relative w-full h-full bg-black", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain cursor-pointer"
          muted={isMuted}
          loop={loop}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />

        {/* 底部控制栏 - 仅在悬停时显示 */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 进度条 */}
          <div 
            className="w-full h-1 bg-white/30 rounded-full mb-2 cursor-pointer group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-primary rounded-full relative"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" fill="currentColor" />}
              </button>
              <span className="text-white text-xs font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button onClick={toggleMute} className="text-white hover:text-primary transition-colors">
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </div>
            <button 
              onClick={openFullscreen} 
              className="text-white hover:text-primary transition-colors"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 时间戳 - 未悬停时显示在左下角 */}
        {!isHovered && duration > 0 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-medium pointer-events-none">
            {formatTime(duration - currentTime)}
          </div>
        )}
      </div>

      {/* 全屏播放器 */}
      {isFullscreen && portalContainer && createPortal(fullscreenContent, portalContainer)}
      {isFullscreen && !portalContainer && fullscreenContent}
    </>
  );
}

// 全屏视频查看器 - 用于点击后查看
interface VideoViewerProps {
  open: boolean;
  onClose: () => void;
  src: string;
  autoPlay?: boolean;
}

export function VideoViewer({ 
  open, 
  onClose, 
  src,
  autoPlay = true,
}: VideoViewerProps) {
  const portalContainer = useContext(ContentPortalContext);

  if (!open) return null;

  const content = (
    <div
      className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-md flex items-center justify-center pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      <video
        src={src}
        className="max-w-[90vw] max-h-[90vh] rounded-lg"
        controls
        autoPlay={autoPlay}
        playsInline
      />
    </div>
  );

  if (portalContainer) {
    return createPortal(content, portalContainer);
  }

  return content;
}
