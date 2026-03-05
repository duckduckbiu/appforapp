import { get, set, del, clear, createStore } from "idb-keyval";

/**
 * IndexedDB 持久化缓存工具模块
 * 用于在浏览器端持久化存储数据，实现页面刷新后秒开
 */

// 创建专用的 IndexedDB store
// 注意：每个 store 使用独立的数据库名称，避免 idb-keyval 的单 store 限制
const conversationsStore = createStore("bill-ai-conversations", "store");
const messagesStore = createStore("bill-ai-messages", "store");
const profilesStore = createStore("bill-ai-profiles", "store");
const friendsStore = createStore("bill-ai-friends", "store");
const feedStore = createStore("bill-ai-feed", "store");
const notificationsStore = createStore("bill-ai-notifications", "store");

// ==================== 会话列表缓存 ====================

/**
 * 缓存会话列表数据
 */
export async function cacheConversations(userId: string, conversations: any[]) {
  try {
    await set(`conversations-${userId}`, conversations, conversationsStore);
  } catch (error) {
    // 静默处理缓存错误，不影响用户体验
  }
}

/**
 * 获取缓存的会话列表
 */
export async function getCachedConversations(userId: string): Promise<any[] | null> {
  try {
    return await get(`conversations-${userId}`, conversationsStore);
  } catch (error) {
    // 静默处理缓存错误，不影响用户体验
    return null;
  }
}

/**
 * 清除会话列表缓存
 */
export async function clearConversationsCache(userId: string) {
  try {
    await del(`conversations-${userId}`, conversationsStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

// ==================== 消息历史缓存 ====================

/**
 * 缓存消息列表（按 conversationId 分片存储）
 */
export async function cacheMessages(conversationId: string, messages: any[]) {
  try {
    await set(`messages-${conversationId}`, messages, messagesStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

/**
 * 获取缓存的消息列表
 */
export async function getCachedMessages(conversationId: string): Promise<any[] | null> {
  try {
    return await get(`messages-${conversationId}`, messagesStore);
  } catch (error) {
    // 静默处理缓存错误
    return null;
  }
}

/**
 * 清除消息缓存
 */
export async function clearMessagesCache(conversationId: string) {
  try {
    await del(`messages-${conversationId}`, messagesStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

// ==================== 用户资料缓存 ====================

/**
 * 缓存用户资料数据
 */
export async function cacheProfile(userId: string, profile: any) {
  try {
    await set(`profile-${userId}`, profile, profilesStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

/**
 * 获取缓存的用户资料
 */
export async function getCachedProfile(userId: string): Promise<any | null> {
  try {
    return await get(`profile-${userId}`, profilesStore);
  } catch (error) {
    // 静默处理缓存错误
    return null;
  }
}

/**
 * 清除用户资料缓存
 */
export async function clearProfileCache(userId: string) {
  try {
    await del(`profile-${userId}`, profilesStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

// ==================== 好友列表缓存 ====================

/**
 * 缓存好友列表数据
 */
export async function cacheFriends(userId: string, friends: any[]) {
  try {
    await set(`friends-${userId}`, friends, friendsStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

/**
 * 获取缓存的好友列表
 */
export async function getCachedFriends(userId: string): Promise<any[] | null> {
  try {
    const cached = await get(`friends-${userId}`, friendsStore);
    return cached || null;
  } catch (error) {
    // 静默处理缓存错误，不影响用户体验
    return null;
  }
}

/**
 * 清除好友列表缓存
 */
export async function clearFriendsCache(userId: string) {
  try {
    await del(`friends-${userId}`, friendsStore);
  } catch (error) {
    console.error("清除好友列表缓存失败:", error);
  }
}

// ==================== Feed 帖子缓存 ====================

interface FeedCacheData {
  posts: any[];
  cachedAt: number;
}

const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存有效期

/**
 * 缓存 Feed 帖子数据
 * @param feedType - 'recommend' | 'following' | 'friends'
 */
export async function cacheFeedPosts(userId: string, feedType: string, posts: any[]) {
  try {
    const cacheData: FeedCacheData = {
      posts,
      cachedAt: Date.now(),
    };
    await set(`feed-${feedType}-${userId}`, cacheData, feedStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

/**
 * 获取缓存的 Feed 帖子
 * @returns 缓存数据，如果过期或不存在则返回 null
 */
export async function getCachedFeedPosts(userId: string, feedType: string): Promise<any[] | null> {
  try {
    const cached = await get(`feed-${feedType}-${userId}`, feedStore) as FeedCacheData | undefined;
    if (!cached) return null;
    
    // 检查缓存是否过期
    if (Date.now() - cached.cachedAt > FEED_CACHE_TTL) {
      // 过期但仍返回数据（stale-while-revalidate 模式）
      // 调用者决定是否使用过期数据
      return cached.posts;
    }
    
    return cached.posts;
  } catch (error) {
    return null;
  }
}

/**
 * 检查 Feed 缓存是否过期
 */
export async function isFeedCacheStale(userId: string, feedType: string): Promise<boolean> {
  try {
    const cached = await get(`feed-${feedType}-${userId}`, feedStore) as FeedCacheData | undefined;
    if (!cached) return true;
    return Date.now() - cached.cachedAt > FEED_CACHE_TTL;
  } catch (error) {
    return true;
  }
}

/**
 * 清除 Feed 缓存
 */
export async function clearFeedCache(userId: string, feedType?: string) {
  try {
    if (feedType) {
      await del(`feed-${feedType}-${userId}`, feedStore);
    } else {
      // 清除所有 feed 类型
      await del(`feed-recommend-${userId}`, feedStore);
      await del(`feed-following-${userId}`, feedStore);
      await del(`feed-friends-${userId}`, feedStore);
    }
  } catch (error) {
    // 静默处理缓存错误
  }
}

// ==================== 通知缓存 ====================

interface NotificationsCacheData {
  friendRequests: any[];
  socialNotifications: any[];
  cachedAt: number;
}

const NOTIFICATIONS_CACHE_TTL = 2 * 60 * 1000; // 2 分钟缓存有效期

/**
 * 缓存通知数据
 */
export async function cacheNotifications(
  userId: string,
  friendRequests: any[],
  socialNotifications: any[]
) {
  try {
    const cacheData: NotificationsCacheData = {
      friendRequests,
      socialNotifications,
      cachedAt: Date.now(),
    };
    await set(`notifications-${userId}`, cacheData, notificationsStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

/**
 * 获取缓存的通知数据
 */
export async function getCachedNotifications(
  userId: string
): Promise<{ friendRequests: any[]; socialNotifications: any[] } | null> {
  try {
    const cached = await get(`notifications-${userId}`, notificationsStore) as NotificationsCacheData | undefined;
    if (!cached) return null;
    return {
      friendRequests: cached.friendRequests,
      socialNotifications: cached.socialNotifications,
    };
  } catch (error) {
    return null;
  }
}

/**
 * 清除通知缓存
 */
export async function clearNotificationsCache(userId: string) {
  try {
    await del(`notifications-${userId}`, notificationsStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}

// ==================== 全局缓存管理 ====================

/**
 * 清除所有缓存数据
 */
export async function clearAllCache() {
  try {
    await clear(conversationsStore);
    await clear(messagesStore);
    await clear(profilesStore);
    await clear(friendsStore);
    await clear(feedStore);
    await clear(notificationsStore);
  } catch (error) {
    // 静默处理缓存错误
  }
}
