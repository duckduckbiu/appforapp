import { Fragment } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Reply,
  Mic,
  Star,
  CheckSquare,
  Trash2,
  Copy,
  Languages,
  Forward,
  MapPin,
  Bot,
  Eye,
  Download,
  FileImage,
  FileText,
  FileType,
  FileSpreadsheet,
  FileArchive,
  File,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MessageQuoteCard } from "./MessageQuoteCard";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  is_deleted: boolean;
  updated_at: string;
  metadata: any;
  status?: "sending" | "sent" | "failed"; // 乐观更新状态
  tempId?: string; // 临时 ID
}

interface MessageListItemProps {
  message: Message;
  previousMessage: Message | null;
  isOwn: boolean;
  isHighlighted: boolean;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  senderProfile: { avatar_url: string | null; display_name: string | null } | undefined;
  conversationName: string;
  conversationType: string;
  currentIdentity: any;
  translations: Map<string, string>;
  transcriptions: Map<string, string>;
  translatingId: string | null;
  transcribingId: string | null;
  onAvatarClick: () => void;
  onToggleSelection: () => void;
  onReply: () => void;
  onTranslate: (id: string, content: string) => void;
  onTranscribe: (id: string, audioUrl: string) => void;
  onForward: () => void;
  onDeleteForMe: () => void;
  onDeleteForAll: () => void;
  onImageClick: (url: string) => void;
  onFileClick: (url: string, name: string, type: string) => void;
  onMergedMessagesClick: (messages: any[], count: number) => void;
  onScrollToMessage: (messageId: string) => void;
  onEnterMultiSelectMode: () => void;
  onRetryMessage?: (message: Message) => void; // 重试消息回调
}

