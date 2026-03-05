import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Store, Globe } from "lucide-react";
import { AppIframe } from "@/components/layout/AppIframe";
import { AgeGate } from "@/components/AgeGate";
import { useApp } from "@/hooks/useApps";
import { useUserCountry } from "@/hooks/useUserCountry";
import { Button } from "@/components/ui/button";

export default function AppView() {
  const { appId: slug } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const channelId = searchParams.get("channel") ?? undefined;
  const { data: app, isLoading, isError } = useApp(slug);
  const { country, isLoading: isGeoLoading } = useUserCountry();
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  if (isLoading || isGeoLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  if (isError || !app) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Store className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold mb-2">应用未找到</h2>
          <p className="text-muted-foreground mb-4">
            应用 "{slug}" 不存在或尚未上架。
          </p>
          <Button asChild variant="outline">
            <Link to="/store">浏览应用商店</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Geo-restriction check (only when app specifies allowed_regions)
  const allowedRegions: string[] | null = (app as unknown as { allowed_regions?: string[] | null }).allowed_regions ?? null;
  const isGeoBlocked =
    allowedRegions !== null &&
    allowedRegions.length > 0 &&
    country !== null &&
    !allowedRegions.includes(country);

  if (isGeoBlocked) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold mb-2">地区限制</h2>
          <p className="text-muted-foreground mb-1">此应用在您所在地区不可用</p>
          <p className="text-xs text-muted-foreground mb-4">您的地区：{country}</p>
          <Button asChild variant="outline">
            <Link to="/store">浏览应用商店</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show age gate for restricted content
  const needsAgeGate = app.age_rating !== "all" && !ageConfirmed;
  if (needsAgeGate) {
    return (
      <div className="h-full">
        <AgeGate
          requiredRating={app.age_rating}
          appSlug={app.slug}
          onConfirm={() => setAgeConfirmed(true)}
        />
      </div>
    );
  }

  // Full-screen: iframe fills entire viewport, no platform header
  return (
    <AppIframe
      src={app.manifest_url}
      appId={app.slug}
      appDbId={app.id}
      channelId={channelId}
      className="w-full h-full border-0"
    />
  );
}
