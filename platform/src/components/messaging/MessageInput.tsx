import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ImageIcon,
  Folder,
  Phone,
  Video,
  Mic,
  Camera,
  MapPin,
  X,
  FileText,
  Ban,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageQuoteCard } from "./MessageQuoteCard";
import { EmojiPicker, EmojiTrigger } from "@/components/ui/emoji-picker";

interface QuotedMessage {
  id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  metadata: any;
  senderName: string;
  senderAvatar: string | null;
}

interface MessageInputProps {
  inputMessage: string;
  isSending: boolean;
  isBlockedByOther: boolean;
  replyToMessage: QuotedMessage | null;
  selectedImages: File[];
  imagePreviewUrls: string[];
  selectedFiles: File[];
  emojiPickerOpen: boolean;
  observerMode: 'observe' | 'takeover' | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onRemoveReply: () => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onImagePreviewClick: (url: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onEmojiToggle: () => void;
  onEmojiSelect: (emoji: string) => void;
  onCameraClick: () => void;
  onVoiceClick: () => void;
  onLocationClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  documentInputRef: React.RefObject<HTMLInputElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function MessageInput({
  inputMessage,
  isSending,
  isBlockedByOther,
  replyToMessage,
  selectedImages,
  imagePreviewUrls,
  selectedFiles,
  emojiPickerOpen,
  observerMode,
  onInputChange,
  onSend,
  onKeyPress,
  onRemoveReply,
  onImageSelect,
  onRemoveImage,
  onImagePreviewClick,
  onFileSelect,
  onRemoveFile,
  onEmojiToggle,
  onEmojiSelect,
  onCameraClick,
  onVoiceClick,
  onLocationClick,
  fileInputRef,
  documentInputRef,
  textareaRef,
}: MessageInputProps) {
  // 在观察模式下隐藏输入区域
  if (observerMode === 'observe') {
    return null;
  }

  return (
    <div className="border-t">
      {/* 黑名单警告横幅 - 对方把我拉黑了 */}
      {isBlockedByOther && (
        <Alert variant="destructive" className="rounded-none border-0 border-b">
          <Ban className="h-4 w-4" />
          <AlertDescription>
            对方已将您加入黑名单，您无法发送消息
          </AlertDescription>
        </Alert>
      )}
      
      {/* 工具栏 - 使用 relative 定位作为表情面板的参照 */}
      <div className="relative">
        {/* 表情选择面板 */}
        <EmojiPicker
          open={emojiPickerOpen}
          onOpenChange={(open) => !open && onEmojiToggle()}
          onSelect={onEmojiSelect}
          position="top"
          className="left-0"
        />

        {/* 工具栏内容 */}
        <div className="flex items-center gap-2 p-3 bg-black/40 backdrop-blur-md">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={onImageSelect}
          />
          <input
            type="file"
            ref={documentInputRef}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip,.rar,.7z"
            multiple
            onChange={onFileSelect}
          />
          <EmojiTrigger onClick={onEmojiToggle} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onCameraClick}
            disabled={isSending}
          >
            <Camera className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => documentInputRef.current?.click()}
            disabled={isSending}
          >
            <Folder className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onLocationClick}
            disabled={isSending}
          >
            <MapPin className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={onVoiceClick}
            disabled={isSending}
          >
            <Mic className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Video className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 文本输入区域 */}
      <div className="relative p-3 bg-black/20">
        {/* 引用消息预览 */}
        {replyToMessage && (
          <div className="mb-3 flex items-start gap-2">
            <div className="flex-1">
              <MessageQuoteCard
                senderName={replyToMessage.senderName}
                senderAvatar={replyToMessage.senderAvatar}
                content={replyToMessage.content}
                messageType={replyToMessage.message_type}
                metadata={replyToMessage.metadata}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={onRemoveReply}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 图片预览区域 */}
        {imagePreviewUrls.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {imagePreviewUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`预览 ${index + 1}`}
                  className="h-20 w-20 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onImagePreviewClick(url)}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(index);
                  }}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 文件预览区域 */}
        {selectedFiles.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative flex items-center gap-2 px-3 py-2 bg-accent/30 rounded-lg border border-border/30">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <button
                  onClick={() => onRemoveFile(index)}
                  className="flex-shrink-0 h-5 w-5 rounded-full bg-destructive/20 hover:bg-destructive/40 text-destructive flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <Textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyPress}
          placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
          disabled={isSending || isBlockedByOther}
          className="min-h-[80px] pr-20 resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        <Button
          onClick={onSend}
          disabled={isSending || (!inputMessage.trim() && selectedImages.length === 0 && selectedFiles.length === 0) || isBlockedByOther}
          className="absolute bottom-4 right-4"
          size="sm"
        >
          {isSending ? (
            <LoadingSpinner size="sm" />
          ) : (
            "发送"
          )}
        </Button>
      </div>
    </div>
  );
}
