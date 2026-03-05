import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Message } from "./useMessages";
import { addMessageToQueue } from "@/lib/messageQueue";

interface SendMessageOptions {
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: string;
  metadata?: any;
}

interface OptimisticMessage extends Message {
  status?: "sending" | "sent" | "failed";
  tempId?: string;
}

/**
 * Hook for sending messages with optimistic updates
 * 发送消息的 hook，支持乐观更新（消息立即显示）
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: SendMessageOptions) => {
      // 检查并重新加入会话（如果需要）
      const { data: participant } = await supabase
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", options.conversationId)
        .eq("user_id", options.senderId)
        .maybeSingle();

      if (!participant) {
        const { error: rejoinError } = await supabase
          .from("conversation_participants")
          .insert({
            conversation_id: options.conversationId,
            user_id: options.senderId,
          });

        if (rejoinError) {
          throw new Error("无法加入会话");
        }
      }

      // 发送消息到数据库
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: options.conversationId,
          sender_id: options.senderId,
          content: options.content,
          message_type: options.messageType || "text",
          metadata: options.metadata || {},
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes("violates row-level security policy")) {
          throw new Error("无法发送消息，您可能已被对方拉黑");
        }
        throw error;
      }

      return data as Message;
    },

    // 乐观更新：立即在 UI 显示消息
    onMutate: async (options) => {
      // 取消任何正在进行的查询，避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });

      // 获取当前消息列表
      const previousMessages = queryClient.getQueryData<Message[]>(["messages", conversationId]);

      // 创建临时消息（乐观更新）
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage: OptimisticMessage = {
        id: tempId,
        conversation_id: options.conversationId,
        sender_id: options.senderId,
        content: options.content,
        message_type: options.messageType || "text",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        metadata: options.metadata || {},
        status: "sending",
        tempId,
      };

      // 立即更新缓存，添加临时消息
      queryClient.setQueryData<Message[]>(["messages", conversationId], (old) => {
        return old ? [...old, optimisticMessage] : [optimisticMessage];
      });

      // 返回上下文，用于回滚
      return { previousMessages, tempId };
    },

    // 成功：用真实消息替换临时消息
    onSuccess: (data, _variables, context) => {
      if (!context) return;

      queryClient.setQueryData<Message[]>(["messages", conversationId], (old) => {
        if (!old) return [data];

        // 移除临时消息，添加真实消息
        return old
          .filter((msg) => (msg as OptimisticMessage).tempId !== context.tempId)
          .concat({ ...data, status: "sent" } as OptimisticMessage);
      });
    },

    // 失败：将消息加入队列，支持离线重试
    onError: async (error, variables, context) => {
      console.error("发送消息失败:", error);

      if (!context) {
        toast.error("发送失败");
        return;
      }

      // 如果是网络问题，将消息加入队列
      if (!navigator.onLine || error instanceof TypeError) {
        try {
          await addMessageToQueue({
            conversationId: variables.conversationId,
            senderId: variables.senderId,
            content: variables.content,
            messageType: variables.messageType || "text",
            metadata: variables.metadata || {},
          });

          // 标记消息为队列中
          queryClient.setQueryData<Message[]>(["messages", conversationId], (old) => {
            if (!old) return old;

            return old.map((msg) => {
              if ((msg as OptimisticMessage).tempId === context.tempId) {
                return { ...msg, status: "sending" } as OptimisticMessage;
              }
              return msg;
            });
          });

          toast.info("消息已加入队列，网络恢复后自动发送");
        } catch (queueError) {
          console.error("加入队列失败:", queueError);
          toast.error("发送失败，无法加入队列");
        }
        return;
      }

      // 其他错误，标记为失败
      queryClient.setQueryData<Message[]>(["messages", conversationId], (old) => {
        if (!old) return old;

        return old.map((msg) => {
          if ((msg as OptimisticMessage).tempId === context.tempId) {
            return { ...msg, status: "failed" } as OptimisticMessage;
          }
          return msg;
        });
      });

      toast.error(error instanceof Error ? error.message : "发送失败");
    },

    // 无论成功或失败，都刷新相关查询
    onSettled: () => {
      // 刷新会话列表（更新最后一条消息）
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/**
 * Hook for retrying failed messages
 * 重试失败消息的 hook
 */
export function useRetryMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tempId, senderId, content, metadata }: { tempId: string; senderId: string; content: string; metadata?: any }) => {
      // 重新发送消息
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: content,
          message_type: "text",
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return { data: data as Message, tempId };
    },

    onMutate: async ({ tempId }) => {
      // 将失败状态改为发送中
      queryClient.setQueryData<OptimisticMessage[]>(["messages", conversationId], (old) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.tempId === tempId) {
            return { ...msg, status: "sending" };
          }
          return msg;
        });
      });
    },

    onSuccess: ({ data, tempId }) => {
      // 用真实消息替换临时消息
      queryClient.setQueryData<Message[]>(["messages", conversationId], (old) => {
        if (!old) return [data];
        return old
          .filter((msg) => (msg as OptimisticMessage).tempId !== tempId)
          .concat({ ...data, status: "sent" } as OptimisticMessage);
      });
      toast.success("重新发送成功");
    },

    onError: (error, { tempId }) => {
      // 重新标记为失败
      queryClient.setQueryData<OptimisticMessage[]>(["messages", conversationId], (old) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.tempId === tempId) {
            return { ...msg, status: "failed" };
          }
          return msg;
        });
      });
      toast.error("重新发送失败");
    },
  });
}
