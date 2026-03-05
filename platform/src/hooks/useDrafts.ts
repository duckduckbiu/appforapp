import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

export interface DraftMediaItem {
  url: string;
  type: "image" | "video";
}

export interface Draft {
  id: string;
  user_id: string;
  content: string | null;
  visibility: string;
  media_data: DraftMediaItem[];
  unlock_settings: Json | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export function useDrafts() {
  const { currentIdentity } = useIdentity();
  const queryClient = useQueryClient();

  const draftsQuery = useQuery({
    queryKey: ["drafts", currentIdentity?.profile?.id],
    queryFn: async () => {
      if (!currentIdentity?.profile?.id) return [];

      const { data, error } = await supabase
        .from("post_drafts")
        .select("*")
        .eq("user_id", currentIdentity.profile.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      
      // Transform media_data from Json to DraftMediaItem[]
      return (data || []).map((d) => ({
        ...d,
        media_data: Array.isArray(d.media_data) ? (d.media_data as unknown as DraftMediaItem[]) : [],
      })) as Draft[];
    },
    enabled: !!currentIdentity?.profile?.id,
    staleTime: 1000 * 60 * 5,
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (draft: {
      content?: string;
      visibility?: string;
      mediaData?: DraftMediaItem[];
      unlockSettings?: Json;
      locationName?: string;
      latitude?: number;
      longitude?: number;
      draftId?: string;
    }) => {
      if (!currentIdentity?.profile?.id) {
        throw new Error("未登录");
      }

      const draftData = {
        user_id: currentIdentity.profile.id,
        content: draft.content || null,
        visibility: draft.visibility || "public",
        media_data: (draft.mediaData || []) as unknown as Json,
        unlock_settings: draft.unlockSettings || null,
        location_name: draft.locationName || null,
        latitude: draft.latitude || null,
        longitude: draft.longitude || null,
      };

      if (draft.draftId) {
        // 更新现有草稿
        const { data, error } = await supabase
          .from("post_drafts")
          .update(draftData)
          .eq("id", draft.draftId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // 创建新草稿
        const { data, error } = await supabase
          .from("post_drafts")
          .insert(draftData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast({ title: "草稿已保存" });
    },
    onError: (error) => {
      console.error("Save draft error:", error);
      toast({
        variant: "destructive",
        title: "保存草稿失败",
      });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("post_drafts")
        .delete()
        .eq("id", draftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast({ title: "草稿已删除" });
    },
    onError: (error) => {
      console.error("Delete draft error:", error);
      toast({
        variant: "destructive",
        title: "删除草稿失败",
      });
    },
  });

  return {
    drafts: draftsQuery.data || [],
    isLoading: draftsQuery.isLoading,
    saveDraft: saveDraftMutation.mutate,
    isSaving: saveDraftMutation.isPending,
    deleteDraft: deleteDraftMutation.mutate,
    isDeleting: deleteDraftMutation.isPending,
  };
}
