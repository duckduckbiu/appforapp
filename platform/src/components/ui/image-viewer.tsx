import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ContentPortalContext } from "@/components/layout/ContentSandbox";

interface ImageViewerProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
}

export function ImageViewer({ open, onClose, images, initialIndex = 0 }: ImageViewerProps) {
  const portalContainer = useContext(ContentPortalContext);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);

  // 重置状态当打开或切换图片时
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open, initialIndex]);

  // 切换图片时重置缩放
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // 键盘导航
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          if (images.length > 1) {
            setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
          }
          break;
        case "ArrowRight":
          if (images.length > 1) {
            setCurrentIndex(prev => (prev + 1) % images.length);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, images.length, onClose]);

  // 滚轮缩放
  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement || !open) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      const newScale = Math.min(Math.max(0.5, scale + delta), 5);
      setScale(newScale);
      
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    };

    imageElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => imageElement.removeEventListener('wheel', handleWheel);
  }, [open, scale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const goToPrevious = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const content = (
    <div 
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md pointer-events-auto"
      onClick={onClose}
    >
      {/* 固定大小的容器 - 80%内容区大小 */}
      <div 
        className="relative w-[80%] h-[80%] bg-black/90 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* 图片计数器 */}
        {images.length > 1 && (
          <div className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1 text-sm text-white backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* 左侧导航按钮 */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        {/* 右侧导航按钮 */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            onClick={goToNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* 图片容器 */}
        <div 
          ref={imageRef}
          className="w-full h-full flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <img
            src={currentImage}
            alt="预览"
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
            style={{ 
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s',
            }}
          />
        </div>

        {/* 底部指示器 */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  idx === currentIndex ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 使用 portal 渲染到内容区的 portal 容器，确保在滚动内容外部显示
  if (portalContainer) {
    return createPortal(content, portalContainer);
  }

  // 降级：如果没有 portal 容器，直接渲染
  return content;
}
