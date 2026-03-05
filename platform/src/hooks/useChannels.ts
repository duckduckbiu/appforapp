import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIdentity } from "@/contexts/IdentityContext";

export interface Channel {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon_url?: string;
  owner_id: string;
  member_count: number;
  is_public: boolean;
  created_at: string;
}

export interface ChannelWithApps extends Channel {
  channel_apps: Array<{
    app_id: string;
    added_at: string;
    apps: {
      id: string;
      slug: string;
      name: string;
      icon_url?: string;
      version: string;
      install_count: number;
    };
  }>;
  channel_members: Array<{
    user_id: string;
    role: string;
    joined_at: string;
    profiles: {
      id: string;
      username?: string;
      full_name?: string;
      avatar_url?: string;
    };
  }>;
}

// ─── Public channel list ───────────────────────────────────────────────────

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("channels")
        .select("*")
        .eq("is_public", true)
        .order("member_count", { ascending: false });
      if (error) throw error;
      return (data as Channel[]) || [];
    },
  });
}

// ─── Single channel detail ─────────────────────────────────────────────────

export function useChannel(slug: string | undefined) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("channels")
        .select(`
          *,
          channel_apps (
            app_id,
            added_at,
            apps ( id, slug, name, icon_url, version, install_count )
          ),
          channel_members (
            user_id,
            role,
            joined_at,
            profiles ( id, username, full_name, avatar_url )
          )
        `)
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data as ChannelWithApps;
    },
    enabled: !!slug,
  });
}

// ─── Channels the current user has joined ─────────────────────────────────

export function useMyChannels() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["my-channels", userId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("channel_members")
        .select("channel_id, role, joined_at, channels(*)")
        .eq("user_id", userId);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        ...row.channels,
        myRole: row.role,
        joinedAt: row.joined_at,
      })) as (Channel & { myRole: string; joinedAt: string })[];
    },
    enabled: !!userId,
  });
}

// ─── Check membership ─────────────────────────────────────────────────────

export function useChannelMembership(channelId: string | undefined) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["channel-membership", channelId, userId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("channel_members")
        .select("role")
        .eq("channel_id", channelId)
        .eq("user_id", userId)
        .maybeSingle();
      return data as { role: string } | null;
    },
    enabled: !!channelId && !!userId,
  });
}

// ─── Create channel ────────────────────────────────────────────────────────

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();

  return useMutation({
    mutationFn: async (params: { name: string; slug: string; description?: string }) => {
      const userId = currentIdentity?.profile?.id;
      if (!userId) throw new Error("未登录");

      // Get auth user id for the owner_id FK (references auth.users)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: channel, error: channelError } = await (supabase as any)
        .from("channels")
        .insert({
          slug: params.slug,
          name: params.name,
          description: params.description || null,
          owner_id: user.id,
        })
        .select()
        .single();
      if (channelError) throw channelError;

      // Automatically join as owner
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: memberError } = await (supabase as any)
        .from("channel_members")
        .insert({ channel_id: channel.id, user_id: user.id, role: "owner" });
      if (memberError) throw memberError;

      return channel as Channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["my-channels"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "创建失败", description: error.message });
    },
  });
}

// ─── Join channel ──────────────────────────────────────────────────────────

export function useJoinChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("channel_members")
        .insert({ channel_id: channelId, user_id: user.id, role: "member" });
      if (error) throw error;
    },
    onSuccess: (_data, channelId) => {
      queryClient.invalidateQueries({ queryKey: ["my-channels"] });
      queryClient.invalidateQueries({ queryKey: ["channel-membership", channelId] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "加入成功" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "加入失败", description: error.message });
    },
  });
}

// ─── Leave channel ─────────────────────────────────────────────────────────

export function useLeaveChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("channel_members")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_data, channelId) => {
      queryClient.invalidateQueries({ queryKey: ["my-channels"] });
      queryClient.invalidateQueries({ queryKey: ["channel-membership", channelId] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "已退出频道" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "退出失败", description: error.message });
    },
  });
}

// ─── Add app to channel ────────────────────────────────────────────────────

export function useAddChannelApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, appId }: { channelId: string; appId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("channel_apps")
        .insert({ channel_id: channelId, app_id: appId, added_by: user?.id });
      if (error) throw error;
    },
    onSuccess: (_data, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["channel", channelId] });
      toast({ title: "应用已添加到频道" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "添加失败", description: error.message });
    },
  });
}

// ─── Remove app from channel ───────────────────────────────────────────────

export function useRemoveChannelApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, appId }: { channelId: string; appId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("channel_apps")
        .delete()
        .eq("channel_id", channelId)
        .eq("app_id", appId);
      if (error) throw error;
    },
    onSuccess: (_data, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["channel", channelId] });
      toast({ title: "已移除应用" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "移除失败", description: error.message });
    },
  });
}
