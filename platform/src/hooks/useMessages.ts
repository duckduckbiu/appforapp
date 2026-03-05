import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MESSAGE_CONSTANTS } from "@/lib/constants";
import { cacheMessages, getCachedMessages } from "@/lib/indexedDB";

export interface Message {
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
  tempId?: string; // 临时 ID（用于乐观更新）
}

interface UseMessagesOptions {
  conversationId: string;
  userId: string | undefined;
  enabled?: boolean;
}

/**
 * React Query hook for fetching and caching messages
 * 消息列表查询 hook，支持实时更新、分页加载和智能缓存
 */
export function useMessages({ conversationId, userId, enabled = true }: UseMessagesOptions) {
  const queryClient = useQueryClient();
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖失效函数：300ms内多次失效只执行一次
  const debouncedInvalidate = () => {
    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    reloadTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }, 300);
  };

  // 使用 React Query 查询消息列表，集成 IndexedDB 持久化
  const query = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      // 先从 IndexedDB 读取缓存（立即返回，秒开体验）
      const cached = await getCachedMessages(conversationId);
      if (cached && cached.length > 0) {
        // 有缓存，立即返回缓存数据
        // 同时后台触发网络请求更新
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }, 100);
        return cached;
      }
      
      // 无缓存，加载最新数据
      const messages = await loadMessages(conversationId);
      
      // 将新数据缓存到 IndexedDB
      if (messages.length > 0) {
        await cacheMessages(conversationId, messages);
      }
      
      return messages;
    },
    enabled: enabled && !!conversationId, // 只在启用且 conversationId 存在时执行查询
    staleTime: 1000 * 30, // 30秒内认为数据新鲜（消息需要较快更新）
    gcTime: 1000 * 60 * 5, // 缓存保留5分钟
  });

  // 标记已读 mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
    },
  });

  // 设置 Realtime 订阅
  useEffect(() => {
    if (!userId || !enabled) return;

    let messagesChannel: any = null;

    // 订阅消息变化
    messagesChannel = supabase
      .channel(`messages-realtime-${conversationId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // 新消息插入时，乐观更新缓存
            queryClient.setQueryData(["messages", conversationId], (old: Message[] | undefined) => {
              if (!old) return old;
              const newMessage = payload.new as Message;
              // 检查消息是否已存在（避免重复）
              if (old.some((m) => m.id === newMessage.id)) return old;
              return [...old, newMessage];
            });
            
            // 更新 IndexedDB 缓存
            const messages = queryClient.getQueryData(["messages", conversationId]) as Message[] | undefined;
            if (messages) {
              await cacheMessages(conversationId, messages);
            }
            
            // 自动标记已读
            markAsReadMutation.mutate();
          } else if (payload.eventType === "DELETE") {
            // 删除消息时，从缓存中移除
            queryClient.setQueryData(["messages", conversationId], (old: Message[] | undefined) => {
              if (!old) return old;
              return old.filter((m) => m.id !== payload.old.id);
            });
            
            // 更新 IndexedDB 缓存
            const messages = queryClient.getQueryData(["messages", conversationId]) as Message[] | undefined;
            if (messages) {
              await cacheMessages(conversationId, messages);
            }
          } else if (payload.eventType === "UPDATE") {
            // 更新消息时，更新缓存中的消息
            queryClient.setQueryData(["messages", conversationId], (old: Message[] | undefined) => {
              if (!old) return old;
              return old.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m));
            });
            
            // 更新 IndexedDB 缓存
            const messages = queryClient.getQueryData(["messages", conversationId]) as Message[] | undefined;
            if (messages) {
              await cacheMessages(conversationId, messages);
            }
          }
        }
      )
      .subscribe();

    // 清理订阅
    return () => {
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      if (messagesChannel) {
        messagesChannel.unsubscribe();
        supabase.removeChannel(messagesChannel);
      }
    };
  }, [conversationId, userId, enabled, queryClient]);

  return {
    ...query,
    markAsRead: markAsReadMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
  };
}

/**
 * Load messages for a conversation
 * 加载会话的最新消息（默认最新30条）
 */
async function loadMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_CONSTANTS.INITIAL_LOAD_COUNT);

    if (error) throw error;

    // 反转顺序以从旧到新显示
    return (data || []).reverse();
  } catch (error) {
    console.error("加载消息失败:", error);
    return [];
  }
}

/**
 * Hook for loading more historical messages (pagination)
 * 加载更多历史消息的 hook（向上滚动分页）
 */
export function useLoadMoreMessages(conversationId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (oldestTimestamp: string) => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .lt("created_at", oldestTimestamp)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_CONSTANTS.PAGE_SIZE);

      if (error) throw error;

      return { messages: (data || []).reverse(), hasMore: data ? data.length >= MESSAGE_CONSTANTS.PAGE_SIZE : false };
    },
    onSuccess: (result) => {
      // 将新消息添加到缓存前面
      queryClient.setQueryData(["messages", conversationId], (old: Message[] | undefined) => {
        if (!old) return result.messages;
        return [...result.messages, ...old];
      });
      
      // 更新 IndexedDB 缓存
      const messages = queryClient.getQueryData(["messages", conversationId]) as Message[] | undefined;
      if (messages) {
        cacheMessages(conversationId, messages);
      }
    },
  });

  return mutation;
}
