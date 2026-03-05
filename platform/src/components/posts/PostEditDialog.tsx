import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditPost } from "@/hooks/useEditPost";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { VisibilitySelector, VisibilityType } from "@/components/ui/visibility-selector";
import type { PostData } from "./PostCard";

interface PostEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostData;
}

export function PostEditDialog({ open, onOpenChange, post }: PostEditDialogProps) {
  const [content, setContent] = useState(post.content || "");
  const [visibility, setVisibility] = useState<VisibilityType>(
    post.visibility as VisibilityType
  );
  const editPost = useEditPost();

  // 当 post 变化时更新状态
  useEffect(() => {
    setContent(post.content || "");
    setVisibility(post.visibility as VisibilityType);
  }, [post]);

  const handleSubmit = async () => {
    await editPost.mutateAsync({
      postId: post.id,
      content,
      visibility,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑帖子</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 可见性选择 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">可见范围：</span>
            <VisibilitySelector
              value={visibility}
              onChange={setVisibility}
              className="w-32"
            />
          </div>

          {/* 内容编辑 */}
          <Textarea
            placeholder="分享你的想法..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[150px] resize-none"
            disabled={editPost.isPending}
          />

          {/* 图片预览（只读） */}
          {post.media && post.media.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                图片不支持编辑，如需修改请删除后重新发布
              </p>
              <div className="grid grid-cols-3 gap-2">
                {post.media.map((media) => (
                  <div
                    key={media.id}
                    className="aspect-square rounded-lg overflow-hidden bg-muted"
                  >
                    <img
                      src={media.media_url}
                      alt=""
                      className="h-full w-full object-cover opacity-60"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={editPost.isPending}>
            {editPost.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-1" />
                保存中
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
