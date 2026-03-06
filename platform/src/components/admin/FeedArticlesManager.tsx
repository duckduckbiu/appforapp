import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Newspaper,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  SkipForward,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  useFeedCategories,
  getCategoryColorClasses,
} from "@/hooks/useFeedCategories";
import { usePlatformLanguages } from "@/hooks/usePlatformLanguages";
import {
  useAdminFeedArticles,
  useDistinctSources,
  type FeedArticle,
  type ArticleFilters,
} from "@/hooks/useAdminFeedArticles";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STATUS_OPTIONS = [
  { value: "published", label: "已发布" },
  { value: "hidden", label: "隐藏" },
  { value: "under_review", label: "审核中" },
];

// Languages loaded from DB via usePlatformLanguages()

function statusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "hidden":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "under_review":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
}

function extractionStatusBadge(status: string | null) {
  switch (status) {
    case "fetched":
      return {
        icon: CheckCircle2,
        label: "已提取",
        className: "bg-green-500/10 text-green-600 dark:text-green-400",
      };
    case "failed":
      return {
        icon: AlertCircle,
        label: "失败",
        className: "bg-red-500/10 text-red-600 dark:text-red-400",
      };
    case "skipped":
      return {
        icon: SkipForward,
        label: "跳过",
        className: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
      };
    case "pending":
    default:
      return {
        icon: Clock,
        label: "待提取",
        className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      };
  }
}

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return "-";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return dateStr;
  }
}

