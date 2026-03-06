import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LanguageManager } from "@/components/admin/LanguageManager";

export default function AdminPlatformSettings() {
  const [groqApiKey, setGroqApiKey] = useState("");
  const [showGroqApiKey, setShowGroqApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("category", "transcription")
        .eq("key", "config")
        .single();

      if (error) {
        console.log("No config found, using defaults");
        return;
      }

      if (data?.value) {
        const config = data.value as { provider?: string; model?: string };
        console.log("Loaded config:", config);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const handleTest = async () => {
    setIsLoading(true);
    try {
      if (!groqApiKey) {
        throw new Error("请先输入 Groq API Key");
      }

      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error("API Key 无效或网络错误");
      }

      toast.success("连接测试成功", {
        description: "Groq Whisper 配置正确",
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("连接测试失败", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (groqApiKey && groqApiKey.startsWith("gsk_")) {
        toast.info("API Key 需要通过密钥管理保存", {
          description: "为确保安全，请通过平台密钥管理系统保存 API Key",
        });
      }

      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          {
            category: "transcription",
            key: "config",
            value: { provider: "groq_whisper", model: "whisper-large-v3" },
            description: "语音转文字服务配置",
          },
          {
            onConflict: "category,key",
          },
        );

      if (error) throw error;

      toast.success("配置已保存");

      if (groqApiKey) {
        setGroqApiKey("");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("保存失败", {
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">平台设置</h1>
        <p className="text-muted-foreground mt-1">配置平台功能和服务</p>
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
                {showGroqApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              输入您的 Groq API Key 进行测试，保存后将通过平台密钥管理系统安全存储
            </p>
            <p className="text-xs text-muted-foreground">
              获取免费 API Key：
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                https://console.groq.com
              </a>
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleTest} disabled={isLoading || !groqApiKey} variant="outline">
              {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
              测试连接
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      <LanguageManager />
    </div>
  );
}
