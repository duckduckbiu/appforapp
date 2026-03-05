/**
 * 应用常量配置文件
 * 集中管理所有魔法数字和配置值
 */

// ============= 消息相关常量 =============

export const MESSAGE_CONSTANTS = {
  // 消息类型
  TYPE: {
    TEXT: "text",
    IMAGE: "image",
    VOICE: "voice",
    AUDIO: "audio",
    FILE: "file",
    LOCATION: "location",
  } as const,

  // 消息类型显示文本
  TYPE_DISPLAY: {
    image: "[图片]",
    voice: "[语音]",
    audio: "[语音]",
    file: "[文件]",
    location: "[位置]",
  } as const,

  // 时间戳显示间隔（分钟）
  TIMESTAMP_GAP_MINUTES: 5,

  // 消息分页配置
  PAGE_SIZE: 50,
  INITIAL_LOAD_COUNT: 30,
};

// ============= 文件上传相关常量 =============

export const FILE_CONSTANTS = {
  // 文件大小限制（字节）
  MAX_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_SIZE_MB: 20,

  // 图片压缩配置
  IMAGE_COMPRESSION: {
    MAX_WIDTH: 1200,
    MAX_HEIGHT: 1200,
    QUALITY: 0.8,
  },

  // 允许的文件类型
  ALLOWED_TYPES: {
    // 文档
    DOCUMENTS: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],

    // 压缩文件
    ARCHIVES: [
      "application/zip",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
    ],

    // 图片
    IMAGES: ["image/jpeg", "image/png", "image/gif", "image/webp"],

    // 音频
    AUDIO: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  },

  // 文件扩展名
  EXTENSIONS: {
    DOCUMENTS: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"],
    ARCHIVES: [".zip", ".rar", ".7z"],
    IMAGES: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    AUDIO: [".mp3", ".wav", ".ogg", ".webm"],
  },
};

// ============= 语音消息相关常量 =============

export const VOICE_CONSTANTS = {
  // 最大录音时长（秒）
  MAX_DURATION: 60,

  // 语音消息UI尺寸
  UI: {
    MIN_WIDTH: 150,
    MAX_WIDTH: 350,
    HEIGHT: 40,
  },
};

// ============= 会话相关常量 =============

export const CONVERSATION_CONSTANTS = {
  // 会话类型
  TYPE: {
    PRIVATE: "private",
    GROUP: "group",
  } as const,

  // 未读消息查询基准时间
  DEFAULT_LAST_READ: "1970-01-01",
};

// ============= UI相关常量 =============

export const UI_CONSTANTS = {
  // 头像尺寸
  AVATAR_SIZE: {
    SMALL: 32,
    MEDIUM: 48,
    LARGE: 64,
  },

  // 滚动阈值
  SCROLL_THRESHOLD: 100,

  // 动画延迟（毫秒）
  ANIMATION_DELAY: 300,

  // Toast持续时间（毫秒）
  TOAST_DURATION: 3000,

  // Dynamic Island通知持续时间（毫秒）
  ISLAND_NOTIFICATION_DURATION: 6000,
};

// ============= 存储桶名称 =============

export const STORAGE_BUCKETS = {
  AVATARS: "avatars",
  COVERS: "covers",
  MESSAGE_IMAGES: "message-images",
  MESSAGE_FILES: "message-files",
} as const;

// ============= API相关常量 =============

export const API_CONSTANTS = {
  // 超时时间（毫秒）
  TIMEOUT: 30000,

  // 重试次数
  MAX_RETRIES: 3,

  // Edge Function路径
  EDGE_FUNCTIONS: {
    TRANSLATE_MESSAGE: "translate-message",
    TRANSCRIBE_VOICE: "transcribe-voice",
  },
};

// ============= 权限相关常量 =============

export const PERMISSION_CONSTANTS = {
  MODES: {
    ALWAYS_ALLOW: "always_allow",
    ASK: "ask",
    NEVER_ALLOW: "never_allow",
  } as const,

  TYPES: {
    CAMERA: "camera",
    MICROPHONE: "microphone",
    LOCATION: "location",
    STORAGE: "storage",
    CLIPBOARD: "clipboard",
    NOTIFICATION: "notification",
  } as const,
};

// ============= 正则表达式 =============

export const REGEX_PATTERNS = {
  // 邮箱
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // 用户名（字母、数字、下划线，3-20个字符）
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,

  // URL
  URL: /^https?:\/\/.+/,

  // 纯表情消息（最多6个字符，只包含表情和空格）
  EMOJI_ONLY: /^[\p{Emoji}\s]{1,6}$/u,
};

// ============= 类型守卫辅助函数 =============

export const isMessageType = (type: string): type is keyof typeof MESSAGE_CONSTANTS.TYPE_DISPLAY => {
  return type in MESSAGE_CONSTANTS.TYPE_DISPLAY;
};
