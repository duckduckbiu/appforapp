import {
  ContentDialog,
  ContentDialogHeader,
  ContentDialogTitle,
  ContentDialogBody,
  ContentDialogFooter,
} from "@/components/ui/content-dialog";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface PermissionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appName: string;
  permissionName: string;
  permissionDescription: string;
  onAllow: () => void;
  onDeny: () => void;
  onAllowOnce?: () => void;
}

export function PermissionRequestDialog({
  open,
  onOpenChange,
  appName,
  permissionName,
  permissionDescription,
  onAllow,
  onDeny,
  onAllowOnce,
}: PermissionRequestDialogProps) {
  return (
    <ContentDialog open={open} onOpenChange={onOpenChange}>
      <ContentDialogHeader onClose={() => onOpenChange(false)}>
        <ContentDialogTitle>权限请求</ContentDialogTitle>
      </ContentDialogHeader>

      <ContentDialogBody>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">
              <span className="text-primary">{appName}</span> 请求访问
            </h3>
            <p className="text-xl font-bold">{permissionName}</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {permissionDescription}
            </p>
          </div>
        </div>
      </ContentDialogBody>

      <ContentDialogFooter className="flex-col gap-2">
        <Button onClick={onAllow} className="w-full">
          始终允许
        </Button>
        
        {onAllowOnce && (
          <Button onClick={onAllowOnce} variant="secondary" className="w-full">
            仅此一次
          </Button>
        )}
        
        <Button onClick={onDeny} variant="ghost" className="w-full">
          不允许
        </Button>
      </ContentDialogFooter>
    </ContentDialog>
  );
}
