import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ImagePlus, 
  X, 
  Lock,
  Video,
  MapPin,
  FileText,
  Save,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCreatePost, type UnlockSettings } from "@/hooks/useCreatePost";
import { useIdentity } from "@/contexts/IdentityContext";
import { cn } from "@/lib/utils";
import { type MultiImageMaskConfig } from "./MultiImageMaskEditor";
import { VisibilitySelector } from "@/components/ui/visibility-selector";
import { ImageViewer } from "@/components/ui/image-viewer";
import { VideoViewer } from "@/components/ui/video-player";
import { MentionPicker, MentionPickerRef, MentionUser } from "@/components/ui/mention-picker";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { toast } from "@/hooks/use-toast";
import { useDrafts, Draft, DraftMediaItem } from "@/hooks/useDrafts";
import { DraftsSheet } from "./DraftsSheet";
import { SchedulePostPicker } from "./SchedulePostPicker";
import { Json } from "@/integrations/supabase/types";

interface PostEditorProps {
  onSuccess?: () => void;
  className?: string;
}

interface LocationInfo {
  latitude: number;
  longitude: number;
  locationName?: string;
}

// 用于保存编辑器状态的 key
const EDITOR_STATE_KEY = "post_editor_state";
const EDITOR_FILES_KEY = "post_editor_files";

interface SavedEditorState {
  content: string;
  visibility: "public" | "followers" | "friends" | "private";
  enableUnlock: boolean;
  maskConfig: MultiImageMaskConfig;
  timestamp: number;
  // 图片 data URLs（用于恢复预览）
  imageDataUrls: string[];
  // 位置信息
  location?: LocationInfo;
  // 定时发布
  scheduledAt?: string;
}

