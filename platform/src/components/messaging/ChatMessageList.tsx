import { RefObject, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { MessageListItem } from "./MessageListItem";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useVirtualizer } from "@tanstack/react-virtual";

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

interface ChatMessageListProps {
  messages: Message[];
  currentIdentityId?: string;
  conversationInfo: any;
  senderProfiles: Map<string, any>;
  isMultiSelectMode: boolean;
  selectedMessageIds: Set<string>;
  translations: Map<string, string>;
  transcriptions: Map<string, string>;
  translatingId: string | null;
  transcribingId: string | null;
  highlightedMessageId: string | null;
  isDragging: boolean;
  chatBackground: string | null;
  showScrollToBottom: boolean;
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  scrollAreaRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
  onAvatarClick: (senderId: string) => void;
  onToggleSelection: (messageId: string) => void;
  onReply: (message: Message) => void;
  onTranslate: (messageId: string, content: string) => void;
  onTranscribe: (messageId: string, audioUrl: string) => void;
  onForward: (message: Message) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForAll: (messageId: string) => void;
  onImageClick: (url: string) => void;
  onFileClick: (url: string, name: string, type: string) => void;
  onMergedMessagesClick: (messages: any[], count: number) => void;
  onScrollToMessage: (messageId: string) => void;
  onEnterMultiSelectMode: () => void;
  onScrollToBottom: (forceImmediate?: boolean) => void;
  onLoadMore: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRetryMessage?: (message: Message) => void; // 重试消息
}

export function ChatMessageList({
  messages,
  currentIdentityId,
  conversationInfo,
  senderProfiles,
  isMultiSelectMode,
  selectedMessageIds,
  translations,
  transcriptions,
  translatingId,
  transcribingId,
  highlightedMessageId,
  isDragging,
  chatBackground,
  showScrollToBottom,
  isLoadingMore,
  hasMoreMessages,
  scrollAreaRef,
  messagesEndRef,
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
  onScrollToBottom,
  onLoadMore,
  onDragOver,
  onDragLeave,
  onDrop,
  onRetryMessage,
}: ChatMessageListProps) {
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);

  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollAreaRef.current,
    estimateSize: () => 80, // 预估消息高度（会自动调整）
    overscan: 10, // 预渲染可视区域外的10个元素
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  // 监听滚动到顶部以触发加载更多
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      
      // 当滚动到顶部附近（100px内）且有更多消息且未在加载时
      if (scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
        // 记录当前滚动高度
        previousScrollHeightRef.current = scrollContainer.scrollHeight;
        onLoadMore();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, isLoadingMore, onLoadMore, scrollAreaRef]);

  const virtualItems = virtualizer.getVirtualItems();

  // 加载更多后恢复滚动位置
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer || !isLoadingMore || previousScrollHeightRef.current === 0) return;

    // 加载完成后，调整滚动位置以保持用户查看的内容不变
    const newScrollHeight = scrollContainer.scrollHeight;
    const heightDifference = newScrollHeight - previousScrollHeightRef.current;
    
    if (heightDifference > 0) {
      scrollContainer.scrollTop = heightDifference;
    }
    
    previousScrollHeightRef.current = 0;
  }, [isLoadingMore, scrollAreaRef]);

  return (
    <div 
      className="flex-1 relative min-h-0 overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-medium text-primary">释放文件以添加</p>
            <p className="text-sm text-muted-foreground mt-1">支持图片和文档</p>
          </div>
        </div>
      )}
      
      <div 
        ref={scrollAreaRef as any}
        className="h-full overflow-auto p-4"
        style={chatBackground ? {
          backgroundImage: `url(${chatBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : undefined}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* 加载更多指示器 */}
        {isLoadingMore && (
          <div ref={loadMoreTriggerRef} className="flex justify-center py-2">
            <LoadingSpinner size="sm" text="加载历史消息..." />
          </div>
        )}

        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const message = messages[virtualRow.index];
            const isOwn = message.sender_id === currentIdentityId;
            const isHighlighted = highlightedMessageId === message.id;
            const senderInfo = senderProfiles.get(message.sender_id);
            
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="pb-4">
                  <MessageListItem
                    message={message}
                    previousMessage={virtualRow.index > 0 ? messages[virtualRow.index - 1] : null}
                    isOwn={isOwn}
                    isHighlighted={isHighlighted}
                    isMultiSelectMode={isMultiSelectMode}
                    isSelected={selectedMessageIds.has(message.id)}
                    senderProfile={senderInfo}
                    conversationName={conversationInfo?.name || ""}
                    conversationType={conversationInfo?.type || ""}
                    currentIdentity={{ profile: { id: currentIdentityId || "" } } as any}
                    translations={translations}
                    transcriptions={transcriptions}
                    translatingId={translatingId}
                    transcribingId={transcribingId}
                    onAvatarClick={() => onAvatarClick(message.sender_id)}
                    onToggleSelection={() => onToggleSelection(message.id)}
                    onReply={() => onReply(message)}
                    onTranslate={onTranslate}
                    onTranscribe={onTranscribe}
                    onForward={() => onForward(message)}
                    onDeleteForMe={() => onDeleteForMe(message.id)}
                    onDeleteForAll={() => onDeleteForAll(message.id)}
                    onImageClick={onImageClick}
                    onFileClick={onFileClick}
                    onMergedMessagesClick={onMergedMessagesClick}
                    onScrollToMessage={onScrollToMessage}
                    onEnterMultiSelectMode={onEnterMultiSelectMode}
                    onRetryMessage={onRetryMessage}
                  />
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {showScrollToBottom && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full z-10 h-10 w-10 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
          onClick={() => onScrollToBottom(true)}
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
