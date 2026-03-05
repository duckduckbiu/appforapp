import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Shield, CheckCircle2, AlertCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

const SetupAdmin = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasAdmin, setHasAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    setIsLoading(true)
    try {
      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("请先登录")
        navigate("/auth")
        return
      }
      setCurrentUser(user)

      // 检查是否已有管理员
      const { data: adminRoles, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .limit(1)

      if (error) {
        console.error('检查管理员状态失败:', error)
        toast.error("检查管理员状态失败")
        return
      }

      setHasAdmin(adminRoles && adminRoles.length > 0)
    } catch (error) {
      console.error('检查管理员状态失败:', error)
      toast.error("检查管理员状态失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupAdmin = async () => {
    if (!currentUser) {
      toast.error("用户信息不可用")
      return
    }

    setIsSettingUp(true)
    try {
      // 调用安全函数设置第一个管理员
      const { error } = await supabase.rpc('setup_first_admin', {
        _user_id: currentUser.id
      })

      if (error) {
        throw error
      }

      toast.success("成功设置为管理员！", {
        description: "您现在可以访问管理页面了"
      })

      // 刷新状态
      await checkAdminStatus()
      
      // 3秒后跳转到管理页面
      setTimeout(() => {
        navigate("/admin")
      }, 3000)
    } catch (error: any) {
      console.error('设置管理员失败:', error)
      toast.error("设置管理员失败", {
        description: error.message
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoadingSpinner size="sm" />
          <span>检查系统状态...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>管理员初始化</CardTitle>
          </div>
          <CardDescription>
            设置系统的第一个管理员账号
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasAdmin ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-500">系统已初始化</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    系统已经有管理员了，此页面仅供首次设置使用
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => navigate("/")}
                className="w-full"
              >
                返回首页
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">未检测到管理员</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    系统还没有管理员，您可以将当前账号设置为管理员
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-4 rounded-lg bg-muted">
                <p className="text-sm font-medium">当前用户信息</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>邮箱: {currentUser?.email}</p>
                  <p>用户ID: {currentUser?.id}</p>
                </div>
              </div>

              <Button 
                onClick={handleSetupAdmin}
                disabled={isSettingUp}
                className="w-full"
              >
                {isSettingUp && <LoadingSpinner size="sm" className="mr-2" />}
                将我设置为管理员
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                此操作仅在首次设置时可用，设置后此页面将无法再次使用
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SetupAdmin
