import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  Clock,
  Globe,
  ExternalLink,
  Save,
  Newspaper,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { usePlatformSettings, useUpdatePlatformSetting } from "@/hooks/usePlatformSettings";
import { useEnabledLanguages, type PlatformLanguage } from "@/hooks/usePlatformLanguages";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ── GDELT language mapping (must stay in sync with scripts/fetch_news.py) ──
interface GdeltEntry {
  gdeltCode: string;
  query: string;
  note?: string;
}
const PLATFORM_TO_GDELT: Record<string, GdeltEntry | null> = {
  "en":    { gdeltCode: "eng", query: "breaking news world politics technology economy finance" },
  "zh-CN": { gdeltCode: "zho", query: "科技 人工智能 创新 经济 世界新闻" },
  "zh-TW": { gdeltCode: "zho", query: "（与简中共用 zho 查询，已自动去重）", note: "dedup" },
  "ja":    { gdeltCode: "jpn", query: "テクノロジー 世界ニュース 経済" },
  "ko":    null, // GDELT "kor" returns invalid JSON
  "es":    { gdeltCode: "spa", query: "tecnología política economía mundo" },
  "fr":    { gdeltCode: "fra", query: "politique économie technologie monde" },
  "de":    { gdeltCode: "deu", query: "Technologie Wirtschaft Politik Welt" },
  "pt":    { gdeltCode: "por", query: "tecnologia política economia mundo" },
  "ru":    { gdeltCode: "rus", query: "технологии мировые новости экономика" },
  "ar":    { gdeltCode: "ara", query: "أخبار العالم تكنولوجيا" },
  "vi":    { gdeltCode: "vie", query: "công nghệ thế giới kinh tế" },
  "th":    { gdeltCode: "tha", query: "เทคโนโลยี ข่าวโลก เศรษฐกิจ" },
};