export function MessageListItem({
  message,
  previousMessage,
  isOwn,
  isHighlighted,
  isMultiSelectMode,
  isSelected,
  senderProfile,
  conversationName,
  conversationType,
  currentIdentity,
  translations,
  transcriptions,
  translatingId,
  transcribingId,
  onAvatarClick,
  onToggleSelection,
  onReply,
  onTranslate,
  onTranscribe,
  onForward,
  onDeleteForMe,
  onDeleteForAll,
  onImageClick,
  onFileClick,
  onMergedMessagesClick,
  onScrollToMessage,
  onEnterMultiSelectMode,
  onRetryMessage,
}: MessageListItemProps) {
  // 检查是否有引用消息
  const hasReply = message.metadata?.reply_to_message_id;
  
  // 检查是否需要显示时间戳（首条消息或距离上条消息超过5分钟）
  const shouldShowTimestamp = !previousMessage ||
    (new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() > 5 * 60 * 1000);

  // 根据文件类型返回对应的图标组件
  const getFileIcon = (fileType: string, fileName: string) => {
    if (fileType.startsWith('image/')) return FileImage;
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return FileText;
    if (fileType.includes('word') || /\.(doc|docx)$/i.test(fileName)) return FileType;
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || /\.(xls|xlsx)$/i.test(fileName)) return FileSpreadsheet;
    if (fileType.includes('zip') || fileType.includes('rar') || /\.(zip|rar|7z)$/i.test(fileName)) return FileArchive;
    return File;
  };

  return (
    <Fragment key={message.id}>
      {/* 时间戳显示 - 每5分钟显示一次 */}
      {shouldShowTimestamp && (
        <div className="flex justify-center my-2">
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.created_at), "MM月dd日 HH:mm")}
          </span>
        </div>
      )}
      
      <div
        data-message-id={message.id}
        className={`flex gap-3 group ${isOwn ? "flex-row-reverse" : "flex-row"} ${
          isHighlighted ? "animate-pulse" : ""
        }`}
      >
        {/* 多选模式复选框 */}
        {isMultiSelectMode && (
          <div 
            className="flex items-start pt-1 cursor-pointer"
            onClick={onToggleSelection}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected 
                ? 'bg-primary border-primary' 
                : 'border-muted-foreground'
            }`}>
              {isSelected && (
                <CheckSquare className="h-4 w-4 text-primary-foreground" />
              )}
            </div>
          </div>
        )}
        
        <Avatar 
          className="h-8 w-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={isMultiSelectMode ? onToggleSelection : onAvatarClick}
        >
          <AvatarImage src={senderProfile?.avatar_url || ""} />
          <AvatarFallback>
            {isOwn ? "我" : "TA"}
          </AvatarFallback>
        </Avatar>

        <div className={`flex flex-col relative ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}>
          {/* 消息操作按钮 - 非多选模式显示 */}
          {!isMultiSelectMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 hover:opacity-100 group-hover:opacity-60 transition-opacity z-10 ${
                    isOwn ? "-left-9" : "-right-9"
                  }`}
                  title="消息操作"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-48"
                align={isOwn ? "start" : "end"}
                side="top"
                sideOffset={8}
              >
                <DropdownMenuItem onClick={onReply}>
                  <Reply className="h-4 w-4 mr-2" />
                  引用
                </DropdownMenuItem>
                
                {message.message_type === 'audio' && message.metadata?.file_path && (
                  <DropdownMenuItem 
                    onClick={() => {
                      const { data: urlData } = supabase.storage
                        .from("message-files")
                        .getPublicUrl(message.metadata.file_path);
                      onTranscribe(message.id, urlData.publicUrl);
                    }}
                    disabled={transcribingId === message.id}
                  >
                    {transcribingId === message.id ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Mic className="h-4 w-4 mr-2" />
                    )}
                    {transcriptions.has(message.id) ? "收起转写" : "语音转文字"}
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem onClick={() => toast("收藏功能开发中")}>
                  <Star className="h-4 w-4 mr-2" />
                  收藏
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={onEnterMultiSelectMode}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  多选
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={async () => {
                    if (message.content) {
                      await navigator.clipboard.writeText(message.content);
                      toast("已复制到剪贴板");
                    }
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  复制
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => onTranslate(message.id, message.content || "")}
                  disabled={translatingId === message.id}
                >
                  {translatingId === message.id ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Languages className="h-4 w-4 mr-2" />
                  )}
                  {translations.has(message.id) ? "收起翻译" : "翻译"}
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={onForward}>
                  <Forward className="h-4 w-4 mr-2" />
                  转发
                </DropdownMenuItem>
                
                {isOwn ? (
                  <>
                    <DropdownMenuItem onClick={onDeleteForMe}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={onDeleteForAll}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      双向删除
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={onDeleteForMe}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* AI 生成消息标记 */}
          {message.metadata?.ai_generated && (
            <Badge variant="secondary" className="mb-1 text-xs flex items-center gap-1">
              <Bot className="h-3 w-3" />
              AI 回复
            </Badge>
          )}

          {/* 引用消息卡片 */}
          {hasReply && (
            <div className="w-full mb-2">
              <MessageQuoteCard
                senderName={
                  message.metadata.reply_to_sender_id === currentIdentity?.profile.id
                    ? "我"
                    : senderProfile?.display_name || "TA"
                }
                senderAvatar={
                  senderProfile?.avatar_url || null
                }
                content={message.metadata.reply_to_content}
                messageType={message.metadata.reply_to_message_type}
                onClick={() => {
                  if (message.metadata.reply_to_message_id) {
                    onScrollToMessage(message.metadata.reply_to_message_id);
                  }
                }}
              />
            </div>
          )}
          
          {/* 消息内容 - 文本消息 */}
          {message.message_type === "text" && (
            <div>
              <div
                className={`rounded-lg px-4 py-2 ${
                  isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                } ${
                  isHighlighted 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                    : ""
                } ${
                  message.status === "failed" ? "opacity-50" : ""
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-normal">
                  {message.content?.split(/(\p{Extended_Pictographic})/gu).map((part, index) => {
                    // 检测是否为emoji
                    const isEmoji = /\p{Extended_Pictographic}/u.test(part);
                    return (
                      <span key={index} className={isEmoji ? "text-xl" : "text-sm"}>
                        {part}
                      </span>
                    );
                  })}
                </p>
              </div>
              
              {/* 消息状态显示 */}
              {isOwn && message.status && (
                <div className="flex items-center gap-2 mt-1 text-xs">
                  {message.status === "sending" && (
                    <LoadingSpinner size="sm" text="发送中..." className="text-muted-foreground" />
                  )}
                  {message.status === "failed" && (
                    <div className="flex items-center gap-2">
                      <span className="text-destructive">发送失败</span>
                      {onRetryMessage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-primary hover:text-primary"
                          onClick={() => onRetryMessage(message)}
                        >
                          重试
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 图片消息 */}
          {message.message_type === "image" && message.metadata?.image_url && (
            <img
              src={message.metadata.image_url}
              alt="图片"
              className={`max-h-[160px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
                isHighlighted 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                  : ""
              }`}
              onClick={() => onImageClick(message.metadata.image_url)}
              onLoad={() => {
                // 图片加载完成后滚动
                const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                if (scrollViewport) {
                  scrollViewport.scrollTop = scrollViewport.scrollHeight;
                }
              }}
            />
          )}

          {/* 文件消息 */}
          {message.message_type === "file" && message.metadata?.file_url && message.metadata?.file_name && (
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border border-border/30 cursor-pointer hover:bg-accent/10 transition-colors ${
                isOwn ? "bg-primary/10" : "bg-muted"
              } ${
                isHighlighted 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                  : ""
              }`}
              onClick={() => onFileClick(
                message.metadata.file_url,
                message.metadata.file_name,
                message.metadata.file_type
              )}
            >
              {(() => {
                const FileIcon = getFileIcon(message.metadata.file_type, message.metadata.file_name);
                return <FileIcon className="h-10 w-10 text-primary flex-shrink-0" />;
              })()}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="font-medium text-sm truncate">
                  {message.metadata.file_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {message.metadata.file_size 
                    ? `${(message.metadata.file_size / 1024 / 1024).toFixed(2)} MB`
                    : "文件"
                  }
                </span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClick(
                      message.metadata.file_url,
                      message.metadata.file_name,
                      message.metadata.file_type
                    );
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(message.metadata.file_url, '_blank');
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 合并转发消息 */}
          {message.message_type === "merged_forward" && message.metadata?.merged_messages && (
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border border-border/30 cursor-pointer hover:bg-accent/10 transition-colors min-w-[200px] ${
                isOwn ? "bg-primary/10" : "bg-muted"
              } ${
                isHighlighted 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                  : ""
              }`}
              onClick={() => onMergedMessagesClick(
                message.metadata.merged_messages,
                message.metadata.message_count || message.metadata.merged_messages.length
              )}
            >
              <div className="text-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <span className="font-medium text-sm">聊天记录</span>
              <p className="text-xs text-muted-foreground">
                {message.metadata.message_count || message.metadata.merged_messages.length}条消息
              </p>
            </div>
          )}

          {/* 语音消息 */}
          {message.message_type === "audio" && message.metadata?.file_path && (
            <div className="flex flex-col gap-2 max-w-xs">
              <div
                className={`rounded-lg p-3 border border-border/30 ${
                  isOwn ? "bg-primary/10" : "bg-muted"
                } ${
                  isHighlighted 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                    : ""
                }`}
              >
                <VoiceMessagePlayer 
                  filePath={message.metadata.file_path}
                  duration={message.metadata.duration}
                />
              </div>
              {transcriptions.has(message.id) && (
                <div className={`text-sm px-3 py-2 ${isOwn ? "text-right" : "text-left"}`}>
                  <span className="opacity-80">
                    {transcriptions.get(message.id)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 位置消息 */}
          {message.message_type === "location" && message.metadata?.latitude && message.metadata?.longitude && (
            <div
              className={`flex flex-col gap-2 p-3 rounded-lg border border-border/30 max-w-xs cursor-pointer hover:opacity-90 transition-opacity ${
                isOwn ? "bg-primary/10" : "bg-muted"
              } ${
                isHighlighted 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                  : ""
              }`}
              onClick={() => {
                const url = `https://www.openstreetmap.org/?mlat=${message.metadata.latitude}&mlon=${message.metadata.longitude}#map=15/${message.metadata.latitude}/${message.metadata.longitude}`;
                window.open(url, '_blank');
              }}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="font-medium text-sm">位置信息</span>
              </div>
              {message.metadata.address && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {message.metadata.address}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>纬度: {message.metadata.latitude.toFixed(6)}</span>
                <span>经度: {message.metadata.longitude.toFixed(6)}</span>
              </div>
              <p className="text-xs text-primary">点击查看地图</p>
            </div>
          )}

          {/* 翻译结果显示 */}
          {translations.has(message.id) && (
            <p className="mt-2 text-sm text-muted-foreground">
              {translations.get(message.id)}
            </p>
          )}
        </div>
      </div>
    </Fragment>
  );
}
