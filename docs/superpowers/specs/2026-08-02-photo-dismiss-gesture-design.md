# Mobile Photo Viewer — Photos-Style Interactive Dismiss — Design

**Date:** 2026-08-02
**Scope:** During the swipe-down dismiss, only the current photo tracks the finger. Chrome fades out instantly; the black backdrop is an isolated full-bleed layer that only changes opacity, following drag progress. Today the system zoom transition scales the entire screen — chrome, backdrop and all.
**Touches:** `apps/mobile/modules/photo-masonry/ios/PhotoViewerView.swift`, `PhotoDetailView.swift`, `PhotoDetailChromeVisibility.swift`, `PhotoViewerCell.swift`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/modules/photo-viewer/PhotoDetailScreen.tsx`.

## Problem

Dismiss rides the iOS 18+ zoom transition (`screen.preferredTransition = .zoom` in `PhotoViewerView.configureZoomTransition`). Its interactive pan scales the zoomed `RNSScreen`'s whole view, so the navigation bar, toolbar, scrims and the stacked black backgrounds all shrink together as one page. Apple Photos instead keeps only the image under the finger: chrome vanishes the moment the gesture starts, the image alone translates and scales with the drag, and the backdrop is an isolated layer that purely cross-fades with progress — it never moves or shrinks.

## Decisions (confirmed)

| Decision | Choice |
|---|---|
| Drag tracking | Own `UIPanGestureRecognizer` on `PhotoDetailView`; transforms **only** `mediaViewport` (translate with finger, scale 1→0.68 by progress) |
| System interactive dismiss | Disabled (`interactiveDismissShouldBegin` returns false) — it can only scale the whole screen, which is exactly the wrong shape |
| Zoom transition | Kept **only for the present animation**. The pop is animation-less (`preferredTransition = nil` + `stackAnimation = .none` at commit): frame analysis showed the zoom pop replays its whole-screen morph from the canonical fullscreen state (own dimming layer + source-thumbnail overlay), which cannot continue from a dragged position |
| Backdrop | Single full-bleed black `backgroundView` at the bottom of `PhotoDetailView`; alpha = 1 − progress during the drag, never transformed |
| Grid placeholder | The masonry keeps a blank slot where the previewed photo came from — painted onto the presenter snapshot at capture time from the same rect the commit animation targets |
| Chrome fade | Instant (~0.15s ease-out) on gesture begin via `PhotoDetailChromeVisibility.dismissing` |
| Commit rule | progress > 0.45 (of 340 pt), or downward velocity > 1200 pt/s with ≥100 pt travelled — anything less springs back |
| Commit animation | Photo flies into the blank slot with a projected release-velocity spring (0.26–0.42s); masonry cells preserve aspect ratio so the aspect-fit rect maps exactly onto the cell. If the pager moved to another photo, fall back to drifting out along the gesture while fading |
| Presenter handoff | At landing, atomically replace the moving photo with the complete frozen grid, then retain that snapshot above the `RNScreens` hierarchy until the live presenter has rendered stably. A source-cell replica bridges UIKit's final zoom-source suppression before removal |
| Snapshot release | Clear the snapshot's opaque black backing atomically before cross-fading its grid content. Never fade the backing and content together, which creates a transient full-screen luminance dip |
| Cancel | Project release velocity into the return spring; restore the backdrop with a short ease and delay chrome restoration into the settling phase so these layers do not race the image |

## Architecture

### Backdrop consolidation

The black backdrop previously lived on four stacked views (`PhotoDetailView`, `mediaViewport`, `viewer`, `collectionView`) plus cell layers and two JS layers. All become clear; one black `backgroundView` sits at the bottom of `PhotoDetailView`'s subview stack. The JS side (`PhotoDetailScreen` root, the route's `contentStyle`) is transparent so the masonry grid actually shows through once the backdrop fades. `PhotoViewerView` has no standalone JS consumers, so clearing its background is safe.

### Drag gesture (`PhotoDetailView`)

`dismissPanGestureRecognizer` begins only when: `interactiveDismissEnabled`, inspector closed (`progress ≤ 0.001`), photo not zoomed, no Live Photo hold, vertical dominance (|dy| > |dx| × 1.12), and downward. Chrome subtrees don't receive it (same exclusion as the immersive tap). The pager's pan requires it to fail (`configureExternalDismissGesture`).

- **began:** `visibility.dismissing = true`; chrome fades in 0.15s; reaction rail closes.
- **changed:** `mediaViewport.transform = translate(tx, ty·rubberBandIfUpward) → scale(1 − 0.32·progress)`; `backgroundView.alpha = 1 − progress`. `layoutSubviews` skips `inspector.reapplyProgress()` while dismissing — frame writes under a transform are undefined.
- **ended, commit:** project the release velocity toward the target slot and spring the viewport from its current transformed state into that slot. At landing, reveal the slot in the frozen presenter, hide the moving viewport in the same transaction, and request an animation-less route pop. The frozen presenter is promoted to the host `UIWindow` during the pop so `RNScreens` child reordering cannot expose an empty container; it is released only after the live presenter is stable.
- **ended, cancel:** project the release velocity toward identity, spring only the viewport transform, ease the backdrop independently to 1, and restore chrome after a short phase delay (respects `userHidden` / `zoomed`). Reduce Motion applies values directly.

### Findings that shaped this (from the debugging pass)

- The system zoom dismiss installs `_UIContentSwipeDismissGestureRecognizer` / `_UITransformGestureRecognizer` on the `RNSScreenView`, and the transparent regions of the scaled screen do reveal the presenter beneath — but the machinery only ever scales the whole screen, so it cannot express "image only".
- `transitionCoordinator` does not exist yet when `interactiveDismissShouldBegin` runs; it appears several frames later. Moot now that the drag is owned locally.
- axe's `swipe` HID synthesis never triggers the system dismiss pan; `axe drag` (explicit touch-move stream) does. Local `UIPanGestureRecognizer`s respond to both.
- Removing the frozen presenter when `PhotoDetailView.window` became `nil` exposed an approximately 96ms interval before the React route's presenter was rendered, producing the intermittent whole-screen flash. Window-level snapshot ownership closes that interval.
- UIKit can keep the zoom transition's source thumbnail suppressed for another 1–2 frames after the presenter is attached. The destination-cell replica prevents that private transition state from appearing as a black-cell flash.

## Edge cases

- **Info panel open:** inspector owns vertical pans; the dismiss pan refuses (`progress ≤ 0.001` gate). `infoPresented` still disables the zoom transition entirely.
- **Zoomed image / Live Photo hold:** refused by the begin gate, same rules as before.
- **Immersive mode:** chrome alphas already 0; `dismissing` is a no-op on top; cancel restores the `userHidden` state.
- **Horizontal paging:** unchanged — vertical-dominant drags never begin the pager pan, and the pager requires the dismiss pan to fail.

## Verification

On the simulator (use `axe drag`, not `axe swipe`), three paths:

1. Slow drag down — chrome disappears immediately, backdrop stays full-bleed and dissolves with progress, only the photo translates/scales with the finger, grid visible behind.
2. Release early — cancel: photo springs back, backdrop and chrome fade back in, immersive state preserved.
3. Long/fast drag — commit: photo continues from the release velocity into its thumbnail, then the frozen presenter hands off to the live grid without a black frame or black source cell.

`pnpm --filter @afilmory/mobile type-check` for the JS edits.
