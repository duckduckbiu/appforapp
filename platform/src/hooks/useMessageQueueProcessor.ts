import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getPendingMessages,
  markMessageAsSending,
  markMessageAsFailed,
  removeMessageFromQueue,
  type QueuedMessage,
} from "@/lib/messageQueue";
import { toast } from "sonner";

/**
 * 消息队列处理器 Hook
 * 监听网络状态，自动处理队列中的消息
 */
export function useMessageQueueProcessor() {
  const processingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 处理单条消息
  const processMessage = useCallback(async (message: QueuedMessage): Promise<boolean> => {
    try {
      await markMessageAsSending(message.id);

      // 检查并重新加入会话（如果需要）
      const { data: participant } = await supabase
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", message.conversationId)
        .eq("user_id", message.senderId)
        .maybeSingle();

      if (!participant) {
        const { error: rejoinError } = await supabase
          .from("conversation_participants")
          .insert({
            conversation_id: message.conversationId,
            user_id: message.senderId,
          });

        if (rejoinError) {
          throw new Error("无法加入会话");
        }
      }

      // 发送消息
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: message.conversationId,
          sender_id: message.senderId,
          content: message.content,
          message_type: message.messageType,
          metadata: message.metadata,
        })
        .select()
        .single();

      if (error) throw error;

      // 发送成功，从队列中移除
      await removeMessageFromQueue(message.id);
      console.log("消息发送成功:", message.id);
      return true;
    } catch (error) {
      console.error("消息发送失败:", error);
      await markMessageAsFailed(message.id);
      return false;
    }
  }, []);

  // 处理队列中的所有待发送消息
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (!navigator.onLine) return;

    processingRef.current = true;

    try {
      const pendingMessages = await getPendingMessages();
      
      if (pendingMessages.length === 0) {
        processingRef.current = false;
        return;
      }

      console.log(`开始处理 ${pendingMessages.length} 条待发送消息`);

      // 逐个处理消息（避免并发问题）
      for (const message of pendingMessages) {
        await processMessage(message);
        // 添加小延迟，避免请求过快
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      toast.success(`已发送 ${pendingMessages.length} 条离线消息`);
    } catch (error) {
      console.error("处理消息队列失败:", error);
    } finally {
      processingRef.current = false;
    }
  }, [processMessage]);

  // 网络恢复时自动处理队列
  useEffect(() => {
    const handleOnline = () => {
      console.log("网络已恢复，开始处理消息队列");
      toast.info("网络已恢复，正在发送离线消息...");
      processQueue();
    };

    const handleOffline = () => {
      console.log("网络已断开");
      toast.warning("网络已断开，消息将在网络恢复后发送");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [processQueue]);

  // 定期检查队列（每 10 秒）
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (navigator.onLine) {
        processQueue();
      }
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [processQueue]);

  // 初始化时处理一次队列
  useEffect(() => {
    if (navigator.onLine) {
      processQueue();
    }
  }, [processQueue]);

  return { processQueue };
}
