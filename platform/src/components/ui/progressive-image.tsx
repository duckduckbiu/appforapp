import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ProgressiveImageProps {
  src: string;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  // 懒加载
  lazy?: boolean;
  // 加载完成回调
  onLoad?: () => void;
}

/**
 * 渐进式图片加载组件
 * - 先显示静态占位背景
 * - 图片加载完成后淡入显示
 */
export function ProgressiveImage({
  src,
  alt = "",
  className,
  placeholderClassName,
  lazy = true,
  onLoad,
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  // src 变化时重置加载状态
  useEffect(() => {
    if (src !== currentSrc) {
      setIsLoaded(false);
      setCurrentSrc(src);
    }
  }, [src, currentSrc]);

  // 处理图片加载完成
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  // 检查图片是否已在缓存中
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img?.naturalHeight > 0) {
      setIsLoaded(true);
    }
  }, [currentSrc]);

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* 实际图片 */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={cn(
          "h-full w-full object-cover",
          "transition-opacity duration-200 ease-out",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={handleLoad}
        loading={lazy ? "lazy" : "eager"}
      />
    </div>
  );
}
