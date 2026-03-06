import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { ShieldOff, Search, UserX } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface UserSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
}

export default function AdminBanManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");
  const [isBanning, setIsBanning] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults((data as UserSearchResult[]) || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("搜索失败", { description: err.message });
    } finally {
      setIsSearching(false);
    }
  };

  const openBanDialog = (user: UserSearchResult) => {
    setSelectedUser(user);
    setBanReason("");
    setBanDuration("permanent");
    setBanDialogOpen(true);
  };

  const handleBan = async () => {
    if (!selectedUser) return;
    setIsBanning(true);
    try {
      let expires_at: string | null = null;
      if (banDuration === "7d") {
        expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (banDuration === "30d") {
        expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data: { user: admin } } = await supabase.auth.getUser();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("bans")
        .insert({
          user_id: selectedUser.id,
          banned_by: admin?.id ?? null,
          reason: banReason || null,
          expires_at,
        });

      if (error) throw error;

      toast.success("封禁成功", {
        description: `已封禁用户 ${selectedUser.username || selectedUser.full_name}`,
      });
      setBanDialogOpen(false);
      setSearchResults([]);
      setSearchQuery("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("封禁失败", { description: err.message });
    } finally {
      setIsBanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">封禁管理</h1>
        <p className="text-muted-foreground mt-1">搜索用户并进行封禁操作</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5" />
            用户封禁管理
          </CardTitle>
          <CardDescription>搜索用户并进行封禁操作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="搜索用户名或昵称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching} variant="outline">
              {isSearching ? <LoadingSpinner size="sm" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-card"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {user.full_name || user.username || "未设置昵称"}
                    </p>
                    <p className="text-xs text-muted-foreground">@{user.username || user.id}</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => openBanDialog(user)}>
                    <UserX className="h-3.5 w-3.5 mr-1" />
                    封禁
                  </Button>
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <p className="text-sm text-muted-foreground text-center py-4">未找到匹配用户</p>
          )}
        </CardContent>

        <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                封禁用户：{selectedUser?.full_name || selectedUser?.username}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">封禁时长</label>
                <Select value={banDuration} onValueChange={setBanDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7 天</SelectItem>
                    <SelectItem value="30d">30 天</SelectItem>
                    <SelectItem value="permanent">永久</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">封禁原因（选填）</label>
                <Textarea
                  placeholder="请输入封禁原因..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleBan} disabled={isBanning}>
                {isBanning && <LoadingSpinner size="sm" className="mr-2" />}
                确认封禁
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
