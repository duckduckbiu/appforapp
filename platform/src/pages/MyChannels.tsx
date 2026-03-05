import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Plus, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  useMyChannels,
  useCreateChannel,
  useLeaveChannel,
  type Channel,
} from "@/hooks/useChannels";
import { useIdentity } from "@/contexts/IdentityContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// ─── Channel Card ──────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  myRole,
}: {
  channel: Channel & { myRole: string };
  myRole: string;
}) {
  const navigate = useNavigate();
  const leaveChannel = useLeaveChannel();
  const isOwner = myRole === "owner";

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {channel.icon_url ? (
              <img
                src={channel.icon_url}
                alt={channel.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Radio className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{channel.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3 inline mr-1" />
              {channel.member_count} 名成员
              {isOwner && <span className="ml-2 text-primary">· 频道主</span>}
            </p>
          </div>
        </div>

        {channel.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {channel.description}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/channel/${channel.slug}`)}
          >
            查看
          </Button>
          {!isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => leaveChannel.mutate(channel.id)}
              disabled={leaveChannel.isPending}
            >
              {leaveChannel.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────

function ChannelCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

// ─── Create Channel Sheet ──────────────────────────────────────────────────

function CreateChannelSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const createChannel = useCreateChannel();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const handleNameChange = (v: string) => {
    setName(v);
    // Auto-generate slug from name (lowercase, replace spaces/special chars with -)
    setSlug(
      v
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) return;
    createChannel.mutate(
      { name: name.trim(), slug: slug.trim(), description: description.trim() || undefined },
      {
        onSuccess: (channel) => {
          onOpenChange(false);
          setName("");
          setSlug("");
          setDescription("");
          navigate(`/channel/${channel.slug}`);
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>创建频道</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">频道名称 *</label>
            <Input
              placeholder="我的频道"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">频道标识 (slug) *</label>
            <Input
              placeholder="my-channel"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              仅支持字母、数字和连字符，全局唯一
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">频道描述（选填）</label>
            <Textarea
              placeholder="介绍一下你的频道..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <SheetFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !slug.trim() || createChannel.isPending}
            className="w-full"
          >
            {createChannel.isPending && <LoadingSpinner size="sm" className="mr-2" />}
            创建频道
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MyChannels() {
  const { data: channels, isLoading } = useMyChannels();
  const { currentIdentity } = useIdentity();
  const isLoggedIn = !!currentIdentity?.profile?.id;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">我的频道</h1>
              <p className="text-sm text-muted-foreground">管理和加入频道</p>
            </div>
          </div>
          {isLoggedIn && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              创建频道
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ChannelCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Not logged in */}
        {!isLoggedIn && (
          <div className="text-center py-16 text-muted-foreground">
            <Radio className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">请先登录</p>
            <p className="text-sm mt-1">登录后可查看和管理频道</p>
          </div>
        )}

        {/* Empty */}
        {isLoggedIn && !isLoading && channels?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Radio className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">还没有加入任何频道</p>
            <p className="text-sm mt-1">创建一个或前往应用商店发现频道</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              创建频道
            </Button>
          </div>
        )}

        {/* Channel grid */}
        {!isLoading && channels && channels.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} myRole={ch.myRole} />
            ))}
          </div>
        )}
      </div>

      <CreateChannelSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
