import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileType: string;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileType,
}: FilePreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true);

  // 重置加载状态当弹窗打开或文件改变时
  useEffect(() => {
    if (open) {
      setIsLoading(true);
    }
  }, [open, fileUrl]);

  if (!open) return null;

  const isImage = fileType.startsWith("image/");
  const isPDF = fileType === "application/pdf" || fileName.toLowerCase().endsWith('.pdf');
  const isText = fileType === "text/plain";
  
  // Office 文件检测
  const isOffice = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(fileName) ||
    fileType.includes('word') || 
    fileType.includes('excel') || 
    fileType.includes('spreadsheet') ||
    fileType.includes('powerpoint') ||
    fileType.includes('presentation') ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileType === 'application/msword' ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    fileType === 'application/vnd.ms-powerpoint';

  const canPreview = isImage || isPDF || isText || isOffice;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-[80%] h-[80%] bg-background/95 rounded-lg overflow-hidden flex flex-col shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-black/40 backdrop-blur-md">
          <h3 className="text-lg font-medium truncate pr-4 text-foreground">
            {fileName}
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 预览区域 */}
        <div className="flex-1 overflow-auto p-6 bg-muted/20 relative">
          {canPreview ? (
            <>
              {isImage && (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={fileUrl}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onLoad={() => setIsLoading(false)}
                  />
                </div>
              )}

              {isPDF && (
                <div className="w-full h-full flex items-center justify-center relative">
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                    className="w-full h-full border-0 rounded-lg"
                    title={fileName}
                    onLoad={() => setIsLoading(false)}
                  />
                </div>
              )}

              {isOffice && (
                <div className="w-full h-full flex items-center justify-center relative">
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                    className="w-full h-full border-0 rounded-lg"
                    title={fileName}
                    onLoad={() => setIsLoading(false)}
                  />
                </div>
              )}

              {isText && (
                <iframe
                  src={fileUrl}
                  className="w-full h-full rounded-lg border border-border bg-background"
                  title={fileName}
                  onLoad={() => setIsLoading(false)}
                />
              )}

              {/* 加载状态 */}
              {isLoading && (isPDF || isOffice) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <LoadingSpinner size="default" text="正在加载预览..." />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <p>此文件类型不支持预览</p>
              <a
                href={fileUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  下载文件
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
