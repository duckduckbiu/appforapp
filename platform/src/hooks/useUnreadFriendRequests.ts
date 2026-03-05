import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";

export function useUnreadFriendRequests() {
  const { currentIdentity } = useIdentity();
  const [hasUnread, setHasUnread] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!currentIdentity) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("friend_requests")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", currentIdentity.profile.id)
          .eq("status", "pending")
          .eq("is_read", false);

        if (error) throw error;

        const requestCount = count || 0;
        setCount(requestCount);
        setHasUnread(requestCount > 0);
      } catch (error) {
        console.error("获取好友请求数量失败:", error);
      }
    };

    fetchUnreadCount();

    // 订阅实时更新
    const channel = supabase
      .channel(`friend-requests-count-${currentIdentity.profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_id=eq.${currentIdentity.profile.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentIdentity]);

  return { hasUnread, count };
}
