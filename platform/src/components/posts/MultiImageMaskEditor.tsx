import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { 
  ImageMaskEditor, 
  type MaskRegionWithPrice,
  SHAPE_OPTIONS,
  STYLE_OPTIONS,
  PRESET_STICKERS_LIST,
} from "./ImageMaskEditor";
import type { MaskShape, MaskStyle } from "./MaskOverlay";
import { 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Coins, 
  ChevronDown,
  Trash2,
  Droplets,
  Grid3X3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export type UnlockMode = "unified" | "per_region";

export interface ImageMaskConfig {
  imageIndex: number;
  regions: MaskRegionWithPrice[];
}

export interface MultiImageMaskConfig {
  unlockMode: UnlockMode;
  unifiedPrice: number;
  images: ImageMaskConfig[];
}

interface MultiImageMaskEditorProps {
  imagePreviews: string[];
  config: MultiImageMaskConfig;
  onConfigChange: (config: MultiImageMaskConfig) => void;
  className?: string;
}

export function MultiImageMaskEditor({
  imagePreviews,
  config,
  onConfigChange,
  className,
}: MultiImageMaskEditorProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentShape, setCurrentShape] = useState<MaskShape>("rectangle");
  const [currentStyle, setCurrentStyle] = useState<MaskStyle>("solid");
  const [currentSticker, setCurrentSticker] = useState<string>(PRESET_STICKERS_LIST[0].url);
  const [blurIntensity, setBlurIntensity] = useState(30);
  const [mosaicIntensity, setMosaicIntensity] = useState(30);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // 获取选中的区域
  const getSelectedRegion = (): MaskRegionWithPrice | null => {
    if (!selectedRegionId) return null;
    const imageConfig = config.images.find(img => img.imageIndex === currentImageIndex);
    return imageConfig?.regions.find(r => r.id === selectedRegionId) || null;
  };

  const selectedRegion = getSelectedRegion();

  // 确保当前索引有效，切换图片时清除选中
  useEffect(() => {
    if (currentImageIndex >= imagePreviews.length) {
      setCurrentImageIndex(Math.max(0, imagePreviews.length - 1));
    }
    setSelectedRegionId(null);
  }, [imagePreviews.length, currentImageIndex]);

  // 获取当前图片的打码区域
  const getCurrentImageRegions = (): MaskRegionWithPrice[] => {
    const imageConfig = config.images.find(
      (img) => img.imageIndex === currentImageIndex
    );
    return imageConfig?.regions || [];
  };

  // 更新当前图片的打码区域
  const updateCurrentImageRegions = (regions: MaskRegionWithPrice[]) => {
    const existingIndex = config.images.findIndex(
      (img) => img.imageIndex === currentImageIndex
    );

    let newImages: ImageMaskConfig[];
    if (existingIndex >= 0) {
      newImages = [...config.images];
      if (regions.length === 0) {
        newImages.splice(existingIndex, 1);
      } else {
        newImages[existingIndex] = { imageIndex: currentImageIndex, regions };
      }
    } else if (regions.length > 0) {
      newImages = [
        ...config.images,
        { imageIndex: currentImageIndex, regions },
      ];
    } else {
      newImages = config.images;
    }

    onConfigChange({ ...config, images: newImages });
  };

  // 更新解锁模式
  const handleUnlockModeChange = (mode: UnlockMode) => {
    onConfigChange({ ...config, unlockMode: mode });
  };

  // 更新统一价格
  const handleUnifiedPriceChange = (price: number) => {
    onConfigChange({ ...config, unifiedPrice: Math.max(1, price) });
  };

  // 清除所有区域
  const handleClearAll = () => {
    onConfigChange({ ...config, images: [] });
    setSelectedRegionId(null);
  };

  // 更新选中区域的样式
  const updateSelectedRegionStyle = (style: MaskStyle, sticker?: string) => {
    if (!selectedRegionId) return;
    
    const imageConfig = config.images.find(img => img.imageIndex === currentImageIndex);
    if (!imageConfig) return;
    
    const updatedRegions = imageConfig.regions.map(r => {
      if (r.id === selectedRegionId) {
        return {
          ...r,
          style,
          stickerUrl: style === "sticker" ? (sticker || currentSticker) : undefined,
          blurIntensity: style === "blur" ? blurIntensity : undefined,
          mosaicIntensity: style === "mosaic" ? mosaicIntensity : undefined,
        };
      }
      return r;
    });
    
    const newImages = config.images.map(img => 
      img.imageIndex === currentImageIndex 
        ? { ...img, regions: updatedRegions }
        : img
    );
    
    onConfigChange({ ...config, images: newImages });
  };

  // 更新选中区域的模糊/马赛克强度
  const updateSelectedRegionIntensity = (type: 'blur' | 'mosaic', value: number) => {
    if (!selectedRegionId) return;
    
    const imageConfig = config.images.find(img => img.imageIndex === currentImageIndex);
    if (!imageConfig) return;
    
    const updatedRegions = imageConfig.regions.map(r => {
      if (r.id === selectedRegionId) {
        return {
          ...r,
          [type === 'blur' ? 'blurIntensity' : 'mosaicIntensity']: value,
        };
      }
      return r;
    });
    
    const newImages = config.images.map(img => 
      img.imageIndex === currentImageIndex 
        ? { ...img, regions: updatedRegions }
        : img
    );
    
    onConfigChange({ ...config, images: newImages });
  };

  // 处理样式变更 - 如果有选中区域则更新区域，否则设置默认样式
  const handleStyleChange = (style: MaskStyle) => {
    if (selectedRegion) {
      updateSelectedRegionStyle(style);
    }
    setCurrentStyle(style);
  };

  // 处理贴纸变更
  const handleStickerChange = (sticker: string) => {
    if (selectedRegion) {
      updateSelectedRegionStyle("sticker", sticker);
    }
    setCurrentSticker(sticker);
  };

  // 处理模糊强度变更
  const handleBlurIntensityChange = (value: number) => {
    if (selectedRegion && selectedRegion.style === "blur") {
      updateSelectedRegionIntensity('blur', value);
    }
    setBlurIntensity(value);
  };

  // 处理马赛克强度变更
  const handleMosaicIntensityChange = (value: number) => {
    if (selectedRegion && selectedRegion.style === "mosaic") {
      updateSelectedRegionIntensity('mosaic', value);
    }
    setMosaicIntensity(value);
  };

  // 计算总打码区域数
  const totalRegions = config.images.reduce(
    (sum, img) => sum + img.regions.length,
    0
  );

  // 计算有打码的图片数
  const maskedImagesCount = config.images.filter(
    (img) => img.regions.length > 0
  ).length;

  const goToPrevious = () => {
    setCurrentImageIndex((prev) =>
      prev > 0 ? prev - 1 : imagePreviews.length - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) =>
      prev < imagePreviews.length - 1 ? prev + 1 : 0
    );
  };

  if (imagePreviews.length === 0) return null;

  // 当有选中区域时，显示该区域的样式；否则显示当前工具样式
  const displayStyle = selectedRegion?.style || currentStyle;
  const displayBlurIntensity = selectedRegion?.blurIntensity ?? blurIntensity;
  const displayMosaicIntensity = selectedRegion?.mosaicIntensity ?? mosaicIntensity;
  const displaySticker = selectedRegion?.stickerUrl || currentSticker;

  const CurrentShapeIcon = SHAPE_OPTIONS.find(s => s.value === currentShape)?.icon || SHAPE_OPTIONS[0].icon;
  const CurrentStyleIcon = STYLE_OPTIONS.find(s => s.value === displayStyle)?.icon || STYLE_OPTIONS[0].icon;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 顶部横向工具栏 - 所有选项在同一行 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 解锁模式下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {config.unlockMode === "unified" ? "统一解锁" : "分区域解锁"}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onClick={() => handleUnlockModeChange("unified")}
                className={cn(config.unlockMode === "unified" && "bg-primary/10")}
              >
                统一解锁
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleUnlockModeChange("per_region")}
                className={cn(config.unlockMode === "per_region" && "bg-primary/10")}
              >
                分区域解锁
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 统一价格设置（仅统一模式显示） */}
          {config.unlockMode === "unified" && (
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={10000}
                value={config.unifiedPrice}
                onChange={(e) =>
                  handleUnifiedPriceChange(parseInt(e.target.value) || 1)
                }
                className="w-16 h-8"
              />
              <span className="text-sm text-muted-foreground">金币</span>
            </div>
          )}

          {/* 分隔符 */}
          <div className="w-px h-6 bg-border" />

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
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                  "gap-1.5",
                  selectedRegion && "ring-2 ring-primary"
                )}
              >
                <CurrentStyleIcon className="h-4 w-4" />
                <span className="text-xs">{STYLE_OPTIONS.find(s => s.value === displayStyle)?.label}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs">
                {selectedRegion ? "更改选中区域样式" : "遮罩样式"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STYLE_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStyleChange(opt.value)}
                  className={cn(displayStyle === opt.value && "bg-primary/10")}
                >
                  <opt.icon className="h-4 w-4 mr-2" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 贴纸选择（仅在贴纸模式下显示） */}
          {displayStyle === "sticker" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <img src={displaySticker} alt="" className="h-4 w-4 object-contain" />
                  <span className="text-xs">贴纸</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-xs">预设贴纸</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="grid grid-cols-4 gap-1 p-1">
                  {PRESET_STICKERS_LIST.map(sticker => (
                    <button
                      key={sticker.id}
                      type="button"
                      className={cn(
                        "p-1.5 rounded hover:bg-muted transition-colors",
                        displaySticker === sticker.url && "bg-primary/10 ring-1 ring-primary"
                      )}
                      onClick={() => handleStickerChange(sticker.url)}
                    >
                      <img src={sticker.url} alt={sticker.name} className="h-6 w-6 object-contain" />
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 模糊强度滑块 */}
          {displayStyle === "blur" && (
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">强度</span>
              <Slider
                value={[displayBlurIntensity]}
                onValueChange={([v]) => handleBlurIntensityChange(v)}
                min={1}
                max={100}
                step={1}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground w-8">{displayBlurIntensity}</span>
            </div>
          )}

          {/* 马赛克强度滑块 */}
          {displayStyle === "mosaic" && (
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">强度</span>
              <Slider
                value={[displayMosaicIntensity]}
                onValueChange={([v]) => handleMosaicIntensityChange(v)}
                min={1}
                max={100}
                step={1}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground w-8">{displayMosaicIntensity}</span>
            </div>
          )}
        </div>

        {/* 清除全部按钮 */}
        {totalRegions > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-8 px-2 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            清除全部
          </Button>
        )}
      </div>

      {/* 多图导航（仅多图时显示） */}
      {imagePreviews.length > 1 && (
        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            {imagePreviews.map((_, index) => {
              const hasRegions = config.images.some(
                (img) => img.imageIndex === index && img.regions.length > 0
              );
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentImageIndex(index)}
                  className={cn(
                    "w-8 h-8 rounded-md overflow-hidden border-2 transition-colors relative",
                    index === currentImageIndex
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                >
                  <img
                    src={imagePreviews[index]}
                    alt={`图片 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {hasRegions && (
                    <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                      <Lock className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToNext}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 当前图片的打码编辑器（隐藏内部工具栏） */}
      <ImageMaskEditor
        imageSrc={imagePreviews[currentImageIndex]}
        regions={getCurrentImageRegions()}
        onRegionsChange={updateCurrentImageRegions}
        showPrice={config.unlockMode === "per_region"}
        defaultPrice={config.unifiedPrice}
        currentShape={currentShape}
        currentStyle={currentStyle}
        currentSticker={currentSticker}
        blurIntensity={blurIntensity}
        mosaicIntensity={mosaicIntensity}
        hideToolbar={true}
        selectedRegionId={selectedRegionId}
        onSelectedRegionChange={setSelectedRegionId}
      />

      {/* 统计信息 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        <span>
          已标记 {maskedImagesCount}/{imagePreviews.length} 张图片
        </span>
        <span>共 {totalRegions} 个打码区域</span>
      </div>
    </div>
  );
}
