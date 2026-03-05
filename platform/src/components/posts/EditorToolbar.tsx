import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  ImagePlus, 
  Lock,
  Video,
  MapPin,
  FileText,
  Save,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SchedulePostPicker } from "./SchedulePostPicker";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  // Image props
  imagesCount: number;
  hasVideo: boolean;
  isLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  videoInputRef: React.RefObject<HTMLInputElement>;
  onImageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  // Unlock props
  enableUnlock: boolean;
  hasMaskRegions: boolean;
  maskRegionsCount: number;
  onEnableUnlockChange: (checked: boolean) => void;
  onOpenMaskSettings: () => void;
  
  // Location props
  hasLocation: boolean;
  isLoadingLocation: boolean;
  onGetLocation: () => void;
  
  // Schedule props
  scheduledAt: Date | null;
  onScheduleChange: (date: Date | null) => void;
  
  // Draft props
  canSaveDraft: boolean;
  isSavingDraft: boolean;
  onOpenDrafts: () => void;
  onSaveDraft: () => void;
  
  // Submit props
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function EditorToolbar({
  imagesCount,
  hasVideo,
  isLoading,
  fileInputRef,
  videoInputRef,
  onImageInputChange,
  onVideoInputChange,
  enableUnlock,
  hasMaskRegions,
  maskRegionsCount,
  onEnableUnlockChange,
  onOpenMaskSettings,
  hasLocation,
  isLoadingLocation,
  onGetLocation,
  scheduledAt,
  onScheduleChange,
  canSaveDraft,
  isSavingDraft,
  onOpenDrafts,
  onSaveDraft,
  canSubmit,
  isSubmitting,
  onSubmit,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Unlock settings - only show when has images */}
      {imagesCount > 0 && (
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={onOpenMaskSettings}
        >
          <Lock className={cn("h-4 w-4", enableUnlock ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm", enableUnlock ? "text-primary font-medium" : "text-muted-foreground")}>付费观看</span>
          {enableUnlock && hasMaskRegions && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground font-medium">
              {maskRegionsCount}区域
            </span>
          )}
          <Switch
            checked={enableUnlock}
            onCheckedChange={(checked) => {
              onEnableUnlockChange(checked);
              if (checked) {
                onOpenMaskSettings();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onImageInputChange}
        className="hidden"
        disabled={isLoading || imagesCount >= 9 || hasVideo}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={onVideoInputChange}
        className="hidden"
        disabled={isLoading || hasVideo || imagesCount > 0}
      />

      {/* Image button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading || imagesCount >= 9 || hasVideo}
        className="gap-1 h-8 px-2"
      >
        <ImagePlus className="h-4 w-4" />
        <span className="text-xs">
          {imagesCount > 0 ? `${imagesCount}/9` : "图片"}
        </span>
      </Button>

      {/* Video button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => videoInputRef.current?.click()}
        disabled={isLoading || hasVideo || imagesCount > 0}
        className="gap-1 h-8 px-2"
      >
        <Video className="h-4 w-4" />
        <span className="text-xs">
          {hasVideo ? "已选择" : "视频"}
        </span>
      </Button>

      {/* Location button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onGetLocation}
        disabled={isLoading || isLoadingLocation}
        className={cn("gap-1 h-8 px-2", hasLocation && "text-primary")}
      >
        {isLoadingLocation ? (
          <LoadingSpinner size="sm" />
        ) : (
          <MapPin className="h-4 w-4" />
        )}
        <span className="text-xs">
          {hasLocation ? "已定位" : "位置"}
        </span>
      </Button>

      {/* Schedule picker */}
      <SchedulePostPicker
        value={scheduledAt}
        onChange={onScheduleChange}
        disabled={isLoading}
      />

      {/* Drafts button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenDrafts}
        className="gap-1 h-8 px-2"
      >
        <FileText className="h-4 w-4" />
        <span className="text-xs">草稿</span>
      </Button>

      {/* Save draft button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSaveDraft}
        disabled={!canSaveDraft}
        className="gap-1 h-8 px-2"
      >
        {isSavingDraft ? (
          <LoadingSpinner size="sm" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span className="text-xs">保存</span>
      </Button>

      {/* Submit button */}
      <Button
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        size="sm"
        className="px-4 h-8"
      >
        {isSubmitting ? (
          <>
            <LoadingSpinner size="sm" className="mr-1" />
            {scheduledAt ? "设置中" : "发布中"}
          </>
        ) : scheduledAt ? (
          "设置定时"
        ) : (
          "发布"
        )}
      </Button>
    </div>
  );
}
