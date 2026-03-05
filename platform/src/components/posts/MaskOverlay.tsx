import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

// 区域形状类型
export type MaskShape = "rectangle" | "circle" | "freehand" | "lasso";

// 遮罩样式类型
export type MaskStyle = "solid" | "mosaic" | "blur" | "sticker";

export interface MaskRegion {
  id: string;
  shape: MaskShape;
  // 矩形/圆形使用
  x: number;      // percentage
  y: number;      // percentage
  width: number;  // percentage
  height: number; // percentage
  // 旋转角度 (degrees)
  rotation?: number;
  // 自由绘制/套索使用 (SVG path 或点数组)
  path?: string;  // SVG path data
  points?: { x: number; y: number }[]; // 百分比坐标点
  // 遮罩样式
  style: MaskStyle;
  // 模糊强度 (1-50, 仅当style为blur时使用)
  blurIntensity?: number;
  // 马赛克强度 (1-50, 仅当style为mosaic时使用)
  mosaicIntensity?: number;
  // 贴纸相关
  stickerUrl?: string;
  // 价格
  price?: number;
}

// 兼容旧数据的类型（用于从数据库读取时转换）
export interface LegacyMaskRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  price?: number;
}

// 转换旧格式到新格式
export function normalizeMaskRegion(region: MaskRegion | LegacyMaskRegion): MaskRegion {
  if ('shape' in region && 'style' in region) {
    return region as MaskRegion;
  }
  // 旧数据默认为矩形+色块
  return {
    ...region,
    shape: 'rectangle',
    style: 'solid',
  };
}

export type UnlockMode = "unified" | "per_region";

interface MaskOverlayProps {
  regions: MaskRegion[];
  unlockMode: UnlockMode;
  unifiedPrice?: number;
  unlockedRegions?: string[];
  isLocked: boolean;
  onUnlock?: (regionId?: string) => void;
  className?: string;
  showVisualMask?: boolean;
  interactive?: boolean;
  unlockingRegionId?: string | null;
}

// 生成马赛克 SVG pattern - 使用不透明色块
function MosaicPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="hsl(var(--primary))" />
        <rect x="4" y="0" width="4" height="4" fill="hsl(var(--primary-foreground) / 0.3)" />
        <rect x="0" y="4" width="4" height="4" fill="hsl(var(--primary-foreground) / 0.3)" />
        <rect x="4" y="4" width="4" height="4" fill="hsl(var(--primary))" />
      </pattern>
    </defs>
  );
}

