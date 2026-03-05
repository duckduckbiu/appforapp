import { useState, useRef } from "react";
import { Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnlockableImageViewer } from "./UnlockableImageViewer";
import { MaskRegion } from "./MaskOverlay";
import { useQueryClient } from "@tanstack/react-query";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { FeedVideoPlayer, VideoViewer } from "@/components/ui/video-player";

interface MediaItem {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  original_media_url?: string | null;
  masked_media_url?: string | null;
  mask_regions?: MaskRegion[] | null;
}

interface PostMediaGridProps {
  media: MediaItem[];
  className?: string;
  postId?: string;
  isLocked?: boolean;
  isUnlocked?: boolean;
  maskRegions?: MaskRegion[];
  requiredLikes?: number;
  currentLikes?: number;
  isOwner?: boolean;
  unlockMode?: "unified" | "per_region";
  unlockedRegions?: string[];
}

export function PostMediaGrid({ 
  media, 
  className,
  postId,
  isLocked = false,
  isUnlocked = false,
  maskRegions = [],
  requiredLikes = 0,
  currentLikes = 0,
  isOwner = false,
  unlockMode = "unified",
  unlockedRegions = [],
}: PostMediaGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // 简化逻辑：Feed 直接显示 thumbnail_url 或 media_url（它们已经是打码后的）
  // 不需要前端 CSS 遮罩，因为服务端已经生成了真正的打码图
  const hasLockedContent = media.some(m => m.original_media_url) && isLocked && !isOwner;

  if (media.length === 0) return null;

  // 最多显示3张，超过3张时可滑动
  const displayMedia = media;
  const hasMoreThanThree = media.length > 3;

  // 获取显示样式：统一使用1/3宽度的正方形
  const getImageClass = () => {
    return "aspect-square flex-shrink-0 w-1/3";
  };

  const handleMediaClick = (item: MediaItem, index: number) => {
    if (item.media_type === "video") {
      setVideoUrl(item.media_url);
    } else {
      const imageIndex = media.slice(0, index + 1).filter(m => m.media_type === "image").length - 1;
      setPreviewIndex(imageIndex);
    }
  };

  // Feed 直接显示缩略图或打码图（都是已打码的）
  const getDisplayUrl = (item: MediaItem): string => {
    return item.thumbnail_url || item.media_url;
  };

  const handleUnlockSuccess = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => 
        query.queryKey[0] === "unlock-status" && query.queryKey[1] === postId
    });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["media-access"] });
    setRefreshKey(prev => prev + 1);
  };

  const imageMedia = media.filter(m => m.media_type === "image");

  // 滑动到左边
  const scrollLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollContainerRef.current) {
      const itemWidth = scrollContainerRef.current.offsetWidth / 3;
      scrollContainerRef.current.scrollBy({ left: -itemWidth, behavior: 'smooth' });
    }
  };

  // 滑动到右边
  const scrollRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollContainerRef.current) {
      const itemWidth = scrollContainerRef.current.offsetWidth / 3;
      scrollContainerRef.current.scrollBy({ left: itemWidth, behavior: 'smooth' });
    }
  };

  // 计算容器的justify样式
  const getJustifyClass = () => {
    if (media.length === 1) return "justify-center";
    if (media.length === 2) return "justify-start"; // 2张时靠左，用gap占位让第二张居中
    return "justify-start";
  };

  // 渲染单张媒体时带模糊背景
  const renderSingleMediaWithBlurBg = (item: MediaItem, index: number) => {
    const isVideo = item.media_type === "video";
    // 视频优先使用封面图，图片使用缩略图或原图（都是已打码的）
    const bgImageUrl = item.thumbnail_url || (isVideo ? '' : item.media_url);

    return (
      <div
        key={item.id}
        className="relative w-full aspect-[3/1] overflow-hidden cursor-pointer"
        onClick={() => !isVideo && handleMediaClick(item, index)}
      >
        {/* 模糊背景 - 毛玻璃效果 */}
        {bgImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${bgImageUrl})`,
              filter: 'blur(30px) saturate(1.2)',
              transform: 'scale(1.2)',
            }}
          />
        )}
        {/* 毛玻璃遮罩层 - 半透明 + 模糊 */}
        <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
        
        {/* 居中的主内容 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full aspect-square relative overflow-hidden group">
            {renderMediaContent(item, isVideo)}
          </div>
        </div>
      </div>
    );
  };

  // 渲染媒体项目
  const renderMediaItems = () => {
    // 单张时使用模糊背景布局
    if (media.length === 1) {
      return renderSingleMediaWithBlurBg(displayMedia[0], 0);
    }

    // 2张图片时，使用grid布局：第一张左边，第二张中间，右边空
    if (media.length === 2) {
      return (
        <div className="grid grid-cols-3 gap-1">
          {displayMedia.map((item, index) => {
            const isVideo = item.media_type === "video";

            return (
              <div
                key={item.id}
                className={cn(
                  "relative overflow-hidden bg-muted group aspect-square",
                  !isVideo && "cursor-pointer"
                )}
                onClick={() => !isVideo && handleMediaClick(item, index)}
              >
                {renderMediaContent(item, isVideo)}
              </div>
            );
          })}
          {/* 第三格留空 */}
          <div className="aspect-square" />
        </div>
      );
    }

    return displayMedia.map((item, index) => {
      const isVideo = item.media_type === "video";

      return (
        <div
          key={item.id}
          className={cn(
            "relative overflow-hidden bg-muted group",
            getImageClass(),
            !isVideo && "cursor-pointer"
          )}
          style={{ scrollSnapAlign: 'start' }}
          onClick={() => !isVideo && handleMediaClick(item, index)}
        >
          {renderMediaContent(item, isVideo)}
        </div>
      );
    });
  };

  // 渲染媒体内容 - 简化版：直接显示打码后的图片，无需 CSS 遮罩
  const renderMediaContent = (item: MediaItem, isVideo: boolean) => {
    if (item.media_type === "image") {
      return (
        <div className="relative h-full w-full">
          <div className="relative h-full w-full transition-transform duration-200 group-hover:scale-105 origin-center">
            {/* 直接显示打码图，无需 CSS 遮罩 */}
            <ProgressiveImage
              src={getDisplayUrl(item)}
              alt=""
              className="h-full w-full"
              lazy={true}
            />
          </div>
        </div>
      );
    }
    if (isVideo) {
      return (
        <FeedVideoPlayer 
          src={item.media_url}
          poster={item.thumbnail_url || undefined}
        />
      );
    }
    return null;
  };

  return (
    <>
      <div className={cn("relative rounded-lg overflow-hidden", className)}>
        {/* 横向滑动容器 */}
        <div 
          ref={scrollContainerRef}
          className={cn(
            "flex gap-1 overflow-x-auto scrollbar-hide scroll-smooth",
            getJustifyClass()
          )}
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {renderMediaItems()}
        </div>

        {/* 左右滑动按钮 - 只在超过3张时显示 */}
        {hasMoreThanThree && (
          <>
            <button
              onClick={scrollLeft}
              className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={scrollRight}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* 图片数量指示器 - 超过3张时显示 */}
        {hasMoreThanThree && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-background/80 text-xs text-foreground">
            {media.length} 张
          </div>
        )}

        {isOwner && media.some(m => m.original_media_url) && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 text-xs text-primary-foreground">
              <Lock className="h-3 w-3" />
              <span>含打码内容</span>
            </div>
          </div>
        )}

        {hasLockedContent && (
          <div className="absolute bottom-2 left-2">
            <div className="flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-xs border border-primary/20">
              <Lock className="h-3 w-3 text-primary" />
              <span>点击解锁 · {requiredLikes} 金币</span>
            </div>
          </div>
        )}
      </div>

      <UnlockableImageViewer
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={imageMedia}
        initialIndex={previewIndex ?? 0}
        postId={postId}
        isLocked={isLocked && !isUnlocked}
        maskRegions={maskRegions}
        requiredCoins={requiredLikes}
        isOwner={isOwner}
        onUnlockSuccess={handleUnlockSuccess}
        unlockMode={unlockMode}
        unlockedRegions={unlockedRegions}
      />

      {/* 使用通用视频查看器组件 */}
      <VideoViewer
        open={!!videoUrl}
        onClose={() => setVideoUrl(null)}
        src={videoUrl || ""}
      />
    </>
  );
}
