import {
  Home,
  Search,
  MessageSquare,
  User,
  Radio,
  Store,
  BookOpen,
  Code,
  BarChart3,
  Wrench,
  Settings,
  ChevronRight,
  ChevronLeft,
  Rss,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const menuItems = [
  { title: "首页", url: "/", icon: Home },
  { title: "社交", url: "/feed", icon: Rss },
  { title: "发现", url: "/discover", icon: Search },
  { title: "消息", url: "/conversations", icon: MessageSquare },
  { title: "个人中心", url: "/profile", icon: User },
  { title: "我的频道", url: "/my-channels", icon: Radio },
  { title: "应用商店", url: "/store", icon: Store },
  { title: "学习中心", url: "/learning", icon: BookOpen },
  { title: "开发者中心", url: "/developer", icon: Code },
  { title: "数据分析", url: "/analytics", icon: BarChart3 },
  { title: "推广中心", url: "/promoter", icon: TrendingUp },
  { title: "收益统计", url: "/earnings", icon: DollarSign },
  { title: "超级工具箱", url: "/toolbox", icon: Wrench },
  { title: "平台管理", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <aside 
      className={`h-full bg-[hsl(var(--sidebar-background))] border-r border-sidebar-border transition-all duration-300 flex flex-col z-[50] relative ${
        isCollapsed ? "w-14" : "w-60"
      }`}
    >
      <ScrollArea className="flex-1">
        <nav className="p-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mb-1"
              activeClassName="bg-primary/20 text-primary font-medium"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="text-sm">{item.title}</span>}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
      
      {/* Collapse toggle button */}
      <div className="mt-auto p-2 flex justify-center border-t border-sidebar-border/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
