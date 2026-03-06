import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  MessageSquare,
  Heart,
  Bookmark,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  useAdminFeedComments,
  useDeleteComment,
  useTopLikedArticles,
  useTopBookmarkedArticles,
} from "@/hooks/useAdminFeedComments";

type TabKey = "comments" | "likes" | "bookmarks";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "comments", label: "评论管理", icon: <MessageSquare className="h-4 w-4" /> },
  { key: "likes", label: "点赞统计", icon: <Heart className="h-4 w-4" /> },
  { key: "bookmarks", label: "收藏统计", icon: <Bookmark className="h-4 w-4" /> },
];

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// --------------- Comments Tab ---------------

function CommentsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useAdminFeedComments(debouncedSearch, page);
  const deleteMutation = useDeleteComment();

  // Simple debounce via timeout ref
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
    setTimer(t);
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteMutation.mutateAsync(commentId);
      toast.success("评论已删除");
      setDeleteConfirmId(null);
    } catch {
      toast.error("删除失败");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const { items = [], totalCount = 0, totalPages = 0 } = data || {};

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="搜索评论内容..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        共 {totalCount} 条评论
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>暂无评论</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">内容</TableHead>
                <TableHead>作者</TableHead>
                <TableHead>文章</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="w-[60px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell className="font-mono text-sm">
                    {truncate(comment.content, 80)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {comment.author_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {truncate(comment.article_title || "", 30)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </TableCell>
                  <TableCell>
                    {deleteConfirmId === comment.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(comment.id)}
                        >
                          {deleteMutation.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(comment.id)}
                        title="删除评论"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            第 {page + 1} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------- Likes Tab ---------------

function LikesTab() {
  const { data: articles, isLoading } = useTopLikedArticles();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Heart className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>暂无点赞数据</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">文章标题</TableHead>
            <TableHead>来源</TableHead>
            <TableHead className="text-right">点赞数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => (
            <TableRow key={article.feed_id}>
              <TableCell className="text-sm font-medium">
                {truncate(article.title, 60)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {article.source}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1 text-sm font-medium">
                  <Heart className="h-3.5 w-3.5 text-red-500" />
                  {article.like_count}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --------------- Bookmarks Tab ---------------

function BookmarksTab() {
  const { data: articles, isLoading } = useTopBookmarkedArticles();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>暂无收藏数据</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">文章标题</TableHead>
            <TableHead>来源</TableHead>
            <TableHead className="text-right">收藏数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => (
            <TableRow key={article.feed_id}>
              <TableCell className="text-sm font-medium">
                {truncate(article.title, 60)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {article.source}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1 text-sm font-medium">
                  <Bookmark className="h-3.5 w-3.5 text-yellow-500" />
                  {article.bookmark_count}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --------------- Main Component ---------------

export function FeedInteractionsManager() {
  const [activeTab, setActiveTab] = useState<TabKey>("comments");

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "comments" && <CommentsTab />}
        {activeTab === "likes" && <LikesTab />}
        {activeTab === "bookmarks" && <BookmarksTab />}
      </CardContent>
    </Card>
  );
}
