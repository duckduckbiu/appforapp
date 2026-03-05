import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddMembersSheet } from "./AddMembersSheet";
import { SearchMessagesSheet } from "./SearchMessagesSheet";
import { UserProfileDialog } from "./UserProfileDialog";
import { ImageViewer } from "@/components/ui/image-viewer";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { RecommendFriendSheet } from "./RecommendFriendSheet";
import { ForwardMessagesDialog } from "./ForwardMessagesDialog";
import { MergedMessagesDialog } from "./MergedMessagesDialog";
import { CameraDialog } from "./CameraDialog";
import { VoiceRecorder } from "./VoiceRecorder";
import { LocationPicker } from "./LocationPicker";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  is_deleted: boolean;
  updated_at: string;
  metadata: any;
}

interface ChatDialogsProps {
  conversationId: string;
  conversationInfo: any;
  
  // Add members
  isAddMembersOpen: boolean;
  setIsAddMembersOpen: (open: boolean) => void;
  onAddMembersSuccess: () => void;
  setIsDetailSidebarOpen: (open: boolean) => void;
  
  // Search messages
  isSearchMessagesOpen: boolean;
  setIsSearchMessagesOpen: (open: boolean) => void;
  onMessageClick: (messageId: string) => void;
  
  // User profile
  isProfileDialogOpen: boolean;
  setIsProfileDialogOpen: (open: boolean) => void;
  selectedUserProfile: any;
  onRemarkUpdated: () => void;
  
  // Image preview
  previewImageUrl: string | null;
  setPreviewImageUrl: (url: string | null) => void;
  
  // File preview
  previewFileUrl: string | null;
  previewFileName: string;
  previewFileType: string;
  setPreviewFileUrl: (url: string | null) => void;
  
  // Recommend friend
  isRecommendSheetOpen: boolean;
  setIsRecommendSheetOpen: (open: boolean) => void;
  
  // Forward messages
  isForwardDialogOpen: boolean;
  setIsForwardDialogOpen: (open: boolean) => void;
  messages: Message[];
  selectedMessageIds: Set<string>;
  exitMultiSelectMode: () => void;
  
  // Merged messages
  mergedMessagesDialogOpen: boolean;
  setMergedMessagesDialogOpen: (open: boolean) => void;
  selectedMergedMessages: any[];
  selectedMergedCount: number;
  
  // Camera
  isCameraOpen: boolean;
  setIsCameraOpen: (open: boolean) => void;
  onCameraCapture: (blob: Blob) => void;
  
  // Voice recorder
  isVoiceRecorderOpen: boolean;
  setIsVoiceRecorderOpen: (open: boolean) => void;
  onVoiceSend: (blob: Blob, duration: number) => void;
  
  // Location picker
  isLocationPickerOpen: boolean;
  setIsLocationPickerOpen: (open: boolean) => void;
  onLocationSend: (location: { latitude: number; longitude: number; address?: string }) => void;
  
  // Confirm dialog
  confirmDialog: {
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  };
  setConfirmDialog: (dialog: any) => void;
}

export function ChatDialogs({
  conversationId,
  conversationInfo,
  isAddMembersOpen,
  setIsAddMembersOpen,
  onAddMembersSuccess,
  setIsDetailSidebarOpen,
  isSearchMessagesOpen,
  setIsSearchMessagesOpen,
  onMessageClick,
  isProfileDialogOpen,
  setIsProfileDialogOpen,
  selectedUserProfile,
  onRemarkUpdated,
  previewImageUrl,
  setPreviewImageUrl,
  previewFileUrl,
  previewFileName,
  previewFileType,
  setPreviewFileUrl,
  isRecommendSheetOpen,
  setIsRecommendSheetOpen,
  isForwardDialogOpen,
  setIsForwardDialogOpen,
  messages,
  selectedMessageIds,
  exitMultiSelectMode,
  mergedMessagesDialogOpen,
  setMergedMessagesDialogOpen,
  selectedMergedMessages,
  selectedMergedCount,
  isCameraOpen,
  setIsCameraOpen,
  onCameraCapture,
  isVoiceRecorderOpen,
  setIsVoiceRecorderOpen,
  onVoiceSend,
  isLocationPickerOpen,
  setIsLocationPickerOpen,
  onLocationSend,
  confirmDialog,
  setConfirmDialog,
}: ChatDialogsProps) {
  return (
    <>
      <AddMembersSheet
        open={isAddMembersOpen}
        onOpenChange={setIsAddMembersOpen}
        conversationId={conversationId}
        conversationType={conversationInfo?.type || "private"}
        onSuccess={onAddMembersSuccess}
        onBack={() => {
          setIsAddMembersOpen(false);
          setIsDetailSidebarOpen(true);
        }}
      />

      <SearchMessagesSheet
        open={isSearchMessagesOpen}
        onOpenChange={setIsSearchMessagesOpen}
        conversationId={conversationId}
        conversationName={conversationInfo?.name || ""}
        onBack={() => {
          setIsSearchMessagesOpen(false);
          setIsDetailSidebarOpen(true);
        }}
        onMessageClick={(messageId) => {
          setIsSearchMessagesOpen(false);
          setTimeout(() => {
            onMessageClick(messageId);
          }, 100);
        }}
      />

      <UserProfileDialog
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        profile={selectedUserProfile}
        onSendMessage={() => {
          setIsProfileDialogOpen(false);
          toast.info("发送消息功能开发中");
        }}
        onVoiceCall={() => {
          toast.info("语音聊天功能开发中");
        }}
        onVideoCall={() => {
          toast.info("视频聊天功能开发中");
        }}
        onViewMoments={() => {
          toast.info("朋友圈功能开发中");
        }}
        onRemarkUpdated={onRemarkUpdated}
      />

      <ImageViewer
        open={!!previewImageUrl}
        images={previewImageUrl ? [previewImageUrl] : []}
        onClose={() => setPreviewImageUrl(null)}
      />

      <FilePreviewDialog
        open={!!previewFileUrl}
        fileUrl={previewFileUrl || ""}
        fileName={previewFileName}
        fileType={previewFileType}
        onOpenChange={(open) => !open && setPreviewFileUrl(null)}
      />

      {conversationInfo?.friendId && (
        <RecommendFriendSheet
          open={isRecommendSheetOpen}
          onOpenChange={setIsRecommendSheetOpen}
          recommendedUserId={conversationInfo.friendId}
          recommendedUserName={conversationInfo.name}
        />
      )}

      <ForwardMessagesDialog
        open={isForwardDialogOpen}
        onOpenChange={(open) => {
          setIsForwardDialogOpen(open);
          if (!open) exitMultiSelectMode();
        }}
        messages={messages.filter(m => selectedMessageIds.has(m.id))}
        messageIds={Array.from(selectedMessageIds)}
      />

      <MergedMessagesDialog
        open={mergedMessagesDialogOpen}
        onOpenChange={setMergedMessagesDialogOpen}
        mergedMessages={selectedMergedMessages}
        messageCount={selectedMergedCount}
      />

      <CameraDialog
        open={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={onCameraCapture}
      />

      <VoiceRecorder
        open={isVoiceRecorderOpen}
        onClose={() => setIsVoiceRecorderOpen(false)}
        onSend={onVoiceSend}
      />

      <LocationPicker
        open={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onSend={onLocationSend}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, open: false });
        }}
        variant={confirmDialog.variant}
      />
    </>
  );
}
