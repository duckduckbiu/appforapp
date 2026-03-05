import { useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useIdentity } from "@/contexts/IdentityContext";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { ConversationListItem } from "./ConversationListItem";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface AllChatsTabProps {
  searchQuery?: string;
}

export function AllChatsTab({ searchQuery = "" }: AllChatsTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentIdentity } = useIdentity();
  const hasAutoSelectedRef = useRef(false);
  
  // 使用 React Query hook 获取会话列表
  const { data: conversations = [], isLoading } = useConversations(
    currentIdentity?.profile.id
  );

  // 自动选择第一个会话（仅当右侧为空时）
  useEffect(() => {
    // 只在基础路由 /conversations 时自动选择
    if (
      !isLoading && 
      conversations.length > 0 && 
      location.pathname === "/conversations" &&
      !hasAutoSelectedRef.current
    ) {
      hasAutoSelectedRef.current = true;
      navigate(`/conversations/chat/${conversations[0].id}`, { replace: true });
    }
  }, [isLoading, conversations, location.pathname, navigate]);

  // 当回到基础路由或离开 conversations 区域时，重置自动选择标记
  useEffect(() => {
    if (location.pathname === "/conversations" || !location.pathname.startsWith("/conversations")) {
      hasAutoSelectedRef.current = false;
    }
  }, [location.pathname]);

  const handleConversationClick = (conversation: Conversation) => {
    navigate(`/conversations/chat/${conversation.id}`);
  };

  // 过滤会话（使用 useMemo 优化性能）
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conversation) =>
        conversation.display_name.toLowerCase().includes(query) ||
        conversation.last_message?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // 加载中状态 - 使用骨架屏
  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  // 无会话状态
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
        <p>暂无对话</p>
        <p className="text-sm mt-1">开始与好友聊天吧</p>
      </div>
    );
  }

  // 搜索无结果状态
  if (filteredConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
        <p>未找到匹配的对话</p>
        <p className="text-sm mt-1">试试其他关键词</p>
      </div>
    );
  }

  // 渲染会话列表
  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {filteredConversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            onClick={() => handleConversationClick(conversation)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
