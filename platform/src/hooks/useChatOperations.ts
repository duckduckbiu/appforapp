import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImageWithPreset } from "@/lib/imageCompression";
import { useMessages, useLoadMoreMessages, type Message } from "./useMessages";
import { useSendMessage, useRetryMessage } from "./useSendMessage";

interface QuotedMessage extends Message {
  senderName: string;
  senderAvatar: string | null;
}

interface UseChatOperationsProps {
  conversationId: string;
  currentIdentityId?: string;
  replyToMessage: QuotedMessage | null;
  setReplyToMessage: (message: QuotedMessage | null) => void;
  loadSenderProfiles: (senderIds: string[]) => Promise<void>;
  clearFileSelections: () => void;
  selectedImages: File[];
  selectedFiles: File[];
  sanitizeFileName: (filename: string) => string;
}

/**
 * Chat operations hook using React Query for message management
 * 聊天操作 hook，使用 React Query 管理消息状态
 */
export function useChatOperations({
  conversationId,
  currentIdentityId,
  replyToMessage,
  setReplyToMessage,
  loadSenderProfiles,
  clearFileSelections,
  selectedImages,
  selectedFiles,
  sanitizeFileName,
}: UseChatOperationsProps) {
  const [isSending, setIsSending] = useState(false);

  // 使用 React Query hook 获取消息列表
  const {
    data: messages = [],
    isLoading,
    markAsRead,
    isMarkingAsRead,
  } = useMessages({
    conversationId,
    userId: currentIdentityId,
    enabled: !!currentIdentityId,
  });

  // 加载更多消息的 mutation
  const loadMoreMutation = useLoadMoreMessages(conversationId);

  // 发送消息的 mutation（乐观更新）
  const sendMessageMutation = useSendMessage(conversationId);

  // 重试失败消息的 mutation
  const retryMessageMutation = useRetryMessage(conversationId);

  // 加载更多历史消息
  const loadMoreMessages = async () => {
    if (messages.length === 0 || loadMoreMutation.isPending) return;

    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    try {
      await loadMoreMutation.mutateAsync(oldestMessage.created_at);
    } catch (error) {
      console.error("加载更多消息失败:", error);
      toast.error("加载历史消息失败");
    }
  };

  // 重新加载消息（用于强制刷新）
  const loadMessages = async () => {
    // React Query 会自动处理，这里提供一个空实现以保持接口兼容
    // 实际的重新加载通过 queryClient.invalidateQueries 完成
  };

  const sendMessage = async (inputMessage: string) => {
    if (!currentIdentityId || isSending) return;

    const hasText = inputMessage.trim();
    const hasImages = selectedImages.length > 0;
    const hasFiles = selectedFiles.length > 0;

    if (!hasText && !hasImages && !hasFiles) return;

    setIsSending(true);
    try {
      // 检查并重新加入会话（如果需要）
      const { data: participant } = await supabase
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", currentIdentityId)
        .maybeSingle();

      if (!participant) {
        const { error: rejoinError } = await supabase
          .from("conversation_participants")
          .insert({
            conversation_id: conversationId,
            user_id: currentIdentityId,
          });

        if (rejoinError) {
          console.error("重新加入会话失败:", rejoinError);
          toast.error("无法发送消息，请刷新页面重试");
          throw rejoinError;
        }
      }

      // 发送图片
      if (hasImages) {
        for (const file of selectedImages) {
          const compressedFile = await compressImageWithPreset(file, 'message');
          const fileExt = "jpg";
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${currentIdentityId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("message-images")
            .upload(filePath, compressedFile);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("message-images")
            .getPublicUrl(filePath);

          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: currentIdentityId,
            content: null,
            message_type: "image",
            metadata: {
              image_url: urlData.publicUrl,
              image_path: filePath,
            },
          });

          if (insertError) throw insertError;
        }
        clearFileSelections();
      }

      // 发送文件
      if (hasFiles) {
        for (const file of selectedFiles) {
          const sanitizedName = sanitizeFileName(file.name);
          const fileName = `${Date.now()}-${sanitizedName}`;
          const filePath = `${currentIdentityId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("message-files")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("message-files")
            .getPublicUrl(filePath);

          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: currentIdentityId,
            content: file.name,
            message_type: "file",
            metadata: {
              file_url: urlData.publicUrl,
              file_path: filePath,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
            },
          });

          if (insertError) throw insertError;
        }
      }

      // 发送文字消息（使用乐观更新）
      if (hasText) {
        const messageMetadata: any = replyToMessage
          ? {
              reply_to_message_id: replyToMessage.id,
              reply_to_sender_id: replyToMessage.sender_id,
              reply_to_content: replyToMessage.content,
              reply_to_message_type: replyToMessage.message_type,
            }
          : {};

        // 使用乐观更新发送消息
        await sendMessageMutation.mutateAsync({
          conversationId,
          senderId: currentIdentityId,
          content: inputMessage.trim(),
          messageType: "text",
          metadata: messageMetadata,
        });

        setReplyToMessage(null);
      }
    } catch (error: any) {
      console.error("发送消息失败:", error);
      if (!hasText) {
        // 如果不是文字消息，显示 toast（文字消息的错误由 mutation 处理）
        toast.error("发送失败");
      }
    } finally {
      setIsSending(false);
    }
  };

  const sendVoiceMessage = async (file: File, duration: number) => {
    if (!currentIdentityId) return;

    setIsSending(true);
    try {
      const fileName = file.name;
      const filePath = `${currentIdentityId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("message-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("message-files")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentIdentityId,
        content: null,
        message_type: "audio",
        metadata: {
          file_url: urlData.publicUrl,
          file_name: fileName,
          file_type: file.type,
          file_path: filePath,
          duration: duration,
          reply_to: replyToMessage
            ? {
                message_id: replyToMessage.id,
                sender_name: replyToMessage.senderName,
                content: replyToMessage.content,
                message_type: replyToMessage.message_type,
              }
            : null,
        },
      });

      if (insertError) throw insertError;

      setReplyToMessage(null);
      toast.success("语音消息发送成功");
    } catch (error) {
      console.error("发送语音消息失败:", error);
      toast.error("发送失败");
    } finally {
      setIsSending(false);
    }
  };

  const sendLocationMessage = async (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    if (!currentIdentityId) return;

    setIsSending(true);
    try {
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentIdentityId,
        content: location.address || `${location.latitude}, ${location.longitude}`,
        message_type: "location",
        metadata: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          reply_to: replyToMessage
            ? {
                message_id: replyToMessage.id,
                sender_name: replyToMessage.senderName,
                content: replyToMessage.content,
                message_type: replyToMessage.message_type,
              }
            : null,
        },
      });

      if (insertError) throw insertError;

      setReplyToMessage(null);
      toast.success("位置发送成功");
    } catch (error) {
      console.error("发送位置失败:", error);
      toast.error("发送失败");
    } finally {
      setIsSending(false);
    }
  };

  // 重试失败消息
  const retryMessage = async (message: Message) => {
    if (!message.tempId || !currentIdentityId) return;

    try {
      await retryMessageMutation.mutateAsync({
        tempId: message.tempId,
        senderId: currentIdentityId,
        content: message.content || "",
        metadata: message.metadata,
      });
    } catch (error) {
      console.error("重试消息失败:", error);
    }
  };

  return {
    messages,
    isSending,
    isLoadingMore: loadMoreMutation.isPending,
    hasMoreMessages: true, // TODO: 从 loadMoreMutation 结果中获取
    markAsRead,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendVoiceMessage,
    sendLocationMessage,
    retryMessage, // 新增：重试功能
  };
}
