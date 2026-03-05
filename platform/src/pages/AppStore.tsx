import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store, Package, Download, MoreVertical, Flag,
  Gamepad2, Wrench, Users, Star, Code, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApps, useInstalledApps, useInstallApp, useUninstallApp, type App } from "@/hooks/useApps";
import { useIdentity } from "@/contexts/IdentityContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ReportDialog } from "@/components/ReportDialog";

// ─── Category helpers ─────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<App["app_category"], string> = {
  general:  "综合",
  game:     "游戏",
  social:   "社交",
  tool:     "工具",
  adult:    "成人",
  gambling: "博弈",
  finance:  "金融",
};

const CATEGORY_COLOR: Record<App["app_category"], string> = {
  general:  "bg-muted text-muted-foreground",
  game:     "bg-blue-500/10 text-blue-500",
  social:   "bg-green-500/10 text-green-500",
  tool:     "bg-orange-500/10 text-orange-500",
  adult:    "bg-pink-500/10 text-pink-500",
  gambling: "bg-yellow-500/10 text-yellow-600",
  finance:  "bg-purple-500/10 text-purple-500",
};

// ─── Tab definitions ──────────────────────────────────────────────────────

type TabId = "featured" | "game" | "tool" | "social" | "dev" | "all";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  filter: (apps: App[]) => App[];
  emptyText: string;
}

const TABS: TabDef[] = [
  {
    id: "featured",
    label: "推荐",
    icon: <Star className="h-3.5 w-3.5" />,
    filter: (apps) => apps.filter((a) => a.is_featured || a.is_official),
    emptyText: "暂无推荐应用",
  },
  {
    id: "game",
    label: "游戏",
    icon: <Gamepad2 className="h-3.5 w-3.5" />,
    filter: (apps) => apps.filter((a) => a.app_category === "game" || a.app_category === "gambling"),
    emptyText: "暂无游戏应用",
  },
  {
    id: "tool",
    label: "工具",
    icon: <Wrench className="h-3.5 w-3.5" />,
    filter: (apps) => apps.filter((a) => a.app_category === "tool" || a.app_category === "general"),
    emptyText: "暂无工具应用",
  },
  {
    id: "social",
    label: "社交",
    icon: <Users className="h-3.5 w-3.5" />,
    filter: (apps) => apps.filter((a) => a.app_category === "social"),
    emptyText: "暂无社交应用",
  },
  {
    id: "dev",
    label: "开发者",
    icon: <Code className="h-3.5 w-3.5" />,
    filter: (apps) => apps.filter((a) => !a.is_official && !!a.developer_id),
    emptyText: "暂无开发者上传的应用",
  },
  {
    id: "all",
    label: "全部",
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
    filter: (apps) => apps,
    emptyText: "暂无可用应用",
  },
];

// ─── App Card ─────────────────────────────────────────────────────────────

function AppCard({ app, isInstalled }: { app: App; isInstalled: boolean }) {
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const isLoggedIn = !!currentIdentity?.profile?.id;
  const [reportOpen, setReportOpen] = useState(false);

  const installMutation = useInstallApp();
  const uninstallMutation = useUninstallApp();
  const isLoading = installMutation.isPending || uninstallMutation.isPending;

  const handleInstall = () => {
    if (!isLoggedIn) { navigate("/auth"); return; }
    installMutation.mutate(app.id);
  };

  const handleOpen = () => navigate(`/app/${app.slug}`);
  const handleUninstall = () => uninstallMutation.mutate(app.id);

  const catClass = CATEGORY_COLOR[app.app_category] ?? CATEGORY_COLOR.general;
  const catLabel = CATEGORY_LABEL[app.app_category] ?? app.app_category;
  const isAdultContent = app.age_rating !== "all" && app.age_rating !== "";

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Icon + Menu */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {app.icon_url ? (
                <img src={app.icon_url} alt={app.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-7 w-7 text-primary" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm leading-tight truncate">{app.name}</h3>
                {app.is_official && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                    官方
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${catClass}`}>
                  {catLabel}
                </span>
                {isAdultContent && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">
                    {app.age_rating}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                v{app.version} · {app.is_free ? "免费" : `${app.price_credits} 积分`} · {app.install_count.toLocaleString()} 次安装
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mr-1 -mt-1">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setReportOpen(true)}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  举报此应用
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          {app.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{app.description}</p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isInstalled ? (
              <>
                <Button size="sm" className="flex-1" onClick={handleOpen}>打开</Button>
                <Button size="sm" variant="outline" onClick={handleUninstall} disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" /> : "卸载"}
                </Button>
              </>
            ) : (
              <Button size="sm" className="w-full" onClick={handleInstall} disabled={isLoading}>
                {isLoading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                安装
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="app"
        targetId={app.id}
      />
    </>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────

function AppCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Skeleton className="w-14 h-14 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-8 w-full mb-3" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

// ─── App Grid ─────────────────────────────────────────────────────────────

function AppGrid({ apps, installedSet, isLoading, emptyText }: {
  apps: App[];
  installedSet: Set<string> | undefined;
  isLoading: boolean;
  emptyText: string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <AppCardSkeleton key={i} />)}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Store className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} isInstalled={installedSet?.has(app.id) ?? false} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AppStore() {
  const { data: allApps, isLoading, isError } = useApps();
  const { data: installedSet } = useInstalledApps();
  const apps = allApps ?? [];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">应用商店</h1>
            <p className="text-sm text-muted-foreground">探索并安装 Bill.ai 应用</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {apps.length} 个应用
            </Badge>
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>加载失败，请刷新重试</p>
          </div>
        )}

        {/* Tabs */}
        {!isError && (
          <Tabs defaultValue="featured">
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 text-xs">
                  {tab.icon}
                  {tab.label}
                  {!isLoading && (
                    <span className="ml-0.5 text-[10px] opacity-50">
                      ({tab.filter(apps).length})
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {TABS.map((tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                <AppGrid
                  apps={tab.filter(apps)}
                  installedSet={installedSet}
                  isLoading={isLoading}
                  emptyText={tab.emptyText}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
