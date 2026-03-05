import { useState, useEffect, useCallback } from "react";

const SEARCH_HISTORY_KEY = "search_history";
const MAX_HISTORY_ITEMS = 10;

export interface SearchHistoryItem {
  id: string;
  query: string;
  type: "query" | "user" | "hashtag";
  timestamp: number;
  metadata?: {
    userId?: string;
    userName?: string;
    userAvatar?: string;
    hashtagName?: string;
  };
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // 从 localStorage 加载历史
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  }, []);

  // 保存到 localStorage
  const saveHistory = useCallback((items: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
      setHistory(items);
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  }, []);

  // 添加搜索记录
  const addToHistory = useCallback((item: Omit<SearchHistoryItem, "id" | "timestamp">) => {
    setHistory((prev) => {
      // 移除重复项
      const filtered = prev.filter((h) => {
        if (item.type === "query") {
          return !(h.type === "query" && h.query.toLowerCase() === item.query.toLowerCase());
        } else if (item.type === "user") {
          return !(h.type === "user" && h.metadata?.userId === item.metadata?.userId);
        } else if (item.type === "hashtag") {
          return !(h.type === "hashtag" && h.metadata?.hashtagName === item.metadata?.hashtagName);
        }
        return true;
      });

      const newItem: SearchHistoryItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      };

      const newHistory = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // 删除单条记录
  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const newHistory = prev.filter((h) => h.id !== id);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // 清空历史
  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}
