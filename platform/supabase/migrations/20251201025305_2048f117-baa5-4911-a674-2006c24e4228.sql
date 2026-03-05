-- 启用核心表的 Realtime 同步

-- 1. messages 表 - 消息实时同步
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 2. conversations 表 - 会话列表实时更新
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- 3. conversation_participants 表 - 参与者状态实时同步
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;

-- 4. last_message_cache 表 - 最新消息缓存实时更新
ALTER TABLE public.last_message_cache REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.last_message_cache;