import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  X, 
  Trash2, 
  Coins, 
  Square, 
  Circle, 
  Pencil, 
  Lasso,
  Grid3X3,
  Droplets,
  Sticker,
  Palette,
  ImagePlus,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { MaskShape, MaskStyle } from "./MaskOverlay";
import { generateMaskedPreviewUrl, type MaskRegion } from "@/lib/imageMasking";

// 预设贴纸列表 - 使用 data URI 避免跨域问题
const PRESET_STICKERS = [
  { id: "heart", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/%3E%3C/svg%3E", name: "爱心" },
  { id: "star", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23eab308'%3E%3Cpath d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'/%3E%3C/svg%3E", name: "星星" },
  { id: "fire", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f97316'%3E%3Cpath d='M12 23c-3.866 0-7-3.134-7-7 0-2.5 1.5-4.5 3-6.5s3-4.5 3-7.5c0 0 1 1 2 3 .5-1 1-2 1-3 2 3 3 5.5 3 8s-.5 4-2 5.5c1 0 2-.5 3-1.5 0 4-3 9-6 9z'/%3E%3C/svg%3E", name: "火焰" },
  { id: "sparkles", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a855f7'%3E%3Cpath d='M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2zM5 5l1.5 3L10 9.5 6.5 11 5 14l-1.5-3L0 9.5 3.5 8 5 5zm14 0l1.5 3L24 9.5l-3.5 1.5L19 14l-1.5-3L14 9.5l3.5-1.5L19 5z'/%3E%3C/svg%3E", name: "闪亮" },
  { id: "kiss", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ec4899'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E", name: "眼睛" },
  { id: "peach", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fb923c'%3E%3Cpath d='M12 2C8 2 4 6 4 12s4 10 8 10 8-4 8-10S16 2 12 2zm0 18c-3 0-6-3-6-8s3-8 6-8 6 3 6 8-3 8-6 8z'/%3E%3Ccircle cx='12' cy='12' r='4' fill='%23fdba74'/%3E%3C/svg%3E", name: "圆形" },
];

export interface MaskRegionWithPrice extends MaskRegion {
  // price 已经在 MaskRegion 中定义
}

interface ImageMaskEditorProps {
  imageSrc: string;
  regions: MaskRegionWithPrice[];
  onRegionsChange: (regions: MaskRegionWithPrice[]) => void;
  showPrice?: boolean;
  defaultPrice?: number;
  className?: string;
  // 外部控制的工具选项
  currentShape?: MaskShape;
  currentStyle?: MaskStyle;
  currentSticker?: string;
  blurIntensity?: number;
  mosaicIntensity?: number;
  onClearAll?: () => void;
  hideToolbar?: boolean;
  // 选中区域相关
  selectedRegionId?: string | null;
  onSelectedRegionChange?: (id: string | null) => void;
}

export const SHAPE_OPTIONS: { value: MaskShape; icon: typeof Square; label: string }[] = [
  { value: "rectangle", icon: Square, label: "矩形" },
  { value: "circle", icon: Circle, label: "圆形" },
  { value: "freehand", icon: Pencil, label: "自由画笔" },
  { value: "lasso", icon: Lasso, label: "套索" },
];

export const STYLE_OPTIONS: { value: MaskStyle; icon: typeof Palette; label: string }[] = [
  { value: "solid", icon: Palette, label: "色块" },
  { value: "mosaic", icon: Grid3X3, label: "马赛克" },
  { value: "blur", icon: Droplets, label: "模糊" },
  { value: "sticker", icon: Sticker, label: "贴纸" },
];

export const PRESET_STICKERS_LIST = PRESET_STICKERS;

export function ImageMaskEditor({
  imageSrc,
  regions,
  onRegionsChange,
  showPrice = false,
  defaultPrice = 10,
  className,
  currentShape: externalShape,
  currentStyle: externalStyle,
  currentSticker: externalSticker,
  blurIntensity: externalBlurIntensity,
  mosaicIntensity: externalMosaicIntensity,
  onClearAll,
  hideToolbar = false,
  selectedRegionId: externalSelectedRegionId,
  onSelectedRegionChange,
}: ImageMaskEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [internalSelectedRegionId, setInternalSelectedRegionId] = useState<string | null>(null);
  
  // 使用外部或内部选中状态
  const selectedRegionId = externalSelectedRegionId !== undefined ? externalSelectedRegionId : internalSelectedRegionId;
  const setSelectedRegionId = (id: string | null) => {
    if (onSelectedRegionChange) {
      onSelectedRegionChange(id);
    } else {
      setInternalSelectedRegionId(id);
    }
  };
  
  // 拖动/缩放/旋转状态
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null); // 'nw' | 'ne' | 'sw' | 'se' | null
  const [isRotating, setIsRotating] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStartRegion, setDragStartRegion] = useState<MaskRegionWithPrice | null>(null);
  const [rotateStartAngle, setRotateStartAngle] = useState<number>(0);
  
  // 使用外部传入的值或内部状态
  const [internalShape, setInternalShape] = useState<MaskShape>("rectangle");
  const [internalStyle, setInternalStyle] = useState<MaskStyle>("solid");
  const [internalSticker, setInternalSticker] = useState<string>(PRESET_STICKERS[0].url);
  const [internalBlurIntensity, setInternalBlurIntensity] = useState<number>(30);
  const [internalMosaicIntensity, setInternalMosaicIntensity] = useState<number>(30);
  
  const currentShape = externalShape ?? internalShape;
  const currentStyle = externalStyle ?? internalStyle;
  const currentSticker = externalSticker ?? internalSticker;
  const blurIntensity = externalBlurIntensity ?? internalBlurIntensity;
  const mosaicIntensity = externalMosaicIntensity ?? internalMosaicIntensity;
  
  const setCurrentShape = (shape: MaskShape) => setInternalShape(shape);
  const setCurrentStyle = (style: MaskStyle) => setInternalStyle(style);
  const setCurrentSticker = (sticker: string) => setInternalSticker(sticker);
  
  // 自由画笔/套索的点集合
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  
  // Canvas 预览相关
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 贴纸上传
  const stickerInputRef = useRef<HTMLInputElement>(null);
  
  // 生成 Canvas 预览图 (debounced)
  useEffect(() => {
    // 清理之前的定时器
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    // 没有区域时，清除预览
    if (regions.length === 0) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    
    // 延迟生成预览（防抖）
    setIsGeneratingPreview(true);
    previewTimeoutRef.current = setTimeout(async () => {
      try {
        // 转换区域格式
        const regionsForPreview = regions.map(r => ({
          ...r,
          blurIntensity: r.blurIntensity ?? blurIntensity,
          mosaicIntensity: r.mosaicIntensity ?? mosaicIntensity,
        }));
        
        const url = await generateMaskedPreviewUrl(imageSrc, regionsForPreview);
        
        // 清理旧的预览 URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        
        setPreviewUrl(url);
      } catch (error) {
        console.error('Failed to generate preview:', error);
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 300);
    
    // 清理函数
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [imageSrc, regions, blurIntensity, mosaicIntensity]);
  
  // 组件卸载时清理预览 URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  const getRelativePosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // 优先使用图片容器的尺寸，这样百分比坐标与图片显示一致
    const targetRef = imageContainerRef.current || containerRef.current;
    if (!targetRef) return { x: 0, y: 0 };
    
    const rect = targetRef.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 如果正在拖动或缩放，不处理
    if (isDragging || isResizing) return;
    
    e.preventDefault();
    const pos = getRelativePosition(e);
    setStartPos(pos);
    setIsDrawing(true);
    setSelectedRegionId(null);
    
    if (currentShape === "freehand" || currentShape === "lasso") {
      setDrawingPoints([pos]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getRelativePosition(e);
    
    // 处理旋转
    const targetRef = imageContainerRef.current || containerRef.current;
    if (isRotating && dragStartRegion && selectedRegionId && targetRef) {
      const rect = targetRef.getBoundingClientRect();
      // 计算区域中心点
      const centerX = rect.left + (dragStartRegion.x + dragStartRegion.width / 2) / 100 * rect.width;
      const centerY = rect.top + (dragStartRegion.y + dragStartRegion.height / 2) / 100 * rect.height;
      
      // 计算当前鼠标相对于中心的角度
      const clientX = e.clientX;
      const clientY = e.clientY;
      const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
      
      // 计算旋转增量
      const rotation = angle - rotateStartAngle + (dragStartRegion.rotation || 0);
      
      onRegionsChange(
        regions.map(r => 
          r.id === selectedRegionId 
            ? { ...r, rotation: rotation }
            : r
        )
      );
      return;
    }
    
    // 处理拖动
    if (isDragging && dragStartPos && dragStartRegion && selectedRegionId) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      
      const newX = Math.max(0, Math.min(100 - dragStartRegion.width, dragStartRegion.x + dx));
      const newY = Math.max(0, Math.min(100 - dragStartRegion.height, dragStartRegion.y + dy));
      
      onRegionsChange(
        regions.map(r => 
          r.id === selectedRegionId 
            ? { ...r, x: newX, y: newY }
            : r
        )
      );
      return;
    }
    
    // 处理缩放
    if (isResizing && dragStartPos && dragStartRegion && selectedRegionId) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      
      let newX = dragStartRegion.x;
      let newY = dragStartRegion.y;
      let newWidth = dragStartRegion.width;
      let newHeight = dragStartRegion.height;
      
      if (isResizing.includes('w')) {
        newX = Math.max(0, Math.min(dragStartRegion.x + dragStartRegion.width - 5, dragStartRegion.x + dx));
        newWidth = dragStartRegion.width - (newX - dragStartRegion.x);
      }
      if (isResizing.includes('e')) {
        newWidth = Math.max(5, Math.min(100 - dragStartRegion.x, dragStartRegion.width + dx));
      }
      if (isResizing.includes('n')) {
        newY = Math.max(0, Math.min(dragStartRegion.y + dragStartRegion.height - 5, dragStartRegion.y + dy));
        newHeight = dragStartRegion.height - (newY - dragStartRegion.y);
      }
      if (isResizing.includes('s')) {
        newHeight = Math.max(5, Math.min(100 - dragStartRegion.y, dragStartRegion.height + dy));
      }
      
      onRegionsChange(
        regions.map(r => 
          r.id === selectedRegionId 
            ? { ...r, x: newX, y: newY, width: newWidth, height: newHeight }
            : r
        )
      );
      return;
    }
    
    // 处理绘制
    if (!isDrawing || !startPos) return;
    
    if (currentShape === "freehand" || currentShape === "lasso") {
      setDrawingPoints(prev => [...prev, pos]);
    } else {
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const width = Math.abs(pos.x - startPos.x);
      const height = Math.abs(pos.y - startPos.y);
      setCurrentRect({ x, y, width, height });
    }
  };

  const handleMouseUp = () => {
    // 结束拖动/缩放/旋转
    if (isDragging || isResizing || isRotating) {
      setIsDragging(false);
      setIsResizing(null);
      setIsRotating(false);
      setDragStartPos(null);
      setDragStartRegion(null);
      setRotateStartAngle(0);
      return;
    }
    
    if (currentShape === "freehand" || currentShape === "lasso") {
      if (drawingPoints.length > 5) {
        // 生成 SVG path
        const path = pointsToSvgPath(drawingPoints, currentShape === "lasso");
        const bounds = getPointsBounds(drawingPoints);
        
        const newRegion: MaskRegionWithPrice = {
          id: `region-${Date.now()}`,
          shape: currentShape,
          style: currentStyle,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          path,
          points: drawingPoints,
          price: showPrice ? defaultPrice : undefined,
          stickerUrl: currentStyle === "sticker" ? currentSticker : undefined,
          blurIntensity: currentStyle === "blur" ? blurIntensity : undefined,
          mosaicIntensity: currentStyle === "mosaic" ? mosaicIntensity : undefined,
        };
        onRegionsChange([...regions, newRegion]);
      }
      setDrawingPoints([]);
    } else if (currentRect && currentRect.width > 2 && currentRect.height > 2) {
      const newRegion: MaskRegionWithPrice = {
        id: `region-${Date.now()}`,
        shape: currentShape,
        style: currentStyle,
        ...currentRect,
        price: showPrice ? defaultPrice : undefined,
        stickerUrl: currentStyle === "sticker" ? currentSticker : undefined,
        blurIntensity: currentStyle === "blur" ? blurIntensity : undefined,
        mosaicIntensity: currentStyle === "mosaic" ? mosaicIntensity : undefined,
      };
      onRegionsChange([...regions, newRegion]);
    }
    
    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  // 开始拖动区域
  const handleRegionDragStart = (e: React.MouseEvent, region: MaskRegionWithPrice) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedRegionId(region.id);
    setIsDragging(true);
    setDragStartPos(getRelativePosition(e));
    setDragStartRegion(region);
  };

  // 开始缩放区域
  const handleResizeStart = (e: React.MouseEvent, region: MaskRegionWithPrice, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedRegionId(region.id);
    setIsResizing(handle);
    setDragStartPos(getRelativePosition(e));
    setDragStartRegion(region);
  };

  // 开始旋转区域
  const handleRotateStart = (e: React.MouseEvent, region: MaskRegionWithPrice) => {
    e.stopPropagation();
    e.preventDefault();
    const targetRef = imageContainerRef.current || containerRef.current;
    if (!targetRef) return;
    
    const rect = targetRef.getBoundingClientRect();
    // 计算区域中心点
    const centerX = rect.left + (region.x + region.width / 2) / 100 * rect.width;
    const centerY = rect.top + (region.y + region.height / 2) / 100 * rect.height;
    
    // 计算初始角度
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    
    setSelectedRegionId(region.id);
    setIsRotating(true);
    setRotateStartAngle(angle - (region.rotation || 0));
    setDragStartRegion(region);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const pos = getRelativePosition(e);
    setStartPos(pos);
    setIsDrawing(true);
    setSelectedRegionId(null);
    
    if (currentShape === "freehand" || currentShape === "lasso") {
      setDrawingPoints([pos]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawing || !startPos) return;
    
    const pos = getRelativePosition(e);
    
    if (currentShape === "freehand" || currentShape === "lasso") {
      setDrawingPoints(prev => [...prev, pos]);
    } else {
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const width = Math.abs(pos.x - startPos.x);
      const height = Math.abs(pos.y - startPos.y);
      setCurrentRect({ x, y, width, height });
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const deleteRegion = (id: string) => {
    onRegionsChange(regions.filter((r) => r.id !== id));
    setSelectedRegionId(null);
  };

  const clearAllRegions = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      onRegionsChange([]);
    }
    setSelectedRegionId(null);
  };

  const updateRegionPrice = (id: string, price: number) => {
    onRegionsChange(
      regions.map((r) =>
        r.id === id ? { ...r, price: Math.max(1, price) } : r
      )
    );
  };

  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setCurrentSticker(url);
    setCurrentStyle("sticker");
    
    if (stickerInputRef.current) {
      stickerInputRef.current.value = "";
    }
  };

  // 生成 SVG path
  const pointsToSvgPath = (points: { x: number; y: number }[], close: boolean): string => {
    if (points.length < 2) return "";
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    if (close) {
      path += " Z";
    }
    return path;
  };

  // 获取点集的边界
  const getPointsBounds = (points: { x: number; y: number }[]) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // 渲染当前绘制中的形状
  const renderCurrentDrawing = () => {
    if (currentShape === "freehand" || currentShape === "lasso") {
      if (drawingPoints.length < 2) return null;
      const path = pointsToSvgPath(drawingPoints, false);
      return (
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={path}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.5"
            strokeDasharray="1"
          />
        </svg>
      );
    }

    if (!currentRect) return null;

    if (currentShape === "circle") {
      return (
        <div
          className="absolute bg-primary/50 border-2 border-dashed border-primary rounded-full"
          style={{
            left: `${currentRect.x}%`,
            top: `${currentRect.y}%`,
            width: `${currentRect.width}%`,
            height: `${currentRect.height}%`,
          }}
        />
      );
    }

    return (
      <div
        className="absolute bg-primary/50 border-2 border-dashed border-primary"
        style={{
          left: `${currentRect.x}%`,
          top: `${currentRect.y}%`,
          width: `${currentRect.width}%`,
          height: `${currentRect.height}%`,
        }}
      />
    );
  };

  // 渲染已保存的区域 - 统一所有形状类型的控制功能
  const renderRegion = (region: MaskRegionWithPrice) => {
    const isSelected = selectedRegionId === region.id;
    const rotation = region.rotation || 0;
    
    // 所有形状都使用统一的边界框定位
    const baseStyle = {
      left: `${region.x}%`,
      top: `${region.y}%`,
      width: `${region.width}%`,
      height: `${region.height}%`,
    };

    // Canvas 预览模式：不再渲染 CSS 遮罩效果，只显示区域边框
    // 遮罩效果由 Canvas 预览图统一处理
    const renderMaskContent = () => {
      // 显示半透明区域指示（让用户知道这是遮罩区域）
      if (region.shape === "circle") {
        return (
          <div className="absolute inset-0 rounded-full bg-primary/20" />
        );
      }
      
      if ((region.shape === "freehand" || region.shape === "lasso") && region.path) {
        const transformedPath = region.points?.map((p, i) => {
          const relX = ((p.x - region.x) / region.width) * 100;
          const relY = ((p.y - region.y) / region.height) * 100;
          return `${i === 0 ? 'M' : 'L'} ${relX} ${relY}`;
        }).join(' ') + (region.shape === "lasso" ? ' Z' : '');
        
        return (
          <svg 
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d={transformedPath}
              fill="hsl(var(--primary) / 0.2)"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
            />
          </svg>
        );
      }
      
      // 矩形默认
      return (
        <div className="absolute inset-0 rounded-sm bg-primary/20" />
      );
    };
    
    return (
      <div
        key={region.id}
        className={cn(
          "absolute border-2 transition-colors group",
          isSelected ? "border-destructive z-20" : "border-primary z-10",
          region.shape === "circle" ? "rounded-full" : "rounded-sm"
        )}
        style={{
          ...baseStyle,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
        }}
      >
        {/* 遮罩内容 */}
        {renderMaskContent()}
        
        {/* 可拖动区域 - 覆盖整个区域用于拖动 */}
        <div 
          className="absolute inset-0 cursor-move"
          onMouseDown={(e) => handleRegionDragStart(e, region)}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRegionId(region.id);
          }}
        />
        
        {/* 选中时显示控制手柄 - 所有形状通用 */}
        {isSelected && (
          <>
            {/* 四角缩放手柄 */}
            <div 
              className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-destructive rounded-sm cursor-nw-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, region, 'nw')}
            />
            <div 
              className="absolute -right-1.5 -top-1.5 w-3 h-3 bg-destructive rounded-sm cursor-ne-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, region, 'ne')}
            />
            <div 
              className="absolute -left-1.5 -bottom-1.5 w-3 h-3 bg-destructive rounded-sm cursor-sw-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, region, 'sw')}
            />
            <div 
              className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-destructive rounded-sm cursor-se-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, region, 'se')}
            />
            
            {/* 旋转手柄 - 顶部中央上方 */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-8 flex flex-col items-center">
              <div className="w-px h-4 bg-destructive" />
              <div 
                className="w-4 h-4 rounded-full bg-destructive cursor-grab hover:scale-125 transition-transform flex items-center justify-center shadow-md"
                onMouseDown={(e) => handleRotateStart(e, region)}
              >
                <svg className="w-2.5 h-2.5 text-destructive-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                  <path d="M21 3v9h-9" />
                </svg>
              </div>
            </div>
          </>
        )}
        
        {/* 删除按钮 - 所有形状通用 */}
        <button
          type="button"
          className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            deleteRegion(region.id);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        
        {/* 价格标签 */}
        {showPrice && region.price !== undefined && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full">
            <div className="flex items-center gap-1 bg-background/95 rounded px-1.5 py-0.5 shadow-sm border text-xs">
              <Coins className="h-3 w-3 text-primary" />
              <span className="font-medium">{region.price}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const CurrentShapeIcon = SHAPE_OPTIONS.find(s => s.value === currentShape)?.icon || Square;
  const CurrentStyleIcon = STYLE_OPTIONS.find(s => s.value === currentStyle)?.icon || Palette;

  return (
    <div className={cn("space-y-3", className)}>
      {/* 工具栏（可隐藏） */}
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 形状选择 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CurrentShapeIcon className="h-4 w-4" />
                  <span className="text-xs">{SHAPE_OPTIONS.find(s => s.value === currentShape)?.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs">选择形状</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SHAPE_OPTIONS.map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setCurrentShape(opt.value)}
                    className={cn(currentShape === opt.value && "bg-primary/10")}
                  >
                    <opt.icon className="h-4 w-4 mr-2" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 样式选择 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CurrentStyleIcon className="h-4 w-4" />
                  <span className="text-xs">{STYLE_OPTIONS.find(s => s.value === currentStyle)?.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs">遮罩样式</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STYLE_OPTIONS.map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setCurrentStyle(opt.value)}
                    className={cn(currentStyle === opt.value && "bg-primary/10")}
                  >
                    <opt.icon className="h-4 w-4 mr-2" />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 马赛克强度滑块（仅在马赛克模式下显示） */}
            {currentStyle === "mosaic" && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border bg-background">
                <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">强度</span>
                <Slider
                  value={[mosaicIntensity]}
                  onValueChange={([val]) => setInternalMosaicIntensity(val)}
                  min={5}
                  max={50}
                  step={1}
                  className="w-20"
                />
                <span className="text-xs font-medium w-5 text-center">{mosaicIntensity}</span>
              </div>
            )}

            {/* 模糊强度滑块（仅在模糊模式下显示） */}
            {currentStyle === "blur" && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border bg-background">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">强度</span>
                <Slider
                  value={[blurIntensity]}
                  onValueChange={([val]) => setInternalBlurIntensity(val)}
                  min={5}
                  max={50}
                  step={1}
                  className="w-20"
                />
                <span className="text-xs font-medium w-5 text-center">{blurIntensity}</span>
              </div>
            )}

            {/* 贴纸选择（仅在贴纸模式下显示） */}
            {currentStyle === "sticker" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <img src={currentSticker} alt="" className="h-4 w-4 object-contain" />
                    <span className="text-xs">贴纸</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel className="text-xs">预设贴纸</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="grid grid-cols-4 gap-1 p-1">
                    {PRESET_STICKERS.map(sticker => (
                      <button
                        key={sticker.id}
                        className={cn(
                          "p-1.5 rounded hover:bg-muted transition-colors",
                          currentSticker === sticker.url && "bg-primary/10 ring-1 ring-primary"
                        )}
                        onClick={() => setCurrentSticker(sticker.url)}
                      >
                        <img src={sticker.url} alt={sticker.name} className="h-6 w-6 object-contain" />
                      </button>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => stickerInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    上传自定义贴纸
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {regions.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllRegions}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              清除全部
            </Button>
          )}
        </div>
      )}

      <input
        ref={stickerInputRef}
        type="file"
        accept="image/*"
        onChange={handleStickerUpload}
        className="hidden"
      />
      
      <div className="text-xs text-muted-foreground">
        在图片上{currentShape === "freehand" || currentShape === "lasso" ? "拖动绘制" : "框选"}遮挡区域
      </div>
      
      <div
        ref={containerRef}
        className="relative cursor-crosshair select-none rounded-lg overflow-hidden bg-muted"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 图片容器 - 使用相对定位确保区域覆盖层与图片对齐 */}
        <div ref={imageContainerRef} className="relative">
          {/* 显示 Canvas 预览图（如果有区域）或原图 */}
          <img
            src={previewUrl && regions.length > 0 ? previewUrl : imageSrc}
            alt="编辑遮挡区域"
            className={cn(
              "w-full h-auto pointer-events-none transition-opacity block",
              isGeneratingPreview && "opacity-70"
            )}
            draggable={false}
          />
          
          {/* 区域覆盖层 - 绝对定位覆盖图片，确保百分比坐标正确 */}
          <div className="absolute inset-0">
            {/* 生成预览时显示加载指示 */}
            {isGeneratingPreview && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                <div className="text-xs text-muted-foreground">生成预览...</div>
              </div>
            )}
            
            {/* 区域边框和控制手柄（用于编辑，不显示遮罩效果） */}
            {regions.map(renderRegion)}
            
            {/* 当前绘制的区域 */}
            {isDrawing && renderCurrentDrawing()}
          </div>
        </div>
      </div>
      
      {/* 区域列表（分区域模式显示价格编辑） */}
      {showPrice && regions.length > 0 && (
        <div className="space-y-2 mt-3">
          <p className="text-xs text-muted-foreground">区域定价：</p>
          <div className="grid grid-cols-2 gap-2">
            {regions.map((region, index) => (
              <div
                key={region.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border bg-muted/30",
                  selectedRegionId === region.id && "border-primary"
                )}
                onClick={() => setSelectedRegionId(region.id)}
              >
                <span className="text-xs font-medium min-w-[3rem]">
                  区域 {index + 1}
                </span>
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={region.price || defaultPrice}
                    onChange={(e) =>
                      updateRegionPrice(region.id, parseInt(e.target.value) || 1)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 text-xs w-16"
                  />
                  <Coins className="h-3 w-3 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRegion(region.id);
                  }}
                  className="text-destructive hover:text-destructive/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        已添加 {regions.length} 个遮挡区域
      </p>
    </div>
  );
}
