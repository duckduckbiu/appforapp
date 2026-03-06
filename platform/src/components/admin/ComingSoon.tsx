import { Construction } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Construction className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h2 className="text-xl font-semibold mb-2">功能开发中</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        此管理模块正在开发中，敬请期待
      </p>
    </div>
  );
}
