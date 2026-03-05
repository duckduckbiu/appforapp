import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2 } from "lucide-react";
import { useSharePost } from "@/hooks/useShare";
import { VisibilitySelector, VisibilityType } from "@/components/ui/visibility-selector";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

export function ShareDialog({ open, onOpenChange, postId }: ShareDialogProps) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<VisibilityType>("public");
  const { mutate: sharePost, isPending } = useSharePost();

  const handleShare = () => {
    sharePost(
      { originalPostId: postId, content, visibility },
      {
        onSuccess: () => {
          setContent("");
          setVisibility("public");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            转发帖子
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="添加评论（可选）..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none"
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">可见范围：</span>
            <VisibilitySelector
              value={visibility}
              onChange={setVisibility}
              className="w-[140px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleShare} disabled={isPending}>
            {isPending ? "转发中..." : "转发"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
