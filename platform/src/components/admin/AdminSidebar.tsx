import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  MessageSquare,
  Compass,
  Newspaper,
  LayoutGrid,
  Users,
  DollarSign,
  Settings,
  ChevronRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

// ── Navigation data ─────────────────────────────────────────

interface NavChild {
  label: string;
  path: string;
  comingSoon?: boolean;
}

interface NavSubGroup {
  label: string;
  icon?: LucideIcon;
  basePath: string;
  children: NavChild[];
}

interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  basePath: string;
  children: NavChild[];
  subGroups?: NavSubGroup[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "总览",
    icon: LayoutDashboard,
    basePath: "/admin/overview",
    children: [
      { label: "仪表盘", path: "/admin/overview" },
    ],
  },
  {
    id: "messages",
    label: "消息管理",
    icon: MessageSquare,
    basePath: "/admin/messages",
    children: [
      { label: "对话管理", path: "/admin/messages/conversations", comingSoon: true },
      { label: "群聊管理", path: "/admin/messages/groups", comingSoon: true },
    ],
  },
  {
    id: "content",
    label: "动态管理",
    icon: Compass,
    basePath: "/admin/content",
    children: [
      { label: "帖子管理", path: "/admin/content/posts", comingSoon: true },
      { label: "评论管理", path: "/admin/content/comments", comingSoon: true },
    ],
    subGroups: [
      {
        label: "新闻管理",
        icon: Newspaper,
        basePath: "/admin/content/discover",
        children: [
          { label: "新闻概览", path: "/admin/content/discover/dashboard" },
          { label: "文章管理", path: "/admin/content/discover/articles" },
          { label: "新闻源管理", path: "/admin/content/discover/sources" },
          { label: "分类管理", path: "/admin/content/discover/categories" },
          { label: "举报审核", path: "/admin/content/discover/reports" },
          { label: "互动管理", path: "/admin/content/discover/interactions" },
        ],
      },
    ],
  },
  {
    id: "apps",
    label: "应用管理",
    icon: LayoutGrid,
    basePath: "/admin/apps",
    children: [
      { label: "应用商店管理", path: "/admin/apps/store", comingSoon: true },
    ],
  },
  {
    id: "users",
    label: "用户管理",
    icon: Users,
    basePath: "/admin/users",
    children: [
      { label: "用户列表", path: "/admin/users/list", comingSoon: true },
      { label: "封禁管理", path: "/admin/users/bans" },
    ],
  },
  {
    id: "finance",
    label: "财务管理",
    icon: DollarSign,
    basePath: "/admin/finance",
    children: [
      { label: "收入概览", path: "/admin/finance/revenue", comingSoon: true },
    ],
  },
  {
    id: "system",
    label: "系统设置",
    icon: Settings,
    basePath: "/admin/system",
    children: [
      { label: "平台设置", path: "/admin/system/settings" },
      { label: "管理员账号", path: "/admin/system/admins", comingSoon: true },
    ],
  },
];

// ── Component ───────────────────────────────────────────────

interface AdminSidebarProps {
  onNavigate?: () => void; // for mobile: close Sheet after nav
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-expand sections and sub-groups matching current path
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_SECTIONS.forEach((s) => {
      init[s.id] = location.pathname.startsWith(s.basePath);
      // Also auto-expand sub-groups
      s.subGroups?.forEach((sg) => {
        const sgKey = `${s.id}:${sg.basePath}`;
        init[sgKey] = location.pathname.startsWith(sg.basePath);
      });
    });
    return init;
  });

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionActive = (basePath: string) =>
    location.pathname.startsWith(basePath);

  const isChildActive = (childPath: string, basePath: string) => {
    if (childPath === basePath) return location.pathname === childPath;
    return location.pathname.startsWith(childPath);
  };

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r">
      {/* Logo */}
      <div className="px-6 py-6">
        <div className="text-primary font-extrabold text-lg tracking-tight">
          Bill.ai
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-widest font-semibold">
          Admin Console
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1 pb-4">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = isSectionActive(section.basePath);
            const isOpen = expanded[section.id] ?? false;

            return (
              <Collapsible
                key={section.id}
                open={isOpen}
                onOpenChange={() => toggle(section.id)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                    onClick={() => {
                      if (!isOpen) {
                        const firstActive = section.children.find(
                          (c) => !c.comingSoon,
                        );
                        if (firstActive) handleNav(firstActive.path);
                        else if (section.subGroups?.[0]?.children[0]) {
                          handleNav(section.subGroups[0].children[0].path);
                        }
                      }
                    }}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "opacity-100" : "opacity-60",
                      )}
                    />
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 opacity-40 transition-transform duration-200",
                        isOpen && "rotate-90",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-0.5 ml-3 space-y-0.5">
                    {/* Direct children */}
                    {section.children.map((child) => {
                      const childActive = isChildActive(
                        child.path,
                        section.basePath,
                      );
                      return (
                        <button
                          key={child.path}
                          onClick={() => handleNav(child.path)}
                          className={cn(
                            "w-full text-left relative pl-8 pr-3 py-2 rounded-md text-[13px] transition-colors",
                            childActive
                              ? "text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {childActive && (
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary" />
                          )}
                          <span>{child.label}</span>
                          {child.comingSoon && (
                            <span className="ml-2 text-[10px] text-muted-foreground/50 font-medium">
                              待开发
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Sub-groups (nested collapsible) */}
                    {section.subGroups?.map((sg) => {
                      const sgKey = `${section.id}:${sg.basePath}`;
                      const sgActive = isSectionActive(sg.basePath);
                      const sgOpen = expanded[sgKey] ?? false;
                      const SgIcon = sg.icon;

                      return (
                        <Collapsible
                          key={sg.basePath}
                          open={sgOpen}
                          onOpenChange={() => toggle(sgKey)}
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              className={cn(
                                "w-full flex items-center gap-2 pl-5 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                                sgActive
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                              onClick={() => {
                                if (!sgOpen) {
                                  const first = sg.children.find((c) => !c.comingSoon);
                                  if (first) handleNav(first.path);
                                }
                              }}
                            >
                              {SgIcon && (
                                <SgIcon className={cn("h-3.5 w-3.5 shrink-0", sgActive ? "opacity-100" : "opacity-50")} />
                              )}
                              <span className="flex-1 text-left">{sg.label}</span>
                              <ChevronRight
                                className={cn(
                                  "h-3 w-3 opacity-40 transition-transform duration-200",
                                  sgOpen && "rotate-90",
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="mt-0.5 ml-3 space-y-0.5">
                              {sg.children.map((child) => {
                                const childActive = isChildActive(child.path, sg.basePath);
                                return (
                                  <button
                                    key={child.path}
                                    onClick={() => handleNav(child.path)}
                                    className={cn(
                                      "w-full text-left relative pl-8 pr-3 py-1.5 rounded-md text-[12px] transition-colors",
                                      childActive
                                        ? "text-primary font-semibold"
                                        : "text-muted-foreground hover:text-foreground",
                                    )}
                                  >
                                    {childActive && (
                                      <span className="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary" />
                                    )}
                                    <span>{child.label}</span>
                                    {child.comingSoon && (
                                      <span className="ml-2 text-[10px] text-muted-foreground/50 font-medium">
                                        待开发
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-4 border-t space-y-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => navigate("/me")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回平台
        </Button>
        <div className="flex items-center gap-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[11px] text-muted-foreground font-semibold tracking-wide">
            SYSTEM: ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}
