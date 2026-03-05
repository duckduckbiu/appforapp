import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useReports, ReportReason, ReportTargetType } from "@/hooks/useReports";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "垃圾信息/广告" },
  { value: "harassment", label: "骚扰/欺凌" },
  { value: "inappropriate", label: "不当内容" },
  { value: "violence", label: "暴力/危险行为" },
  { value: "copyright", label: "侵犯版权" },
  { value: "other", label: "其他" },
];

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: ReportDialogProps) {
  const { createReport, isCreating } = useReports();
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    createReport(
      {
        targetType,
        targetId,
        reason,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason("inappropriate");
          setDescription("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>举报内容</DialogTitle>
          <DialogDescription>
            请选择举报原因，我们会尽快处理
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
            {REPORT_REASONS.map((item) => (
              <div key={item.value} className="flex items-center space-x-2">
                <RadioGroupItem value={item.value} id={item.value} />
                <Label htmlFor={item.value}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="description">补充说明（可选）</Label>
            <Textarea
              id="description"
              placeholder="请描述具体问题..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            提交举报
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
