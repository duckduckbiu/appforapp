import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIdentity } from "@/contexts/IdentityContext";

export type ReportTargetType = "post" | "comment" | "user" | "message" | "app";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "violence" | "copyright" | "other";
export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  created_at: string;
}

interface CreateReportParams {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export function useReports() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();

  // 获取用户的举报列表
  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports", currentIdentity?.profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Report[];
    },
    enabled: !!currentIdentity?.profile?.id,
  });

  // 创建举报
  const createReport = useMutation({
    mutationFn: async (params: CreateReportParams) => {
      if (!currentIdentity?.profile?.id) {
        throw new Error("未登录");
      }

      const { data, error } = await supabase
        .from("reports")
        .insert({
          reporter_id: currentIdentity.profile.id,
          target_type: params.targetType,
          target_id: params.targetId,
          reason: params.reason,
          description: params.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast({ title: "举报已提交", description: "我们会尽快处理" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "举报失败",
        description: error.message,
      });
    },
  });

  return {
    reports,
    isLoading,
    createReport: createReport.mutate,
    isCreating: createReport.isPending,
  };
}
