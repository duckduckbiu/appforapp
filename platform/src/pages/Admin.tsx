import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Eye, EyeOff, ShieldOff, Search, UserX } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// ─── Ban management sub-component ────────────────────────────────────────────

interface UserSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
}

function BanManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState("permanent")
  const [isBanning, setIsBanning] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(10)

      if (error) throw error
      setSearchResults((data as UserSearchResult[]) || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("搜索失败", { description: err.message })
    } finally {
      setIsSearching(false)
    }
  }

  const openBanDialog = (user: UserSearchResult) => {
    setSelectedUser(user)
    setBanReason("")
    setBanDuration("permanent")
    setBanDialogOpen(true)
  }

  const handleBan = async () => {
    if (!selectedUser) return
    setIsBanning(true)
    try {
      let expires_at: string | null = null
      if (banDuration === "7d") {
        expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      } else if (banDuration === "30d") {
        expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      const { data: { user: admin } } = await supabase.auth.getUser()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("bans")
        .insert({
          user_id: selectedUser.id,
          banned_by: admin?.id ?? null,
          reason: banReason || null,
          expires_at,
        })

      if (error) throw error

      toast.success("封禁成功", {
        description: `已封禁用户 ${selectedUser.username || selectedUser.full_name}`,
      })
      setBanDialogOpen(false)
      setSearchResults([])
      setSearchQuery("")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("封禁失败", { description: err.message })
    } finally {
      setIsBanning(false)
    }
  }

  return (
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
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openBanDialog(user)}
                >
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
  )
}

// ─── Main Admin page ──────────────────────────────────────────────────────────

const Admin = () => {
  const [groqApiKey, setGroqApiKey] = useState("")
  const [showGroqApiKey, setShowGroqApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    checkAdminRole()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadConfig()
    }
  }, [isAdmin])

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsAdmin(false)
      return
    }

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    setIsAdmin(!!data)
  }

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('category', 'transcription')
        .eq('key', 'config')
        .single()

      if (error) {
        console.log('No config found, using defaults')
        return
      }

      if (data?.value) {
        const config = data.value as { provider?: string; model?: string }
        console.log('Loaded config:', config)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const handleTest = async () => {
    setIsLoading(true)
    try {
      if (!groqApiKey) {
        throw new Error('请先输入 Groq API Key')
      }

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
        }
      })

      if (!response.ok) {
        throw new Error('API Key 无效或网络错误')
      }

      toast.success("连接测试成功", {
        description: "Groq Whisper 配置正确"
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("连接测试失败", {
        description: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (groqApiKey && groqApiKey.startsWith('gsk_')) {
        toast.info("API Key 需要通过密钥管理保存", {
          description: "为确保安全，请通过平台密钥管理系统保存 API Key"
        })
      }

      // 保存配置到 platform_settings
      const { error } = await supabase
        .from('platform_settings')
        .upsert(
          {
            category: 'transcription',
            key: 'config',
            value: { provider: 'groq_whisper', model: 'whisper-large-v3' },
            description: '语音转文字服务配置'
          },
          {
            onConflict: 'category,key'
          }
        )

      if (error) throw error

      toast.success("配置已保存")

      // 清空输入框中的 API Key（因为实际存储在密钥管理中）
      if (groqApiKey) {
        setGroqApiKey("")
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("保存失败", {
        description: error.message
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isAdmin === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>无权限访问</CardTitle>
            <CardDescription>
              您没有管理员权限，无法访问此页面
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">平台管理</h1>
          <p className="text-muted-foreground mt-2">配置平台功能和服务</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>语音转文字配置</CardTitle>
            <CardDescription>
              使用 Groq Whisper API 提供免费高速的语音转文字服务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">服务提供商</label>
              <div className="p-3 rounded-md bg-muted">
                <p className="text-sm font-medium">Groq Whisper (免费高速)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  使用 whisper-large-v3 模型，免费额度：每分钟 30 次请求
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Groq API Key</label>
              <div className="relative">
                <Input
                  type={showGroqApiKey ? "text" : "password"}
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGroqApiKey(!showGroqApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGroqApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                输入您的 Groq API Key 进行测试，保存后将通过平台密钥管理系统安全存储
              </p>
              <p className="text-xs text-muted-foreground">
                获取免费 API Key：<a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://console.groq.com</a>
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleTest}
                disabled={isLoading || !groqApiKey}
                variant="outline"
              >
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                测试连接
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>

        <BanManagement />
      </div>
    </div>
  )
}

export default Admin
