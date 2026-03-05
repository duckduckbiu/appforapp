import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaskRegion, UnlockMode } from "./MaskOverlay";
import { ContentPortalContext } from "@/components/layout/ContentSandbox";
import { usePaidLike, useWallet } from "@/hooks/useWallet";
import { useUnlockPost, useUnlockRegion } from "@/hooks/usePostUnlock";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MediaItem {
  id: string;
  media_url: string;
  original_media_url?: string | null;
  masked_media_url?: string | null;
  mask_regions?: MaskRegion[] | null;
}

interface UnlockableImageViewerProps {
  open: boolean;
  onClose: () => void;
  images: MediaItem[];
  initialIndex?: number;
  // 解锁相关
  postId?: string;
  isLocked: boolean;
  maskRegions: MaskRegion[];
  requiredCoins: number;
  isOwner: boolean;
  onUnlockSuccess?: () => void;
  // 分区域解锁支持
  unlockMode?: UnlockMode;
  unlockedRegions?: string[];
}

/**
 * 简化的图片查看器
 * - 打码图直接显示 media_url（已经是 Canvas 生成的打码图）
 * - 解锁后通过 serve-image 获取原图
 * - 不再使用 CSS MaskOverlay 遮罩
 */
export function UnlockableImageViewer({
  open,
  onClose,
  images,
  initialIndex = 0,
  postId,
  isLocked,
  maskRegions,
  requiredCoins,
  isOwner,
  onUnlockSuccess,
  unlockMode = "unified",
  unlockedRegions = [],
}: UnlockableImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [unlockingRegionId, setUnlockingRegionId] = useState<string | null>(null);
  const [localUnlocked, setLocalUnlocked] = useState(false);
  const [localUnlockedRegions, setLocalUnlockedRegions] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const portalContainer = useContext(ContentPortalContext);
  
  const { data: wallet } = useWallet();
  const paidLike = usePaidLike();
  const unlockPost = useUnlockPost();
  const unlockRegion = useUnlockRegion();

  // 重置状态
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setLocalUnlocked(false);
      setLocalUnlockedRegions([]);
      setRefreshKey(0);
      setBlobUrls({});
      setUnlockingRegionId(null);
    }
  }, [open, initialIndex]);

  // 清理 blob URLs
  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [blobUrls]);

  // 加载需要认证的图片（不使用缓存，每次都重新请求）
  const loadAuthenticatedImage = useCallback(async (mediaId: string) => {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        session = refreshedSession;
      }
      
      const token = session?.access_token;

      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-image`);
      url.searchParams.set('mediaId', mediaId);
      url.searchParams.set('t', Date.now().toString()); // 防止浏览器缓存
      if (token) {
        url.searchParams.set('token', token);
      }

      console.log('[serve-image] Requesting image:', mediaId);
      const response = await fetch(url.toString());

      if (!response.ok) throw new Error('Failed to load image');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      return blobUrl;
    } catch (error) {
      console.error('[serve-image] Failed to load authenticated image:', error);
      return null;
    }
  }, []);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, images.length]);

  // 鼠标滚轮缩放
  useEffect(() => {
    if (!open) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.max(0.5, Math.min(5, prev * delta)));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [open]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [images.length]);

  // 拖动处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
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

  const [displayUrl, setDisplayUrl] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // 获取当前图片的遮罩区域
  const getCurrentMaskRegions = useCallback((): MaskRegion[] => {
    const currentImage = images[currentIndex];
    if (!currentImage) return maskRegions;
    if (currentImage.mask_regions && currentImage.mask_regions.length > 0) {
      return currentImage.mask_regions;
    }
    return maskRegions;
  }, [images, currentIndex, maskRegions]);

  // 乐观更新：统一解锁处理
  const handleUnifiedUnlock = useCallback(async () => {
    if (!postId || isOwner || !isLocked || unlockingRegionId) return;
    
    if (!wallet || wallet.balance < requiredCoins) {
      toast({
        variant: "destructive",
        title: "金币不足",
        description: `需要 ${requiredCoins} 金币，当前余额 ${wallet?.balance || 0}`,
      });
      return;
    }

    // 乐观更新：立即显示解锁效果
    setLocalUnlocked(true);
    setUnlockingRegionId("unified");
    
    try {
      // 先支付，再解锁（顺序执行，因为解锁检查依赖支付记录）
      await paidLike.mutateAsync({ postId, amount: requiredCoins });
      await unlockPost.mutateAsync({ postId });
      
      setRefreshKey(prev => prev + 1);
      onUnlockSuccess?.();
    } catch (error: any) {
      // 回滚乐观更新
      setLocalUnlocked(false);
      toast({
        variant: "destructive",
        title: "解锁失败",
        description: error.message || "请稍后重试",
      });
    } finally {
      setUnlockingRegionId(null);
    }
  }, [postId, isOwner, isLocked, unlockingRegionId, wallet, requiredCoins, paidLike, unlockPost, onUnlockSuccess]);

  // 乐观更新：分区域解锁处理
  const handleRegionUnlock = useCallback(async (regionId?: string) => {
    if (!postId || isOwner || !isLocked || unlockingRegionId || !regionId) return;
    
    const currentImage = images[currentIndex];
    if (!currentImage) return;

    const currentRegions = getCurrentMaskRegions();
    const region = currentRegions.find(r => r.id === regionId);
    const regionPrice = region?.price || requiredCoins;
    
    if (!wallet || wallet.balance < regionPrice) {
      toast({
        variant: "destructive",
        title: "金币不足",
        description: `需要 ${regionPrice} 金币，当前余额 ${wallet?.balance || 0}`,
      });
      return;
    }

    // 乐观更新：立即显示区域解锁效果
    setLocalUnlockedRegions(prev => [...prev, regionId]);
    setUnlockingRegionId(regionId);
    
    try {
      // 先支付，再解锁（顺序执行）
      await paidLike.mutateAsync({ postId, amount: regionPrice });
      await unlockRegion.mutateAsync({ 
        postId, 
        mediaId: currentImage.id, 
        regionId,
        price: regionPrice,
      });
      
      setRefreshKey(prev => prev + 1);
      onUnlockSuccess?.();
    } catch (error: any) {
      // 回滚乐观更新
      setLocalUnlockedRegions(prev => prev.filter(id => id !== regionId));
      toast({
        variant: "destructive",
        title: "解锁失败",
        description: error.message || "请稍后重试",
      });
    } finally {
      setUnlockingRegionId(null);
    }
  }, [postId, isOwner, isLocked, unlockingRegionId, wallet, requiredCoins, images, currentIndex, getCurrentMaskRegions, paidLike, unlockRegion, onUnlockSuccess]);

  // 根据 unlockMode 选择解锁处理函数
  const handleUnlock = useCallback((regionId?: string) => {
    if (unlockMode === "per_region") {
      handleRegionUnlock(regionId);
    } else {
      handleUnifiedUnlock();
    }
  }, [unlockMode, handleUnifiedUnlock, handleRegionUnlock]);

  // 加载当前图片
  // 简化逻辑：
  // - 有 original_media_url 且需要权限验证时，通过 serve-image 获取
  // - serve-image 会根据权限自动返回打码图或原图
  // - 解锁后需要重新请求获取原图（通过 refreshKey 触发）
  useEffect(() => {
    if (!open || images.length === 0) return;
    
    const currentImage = images[currentIndex];
    if (!currentImage) return;

    // 如果有 original_media_url，说明是打码内容，需要通过 serve-image 获取
    if (currentImage.original_media_url) {
      setIsLoadingImage(true);
      
      // 每次 refreshKey 变化都重新请求（解锁后 refreshKey 会增加）
      loadAuthenticatedImage(currentImage.id).then(url => {
        if (url) {
          setDisplayUrl(url);
        } else {
          // 如果 serve-image 失败，回退到打码图
          setDisplayUrl(currentImage.media_url);
        }
        setIsLoadingImage(false);
      });
    } else {
      // 普通图片直接显示
      setDisplayUrl(currentImage.media_url);
    }
  }, [open, images, currentIndex, refreshKey, loadAuthenticatedImage]);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];
  
  // 判断是否需要显示解锁按钮
  const hasLockedContent = currentImage?.original_media_url && isLocked && !isOwner && !localUnlocked;

  const viewerContent = (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-md flex items-center justify-center pointer-events-auto"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 关闭按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      {/* 图片计数 */}
      {images.length > 1 && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-background/80 text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 左箭头 */}
      {images.length > 1 && (
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* 图片容器 */}
      <div
        className={cn(
          "relative select-none",
          scale > 1 ? "cursor-grab" : "cursor-default",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {isLoadingImage ? (
          <div className="flex items-center justify-center w-[50vw] h-[50vh]">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <img
            src={displayUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            draggable={false}
          />
        )}

        {/* 解锁按钮 - 显示在图片底部中央 */}
        {hasLockedContent && (
          <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2">
            <button
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                handleUnlock();
              }}
              disabled={!!unlockingRegionId}
            >
              {unlockingRegionId ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>解锁中...</span>
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  <span>支付 {requiredCoins} 金币解锁原图</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 右箭头 */}
      {images.length > 1 && (
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* 图片指示器 */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentIndex
                  ? "bg-primary"
                  : "bg-muted-foreground/50 hover:bg-muted-foreground"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );

  // 使用 ContentSandbox 的 portal container
  if (portalContainer) {
    return createPortal(viewerContent, portalContainer);
  }

  return viewerContent;
}
