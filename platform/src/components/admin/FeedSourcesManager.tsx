import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Rss, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2,
  Clock, Pencil, Play, Square, RotateCcw, Search,
  Globe, Timer, Zap, AlertTriangle, ToggleLeft, ToggleRight,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useFeedCategories, getCategoryColorClasses } from "@/hooks/useFeedCategories";
import { usePlatformLanguages } from "@/hooks/usePlatformLanguages";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────

interface FeedSource {
  id: string;
  name: string;
  source_type: string;
  source_url: string | null;
  category: string;
  language: string;
  config: Record<string, unknown>;
  is_active: boolean;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  item_count: number;
  total_item_count: number;
  error_count: number;
  last_error: string | null;
  description: string | null;
  batch_group: number | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────

const SOURCE_TYPES = [
  { value: "rss", label: "RSS" },
  { value: "hackernews", label: "Hacker News" },
  { value: "reddit", label: "Reddit" },
  { value: "browser_use", label: "AI 浏览器" },
];

type TabKey = "all" | "running" | "stopped" | "error";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "running", label: "运行中" },
  { key: "stopped", label: "已停止" },
  { key: "error", label: "有错误" },
];

const EMPTY_FORM: Omit<FeedSource, "id" | "created_at" | "last_fetched_at" | "item_count" | "total_item_count" | "error_count" | "last_error" | "batch_group"> = {
  name: "",
  source_type: "rss",
  source_url: "",
  category: "news",
  language: "zh-CN",
  config: { limit: 20 },
  is_active: true,
  fetch_interval_minutes: 30,
  description: "",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ── Helpers ────────────────────────────────────────────────

function getNextFetchIn(src: FeedSource): string {
  if (!src.last_fetched_at) return "未抓取";
  const nextAt = new Date(src.last_fetched_at).getTime() + src.fetch_interval_minutes * 60 * 1000;
  const diffMs = nextAt - Date.now();
  if (diffMs <= 0) return "即将更新";
  const mins = Math.round(diffMs / 60000);
  return mins < 60 ? `${mins}分后` : `${Math.round(mins / 60)}小时后`;
}

// ── Component ──────────────────────────────────────────────

export function FeedSourcesManager() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchStartTime, setFetchStartTime] = useState<Date | null>(null);
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);

  // Scheduler settings (persisted to localStorage)
  const [queueMode, setQueueMode] = useState<"serial" | "parallel">(() =>
    (localStorage.getItem("feedQueueMode") as "serial" | "parallel") || "serial"
  );
  const [autoInterval, setAutoInterval] = useState<string>(() =>
    localStorage.getItem("feedAutoInterval") || "manual"
  );
  const [nextAutoAt, setNextAutoAt] = useState<Date | null>(null);

  const { data: platformLanguages } = usePlatformLanguages();

  // Filters
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 20;

  const { data: feedCategories } = useFeedCategories();

  const CATEGORIES = useMemo(() =>
    (feedCategories && feedCategories.length > 0)
      ? feedCategories.map((c) => ({ value: c.id, label: c.label_zh }))
      : [
          { value: "news", label: "新闻" },
          { value: "tech", label: "科技" },
          { value: "science", label: "科学" },
          { value: "finance", label: "财经" },
          { value: "general", label: "综合" },
        ],
    [feedCategories]
  );

  const getCategoryBadge = (category: string): string => {
    const cat = feedCategories?.find((c) => c.id === category);
    if (cat) return getCategoryColorClasses(cat.color_class);
    return "bg-muted text-muted-foreground";
  };

  // ── Data loading ─────────────────────────────────────────

  const loadSources = useCallback(async () => {
    try {
      const { data, error } = await sb
        .from("feed_sources")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      setSources(data || []);
    } catch (err) {
      console.error("Failed to load feed sources:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  // Poll while a bulk fetch is in progress (2s interval)
  useEffect(() => {
    if (!fetching) return;
    const id = setInterval(loadSources, 2000);
    return () => clearInterval(id);
  }, [fetching, loadSources]);

  // Persist settings
  useEffect(() => { localStorage.setItem("feedQueueMode", queueMode); }, [queueMode]);
  useEffect(() => { localStorage.setItem("feedAutoInterval", autoInterval); }, [autoInterval]);

  // Auto-trigger effect: schedule next fetch when autoInterval is set
  useEffect(() => {
    if (autoInterval === "manual") { setNextAutoAt(null); return; }
    const ms = parseInt(autoInterval) * 60 * 1000;
    const scheduleNext = () => {
      const next = new Date(Date.now() + ms);
      setNextAutoAt(next);
    };
    scheduleNext();
    const id = setInterval(() => {
      scheduleNext();
      // handleTriggerFetch will be called via the nextAutoAt watcher below
    }, ms);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInterval]);

  // Watch nextAutoAt changes: trigger fetch when the scheduled time arrives
  const handleTriggerFetchRef = useCallback(async (opts?: { concurrency?: number; force?: boolean }) => {
    setFetching(true);
    setFetchStartTime(new Date());
    try {
      const concurrencyVal = opts?.concurrency ?? (queueMode === "serial" ? 1 : 3);
      const res = await supabase.functions.invoke("fetch-aggregated-feed", {
        body: { concurrency: concurrencyVal, force: opts?.force ?? true },
      });
      if (res.error) throw res.error;
      const summary = res.data?.summary || {};
      const total = Object.values(summary).reduce(
        (acc: number, v) => acc + ((v as { count: number }).count || 0), 0
      );
      toast.success("抓取完成", { description: `共获取 ${total} 条内容` });
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("抓取失败", { description: err.message });
    } finally {
      setFetching(false);
      setFetchStartTime(null);
    }
  }, [queueMode, loadSources]);

  // ── Computed stats ───────────────────────────────────────

  const stats = useMemo(() => {
    const running = sources.filter((s) => s.is_active);
    const stopped = sources.filter((s) => !s.is_active);
    const withErrors = sources.filter((s) => s.error_count > 0);
    const totalItems = sources.reduce((a, s) => a + (s.total_item_count || s.item_count || 0), 0);
    const lastFetch = sources
      .filter((s) => s.last_fetched_at)
      .sort((a, b) => new Date(b.last_fetched_at!).getTime() - new Date(a.last_fetched_at!).getTime())[0];

    return {
      total: sources.length,
      running: running.length,
      stopped: stopped.length,
      errors: withErrors.length,
      totalItems,
      lastFetchTime: lastFetch?.last_fetched_at || null,
    };
  }, [sources]);

  // Queue progress during bulk fetch
  const completedCount = useMemo(() => {
    if (!fetchStartTime) return 0;
    return sources.filter(s =>
      s.last_fetched_at && new Date(s.last_fetched_at) > fetchStartTime
    ).length;
  }, [sources, fetchStartTime]);

  const currentProcessing = useMemo(() => {
    if (!fetchStartTime || !fetching) return null;
    return sources
      .filter(s => s.last_fetched_at && new Date(s.last_fetched_at) > fetchStartTime)
      .sort((a, b) => new Date(b.last_fetched_at!).getTime() - new Date(a.last_fetched_at!).getTime())[0]?.name || null;
  }, [sources, fetchStartTime, fetching]);

  // ── Filtered list ────────────────────────────────────────

  const allFilteredSources = useMemo(() => {
    let list = sources;

    if (activeTab === "running") list = list.filter((s) => s.is_active);
    else if (activeTab === "stopped") list = list.filter((s) => !s.is_active);
    else if (activeTab === "error") list = list.filter((s) => s.error_count > 0);

    if (langFilter !== "all") list = list.filter((s) => s.language === langFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.source_url || "").toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [sources, activeTab, langFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [activeTab, langFilter, searchQuery]);

  const totalPages = Math.ceil(allFilteredSources.length / PAGE_SIZE);
  const filteredSources = allFilteredSources.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Tab counts ───────────────────────────────────────────

  const tabCounts: Record<TabKey, number> = useMemo(() => ({
    all: sources.length,
    running: sources.filter((s) => s.is_active).length,
    stopped: sources.filter((s) => !s.is_active).length,
    error: sources.filter((s) => s.error_count > 0).length,
  }), [sources]);

  // ── CRUD handlers ────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (src: FeedSource) => {
    setEditingId(src.id);
    setForm({
      name: src.name,
      source_type: src.source_type,
      source_url: src.source_url || "",
      category: src.category,
      language: src.language,
      config: src.config || { limit: 20 },
      is_active: src.is_active,
      fetch_interval_minutes: src.fetch_interval_minutes,
      description: src.description || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("请输入源名称"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        source_type: form.source_type,
        source_url: form.source_url || null,
        category: form.category,
        language: form.language,
        config: form.config,
        is_active: form.is_active,
        fetch_interval_minutes: form.fetch_interval_minutes,
        description: form.description || null,
      };
      if (editingId) {
        const { error } = await sb.from("feed_sources").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("已更新");
      } else {
        const { error } = await sb.from("feed_sources").insert(payload);
        if (error) throw error;
        toast.success("已添加");
      }
      setDialogOpen(false);
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("保存失败", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (src: FeedSource) => {
    if (!confirm(`确定删除「${src.name}」？`)) return;
    try {
      const { error } = await sb.from("feed_sources").delete().eq("id", src.id);
      if (error) throw error;
      toast.success("已删除");
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("删除失败", { description: err.message });
    }
  };

  const handleToggle = async (src: FeedSource) => {
    try {
      const { error } = await sb
        .from("feed_sources")
        .update({ is_active: !src.is_active })
        .eq("id", src.id);
      if (error) throw error;
      setSources((prev) => prev.map((s) => s.id === src.id ? { ...s, is_active: !s.is_active } : s));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("切换失败", { description: err.message });
    }
  };

  // ── Fetch controls ───────────────────────────────────────

  // Bulk fetch — proxy to the ref-stable version
  const handleTriggerFetch = () => handleTriggerFetchRef();

  // Single-source fetch (force=true skips interval check)
  const handleFetchSource = async (src: FeedSource) => {
    setFetchingSourceId(src.id);
    try {
      const res = await supabase.functions.invoke("fetch-aggregated-feed", {
        body: { source_id: src.id, force: true },
      });
      if (res.error) throw res.error;
      const count = res.data?.summary?.[src.name]?.count ?? 0;
      toast.success(`「${src.name}」抓取完成`, { description: `获取 ${count} 条` });
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("抓取失败", { description: err.message });
    } finally {
      setFetchingSourceId(null);
    }
  };

  const handleStartAll = async () => {
    try {
      const { error } = await sb.from("feed_sources").update({ is_active: true }).eq("is_active", false);
      if (error) throw error;
      toast.success("已启动全部新闻源");
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("操作失败", { description: err.message });
    }
  };

  const handleStopAll = async () => {
    if (!confirm("确定停止全部新闻源抓取？")) return;
    try {
      const { error } = await sb.from("feed_sources").update({ is_active: false }).eq("is_active", true);
      if (error) throw error;
      toast.success("已停止全部新闻源");
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("操作失败", { description: err.message });
    }
  };

  // Bulk toggle for currently filtered sources
  const handleEnableFiltered = async () => {
    const ids = allFilteredSources.filter((s) => !s.is_active).map((s) => s.id);
    if (ids.length === 0) { toast.info("过滤范围内的源已全部启用"); return; }
    try {
      const { error } = await sb.from("feed_sources").update({ is_active: true }).in("id", ids);
      if (error) throw error;
      toast.success(`已启用 ${ids.length} 个源`);
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("操作失败", { description: err.message });
    }
  };

  const handleDisableFiltered = async () => {
    const ids = allFilteredSources.filter((s) => s.is_active).map((s) => s.id);
    if (ids.length === 0) { toast.info("过滤范围内的源已全部停用"); return; }
    try {
      const { error } = await sb.from("feed_sources").update({ is_active: false }).in("id", ids);
      if (error) throw error;
      toast.success(`已停用 ${ids.length} 个源`);
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("操作失败", { description: err.message });
    }
  };

  const handleResetErrors = async () => {
    try {
      const { error } = await sb
        .from("feed_sources")
        .update({ error_count: 0, last_error: null })
        .gt("error_count", 0);
      if (error) throw error;
      toast.success("已重置所有错误计数");
      loadSources();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("重置失败", { description: err.message });
    }
  };

  const handleRetrySource = async (src: FeedSource) => {
    try {
      await sb.from("feed_sources").update({ error_count: 0, last_error: null }).eq("id", src.id);
      await handleFetchSource(src);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("重试失败", { description: err.message });
    }
  };

  // ── Loading state ────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Fetch Control Panel ─────────────────────────── */}
      <Card>
        <CardContent className="py-4 space-y-3">

          {/* Row 1: Status line */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              fetching ? "bg-green-500 animate-pulse" : stats.running > 0 ? "bg-green-500/60" : "bg-muted-foreground/30"
            }`} />
            <span className="text-sm font-medium">
              {fetching ? "正在抓取" : stats.running > 0 ? "调度已启用" : "调度已停止"}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.running}/{stats.total} 个源
            </span>
            {stats.lastFetchTime && (
              <span className="text-xs text-muted-foreground">
                · 最近 {formatDistanceToNow(new Date(stats.lastFetchTime), { addSuffix: true, locale: zhCN })} 抓取
              </span>
            )}
            <div className="flex items-center gap-3 ml-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-green-500" />
                {stats.totalItems.toLocaleString()} 条
              </span>
              {stats.errors > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.errors} 错误
                </span>
              )}
              {nextAutoAt && !fetching && (
                <span className="flex items-center gap-1 text-blue-500">
                  <Timer className="h-3 w-3" />
                  自动 {formatDistanceToNow(nextAutoAt, { addSuffix: true, locale: zhCN })}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Settings */}
          <div className="flex items-center gap-4 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">前台间隔</span>
                  <Select value={autoInterval} onValueChange={setAutoInterval}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">手动</SelectItem>
                      <SelectItem value="30">30 分钟</SelectItem>
                      <SelectItem value="60">1 小时</SelectItem>
                      <SelectItem value="120">2 小时</SelectItem>
                      <SelectItem value="360">6 小时</SelectItem>
                      <SelectItem value="720">12 小时</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                仅在页面打开时有效。服务端自动调度由 GitHub Actions Cron 负责（每 30 分钟分批触发）。
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">队列模式</span>
              <Select value={queueMode} onValueChange={(v) => setQueueMode(v as "serial" | "parallel")}>
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serial">串行</SelectItem>
                  <SelectItem value="parallel">并行 ×3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
              <Timer className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">批次：</span>
              {[0, 1, 2, 3, 4, 5].map((g) => {
                const count = sources.filter((s) => s.batch_group === g).length;
                const active = sources.filter((s) => s.batch_group === g && s.is_active).length;
                if (count === 0) return null;
                return (
                  <Badge key={g} variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                    {g}: {active}/{count}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Row 3: Queue visualization */}
          <div className="space-y-1">
            {(() => {
              const BOXES = 20;
              const total = stats.running;
              const filled = total > 0 ? Math.floor((completedCount / total) * BOXES) : 0;
              const currentBox = fetching && filled < BOXES ? filled : -1;
              return (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 flex-wrap">
                    {Array.from({ length: BOXES }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-4 w-4 rounded-sm border text-[8px] flex items-center justify-center transition-all ${
                          i < filled
                            ? "bg-green-500 border-green-500"
                            : i === currentBox
                            ? "bg-green-500/40 border-green-400 animate-pulse"
                            : "bg-muted border-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {fetching
                      ? `当前: ${currentProcessing || "..."} (${completedCount}/${total})`
                      : `队列: ${total} 个源就绪`}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Row 4: Action buttons */}
          <div className="flex items-center gap-2 pt-1 border-t flex-wrap">
            {stats.errors > 0 && (
              <Button variant="outline" size="sm" onClick={handleResetErrors}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                重置错误
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerFetch}
              disabled={fetching || stats.running === 0}
            >
              {fetching ? (
                <LoadingSpinner size="sm" className="mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              立即抓取
            </Button>
            {stats.running > 0 ? (
              <Button variant="outline" size="sm" onClick={handleStopAll}>
                <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                全部停止
              </Button>
            ) : (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleStartAll}>
                <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                全部启动
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Source List Card ────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* ── Tabs + Add button ──────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] ${
                    activeTab === tab.key ? "opacity-80" : "opacity-50"
                  }`}>
                    {tabCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              添加源
            </Button>
          </div>

          {/* ── Filter bar ────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索源名称、URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              <button
                onClick={() => setLangFilter("all")}
                className={`px-2 py-1 text-[11px] rounded transition-colors ${
                  langFilter === "all"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                全部
              </button>
              {(platformLanguages || []).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLangFilter(lang.code)}
                  className={`px-2 py-1 text-[11px] rounded transition-colors ${
                    langFilter === lang.code
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang.flag} {lang.label_native}
                </button>
              ))}
            </div>

            {/* Bulk toggle for filtered sources */}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                    onClick={handleEnableFiltered}
                  >
                    <ToggleRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>全部开启（当前筛选）</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={handleDisableFiltered}
                  >
                    <ToggleLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>全部关闭（当前筛选）</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Source list ────────────────────────────── */}
          {filteredSources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Rss className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>{searchQuery ? "没有匹配的新闻源" : "暂无新闻源，点击「添加源」开始配置"}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredSources.map((src) => (
                <div
                  key={src.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  {/* Switch: enable/disable source */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0">
                        <Switch
                          checked={src.is_active}
                          onCheckedChange={() => handleToggle(src)}
                          className="data-[state=checked]:bg-green-600"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {src.is_active ? "点击停止自动抓取" : "点击启用自动抓取"}
                    </TooltipContent>
                  </Tooltip>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{src.name}</span>
                      {src.error_count > 0 && (
                        <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                      )}
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${getCategoryBadge(src.category)}`}>
                        {CATEGORIES.find((c) => c.value === src.category)?.label || src.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                        {src.source_type.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                        {(platformLanguages || []).find((l) => l.code === src.language)?.label_native || src.language}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Timer className="h-3 w-3" />
                        {src.fetch_interval_minutes}分钟
                      </span>
                      {src.last_fetched_at && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(src.last_fetched_at), { addSuffix: true, locale: zhCN })}
                        </span>
                      )}
                      {/* Cumulative total */}
                      {(src.total_item_count || 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          累计 {(src.total_item_count || 0).toLocaleString()} 条
                        </span>
                      )}
                      {/* Next fetch countdown */}
                      <span className="flex items-center gap-0.5 opacity-70">
                        <Zap className="h-3 w-3" />
                        {getNextFetchIn(src)}
                      </span>
                      {src.error_count > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-destructive cursor-help">
                              <AlertCircle className="h-3 w-3" />
                              错误×{src.error_count}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs break-all">{src.last_error}</p>
                            <p className="text-xs mt-1 text-muted-foreground">连续错误 {src.error_count} 次</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className="truncate max-w-[160px] opacity-40">
                        {src.source_url}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Single-source fetch button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                          onClick={() => handleFetchSource(src)}
                          disabled={fetchingSourceId === src.id}
                        >
                          {fetchingSourceId === src.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>立即抓取</TooltipContent>
                    </Tooltip>

                    {src.error_count > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500" onClick={() => handleRetrySource(src)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>重置错误并抓取</TooltipContent>
                      </Tooltip>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(src)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(src)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              共 {allFilteredSources.length} 个源
              {allFilteredSources.length !== sources.length && ` (已过滤，总计 ${sources.length})`}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 px-2 text-xs"
                >
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 px-2 text-xs"
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ──────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑新闻源" : "添加新闻源"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：BBC World News"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">类型</label>
                <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">分类</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">语言</label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(platformLanguages || []).map((l) => (
                      <SelectItem key={l.code} value={l.code}>{l.flag} {l.label_native}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">RSS / API URL</label>
              <Input
                value={form.source_url || ""}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                placeholder="https://feeds.bbci.co.uk/news/world/rss.xml"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">抓取间隔（分钟）</label>
                <Input
                  type="number"
                  value={form.fetch_interval_minutes}
                  onChange={(e) => setForm({ ...form, fetch_interval_minutes: Number(e.target.value) || 30 })}
                  min={5} max={1440}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">每次抓取条数</label>
                <Input
                  type="number"
                  value={(form.config?.limit as number) || 20}
                  onChange={(e) => setForm({ ...form, config: { ...form.config, limit: Number(e.target.value) || 20 } })}
                  min={5} max={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">描述（选填）</label>
              <Input
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="源的简短描述"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {editingId ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
