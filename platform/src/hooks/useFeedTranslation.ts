import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Translation {
  feed_id: string;
  target_lang: string;
  translated_title: string | null;
  translated_content: string | null;
}

/**
 * Hook for on-demand feed item translation.
 * Maintains a local cache of translations and provides a translate function.
 */
export function useFeedTranslation(targetLang = "zh-CN") {
  const [translations, setTranslations] = useState<Map<string, Translation>>(new Map());
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const pendingRef = useRef(new Set<string>());

  const translateItems = useCallback(async (feedIds: string[]) => {
    // Filter out already translated and currently pending items
    const needed = feedIds.filter(
      (id) => !translations.has(id) && !pendingRef.current.has(id)
    );
    if (needed.length === 0) return;

    // Mark as pending
    needed.forEach((id) => pendingRef.current.add(id));
    setTranslating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("translate-feed-items", {
        body: { feed_ids: needed.slice(0, 10), target_lang: targetLang },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (res.data?.translations) {
        setTranslations((prev) => {
          const next = new Map(prev);
          for (const t of res.data.translations as Translation[]) {
            next.set(t.feed_id, t);
          }
          return next;
        });
      }
    } catch (e) {
      console.warn("[Translation] failed:", e);
    } finally {
      needed.forEach((id) => pendingRef.current.delete(id));
      setTranslating(false);
    }
  }, [targetLang, translations]);

  const getTranslation = useCallback((feedId: string): Translation | undefined => {
    return translations.get(feedId);
  }, [translations]);

  const toggleTranslation = useCallback(() => {
    setShowTranslated((prev) => !prev);
  }, []);

  return {
    translations,
    translating,
    showTranslated,
    translateItems,
    getTranslation,
    toggleTranslation,
  };
}
