import { useState } from "react"
import { TrendingUp, Plus, Copy, Trash2, Globe, Package, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  useMyPromoterLinks,
  useCreatePromoterLink,
  useDeletePromoterLink,
  buildPromoterUrl,
  type PromoterLink,
} from "@/hooks/usePromoterLinks"
import { useApps } from "@/hooks/useApps"
import { useChannels } from "@/hooks/useChannels"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// ─── Link Card ────────────────────────────────────────────────────────────────

function LinkCard({ link }: { link: PromoterLink }) {
  const deleteLink = useDeletePromoterLink()
  const url = buildPromoterUrl(link)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success("链接已复制")
  }

  const typeIcon = link.target_type === "app"
    ? <Package className="h-4 w-4 text-primary" />
    : link.target_type === "channel"
    ? <Radio className="h-4 w-4 text-primary" />
    : <Globe className="h-4 w-4 text-primary" />

  const typeLabel = link.target_type === "app"
    ? "应用推广"
    : link.target_type === "channel"
    ? "频道推广"
    : "平台推广"

  const earnings = (link.revenue_total / 1_000_000).toFixed(2)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {typeIcon}
            <div className="min-w-0">
              <p className="text-sm font-medium">{typeLabel}</p>
              <p className="text-xs text-muted-foreground truncate">{url}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => deleteLink.mutate(link.id)}
              disabled={deleteLink.isPending}
            >
              {deleteLink.isPending
                ? <LoadingSpinner size="sm" />
                : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>点击 {link.click_count.toLocaleString()}</span>
          <span>注册 {link.register_count.toLocaleString()} 人</span>
          <span>收益 {earnings} USDC</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Create Link Dialog ───────────────────────────────────────────────────────

function CreateLinkDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [targetType, setTargetType] = useState<"platform" | "app" | "channel">("platform")
  const [targetId, setTargetId] = useState("")

  const createLink = useCreatePromoterLink()
  const { data: apps = [] } = useApps()
  const { data: channels = [] } = useChannels()

  const handleCreate = async () => {
    await createLink.mutateAsync({
      target_type: targetType,
      target_id: targetType !== "platform" ? (targetId || undefined) : undefined,
    })
    onOpenChange(false)
    setTargetType("platform")
    setTargetId("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建推广链接</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">推广类型</label>
            <Select value={targetType} onValueChange={(v) => {
              setTargetType(v as "platform" | "app" | "channel")
              setTargetId("")
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">平台推广（通用）</SelectItem>
                <SelectItem value="app">应用推广</SelectItem>
                <SelectItem value="channel">频道推广</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetType === "app" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">选择应用</label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要推广的应用" />
                </SelectTrigger>
                <SelectContent>
                  {apps.map((app) => (
                    <SelectItem key={app.id} value={app.slug}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {targetType === "channel" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">选择频道</label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要推广的频道" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createLink.isPending || (targetType !== "platform" && !targetId)}
          >
            {createLink.isPending && <LoadingSpinner size="sm" className="mr-2" />}
            创建链接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PromoterCenter = () => {
  const [createOpen, setCreateOpen] = useState(false)
  const { data: links = [], isLoading } = useMyPromoterLinks()

  const totalClicks = links.reduce((s, l) => s + l.click_count, 0)
  const totalRegisters = links.reduce((s, l) => s + l.register_count, 0)
  const totalEarnings = links.reduce((s, l) => s + l.revenue_total, 0)

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-7 w-7" />
              推广中心
            </h1>
            <p className="text-muted-foreground mt-1">
              生成推广链接，追踪注册量和收益
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建推广链接
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">总点击量</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{totalRegisters.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">注册用户</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {(totalEarnings / 1_000_000).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">累计收益 USDC</p>
            </CardContent>
          </Card>
        </div>

        {/* Link list */}
        <div>
          <h2 className="text-lg font-semibold mb-3">我的推广链接</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : links.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>还没有推广链接</p>
                <p className="text-sm mt-1">点击右上角「创建推广链接」开始推广</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {links.map((link) => (
                <LinkCard key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateLinkDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

export default PromoterCenter
