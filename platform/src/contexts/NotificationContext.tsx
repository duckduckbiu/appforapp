import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { islandSDK } from "@/lib/DynamicIslandSDK";

export interface Notification {
  id: string;
  type: "chat" | "payment" | "system" | "identity" | "starred_chat" | "info" | "ai_activity";
  content: string;
  source: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
}

interface NotificationContextType {
  currentNotification: Notification | null;
  showNotification: (notification: Omit<Notification, "id">) => void;
  clearNotification: () => void;
  pauseTimeout: () => void;
  resumeTimeout: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingTime, setRemainingTime] = useState(6000);
  const [startTime, setStartTime] = useState<number | null>(null);

  // 连接 SDK 的通知回调
  useEffect(() => {
    islandSDK.setNotificationCallback((notification) => {
      showNotification(notification);
    });
  }, []);

  const showNotification = (notification: Omit<Notification, "id">) => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newNotification: Notification = {
      id: Date.now().toString(),
      ...notification,
    };
    setCurrentNotification(newNotification);
    setIsPaused(false);
    setRemainingTime(6000);
    setStartTime(Date.now());

    // Auto-dismiss after 6 seconds
    const newTimeoutId = setTimeout(() => {
      setCurrentNotification(null);
      setTimeoutId(null);
      setStartTime(null);
    }, 6000);
    
    setTimeoutId(newTimeoutId);
  };

  const pauseTimeout = () => {
    if (timeoutId && startTime) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      setRemainingTime(Math.max(0, 6000 - elapsed));
      setIsPaused(true);
      setTimeoutId(null);
    }
  };

  const resumeTimeout = () => {
    if (isPaused && currentNotification) {
      setIsPaused(false);
      setStartTime(Date.now());
      
      const newTimeoutId = setTimeout(() => {
        setCurrentNotification(null);
        setTimeoutId(null);
        setStartTime(null);
      }, remainingTime);
      
      setTimeoutId(newTimeoutId);
    }
  };

  const clearNotification = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setCurrentNotification(null);
    setIsPaused(false);
    setStartTime(null);
  };

  return (
    <NotificationContext.Provider
      value={{
        currentNotification,
        showNotification,
        clearNotification,
        pauseTimeout,
        resumeTimeout,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
