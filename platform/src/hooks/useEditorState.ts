import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { type MultiImageMaskConfig } from "@/components/posts/MultiImageMaskEditor";
import { MentionPickerRef } from "@/components/ui/mention-picker";

const EDITOR_STATE_KEY = "post_editor_state";

interface LocationInfo {
  latitude: number;
  longitude: number;
  locationName?: string;
}

interface SavedEditorState {
  content: string;
  visibility: "public" | "followers" | "friends" | "private";
  enableUnlock: boolean;
  maskConfig: MultiImageMaskConfig;
  timestamp: number;
  imageDataUrls: string[];
  location?: LocationInfo;
  scheduledAt?: string;
}

export function useEditorState() {
  const routeLocation = useLocation();
  
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "friends" | "private">("public");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [postLocation, setPostLocation] = useState<LocationInfo | null>(null);
  const [enableUnlock, setEnableUnlock] = useState(false);
  const [maskConfig, setMaskConfig] = useState<MultiImageMaskConfig>({
    unlockMode: "unified",
    unifiedPrice: 10,
    images: [],
  });
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  
  // Mention state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  
  // Preview state
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [showDraftsSheet, setShowDraftsSheet] = useState(false);
  
  // Loading state
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPickerRef = useRef<MentionPickerRef>(null);

  // Restore state from MaskSettings
  useEffect(() => {
    const state = routeLocation.state as { maskConfig?: MultiImageMaskConfig; fromMaskSettings?: boolean } | null;
    
    if (state?.fromMaskSettings && state.maskConfig) {
      setMaskConfig(state.maskConfig);
      
      const hasMasks = state.maskConfig.images.some(img => img.regions.length > 0);
      if (hasMasks) {
        setEnableUnlock(true);
      }
      
      try {
        const savedState = sessionStorage.getItem(EDITOR_STATE_KEY);
        
        if (savedState) {
          const parsed: SavedEditorState = JSON.parse(savedState);
          
          if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            setContent(parsed.content);
            setVisibility(parsed.visibility);
            
            if (parsed.location) {
              setPostLocation(parsed.location);
            }
            
            if (parsed.scheduledAt) {
              setScheduledAt(new Date(parsed.scheduledAt));
            }
            
            if (parsed.imageDataUrls && parsed.imageDataUrls.length > 0) {
              setImagePreviews(parsed.imageDataUrls);
              
              Promise.all(
                parsed.imageDataUrls.map(async (dataUrl, index) => {
                  const response = await fetch(dataUrl);
                  const blob = await response.blob();
                  return new File([blob], `image-${index}.jpg`, { type: blob.type || 'image/jpeg' });
                })
              ).then(files => {
                setImages(files);
              }).catch(err => {
                console.error('[useEditorState] Failed to restore files:', err);
              });
            }
          }
          sessionStorage.removeItem(EDITOR_STATE_KEY);
        }
      } catch (e) {
        console.error("[useEditorState] Failed to restore editor state:", e);
      }
      
      window.history.replaceState({}, document.title);
    }
  }, [routeLocation.state]);

  // Image handlers
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 9 - images.length;
    const filesToAdd = files.slice(0, remainingSlots);
    const newPreviews = filesToAdd.map((file) => URL.createObjectURL(file));
    
    setImages((prev) => [...prev, ...filesToAdd]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    
    setMaskConfig((prev) => ({
      ...prev,
      images: prev.images
        .filter((img) => img.imageIndex !== index)
        .map((img) => ({
          ...img,
          imageIndex: img.imageIndex > index ? img.imageIndex - 1 : img.imageIndex,
        })),
    }));
  }, [imagePreviews]);

  // Video handlers
  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      return;
    }

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setImages([]);
    setImagePreviews([]);
    setMaskConfig({ unlockMode: "unified", unifiedPrice: 10, images: [] });

    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }, [videoPreview, imagePreviews]);

  const removeVideo = useCallback(() => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideo(null);
    setVideoPreview(null);
  }, [videoPreview]);

  // Location handlers
  const removeLocation = useCallback(() => {
    setPostLocation(null);
  }, []);

  // Save state to sessionStorage for mask settings navigation
  const saveStateToSession = useCallback(async () => {
    const imageDataUrls: string[] = [];
    for (const preview of imagePreviews) {
      try {
        if (preview.startsWith('data:')) {
          imageDataUrls.push(preview);
        } else {
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
  }, [content, visibility, enableUnlock, maskConfig, imagePreviews, postLocation, scheduledAt]);

  // Reset state
  const resetState = useCallback(() => {
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
    setCurrentDraftId(null);
  }, [imagePreviews, videoPreview]);

  // Computed values
  const canSubmit = Boolean(content.trim() || images.length > 0 || video);
  const hasMaskRegions = maskConfig.images.some(img => img.regions.length > 0);
  const canSaveDraft = content.trim() || images.length > 0 || video;

  return {
    // State
    content,
    setContent,
    visibility,
    setVisibility,
    images,
    setImages,
    imagePreviews,
    setImagePreviews,
    video,
    setVideo,
    videoPreview,
    setVideoPreview,
    postLocation,
    setPostLocation,
    enableUnlock,
    setEnableUnlock,
    maskConfig,
    setMaskConfig,
    scheduledAt,
    setScheduledAt,
    currentDraftId,
    setCurrentDraftId,
    
    // Mention state
    showMentionPicker,
    setShowMentionPicker,
    mentionQuery,
    setMentionQuery,
    mentionStartPos,
    setMentionStartPos,
    
    // Preview state
    previewIndex,
    setPreviewIndex,
    showVideoViewer,
    setShowVideoViewer,
    showDraftsSheet,
    setShowDraftsSheet,
    
    // Loading state
    isLoadingLocation,
    setIsLoadingLocation,
    
    // Refs
    fileInputRef,
    videoInputRef,
    textareaRef,
    mentionPickerRef,
    
    // Handlers
    handleImageSelect,
    removeImage,
    handleVideoSelect,
    removeVideo,
    removeLocation,
    saveStateToSession,
    resetState,
    
    // Computed
    canSubmit,
    hasMaskRegions,
    canSaveDraft,
  };
}
