import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Camera } from "lucide-react";
import { toast } from "sonner";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserFound: (userId: string) => void;
}

export default function QRCodeScanner({ open, onOpenChange, onUserFound }: QRCodeScannerProps) {
  const [qrInput, setQrInput] = useState("");

  const handleSubmit = () => {
    if (!qrInput.trim()) {
      toast.error("请输入二维码内容");
      return;
    }

    try {
      // 二维码格式: billai://user/{userId}
      const match = qrInput.match(/billai:\/\/user\/(.+)/);
      if (match && match[1]) {
        onUserFound(match[1]);
        setQrInput("");
        onOpenChange(false);
      } else {
        toast.error("无效的二维码格式");
      }
    } catch (error) {
      toast.error("解析二维码失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>扫描二维码添加好友</DialogTitle>
          <DialogDescription>输入或粘贴好友的二维码</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="input" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="input">
              <QrCode className="mr-2 h-4 w-4" />
              输入二维码
            </TabsTrigger>
            <TabsTrigger value="scan" disabled>
              <Camera className="mr-2 h-4 w-4" />
              扫描二维码
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr-input">二维码内容</Label>
              <Input
                id="qr-input"
                placeholder="粘贴二维码内容 (billai://user/...)"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <p className="text-xs text-muted-foreground">
                请让对方在个人资料页面展示二维码，然后复制粘贴到这里
              </p>
            </div>
            <Button onClick={handleSubmit} className="w-full">
              确认添加
            </Button>
          </TabsContent>

          <TabsContent value="scan" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>相机扫描功能开发中...</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
