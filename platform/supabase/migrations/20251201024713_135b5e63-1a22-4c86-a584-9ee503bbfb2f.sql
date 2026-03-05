-- 启用 pg_net 扩展用于 HTTP 请求
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 创建触发器函数：当新消息插入时触发 AI 自动回复
CREATE OR REPLACE FUNCTION public.trigger_ai_auto_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 只处理文本消息
  IF NEW.message_type != 'text' THEN
    RETURN NEW;
  END IF;
  
  -- 异步调用 ai-auto-chat Edge Function
  -- 使用 pg_net 发起异步 HTTP 请求
  PERFORM net.http_post(
    url := 'https://hebppbhzdylqiyfpolyb.supabase.co/functions/v1/ai-auto-chat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYnBwYmh6ZHlscWl5ZnBvbHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0Mzc4NDIsImV4cCI6MjA4MDAxMzg0Mn0.JWbQWldkP3cSSVCrfFvaA4Bn0_ou0m_TpJJFblbAEqU'
    ),
    body := jsonb_build_object(
      'messageId', NEW.id::text,
      'conversationId', NEW.conversation_id::text
    )
  );
  
  RETURN NEW;
END;
$$;

-- 创建触发器：在消息插入后触发
CREATE TRIGGER on_message_insert_ai_chat
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ai_auto_chat();