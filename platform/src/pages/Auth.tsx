import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MailCheck, ExternalLink, RefreshCw, ArrowLeft } from "lucide-react";

// ── 可配置常量（将来迁入后台设置） ──────────────────────────
const RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_MIN_LENGTH = 6;
// ──────────────────────────────────────────────────────────

/** 遮蔽邮箱地址 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

/** 根据邮箱域名返回对应的邮箱快捷链接 */
function getEmailProviderUrl(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  const providers: Record<string, string> = {
    "gmail.com": "https://mail.google.com",
    "googlemail.com": "https://mail.google.com",
    "outlook.com": "https://outlook.live.com",
    "hotmail.com": "https://outlook.live.com",
    "live.com": "https://outlook.live.com",
    "yahoo.com": "https://mail.yahoo.com",
    "qq.com": "https://mail.qq.com",
    "163.com": "https://mail.163.com",
    "126.com": "https://mail.126.com",
    "sina.com": "https://mail.sina.com.cn",
    "icloud.com": "https://www.icloud.com/mail",
  };
  return providers[domain] || null;
}

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 邮箱验证确认界面
  const [authView, setAuthView] = useState<"default" | "verify-email">("default");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // OAuth 独立加载状态
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  // ── 认证状态监听 ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate("/");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // ── 重新发送冷却倒计时 ──
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ── 注册 ──
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes("Password should not be in a common password list")) {
          throw new Error("此密码过于常见，已被泄露。请使用更强的密码以保护您的账号安全。");
        }
        if (error.message.includes("Password should be at least")) {
          throw new Error(`密码长度至少需要 ${PASSWORD_MIN_LENGTH} 位字符。`);
        }
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          throw new Error("该邮箱已被注册，请直接登录或使用其他邮箱。");
        }
        throw error;
      }

      // 切换到验证确认界面
      setRegisteredEmail(email);
      setAuthView("verify-email");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      toast.error(error.message || "注册失败");
    } finally {
      setIsLoading(false);
    }
  };

  // ── 登录 ──
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("邮箱或密码错误，请检查后重试。");
        }
        if (error.message.includes("Email not confirmed")) {
          // 跳转到验证确认界面
          setRegisteredEmail(email);
          setAuthView("verify-email");
          setResendCooldown(0); // 允许立即重新发送
          toast.info("邮箱尚未验证，请查看您的邮箱并点击验证链接。");
          return;
        }
        throw error;
      }

      toast.success("登录成功！");
    } catch (error: any) {
      toast.error(error.message || "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  // ── 重新发送验证邮件 ──
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: registeredEmail,
      });

      if (error) throw error;

      toast.success("验证邮件已重新发送");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      toast.error(error.message || "重新发送失败，请稍后重试");
    }
  };

  // ── Google OAuth ──
  const handleGoogleSignIn = async () => {
    setOauthLoading("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Google 登录失败");
      setOauthLoading(null);
    }
  };

  // ── Apple OAuth ──
  const handleAppleSignIn = async () => {
    setOauthLoading("apple");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Apple 登录失败");
      setOauthLoading(null);
    }
  };

  // ── 返回登录 ──
  const handleBackToLogin = () => {
    setAuthView("default");
    setEmail("");
    setPassword("");
  };

  const anyLoading = isLoading || oauthLoading !== null;

  // ── OAuth 按钮组（登录+注册 tab 共享） ──
  const oauthButtons = (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">或</span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={anyLoading}
          onClick={handleGoogleSignIn}
        >
          {oauthLoading === "google" ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          使用 Google 登录
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          disabled={anyLoading}
          onClick={handleAppleSignIn}
        >
          {oauthLoading === "apple" ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )}
          使用 Apple 登录
        </Button>
      </div>
    </>
  );

  // ── 渲染 ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      {authView === "verify-email" ? (
        /* ── 邮箱验证确认界面 ── */
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">验证邮件已发送</CardTitle>
            <CardDescription>
              我们已向{" "}
              <span className="font-medium text-foreground">{maskEmail(registeredEmail)}</span>{" "}
              发送了验证邮件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground space-y-2">
              <p>请按以下步骤完成注册：</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>打开您的邮箱</li>
                <li>找到来自 Bill.ai 的验证邮件</li>
                <li>点击邮件中的验证链接</li>
              </ol>
              <p className="text-xs mt-2">如果没有收到，请检查垃圾邮件文件夹。</p>
            </div>

            {getEmailProviderUrl(registeredEmail) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(getEmailProviderUrl(registeredEmail)!, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                打开邮箱
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full"
              disabled={resendCooldown > 0}
              onClick={handleResendVerification}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {resendCooldown > 0
                ? `重新发送 (${resendCooldown}s)`
                : "重新发送验证邮件"}
            </Button>

            <Button variant="link" className="w-full" onClick={handleBackToLogin}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ── 登录/注册表单 ── */
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Bill.ai</CardTitle>
            <CardDescription className="text-center">AI 时代的应用工厂</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">登录</TabsTrigger>
                <TabsTrigger value="signup">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">邮箱</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={anyLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">密码</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={anyLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={anyLoading}>
                    {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                    登录
                  </Button>
                </form>
                {oauthButtons}
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">邮箱</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={anyLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">密码</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      disabled={anyLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      密码至少需要 {PASSWORD_MIN_LENGTH} 位字符，请避免使用常见密码以保护账号安全
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={anyLoading}>
                    {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                    注册
                  </Button>
                </form>
                {oauthButtons}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
