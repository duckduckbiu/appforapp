import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MessageHistoryItem {
  type: "request" | "reject";
  message: string;
  timestamp: string;
  user_id: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  message_history: MessageHistoryItem[] | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  is_read: boolean;
  sender?: {
    id: string;
    unique_username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  receiver?: {
    id: string;
    unique_username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * React Query hook for fetching friend requests with optimized JOIN queries
 * 使用优化的 JOIN 查询获取好友请求（避免 N+1 问题）
 */
export function useFriendRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["friendRequests", userId],
    queryFn: async () => {
      if (!userId) return { received: [], sent: [] };

      // 使用 JOIN 一次性获取收到的请求和发送者信息
      const { data: receivedData, error: receivedError } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey(id, unique_username, display_name, avatar_url)
        `)
        .eq("receiver_id", userId)
        .order("updated_at", { ascending: false });

      if (receivedError) throw receivedError;

      // 使用 JOIN 一次性获取发送的请求和接收者信息
      const { data: sentData, error: sentError } = await supabase
        .from("friend_requests")
        .select(`
          *,
          receiver:profiles!friend_requests_receiver_id_fkey(id, unique_username, display_name, avatar_url)
        `)
        .eq("sender_id", userId)
        .order("created_at", { ascending: false });

      if (sentError) throw sentError;

      // 处理数据类型
      const received: FriendRequest[] = (receivedData || []).map((req) => ({
        ...req,
        message_history: (req.message_history as unknown as MessageHistoryItem[] | null) || null,
      }));

      const sent: FriendRequest[] = (sentData || []).map((req) => ({
        ...req,
        message_history: (req.message_history as unknown as MessageHistoryItem[] | null) || null,
      }));

      return { received, sent };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2分钟内认为数据新鲜
    gcTime: 1000 * 60 * 10, // 缓存保留10分钟
  });
}
