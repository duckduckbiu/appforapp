import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Flag,
  ExternalLink,
  Check,
  X,
  EyeOff,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  useAdminFeedReports,
  useReportStats,
  useResolveReport,
  type FeedReport,
} from "@/hooks/useAdminFeedReports";

type TabFilter = "pending" | "resolved" | "all";
type Resolution = "resolved_approved" | "resolved_rejected" | "resolved_hidden";

const REASON_CONFIG: Record<string, { label: string; color: string }> = {
  spam: {
    label: "垃圾内容",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  misleading: {
    label: "误导信息",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  inappropriate: {
    label: "不当内容",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  copyright: {
    label: "版权问题",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  other: {
    label: "其他",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

const RESOLUTION_LABELS: Record<string, { label: string; color: string }> = {
  resolved_approved: {
    label: "已批准",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  resolved_hidden: {
    label: "已隐藏",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  resolved_rejected: {
    label: "已驳回",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function FeedReportQueue() {
  const [tab, setTab] = useState<TabFilter>("pending");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<Resolution | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: reports, isLoading } = useAdminFeedReports(tab);
  const { data: stats } = useReportStats();
  const resolveMutation = useResolveReport();

  const handleStartResolve = (reportId: string, action: Resolution) => {
    setResolvingId(reportId);
    setResolutionAction(action);
    setResolutionNote("");
  };

  const handleCancelResolve = () => {
    setResolvingId(null);
    setResolutionAction(null);
    setResolutionNote("");
  };

  const handleConfirmResolve = (report: FeedReport) => {
    if (!resolutionAction) return;
    resolveMutation.mutate(
      {
        reportId: report.id,
        resolution: resolutionAction,
        note: resolutionNote.trim() || undefined,
        feedId: report.feed_id,
      },
      {
        onSuccess: () => {
          const actionLabel =
            resolutionAction === "resolved_approved"
              ? "已批准"
              : resolutionAction === "resolved_hidden"
                ? "已隐藏文章"
                : "已驳回";
          toast.success(actionLabel);
          handleCancelResolve();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          toast.error("操作失败", { description: err.message });
        },
      }
    );
  };

  const getReasonBadge = (reason: string) => {
    const config = REASON_CONFIG[reason] || REASON_CONFIG.other;
    return (
      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-5 border-0 ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  const getResolutionBadge = (status: string) => {
    const config = RESOLUTION_LABELS[status];
    if (!config) return null;
    return (
      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-5 border-0 ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "pending", label: "待处理" },
    { key: "resolved", label: "已处理" },
    { key: "all", label: "全部" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              待处理举报
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              今日已处理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.resolvedToday ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总举报数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? "-"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main card */}
      <Card>
        <CardContent className="pt-6">
          {/* Tab filter */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 mb-4 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Flag className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>暂无举报记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const isPending = report.status === "pending";
                const isResolving = resolvingId === report.id;

                return (
                  <div
                    key={report.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors space-y-3"
                  >
                    {/* Top row: article info + reason */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {report.article_url ? (
                            <a
                              href={report.article_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium truncate max-w-[400px] hover:underline flex items-center gap-1"
                            >
                              {report.article_title || "未知文章"}
                              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="text-sm font-medium truncate max-w-[400px]">
                              {report.article_title || "未知文章"}
                            </span>
                          )}
                          {getReasonBadge(report.reason)}
                        </div>
                        {report.article_source && (
                          <div className="text-[11px] text-muted-foreground mt-1">
                            来源：{report.article_source}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(report.created_at), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </div>
                    </div>

                    {/* Report details */}
                    {report.details && (
                      <div className="flex items-start gap-1.5 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{report.details}</span>
                      </div>
                    )}

                    {/* Resolution info (for resolved reports) */}
                    {!isPending && (
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                        {getResolutionBadge(report.status)}
                        {report.resolved_at && (
                          <span>
                            处理于{" "}
                            {formatDistanceToNow(new Date(report.resolved_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                        )}
                        {report.resolution_note && (
                          <span className="italic">
                            备注：{report.resolution_note}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action buttons (only for pending) */}
                    {isPending && !isResolving && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                          onClick={() => handleStartResolve(report.id, "resolved_approved")}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          批准
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleStartResolve(report.id, "resolved_hidden")}
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          隐藏文章
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartResolve(report.id, "resolved_rejected")}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          驳回
                        </Button>
                      </div>
                    )}

                    {/* Inline resolution note input */}
                    {isPending && isResolving && (
                      <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="text-xs text-muted-foreground shrink-0">
                          {resolutionAction === "resolved_approved"
                            ? "批准举报"
                            : resolutionAction === "resolved_hidden"
                              ? "隐藏文章"
                              : "驳回举报"}
                        </span>
                        <Input
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="处理备注（可选）"
                          className="h-8 text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirmResolve(report);
                            if (e.key === "Escape") handleCancelResolve();
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => handleConfirmResolve(report)}
                          disabled={resolveMutation.isPending}
                        >
                          {resolveMutation.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            "确认"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={handleCancelResolve}
                          disabled={resolveMutation.isPending}
                        >
                          取消
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
