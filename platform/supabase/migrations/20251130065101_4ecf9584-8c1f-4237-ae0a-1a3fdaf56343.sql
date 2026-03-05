-- 为 friend_requests 表添加 is_read 字段
ALTER TABLE public.friend_requests
ADD COLUMN is_read boolean DEFAULT false NOT NULL;

-- 为已存在的非 pending 状态的请求标记为已读
UPDATE public.friend_requests
SET is_read = true
WHERE status != 'pending';

-- 添加索引以提高查询性能
CREATE INDEX idx_friend_requests_receiver_unread 
ON public.friend_requests(receiver_id, is_read, status);

CREATE INDEX idx_friend_requests_sender_unread 
ON public.friend_requests(sender_id, is_read, status);