// 渲染单个遮罩区域
function MaskRegionElement({
  region,
  isUnlocking,
  price,
  interactive,
  showVisualMask,
  onUnlock,
  unlockMode,
}: {
  region: MaskRegion;
  isUnlocking: boolean;
  price: number;
  interactive: boolean;
  showVisualMask: boolean;
  onUnlock?: (regionId?: string) => void;
  unlockMode: UnlockMode;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactive || !onUnlock) return;
    onUnlock(unlockMode === "per_region" ? region.id : undefined);
  };

  const patternId = `mosaic-${region.id}`;
  const blurId = `blur-${region.id}`;

  // 获取遮罩填充样式 - 全部使用不透明色块
  const getMaskFill = () => {
    switch (region.style) {
      case "mosaic":
        return `url(#${patternId})`;
      case "blur":
        return "hsl(var(--primary))"; // 完全不透明
      case "sticker":
        return "transparent";
      case "solid":
      default:
        return "hsl(var(--primary))"; // 完全不透明
    }
  };

  // 渲染形状
  const renderShape = () => {
    const fill = getMaskFill();
    
    if (region.shape === "circle") {
      const cx = region.x + region.width / 2;
      const cy = region.y + region.height / 2;
      const rx = region.width / 2;
      const ry = region.height / 2;
      return (
        <ellipse
          cx={`${cx}%`}
          cy={`${cy}%`}
          rx={`${rx}%`}
          ry={`${ry}%`}
          fill={fill}
          className="transition-all"
        />
      );
    }

    if ((region.shape === "freehand" || region.shape === "lasso") && region.path) {
      return (
        <path
          d={region.path}
          fill={fill}
          className="transition-all"
        />
      );
    }

    // 默认矩形
    return (
      <rect
        x={`${region.x}%`}
        y={`${region.y}%`}
        width={`${region.width}%`}
        height={`${region.height}%`}
        rx="8"
        fill={fill}
        className="transition-all"
      />
    );
  };

  // 计算中心点位置（用于显示图标）
  const getCenterPosition = () => {
    if (region.shape === "circle" || region.shape === "rectangle") {
      return {
        x: region.x + region.width / 2,
        y: region.y + region.height / 2,
      };
    }
    if (region.points && region.points.length > 0) {
      const sumX = region.points.reduce((sum, p) => sum + p.x, 0);
      const sumY = region.points.reduce((sum, p) => sum + p.y, 0);
      return {
        x: sumX / region.points.length,
        y: sumY / region.points.length,
      };
    }
    return { x: 50, y: 50 };
  };

  const center = getCenterPosition();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g 
          className={cn(
            "cursor-pointer transition-opacity",
            interactive && "hover:opacity-80",
            isUnlocking && "opacity-50"
          )}
          onClick={handleClick}
        >
          {/* SVG definitions */}
          {region.style === "mosaic" && <MosaicPattern id={patternId} />}
          {region.style === "blur" && (
            <defs>
              <filter id={blurId}>
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
          )}

          {/* 遮罩形状 */}
          {showVisualMask && renderShape()}

          {/* 贴纸图片 */}
          {region.style === "sticker" && region.stickerUrl && showVisualMask && (
            <image
              href={region.stickerUrl}
              x={`${region.x}%`}
              y={`${region.y}%`}
              width={`${region.width}%`}
              height={`${region.height}%`}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* 加载中图标 - 仅在解锁中显示 */}
          {isUnlocking && (
            <foreignObject
              x={`${center.x - 2.5}%`}
              y={`${center.y - 2.5}%`}
              width="5%"
              height="5%"
              className="pointer-events-none"
            >
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              </div>
            </foreignObject>
          )}
        </g>
      </TooltipTrigger>
      {interactive && !isUnlocking && (
        <TooltipContent 
          side="top" 
          className="bg-background/95 backdrop-blur-sm border-primary/20"
        >
          <p className="text-sm">
            点击支付 <span className="font-bold text-primary">{price}</span> 金币
            {unlockMode === "unified" ? "解锁全部" : "解锁此区域"}
          </p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function MaskOverlay({
  regions,
  unlockMode,
  unifiedPrice = 10,
  unlockedRegions = [],
  isLocked,
  onUnlock,
  className,
  showVisualMask = true,
  interactive = true,
  unlockingRegionId,
}: MaskOverlayProps) {
  // 获取需要渲染的区域（未解锁的）
  const visibleRegions = unlockMode === "per_region"
    ? regions.filter(r => !unlockedRegions.includes(r.id))
    : (unlockedRegions.length === 0 ? regions : []);

  if (!isLocked || visibleRegions.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <svg 
        className={cn(
          "absolute inset-0 w-full h-full", 
          interactive ? "" : "pointer-events-none", 
          className
        )}
        preserveAspectRatio="none"
      >
        {visibleRegions.map((region) => {
          const isUnlocking = unlockingRegionId === region.id || 
            (unlockMode === "unified" && unlockingRegionId === "unified");
          const price = unlockMode === "per_region" 
            ? (region.price || unifiedPrice)
            : unifiedPrice;

          return (
            <MaskRegionElement
              key={region.id}
              region={region}
              isUnlocking={isUnlocking}
              price={price}
              interactive={interactive}
              showVisualMask={showVisualMask}
              onUnlock={onUnlock}
              unlockMode={unlockMode}
            />
          );
        })}
      </svg>
    </TooltipProvider>
  );
}
