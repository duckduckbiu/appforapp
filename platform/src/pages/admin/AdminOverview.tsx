import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/admin/StatCard";
import { useAdminStats, useUserGrowth, useFeedSourceHealth } from "@/hooks/useAdminStats";
import { Users, FileText, Newspaper, Rss, AlertTriangle, ShieldBan } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const chartConfig = {
  count: {
    label: "新增用户",
    color: "hsl(var(--chart-1))",
  },
};

export default function AdminOverview() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: growth } = useUserGrowth();
  const { data: sourceHealth } = useFeedSourceHealth();

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground mt-1">平台运营数据概览</p>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="min-h-[140px] p-6">
              <Skeleton className="h-3 w-16 mb-4" />
              <Skeleton className="h-8 w-20" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              icon={Users}
              label="总用户"
              value={stats?.userCount ?? 0}
              description="注册用户总数"
              onClick={() => navigate("/admin/users/list")}
            />
            <StatCard
              icon={FileText}
              label="总帖子"
              value={stats?.postCount ?? 0}
              description="发布帖子总数"
              onClick={() => navigate("/admin/content/posts")}
            />
            <StatCard
              icon={Newspaper}
              label="新闻条目"
              value={stats?.feedItemCount ?? 0}
              description="聚合新闻总数"
              onClick={() => navigate("/admin/content/discover/sources")}
            />
            <StatCard
              icon={Rss}
              label="新闻源"
              value={`${stats?.feedSourceCount ?? 0}`}
              description={
                (stats?.feedSourceErrors ?? 0) > 0
                  ? `${stats?.feedSourceErrors} 个有错误`
                  : "全部正常"
              }
              onClick={() => navigate("/admin/content/discover/sources")}
            />
          </>
        )}
      </div>

      {/* Row 2: User Growth Chart */}
      {growth && growth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">用户增长趋势</CardTitle>
            <CardDescription>近 30 天新增注册用户</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(5)} // MM-DD
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    fill="var(--color-count)"
                    stroke="var(--color-count)"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Two panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Feed source health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">新闻源健康状态</CardTitle>
            <CardDescription>错误数最多的来源</CardDescription>
          </CardHeader>
          <CardContent>
            {!sourceHealth ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : sourceHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <div className="space-y-2">
                {sourceHealth.slice(0, 6).map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          src.error_count > 0 ? "bg-destructive" : "bg-green-500"
                        }`}
                      />
                      <span className="text-sm truncate">{src.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">
                        {src.item_count} 条
                      </span>
                      {src.error_count > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          {src.error_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">平台快照</CardTitle>
            <CardDescription>关键运营指标</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <ShieldBan className="h-4 w-4 text-muted-foreground" />
                  <span>活跃封禁</span>
                </div>
                <span className="text-sm font-mono font-semibold">
                  {stats?.activeBans ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Rss className="h-4 w-4 text-muted-foreground" />
                  <span>新闻源总数</span>
                </div>
                <span className="text-sm font-mono font-semibold">
                  {stats?.feedSourceCount ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span>有错误的源</span>
                </div>
                <span className="text-sm font-mono font-semibold text-destructive">
                  {stats?.feedSourceErrors ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
