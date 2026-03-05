import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { IdentityProvider } from "@/contexts/IdentityContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AppPermissionsProvider } from "@/contexts/AppPermissionsContext";
import { ContentPortalContext, SetContentPortalContext } from "@/components/layout/ContentSandbox";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { MainLayout } from "@/components/layout/MainLayout";
import { FloatingReturnButton } from "@/components/layout/AppFullScreen";
import { MessageQueueProcessor } from "@/components/MessageQueueProcessor";
import { RequireAuth } from "@/components/RequireAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// ── Lazy-loaded pages ──────────────────────────────────────────────────────
const Auth = lazy(() => import("./pages/Auth"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const Friends = lazy(() => import("./pages/Friends"));
const MessagingCenter = lazy(() => import("./pages/MessagingCenter"));
const GroupChatCreate = lazy(() => import("./pages/GroupChatCreate"));
const BlacklistManagement = lazy(() => import("./pages/BlacklistManagement"));
const Notifications = lazy(() => import("./pages/Notifications"));
const PermissionsList = lazy(() => import("./pages/PermissionsList"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const SetupAdmin = lazy(() => import("./pages/SetupAdmin"));
const PostCreate = lazy(() => import("./pages/PostCreate"));
const Feed = lazy(() => import("./pages/Feed"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const MaskSettings = lazy(() => import("./pages/MaskSettings"));
const HashtagPage = lazy(() => import("./pages/HashtagPage"));
const AppView = lazy(() => import("./pages/AppView"));
const AppStore = lazy(() => import("./pages/AppStore"));
const MyChannels = lazy(() => import("./pages/MyChannels"));
const ChannelDetail = lazy(() => import("./pages/ChannelDetail"));
const PromoterCenter = lazy(() => import("./pages/PromoterCenter"));
const Earnings = lazy(() => import("./pages/Earnings"));
const ReferralLanding = lazy(() => import("./pages/ReferralLanding"));
const Me = lazy(() => import("./pages/Me"));
const AI = lazy(() => import("./pages/AI"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <LoadingSpinner />
    </div>
  );
}

/** Wrap a page element with auth guard + suspense + layout */
function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MainLayout>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </MainLayout>
    </RequireAuth>
  );
}

const App = () => {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  // Read ?ref=CODE from any page URL and cache in localStorage for attribution
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem(
        "billai_referral",
        JSON.stringify({ code: ref, ts: Date.now() })
      );
    }
  }, []);

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <ContentPortalContext.Provider value={portalContainer}>
          <SetContentPortalContext.Provider value={setPortalContainer}>
            <IdentityProvider>
              <NotificationProvider>
                <AppPermissionsProvider>
                  <MessageQueueProcessor>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
              <Routes>
              {/* Auth page — public, no layout */}
              <Route path="/auth" element={<Suspense fallback={<PageFallback />}><Auth /></Suspense>} />

              {/* Home redirect */}
              <Route path="/" element={<Navigate to="/conversations" replace />} />

              {/* ── 5 Tab pages (protected) ─────────────── */}
              <Route path="/conversations" element={<ProtectedPage><MessagingCenter /></ProtectedPage>} />
              <Route path="/conversations/chat/:conversationId" element={<ProtectedPage><MessagingCenter /></ProtectedPage>} />
              <Route path="/conversations/user/:userId" element={<ProtectedPage><MessagingCenter /></ProtectedPage>} />
              <Route path="/conversations/post/:postId" element={<ProtectedPage><MessagingCenter /></ProtectedPage>} />
              <Route path="/conversations/:viewType" element={<ProtectedPage><MessagingCenter /></ProtectedPage>} />
              <Route path="/feed" element={<ProtectedPage><Feed /></ProtectedPage>} />
              <Route path="/ai" element={<ProtectedPage><AI /></ProtectedPage>} />
              <Route path="/store" element={<ProtectedPage><AppStore /></ProtectedPage>} />
              <Route path="/me" element={<ProtectedPage><Me /></ProtectedPage>} />

              {/* ── Full-screen app mode — no MainLayout ── */}
              <Route path="/app/:appId" element={
                <RequireAuth>
                  <Suspense fallback={<PageFallback />}>
                    <div className="h-screen w-full">
                      <FloatingReturnButton />
                      <AppView />
                    </div>
                  </Suspense>
                </RequireAuth>
              } />

              {/* ── Sub-pages (protected, with layout) ─── */}
              <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
              <Route path="/profile/:userId" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
              <Route path="/settings" element={<ProtectedPage><UserSettings /></ProtectedPage>} />
              <Route path="/privacy" element={<ProtectedPage><PrivacySettings /></ProtectedPage>} />
              <Route path="/friends" element={<ProtectedPage><Friends /></ProtectedPage>} />
              <Route path="/group-chat/create" element={<ProtectedPage><GroupChatCreate /></ProtectedPage>} />
              <Route path="/blacklist" element={<ProtectedPage><BlacklistManagement /></ProtectedPage>} />
              <Route path="/notifications" element={<ProtectedPage><Notifications /></ProtectedPage>} />
              <Route path="/permissions" element={<ProtectedPage><PermissionsList /></ProtectedPage>} />
              <Route path="/admin" element={<ProtectedPage><Admin /></ProtectedPage>} />
              <Route path="/setup-admin" element={<ProtectedPage><SetupAdmin /></ProtectedPage>} />
              <Route path="/post/create" element={<ProtectedPage><PostCreate /></ProtectedPage>} />
              <Route path="/post/:postId" element={<ProtectedPage><PostDetail /></ProtectedPage>} />
              <Route path="/post/mask-settings" element={<ProtectedPage><MaskSettings /></ProtectedPage>} />
              <Route path="/hashtag/:tag" element={<ProtectedPage><HashtagPage /></ProtectedPage>} />
              <Route path="/my-channels" element={<ProtectedPage><MyChannels /></ProtectedPage>} />
              <Route path="/channel/:slug" element={<ProtectedPage><ChannelDetail /></ProtectedPage>} />
              <Route path="/promoter" element={<ProtectedPage><PromoterCenter /></ProtectedPage>} />
              <Route path="/earnings" element={<ProtectedPage><Earnings /></ProtectedPage>} />

              {/* ── Special pages — public, no layout ──── */}
              <Route path="/r/:code" element={<Suspense fallback={<PageFallback />}><ReferralLanding /></Suspense>} />

              {/* Catch-all */}
              <Route path="*" element={
                <MainLayout>
                  <Suspense fallback={<PageFallback />}><NotFound /></Suspense>
                </MainLayout>
              } />
            </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </MessageQueueProcessor>
        </AppPermissionsProvider>
      </NotificationProvider>
    </IdentityProvider>
          </SetContentPortalContext.Provider>
        </ContentPortalContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
