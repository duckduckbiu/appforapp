import { useState, useEffect, useRef } from "react";
import { Search, ChevronRight, Star, Send, User, FileText, X, Hash, Clock, Trash2, TrendingUp, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useNotification } from "@/contexts/NotificationContext";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";
import { useGlobalSearch, SearchResultType } from "@/hooks/useGlobalSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useHotSearches } from "@/hooks/useHotSearches";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface SmartSearchBarProps {
  className?: string;
}

export function SmartSearchBar({ className }: SmartSearchBarProps) {
  const [mode, setMode] = useState<"search" | "message">("search");
  const [searchValue, setSearchValue] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<SearchResultType>("all");
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const { currentNotification, clearNotification, pauseTimeout, resumeTimeout } = useNotification();
  
  const { userResults, postResults, hashtagResults, isLoading, hasResults, query } = useGlobalSearch(searchValue, searchType);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const { data: hotSearches = [] } = useHotSearches();
  
  const showHistoryOrHot = isSearchOpen && searchValue.trim().length < 2;
  const showHistory = showHistoryOrHot && history.length > 0;
  const showHotSearches = showHistoryOrHot && hotSearches.length > 0;

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Switch to message mode when notification arrives
  useEffect(() => {
    if (currentNotification) {
      setMode("message");
      setIsSearchOpen(false);
    } else {
      setMode("search");
    }
  }, [currentNotification]);

  // Listen for new messages via Realtime
  useEffect(() => {
    const userId = currentIdentity?.profile?.id;
    
    const setupRealtimeSubscription = () => {
      if (!userId) return;

      const channel = supabase
        .channel('smart-search-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload: { new: Record<string, unknown> }) => {
            const newMessage = payload.new;
            
            // Don't show notification for messages sent by current user
            if (newMessage.sender_id === userId) return;

            // Fetch sender profile
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('display_name, unique_username')
              .eq('id', newMessage.sender_id)
              .single();

            // Note: Message notifications are now handled by external notification system
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, [currentIdentity?.profile?.id]);

  const handleSearchFocus = () => {
    setIsSearchOpen(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value.trim().length >= 2) {
      setIsSearchOpen(true);
    } else {
      setIsSearchOpen(false);
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    setIsSearchOpen(false);
    inputRef.current?.focus();
  };

  const handleUserClick = (userId: string, userName?: string, userAvatar?: string) => {
    addToHistory({ query: userName || "", type: "user", metadata: { userId, userName, userAvatar } });
    navigate(`/profile/${userId}`);
    setIsSearchOpen(false);
    setSearchValue("");
  };

  const handlePostClick = (postId: string) => {
    if (searchValue.trim()) {
      addToHistory({ query: searchValue.trim(), type: "query" });
    }
    navigate(`/post/${postId}`);
    setIsSearchOpen(false);
    setSearchValue("");
  };

  const handleHashtagClick = (hashtagName: string) => {
    addToHistory({ query: `#${hashtagName}`, type: "hashtag", metadata: { hashtagName } });
    navigate(`/hashtag/${hashtagName}`);
    setIsSearchOpen(false);
    setSearchValue("");
  };

  const handleHistoryItemClick = (item: typeof history[0]) => {
    if (item.type === "user" && item.metadata?.userId) {
      navigate(`/profile/${item.metadata.userId}`);
    } else if (item.type === "hashtag" && item.metadata?.hashtagName) {
      navigate(`/hashtag/${item.metadata.hashtagName}`);
    } else {
      setSearchValue(item.query);
    }
    setIsSearchOpen(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submit just keeps dropdown open
    if (searchValue.trim().length >= 2) {
      setIsSearchOpen(true);
    }
  };

  const handleMessageClick = () => {
    if (currentNotification) {
      if (currentNotification.type === "chat") {
        navigate("/conversations");
      } else if (currentNotification.type === "starred_chat" && currentNotification.conversationId) {
        navigate(`/conversations/chat/${currentNotification.conversationId}`);
      }
      clearNotification();
      setIsReplyOpen(false);
    }
  };

  const sendQuickReply = async () => {
    if (!replyText.trim() || !currentNotification?.conversationId || !currentIdentity) return;
    
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: currentNotification.conversationId,
        sender_id: currentIdentity.profile.id,
        content: replyText.trim(),
        message_type: 'text',
      });
      
      if (error) throw error;
      
      toast.success('回复已发送');
      setReplyText('');
      setIsReplyOpen(false);
      clearNotification();
    } catch (error) {
      console.error('发送回复失败:', error);
      toast.error('发送失败');
    }
  };

  const handleMouseEnter = () => {
    pauseTimeout();
  };

  const handleMouseLeave = () => {
    resumeTimeout();
  };

  return (
    <div className={cn("relative", className)} ref={searchContainerRef}>
      <form onSubmit={handleSearch} className="relative">
        {mode === "search" ? (
          <>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="搜索用户或内容..."
              value={searchValue}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              className="pl-9 pr-10 bg-background/50 border-border/50 focus:bg-background transition-colors"
            />
            {searchValue && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            {/* Search History & Hot Searches Dropdown */}
            {showHistoryOrHot && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <ScrollArea className="max-h-80">
                  {/* 搜索历史 */}
                  {showHistory && (
                    <div>
                      <div className="flex items-center justify-between px-3 py-2 border-b">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          搜索历史
                        </span>
                        <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 px-2 text-xs">
                          <Trash2 className="h-3 w-3 mr-1" />
                          清空
                        </Button>
                      </div>
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer group"
                          onClick={() => handleHistoryItemClick(item)}
                        >
                          {item.type === "user" ? (
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={item.metadata?.userAvatar} />
                              <AvatarFallback>{item.query[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                          ) : item.type === "hashtag" ? (
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <Hash className="h-3.5 w-3.5 text-primary" />
                            </div>
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                              <Search className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="flex-1 text-sm truncate">{item.query}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); removeFromHistory(item.id); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 热门搜索 */}
                  {showHotSearches && (
                    <div className={showHistory ? "border-t" : ""}>
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b">
                        <Flame className="h-3 w-3 text-orange-500" />
                        <span className="text-xs font-medium text-muted-foreground">热门搜索</span>
                      </div>
                      <div className="py-1">
                        {hotSearches.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                            onClick={() => handleHashtagClick(item.name)}
                          >
                            <span className={cn(
                              "w-5 h-5 rounded flex items-center justify-center text-xs font-bold",
                              index === 0 && "bg-red-500 text-white",
                              index === 1 && "bg-orange-500 text-white",
                              index === 2 && "bg-amber-500 text-white",
                              index > 2 && "bg-muted text-muted-foreground"
                            )}>
                              {index + 1}
                            </span>
                            <Hash className="h-3.5 w-3.5 text-primary" />
                            <span className="flex-1 text-sm truncate">{item.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.count} 条讨论
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 没有历史也没有热门 */}
                  {!showHistory && !showHotSearches && (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      输入关键词开始搜索
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Search Results Dropdown */}
            {isSearchOpen && query.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <Tabs value={searchType} onValueChange={(v) => setSearchType(v as SearchResultType)} className="w-full">
                  <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 px-2">
                    <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
                    <TabsTrigger value="users" className="text-xs">用户</TabsTrigger>
                    <TabsTrigger value="posts" className="text-xs">动态</TabsTrigger>
                    <TabsTrigger value="topics" className="text-xs">话题</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <ScrollArea className="max-h-80">
                  {isLoading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      搜索中...
                    </div>
                  ) : !hasResults ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      未找到相关结果
                    </div>
                  ) : (
                    <div className="py-2">
                      {/* User Results */}
                      {(searchType === "all" || searchType === "users") && userResults.length > 0 && (
                        <div>
                          {searchType === "all" && (
                            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <User className="h-3 w-3" />
                              用户
                            </div>
                          )}
                          {userResults.map((user) => (
                            <div
                              key={user.id}
                              onClick={() => handleUserClick(user.id, user.display_name || user.unique_username, user.avatar_url || undefined)}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                            >
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback>
                                  {(user.display_name || user.unique_username)?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {user.display_name || user.unique_username}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  @{user.unique_username}
                                </div>
                              </div>
                              {user.is_ai_avatar && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  AI
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Post Results */}
                      {(searchType === "all" || searchType === "posts") && postResults.length > 0 && (
                        <div>
                          {searchType === "all" && userResults.length > 0 && (
                            <div className="border-t my-1" />
                          )}
                          {searchType === "all" && (
                            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <FileText className="h-3 w-3" />
                              动态
                            </div>
                          )}
                          {postResults.map((post) => (
                            <div
                              key={post.id}
                              onClick={() => handlePostClick(post.id)}
                              className="flex items-start gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                            >
                              <Avatar className="h-8 w-8 mt-0.5">
                                <AvatarImage src={post.author?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {(post.author?.display_name || post.author?.unique_username)?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">
                                    {post.author?.display_name || post.author?.unique_username}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: zhCN })}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                  {post.content}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>❤️ {post.likes_count}</span>
                                  <span>💬 {post.comments_count}</span>
                                </div>
                              </div>
                              {post.media.length > 0 && (
                                <img
                                  src={post.media[0].media_url}
                                  alt=""
                                  className="w-12 h-12 rounded object-cover"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Hashtag Results */}
                      {(searchType === "all" || searchType === "topics") && hashtagResults.length > 0 && (
                        <div>
                          {searchType === "all" && (userResults.length > 0 || postResults.length > 0) && (
                            <div className="border-t my-1" />
                          )}
                          {searchType === "all" && (
                            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <Hash className="h-3 w-3" />
                              话题
                            </div>
                          )}
                          {hashtagResults.map((hashtag) => (
                            <div
                              key={hashtag.id}
                              onClick={() => handleHashtagClick(hashtag.name)}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                            >
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <Hash className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">
                                  #{hashtag.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {hashtag.post_count} 条动态
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </>
        ) : currentNotification?.type === "starred_chat" ? (
          <Popover open={isReplyOpen} onOpenChange={setIsReplyOpen}>
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="flex justify-center px-4 py-2 rounded-full bg-black/90 backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="flex items-center gap-3">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={currentNotification.senderAvatar} />
                  <AvatarFallback>{currentNotification.senderName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {currentNotification.senderName}:
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {currentNotification.content}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs hover:bg-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      回复
                    </Button>
                  </PopoverTrigger>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs hover:bg-primary/20"
                    onClick={handleMessageClick}
                  >
                    查看
                  </Button>
                </div>
              </div>
            </div>
            <PopoverContent 
              className="w-80 p-3 bg-black/95 backdrop-blur-md border-border/50"
              align="center"
              sideOffset={8}
            >
              <div className="space-y-2">
                <Textarea
                  placeholder="输入快速回复..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[80px] resize-none bg-background/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendQuickReply();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={sendQuickReply}
                    disabled={!replyText.trim()}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    发送
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div
            onClick={handleMessageClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="px-4 py-2 rounded-full cursor-pointer hover:bg-accent/10 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="text-sm font-medium truncate flex items-center justify-center gap-2">
              {currentNotification?.type === "identity" && "✨"}
              {currentNotification?.type === "chat" && "💬"}
              {currentNotification?.type === "payment" && "💰"}
              {currentNotification?.type === "system" && "🔔"}
              <span>{currentNotification?.content}</span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}