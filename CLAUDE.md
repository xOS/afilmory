# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Authoritative Guides

This repo already has detailed `AGENTS.md` files. Read the one closest to the code you are touching before making non-trivial changes:

- `AGENTS.md` (root) — full commands list, monorepo architecture, manifest/data flow, i18n rules.
- `apps/web/AGENTS.md` — Glassmorphic Depth design system used by the SPA (color/opacity rules, blur, shadows, hover via `data-highlighted`).
- `be/AGENTS.md` — Hono-based "NestJS-style" framework: modules, controllers, providers, decorators, DI via `tsyringe`, request-scoped context via `AsyncLocalStorage`.
- `be/apps/core/AGENTS.md` — backend core service architecture.
- `DEVELOPMENT.md` — self-host quick start and config field reference (`builder.config.ts`, `config.json`).
- `.cursor/rules/*.mdc` — code quality, color (Apple UIKit Tailwind classes), i18n, project description.

When those files contradict anything below, prefer them.

## Commands

```bash
# Dev
pnpm dev                          # SSR wrapper (also serves SPA in dev)
pnpm --filter web dev             # SPA only
pnpm --filter @afilmory/ssr dev   # SSR only
pnpm dev:be                       # Backend (be/apps/core)

# Build
pnpm build                        # Production build (via @afilmory/ssr)
pnpm build:demo                   # Demo data + web build
pnpm build:manifest               # Run photo pipeline → photos-manifest.json + thumbnails (incremental)
pnpm build:manifest -- --force            # Full rebuild of photos AND manifest
pnpm build:manifest -- --force-manifest   # Regenerate manifest only
pnpm build:manifest -- --force-thumbnails # Regenerate thumbnails only

# DB (SSR / backend uses Drizzle)
pnpm --filter @afilmory/ssr db:generate
pnpm --filter @afilmory/ssr db:migrate

# Quality
pnpm lint                         # eslint --fix
pnpm format                       # prettier (apps, packages, be)
pnpm type-check                   # recursive `pnpm -r type-check`
pnpm --filter web type-check      # type-check just the SPA

# Docs site
pnpm docs:dev / pnpm docs:build / pnpm docs:preview
```

There is no general test runner wired up at the repo root — verify changes via `pnpm build`, `pnpm type-check`, `pnpm lint`, and (for image processing changes) `pnpm build:manifest`.

Package manager is **pnpm 10** (workspace config in `pnpm-workspace.yaml` includes `apps/**/*`, `packages/*`, `packages/*/*`, `be`, `be/packages/*`, `be/apps/*`). Pinned dependency versions are managed via the pnpm `catalog:` (e.g., `tailwindcss`, `typescript`, `zod`, `motion`).

## Architecture (Big Picture)

Afilmory is a photo gallery composed of three deployable layers plus a builder pipeline. The same SPA runs in all serving modes; the difference is **who injects `window.__MANIFEST__`**.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     packages/builder (CLI pipeline)                  │
│   sync (S3/GitHub/Eagle/local) → format/EXIF → thumbs/blurhash       │
│              → photos-manifest.json (+ optional repo sync)           │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                writes apps/web/src/data/photos-manifest.json
                                 │
┌────────────────────────────────▼─────────────────────────────────────┐
│  apps/web (Vite + React 19 SPA)                                      │
│    PhotoLoader reads window.__MANIFEST__ (data, cameras, lenses)     │
│    Standalone fallback: bundled manifest JSON                        │
└────────────────────────────────▲─────────────────────────────────────┘
                                 │ injects __MANIFEST__
        ┌────────────────────────┼─────────────────────────┐
        │                                                  │
