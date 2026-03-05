import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STORAGE_KEY_PREFIX = "ageGate_";

// Extract the minimum age number from strings like "13+", "17+", "18+"
function parseMinAge(rating: string): number {
  const match = rating.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 18;
}

interface AgeGateProps {
  requiredRating: string;   // "13+" | "17+" | "18+"
  appSlug: string;
  onConfirm: () => void;
}

export function AgeGate({ requiredRating, appSlug, onConfirm }: AgeGateProps) {
  const navigate = useNavigate();
  const storageKey = `${STORAGE_KEY_PREFIX}${appSlug}`;
  const minAge = parseMinAge(requiredRating);

  // Check localStorage on mount — if already confirmed, skip gate
  useEffect(() => {
    const confirmed = localStorage.getItem(storageKey);
    if (confirmed === "confirmed") {
      onConfirm();
    }
  }, [storageKey, onConfirm]);

  const handleConfirm = () => {
    localStorage.setItem(storageKey, "confirmed");
    onConfirm();
  };

  return (
    <div className="h-full flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="max-w-sm w-full">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <CardTitle className="text-lg">年龄确认</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            此应用内容适合 <span className="font-semibold text-foreground">{minAge} 岁及以上</span> 的用户。
          </p>
          <p className="text-sm text-muted-foreground">
            请确认您已年满 {minAge} 岁以继续访问。
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleConfirm}>
              我已满 {minAge} 岁，继续访问
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              返回
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
