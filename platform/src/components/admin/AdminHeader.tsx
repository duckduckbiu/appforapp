import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Menu, ArrowLeft } from "lucide-react";
import { Fragment } from "react";

// ── Path segment → display label ────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  admin: "后台管理",
  overview: "总览",
  content: "动态管理",
  discover: "新闻管理",
  sources: "新闻源管理",
  categories: "分类管理",
  posts: "帖子管理",
  comments: "评论管理",
  users: "用户管理",
  list: "用户列表",
  bans: "封禁管理",
  system: "系统设置",
  settings: "平台设置",
  admins: "管理员账号",
  messages: "消息管理",
  conversations: "对话管理",
  groups: "群聊管理",
  apps: "应用管理",
  store: "应用商店",
  finance: "财务管理",
  revenue: "收入概览",
  articles: "文章管理",
  reports: "举报审核",
  interactions: "互动管理",
  dashboard: "新闻概览",
};

// ── Component ───────────────────────────────────────────────

interface AdminHeaderProps {
  onToggleSidebar?: () => void;
}

export function AdminHeader({ onToggleSidebar }: AdminHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Build breadcrumb from pathname
  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] || seg,
    path: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur-sm flex items-center gap-3 px-4 md:px-6 shrink-0">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8"
        onClick={onToggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.path}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage className="font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => navigate(crumb.path)}
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back to platform (desktop) */}
      <Button
        variant="ghost"
        size="sm"
        className="hidden md:flex gap-1.5 text-muted-foreground"
        onClick={() => navigate("/me")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回平台
      </Button>
    </header>
  );
}