const FUNDUS_COUNTRIES = [
  "US","GB","DE","FR","ES","PT","IT","NL","AT","CH",
  "AU","CA","IN","IE","NZ","SG","JP","KR","CN",
  "RU","PL","CZ","HU","RO",
  "SE","NO","DK","FI","BE","ZA","MX","AR","BR",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.round(hrs / 24)} 天前`;
}

function nextFetchIn(lastIso: string, intervalMin: number): string {
  const nextMs = new Date(lastIso).getTime() + intervalMin * 60_000;
  const diffMs = nextMs - Date.now();
  if (diffMs <= 0) return "即将运行";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `约 ${mins} 分钟后`;
  return `约 ${Math.round(mins / 60)} 小时后`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FeedEnginePanel() {
  const navigate = useNavigate();
  const { data: settings, isLoading: settingsLoading } = usePlatformSettings();
  const { data: enabledLangs = [] } = useEnabledLanguages();
  const updateSetting = useUpdatePlatformSetting();

  // Interval edit state
  const [intervalInput, setIntervalInput] = useState("");
  useEffect(() => {
    if (settings) {
      setIntervalInput(settings["fundus_fetch_interval_minutes"] ?? "30");
    }
  }, [settings]);

  // Article count
  const [articleCount, setArticleCount] = useState<number | null>(null);
  useEffect(() => {
    sb.from("aggregated_feed")
      .select("*", { count: "exact", head: true })
      .then(({ count }: { count: number | null }) => setArticleCount(count));
  }, []);

  const lastFetchAt = settings?.["fundus_last_fetch_at"] ?? "";
  const intervalMin = parseInt(settings?.["fundus_fetch_interval_minutes"] ?? "30", 10);

  async function handleSaveInterval() {
    const val = parseInt(intervalInput, 10);
    if (isNaN(val) || val < 5) {
      toast.error("间隔至少 5 分钟");
      return;
    }
    await updateSetting.mutateAsync({ key: "fundus_fetch_interval_minutes", value: String(val) });
    toast.success("抓取间隔已更新");
  }

  // Build GDELT rows from enabled languages
  const gdeltRows = buildGdeltRows(enabledLangs);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">新闻源管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          由 GitHub Actions 自动驱动 · fundus 直接爬取 + GDELT 多语言补充
        </p>
      </div>

      {/* ── Card 1: 抓取引擎状态 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            抓取引擎运行中
          </CardTitle>
          <CardDescription>
            GitHub Actions · 每 10 分钟触发，脚本内部按间隔决定是否真正运行
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBox
              label="文章总量"
              value={articleCount !== null ? `${articleCount.toLocaleString()} 条` : "—"}
              icon={<Newspaper className="h-4 w-4 text-muted-foreground" />}
            />
            <StatBox
              label="上次 fundus 运行"
              value={lastFetchAt ? relativeTime(lastFetchAt) : "尚未运行"}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
            <StatBox
              label="下次 fundus 运行"
              value={lastFetchAt ? nextFetchIn(lastFetchAt, intervalMin) : "—"}
              icon={<Activity className="h-4 w-4 text-muted-foreground" />}
            />
            <StatBox
              label="触发频率"
              value="每 10 分钟"
              icon={<Globe className="h-4 w-4 text-muted-foreground" />}
              note="GitHub Actions cron"
            />
          </div>

          {/* Interval editor */}
          <div className="flex items-end gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="interval-input">fundus 抓取间隔（分钟）</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="interval-input"
                  type="number"
                  min={5}
                  className="w-28"
                  value={intervalInput}
                  onChange={(e) => setIntervalInput(e.target.value)}
                  disabled={settingsLoading}
                />
                <Button
                  size="sm"
                  onClick={handleSaveInterval}
                  disabled={updateSetting.isPending || settingsLoading}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  保存
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              Actions 每 10 min 触发，但 fundus 仅在距上次运行超过此间隔时才真正爬取。GDELT 每次触发都会运行。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: fundus ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">fundus · flairNLP</CardTitle>
              <CardDescription className="mt-1">
                直接爬取 171 个主流媒体 · 手写解析器 · 97.69% F1 · MIT License
              </CardDescription>
            </div>
            <a
              href="https://github.com/flairNLP/fundus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">每次最多</p>
              <p className="font-medium">200 篇 <span className="text-xs text-muted-foreground">(GitHub Actions 环境变量)</span></p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">全文提取率</p>
              <p className="font-medium">~100% <span className="text-xs text-muted-foreground">(手写解析器)</span></p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">活跃语言（来自平台启用语言）</p>
              <button
                onClick={() => navigate("/admin/system/settings")}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                语言设置 <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enabledLangs.map((lang) => (
                <Badge key={lang.code} variant="secondary" className="text-xs gap-1">
                  {lang.flag} {lang.label_native}
                </Badge>
              ))}
              {enabledLangs.length === 0 && (
                <span className="text-xs text-muted-foreground">无启用语言</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">国家版本（{FUNDUS_COUNTRIES.length} 个）</p>
            <div className="flex flex-wrap gap-1">
              {FUNDUS_COUNTRIES.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: GDELT ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">GDELT Doc API</CardTitle>
              <CardDescription className="mt-1">
                全球新闻索引 · 100+ 语言 · 每 15 分钟更新 · 无需 API Key
              </CardDescription>
            </div>
            <a
              href="https://api.gdeltproject.org/api/v2/doc/doc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            >
              API 文档 <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">每次最多</p>
              <p className="font-medium">20 条/查询 <span className="text-xs text-muted-foreground">(GitHub Actions 环境变量)</span></p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">运行频率</p>
              <p className="font-medium">每 10 分钟 <span className="text-xs text-muted-foreground">(每次 Actions 触发都运行)</span></p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">当前查询列表（由平台启用语言决定）</p>
              <button
                onClick={() => navigate("/admin/system/settings")}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                语言设置 <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-32">语言</TableHead>
                    <TableHead className="w-20">GDELT 码</TableHead>
                    <TableHead>查询关键词</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gdeltRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">
                        无启用语言
                      </TableCell>
                    </TableRow>
                  ) : (
                    gdeltRows.map((row) => (
                      <TableRow key={row.code} className={row.disabled ? "opacity-50" : ""}>
                        <TableCell className="text-xs">
                          {row.flag} {row.label}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {row.gdeltCode ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.query}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

// ── GDELT row builder ─────────────────────────────────────────────────────────

interface GdeltRow {
  code: string;
  flag: string;
  label: string;
  gdeltCode: string | null;
  query: string;
  disabled: boolean;
}

function buildGdeltRows(langs: PlatformLanguage[]): GdeltRow[] {
  const seenGdeltCodes = new Set<string>();
  return langs.map((lang): GdeltRow => {
    const entry = PLATFORM_TO_GDELT[lang.code];

    if (!entry) {
      // Unsupported (e.g. Korean)
      return {
        code: lang.code,
        flag: lang.flag,
        label: lang.label_native,
        gdeltCode: null,
        query: "暂不支持（GDELT API 故障）",
        disabled: true,
      };
    }

    const isDup = seenGdeltCodes.has(entry.gdeltCode);
    if (!isDup) seenGdeltCodes.add(entry.gdeltCode);

    return {
      code: lang.code,
      flag: lang.flag,
      label: lang.label_native,
      gdeltCode: isDup ? null : entry.gdeltCode,
      query: isDup ? `与 ${entry.gdeltCode} 查询共用（已去重）` : entry.query,
      disabled: isDup,
    };
  });
}