export function FeedArticlesManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: feedCategories } = useFeedCategories();
  const { data: distinctSources } = useDistinctSources();
  const { data: platformLanguages } = usePlatformLanguages();

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [detailArticle, setDetailArticle] = useState<FeedArticle | null>(null);
  const [editArticle, setEditArticle] = useState<FeedArticle | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    tags: "",
    image_url: "",
    status: "published",
    summary: "",
  });
  const [saving, setSaving] = useState(false);

  const filters: ArticleFilters = useMemo(
    () => ({
      search: search || undefined,
      source: sourceFilter || undefined,
      category: categoryFilter || undefined,
      language: languageFilter || undefined,
      status: statusFilter || undefined,
    }),
    [search, sourceFilter, categoryFilter, languageFilter, statusFilter]
  );

  const { data, isLoading, refetch } = useAdminFeedArticles(filters, page);
  const articles = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 0;

  // Build categories from DB
  const CATEGORIES = useMemo(() => {
    if (feedCategories && feedCategories.length > 0) {
      return feedCategories.map((c) => ({ value: c.id, label: c.label_zh }));
    }
    return [
      { value: "news", label: "新闻" },
      { value: "tech", label: "科技" },
      { value: "science", label: "科学" },
      { value: "finance", label: "财经" },
      { value: "general", label: "综合" },
    ];
  }, [feedCategories]);

  const getCategoryBadge = (category: string): string => {
    const cat = feedCategories?.find((c) => c.id === category);
    if (cat) return getCategoryColorClasses(cat.color_class);
    return "bg-muted text-muted-foreground";
  };

  const getCategoryLabel = (category: string): string => {
    return CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  // Selection handlers
  const allSelected =
    articles.length > 0 && articles.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Refresh helper
  const invalidateAndRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-feed-articles"] });
    refetch();
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 篇文章？`)) return;
    try {
      const { error } = await sb
        .from("aggregated_feed")
        .delete()
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      toast.success(`已删除 ${selectedIds.size} 篇文章`);
      setSelectedIds(new Set());
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("批量删除失败", { description: err.message });
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await sb
        .from("aggregated_feed")
        .update({ status })
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      toast.success(`已更新 ${selectedIds.size} 篇文章状态`);
      setSelectedIds(new Set());
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("批量更新失败", { description: err.message });
    }
  };

  // Single delete
  const handleDelete = async (article: FeedArticle) => {
    if (!confirm(`确定删除「${truncate(article.title, 30)}」？`)) return;
    try {
      const { error } = await sb
        .from("aggregated_feed")
        .delete()
        .eq("id", article.id);
      if (error) throw error;
      toast.success("已删除");
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("删除失败", { description: err.message });
    }
  };

  // Open edit dialog
  const openEdit = (article: FeedArticle) => {
    setEditArticle(article);
    setEditForm({
      title: article.title,
      content: article.content || "",
      tags: (article.tags || []).join(", "),
      image_url: article.image_url || "",
      status: article.status,
      summary: article.summary || "",
    });
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editArticle) return;
    if (!editForm.title.trim()) {
      toast.error("标题不能为空");
      return;
    }
    setSaving(true);
    try {
      const tagsArray = editForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        title: editForm.title,
        content: editForm.content || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        image_url: editForm.image_url || null,
        status: editForm.status,
        summary: editForm.summary || null,
      };
      const { error } = await sb
        .from("aggregated_feed")
        .update(payload)
        .eq("id", editArticle.id);
      if (error) throw error;
      toast.success("已保存");
      setEditArticle(null);
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("保存失败", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Clear all articles — batch delete loop
  const [clearing, setClearing] = useState(false);
  const handleClearAll = async () => {
    if (!confirm(`确定要清空全部 ${totalCount} 篇文章？此操作不可逆！`)) return;
    if (!confirm("再次确认：这将删除所有文章数据，确定继续？")) return;
    setClearing(true);
    try {
      // Try RPC first (SECURITY DEFINER, bypasses RLS)
      const { error: rpcError } = await sb.rpc("admin_clear_all_articles");
      if (!rpcError) {
        toast.success("已清空所有文章");
        setSelectedIds(new Set());
        setPage(0);
        invalidateAndRefetch();
        return;
      }
      // Fallback: batch delete by fetching IDs
      let deleted = 0;
      while (true) {
        const { data: batch } = await sb
          .from("aggregated_feed")
          .select("id")
          .limit(200);
        if (!batch || batch.length === 0) break;
        const ids = batch.map((r: { id: string }) => r.id);
        const { error } = await sb
          .from("aggregated_feed")
          .delete()
          .in("id", ids);
        if (error) throw error;
        deleted += ids.length;
      }
      toast.success(`已清空 ${deleted} 篇文章`);
      setSelectedIds(new Set());
      setPage(0);
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("清空失败", { description: err.message });
    } finally {
      setClearing(false);
    }
  };

  // Trigger full content extraction
  const [extracting, setExtracting] = useState(false);
  const handleTriggerExtraction = async (articleId?: string) => {
    setExtracting(true);
    try {
      const body: Record<string, unknown> = {};
      if (articleId) body.article_id = articleId;

      const { data: funcData, error: funcError } = await sb.functions.invoke(
        "extract-full-article",
        { body }
      );
      if (funcError) throw funcError;
      const result = funcData as { processed?: number; fetched?: number; failed?: number } | null;
      toast.success(
        articleId
          ? "已触发重新提取"
          : `提取完成: ${result?.fetched || 0} 成功, ${result?.failed || 0} 失败`
      );
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("提取失败", { description: err.message });
    } finally {
      setExtracting(false);
    }
  };

  // Reset extraction status to pending (for re-extraction)
  const handleResetExtraction = async (articleId: string) => {
    try {
      const { error } = await sb
        .from("aggregated_feed")
        .update({
          full_content_status: "pending",
          extraction_error: null,
          full_content: null,
        })
        .eq("id", articleId);
      if (error) throw error;
      toast.success("已重置为待提取状态");
      invalidateAndRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("重置失败", { description: err.message });
    }
  };

  // Pagination
  const handlePrevPage = () => {
    setPage((p) => Math.max(0, p - 1));
    setSelectedIds(new Set());
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages - 1, p + 1));
    setSelectedIds(new Set());
  };

  // Reset page when filters change
  const handleFilterChange = <K extends keyof typeof filters>(
    setter: (val: string) => void,
    val: string
  ) => {
    setter(val);
    setPage(0);
    setSelectedIds(new Set());
  };

  if (isLoading && articles.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {/* Top bar: count + extract trigger + clear all */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              共 {totalCount} 篇文章
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {totalCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => handleTriggerExtraction()}
                  disabled={extracting}
                >
                  {extracting ? (
                    <LoadingSpinner size="sm" className="mr-1.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  全文提取
                </Button>
              )}
              {totalCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={handleClearAll}
                  disabled={clearing}
                >
                  {clearing && <LoadingSpinner size="sm" className="mr-1.5" />}
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  清空所有文章
                </Button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标题..."
                value={search}
                onChange={(e) =>
                  handleFilterChange(setSearch, e.target.value)
                }
                className="pl-9"
              />
            </div>

            <Select
              value={sourceFilter || "all"}
              onValueChange={(v) =>
                handleFilterChange(setSourceFilter, v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                {(distinctSources || []).map((name: string) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter || "all"}
              onValueChange={(v) =>
                handleFilterChange(setCategoryFilter, v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={languageFilter || "all"}
              onValueChange={(v) =>
                handleFilterChange(setLanguageFilter, v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {(platformLanguages || []).map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.flag} {l.label_native}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter || "all"}
              onValueChange={(v) =>
                handleFilterChange(setStatusFilter, v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk operations toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border bg-muted/30">
              <span className="text-sm text-muted-foreground">
                已选中 {selectedIds.size} 项
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                删除选中
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatus("hidden")}
              >
                设为隐藏
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatus("published")}
              >
                设为发布
              </Button>
            </div>
          )}

          {/* Table */}
          {articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>暂无文章</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="min-w-[200px]">标题</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>语言</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>提取</TableHead>
                    <TableHead>发布时间</TableHead>
                    <TableHead>互动</TableHead>
                    <TableHead className="w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => {
                    const categoryTag = article.tags?.[0] || "";
                    const engagement =
                      (article.like_count || 0) +
                      (article.bookmark_count || 0) +
                      (article.comment_count || 0);

                    return (
                      <TableRow key={article.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(article.id)}
                            onCheckedChange={() => toggleSelect(article.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-left text-sm font-medium hover:underline cursor-pointer"
                            onClick={() => setDetailArticle(article)}
                          >
                            {truncate(article.title, 60)}
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {article.source}
                          </span>
                        </TableCell>
                        <TableCell>
                          {categoryTag ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 ${getCategoryBadge(categoryTag)}`}
                            >
                              {getCategoryLabel(categoryTag)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            {(platformLanguages || []).find((l) => l.code === article.language)?.label_native || article.language || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-5 ${statusBadgeClass(article.status)}`}
                          >
                            {statusLabel(article.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const es = extractionStatusBadge(article.full_content_status);
                            const EsIcon = es.icon;
                            return (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-5 gap-0.5 ${es.className}`}
                                title={article.extraction_error || undefined}
                              >
                                <EsIcon className="h-3 w-3" />
                                {es.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(article.published_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {engagement > 0 ? engagement : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDetailArticle(article)}
                              title="查看详情"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(article)}
                              title="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {(article.full_content_status === "failed" || article.full_content_status === "pending") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleResetExtraction(article.id)}
                                title={article.full_content_status === "failed" ? "重新提取" : "触发提取"}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(article)}
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                第 {page + 1} / {totalPages} 页 (共 {totalCount} 条)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page >= totalPages - 1}
                >
                  下一页
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Article Detail Dialog */}
      <Dialog
        open={detailArticle !== null}
        onOpenChange={(open) => {
          if (!open) setDetailArticle(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>文章详情</DialogTitle>
          </DialogHeader>
          {detailArticle && (
            <div className="space-y-4 py-2">
              {/* Image */}
              {detailArticle.image_url && (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={detailArticle.image_url}
                    alt={detailArticle.title}
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              {/* Title */}
              <h3 className="text-lg font-semibold leading-tight">
                {detailArticle.title}
              </h3>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{detailArticle.source}</span>
                <span>-</span>
                {detailArticle.author_name && (
                  <>
                    <span>{detailArticle.author_name}</span>
                    <span>-</span>
                  </>
                )}
                <span>{formatDate(detailArticle.published_at)}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-5 ${statusBadgeClass(detailArticle.status)}`}
                >
                  {statusLabel(detailArticle.status)}
                </Badge>
                {detailArticle.language && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5"
                  >
                    {(platformLanguages || []).find((l) => l.code === detailArticle.language)?.label_native || detailArticle.language}
                  </Badge>
                )}
              </div>

              {/* Tags */}
              {detailArticle.tags && detailArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detailArticle.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-5 ${getCategoryBadge(tag)}`}
                    >
                      {getCategoryLabel(tag)}
                    </Badge>
                  ))}
                </div>
              )}

              {/* URL */}
              <div className="flex items-center gap-3">
                {detailArticle.url && (
                  <a
                    href={detailArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    原文链接
                  </a>
                )}
                <button
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer"
                  onClick={() => {
                    setDetailArticle(null);
                    navigate(`/feed?article=${detailArticle.id}`);
                  }}
                >
                  <Newspaper className="h-3.5 w-3.5" />
                  站内查看
                </button>
              </div>

              {/* Summary */}
              {detailArticle.summary && (
                <div>
                  <div className="text-sm font-medium mb-1">摘要</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detailArticle.summary}
                  </p>
                </div>
              )}

              {/* Content */}
              {detailArticle.content && (
                <div>
                  <div className="text-sm font-medium mb-1">内容</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto rounded-md border p-3 bg-muted/20">
                    {detailArticle.content}
                  </div>
                </div>
              )}

              {/* Engagement */}
              <div className="grid grid-cols-3 gap-4 p-3 rounded-lg border bg-muted/20">
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {detailArticle.like_count || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">点赞</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {detailArticle.bookmark_count || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">收藏</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {detailArticle.comment_count || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">评论</div>
                </div>
              </div>

              {/* Extraction info */}
              <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                <div className="text-sm font-medium">全文提取</div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const es = extractionStatusBadge(detailArticle.full_content_status);
                    const EsIcon = es.icon;
                    return (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-0.5 ${es.className}`}>
                        <EsIcon className="h-3 w-3" />
                        {es.label}
                      </Badge>
                    );
                  })()}
                  {detailArticle.word_count && (
                    <span className="text-xs text-muted-foreground">{detailArticle.word_count} 字</span>
                  )}
                  {detailArticle.extracted_at && (
                    <span className="text-xs text-muted-foreground">提取于 {formatDate(detailArticle.extracted_at)}</span>
                  )}
                </div>
                {detailArticle.extraction_error && (
                  <div className="text-xs text-red-500 mt-1">
                    错误: {detailArticle.extraction_error}
                  </div>
                )}
                {(detailArticle.full_content_status === "failed" || detailArticle.full_content_status === "pending") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleResetExtraction(detailArticle.id);
                      handleTriggerExtraction(detailArticle.id);
                    }}
                    disabled={extracting}
                  >
                    {extracting ? <LoadingSpinner size="sm" className="mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                    {detailArticle.full_content_status === "failed" ? "重新提取" : "立即提取"}
                  </Button>
                )}
              </div>

              {/* Metadata */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  ID: <span className="font-mono">{detailArticle.id}</span>
                </div>
                <div>来源 ID: {detailArticle.source_id}</div>
                {detailArticle.reading_time_minutes && (
                  <div>阅读时间: {detailArticle.reading_time_minutes} 分钟</div>
                )}
                <div>评分: {detailArticle.score}</div>
                {detailArticle.fetched_at && (
                  <div>抓取时间: {formatDate(detailArticle.fetched_at)}</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Article Edit Dialog */}
      <Dialog
        open={editArticle !== null}
        onOpenChange={(open) => {
          if (!open) setEditArticle(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑文章</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">标题 *</label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                placeholder="文章标题"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">内容</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                value={editForm.content}
                onChange={(e) =>
                  setEditForm({ ...editForm, content: e.target.value })
                }
                placeholder="文章内容"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">标签 (逗号分隔)</label>
              <Input
                value={editForm.tags}
                onChange={(e) =>
                  setEditForm({ ...editForm, tags: e.target.value })
                }
                placeholder="例如: tech, news, ai"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">图片 URL</label>
              <Input
                value={editForm.image_url}
                onChange={(e) =>
                  setEditForm({ ...editForm, image_url: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">状态</label>
              <Select
                value={editForm.status}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, status: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">摘要</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                value={editForm.summary}
                onChange={(e) =>
                  setEditForm({ ...editForm, summary: e.target.value })
                }
                placeholder="文章摘要"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditArticle(null)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
