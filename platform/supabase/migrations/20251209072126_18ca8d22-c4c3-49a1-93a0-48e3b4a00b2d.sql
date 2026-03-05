-- 修复函数 search_path 安全问题
ALTER FUNCTION update_reports_updated_at() SET search_path = public;