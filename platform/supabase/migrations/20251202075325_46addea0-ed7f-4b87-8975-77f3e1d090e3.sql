-- 创建任务模板表
CREATE TABLE IF NOT EXISTS public.visual_agent_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('search', 'form', 'social', 'scraping', 'custom')),
  icon TEXT NOT NULL,
  instruction TEXT NOT NULL,
  target_url TEXT,
  parameters JSONB DEFAULT '[]'::jsonb,
  example_output JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_visual_agent_task_templates_category ON public.visual_agent_task_templates(category);
CREATE INDEX idx_visual_agent_task_templates_is_public ON public.visual_agent_task_templates(is_public);

-- 启用 RLS
ALTER TABLE public.visual_agent_task_templates ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可以查看公开模板
CREATE POLICY "Anyone can view public templates"
  ON public.visual_agent_task_templates
  FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

-- RLS 策略：用户可以创建自己的模板
CREATE POLICY "Users can create their own templates"
  ON public.visual_agent_task_templates
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- RLS 策略：用户可以更新自己的模板
CREATE POLICY "Users can update their own templates"
  ON public.visual_agent_task_templates
  FOR UPDATE
  USING (created_by = auth.uid());

-- RLS 策略：用户可以删除自己的模板
CREATE POLICY "Users can delete their own templates"
  ON public.visual_agent_task_templates
  FOR DELETE
  USING (created_by = auth.uid());

-- 插入预定义模板
INSERT INTO public.visual_agent_task_templates (name, description, category, icon, instruction, target_url, parameters, example_output) VALUES
('Google 搜索', '在 Google 上搜索关键词并提取前 10 条结果', 'search', '🔍', '在 Google 搜索 "{query}"，提取前 10 条搜索结果的标题、链接和摘要', 'https://www.google.com', 
  '[{"name": "query", "label": "搜索关键词", "type": "text", "required": true, "placeholder": "输入要搜索的内容"}]'::jsonb,
  '{"results": [{"title": "示例标题", "url": "https://example.com", "snippet": "摘要内容"}]}'::jsonb),

('淘宝价格比较', '搜索商品并比较不同店铺的价格', 'search', '🛒', '在淘宝搜索 "{product}"，提取前 10 个商品的名称、价格、销量和店铺信息', 'https://www.taobao.com',
  '[{"name": "product", "label": "商品名称", "type": "text", "required": true, "placeholder": "输入商品名称"}]'::jsonb,
  '{"products": [{"name": "示例商品", "price": "99.00", "sales": "1000+", "shop": "示例店铺"}]}'::jsonb),

('表单自动填写', '自动填写网页表单并提交', 'form', '📝', '打开 {url}，填写表单：姓名={name}，邮箱={email}，电话={phone}，然后提交', null,
  '[{"name": "url", "label": "表单URL", "type": "url", "required": true, "placeholder": "https://example.com/form"}, {"name": "name", "label": "姓名", "type": "text", "required": true}, {"name": "email", "label": "邮箱", "type": "text", "required": true}, {"name": "phone", "label": "电话", "type": "text", "required": false}]'::jsonb,
  '{"status": "success", "submitted_at": "2025-01-01T00:00:00Z"}'::jsonb),

('新闻采集', '从新闻网站采集最新文章', 'scraping', '📰', '访问 {news_site}，提取首页最新的 {count} 篇文章的标题、摘要、发布时间和链接', null,
  '[{"name": "news_site", "label": "新闻网站", "type": "url", "required": true, "placeholder": "https://news.example.com"}, {"name": "count", "label": "文章数量", "type": "number", "required": true, "placeholder": "10"}]'::jsonb,
  '{"articles": [{"title": "示例标题", "summary": "摘要", "published_at": "2025-01-01", "url": "https://..."}]}'::jsonb),

('社交媒体发帖', '在社交平台发布内容', 'social', '💬', '登录 {platform}，发布内容：{content}，并添加图片（如果提供）', null,
  '[{"name": "platform", "label": "平台", "type": "text", "required": true, "placeholder": "Twitter/微博/小红书"}, {"name": "content", "label": "发布内容", "type": "text", "required": true, "placeholder": "输入要发布的文字"}, {"name": "image_url", "label": "图片URL（可选）", "type": "url", "required": false}]'::jsonb,
  '{"status": "published", "post_url": "https://platform.com/post/123", "published_at": "2025-01-01T00:00:00Z"}'::jsonb);

-- 创建更新时间触发器
CREATE TRIGGER update_visual_agent_task_templates_updated_at
  BEFORE UPDATE ON public.visual_agent_task_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();