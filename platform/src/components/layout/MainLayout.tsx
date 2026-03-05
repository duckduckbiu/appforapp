import { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { AppNavigation } from "./AppNavigation";
import { TopHeader } from "./TopHeader";
import { ContentSandbox } from "./ContentSandbox";
import { useStarredFriendMessages } from "@/hooks/useStarredFriendMessages";
import { useIdentity } from "@/contexts/IdentityContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MainLayoutProps {
  children: ReactNode;
}

function BannedPage({ reason, expiresAt }: { reason: string | null; expiresAt: string | null }) {
  const expiryText = expiresAt
    ? `封禁到期时间：${new Date(expiresAt).toLocaleString("zh-CN")}`
    : "封禁类型：永久封禁";

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">账号已被封禁</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          {reason && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">封禁原因：</span>{reason}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{expiryText}</p>
          <p className="text-xs text-muted-foreground mt-4">
            如有异议，请联系平台客服申诉
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  const params = useParams();
  const currentConversationId = params.conversationId;
  const { banInfo } = useIdentity();
  const isMobile = useIsMobile();

  // 启用星标好友消息监听
  useStarredFriendMessages(currentConversationId);

  // If user is banned, show the ban page instead of normal layout
  if (banInfo) {
    return <BannedPage reason={banInfo.reason} expiresAt={banInfo.expires_at} />;
  }

  return (
    <div className="h-screen w-full flex flex-col">
      {/* TopHeader */}
      <TopHeader />

      <div className="flex flex-1 min-h-0 relative">
        {/* Desktop: left sidebar navigation */}
        {!isMobile && <AppNavigation />}

        {/* Content area — isolate stacking context */}
        <main className={`flex-1 min-w-0 isolate ${isMobile ? "pb-14" : ""}`}>
          <ContentSandbox>{children}</ContentSandbox>
        </main>
      </div>

      {/* Mobile: bottom tab bar */}
      {isMobile && <AppNavigation />}
    </div>
  );
}
