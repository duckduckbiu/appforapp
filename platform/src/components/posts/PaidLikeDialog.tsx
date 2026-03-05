import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins } from "lucide-react";
import { useWallet, usePaidLike } from "@/hooks/useWallet";

interface PaidLikeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const PRESET_AMOUNTS = [10, 50, 100, 500];

export function PaidLikeDialog({ open, onOpenChange, postId }: PaidLikeDialogProps) {
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const { data: wallet } = useWallet();
  const paidLike = usePaidLike();

  const handleSubmit = async () => {
    const finalAmount = customAmount ? parseInt(customAmount, 10) : amount;
    if (finalAmount <= 0) return;
    
    await paidLike.mutateAsync({ postId, amount: finalAmount });
    onOpenChange(false);
  };

  const handlePresetClick = (value: number) => {
    setAmount(value);
    setCustomAmount("");
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
    }
  };

  const finalAmount = customAmount ? parseInt(customAmount, 10) || 0 : amount;
  const canAfford = wallet && wallet.balance >= finalAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            投币支持
          </DialogTitle>
          <DialogDescription>
            给创作者投币表示支持，作者将获得 90% 的收益
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 钱包余额 */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-sm">当前余额</span>
            </div>
            <span className="font-medium">{wallet?.balance ?? 0} 硬币</span>
          </div>

          {/* 预设金额 */}
          <div className="space-y-2">
            <Label>选择金额</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((value) => (
                <Button
                  key={value}
                  variant={amount === value && !customAmount ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义金额 */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount">自定义金额</Label>
            <Input
              id="custom-amount"
              type="number"
              min="1"
              placeholder="输入自定义金额"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
            />
          </div>

          {/* 投币预览 */}
          <div className="rounded-lg border p-3 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="text-sm text-muted-foreground">投币数量</div>
            <div className="text-2xl font-bold text-amber-600">{finalAmount} 硬币</div>
            <div className="text-xs text-muted-foreground mt-1">
              作者将获得 {Math.floor(finalAmount * 0.9)} 硬币
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canAfford || finalAmount <= 0 || paidLike.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {paidLike.isPending ? "投币中..." : !canAfford ? "余额不足" : "确认投币"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
