import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { islandSDK } from "@/lib/DynamicIslandSDK";

const APP_ID = 'chat';
const PERMISSION_TYPE = 'island_notification';

export function useStarredFriendMessages(currentConversationId?: string) {
  const { currentIdentity } = useIdentity();
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (!currentIdentity) return;

    const initPermissionAndListen = async () => {
      // Check if chat app has island notification permission enabled
      const { data } = await supabase
        .from("app_permissions")
        .select("permission_mode")
        .eq("user_id", currentIdentity.profile.id)
        .eq("app_id", APP_ID)
        .eq("permission_type", PERMISSION_TYPE)
        .maybeSingle();

      // 只有 always_allow 或 allow_while_using 才算授权
      const permitted = data?.permission_mode === 'always_allow' || data?.permission_mode === 'allow_while_using';
      setHasPermission(permitted);

      if (!permitted) {
        console.log('Chat app does not have island notification permission');
        return;
      }

      // 设置实时监听
      const channel = supabase
        .channel('starred-friend-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload: any) => {
            const msg = payload.new;
            
            // 1. 排除自己发送的消息
            if (msg.sender_id === currentIdentity.profile.id) return;
            
            // 2. 排除当前正在查看的会话
            if (msg.conversation_id === currentConversationId) return;
            
            // 3. 查询是否为星标好友
            const { data: friendship } = await supabase
              .from('friendships')
              .select('is_starred')
              .eq('user_id', currentIdentity.profile.id)
              .eq('friend_id', msg.sender_id)
              .maybeSingle();
            
            if (!friendship?.is_starred) return;
            
            // 4. 获取发送者信息
            const { data: sender } = await supabase
              .from('profiles')
              .select('display_name, unique_username, avatar_url')
              .eq('id', msg.sender_id)
              .single();
            
            if (!sender) return;
            
            // 5. 通过 SDK 发送通知（会自动检查权限）
            await islandSDK.notify(currentIdentity.profile.id, {
              appId: APP_ID,
              type: 'starred_chat',
              content: msg.content?.substring(0, 30) || '[图片]',
              source: 'chat',
              conversationId: msg.conversation_id,
              senderId: msg.sender_id,
              senderName: sender.display_name || sender.unique_username || '未知',
              senderAvatar: sender.avatar_url || '',
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initPermissionAndListen();
  }, [currentIdentity, currentConversationId]);
}
