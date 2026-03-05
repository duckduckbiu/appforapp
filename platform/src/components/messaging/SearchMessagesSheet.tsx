import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Image as ImageIcon, Link as LinkIcon, Music, Calendar } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  metadata: any;
  sender_name: string;
  sender_avatar: string | null;
}

interface SearchMessagesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationName: string;
  onBack?: () => void;
  onMessageClick?: (messageId: string) => void;
}

export function SearchMessagesSheet({
  open,
  onOpenChange,
  conversationId,
  conversationName,
  onBack,
  onMessageClick,
}: SearchMessagesSheetProps) {
  const { currentIdentity } = useIdentity();
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (open && currentIdentity) {
      loadMessages();
    }
  }, [open, currentIdentity, conversationId]);

  useEffect(() => {
    filterMessages();
  }, [searchQuery, activeTab, messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      // 获取所有消息
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!messagesData) {
        setMessages([]);
        return;
      }

      // 获取发送者信息
      const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, unique_username, avatar_url")
        .in("id", senderIds);

      const profileMap = new Map(
        profiles?.map(p => [p.id, p]) || []
      );

      const messagesWithSender = messagesData.map(msg => ({
        ...msg,
        sender_name: profileMap.get(msg.sender_id)?.display_name || 
                     profileMap.get(msg.sender_id)?.unique_username || 
                     "未知用户",
        sender_avatar: profileMap.get(msg.sender_id)?.avatar_url || null,
      }));

      setMessages(messagesWithSender);
    } catch (error) {
      console.error("加载消息失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterMessages = () => {
    let filtered = messages;

    // 按类型筛选
    if (activeTab !== "all") {
      filtered = filtered.filter(msg => {
        switch (activeTab) {
          case "text":
            return msg.message_type === "text";
          case "image":
            return msg.message_type === "image";
          case "file":
            return msg.message_type === "file";
          case "link":
            return msg.content?.includes("http://") || msg.content?.includes("https://");
          default:
            return true;
        }
      });
    }

    // 按搜索关键词筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg => 
        msg.content?.toLowerCase().includes(query) ||
        msg.sender_name.toLowerCase().includes(query)
      );
    }

    setFilteredMessages(filtered);
  };

  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      onOpenChange(false);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        locale: zhCN,
        addSuffix: true,
      });
    } catch {
      return "";
    }
  };

  const renderMessagePreview = (message: Message) => {
    switch (message.message_type) {
      case "text":
        return (
          <p className="text-sm text-foreground line-clamp-2">
            {message.content}
          </p>
        );
      case "image":
        return (
          <div className="flex items-center gap-2">
            {message.metadata?.image_url && (
              <img
                src={message.metadata.image_url}
                alt="消息图片"
                className="w-20 h-20 object-cover rounded"
              />
            )}
          </div>
        );
      case "file":
        return (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            <span>[文件]</span>
          </div>
        );
      default:
        return <span className="text-sm text-muted-foreground">[未知消息类型]</span>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[600px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle>与"{conversationName}"的聊天记录</SheetTitle>
        </SheetHeader>

        {/* 搜索框 */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 类型筛选标签 */}
        <div className="px-4 pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start h-auto flex-wrap gap-2 bg-transparent p-0">
              <TabsTrigger 
                value="all" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                全部
              </TabsTrigger>
              <TabsTrigger 
                value="file" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <FileText className="mr-1 h-3 w-3" />
                文件
              </TabsTrigger>
              <TabsTrigger 
                value="image" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <ImageIcon className="mr-1 h-3 w-3" />
                图片与视频
              </TabsTrigger>
              <TabsTrigger 
                value="link" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <LinkIcon className="mr-1 h-3 w-3" />
                链接
              </TabsTrigger>
              <TabsTrigger 
                value="music" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Music className="mr-1 h-3 w-3" />
                音乐与音频
              </TabsTrigger>
              <TabsTrigger 
                value="date" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Calendar className="mr-1 h-3 w-3" />
                日期
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 消息列表 */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="default" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              {searchQuery ? "未找到匹配的消息" : "暂无消息"}
            </div>
          ) : (
            <div className="p-2">
              {filteredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => onMessageClick?.(message.id)}
                  className="w-full flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={message.sender_avatar || ""} />
                    <AvatarFallback>
                      {message.sender_name[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {message.sender_name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {getTimeAgo(message.created_at)}
                      </span>
                    </div>
                    {renderMessagePreview(message)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
