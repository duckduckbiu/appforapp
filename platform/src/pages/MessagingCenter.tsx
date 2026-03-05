import { useParams, useNavigate } from "react-router-dom";
import { LeftPanel } from "@/components/messaging/LeftPanel";
import { ChatArea } from "@/components/messaging/ChatArea";
import { FriendProfileView } from "@/components/messaging/FriendProfileView";
import { FriendRequestsView } from "@/components/messaging/FriendRequestsView";
import { PostDetailView } from "@/components/messaging/PostDetailView";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MessagingCenter() {
  const params = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const conversationId = params.conversationId;
  const userId = params.userId;
  const viewType = params.viewType;
  const postId = params.postId;

  // On mobile, show one panel at a time
  const hasRightContent = !!(conversationId || userId || viewType || postId);
  const showLeftPanel = !isMobile || !hasRightContent;
  const showRightPanel = !isMobile || hasRightContent;

  const handleBack = () => navigate("/conversations");

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel — full width on mobile, fixed 320px on desktop */}
      {showLeftPanel && (
        <div className={`${isMobile ? "w-full" : "w-80 border-r border-border"} flex-shrink-0 h-full overflow-hidden`}>
          <LeftPanel />
        </div>
      )}

      {/* Right panel */}
      {showRightPanel && (
        <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {/* Mobile back button */}
          {isMobile && hasRightContent && (
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0">
            {postId ? (
              <PostDetailView postId={postId} />
            ) : conversationId ? (
              <ChatArea conversationId={conversationId} />
            ) : userId ? (
              <FriendProfileView friendId={userId} />
            ) : viewType === "requests" ? (
              <FriendRequestsView />
            ) : !isMobile ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                选择一个对话开始聊天
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
