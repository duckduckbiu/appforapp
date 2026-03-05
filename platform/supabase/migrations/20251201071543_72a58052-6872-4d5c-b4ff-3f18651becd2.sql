-- 删除数据库触发器和函数
-- 这些触发器直接将 AI 消息插入数据库，绕过了前端流程
-- 新的架构将通过前端 AI 客户端模拟真人操作

-- 删除触发器
DROP TRIGGER IF EXISTS on_message_insert_ai_chat ON public.messages;

-- 删除触发器函数
DROP FUNCTION IF EXISTS public.trigger_ai_auto_chat();