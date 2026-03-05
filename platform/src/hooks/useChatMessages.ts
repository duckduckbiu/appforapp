import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChatOperations } from "./useChatOperations";
import { useConversationInfo } from "./useConversationInfo";
import { useMessageActions } from "./useMessageActions";
import { useFileHandlers } from "./useFileHandlers";
import { useAppPermissions } from "@/contexts/AppPermissionsContext";
import { toast } from "sonner";

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

interface UseChatMessagesOptions {
  conversationId: string;
  currentIdentity: any;
}

export function useChatMessages({ conversationId, currentIdentity }: UseChatMessagesOptions) {
  const [isLoading, setIsLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [chatBackground, setChatBackground] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { checkPermission, requestPermission: requestAppPermission } = useAppPermissions();

  // Conversation info hook
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

  // File handlers
  const fileHandlers = useFileHandlers({ conversationId });

  // Chat operations
  const chatOps = useChatOperations({
    conversationId,
    currentIdentityId: currentIdentity?.profile.id,
    replyToMessage: null as any,
    setReplyToMessage: () => {},
    loadSenderProfiles,
    clearFileSelections: fileHandlers.clearSelections,
    selectedImages: fileHandlers.selectedImages,
    selectedFiles: fileHandlers.selectedFiles,
    sanitizeFileName: fileHandlers.sanitizeFileName,
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
    retryMessage,
  } = chatOps;

  // Message actions
  const messageActions = useMessageActions({
    currentIdentity,
    conversationInfo,
    senderProfiles,
    onMessagesUpdate: loadMessages,
  });

  // Load data and setup subscriptions
  useEffect(() => {
    let mounted = true;
    let messagesChannel: any = null;
    let profilesChannel: any = null;
    let profileReloadTimeout: NodeJS.Timeout | null = null;

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
                if (payload.eventType === 'INSERT') {
                  await loadMessages();
                  await markAsRead();
                } else if (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
                  await loadMessages();
                }
              }
            }
          )
          .subscribe();

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

  // Scroll handling
  const scrollToBottom = useCallback((forceImmediate = false) => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;
    
    const doScroll = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };
    
    if (forceImmediate) {
      doScroll();
      requestAnimationFrame(() => {
        doScroll();
      });
    } else {
      requestAnimationFrame(doScroll);
    }
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    }
  }, []);

  // Auto scroll on new messages
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isLoading, messages.length, scrollToBottom]);

  // Scroll button visibility
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
      setShowScrollToBottom(!isNearBottom);
    };

    handleScroll();
    scrollContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [messages.length]);

  // Cleanup on conversation change
  useEffect(() => {
    return () => {
      fileHandlers.clearSelections();
    };
  }, [conversationId]);

  // Send message
  const sendMessage = useCallback(async () => {
    await sendMessageCore(inputMessage);
    setInputMessage("");
  }, [sendMessageCore, inputMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Background upload
  const handleBackgroundUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentIdentity) return;

    try {
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
    } catch (error: any) {
      toast.error("背景上传失败");
    }

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = "";
    }
  }, [conversationId, currentIdentity]);

  // Camera permission
  const handleCameraClick = useCallback(async () => {
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
        return false;
      }
    }
    
    return true;
  }, [checkPermission, requestAppPermission]);

  return {
    // State
    isLoading,
    inputMessage,
    setInputMessage,
    chatBackground,
    setChatBackground,
    showScrollToBottom,
    highlightedMessageId,
    
    // Refs
    messagesEndRef,
    scrollAreaRef,
    backgroundInputRef,
    textareaRef,
    
    // Conversation info
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
    
    // Messages
    messages,
    isSending,
    isLoadingMore,
    hasMoreMessages,
    loadMoreMessages,
    sendVoiceMessage,
    sendLocationMessage,
    retryMessage,
    
    // Message actions
    messageActions,
    
    // File handlers
    fileHandlers,
    
    // Actions
    sendMessage,
    handleKeyPress,
    handleBackgroundUpload,
    handleCameraClick,
    scrollToBottom,
    scrollToMessage,
  };
}
