import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConversationInfo {
  name: string;
  avatarUrl: string | null;
  type: string;
  friendId?: string;
}

interface UseConversationInfoProps {
  conversationId: string;
  currentIdentity: any;
}

export function useConversationInfo({
  conversationId,
  currentIdentity,
}: UseConversationInfoProps) {
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [senderProfiles, setSenderProfiles] = useState<Map<string, { avatar_url: string | null; display_name: string | null }>>(new Map());
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const loadConversationInfo = async () => {
    if (!currentIdentity) return;

    try {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("type")
        .eq("id", conversationId)
        .single();

      if (!conversation) return;

      if (conversation.type === "private") {
        const userId = currentIdentity.profile.id;
        const { data: otherParticipant } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conversationId)
          .neq("user_id", userId)
          .single();

        if (otherParticipant) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, unique_username, avatar_url")
            .eq("id", otherParticipant.user_id)
            .single();

          if (profile) {
            // 查询备注和星标状态
            const { data: friendship } = await supabase
              .from("friendships")
              .select("nickname, is_starred")
              .eq("user_id", userId)
              .eq("friend_id", otherParticipant.user_id)
              .maybeSingle();

            const displayName = 
              friendship?.nickname || 
              profile.display_name || 
              profile.unique_username;

            // 设置星标状态
            setIsStarred(friendship?.is_starred || false);

            setConversationInfo({
              name: displayName,
              avatarUrl: profile.avatar_url,
              type: "private",
              friendId: otherParticipant.user_id,
            });

            // 检查我是否把对方拉黑了
            const { data: myBlocklistData } = await supabase
              .from("blacklist")
              .select("id")
              .eq("user_id", userId)
              .eq("blocked_user_id", otherParticipant.user_id)
              .maybeSingle();

            setIsBlocked(!!myBlocklistData);

            // 检查对方是否把我拉黑了
            const { data: otherBlocklistData } = await supabase
              .from("blacklist")
              .select("id")
              .eq("user_id", otherParticipant.user_id)
              .eq("blocked_user_id", userId)
              .maybeSingle();

            setIsBlockedByOther(!!otherBlocklistData);
          }
        }
      } else if (conversation.type === "group") {
        const { data: groupChat } = await supabase
          .from("group_chats")
          .select("name, avatar_url")
          .eq("conversation_id", conversationId)
          .single();

        if (groupChat) {
          setConversationInfo({
            name: groupChat.name,
            avatarUrl: groupChat.avatar_url,
            type: "group",
          });
        }
      }
    } catch (error) {
      console.error("加载会话信息失败:", error);
    }
  };

  const loadParticipantStatus = async () => {
    if (!currentIdentity) return;

    try {
      const { data } = await supabase
        .from("conversation_participants")
        .select("is_muted, is_pinned")
        .eq("conversation_id", conversationId)
        .eq("user_id", currentIdentity.profile.id)
        .single();

      if (data) {
        setIsMuted(data.is_muted || false);
        setIsPinned(data.is_pinned || false);
      }
    } catch (error) {
      console.error("加载会话状态失败:", error);
    }
  };

  const loadSenderProfiles = async (senderIds: string[]) => {
    if (senderIds.length === 0) return;

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, avatar_url, display_name")
        .in("id", senderIds);

      if (profiles) {
        const profileMap = new Map(
          profiles.map(p => [p.id, { avatar_url: p.avatar_url, display_name: p.display_name }])
        );
        setSenderProfiles(profileMap);
      }
    } catch (error) {
      console.error("加载发送者资料失败:", error);
    }
  };

  // 初始加载
  useEffect(() => {
    if (!currentIdentity) return;
    
    loadConversationInfo();
    loadParticipantStatus();
  }, [conversationId, currentIdentity]);

  return {
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
    loadParticipantStatus,
    loadSenderProfiles,
  };
}
