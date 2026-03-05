import { X, Lock } from "lucide-react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { VideoViewer } from "@/components/ui/video-player";
import { type MultiImageMaskConfig } from "./MultiImageMaskEditor";

interface EditorMediaSectionProps {
  imagePreviews: string[];
  videoPreview: string | null;
  maskConfig: MultiImageMaskConfig;
  previewIndex: number | null;
  showVideoViewer: boolean;
  isLoading: boolean;
  onRemoveImage: (index: number) => void;
  onRemoveVideo: () => void;
  onImageClick: (index: number) => void;
  onVideoClick: () => void;
  onCloseImageViewer: () => void;
  onCloseVideoViewer: () => void;
}

export function EditorMediaSection({
  imagePreviews,
  videoPreview,
  maskConfig,
  previewIndex,
  showVideoViewer,
  isLoading,
  onRemoveImage,
  onRemoveVideo,
  onImageClick,
  onVideoClick,
  onCloseImageViewer,
  onCloseVideoViewer,
}: EditorMediaSectionProps) {
  return (
    <>
      {/* Image preview grid */}
      {imagePreviews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
              <img
                src={preview}
                alt={`预览 ${index + 1}`}
                className="h-full w-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                onClick={() => onImageClick(index)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveImage(index);
                }}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background z-10"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </button>
              {/* Mask indicator */}
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

      {/* Video preview */}
      {videoPreview && (
        <div className="mt-3 relative rounded-lg overflow-hidden bg-muted">
          <video
            src={videoPreview}
            className="w-full max-h-[300px] object-contain cursor-pointer"
            onClick={onVideoClick}
          />
          <button
            type="button"
            onClick={onRemoveVideo}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background z-10"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Image viewer */}
      <ImageViewer
        open={previewIndex !== null}
        onClose={onCloseImageViewer}
        images={imagePreviews}
        initialIndex={previewIndex ?? 0}
      />

      {/* Video viewer */}
      <VideoViewer
        open={showVideoViewer}
        onClose={onCloseVideoViewer}
        src={videoPreview || ""}
      />
    </>
  );
}
