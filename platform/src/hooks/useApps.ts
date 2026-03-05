import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────

export interface App {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  manifest_url: string;
  developer_id: string | null;
  version: string;
  status: "draft" | "pending" | "approved" | "rejected";
  age_rating: string;
  is_free: boolean;
  price_credits: number;
  install_count: number;
  /** Application category (from Phase 2 migration) */
  app_category: "general" | "game" | "social" | "tool" | "adult" | "gambling" | "finance";
  /** True for platform-published apps (shown with 官方 badge) */
  is_official: boolean;
  /** True for apps highlighted in the 推荐 tab */
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────

/** 查询所有已审核（approved）的应用列表 */
export function useApps() {
  return useQuery({
    queryKey: ["apps"],
    queryFn: async (): Promise<App[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("apps")
        .select("*")
        .eq("status", "approved")
        .order("install_count", { ascending: false });

      if (error) throw error;
      return (data as App[]) || [];
    },
  });
}

/** 根据 slug 查询单个应用 */
export function useApp(slug: string | undefined) {
  return useQuery({
    queryKey: ["app", slug],
    queryFn: async (): Promise<App | null> => {
      if (!slug) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("apps")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return (data as App) || null;
    },
    enabled: !!slug,
  });
}

/** 查询当前用户已安装的 app_id 集合 */
export function useInstalledApps() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["installed-apps", userId],
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_installed_apps")
        .select("app_id")
        .eq("user_id", userId);

      if (error) throw error;
      return new Set((data as { app_id: string }[]).map((r) => r.app_id));
    },
    enabled: !!userId,
  });
}

/** 安装应用 */
export function useInstallApp() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async (appId: string) => {
      if (!userId) throw new Error("请先登录");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("user_installed_apps")
        .insert({ user_id: userId, app_id: appId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installed-apps", userId] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("安装成功");
    },
    onError: (error: Error) => {
      toast.error("安装失败", { description: error.message });
    },
  });
}

/** 卸载应用 */
export function useUninstallApp() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async (appId: string) => {
      if (!userId) throw new Error("请先登录");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("user_installed_apps")
        .delete()
        .eq("user_id", userId)
        .eq("app_id", appId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installed-apps", userId] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("已卸载");
    },
    onError: (error: Error) => {
      toast.error("卸载失败", { description: error.message });
    },
  });
}
