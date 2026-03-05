import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Radio, Users, Package, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useChannel,
  useChannelMembership,
  useJoinChannel,
  useLeaveChannel,
  useAddChannelApp,
  useRemoveChannelApp,
} from "@/hooks/useChannels";
import { useInstalledApps } from "@/hooks/useApps";
import { useIdentity } from "@/contexts/IdentityContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// ─── Add App Dialog ────────────────────────────────────────────────────────

function AddAppDialog({
  channelId,
  existingAppIds,
  open,
  onOpenChange,
}: {
  channelId: string;
  existingAppIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: installedSet } = useInstalledApps();
  const addApp = useAddChannelApp();

  // installedSet is Set<app_id> but we need the full app list — use useApps
  // We rely on the installed apps query returning ids; show all installed apps not already in channel
  const installedIds = installedSet ? Array.from(installedSet) : [];
  const availableIds = installedIds.filter((id) => !existingAppIds.includes(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加应用到频道</DialogTitle>
        </DialogHeader>
        {availableIds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            没有可添加的应用。请先在应用商店安装应用。
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableIds.map((appId) => (
              <div
                key={appId}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <span className="text-sm font-mono text-xs text-muted-foreground truncate">{appId}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addApp.mutate({ channelId, appId }, { onSuccess: () => onOpenChange(false) });
                  }}
                  disabled={addApp.isPending}
                >
                  {addApp.isPending ? <LoadingSpinner size="sm" /> : "添加"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ChannelDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  const { data: channel, isLoading, isError } = useChannel(slug);
  const { data: membership } = useChannelMembership(channel?.id);
  const joinChannel = useJoinChannel();
  const leaveChannel = useLeaveChannel();
  const removeApp = useRemoveChannelApp();
  const [addAppOpen, setAddAppOpen] = useState(false);

  const isOwner = membership?.role === "owner";
  const isMember = !!membership;

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Radio className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold mb-2">频道未找到</h2>
          <Button asChild variant="outline">
            <Link to="/my-channels">返回我的频道</Link>
          </Button>
        </div>
      </div>
    );
  }

  const apps = channel.channel_apps || [];
  const members = channel.channel_members || [];
  const existingAppIds = apps.map((a) => a.app_id);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>

        {/* Channel header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {channel.icon_url ? (
              <img src={channel.icon_url} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              <Radio className="h-8 w-8 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            {channel.description && (
              <p className="text-muted-foreground text-sm mt-1">{channel.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <Users className="h-3 w-3 inline mr-1" />
              {channel.member_count} 名成员
            </p>
          </div>
          {userId && (
            <div className="shrink-0">
              {isMember ? (
                !isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => leaveChannel.mutate(channel.id)}
                    disabled={leaveChannel.isPending}
                  >
                    {leaveChannel.isPending ? <LoadingSpinner size="sm" /> : "退出频道"}
                  </Button>
                )
              ) : (
                <Button
                  size="sm"
                  onClick={() => joinChannel.mutate(channel.id)}
                  disabled={joinChannel.isPending}
                >
                  {joinChannel.isPending ? <LoadingSpinner size="sm" /> : "加入频道"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="apps">
          <TabsList className="mb-4">
            <TabsTrigger value="apps">
              <Package className="h-4 w-4 mr-1.5" />
              应用 ({apps.length})
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-1.5" />
              成员 ({members.length})
            </TabsTrigger>
          </TabsList>

          {/* Apps Tab */}
          <TabsContent value="apps">
            {isOwner && (
              <div className="mb-4">
                <Button size="sm" onClick={() => setAddAppOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  添加应用
                </Button>
              </div>
            )}
            {apps.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>此频道还没有应用</p>
                {isOwner && (
                  <p className="text-sm mt-1">点击"添加应用"从已安装应用中选择</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {apps.map((ca) => (
                  <div
                    key={ca.app_id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {ca.apps.icon_url ? (
                        <img src={ca.apps.icon_url} alt={ca.apps.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ca.apps.name}</p>
                      <p className="text-xs text-muted-foreground">v{ca.apps.version}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => navigate(`/app/${ca.apps.slug}`)}
                      >
                        打开
                      </Button>
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeApp.mutate({ channelId: channel.id, appId: ca.app_id })}
                          disabled={removeApp.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            {members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>暂无成员信息</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => {
                  const profile = m.profiles;
                  const displayName = profile?.full_name || profile?.username || "用户";
                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback>
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayName}</p>
                        {profile?.username && (
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        )}
                      </div>
                      {m.role === "owner" && (
                        <span className="text-xs text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">
                          频道主
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {isOwner && (
        <AddAppDialog
          channelId={channel.id}
          existingAppIds={existingAppIds}
          open={addAppOpen}
          onOpenChange={setAddAppOpen}
        />
      )}
    </div>
  );
}
