import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useDrafts, Draft } from "@/hooks/useDrafts";
import { Trash2, FileText, Image, Video, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DraftsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDraft: (draft: Draft) => void;
}

export function DraftsSheet({ open, onOpenChange, onSelectDraft }: DraftsSheetProps) {
  const { drafts, isLoading, deleteDraft, isDeleting } = useDrafts();

  const handleSelectDraft = (draft: Draft) => {
    onSelectDraft(draft);
    onOpenChange(false);
  };

  const handleDeleteDraft = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    deleteDraft(draftId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            草稿箱
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2 opacity-50" />
              <p>暂无草稿</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {drafts.map((draft) => (
                <DraftItem
                  key={draft.id}
                  draft={draft}
                  onSelect={() => handleSelectDraft(draft)}
                  onDelete={(e) => handleDeleteDraft(e, draft.id)}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface DraftItemProps {
  draft: Draft;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

function DraftItem({ draft, onSelect, onDelete, isDeleting }: DraftItemProps) {
  const mediaCount = draft.media_data?.length || 0;
  const hasImages = draft.media_data?.some((m) => m.type === "image");
  const hasVideo = draft.media_data?.some((m) => m.type === "video");

  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-3 rounded-lg border bg-card cursor-pointer transition-colors",
        "hover:bg-accent/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* 内容预览 */}
          <p className="text-sm line-clamp-2">
            {draft.content || <span className="text-muted-foreground italic">无文字内容</span>}
          </p>

          {/* 媒体和位置标签 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {hasImages && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                <Image className="h-3 w-3" />
                {draft.media_data?.filter((m) => m.type === "image").length}张图片
              </span>
            )}
            {hasVideo && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                <Video className="h-3 w-3" />
                视频
              </span>
            )}
            {draft.location_name && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                <MapPin className="h-3 w-3" />
                {draft.location_name}
              </span>
            )}
          </div>

          {/* 时间 */}
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(draft.updated_at), {
              addSuffix: true,
              locale: zhCN,
            })}
          </p>
        </div>

        {/* 缩略图预览 */}
        {mediaCount > 0 && draft.media_data?.[0]?.type === "image" && (
          <div className="w-16 h-16 rounded overflow-hidden bg-muted shrink-0">
            <img
              src={draft.media_data[0].url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* 删除按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
