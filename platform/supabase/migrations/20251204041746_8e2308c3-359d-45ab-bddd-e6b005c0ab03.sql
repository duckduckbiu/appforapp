-- =====================================================
-- 阶段 C：发帖/信息流系统 数据库设计
-- =====================================================

-- 1. 关注关系表
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- 2. 帖子主表
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'friends', 'private')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  collections_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. 帖子媒体表（图片/视频）
CREATE TABLE public.post_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- 视频时长（秒）
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. 点赞表
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  amount INTEGER NOT NULL DEFAULT 0, -- 付费点赞金额
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 5. 评论表
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE, -- 回复的评论
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. 收藏表
CREATE TABLE public.post_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 7. 转发表
CREATE TABLE public.post_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  shared_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. 钱包表
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0, -- 余额（最小单位：积分）
  total_earned INTEGER NOT NULL DEFAULT 0, -- 累计收入
  total_spent INTEGER NOT NULL DEFAULT 0, -- 累计支出
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. 交易记录表
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('recharge', 'withdraw', 'like_sent', 'like_received', 'tip_sent', 'tip_received')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  related_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_posts_visibility ON public.posts(visibility) WHERE is_deleted = false;
CREATE INDEX idx_post_media_post ON public.post_media(post_id);
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_id);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX idx_post_collections_user ON public.post_collections(user_id);
CREATE INDEX idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);

-- =====================================================
-- RLS 策略
-- =====================================================

-- follows 表
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看所有关注关系"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "用户可以关注他人"
  ON public.follows FOR INSERT
  WITH CHECK (is_owned_identity(follower_id));

CREATE POLICY "用户可以取消关注"
  ON public.follows FOR DELETE
  USING (is_owned_identity(follower_id));

-- posts 表
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看公开帖子"
  ON public.posts FOR SELECT
  USING (
    is_deleted = false AND (
      visibility = 'public' OR
      is_owned_identity(author_id) OR
      (visibility = 'followers' AND EXISTS (
        SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = posts.author_id
      )) OR
      (visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendships WHERE user_id = auth.uid() AND friend_id = posts.author_id
      ))
    )
  );

CREATE POLICY "用户可以发布帖子"
  ON public.posts FOR INSERT
  WITH CHECK (is_owned_identity(author_id));

CREATE POLICY "用户可以更新自己的帖子"
  ON public.posts FOR UPDATE
  USING (is_owned_identity(author_id));

CREATE POLICY "用户可以删除自己的帖子"
  ON public.posts FOR DELETE
  USING (is_owned_identity(author_id));

-- post_media 表
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看帖子媒体"
  ON public.post_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_media.post_id
  ));

CREATE POLICY "用户可以添加帖子媒体"
  ON public.post_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_media.post_id AND is_owned_identity(posts.author_id)
  ));

CREATE POLICY "用户可以删除帖子媒体"
  ON public.post_media FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_media.post_id AND is_owned_identity(posts.author_id)
  ));

-- post_likes 表
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看点赞"
  ON public.post_likes FOR SELECT
  USING (true);

CREATE POLICY "用户可以点赞"
  ON public.post_likes FOR INSERT
  WITH CHECK (is_owned_identity(user_id));

CREATE POLICY "用户可以取消点赞"
  ON public.post_likes FOR DELETE
  USING (is_owned_identity(user_id));

-- post_comments 表
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看评论"
  ON public.post_comments FOR SELECT
  USING (is_deleted = false);

CREATE POLICY "用户可以发表评论"
  ON public.post_comments FOR INSERT
  WITH CHECK (is_owned_identity(author_id));

CREATE POLICY "用户可以更新自己的评论"
  ON public.post_comments FOR UPDATE
  USING (is_owned_identity(author_id));

CREATE POLICY "用户可以删除自己的评论"
  ON public.post_comments FOR DELETE
  USING (is_owned_identity(author_id));

-- post_collections 表
ALTER TABLE public.post_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的收藏"
  ON public.post_collections FOR SELECT
  USING (is_owned_identity(user_id));

CREATE POLICY "用户可以收藏帖子"
  ON public.post_collections FOR INSERT
  WITH CHECK (is_owned_identity(user_id));

CREATE POLICY "用户可以取消收藏"
  ON public.post_collections FOR DELETE
  USING (is_owned_identity(user_id));

-- post_shares 表
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看转发"
  ON public.post_shares FOR SELECT
  USING (true);

CREATE POLICY "用户可以转发"
  ON public.post_shares FOR INSERT
  WITH CHECK (is_owned_identity(user_id));

-- wallets 表
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的钱包"
  ON public.wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "系统可以创建钱包"
  ON public.wallets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "系统可以更新钱包"
  ON public.wallets FOR UPDATE
  USING (user_id = auth.uid());

-- transactions 表
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的交易记录"
  ON public.transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM wallets WHERE wallets.id = transactions.wallet_id AND wallets.user_id = auth.uid()
  ));

CREATE POLICY "系统可以创建交易记录"
  ON public.transactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM wallets WHERE wallets.id = transactions.wallet_id AND wallets.user_id = auth.uid()
  ));

-- =====================================================
-- 触发器：更新帖子计数
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_post_like_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_post_comment_change
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

CREATE OR REPLACE FUNCTION public.update_post_collections_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET collections_count = collections_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET collections_count = collections_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_post_collection_change
  AFTER INSERT OR DELETE ON public.post_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_post_collections_count();

-- =====================================================
-- 存储桶：帖子媒体
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- 帖子媒体存储策略
CREATE POLICY "帖子媒体公开可读"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

CREATE POLICY "用户可以上传帖子媒体"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "用户可以删除自己的帖子媒体"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);