import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useIdentity } from "@/contexts/IdentityContext"
import { toast } from "sonner"

export interface PromoterLink {
  id: string
  user_id: string
  code: string
  target_type: "platform" | "app" | "channel"
  target_id: string | null
  click_count: number
  register_count: number
  revenue_total: number
  created_at: string
}

export interface CreatePromoterLinkParams {
  target_type: "platform" | "app" | "channel"
  target_id?: string
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

// ─── useMyPromoterLinks ───────────────────────────────────────────────────────

export function useMyPromoterLinks() {
  const { currentIdentity } = useIdentity()
  const userId = currentIdentity?.profile?.id

  return useQuery({
    queryKey: ["promoter-links", userId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("promoter_links")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data as PromoterLink[]) ?? []
    },
    enabled: !!userId,
  })
}

// ─── useCreatePromoterLink ────────────────────────────────────────────────────

export function useCreatePromoterLink() {
  const queryClient = useQueryClient()
  const { currentIdentity } = useIdentity()

  return useMutation({
    mutationFn: async (params: CreatePromoterLinkParams) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("未登录")

      const code = generateCode()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("promoter_links")
        .insert({
          user_id: user.id,
          code,
          target_type: params.target_type,
          target_id: params.target_id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data as PromoterLink
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoter-links", currentIdentity?.profile?.id] })
      toast.success("推广链接已创建")
    },
    onError: (error: Error) => {
      toast.error("创建失败", { description: error.message })
    },
  })
}

// ─── useDeletePromoterLink ────────────────────────────────────────────────────

export function useDeletePromoterLink() {
  const queryClient = useQueryClient()
  const { currentIdentity } = useIdentity()

  return useMutation({
    mutationFn: async (linkId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("promoter_links")
        .delete()
        .eq("id", linkId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoter-links", currentIdentity?.profile?.id] })
      toast.success("推广链接已删除")
    },
    onError: (error: Error) => {
      toast.error("删除失败", { description: error.message })
    },
  })
}

// ─── Helper: build promoter URL ───────────────────────────────────────────────

export function buildPromoterUrl(link: PromoterLink): string {
  const base = `${window.location.origin}/r/${link.code}`
  if (link.target_type === "app" && link.target_id) {
    return `${base}?app=${link.target_id}`
  }
  if (link.target_type === "channel" && link.target_id) {
    return `${base}?channel=${link.target_id}`
  }
  return base
}
