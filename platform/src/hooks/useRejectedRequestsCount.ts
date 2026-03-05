import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";

export function useRejectedRequestsCount() {
  const { currentIdentity } = useIdentity();
  const [count, setCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!currentIdentity) return;

    const fetchRejectedCount = async () => {
      try {
        // 获取被拒绝且未读的请求数量
        const { count: rejectedCount, error } = await supabase
          .from("friend_requests")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", currentIdentity.profile.id)
          .eq("status", "rejected")
          .eq("is_read", false);

        if (error) throw error;

        const requestCount = rejectedCount || 0;
        setCount(requestCount);
        setHasUnread(requestCount > 0);
      } catch (error) {
        console.error("获取被拒绝请求数量失败:", error);
      }
    };

    fetchRejectedCount();

    // 订阅实时更新
    const channel = supabase
      .channel(`rejected-requests-count-${currentIdentity.profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `sender_id=eq.${currentIdentity.profile.id}`,
        },
        () => {
          fetchRejectedCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentIdentity]);

  return { hasUnread, count };
}
