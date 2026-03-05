import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * ContentDialog - 专门用于内容区的弹窗组件
 * 使用 absolute 定位,不会遮挡顶部栏和侧边栏
 * 
 * 重要提示:
 * - 必须在有 position: relative 的容器内使用
 * - ContentSandbox 已经是 relative 定位
 * - 不使用 Portal,保持在内容区内
 */
export function ContentDialog({
  open,
  onOpenChange,
  children,
  className,
}: ContentDialogProps) {
  if (!open) return null;

  return (
    <>
      {/* 遮罩层 - 提高 z-index 确保在相机对话框之上 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[70]"
        onClick={() => onOpenChange(false)}
      />
      
      {/* 弹窗内容 */}
      <div className="absolute inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "relative bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

interface ContentDialogHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function ContentDialogHeader({
  children,
  onClose,
  className,
}: ContentDialogHeaderProps) {
  return (
    <div className={cn("px-6 py-4 border-b flex items-center justify-between", className)}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface ContentDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentDialogTitle({
  children,
  className,
}: ContentDialogTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold", className)}>
      {children}
    </h2>
  );
}

interface ContentDialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentDialogBody({
  children,
  className,
}: ContentDialogBodyProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-4", className)}>
      {children}
    </div>
  );
}

interface ContentDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentDialogFooter({
  children,
  className,
}: ContentDialogFooterProps) {
  return (
    <div className={cn("px-6 py-4 border-t flex justify-end gap-2", className)}>
      {children}
    </div>
  );
}