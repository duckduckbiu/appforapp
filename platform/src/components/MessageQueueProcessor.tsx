import { useMessageQueueProcessor } from "@/hooks/useMessageQueueProcessor";
import { ReactNode } from "react";

/**
 * 消息队列处理器组件
 * 在应用启动时自动处理离线消息队列
 */
export function MessageQueueProcessor({ children }: { children: ReactNode }) {
  useMessageQueueProcessor();
  return <>{children}</>;
}