┌───────┴───────────────┐                       ┌──────────┴──────────┐
│ apps/ssr (Next.js 15) │                       │ be/apps/core (Hono) │
│ static manifest JSON  │                       │ DB-backed manifest  │
│ + dynamic OG / SEO    │                       │ + dashboard / API   │
└───────────────────────┘                       └─────────────────────┘
```

Key implications when changing things:

- **`apps/web` is the only UI codebase.** It must work in *both* the static/SSR flow and the full backend flow. Don't assume a backend is present — feature-detect on `window.__MANIFEST__` shape.
- **`packages/data`** owns `PhotoLoader` (the singleton that wraps the manifest into lookup maps). Anything photo-related goes through it.
- **`packages/builder`** is the only place that talks to storage providers (S3/B2/GitHub/Eagle/local). It is configured by `builder.config.ts` (infrastructure) which is separate from `site.config.ts` + `config.json` (presentation/branding).
- **`be/`** uses a custom NestJS-inspired Hono framework: `@Module`, `@Controller`, `@Get/@Post/...`, `@injectable()`, request context via `AsyncLocalStorage`. Don't reach for raw Hono primitives in feature code — use the framework decorators (see `be/AGENTS.md`).
- **`apps/ssr` is a thin host**, not a backend. Its job is to serve the SPA and provide OG/SEO/manifest injection. Heavy logic belongs in `be/apps/core` or `packages/builder`.
- **Two separate design systems**: `apps/web` uses the Glassmorphic Depth system (see `apps/web/AGENTS.md`); `be/apps/dashboard` is a linear, data-first admin UI. Don't mix the two.

## Mobile App (`apps/mobile`)

- **iOS only, forever.** Never spend effort on Android compatibility, fallbacks, or testing — no `Platform.OS === 'android'` branches, no Android-specific assets or config beyond what Expo scaffolding requires.
- **Prefer native (Swift) implementations** when they yield better UX or performance than JS: custom views/gestures/scrolling go in local Expo Modules under `apps/mobile/modules/<name>/` (Swift + `expo-module.config.json`, autolinked via prebuild). Don't reach for JS workarounds when a UIKit primitive does it better.
- **Simulator automation**: use `axe` (`brew install cameroncooke/axe/axe`) for tap/swipe HID injection + `xcrun simctl io <udid> screenshot`; never control the user's mouse (cliclick/AppleScript).
- **expo-glass-effect gotcha**: `GlassView` latches its effect on the first `layoutSubviews` — never mount it inside a reanimated `entering` animation (animate opacity/translate via `useAnimatedStyle` instead), or the glass renders permanently dead.
- **UIGlassEffect gotcha (iOS 26, native)**: `isInteractive = true` swallows touches meant for buttons hosted in the effect view's `contentView` — keep it off for tappable glass controls; floating control clusters need `UIGlassContainerEffect` hosting per-element `UIGlassEffect` views to get real refraction and merge behavior.
- **Presentation anchor gotcha**: a react-native-screens `ScreenStack` used as an imperative presentation anchor must be non-zero-sized (e.g. 1×1 at origin) but must NOT cover the window — a zero-size anchor presents nothing, and a full-bleed anchor makes UIKit stop sampling backdrops, silently blanking every glass surface beneath it.
- **Debug builds**: never pass `CODE_SIGNING_ALLOWED=NO` to simulator builds — it strips the keychain entitlement and `expo-secure-store` crashes on launch.

## Project Conventions That Matter

- **No feature flags or backwards-compat shims.** App is unreleased — change code in place. (Stated explicitly at the bottom of root `AGENTS.md`.)
- **Pages are thin routing shells.** Real UI/logic lives under `modules/<domain>/**` in `apps/web`.
- **State isolation over prop drilling.** For deep subtrees, lift handlers into colocated Jotai/Zustand stores or contexts; don't thread props through layers.
- **Push state down**, not up. Feature-local stores/providers; switching tabs should unmount unused logic.
- **Tailwind colors must use the Apple UIKit palette** (`text-text-secondary`, `bg-fill`, `bg-material-thick`, `border-accent/20`, …). See `.cursor/rules/color.mdc`. Avoid raw hex/inline styles unless `color-mix()` is unavoidable.
- **i18n: flat keys with `.` separators**, no nested objects. Edit `locales/app/en.json` first — ESLint auto-strips keys missing from English in other locales. **Never let a key be both a leaf string and a parent path** (`a.b` cannot coexist with `a.b.c`); the build flattens dots into nested objects and will collide. Use `_one`/`_other` for plurals.
- **No `globalThis.location`** — there's an ESLint rule forbidding it. Use `useLocation()` or `getReadonlyRoute()` (the router instance differs between Electron and browser).
- **Decorators are enabled** (`emitDecoratorMetadata`, `experimentalDecorators`) for the backend framework.
- **`motion` / `motion-dom` are pinned** to `12.34.0` via pnpm overrides — don't bump them casually.

## Configuration Layering

Two configs, two purposes — don't conflate them:

- `builder.config.ts` (+ `builder.config.default.ts` template) → **infrastructure**: storage provider, concurrency, worker/cluster mode, repo sync plugin. Consumed only by `packages/builder`.
- `site.config.ts` + `config.json` → **presentation**: name, description, author, social, map provider/style/projection, feed. Consumed by SPA, SSR, and backend for consistent branding.

Environment variables flow through `env.ts` (root) and `@afilmory/env` (backend) — both validate via Zod / `@t3-oss/env-core`.