export function PostEditor({ onSuccess, className }: PostEditorProps) {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { currentIdentity } = useIdentity();
  const { createPost, isLoading, uploadProgress } = useCreatePost();
  const { getCurrentLocation, permissionStatus } = useLocationPermission();
  const { saveDraft, isSaving } = useDrafts();
  
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "friends" | "private">("public");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPickerRef = useRef<MentionPickerRef>(null);

  // Mention 相关状态
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  
  // 位置状态
  const [postLocation, setPostLocation] = useState<LocationInfo | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  // 解锁设置
  const [enableUnlock, setEnableUnlock] = useState(false);
  const [maskConfig, setMaskConfig] = useState<MultiImageMaskConfig>({
    unlockMode: "unified",
    unifiedPrice: 10,
    images: [],
  });
  
  // 草稿相关
  const [showDraftsSheet, setShowDraftsSheet] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  
  // 定时发布
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // 从 MaskSettings 页面返回时恢复状态
  useEffect(() => {
    const state = routeLocation.state as { maskConfig?: MultiImageMaskConfig; fromMaskSettings?: boolean } | null;
    console.log('[PostEditor] location.state:', state);
    
    if (state?.fromMaskSettings && state.maskConfig) {
      console.log('[PostEditor] Restoring from MaskSettings, config:', state.maskConfig);
      setMaskConfig(state.maskConfig);
      
      // 如果有打码区域，自动启用解锁
      const hasMasks = state.maskConfig.images.some(img => img.regions.length > 0);
      console.log('[PostEditor] hasMasks:', hasMasks);
      if (hasMasks) {
        setEnableUnlock(true);
      }
      
      // 恢复保存的编辑器状态
      try {
        const savedState = sessionStorage.getItem(EDITOR_STATE_KEY);
        console.log('[PostEditor] savedState from sessionStorage:', savedState ? 'found' : 'not found');
        
        if (savedState) {
          const parsed: SavedEditorState = JSON.parse(savedState);
          console.log('[PostEditor] parsed state:', { 
            content: parsed.content?.length,
            imageCount: parsed.imageDataUrls?.length,
            timestamp: parsed.timestamp
          });
          
          // 检查是否在5分钟内保存的
          if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            setContent(parsed.content);
            setVisibility(parsed.visibility);
            
            // 恢复位置
            if (parsed.location) {
              setPostLocation(parsed.location);
            }
            
            // 恢复定时发布
            if (parsed.scheduledAt) {
              setScheduledAt(new Date(parsed.scheduledAt));
            }
            
            // 恢复图片预览 - 使用保存的 data URLs
            if (parsed.imageDataUrls && parsed.imageDataUrls.length > 0) {
              console.log('[PostEditor] Restoring images:', parsed.imageDataUrls.length);
              setImagePreviews(parsed.imageDataUrls);
              
              // 将 data URLs 转换回 File 对象
              Promise.all(
                parsed.imageDataUrls.map(async (dataUrl, index) => {
                  const response = await fetch(dataUrl);
                  const blob = await response.blob();
                  return new File([blob], `image-${index}.jpg`, { type: blob.type || 'image/jpeg' });
                })
              ).then(files => {
                console.log('[PostEditor] Restored files:', files.length);
                setImages(files);
              }).catch(err => {
                console.error('[PostEditor] Failed to restore files:', err);
              });
            }
          }
          sessionStorage.removeItem(EDITOR_STATE_KEY);
        }
      } catch (e) {
        console.error("[PostEditor] Failed to restore editor state:", e);
      }
      
      // 清除 location state
      window.history.replaceState({}, document.title);
    }
  }, [routeLocation.state]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 限制最多9张图片
    const remainingSlots = 9 - images.length;
    const filesToAdd = files.slice(0, remainingSlots);

    // 生成预览
    const newPreviews = filesToAdd.map((file) => URL.createObjectURL(file));
    
    setImages((prev) => [...prev, ...filesToAdd]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);

    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    
    // 同时更新打码配置，移除该图片的打码区域
    setMaskConfig((prev) => ({
      ...prev,
      images: prev.images
        .filter((img) => img.imageIndex !== index)
        .map((img) => ({
          ...img,
          // 调整索引
          imageIndex: img.imageIndex > index ? img.imageIndex - 1 : img.imageIndex,
        })),
    }));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制视频大小为100MB
    if (file.size > 100 * 1024 * 1024) {
      return;
    }

    // 清除之前的视频预览
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    // 选择视频时清除图片
    images.forEach((_, i) => URL.revokeObjectURL(imagePreviews[i]));
    setImages([]);
    setImagePreviews([]);
    setMaskConfig({ unlockMode: "unified", unifiedPrice: 10, images: [] });

    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideo(null);
    setVideoPreview(null);
  };

  // 跳转到打码设置页面
  const handleOpenMaskSettings = async () => {
    // 将图片预览转换为 data URLs（用于持久化存储）
    const imageDataUrls: string[] = [];
    for (const preview of imagePreviews) {
      try {
        // 如果已经是 data URL，直接使用
        if (preview.startsWith('data:')) {
          imageDataUrls.push(preview);
        } else {
          // 将 blob URL 转换为 data URL
          const response = await fetch(preview);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          imageDataUrls.push(dataUrl);
        }
      } catch (e) {
        console.error('Failed to convert image to data URL:', e);
      }
    }

    // 保存当前编辑器状态到 sessionStorage
    const stateToSave: SavedEditorState = {
      content,
      visibility,
      enableUnlock,
      maskConfig,
      timestamp: Date.now(),
      imageDataUrls,
      location: postLocation || undefined,
      scheduledAt: scheduledAt?.toISOString(),
    };
    sessionStorage.setItem(EDITOR_STATE_KEY, JSON.stringify(stateToSave));
    
    // 跳转到打码设置页面
    navigate("/post/mask-settings", {
      state: {
        imagePreviews,
        maskConfig,
        returnPath: "/post/create",
      },
    });
  };

  const handleSubmit = () => {
    if (!content.trim() && images.length === 0 && !video) {
      return;
    }

    if (!currentIdentity?.profile) {
      return;
    }

    // 检查是否有打码区域
    const hasMaskRegions = maskConfig.images.some(img => img.regions.length > 0);

    // 构建 unlockSettings
    const unlockSettings: UnlockSettings | undefined = 
      enableUnlock && images.length > 0 && hasMaskRegions
        ? {
            unlockMode: maskConfig.unlockMode,
            unifiedPrice: maskConfig.unifiedPrice,
            images: maskConfig.images,
          }
        : undefined;

    createPost(
      {
        content: content.trim(),
        visibility,
        images,
        video: video || undefined,
        authorId: currentIdentity.profile.id,
        unlockSettings,
        location: postLocation || undefined,
        scheduledAt: scheduledAt || undefined,
      },
      {
        onSuccess: () => {
          setContent("");
          setImages([]);
          imagePreviews.forEach((url) => URL.revokeObjectURL(url));
          setImagePreviews([]);
          if (videoPreview) URL.revokeObjectURL(videoPreview);
          setVideo(null);
          setVideoPreview(null);
          setEnableUnlock(false);
          setMaskConfig({ unlockMode: "unified", unifiedPrice: 10, images: [] });
          setPostLocation(null);
          setScheduledAt(null);
          onSuccess?.();
        },
      }
    );
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!content.trim() && images.length === 0 && !video) {
      toast({ title: "没有可保存的内容" });
      return;
    }

    // 将图片/视频预览转换为 data URLs
    const mediaData: DraftMediaItem[] = [];
    
    for (const preview of imagePreviews) {
      try {
        if (preview.startsWith('data:')) {
          mediaData.push({ url: preview, type: "image" });
        } else {
          const response = await fetch(preview);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          mediaData.push({ url: dataUrl, type: "image" });
        }
      } catch (e) {
        console.error('Failed to convert image to data URL:', e);
      }
    }

    if (videoPreview) {
      // 视频只保存预览链接（太大无法保存为 data URL）
      mediaData.push({ url: videoPreview, type: "video" });
    }

    saveDraft({
      content: content.trim(),
      visibility,
      mediaData,
      unlockSettings: enableUnlock ? (maskConfig as unknown as Json) : null,
      locationName: postLocation?.locationName,
      latitude: postLocation?.latitude,
      longitude: postLocation?.longitude,
      draftId: currentDraftId || undefined,
    });
  };

  // 加载草稿
  const handleLoadDraft = async (draft: Draft) => {
    setContent(draft.content || "");
    setVisibility((draft.visibility as "public" | "followers" | "friends" | "private") || "public");
    setCurrentDraftId(draft.id);

    // 加载位置
    if (draft.location_name && draft.latitude && draft.longitude) {
      setPostLocation({
        latitude: draft.latitude,
        longitude: draft.longitude,
        locationName: draft.location_name,
      });
    } else {
      setPostLocation(null);
    }

    // 加载媒体
    const imageUrls: string[] = [];
    const imageFiles: File[] = [];
    
    for (const media of draft.media_data || []) {
      if (media.type === "image" && media.url) {
        imageUrls.push(media.url);
        // 将 data URL 转换为 File
        try {
          const response = await fetch(media.url);
          const blob = await response.blob();
          imageFiles.push(new File([blob], `image-${imageFiles.length}.jpg`, { type: blob.type || 'image/jpeg' }));
        } catch (e) {
          console.error('Failed to convert data URL to file:', e);
        }
      } else if (media.type === "video" && media.url) {
        setVideoPreview(media.url);
      }
    }

    setImagePreviews(imageUrls);
    setImages(imageFiles);

    // 加载解锁设置
    if (draft.unlock_settings) {
      setEnableUnlock(true);
      setMaskConfig(draft.unlock_settings as unknown as MultiImageMaskConfig);
    } else {
      setEnableUnlock(false);
      setMaskConfig({ unlockMode: "unified", unifiedPrice: 10, images: [] });
    }
  };

  const canSubmit = (content.trim() || images.length > 0 || video) && !isLoading;
  const hasMaskRegions = maskConfig.images.some(img => img.regions.length > 0);
  const canSaveDraft = (content.trim() || images.length > 0 || video) && !isSaving;
  
  // 图片/视频查看器状态
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);

  // 获取位置
  const handleGetLocation = async () => {
    if (permissionStatus === "denied") {
      toast({
        variant: "destructive",
        title: "位置权限被拒绝",
        description: "请在浏览器设置中允许位置访问",
      });
      return;
    }

    setIsLoadingLocation(true);
    try {
      const pos = await getCurrentLocation();
      if (pos) {
        // 使用 OpenStreetMap 反向地理编码获取地名
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.latitude}&lon=${pos.longitude}&accept-language=zh-CN`
          );
          const data = await response.json();
          
          // 提取简短的地名
          let locationName = "";
          if (data.address) {
            const { city, county, district, suburb, neighbourhood, town, village } = data.address;
            locationName = city || county || district || suburb || neighbourhood || town || village || "";
          }
          
          setPostLocation({
            latitude: pos.latitude,
            longitude: pos.longitude,
            locationName: locationName || `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`,
          });
          toast({ title: "已添加位置" });
        } catch {
          setPostLocation({
            latitude: pos.latitude,
            longitude: pos.longitude,
            locationName: `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`,
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "无法获取位置",
          description: "请检查位置权限设置",
        });
      }
    } catch (error) {
      console.error("Failed to get location:", error);
      toast({
        variant: "destructive",
        title: "获取位置失败",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const removeLocation = () => {
    setPostLocation(null);
  };
  // 检测 @ 输入
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newContent);

    // 查找光标前最近的 @
    const textBeforeCursor = newContent.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // 检查 @ 后面是否只有字母数字下划线（正在输入用户名）
      if (/^[\w]*$/.test(textAfterAt) && !textAfterAt.includes(" ")) {
        setShowMentionPicker(true);
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        return;
      }
    }

    setShowMentionPicker(false);
    setMentionQuery("");
    setMentionStartPos(-1);
  }, []);

  // 选择提及用户
  const handleMentionSelect = useCallback((user: MentionUser) => {
    if (mentionStartPos === -1) return;

    const before = content.slice(0, mentionStartPos);
    const cursorPos = textareaRef.current?.selectionStart || content.length;
    const after = content.slice(cursorPos);

    const newContent = `${before}@${user.unique_username} ${after}`;
    setContent(newContent);
    setShowMentionPicker(false);
    setMentionQuery("");
    setMentionStartPos(-1);

    // 聚焦并移动光标
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const newPos = before.length + user.unique_username.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [content, mentionStartPos]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showMentionPicker && mentionPickerRef.current?.handleKeyDown(e)) {
      return;
    }
  }, [showMentionPicker]);

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      {/* 头部：头像 + 可见性选择 + 右侧工具栏 */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={currentIdentity?.profile?.avatar_url || ""} />
          <AvatarFallback>
            {currentIdentity?.profile?.display_name?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {currentIdentity?.profile?.display_name || currentIdentity?.profile?.unique_username}
          </p>
          <VisibilitySelector
            value={visibility}
            onChange={setVisibility}
            size="sm"
            disabled={isLoading}
          />
        </div>

        {/* 右侧工具栏：解锁设置 + 媒体按钮 + 发布 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 解锁设置 - 仅在有图片时显示 */}
          {images.length > 0 && (
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={handleOpenMaskSettings}
            >
              <Lock className={cn("h-4 w-4", enableUnlock ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm", enableUnlock ? "text-primary font-medium" : "text-muted-foreground")}>付费观看</span>
              {enableUnlock && hasMaskRegions && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground font-medium">
                  {maskConfig.images.reduce((sum, img) => sum + img.regions.length, 0)}区域
                </span>
              )}
              <Switch
                checked={enableUnlock}
                onCheckedChange={(checked) => {
                  setEnableUnlock(checked);
                  if (checked) {
                    handleOpenMaskSettings();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          )}

          {/* 媒体按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
            disabled={isLoading || images.length >= 9 || !!video}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
            disabled={isLoading || !!video || images.length > 0}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || images.length >= 9 || !!video}
            className="gap-1 h-8 px-2"
          >
            <ImagePlus className="h-4 w-4" />
            <span className="text-xs">
              {images.length > 0 ? `${images.length}/9` : "图片"}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => videoInputRef.current?.click()}
            disabled={isLoading || !!video || images.length > 0}
            className="gap-1 h-8 px-2"
          >
            <Video className="h-4 w-4" />
            <span className="text-xs">
              {video ? "已选择" : "视频"}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGetLocation}
            disabled={isLoading || isLoadingLocation}
            className={cn("gap-1 h-8 px-2", postLocation && "text-primary")}
          >
            {isLoadingLocation ? (
              <LoadingSpinner size="sm" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            <span className="text-xs">
              {postLocation ? "已定位" : "位置"}
            </span>
          </Button>

          {/* 定时发布 */}
          <SchedulePostPicker
            value={scheduledAt}
            onChange={setScheduledAt}
            disabled={isLoading}
          />

          {/* 草稿箱按钮 */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDraftsSheet(true)}
            className="gap-1 h-8 px-2"
          >
            <FileText className="h-4 w-4" />
            <span className="text-xs">草稿</span>
          </Button>

          {/* 保存草稿按钮 */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSaveDraft}
            disabled={!canSaveDraft}
            className="gap-1 h-8 px-2"
          >
            {isSaving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="text-xs">保存</span>
          </Button>

          {/* 发布按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="sm"
            className="px-4 h-8"
          >
            {isLoading ? (
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
      </div>

      {/* 内容输入 */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="分享你的想法... 输入 @ 可提及好友"
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          className="min-h-[100px] resize-none border-none bg-transparent p-0 focus-visible:ring-0 text-base"
          disabled={isLoading}
        />

        {/* @ 提及选择器 */}
        {showMentionPicker && (
          <MentionPicker
            ref={mentionPickerRef}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionPicker(false)}
            className="top-full mt-1 left-0"
          />
        )}
      </div>

      {/* 位置显示 */}
      {postLocation && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span>{postLocation.locationName}</span>
          <button
            type="button"
            onClick={removeLocation}
            className="ml-auto p-1 hover:bg-muted rounded"
            disabled={isLoading}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 图片预览网格 */}
      {imagePreviews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
              <img
                src={preview}
                alt={`预览 ${index + 1}`}
                className="h-full w-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                onClick={() => setPreviewIndex(index)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background z-10"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </button>
              {/* 显示打码标记 */}
              {maskConfig.images.some(
                (img) => img.imageIndex === index && img.regions.length > 0
              ) && (
                <div className="absolute left-1 top-1 rounded-full bg-primary/80 p-1">
                  <Lock className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 视频预览 */}
      {videoPreview && (
        <div className="mt-3 relative rounded-lg overflow-hidden bg-muted">
          <video
            src={videoPreview}
            className="w-full max-h-[300px] object-contain cursor-pointer"
            onClick={() => setShowVideoViewer(true)}
          />
          <button
            type="button"
            onClick={removeVideo}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background z-10"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 上传进度 */}
      {isLoading && uploadProgress > 0 && (
        <div className="mt-3">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            上传中... {uploadProgress}%
          </p>
        </div>
      )}

      {/* 图片查看器 */}
      <ImageViewer
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={imagePreviews}
        initialIndex={previewIndex ?? 0}
      />

      {/* 视频查看器 */}
      <VideoViewer
        open={showVideoViewer}
        onClose={() => setShowVideoViewer(false)}
        src={videoPreview || ""}
      />

      {/* 草稿箱抽屉 */}
      <DraftsSheet
        open={showDraftsSheet}
        onOpenChange={setShowDraftsSheet}
        onSelectDraft={handleLoadDraft}
      />
    </div>
  );
}
