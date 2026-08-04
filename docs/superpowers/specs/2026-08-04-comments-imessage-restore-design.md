# Comments iMessage Design Restore — Design

**Date:** 2026-08-04
**Scope:** Restore the iMessage-style comment presentation (message bubbles + send-flight animation) that the RN comments screen had before `804b974a` migrated comments to a native SwiftUI sheet, this time implemented natively. Also restore the dev-lab verification scenario that commit deleted.
**Touches:** `apps/mobile/modules/photo-masonry/ios/Comments/**`, `apps/mobile/modules/photo-masonry/ios/Pages/NativePagesModule.swift`, `apps/mobile/modules/photo-masonry/ios/Tests/**`, `apps/mobile/src/modules/dev-lab/DevLabScreen.tsx`, `apps/mobile/src/native/**`.
**Supersedes in part:** `2026-08-02-native-comments-sheet-design.md` decided "Visual target: rebuilt to iOS idiom" and "Send animation: native List insert; CommentSendFlight deleted". That visual decision is reversed here; the data/session architecture from that spec is untouched.

## Problem

The RN comments screen rendered every comment as an iMessage bubble (own comments right-aligned in the accent color with a 6pt bottom-trailing "tail" corner, incoming comments left-aligned on `bgElement` with a hairline border) and animated a sent comment from the composer field to its landing row along a parabolic arc (`CommentSendFlight`, 360ms, bezier(0.2, 0.78, 0.2, 1), 8pt lift, scale 0.96→1.01→1). The native migration replaced this with plain `List` rows and a `.snappy` insert. The bubbles and the flight come back, natively.

The backend lists comments ascending by `createdAt`, so newest-at-bottom already matches the chat layout; `CommentsStore`/`CommentsState` already carry the full data semantics (optimistic insert by `clientId`, settle, rollback). Only the view layer and the lab harness are missing.

## Design

### Container

`PhotoCommentsSheetView` swaps `List` for `ScrollView` + `LazyVStack` inside a `ScrollViewReader`, with a named coordinate space on the root `ZStack`. Rationale: bubble rows have no separators (nothing List-idiomatic remains), and flight target measurement plus programmatic scroll-to-bottom are deterministic in a plain SwiftUI scroll container, while List's UICollectionView virtualization makes row-frame measurement unreliable. `.refreshable` and last-row pagination survive the swap. Swipe-to-reply dies with List; the visible reply button (below) replaces it. The long-press context menu (like/unlike, copy) stays.

Skeleton, empty, error, sign-in gate, inline error, nav-bar chrome: unchanged.

### Rows (RN parity)

- Own: right-aligned; `Color.accentColor` bubble, white text; corner radii 20pt with 6pt bottom-trailing. While the optimistic request is pending, the footer contains only a quiet trailing `Sending…` label; timestamp and actions appear after settlement. Moderation-pending state remains beside the settled timestamp.
- Incoming: avatar (30pt) bottom-aligned at the left; author + relative time header above the bubble; `secondarySystemFill` bubble with hairline `separator` border, 6pt bottom-leading corner.
- Max bubble width 82% of the row; continuous corner curvature.
- Reply quote block inside the bubble (tinted overlay on own, `tertiarySystemFill` on incoming), showing "replying to X" + up to 3 lines of the parent.
- URLs in the body are tappable and underlined (AttributedString links); text selection stays enabled.
- Footer actions restored from RN: heart + count (toggles reaction; busy spinner) and reply, both visible buttons.

### Send flight

State on `CommentsStore`: `flight: CommentFlight?` (`clientId`, `content`, `origin: CGRect`, `target: CGRect?`).

1. `send()` captures the complete composer pill frame (reported via `onGeometryChange` in the root coordinate space) as `origin` — skipped entirely under Reduce Motion.
2. The optimistic row is appended; the view scrolls to it un-animated (`anchor: .bottom`); the landing row (identity == flight clientId) renders at opacity 0 and reports its bubble frame → `target`.
3. The overlay exists at the full composer geometry immediately, so clearing the real field does not create an empty intermediate frame. A target is eligible only after scroll-to-bottom is no longer pending, its frame is fully above the composer, and it remains unchanged through a short layout-settling window; this prevents an off-screen pre-scroll row frame from being locked intermittently. Once the settled `target` exists, one animatable progress value drives all four rect edges, the 8pt parabolic lift, composer-to-bubble corner radii, secondary-to-accent fill, border removal, text treatment, send-arrow removal, and a midpoint-only shadow. The source is pixel-aligned with the complete composer pill; the destination is pixel-aligned with the real bubble. The flight retains `.timingCurve(0.2, 0.78, 0.2, 1, duration: 0.36)` and `withAnimation(completionCriteria:)` completion.
4. Completion (or a 900ms fallback, or flight cancellation on failure) clears `flight`, revealing the real row. Send failure removes the optimistic row and restores the draft as today; the flight is cancelled the same way RN's `completeFlight` was.

The rect derivation and progress interpolation live in a pure `CommentFlightMath` enum so the existing Swift test target covers them.

### Composer (RN parity)

Pill restyled to RN: hairline-bordered `bgElement` pill containing the multiline field and a 32pt circular accent send button (`arrow.up`, bold, white; 0.38 opacity disabled). The flight overlay owns the arrow while morphing; afterward, a dimmed arrow returns while the request remains pending. Loading is not duplicated in the composer because delivery state belongs to the optimistic row. Reply banner and near-limit character counter keep current behavior.

### Transport seam + lab harness

`CommentsStore`'s five `api.request(CommentsAPI…)` call sites move behind a `CommentsTransport` protocol:

- `LiveCommentsTransport` — wraps `AfilmoryAPI.shared` with the request's `baseURL`; behavior identical to today. Store init defaults to it, so `PhotoDetailViewController` doesn't change semantics.
- `DemoCommentsTransport` — the old lab scenario's fixture data (two incoming comments), configurable latency and outcome (`success` / `failure`); create returns a settled page or throws `APIError.http(500)`; reactions toggle locally.

`NativePagesModule` gains `AsyncFunction("presentCommentsLab")` presenting the same `PhotoCommentsSheetView` + `CommentsStore` on the demo transport from the top view controller (same nav chrome and detents as the real sheet). `DevLabScreen` gets a "Comment send flight" section with success and failure entries. Verifying the lab verifies the production view code — only the transport is fake.

## Testing

1. Swift unit tests: `CommentFlightMath` (full composer and destination handoff endpoints, simultaneous rect shrink/translation midpoint, arc and shadow interpolation), existing `CommentsStateTests` untouched.
2. `pod install` (new .swift files), build, `pnpm --filter @afilmory/mobile type-check` + scoped lint for the RN edits.
3. Simulator, driven via axe from the lab scenario: bubble rendering both directions, send flight frame-by-frame (recording), failure rollback restoring the draft, Reduce Motion path landing without flight.

## Out of scope

Header/nav chrome redesign, StudioCommentsScreen, comment editing/deletion, backend changes, initial scroll-to-bottom on open (RN didn't do it; not invented here).
