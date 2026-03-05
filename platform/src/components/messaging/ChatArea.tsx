import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { ChatDetailSidebar } from "./ChatDetailSidebar";
import { UserProfileDialog } from "./UserProfileDialog";
import { AddMembersSheet } from "./AddMembersSheet";
import { SearchMessagesSheet } from "./SearchMessagesSheet";
import { ImageViewer } from "@/components/ui/image-viewer";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RecommendFriendSheet } from "./RecommendFriendSheet";
import { ForwardMessagesDialog } from "./ForwardMessagesDialog";
import { MergedMessagesDialog } from "./MergedMessagesDialog";
import { MessageInput } from "./MessageInput";
import { CameraDialog } from "./CameraDialog";
import { VoiceRecorder } from "./VoiceRecorder";
import { LocationPicker } from "./LocationPicker";
import { useAppPermissions } from "@/contexts/AppPermissionsContext";
import { useMessageActions } from "@/hooks/useMessageActions";
import { useConversationInfo } from "@/hooks/useConversationInfo";
import { useFileHandlers } from "@/hooks/useFileHandlers";
import { useChatOperations } from "@/hooks/useChatOperations";
import { ChatHeader } from "./ChatHeader";
import { ChatMessageList } from "./ChatMessageList";

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
}

interface ChatAreaProps {
  conversationId: string;
}

