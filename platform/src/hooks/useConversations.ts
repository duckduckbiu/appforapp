import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheConversations, getCachedConversations } from "@/lib/indexedDB";

export interface Conversation {
  id: string;
  type: string;
  display_name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  friend_id?: string;
  is_pinned?: boolean;
}

/**
 * React Query hook for fetching and caching conversations
 * 会话列表查询 hook，支持实时更新和智能缓存
 */
export function useConversations(userId: string | undefined) {
  const queryClient = useQueryClient();
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖失效函数：300ms内多次失效只执行一次
  const debouncedInvalidate = () => {
    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    reloadTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    }, 300);
  };

  // 使用 React Query 查询会话列表，集成 IndexedDB 持久化
  // 采用服务器优先策略：始终从服务器获取最新数据，缓存用于初始显示
  const query = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // 始终从服务器加载最新数据
      const conversations = await loadConversations(userId);
      
      // 成功获取后更新 IndexedDB 缓存
      if (conversations.length > 0) {
        await cacheConversations(userId, conversations);
      }
      
      return conversations;
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30秒内认为数据新鲜
    gcTime: 1000 * 60 * 10, // 缓存保留10分钟
    // 使用缓存作为初始数据实现秒开体验
    initialData: () => {
      // 同步返回 undefined，让 React Query 立即开始请求
      // IndexedDB 是异步的，无法在 initialData 中使用
      return undefined;
    },
    // 使用 placeholderData 提供加载时的占位数据
    placeholderData: (previousData) => previousData,
  });

  // 设置 Realtime 订阅
  useEffect(() => {
    if (!userId) return;

    let messagesChannel: any = null;
    let profilesChannel: any = null;
    let participantsChannel: any = null;

    // 订阅消息变化
    messagesChannel = supabase
      .channel(`conversations-messages-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async () => {
          debouncedInvalidate();
          
          // 同时更新 IndexedDB 缓存
          const conversations = queryClient.getQueryData(["conversations", userId]) as Conversation[] | undefined;
          if (conversations && userId) {
            await cacheConversations(userId, conversations);
          }
        }
      )
      .subscribe();

    // 订阅用户资料变化（只在显示字段变化时失效）
    profilesChannel = supabase
      .channel(`conversations-profiles-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          if (
            payload.new &&
            (payload.new.display_name !== payload.old?.display_name ||
              payload.new.avatar_url !== payload.old?.avatar_url ||
              payload.new.unique_username !== payload.old?.unique_username)
          ) {
            debouncedInvalidate();
            
            // 同时更新 IndexedDB 缓存
            setTimeout(async () => {
              const conversations = queryClient.getQueryData(["conversations", userId]) as Conversation[] | undefined;
              if (conversations && userId) {
                await cacheConversations(userId, conversations);
              }
            }, 350);
          }
        }
      )
      .subscribe();

    // 订阅会话参与者变化
    participantsChannel = supabase
      .channel(`conversations-participants-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedInvalidate();
          
          // 同时更新 IndexedDB 缓存
          setTimeout(async () => {
            const conversations = queryClient.getQueryData(["conversations", userId]) as Conversation[] | undefined;
            if (conversations && userId) {
              await cacheConversations(userId, conversations);
            }
          }, 350);
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
      if (profilesChannel) {
        profilesChannel.unsubscribe();
        supabase.removeChannel(profilesChannel);
      }
      if (participantsChannel) {
        participantsChannel.unsubscribe();
        supabase.removeChannel(participantsChannel);
      }
    };
  }, [userId, queryClient]);

  return query;
}

/**
 * Load conversations for a user using optimized RPC function
 * 使用优化的 RPC 函数加载用户的所有会话列表（单次查询，包含所有详细信息）
 */
async function loadConversations(userId: string): Promise<Conversation[]> {
  try {
    // 使用优化的 RPC 函数一次性获取所有会话数据（包括未读数）
    const { data, error } = await supabase.rpc("get_conversations_with_details", {
      p_user_id: userId,
    });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // 转换 RPC 返回的数据为 Conversation 格式
    const conversations: Conversation[] = data.map((conv) => {
      let displayName = "";
      let avatarUrl = null;
      let friendId = undefined;

      if (conv.conversation_type === "private") {
        // 私聊：使用好友信息
        displayName = conv.friend_nickname || conv.friend_display_name || "";
        avatarUrl = conv.friend_avatar;
        friendId = conv.friend_id;
      } else if (conv.conversation_type === "group") {
        // 群聊：使用群聊信息
        displayName = conv.group_chat_name || "";
        avatarUrl = conv.group_chat_avatar;
      }

      // 处理消息类型显示
      let lastMessageText = conv.last_message_content || "";
      if (conv.last_message_type === "image") {
        lastMessageText = "[图片]";
      } else if (conv.last_message_type === "voice" || conv.last_message_type === "audio") {
        lastMessageText = "[语音]";
      } else if (conv.last_message_type === "file") {
        lastMessageText = "[文件]";
      } else if (conv.last_message_type === "location") {
        lastMessageText = "[位置]";
      }

      return {
        id: conv.conv_id,
        type: conv.conversation_type,
        display_name: displayName,
        avatar_url: avatarUrl,
        last_message: lastMessageText,
        last_message_time: conv.last_message_created_at,
        unread_count: Number(conv.unread_count) || 0,
        friend_id: friendId,
        is_pinned: conv.is_pinned || false,
      };
    });

    // 数据已经在 RPC 函数中排序（置顶优先），直接返回
    return conversations;
  } catch (error) {
    console.error("加载会话列表失败:", error);
    return [];
  }
}
