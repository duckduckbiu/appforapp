import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AdminGuard() {
  const { currentIdentity, isLoading: identityLoading } = useIdentity();
  const navigate = useNavigate();
  const userId = currentIdentity?.profile?.id;

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["admin-role-check", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (identityLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="default" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">访问被拒绝</h2>
            <p className="text-sm text-muted-foreground text-center">
              您没有管理员权限，无法访问后台管理系统
            </p>
            <Button variant="outline" onClick={() => navigate("/me")}>
              返回平台
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
