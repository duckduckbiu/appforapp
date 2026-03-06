import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Tags, Plus, Trash2, Pencil, ChevronUp, ChevronDown,
  Newspaper, Code2, Sparkles, FlaskConical, TrendingUp,
  Bitcoin, Landmark, Trophy, Clapperboard, Heart,
  GraduationCap, Leaf, Briefcase, Coffee, Shield, Globe,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getCategoryColorClasses } from "@/hooks/useFeedCategories";

// ── Types ──────────────────────────────────────────────────

interface FeedCategory {
  id: string;
  label_zh: string;
  label_en: string;
  icon: string;
  color_class: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ── Icon registry ──────────────────────────────────────────

const ICON_OPTIONS = [
  { value: "Newspaper", label: "新闻", Icon: Newspaper },
  { value: "Code2", label: "代码", Icon: Code2 },
  { value: "Sparkles", label: "AI", Icon: Sparkles },
  { value: "FlaskConical", label: "科学", Icon: FlaskConical },
  { value: "TrendingUp", label: "趋势", Icon: TrendingUp },
  { value: "Bitcoin", label: "加密", Icon: Bitcoin },
  { value: "Landmark", label: "政治", Icon: Landmark },
  { value: "Trophy", label: "体育", Icon: Trophy },
  { value: "Clapperboard", label: "娱乐", Icon: Clapperboard },
  { value: "Heart", label: "健康", Icon: Heart },
  { value: "GraduationCap", label: "教育", Icon: GraduationCap },
  { value: "Leaf", label: "环境", Icon: Leaf },
  { value: "Briefcase", label: "商业", Icon: Briefcase },
  { value: "Coffee", label: "生活", Icon: Coffee },
  { value: "Shield", label: "安全", Icon: Shield },
  { value: "Globe", label: "综合", Icon: Globe },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.value, o.Icon])
);

const COLOR_OPTIONS = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "pink", "rose",
];

const EMPTY_FORM = {
  id: "",
  label_zh: "",
  label_en: "",
  icon: "Newspaper",
  color_class: "blue",
  sort_order: 0,
};

// ── Component ──────────────────────────────────────────────

export function FeedCategoriesManager() {
  const [categories, setCategories] = useState<FeedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await sb
        .from("feed_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  }, [sb]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const openAdd = () => {
    setEditingId(null);
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
    setForm({ ...EMPTY_FORM, sort_order: maxOrder + 1 });
    setDialogOpen(true);
  };

  const openEdit = (cat: FeedCategory) => {
    setEditingId(cat.id);
    setForm({
      id: cat.id,
      label_zh: cat.label_zh,
      label_en: cat.label_en,
      icon: cat.icon,
      color_class: cat.color_class,
      sort_order: cat.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.label_zh.trim() || !form.label_en.trim()) {
      toast.error("请填写完整信息");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        label_zh: form.label_zh,
        label_en: form.label_en,
        icon: form.icon,
        color_class: form.color_class,
        sort_order: form.sort_order,
      };
      if (editingId) {
        const { id: _id, ...updatePayload } = payload;
        const { error } = await sb.from("feed_categories").update(updatePayload).eq("id", editingId);
        if (error) throw error;
        toast.success("已更新");
      } else {
        const { error } = await sb.from("feed_categories").insert(payload);
        if (error) throw error;
        toast.success("已添加");
      }
      setDialogOpen(false);
      loadCategories();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("保存失败", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: FeedCategory) => {
    if (!confirm(`确定删除分类「${cat.label_zh}」？关联的新闻源分类将失效。`)) return;
    try {
      const { error } = await sb.from("feed_categories").delete().eq("id", cat.id);
      if (error) throw error;
      toast.success("已删除");
      loadCategories();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("删除失败", { description: err.message });
    }
  };

  const handleToggle = async (cat: FeedCategory) => {
    try {
      const { error } = await sb
        .from("feed_categories")
        .update({ is_active: !cat.is_active })
        .eq("id", cat.id);
      if (error) throw error;
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("切换失败", { description: err.message });
    }
  };

  const handleMove = async (cat: FeedCategory, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const other = categories[swapIdx];
    try {
      await Promise.all([
        sb.from("feed_categories").update({ sort_order: other.sort_order }).eq("id", cat.id),
        sb.from("feed_categories").update({ sort_order: cat.sort_order }).eq("id", other.id),
      ]);
      loadCategories();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("排序失败", { description: err.message });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  const activeCount = categories.filter((c) => c.is_active).length;

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {categories.length} 个分类 · {activeCount} 个启用
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              添加分类
            </Button>
          </div>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tags className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>暂无分类</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => {
                const IconComp = ICON_MAP[cat.icon] || Globe;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    {/* Sort buttons */}
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5"
                        disabled={idx === 0}
                        onClick={() => handleMove(cat, "up")}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5"
                        disabled={idx === categories.length - 1}
                        onClick={() => handleMove(cat, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Toggle */}
                    <Switch checked={cat.is_active} onCheckedChange={() => handleToggle(cat)} />

                    {/* Icon preview */}
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-muted shrink-0">
                      <IconComp className="h-4 w-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.label_zh}</span>
                        <span className="text-xs text-muted-foreground">{cat.label_en}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${getCategoryColorClasses(cat.color_class)}`}>
                          {cat.id}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        排序: {cat.sort_order} · 图标: {cat.icon} · 颜色: {cat.color_class}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑分类" : "添加分类"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">ID（唯一标识）*</label>
              <Input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="例如：tech, news"
                disabled={!!editingId}
              />
              {!editingId && (
                <p className="text-xs text-muted-foreground">创建后不可更改，建议使用小写英文</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">中文名称 *</label>
                <Input
                  value={form.label_zh}
                  onChange={(e) => setForm({ ...form, label_zh: e.target.value })}
                  placeholder="科技"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">英文名称 *</label>
                <Input
                  value={form.label_en}
                  onChange={(e) => setForm({ ...form, label_en: e.target.value })}
                  placeholder="Technology"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">图标</label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.Icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">排序</label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">颜色</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color_class: color })}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      getCategoryColorClasses(color)
                    } ${form.color_class === color ? "border-foreground scale-110" : "border-transparent"}`}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {editingId ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
