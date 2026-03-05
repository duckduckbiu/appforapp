import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DollarSign, Code2, Radio, TrendingUp } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useIdentity } from "@/contexts/IdentityContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleEarning {
  user_id: string
  role: string
  period: string
  total_amount: number
  transaction_count: number
  updated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MICRO_USDC = 1_000_000

function toUSDC(microUsdc: number): string {
  return (microUsdc / MICRO_USDC).toFixed(2)
}

// Last 6 months (descending)
function last6Months(): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    months.push(`${y}-${m}`)
    d.setMonth(d.getMonth() - 1)
  }
  return months
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useMyEarnings(userId: string | undefined) {
  return useQuery({
    queryKey: ["role-earnings", userId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("role_earnings")
        .select("*")
        .eq("user_id", userId)
        .order("period", { ascending: false })

      if (error) throw error
      return (data as RoleEarning[]) ?? []
    },
    enabled: !!userId,
  })
}

// ─── Role Tab ─────────────────────────────────────────────────────────────────

interface RoleTabProps {
  rows: RoleEarning[]
}

function RoleTab({ rows }: RoleTabProps) {
  const months = useMemo(() => last6Months(), [])

  const totalAmount = rows.reduce((sum, r) => sum + r.total_amount, 0)
  const thisMonth = months[0]
  const thisMonthRow = rows.find((r) => r.period === thisMonth)
  const thisMonthAmount = thisMonthRow?.total_amount ?? 0

  // Align rows to the last 6 months (pad missing months)
  const aligned = months.map((period) => {
    const match = rows.find((r) => r.period === period)
    return {
      period,
      total_amount: match?.total_amount ?? 0,
      transaction_count: match?.transaction_count ?? 0,
    }
  })

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本月收益</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{toUSDC(thisMonthAmount)} <span className="text-sm font-normal text-muted-foreground">USDC</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">累计收益</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{toUSDC(totalAmount)} <span className="text-sm font-normal text-muted-foreground">USDC</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>月份</TableHead>
              <TableHead className="text-right">收益 (USDC)</TableHead>
              <TableHead className="text-right">交易数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aligned.map((row) => (
              <TableRow key={row.period}>
                <TableCell className="font-medium">{row.period}</TableCell>
                <TableCell className="text-right">
                  {row.total_amount > 0
                    ? toUSDC(row.total_amount)
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {row.transaction_count > 0
                    ? row.transaction_count
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Earnings() {
  const { currentIdentity } = useIdentity()
  const userId = currentIdentity?.profile?.id

  const { data: allEarnings = [], isLoading } = useMyEarnings(userId)

  const developerRows = allEarnings.filter((r) => r.role === "developer")
  const channelRows   = allEarnings.filter((r) => r.role === "channel_owner")
  const promoterRows  = allEarnings.filter((r) => r.role === "promoter")

  const hasDeveloper = developerRows.length > 0
  const hasChannel   = channelRows.length > 0
  const hasPromoter  = promoterRows.length > 0
  const hasAny       = hasDeveloper || hasChannel || hasPromoter

  const defaultTab = hasDeveloper ? "developer" : hasChannel ? "channel" : "promoter"

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">收益统计</h1>
          <p className="text-muted-foreground mt-2">查看您作为开发者、频道主或推广者的收益记录</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && !hasAny && (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">暂无收益记录</p>
              <p className="text-xs text-muted-foreground mt-1">
                发布应用、创建频道或分享推广链接后即可获得收益
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && hasAny && (
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              {hasDeveloper && (
                <TabsTrigger value="developer" className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" />
                  开发者
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {developerRows.length}
                  </Badge>
                </TabsTrigger>
              )}
              {hasChannel && (
                <TabsTrigger value="channel" className="flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5" />
                  频道主
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {channelRows.length}
                  </Badge>
                </TabsTrigger>
              )}
              {hasPromoter && (
                <TabsTrigger value="promoter" className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  推广者
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {promoterRows.length}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>

            {hasDeveloper && (
              <TabsContent value="developer" className="mt-6">
                <RoleTab rows={developerRows} />
              </TabsContent>
            )}
            {hasChannel && (
              <TabsContent value="channel" className="mt-6">
                <RoleTab rows={channelRows} />
              </TabsContent>
            )}
            {hasPromoter && (
              <TabsContent value="promoter" className="mt-6">
                <RoleTab rows={promoterRows} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}
