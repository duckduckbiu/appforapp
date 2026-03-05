/**
 * 聊天系统共享类型定义
 */

// ============= 消息相关类型 =============

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  metadata?: Record<string, any> | null;
}

export interface QuotedMessage extends Message {
  senderName?: string;
  senderAvatar?: string | null;
}

export interface MessageMetadata {
  // 图片消息
  imageUrl?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;

  // 文件消息
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;

  // 语音消息
  audioUrl?: string;
  duration?: number;

  // 位置消息
  latitude?: number;
  longitude?: number;
  address?: string;

  // 回复消息
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;

  // 转发消息
  isForwarded?: boolean;
  forwardedFrom?: string;

  // 合并转发
  mergedMessages?: Message[];
}

// ============= 会话相关类型 =============

export interface Conversation {
  id: string;
  type: "private" | "group";
  created_at: string;
  updated_at: string;
}

export interface ConversationInfo {
  name: string;
  avatarUrl: string | null;
  type: string;
  friendId?: string | null;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  is_pinned: boolean | null;
  is_muted: boolean | null;
  is_hidden: boolean | null;
}

export interface ConversationListItem {
  id: string;
  type: string;
  display_name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  friend_id?: string;
  is_pinned?: boolean;
}

// ============= 用户相关类型 =============

export interface Profile {
  id: string;
  unique_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
  is_ai_avatar: boolean | null;
  ai_avatar_id: string | null;
  owner_id: string | null;
  privacy_settings?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  nickname: string | null;
  is_starred: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Friend {
  id: string;
  friend_id: string;
  nickname: string | null;
  is_starred?: boolean;
  friend?: Profile;
}

// ============= 群聊相关类型 =============

export interface GroupChat {
  id: string;
  conversation_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

// ============= 文件相关类型 =============

export interface FileUploadResult {
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface ImageUploadResult extends FileUploadResult {
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

// ============= 权限相关类型 =============

export interface AppPermission {
  id: string;
  user_id: string;
  app_id: string;
  app_name: string;
  permission_type: string;
  is_enabled: boolean;
  permission_mode: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

// ============= 通知相关类型 =============

export interface IslandNotification {
  appId: string;
  type: string;
  content: string;
  icon?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  priority?: number;
  duration?: number;
}

export interface NotificationAction {
  label: string;
  type: "navigate" | "callback" | "reply";
  value?: string;
  callback?: () => void;
}

// ============= 翻译和转写相关类型 =============

export interface TranslationResult {
  messageId: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranscriptionResult {
  messageId: string;
  audioUrl: string;
  transcribedText: string;
  language?: string;
}

// ============= Hook返回类型 =============

export interface UseMessageActionsResult {
  replyToMessage: QuotedMessage | null;
  translations: Map<string, string>;
  transcriptions: Map<string, string>;
  translatingId: string | null;
  transcribingId: string | null;
  isMultiSelectMode: boolean;
  selectedMessageIds: Set<string>;
  handleReplyToMessage: (message: Message) => void;
  cancelReply: () => void;
  handleTranslate: (messageId: string, content: string) => Promise<void>;
  handleTranscribe: (messageId: string, audioUrl: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;
  deleteMessageForAll: (messageId: string) => Promise<void>;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;
  toggleMessageSelection: (messageId: string) => void;
  selectAllMessages: (messageIds: string[]) => void;
  handleBatchDeleteForMe: () => Promise<void>;
  handleBatchDeleteForAll: () => Promise<void>;
}

export interface UseConversationInfoResult {
  conversationInfo: ConversationInfo | null;
  senderProfiles: Map<string, Profile>;
  isBlocked: boolean;
  isStarred: boolean;
  isMuted: boolean;
  isPinned: boolean;
  loadConversationInfo: () => Promise<void>;
  loadParticipantStatus: () => Promise<void>;
  loadSenderProfiles: (senderIds: string[]) => Promise<void>;
}

export interface UseChatOperationsResult {
  messages: Message[];
  isSending: boolean;
  markAsRead: () => Promise<void>;
  loadMessages: () => Promise<void>;
  sendMessage: (inputMessage: string) => Promise<void>;
  sendVoiceMessage: (file: File, duration: number) => Promise<void>;
  sendLocationMessage: (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => Promise<void>;
}
