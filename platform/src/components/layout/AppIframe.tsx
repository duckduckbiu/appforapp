import { useRef, useEffect } from "react";
import { createSDKHost, type SDKHostConnection } from "@/lib/SDKHost";

interface AppIframeProps {
  src: string;
  appId: string;
  appDbId?: string;
  channelId?: string;
  className?: string;
}

/**
 * Renders an app inside a sandboxed iframe and establishes
 * the SDK communication bridge via Penpal.
 */
export function AppIframe({ src, appId, appDbId, channelId, className }: AppIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<SDKHostConnection | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Create SDK host connection with revenue-split context
    hostRef.current = createSDKHost(appId, iframe, { appDbId, channelId });

    return () => {
      hostRef.current?.destroy();
      hostRef.current = null;
    };
  }, [appId, appDbId, channelId]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      className={className ?? "w-full h-full border-0"}
      title={`App: ${appId}`}
    />
  );
}
