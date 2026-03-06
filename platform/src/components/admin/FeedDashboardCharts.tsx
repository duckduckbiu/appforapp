import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  useFeedDashboardStats,
  useFeedArticleTrend,
  useFeedCategoryDistribution,
  useFeedSourceDistribution,
  useFeedTopArticles,
} from "@/hooks/useAdminFeedAnalytics";
import { StatCard } from "@/components/admin/StatCard";
import { Newspaper, Rss, Heart, Flag } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function FeedDashboardCharts() {
  const { data: stats, isLoading: statsLoading } = useFeedDashboardStats();
  const { data: trend, isLoading: trendLoading } = useFeedArticleTrend();
  const { data: categories, isLoading: categoriesLoading } = useFeedCategoryDistribution();
  const { data: sources, isLoading: sourcesLoading } = useFeedSourceDistribution();
  const { data: topArticles, isLoading: topLoading } = useFeedTopArticles();

  return (
    <div className="space-y-6">
      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <LoadingSpinner text="加载统计数据..." />
          </div>
        ) : (
          <>
            <StatCard
              icon={Newspaper}
              label="文章总数"
              value={stats?.totalArticles ?? 0}
            />
            <StatCard
              icon={Rss}
              label="活跃源数"
              value={stats?.activeSources ?? 0}
            />
            <StatCard
              icon={Heart}
              label="总互动数"
              value={stats?.totalInteractions ?? 0}
            />
            <StatCard
              icon={Flag}
              label="待审举报"
              value={stats?.pendingReports ?? 0}
            />
          </>
        )}
      </div>

      {/* Row 2: Article Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">文章发布趋势</CardTitle>
          <p className="text-sm text-muted-foreground">近 30 天每日新增文章数</p>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <LoadingSpinner text="加载趋势数据..." />
            </div>
          ) : !trend || trend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelFormatter={(label: string) => `日期: ${label}`}
                  formatter={(value: number) => [`${value} 篇`, "文章数"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Category Distribution + Source Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">分类分布</CardTitle>
            <p className="text-sm text-muted-foreground">按分类统计文章数量</p>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <LoadingSpinner text="加载分类数据..." />
              </div>
            ) : !categories || categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={100}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number) => [`${value} 篇`, "文章数"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">来源分布</CardTitle>
            <p className="text-sm text-muted-foreground">按来源统计文章数量</p>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <LoadingSpinner text="加载来源数据..." />
              </div>
            ) : !sources || sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    width={120}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number) => [`${value} 篇`, "文章数"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--chart-2, var(--primary)))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Top Articles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">互动 Top 10 文章</CardTitle>
          <p className="text-sm text-muted-foreground">按总互动量排序的热门文章</p>
        </CardHeader>
        <CardContent>
          {topLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner text="加载文章数据..." />
            </div>
          ) : !topArticles || topArticles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">标题</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead className="text-right">点赞</TableHead>
                    <TableHead className="text-right">收藏</TableHead>
                    <TableHead className="text-right">评论</TableHead>
                    <TableHead className="text-right">合计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topArticles
                    .sort((a, b) => b.total - a.total)
                    .map((article) => (
                      <TableRow key={article.id}>
                        <TableCell
                          className="max-w-[300px] truncate font-medium"
                          title={article.title}
                        >
                          {article.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {article.source}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {article.like_count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {article.bookmark_count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {article.comment_count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {article.total}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