export function ChatArea({ conversationId }: ChatAreaProps) {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const { checkPermission, requestPermission: requestAppPermission } = useAppPermissions();
  const [searchParams] = useSearchParams();
  
  const urlMode = searchParams.get("mode") as 'observe' | 'takeover' | null;
  const urlAvatarId = searchParams.get("avatar");
  const [isLoading, setIsLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  
  const [isDetailSidebarOpen, setIsDetailSidebarOpen] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [isSearchMessagesOpen, setIsSearchMessagesOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [chatBackground, setChatBackground] = useState<string | null>(null);
  const [isRecommendSheetOpen, setIsRecommendSheetOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [mergedMessagesDialogOpen, setMergedMessagesDialogOpen] = useState(false);
  const [selectedMergedMessages, setSelectedMergedMessages] = useState<any[]>([]);
  const [selectedMergedCount, setSelectedMergedCount] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const conversationInfoHook = useConversationInfo({
    conversationId,
    currentIdentity,
  });
  
  const {
    conversationInfo,
    senderProfiles,
    isBlocked,
    isBlockedByOther,
    isStarred,
    isMuted,
    isPinned,
    setIsStarred,
    setIsMuted,
    setIsPinned,
    loadConversationInfo,
    loadSenderProfiles,
  } = conversationInfoHook;
  
  const fileHandlers = useFileHandlers({ conversationId });
  
  const {
    selectedImages,
    imagePreviewUrls,
    selectedFiles,
    isDragging,
    previewImageUrl,
    previewFileUrl,
    previewFileName,
    previewFileType,
    fileInputRef,
    documentInputRef,
    sanitizeFileName,
    handleImageUpload,
    removeImage,
    handleFileSelect,
    removeFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFilePreview,
    handleCameraCapture,
    setPreviewImageUrl,
    setPreviewFileUrl,
  } = fileHandlers;

  const chatOps = useChatOperations({
    conversationId,
    currentIdentityId: currentIdentity?.profile.id,
    replyToMessage: null as any,
    setReplyToMessage: () => {},
    loadSenderProfiles,
    clearFileSelections: fileHandlers.clearSelections,
    selectedImages,
    selectedFiles,
    sanitizeFileName,
  });

  const {
    messages,
    isSending,
    isLoadingMore,
    hasMoreMessages,
    markAsRead,
    loadMessages,
    loadMoreMessages,
    sendMessage: sendMessageCore,
    sendVoiceMessage,
    sendLocationMessage,
    retryMessage, // 新增：重试功能
  } = chatOps;

  const messageActions = useMessageActions({
    currentIdentity,
    conversationInfo,
    senderProfiles,
    onMessagesUpdate: loadMessages,
  });

  const {
    replyToMessage,
    setReplyToMessage,
    translations,
    transcriptions,
    translatingId,
    transcribingId,
    isMultiSelectMode,
    selectedMessageIds,
    handleReplyToMessage,
    handleTranslate,
    handleTranscribe,
    deleteMessageForMe,
    deleteMessageForAll,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleMessageSelection,
    selectAllMessages: selectAllMessagesAction,
    handleBatchDeleteForMe,
    handleBatchDeleteForAll,
  } = messageActions;

  useEffect(() => {
    let mounted = true;
    let messagesChannel: any = null;
    let profilesChannel: any = null;
    let profileReloadTimeout: NodeJS.Timeout | null = null;

    // 防抖资料重载：避免频繁更新触发多次重载
    const debouncedProfileReload = () => {
      if (profileReloadTimeout) clearTimeout(profileReloadTimeout);
      profileReloadTimeout = setTimeout(() => {
        if (mounted) loadConversationInfo();
      }, 500);
    };

    const loadData = async () => {
      if (!currentIdentity) return;

      try {
        await loadMessages();
        await markAsRead();
        
        const savedBackground = localStorage.getItem(`chat-bg-${conversationId}`);
        if (savedBackground) {
          setChatBackground(savedBackground);
        }

        const userId = currentIdentity.profile.id;

        // 订阅消息变化（过滤特定会话）
        messagesChannel = supabase
          .channel(`chat-messages-${conversationId}-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload) => {
              if (mounted) {
                // 新消息插入时才重载并标记已读
                if (payload.eventType === 'INSERT') {
                  await loadMessages();
                  await markAsRead();
                } else if (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
                  // 删除或更新时只重载消息列表
                  await loadMessages();
                }
              }
            }
          )
          .subscribe();

        // 订阅资料变化（只订阅会话参与者的资料变化）
        profilesChannel = supabase
          .channel(`chat-profiles-${conversationId}-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
            },
            (payload) => {
              // 只在显示相关字段变化时重载会话信息
              if (mounted && payload.new && (
                payload.new.display_name !== payload.old?.display_name ||
                payload.new.avatar_url !== payload.old?.avatar_url ||
                payload.new.unique_username !== payload.old?.unique_username
              )) {
                debouncedProfileReload();
              }
            }
          )
          .subscribe();
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
      if (profileReloadTimeout) clearTimeout(profileReloadTimeout);
      if (messagesChannel) {
        messagesChannel.unsubscribe();
        supabase.removeChannel(messagesChannel);
      }
      if (profilesChannel) {
        profilesChannel.unsubscribe();
        supabase.removeChannel(profilesChannel);
      }
    };
  }, [conversationId, currentIdentity]);

  // 当消息变化时，加载发送者资料
  useEffect(() => {
    if (messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      loadSenderProfiles(senderIds);
    }
  }, [messages]);

  useEffect(() => {
    // 新消息到达时立即滚动到底部
    scrollToBottom(true);
  }, [messages]);
  
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isLoading]);

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
      setShowScrollToBottom(!isNearBottom);
    };

    // 初始检查
    handleScroll();
    
    // 监听滚动
    scrollContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [messages.length]);

  useEffect(() => {
    return () => {
      fileHandlers.clearSelections();
    };
  }, [conversationId]);

  const scrollToBottom = (forceImmediate = false) => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;
    
    const doScroll = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };
    
    if (forceImmediate) {
      doScroll();
      // 确保 DOM 完全渲染后再滚动一次
      requestAnimationFrame(() => {
        doScroll();
      });
    } else {
      requestAnimationFrame(doScroll);
    }
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    }
  };

  const sendMessage = async () => {
    await sendMessageCore(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = inputMessage;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setInputMessage(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setInputMessage(prev => prev + emoji);
    }
    setEmojiPickerOpen(false);
  };

  const handleCameraClick = async () => {
    const hasPermission = await checkPermission('chat', 'camera');
    
    if (!hasPermission) {
      const granted = await requestAppPermission(
        'chat',
        '聊天',
        'camera',
        '相机权限',
        '聊天功能需要访问相机以拍摄照片。授权后浏览器会弹出相机权限请求。'
      );
      
      if (!granted) {
        toast.error('需要相机权限才能拍照');
        return;
      }
    }
    
    setIsCameraOpen(true);
  };

  const selectAllMessages = () => {
    selectAllMessagesAction(messages.map(m => m.id));
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentIdentity) return;

    try {
      // 使用统一图片压缩
      const { compressImageWithPreset } = await import('@/lib/imageCompression');
      const compressedFile = await compressImageWithPreset(file, 'background');
      
      const fileExt = file.name.split(".").pop();
      const fileName = `bg-${Date.now()}.${fileExt}`;
      const filePath = `${currentIdentity.profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("message-images")
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("message-images")
        .getPublicUrl(filePath);

      localStorage.setItem(`chat-bg-${conversationId}`, urlData.publicUrl);
      setChatBackground(urlData.publicUrl);
      
      toast.success("背景设置成功");
      setIsDetailSidebarOpen(false);
    } catch (error: any) {
      toast.error("背景上传失败");
    }

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = "";
    }
  };

  const handleEditRemark = async () => {
    if (!conversationInfo?.friendId) return;
    
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", conversationInfo.friendId)
        .single();
      
      if (data) {
        setSelectedUserProfile(data);
        setIsDetailSidebarOpen(false);
        setIsProfileDialogOpen(true);
      }
    } catch (error) {
      console.error("加载用户资料失败:", error);
      toast.error("加载用户资料失败");
    }
  };

  const handleSetPermissions = () => {
    toast.info("设置朋友权限功能开发中");
  };

  const handleRecommendFriend = () => {
    setIsDetailSidebarOpen(false);
    setIsRecommendSheetOpen(true);
  };

  const handleAddToBlacklist = async () => {
    if (!conversationInfo?.friendId || !currentIdentity) return;

    setConfirmDialog({
      open: true,
      title: "加入黑名单",
      description: "确定要将该用户加入黑名单吗？加入后对方将无法给你发送消息。",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const { data: existing } = await supabase
            .from("blacklist")
            .select("id")
            .eq("user_id", currentIdentity.profile.id)
            .eq("blocked_user_id", conversationInfo.friendId!)
            .maybeSingle();

          if (existing) {
            toast.info("该用户已在黑名单中");
            return;
          }

          const { error } = await supabase
            .from("blacklist")
            .insert({
              user_id: currentIdentity.profile.id,
              blocked_user_id: conversationInfo.friendId!,
            });

          if (error) throw error;

          toast.success("已加入黑名单");
          setIsDetailSidebarOpen(false);
          loadConversationInfo();
        } catch (error) {
          console.error("加入黑名单失败:", error);
          toast.error("加入黑名单失败");
        }
      },
    });
  };

  const handleDeleteContact = async () => {
    if (!conversationInfo?.friendId || !currentIdentity) return;

    setConfirmDialog({
      open: true,
      title: "删除联系人",
      description: "确定要删除该联系人吗？",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const { error: error1 } = await supabase
            .from("friendships")
            .delete()
            .eq("user_id", currentIdentity.profile.id)
            .eq("friend_id", conversationInfo.friendId!);

          if (error1) throw error1;

          const { error: error2 } = await supabase
            .from("friendships")
            .delete()
            .eq("user_id", conversationInfo.friendId!)
            .eq("friend_id", currentIdentity.profile.id);

          if (error2) throw error2;

          toast.success("已删除联系人");
          setIsDetailSidebarOpen(false);
          navigate("/conversations");
        } catch (error) {
          console.error("删除联系人失败:", error);
          toast.error("删除联系人失败");
        }
      },
    });
  };

  const confirmBatchDeleteForMe = () => {
    if (selectedMessageIds.size === 0) return;

    setConfirmDialog({
      open: true,
      title: "批量删除消息",
      description: `确定要删除选中的 ${selectedMessageIds.size} 条消息吗？仅本地删除。`,
      variant: "destructive",
      onConfirm: handleBatchDeleteForMe,
    });
  };

  const confirmBatchDeleteForAll = () => {
    if (selectedMessageIds.size === 0) return;

    setConfirmDialog({
      open: true,
      title: "批量双向删除",
      description: `确定要双向删除选中的 ${selectedMessageIds.size} 条消息吗？所有人都将无法看到。`,
      variant: "destructive",
      onConfirm: handleBatchDeleteForAll,
    });
  };

  const handleBatchForward = () => {
    if (selectedMessageIds.size === 0) return;
    setIsForwardDialogOpen(true);
  };

  const handleForwardSingleMessage = (message: Message) => {
    toggleMessageSelection(message.id);
    setIsForwardDialogOpen(true);
  };

  const handleAvatarClick = async (senderId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', senderId)
      .single();
    
    if (data) {
      setSelectedUserProfile(data);
      setIsProfileDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversationInfo={conversationInfo}
        isBlocked={isBlocked}
        isMultiSelectMode={isMultiSelectMode}
        selectedMessageIds={selectedMessageIds}
        onMoreClick={() => setIsDetailSidebarOpen(true)}
        onExitMultiSelect={exitMultiSelectMode}
        onSelectAll={selectAllMessages}
        onBatchForward={handleBatchForward}
        onBatchDeleteForMe={confirmBatchDeleteForMe}
        onBatchDeleteForAll={confirmBatchDeleteForAll}
      />

      <ChatMessageList
        messages={messages}
        currentIdentityId={currentIdentity?.profile.id}
        conversationInfo={conversationInfo}
        senderProfiles={senderProfiles}
        isMultiSelectMode={isMultiSelectMode}
        selectedMessageIds={selectedMessageIds}
        translations={translations}
        transcriptions={transcriptions}
        translatingId={translatingId}
        transcribingId={transcribingId}
        highlightedMessageId={highlightedMessageId}
        isDragging={isDragging}
        chatBackground={chatBackground}
        showScrollToBottom={showScrollToBottom}
        isLoadingMore={isLoadingMore}
        hasMoreMessages={hasMoreMessages}
        scrollAreaRef={scrollAreaRef}
        messagesEndRef={messagesEndRef}
        onAvatarClick={handleAvatarClick}
        onToggleSelection={toggleMessageSelection}
        onReply={handleReplyToMessage}
        onTranslate={handleTranslate}
        onTranscribe={handleTranscribe}
        onForward={handleForwardSingleMessage}
        onDeleteForMe={deleteMessageForMe}
        onDeleteForAll={deleteMessageForAll}
        onImageClick={(url) => setPreviewImageUrl(url)}
        onFileClick={handleFilePreview}
        onMergedMessagesClick={(messages, count) => {
          setSelectedMergedMessages(messages);
          setSelectedMergedCount(count);
          setMergedMessagesDialogOpen(true);
        }}
        onScrollToMessage={scrollToMessage}
        onEnterMultiSelectMode={enterMultiSelectMode}
        onScrollToBottom={scrollToBottom}
        onLoadMore={loadMoreMessages}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onRetryMessage={retryMessage}
      />

      <MessageInput
        inputMessage={inputMessage}
        isSending={isSending}
        isBlockedByOther={isBlockedByOther}
        replyToMessage={replyToMessage}
        selectedImages={selectedImages}
        imagePreviewUrls={imagePreviewUrls}
        selectedFiles={selectedFiles}
        emojiPickerOpen={emojiPickerOpen}
        observerMode={null}
        onInputChange={setInputMessage}
        onSend={sendMessage}
        onKeyPress={handleKeyPress}
        onRemoveReply={() => setReplyToMessage(null)}
        onImageSelect={handleImageUpload}
        onRemoveImage={removeImage}
        onImagePreviewClick={(url) => setPreviewImageUrl(url)}
        onFileSelect={handleFileSelect}
        onRemoveFile={removeFile}
        onEmojiToggle={() => setEmojiPickerOpen(!emojiPickerOpen)}
        onEmojiSelect={handleEmojiSelect}
        onCameraClick={handleCameraClick}
        onVoiceClick={() => setIsVoiceRecorderOpen(true)}
        onLocationClick={() => setIsLocationPickerOpen(true)}
        fileInputRef={fileInputRef}
        documentInputRef={documentInputRef}
        textareaRef={textareaRef}
      />

      <ChatDetailSidebar
        open={isDetailSidebarOpen}
        onOpenChange={setIsDetailSidebarOpen}
        conversationInfo={conversationInfo}
        isMuted={isMuted}
        isPinned={isPinned}
        isStarred={isStarred}
        onMuteChange={async (muted) => {
          if (!currentIdentity) return;
          
          try {
            await supabase
              .from("conversation_participants")
              .update({ is_muted: muted })
              .eq("conversation_id", conversationId)
              .eq("user_id", currentIdentity.profile.id);
            
            setIsMuted(muted);
            toast.success(muted ? "已开启消息免打扰" : "已关闭消息免打扰");
          } catch (error) {
            console.error("更新免打扰状态失败:", error);
            toast.error("更新失败");
          }
        }}
        onPinChange={async (pinned) => {
          if (!currentIdentity) return;
          
          try {
            await supabase
              .from("conversation_participants")
              .update({ is_pinned: pinned })
              .eq("conversation_id", conversationId)
              .eq("user_id", currentIdentity.profile.id);
            
            setIsPinned(pinned);
            toast.success(pinned ? "已置顶聊天" : "已取消置顶");
          } catch (error) {
            console.error("更新置顶状态失败:", error);
            toast.error("更新失败");
          }
        }}
        onStarChange={async (starred) => {
          if (!currentIdentity || !conversationInfo?.friendId) return;
          
          try {
            await supabase
              .from("friendships")
              .update({ is_starred: starred })
              .eq("user_id", currentIdentity.profile.id)
              .eq("friend_id", conversationInfo.friendId);
            
            setIsStarred(starred);
            toast.success(starred ? "已设为星标朋友" : "已取消星标");
          } catch (error) {
            console.error("更新星标状态失败:", error);
            toast.error("更新失败");
          }
        }}
        onSearchMessages={() => {
          setIsDetailSidebarOpen(false);
          setIsSearchMessagesOpen(true);
        }}
        onAddMembers={() => {
          setIsDetailSidebarOpen(false);
          setIsAddMembersOpen(true);
        }}
        onHideConversation={async () => {
          if (!currentIdentity) return;
          
          try {
            await supabase
              .from("conversation_participants")
              .update({ is_hidden: true })
              .eq("conversation_id", conversationId)
              .eq("user_id", currentIdentity.profile.id);
            
            toast.success("已隐藏会话");
            setIsDetailSidebarOpen(false);
            navigate("/conversations");
          } catch (error) {
            console.error("隐藏会话失败:", error);
            toast.error("隐藏会话失败");
          }
        }}
        onDeleteConversationForMe={() => {
          setConfirmDialog({
            open: true,
            title: "删除会话",
            description: "仅本地删除，对方仍可见。确定要删除吗？",
            variant: "destructive",
            onConfirm: async () => {
              if (!currentIdentity) return;
              
              try {
                const { data: messagesData, error: messagesError } = await supabase
                  .from("messages")
                  .select("id")
                  .eq("conversation_id", conversationId);
                
                if (messagesError) throw messagesError;
                
                if (messagesData && messagesData.length > 0) {
                  const deletions = messagesData.map(msg => ({
                    message_id: msg.id,
                    user_id: currentIdentity.profile.id
                  }));
                  
                  const { error: deletionsError } = await supabase
                    .from("message_deletions")
                    .insert(deletions);
                  
                  if (deletionsError) throw deletionsError;
                }
                
                await supabase
                  .from("conversation_participants")
                  .delete()
                  .eq("conversation_id", conversationId)
                  .eq("user_id", currentIdentity.profile.id);
                
                toast.success("已删除会话");
                setIsDetailSidebarOpen(false);
                navigate("/conversations");
              } catch (error) {
                console.error("删除会话失败:", error);
                toast.error("删除会话失败");
              }
            }
          });
        }}
        onDeleteConversationForAll={() => {
          setConfirmDialog({
            open: true,
            title: "双向删除会话",
            description: "双向删除后所有人都将无法看到，确定要删除吗？",
            variant: "destructive",
            onConfirm: async () => {
              if (!currentIdentity) return;
              
              try {
                const { error } = await supabase.rpc("delete_conversation_for_all", {
                  p_conversation_id: conversationId,
                  p_user_id: currentIdentity.profile.id,
                });
                
                if (error) throw error;
                
                toast.success("已双向删除会话");
                setIsDetailSidebarOpen(false);
                navigate("/conversations");
              } catch (error) {
                console.error("双向删除会话失败:", error);
                toast.error("双向删除会话失败");
              }
            }
          });
        }}
        onChangeBackground={() => {
          backgroundInputRef.current?.click();
        }}
        onResetBackground={() => {
          localStorage.removeItem(`chat-bg-${conversationId}`);
          setChatBackground(null);
          toast.success("已恢复默认背景");
          setIsDetailSidebarOpen(false);
        }}
        hasCustomBackground={!!chatBackground}
        onEditRemark={handleEditRemark}
        onSetPermissions={handleSetPermissions}
        onRecommendFriend={handleRecommendFriend}
        onAddToBlacklist={handleAddToBlacklist}
        onDeleteContact={handleDeleteContact}
        onManageBlacklist={() => {
          setIsDetailSidebarOpen(false);
          navigate("/blacklist");
        }}
      />

      <AddMembersSheet
        open={isAddMembersOpen}
        onOpenChange={setIsAddMembersOpen}
        conversationId={conversationId}
        conversationType={conversationInfo?.type || "private"}
        onSuccess={() => {
          loadConversationInfo();
        }}
        onBack={() => {
          setIsAddMembersOpen(false);
          setIsDetailSidebarOpen(true);
        }}
      />

      <SearchMessagesSheet
        open={isSearchMessagesOpen}
        onOpenChange={setIsSearchMessagesOpen}
        conversationId={conversationId}
        conversationName={conversationInfo?.name || ""}
        onBack={() => {
          setIsSearchMessagesOpen(false);
          setIsDetailSidebarOpen(true);
        }}
        onMessageClick={(messageId) => {
          setIsSearchMessagesOpen(false);
          setTimeout(() => {
            scrollToMessage(messageId);
          }, 100);
        }}
      />

      <UserProfileDialog
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        profile={selectedUserProfile}
        onSendMessage={() => {
          setIsProfileDialogOpen(false);
          toast.info("发送消息功能开发中");
        }}
        onVoiceCall={() => {
          toast.info("语音聊天功能开发中");
        }}
        onVideoCall={() => {
          toast.info("视频聊天功能开发中");
        }}
        onViewMoments={() => {
          toast.info("朋友圈功能开发中");
        }}
        onRemarkUpdated={() => {
          loadConversationInfo();
        }}
      />

      <ImageViewer
        open={!!previewImageUrl}
        images={previewImageUrl ? [previewImageUrl] : []}
        onClose={() => setPreviewImageUrl(null)}
      />

      <FilePreviewDialog
        open={!!previewFileUrl}
        fileUrl={previewFileUrl || ""}
        fileName={previewFileName}
        fileType={previewFileType}
        onOpenChange={(open) => !open && setPreviewFileUrl(null)}
      />

      <input
        ref={backgroundInputRef}
        type="file"
        accept="image/*"
        onChange={handleBackgroundUpload}
        style={{ display: 'none' }}
      />

      <CameraDialog
        open={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <VoiceRecorder
        open={isVoiceRecorderOpen}
        onClose={() => setIsVoiceRecorderOpen(false)}
        onSend={sendVoiceMessage}
      />

      <LocationPicker
        open={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onSend={sendLocationMessage}
      />

      {conversationInfo?.friendId && (
        <RecommendFriendSheet
          open={isRecommendSheetOpen}
          onOpenChange={setIsRecommendSheetOpen}
          recommendedUserId={conversationInfo.friendId}
          recommendedUserName={conversationInfo.name}
        />
      )}

      <ForwardMessagesDialog
        open={isForwardDialogOpen}
        onOpenChange={(open) => {
          setIsForwardDialogOpen(open);
          if (!open) exitMultiSelectMode();
        }}
        messages={messages.filter(m => selectedMessageIds.has(m.id))}
        messageIds={Array.from(selectedMessageIds)}
      />

      <MergedMessagesDialog
        open={mergedMessagesDialogOpen}
        onOpenChange={setMergedMessagesDialogOpen}
        mergedMessages={selectedMergedMessages}
        messageCount={selectedMergedCount}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, open: false });
        }}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
