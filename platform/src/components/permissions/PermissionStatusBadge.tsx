import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface PermissionStatusBadgeProps {
  permissionStatus?: string;
  isSupported?: boolean;
  className?: string;
}

export function PermissionStatusBadge({
  permissionStatus,
  isSupported = true,
  className,
}: PermissionStatusBadgeProps) {
  if (!isSupported) {
    return (
      <Badge variant="secondary" className={className}>
        <XCircle className="w-3 h-3 mr-1" />
        不支持
      </Badge>
    );
  }

  if (!permissionStatus) {
    return null;
  }

  switch (permissionStatus) {
    case "granted":
      return (
        <Badge variant="default" className={`bg-green-500/20 text-green-500 hover:bg-green-500/20 ${className}`}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          已授权
        </Badge>
      );
    case "prompt":
      return (
        <Badge variant="secondary" className={className}>
          <AlertCircle className="w-3 h-3 mr-1" />
          未请求
        </Badge>
      );
    case "denied":
      return (
        <Badge variant="destructive" className={className}>
          <XCircle className="w-3 h-3 mr-1" />
          已拒绝
        </Badge>
      );
    default:
      return null;
  }
}
