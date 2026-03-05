import { MessageSquare, Compass, Sparkles, LayoutGrid, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const tabs = [
  { title: "消息", url: "/conversations", icon: MessageSquare },
  { title: "动态", url: "/feed", icon: Compass },
  { title: "AI", url: "/ai", icon: Sparkles, isCenter: true },
  { title: "应用", url: "/store", icon: LayoutGrid },
  { title: "我的", url: "/me", icon: User },
];

function TabItem({
  tab,
  isMobile,
}: {
  tab: (typeof tabs)[number];
  isMobile: boolean;
}) {
  const Icon = tab.icon;

  return (
    <NavLink
      to={tab.url}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 transition-colors relative group",
          isMobile
            ? "flex-col justify-center py-1.5 px-2 text-[10px] min-w-0 flex-1"
            : "flex-col justify-center py-3 px-2 rounded-lg mx-1 text-xs",
          tab.isCenter && !isActive && "text-primary",
          isActive
            ? "text-primary font-medium"
            : !tab.isCenter
              ? "text-muted-foreground hover:text-foreground"
              : "hover:text-primary/80"
        )
      }
    >
      {({ isActive }) => (
        <>
          {tab.isCenter ? (
            <div
              className={cn(
                "flex items-center justify-center rounded-full transition-all",
                isMobile ? "h-10 w-10 -mt-3" : "h-10 w-10",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-primary/10 text-primary group-hover:bg-primary/20"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : (
            <Icon className={cn("shrink-0", isMobile ? "h-5 w-5" : "h-5 w-5")} />
          )}
          <span className={cn(tab.isCenter && isMobile && "mt-0.5")}>
            {tab.title}
          </span>
          {/* Active indicator for desktop sidebar */}
          {!isMobile && isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function AppNavigation() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-card/95 backdrop-blur border-t border-foreground/10 shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
        <div className="flex items-end justify-around h-14 px-1 pb-safe">
          {tabs.map((tab) => (
            <TabItem key={tab.url} tab={tab} isMobile />
          ))}
        </div>
      </nav>
    );
  }

  // Desktop: left sidebar
  return (
    <aside className="h-full w-16 bg-[hsl(var(--sidebar-background))] border-r border-sidebar-border flex flex-col z-[50] relative shrink-0">
      <nav className="flex-1 flex flex-col items-center pt-2 gap-1">
        {tabs.map((tab) => (
          <TabItem key={tab.url} tab={tab} isMobile={false} />
        ))}
      </nav>
    </aside>
  );
}
