import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Globe, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  usePlatformLanguages,
  useToggleLanguage,
  useUpdateLanguageOrder,
  type PlatformLanguage,
} from "@/hooks/usePlatformLanguages";

export function LanguageManager() {
  const { data: languages, isLoading } = usePlatformLanguages();
  const toggleMutation = useToggleLanguage();
  const orderMutation = useUpdateLanguageOrder();

  const [enabledCount, setEnabledCount] = useState<number | null>(null);

  const handleToggle = (lang: PlatformLanguage) => {
    toggleMutation.mutate(
      { code: lang.code, enabled: !lang.is_enabled },
      {
        onSuccess: () => toast.success(`${lang.flag} ${lang.label_native} ${!lang.is_enabled ? "已启用" : "已禁用"}`),
        onError: () => toast.error("操作失败"),
      }
    );
  };

  const handleMove = (lang: PlatformLanguage, direction: "up" | "down") => {
    if (!languages) return;
    const sorted = [...languages].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((l) => l.code === lang.code);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    orderMutation.mutate({ code: lang.code, sort_order: other.sort_order });
    orderMutation.mutate({ code: other.code, sort_order: lang.sort_order });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            语言管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...(languages || [])].sort((a, b) => a.sort_order - b.sort_order);
  const enabled = sorted.filter((l) => l.is_enabled).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          语言管理
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {enabled} / {sorted.length} 已启用
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          管理平台支持的语言。启用的语言将对用户可见，用户可以在设置中选择。
        </p>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">排序</TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[80px]">代码</TableHead>
                <TableHead>原生名称</TableHead>
                <TableHead>英文名称</TableHead>
                <TableHead className="w-[80px] text-center">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((lang, idx) => (
                <TableRow key={lang.code} className={lang.is_enabled ? "" : "opacity-50"}>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === 0}
                        onClick={() => handleMove(lang, "up")}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === sorted.length - 1}
                        onClick={() => handleMove(lang, "down")}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-lg">{lang.flag}</TableCell>
                  <TableCell className="font-mono text-sm">{lang.code}</TableCell>
                  <TableCell className="font-medium">{lang.label_native}</TableCell>
                  <TableCell className="text-muted-foreground">{lang.label_en}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={lang.is_enabled}
                      onCheckedChange={() => handleToggle(lang)}
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
