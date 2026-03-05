import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  is_deleted: boolean;
  updated_at: string;
  metadata: any;
}

interface QuotedMessage extends Message {
  senderName: string;
  senderAvatar: string | null;
}

interface UseMessageActionsProps {
  currentIdentity: any;
  conversationInfo: any;
  senderProfiles: Map<string, { avatar_url: string | null; display_name: string | null }>;
  onMessagesUpdate: () => void;
}

export function useMessageActions({
  currentIdentity,
  conversationInfo,
  senderProfiles,
  onMessagesUpdate,
}: UseMessageActionsProps) {
  const [replyToMessage, setReplyToMessage] = useState<QuotedMessage | null>(null);
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [transcriptions, setTranscriptions] = useState<Map<string, string>>(new Map());
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  // 多选模式状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // 回复消息
  const handleReplyToMessage = (message: Message) => {
    const senderInfo = senderProfiles.get(message.sender_id);
    const isOwn = message.sender_id === currentIdentity?.profile.id;
    
    let senderName = isOwn ? "我" : "TA";
    if (!isOwn && conversationInfo?.type === "private" && conversationInfo.friendId === message.sender_id) {
      senderName = conversationInfo.name;
    } else if (!isOwn) {
      senderName = senderInfo?.display_name || "TA";
    }

    setReplyToMessage({
      ...message,
      senderName,
      senderAvatar: senderInfo?.avatar_url || null,
    });
  };

  // 翻译消息
  const handleTranslate = async (messageId: string, content: string) => {
    // 如果已有翻译，切换显示/隐藏
    if (translations.has(messageId)) {
      const newMap = new Map(translations);
      newMap.delete(messageId);
      setTranslations(newMap);
      return;
    }

    setTranslatingId(messageId);
    try {
      // 简单检测：如果包含中文则翻译成英文，否则翻译成中文
      const hasChinese = /[\u4e00-\u9fa5]/.test(content);
      const targetLang = hasChinese ? 'en' : 'zh';

      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: { text: content, targetLang }
      });

      if (error) {
        console.error('Translation error:', error);
        throw error;
      }

      if (!data?.translatedText) {
        throw new Error('No translation returned');
      }

      setTranslations(prev => new Map(prev).set(messageId, data.translatedText));
      toast.success("翻译成功");
    } catch (error) {
      console.error('Translation error:', error);
      toast.error("翻译失败，请稍后重试");
    } finally {
      setTranslatingId(null);
    }
  };

  // 语音转文字
  const handleTranscribe = async (messageId: string, audioUrl: string) => {
    // 如果已有转写，切换显示/隐藏
    if (transcriptions.has(messageId)) {
      const newMap = new Map(transcriptions);
      newMap.delete(messageId);
      setTranscriptions(newMap);
      return;
    }

    setTranscribingId(messageId);
    try {
      // 检查浏览器是否支持 Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast.error("您的浏览器不支持语音识别", {
          description: "请使用 Chrome、Edge 或 Safari 浏览器"
        });
        setTranscribingId(null);
        return;
      }

      // 获取平台配置
      const { data: configData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('category', 'transcription')
        .eq('key', 'config')
        .single();

      const config = configData?.value as { provider?: string } | null;
      const provider = config?.provider || 'browser_speech_api';

      if (provider === 'browser_speech_api') {
        // 使用浏览器 Web Speech API
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setTranscriptions(prev => new Map(prev).set(messageId, transcript));
          toast.success("语音转文字成功");
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          toast.error("语音识别失败", {
            description: "请检查麦克风权限或尝试其他方式"
          });
        };

        recognition.onend = () => {
          setTranscribingId(null);
        };

        // 浏览器 API 无法直接识别音频文件，需要通过麦克风实时识别
        toast.info("浏览器语音识别需要您重新说一遍", {
          description: "点击确认后请对着麦克风重复语音内容"
        });
        
        recognition.start();
      } else {
        // 使用其他服务（如 OpenAI Whisper）
        const base64Audio = await new Promise<string>((resolve, reject) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('请求超时，请稍后重试'));
          }, 30000);

          fetch(audioUrl, { signal: controller.signal })
            .then(response => {
              if (!response.ok) {
                throw new Error('获取音频文件失败');
              }
              return response.blob();
            })
            .then(blob => {
              const reader = new FileReader();
              
              reader.onloadend = () => {
                clearTimeout(timeout);
                const result = reader.result?.toString().split(',')[1];
                if (result) {
                  resolve(result);
                } else {
                  reject(new Error('音频转换失败'));
                }
              };
              
              reader.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('音频读取失败'));
              };
              
              reader.readAsDataURL(blob);
            })
            .catch(error => {
              clearTimeout(timeout);
              reject(error);
            });
        });

        // 调用转写服务
        const { data, error } = await supabase.functions.invoke('transcribe-voice', {
          body: { audio: base64Audio, provider }
        });

        if (error) {
          console.error('Transcription error:', error);
          throw new Error(error.message || '转写服务调用失败');
        }

        if (!data?.text) {
          throw new Error('未返回转写结果');
        }

        setTranscriptions(prev => new Map(prev).set(messageId, data.text));
        toast.success("语音转文字成功");
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error("语音转文字失败", {
        description: error.message || "请检查API配置或稍后重试"
      });
    } finally {
      setTranscribingId(null);
    }
  };

  // 删除消息（仅本地）
  const deleteMessageForMe = async (messageId: string) => {
    if (!currentIdentity) return;
    
    try {
      // 使用 upsert 避免重复删除时的唯一约束冲突
      const { error } = await supabase
        .from("message_deletions")
        .upsert(
          {
            message_id: messageId,
            user_id: currentIdentity.profile.id
          },
          { onConflict: "message_id,user_id" }
        );

      if (error) throw error;
      
      toast.success("消息已删除");
      onMessagesUpdate();
    } catch (error: any) {
      console.error("删除消息失败:", error);
      toast.error("删除失败");
    }
  };

  // 删除消息（双向）
  const deleteMessageForAll = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_deleted: true })
        .eq("id", messageId);

      if (error) throw error;
      
      toast.success("消息已双向删除");
      onMessagesUpdate();
    } catch (error: any) {
      console.error("双向删除消息失败:", error);
      toast.error("双向删除失败");
    }
  };

  // 多选模式控制
  const enterMultiSelectMode = () => {
    setIsMultiSelectMode(true);
    setSelectedMessageIds(new Set());
  };

  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false);
    setSelectedMessageIds(new Set());
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const selectAllMessages = (messageIds: string[]) => {
    setSelectedMessageIds(new Set(messageIds));
  };

  // 批量删除
  const handleBatchDeleteForMe = async () => {
    if (selectedMessageIds.size === 0) return;

    try {
      const messageIdsArray = Array.from(selectedMessageIds);
      
      for (const messageId of messageIdsArray) {
        await deleteMessageForMe(messageId);
      }

      toast.success(`已删除 ${messageIdsArray.length} 条消息`);
      exitMultiSelectMode();
    } catch (error) {
      console.error("批量删除失败:", error);
      toast.error("批量删除失败");
    }
  };

  const handleBatchDeleteForAll = async () => {
    if (selectedMessageIds.size === 0) return;

    try {
      const messageIdsArray = Array.from(selectedMessageIds);
      
      for (const messageId of messageIdsArray) {
        await deleteMessageForAll(messageId);
      }

      toast.success(`已双向删除 ${messageIdsArray.length} 条消息`);
      exitMultiSelectMode();
    } catch (error) {
      console.error("批量双向删除失败:", error);
      toast.error("批量双向删除失败");
    }
  };

  return {
    // 状态
    replyToMessage,
    translations,
    transcriptions,
    translatingId,
    transcribingId,
    isMultiSelectMode,
    selectedMessageIds,
    
    // 操作方法
    setReplyToMessage,
    handleReplyToMessage,
    handleTranslate,
    handleTranscribe,
    deleteMessageForMe,
    deleteMessageForAll,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleMessageSelection,
    selectAllMessages,
    handleBatchDeleteForMe,
    handleBatchDeleteForAll,
  };
}
