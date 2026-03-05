# Navigation Redesign + Full-Screen App Mode — Implementation Plan

## Overview

Restructure platform navigation from 14-item sidebar to 5-tab responsive layout, and add full-screen app mode.

---

## New 5-Tab Structure

| Position | Tab | Route | Icon | Content |
|----------|-----|-------|------|---------|
| 1 | 消息 | `/conversations` | MessageSquare | Chat/DM |
| 2 | 动态 | `/feed` | Compass | Social feed |
| 3 | **AI** | `/ai` | Sparkles | Center special button, AI assistant |
| 4 | 应用 | `/store` | LayoutGrid | Discovery + store + installed apps |
| 5 | 我的 | `/me` | User | Profile + settings + creator tools |

## Changes

### Step 1: Create `AppNavigation` component (replaces `AppSidebar`)

**New file**: `src/components/layout/AppNavigation.tsx`

- Uses `useIsMobile()` to switch layout:
  - **Desktop (>=768px)**: Left sidebar, vertical icon+text tabs, similar width to current collapsed sidebar (~56-64px collapsed, expand on hover optional)
  - **Mobile (<768px)**: Bottom tab bar, horizontal 5 icons+text
- Center AI tab has special styling (gradient/colored circle, slightly larger)
- Active tab uses `primary` color highlight
- Uses `NavLink` from react-router for active state

### Step 2: Create `Me` page

**New file**: `src/pages/Me.tsx`

Consolidates everything that was scattered across multiple pages:
- Profile header (avatar, name, bio) — links to `/profile`
- Quick action grid:
  - Settings (`/settings`)
  - Privacy (`/privacy`)
  - Friends (`/friends`)
  - Blacklist (`/blacklist`)
  - Notifications (`/notifications`)
- Creator tools section (shown conditionally based on role):
  - My Channels (`/my-channels`)
  - Promoter Center (`/promoter`)
  - Earnings (`/earnings`)
  - Developer Center (future)
- Admin section (admin only):
  - Platform Admin (`/admin`)

### Step 3: Create `AI` page (placeholder)

**New file**: `src/pages/AI.tsx`

Simple placeholder with:
- Chat-style interface mock
- "AI assistant coming soon" message
- Future: conversational app generation, personal assistant

### Step 4: Update `MainLayout`

**Modify**: `src/components/layout/MainLayout.tsx`

- Replace `<AppSidebar />` with `<AppNavigation />`
- Desktop: TopHeader + left sidebar + content (same general structure)
- Mobile: TopHeader (simplified) + content + bottom tabs
  - Bottom tabs must be `fixed` at bottom, content area needs `pb-16` padding

### Step 5: Simplify `TopHeader` for mobile

**Modify**: `src/components/layout/TopHeader.tsx`

- Mobile: Hide back/forward buttons, keep logo + search + user menu
- Or: Hide entire TopHeader on mobile (navigation handled by bottom tabs + in-page headers)
- Decision: Keep a minimal header on mobile (logo + search), hide nav buttons

### Step 6: Full-screen app mode

**Modify**: `src/App.tsx` — Move `/app/:appId` route OUT of `MainLayout`:
```tsx
<Route path="/app/:appId" element={<AppFullScreen />} />
```

**New file**: `src/components/layout/AppFullScreen.tsx`
- Renders `<AppView />` at 100vw x 100vh
- Floating [B] button (top-left corner, small, semi-transparent)
  - Click → navigate back to `/store`
  - Position: `fixed top-3 left-3 z-50`
  - Design: small circle with "B" or Bill.ai logo, semi-transparent, becomes opaque on hover

### Step 7: Update routes in `App.tsx`

- `/` → Redirect to `/conversations` (messages is first tab)
- `/ai` → new AI page
- `/me` → new Me page
- `/app/:appId` → outside MainLayout (full-screen)
- Remove `/discover`, `/learning`, `/developer`, `/analytics`, `/toolbox` (never implemented)
- Keep all other sub-routes within MainLayout

### Step 8: Update `Index.tsx`

- Either remove or repurpose — the welcome page is replaced by the 5-tab structure
- Logged out users → redirect to `/auth`
- Logged in users → redirect to `/conversations` (first tab)

### Step 9: Cleanup

- Delete old `AppSidebar.tsx` (replaced by `AppNavigation.tsx`)
- Update any hardcoded navigations to `/` that should go to `/conversations`

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/layout/AppNavigation.tsx` | NEW — 5-tab responsive navigation |
| `src/components/layout/AppFullScreen.tsx` | NEW — full-screen app wrapper + [B] button |
| `src/pages/Me.tsx` | NEW — consolidated "Me" page |
| `src/pages/AI.tsx` | NEW — AI assistant placeholder |
| `src/components/layout/MainLayout.tsx` | MODIFY — use AppNavigation, mobile layout |
| `src/components/layout/TopHeader.tsx` | MODIFY — responsive, simplified on mobile |
| `src/App.tsx` | MODIFY — new routes, full-screen app mode |
| `src/pages/Index.tsx` | MODIFY — redirect logic |
| `src/components/layout/AppSidebar.tsx` | DELETE — replaced by AppNavigation |
