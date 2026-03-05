import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIdentity } from "@/contexts/IdentityContext";

export type MessageRequestStatus = "pending" | "accepted" | "rejected";

export interface MessageRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  status: MessageRequestStatus;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    display_name: string;
    unique_username: string;
    avatar_url: string;
  };
}

interface SendMessageRequestParams {
  receiverId: string;
  message: string;
}

export function useMessageRequests() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  // 获取收到的消息请求
  const { data: receivedRequests, isLoading: isLoadingReceived } = useQuery({
    queryKey: ["message-requests", "received", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_requests")
        .select(`
          *,
          sender:profiles!message_requests_sender_id_fkey (
            id,
            display_name,
            unique_username,
            avatar_url
          )
        `)
        .eq("receiver_id", userId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MessageRequest[];
    },
    enabled: !!userId,
  });

  // 获取发送的消息请求
  const { data: sentRequests, isLoading: isLoadingSent } = useQuery({
    queryKey: ["message-requests", "sent", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_requests")
        .select("*")
        .eq("sender_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MessageRequest[];
    },
    enabled: !!userId,
  });

  // 发送消息请求
  const sendRequest = useMutation({
    mutationFn: async (params: SendMessageRequestParams) => {
      if (!userId) throw new Error("未登录");

      const { data, error } = await supabase
        .from("message_requests")
        .upsert({
          sender_id: userId,
          receiver_id: params.receiverId,
          message: params.message,
          status: "pending",
        }, {
          onConflict: "sender_id,receiver_id",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-requests"] });
      toast({ title: "消息请求已发送" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "发送失败",
        description: error.message,
      });
    },
  });

  // 接受消息请求
  const acceptRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: request, error: fetchError } = await supabase
        .from("message_requests")
        .select("sender_id")
        .eq("id", requestId)
        .single();

      if (fetchError) throw fetchError;

      // 更新请求状态
      const { error: updateError } = await supabase
        .from("message_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // 创建私聊会话
      const { data: conversationId, error: convError } = await supabase
        .rpc("create_private_conversation", {
          friend_uuid: request.sender_id,
        });

      if (convError) throw convError;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["message-requests"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "已接受消息请求" });
      return conversationId;
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error.message,
      });
    },
  });

  // 拒绝消息请求
  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("message_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-requests"] });
      toast({ title: "已拒绝消息请求" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error.message,
      });
    },
  });

  return {
    receivedRequests,
    sentRequests,
    isLoading: isLoadingReceived || isLoadingSent,
    sendRequest: sendRequest.mutateAsync,
    isSending: sendRequest.isPending,
    acceptRequest: acceptRequest.mutateAsync,
    isAccepting: acceptRequest.isPending,
    rejectRequest: rejectRequest.mutate,
    isRejecting: rejectRequest.isPending,
  };
}
