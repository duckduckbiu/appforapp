import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Users, MessageSquare, Shield, FlaskConical } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useIdentity } from "@/contexts/IdentityContext";

const Index = () => {
  const navigate = useNavigate();
  const { currentIdentity, isLoading } = useIdentity();
  
  // 从 currentIdentity 获取 profile 信息
  const profile = currentIdentity?.profile;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  if (!currentIdentity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Bill.ai</CardTitle>
            <CardDescription className="text-center">
              AI 时代的应用工厂
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              安装一个 APP，通过 AI 或开发者生成无限定制应用。
            </p>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              开始使用
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background overflow-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
            <CardHeader>
              <CardTitle>欢迎回来，{profile?.display_name || profile?.unique_username}！</CardTitle>
              <CardDescription>
                您的应用工厂已准备就绪
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                探索应用商店、与好友聊天、发现精彩内容。
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/feed")}>
              <CardHeader>
                <Store className="h-8 w-8 text-primary mb-2" />
                <CardTitle>应用商店</CardTitle>
                <CardDescription>
                  发现和安装精彩应用
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  浏览应用
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/friends")}>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>好友系统</CardTitle>
                <CardDescription>
                  添加好友、发送消息
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  管理好友
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/conversations")}>
              <CardHeader>
                <MessageSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle>聊天功能</CardTitle>
                <CardDescription>
                  私聊、群聊
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  打开聊天
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20" onClick={() => navigate("/app/test-app")}>
              <CardHeader>
                <FlaskConical className="h-8 w-8 text-primary mb-2" />
                <CardTitle>SDK 测试应用</CardTitle>
                <CardDescription>
                  验证 iframe + SDK 通信
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  打开测试
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-amber-500/20" onClick={() => navigate("/setup-admin")}>
              <CardHeader>
                <Shield className="h-8 w-8 text-amber-500 mb-2" />
                <CardTitle>管理员设置</CardTitle>
                <CardDescription>
                  首次设置系统管理员
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  初始化管理员
                </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
