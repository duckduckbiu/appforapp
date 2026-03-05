import { Camera, Mic, Image as ImageIcon, MapPin, Sparkles, Bluetooth, HardDrive, Users, ClipboardList, Wallet, Bell, RefreshCw, Activity, Download, MessageSquare, Send, Zap, Bot, FileText, Hash, Settings, File, ImagePlus } from "lucide-react";

export type PermissionMode = 
  | 'always_allow'      // 总是允许
  | 'allow_while_using' // 使用时允许
  | 'allow_once'        // 允许一次
  | 'ask_every_time'    // 每次询问
  | 'never_allow';      // 不允许

export interface Permission {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  description: string;
  unsupported?: boolean;
  unsupportedReason?: string;
  supportedModes: PermissionMode[];
  defaultMode: PermissionMode;
}

export interface App {
  id: string;
  name: string;
  icon: React.ReactNode;
  permissions: string[];
}

export const allPermissions: Permission[] = [
  // 硬件权限 - 高敏感，支持全部模式
  { 
    id: 'camera', 
    name: '相机', 
    icon: <Camera className="h-5 w-5" />, 
    category: '硬件权限', 
    description: '允许应用使用相机拍照或录像',
    supportedModes: ['always_allow', 'allow_while_using', 'allow_once', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'microphone', 
    name: '麦克风', 
    icon: <Mic className="h-5 w-5" />, 
    category: '硬件权限', 
    description: '允许应用录制音频',
    supportedModes: ['always_allow', 'allow_while_using', 'allow_once', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'file_access', 
    name: '文件访问', 
    icon: <File className="h-5 w-5" />, 
    category: '硬件权限', 
    description: '允许应用访问设备本地文件系统',
    supportedModes: ['always_allow', 'allow_once', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'location', 
    name: '位置信息', 
    icon: <MapPin className="h-5 w-5" />, 
    category: '硬件权限', 
    description: '允许应用获取设备位置信息',
    supportedModes: ['always_allow', 'allow_while_using', 'allow_once', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'biometric', 
    name: '生物识别', 
    icon: <Sparkles className="h-5 w-5" />, 
    category: '硬件权限', 
    description: '允许应用使用指纹/面部识别', 
    unsupported: true, 
    unsupportedReason: '移动端功能',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'never_allow'
  },
  { 
    id: 'bluetooth', 
    name: '蓝牙', 
    icon: <Bluetooth className="h-5 w-5" />, 
    category: '硬件权限', 
    description: '允许应用使用蓝牙功能', 
    unsupported: true, 
    unsupportedReason: '暂不支持',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'never_allow'
  },
  
  // 数据权限
  { 
    id: 'storage', 
    name: '存储空间', 
    icon: <HardDrive className="h-5 w-5" />, 
    category: '数据权限', 
    description: '允许应用读写本地存储',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'always_allow'
  },
  { 
    id: 'platform_gallery', 
    name: '平台相册', 
    icon: <ImagePlus className="h-5 w-5" />, 
    category: '数据权限', 
    description: '允许应用访问用户上传到平台的相册内容',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'contacts', 
    name: '通讯录', 
    icon: <Users className="h-5 w-5" />, 
    category: '数据权限', 
    description: '允许应用访问通讯录',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'clipboard', 
    name: '剪贴板', 
    icon: <ClipboardList className="h-5 w-5" />, 
    category: '数据权限', 
    description: '允许应用访问剪贴板内容',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'wallet_access', 
    name: '钱包访问', 
    icon: <Wallet className="h-5 w-5" />, 
    category: '数据权限', 
    description: '允许应用访问钱包/支付信息',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  
  // 通知权限 - 仅开/关
  { 
    id: 'island_notification', 
    name: '灵动岛通知', 
    icon: <Bell className="h-5 w-5" />, 
    category: '通知权限', 
    description: '允许应用发送灵动岛通知',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'never_allow'
  },
  { 
    id: 'notification', 
    name: '系统通知', 
    icon: <Bell className="h-5 w-5" />, 
    category: '通知权限', 
    description: '允许应用发送普通系统通知',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'never_allow'
  },
  
  // 运行时权限
  { 
    id: 'background_refresh', 
    name: '后台刷新', 
    icon: <RefreshCw className="h-5 w-5" />, 
    category: '运行时权限', 
    description: '允许应用在后台刷新数据',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'always_allow'
  },
  { 
    id: 'background_activity', 
    name: '后台活动', 
    icon: <Activity className="h-5 w-5" />, 
    category: '运行时权限', 
    description: '允许应用在后台持续运行', 
    unsupported: true, 
    unsupportedReason: '移动端功能',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'never_allow'
  },
  { 
    id: 'background_download', 
    name: '后台下载', 
    icon: <Download className="h-5 w-5" />, 
    category: '运行时权限', 
    description: '允许应用在后台下载文件', 
    unsupported: true, 
    unsupportedReason: '暂不支持',
    supportedModes: ['always_allow', 'never_allow'],
    defaultMode: 'never_allow'
  },
  
  // AI 特定权限 - 需要精细控制
  { 
    id: 'auto_reply', 
    name: '自动回复', 
    icon: <MessageSquare className="h-5 w-5" />, 
    category: 'AI 权限', 
    description: '允许 AI 自动回复消息',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'auto_post', 
    name: '自动发帖', 
    icon: <Send className="h-5 w-5" />, 
    category: 'AI 权限', 
    description: '允许 AI 自动发布内容',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
  { 
    id: 'auto_interact', 
    name: '自动互动', 
    icon: <Zap className="h-5 w-5" />, 
    category: 'AI 权限', 
    description: '允许 AI 自动点赞/评论/转发',
    supportedModes: ['always_allow', 'ask_every_time', 'never_allow'],
    defaultMode: 'ask_every_time'
  },
];

export const allApps: App[] = [
  { 
    id: 'chat', 
    name: '聊天', 
    icon: <MessageSquare className="h-5 w-5" />, 
    permissions: ['camera', 'microphone', 'file_access', 'storage', 'contacts', 'clipboard', 'island_notification', 'notification', 'background_refresh'] 
  },
  { 
    id: 'payment', 
    name: '支付', 
    icon: <Wallet className="h-5 w-5" />, 
    permissions: ['biometric', 'island_notification', 'notification', 'wallet_access'] 
  },
  { 
    id: 'ai_avatar', 
    name: 'AI分身', 
    icon: <Bot className="h-5 w-5" />, 
    permissions: ['auto_reply', 'auto_post', 'auto_interact', 'platform_gallery', 'island_notification', 'notification', 'background_refresh', 'background_activity'] 
  },
  { 
    id: 'content', 
    name: '内容社区', 
    icon: <FileText className="h-5 w-5" />, 
    permissions: ['camera', 'file_access', 'platform_gallery', 'storage', 'location', 'island_notification', 'notification'] 
  },
  { 
    id: 'channel', 
    name: '频道', 
    icon: <Hash className="h-5 w-5" />, 
    permissions: ['island_notification', 'notification', 'background_refresh'] 
  },
  { 
    id: 'system', 
    name: '系统', 
    icon: <Settings className="h-5 w-5" />, 
    permissions: ['notification', 'background_refresh', 'background_activity'] 
  },
];
