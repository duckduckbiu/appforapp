import { createStore, get, set, del, keys } from "idb-keyval";

/**
 * 消息队列管理器
 * 支持离线消息持久化、自动重试、指数退避
 */

// 创建专用的消息队列 store
const queueStore = createStore("bill-ai-db", "message-queue");

export interface QueuedMessage {
  id: string; // 队列中的唯一 ID
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  metadata: any;
  createdAt: number; // 时间戳
  retryCount: number; // 重试次数
  nextRetryAt: number; // 下次重试时间
  status: "pending" | "sending" | "failed";
}

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 基础延迟 1 秒
  maxDelay: 32000, // 最大延迟 32 秒
};

// 计算指数退避延迟（1s → 2s → 4s → 8s → 16s → 32s）
function calculateBackoffDelay(retryCount: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * 将消息添加到队列
 */
export async function addMessageToQueue(message: Omit<QueuedMessage, "id" | "createdAt" | "retryCount" | "nextRetryAt" | "status">): Promise<string> {
  const queuedMessage: QueuedMessage = {
    ...message,
    id: `queue-${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
    retryCount: 0,
    nextRetryAt: Date.now(),
    status: "pending",
  };

  await set(queuedMessage.id, queuedMessage, queueStore);
  console.log("消息已加入队列:", queuedMessage.id);
  return queuedMessage.id;
}

/**
 * 从队列中移除消息
 */
export async function removeMessageFromQueue(messageId: string): Promise<void> {
  await del(messageId, queueStore);
  console.log("消息已从队列移除:", messageId);
}

/**
 * 更新队列中的消息
 */
export async function updateQueuedMessage(messageId: string, updates: Partial<QueuedMessage>): Promise<void> {
  const message = await get<QueuedMessage>(messageId, queueStore);
  if (!message) return;

  const updatedMessage = { ...message, ...updates };
  await set(messageId, updatedMessage, queueStore);
}

/**
 * 获取队列中的所有消息
 */
export async function getAllQueuedMessages(): Promise<QueuedMessage[]> {
  const allKeys = await keys(queueStore);
  const messages: QueuedMessage[] = [];

  for (const key of allKeys) {
    const message = await get<QueuedMessage>(key as string, queueStore);
    if (message) {
      messages.push(message);
    }
  }

  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * 获取待处理的消息（已到重试时间且未超过最大重试次数）
 */
export async function getPendingMessages(): Promise<QueuedMessage[]> {
  const allMessages = await getAllQueuedMessages();
  const now = Date.now();

  return allMessages.filter(
    (msg) =>
      msg.status !== "sending" &&
      msg.nextRetryAt <= now &&
      msg.retryCount < RETRY_CONFIG.maxRetries
  );
}

/**
 * 标记消息为发送中
 */
export async function markMessageAsSending(messageId: string): Promise<void> {
  await updateQueuedMessage(messageId, { status: "sending" });
}

/**
 * 标记消息发送失败，增加重试计数
 */
export async function markMessageAsFailed(messageId: string): Promise<void> {
  const message = await get<QueuedMessage>(messageId, queueStore);
  if (!message) return;

  const newRetryCount = message.retryCount + 1;
  const nextRetryDelay = calculateBackoffDelay(newRetryCount);

  await updateQueuedMessage(messageId, {
    status: "failed",
    retryCount: newRetryCount,
    nextRetryAt: Date.now() + nextRetryDelay,
  });

  console.log(
    `消息 ${messageId} 发送失败，将在 ${nextRetryDelay / 1000}秒后重试（第 ${newRetryCount} 次）`
  );
}

/**
 * 清空整个队列
 */
export async function clearQueue(): Promise<void> {
  const allKeys = await keys(queueStore);
  for (const key of allKeys) {
    await del(key, queueStore);
  }
  console.log("消息队列已清空");
}

/**
 * 获取队列统计信息
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  sending: number;
  failed: number;
}> {
  const allMessages = await getAllQueuedMessages();

  return {
    total: allMessages.length,
    pending: allMessages.filter((m) => m.status === "pending").length,
    sending: allMessages.filter((m) => m.status === "sending").length,
    failed: allMessages.filter(
      (m) => m.status === "failed" && m.retryCount >= RETRY_CONFIG.maxRetries
    ).length,
  };
}
