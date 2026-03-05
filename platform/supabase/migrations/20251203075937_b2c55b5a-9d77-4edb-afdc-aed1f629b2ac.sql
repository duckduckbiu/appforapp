-- 删除废弃的 AI 自动回复触发器和函数
DROP TRIGGER IF EXISTS on_message_insert_ai_chat ON public.messages;
DROP FUNCTION IF EXISTS public.trigger_ai_auto_chat();