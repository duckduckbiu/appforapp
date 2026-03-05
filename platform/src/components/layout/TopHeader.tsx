import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { SmartSearchBar } from "./SmartSearchBar";
import { UserMenu } from "./UserMenu";
import { useIdentity } from "@/contexts/IdentityContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function TopHeader() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { currentIdentity, isLoading } = useIdentity();
  const isMobile = useIsMobile();

  // 已登录 = 有身份或正在加载中
  const isAuthenticated = !!currentIdentity || isLoading;

  const canGoBack = window.history.length > 1;
  const canGoForward = window.history.state?.idx < window.history.length - 1;

  return (
    <header className="h-12 bg-[hsl(var(--header-background))] backdrop-blur shrink-0 z-[100] relative">
      <div className="flex items-center h-full px-3 gap-2 justify-between">
        {/* Left: Logo + Navigation (nav buttons hidden on mobile) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="text-lg font-bold hover:opacity-80 transition-opacity"
          >
            Bill.ai
          </button>

          {!isMobile && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                disabled={!canGoBack}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(1)}
                disabled={!canGoForward}
                className="h-7 w-7"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Center: Smart Search Bar */}
        <SmartSearchBar className="flex-1 min-w-0" />

        {/* Right: Theme Toggle (desktop only) + Auth */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-7 w-7"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}

          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/auth")}
            >
              登录
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
