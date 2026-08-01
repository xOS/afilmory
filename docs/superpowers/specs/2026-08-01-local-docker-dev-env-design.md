# Local Docker Dev Environment for the Mobile App — Design

**Date:** 2026-08-01
**Scope:** Replace "point the mobile app at production" with a self-contained local stack. Adds `docker-compose.dev.yml` (postgres / redis / rustfs), a `seed:dev` script, and an environment-switch surface in the app's Dev Lab. Touches `apps/mobile/src/api/endpoints.ts`, `apps/mobile/src/modules/dev-lab/**`, `apps/mobile/ios/Afilmory/Info.plist`, and adds `be/apps/core/scripts/seed-dev.ts`.
**Non-goals:** Android, production deployment changes, backend feature work.

## Why this shape

The backend already contains a first-class `*.localhost` dev topology. It was never wired up end to end, but every piece is present:

| Piece | Location | Behavior |
|---|---|---|
| Base domain in dev | `tenant-context-resolver.service.ts:160` | `NODE_ENV=development` → `'localhost'` |
| Slug extraction | `tenant-host.utils.ts` | dedicated `.localhost` suffix branch, strips port first |
| Cookie scope | `auth-cookie.policy.spec.ts` | `alpha.localhost` + base `localhost` → `domain=localhost`, with a unit test |
| Trusted origins | `auth.provider.ts:138-146` | non-production hardcodes `http://*.localhost:*`, `http://localhost:*`, `afilmory://` |
| Cross-host callback | `auth.provider.ts:199` | `skipStateCookieCheck: true` |
| Reserved slugs | `packages/utils/src/tenant.ts:9` | `api` is reserved → `api.localhost` resolves to no tenant, same as production |

So the design is mostly *configuration and seeding*, not new backend code.

Two facts make the heavier alternatives unnecessary:

- **OAuth needs no public exposure.** In the authorization-code flow the provider issues a 302 that the *device's browser* follows. GitHub and Google never connect inbound. A callback on `localhost` is the documented exemption to Google's public-TLD rule.
- **`*.localhost` resolves natively on macOS.** Verified: `getaddrinfo('alpha.localhost')` → `127.0.0.1` / `::1`, zero configuration, offline-safe, wildcard.

Alternatives considered and rejected: Cloudflare Tunnel exposing the whole stack (needs Advanced Certificate Manager for a second-level wildcard — Universal SSL covers only one level — plus public round-trips per image); `/etc/hosts` + mkcert on `*.afilmory.test` (Google rejects non-public TLDs; no wildcard; root-cert install); a real dev domain with a DNS-only wildcard `A` record to `127.0.0.1` (works, but buys nothing over `*.localhost` once the OAuth constraint dissolves).

## Decisions (confirmed)

| Decision | Choice |
|---|---|
| Scope | Offline-self-sufficient stack, with real third-party OAuth |
| Object storage | RustFS (`rustfs/rustfs`), S3-compatible, in Docker |
| `core` runtime | Host process (`pnpm dev:be`), not containerized |
| Domain / TLS | `*.localhost` over plain HTTP — no tunnel, no proxy, no certs, no domain |
| OAuth | Existing dev-only client, callback `http://localhost:1841/api/auth/callback/github` |
| Content seed | Real upload pipeline, not a DB dump |
| App switch | Dev Lab page (`__DEV__`-gated), persisted |

## Topology

```
iOS Simulator
  ├─ http://localhost:1841/api             platform API (auth, workspaces)
  ├─ http://<slug>.localhost:1841/api      tenant API (photos, comments, reactions)
  └─ http://localhost:9000/...             presigned object URLs

Host process
  └─ pnpm dev:be                            core, :1841, hot reload

docker-compose.dev.yml
  ├─ postgres:16-alpine                     :5432
  ├─ redis:7-alpine                         :6379
  └─ rustfs/rustfs                          :9000 (S3) / :9001 (console)
```

No reverse proxy, no `oauth-gateway` process, no TLS.

`core` stays on the host because `sharp`, `pg-native`, and `exiftool` are platform-native: a container would need its own `node_modules` (anonymous volume over a pnpm workspace with hard links), rebuild native modules on first boot, and expose an inspector port for debugging. Docker holds only stateful services.

**RustFS runs on a named volume, not a bind mount** — the image runs as UID/GID `10001`, and a bind-mounted host directory would need matching ownership.

### URL mapping

| Purpose | Local | Production |
|---|---|---|
| Platform API | `http://localhost:1841/api` | `https://api.afilmory.art/api` |
| Tenant API | `http://<slug>.localhost:1841/api` | `https://<slug>.afilmory.art/api` |
| OAuth callback | `http://localhost:1841/api/auth/callback/{provider}` | `https://auth.afilmory.art/api/auth/callback/{provider}` |
| Object storage | `http://localhost:9000` | S3 / R2 |

The platform API uses bare `localhost` rather than `api.localhost` so the sign-in origin and the OAuth callback origin are byte-identical, removing one cross-origin variable from the login hop. Both hosts resolve to no tenant (`localhost` equals the base domain; `api` is a reserved slug), so they are functionally equivalent.

### Why the gateway is absent

`buildGatewayRedirectUri` (`auth.provider.ts:130-133`) is plain concatenation, so setting the `oauthGatewayUrl` system setting to `http://localhost:1841` produces exactly the registered callback. `core` then handles `/api/auth/callback/{provider}` itself. Sign-in is a platform-level (global identity) operation with no tenant in play, so the gateway's only job — restoring a tenant slug across a subdomain hop — has nothing to do locally.

Note for anyone later tempted to reintroduce the gateway locally: `AUTH_GATEWAY_BASE_DOMAIN` is validated by `/^[a-z0-9.-]+$/i` (`oauth-gateway/src/config.ts:25`), which forbids a colon. Its 302 target can therefore never carry a port, so a gateway-based local topology would require `core` to be reachable on port 80.

## Components

### 1. `docker-compose.dev.yml` (new, repo root)

Three services. Postgres and Redis mirror the existing `docker-compose.yml` definitions (same credentials, same healthchecks), so a `be/.env` already pointing at `localhost:5432` / `localhost:6379` needs no change. RustFS is new:

- image `rustfs/rustfs:latest`, ports `9000:9000` and `9001:9001`
- `RUSTFS_VOLUMES=/data`, `RUSTFS_ADDRESS=0.0.0.0:9000`, `RUSTFS_CONSOLE_ADDRESS=0.0.0.0:9001`
- `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` default to `rustfsadmin`
- named volume for `/data`
- healthcheck on the S3 port so `seed:dev` can wait on it

The existing `docker-compose.yml` (production-shaped, builds `Dockerfile.core`) is left untouched.

### 2. `seed:dev` (new, `be/apps/core/scripts/seed-dev.ts`, run via `vite-node`)

Idempotent, re-runnable, two phases.

**Phase A — system level (no user required).** Creates the bucket via `@aws-sdk/client-s3` (already a `core` dependency, so no CLI container), then writes:

- system setting `oauthGatewayUrl` = `http://localhost:1841`
- storage setting: provider `s3`, `endpoint` `http://localhost:9000`, `bucket`, `region`, `accessKeyId`/secret, path-style addressing
- root tenant + superadmin (existing `DEFAULT_SUPERADMIN_EMAIL` / `DEFAULT_SUPERADMIN_USERNAME` env defaults)

Phase A must complete before anything else: until the app is marked initialized, `TenantContextResolver.resolve` short-circuits and returns no tenant at all (`tenant-context-resolver.service.ts:48-54`), so every tenant-scoped request would silently fall through.

**Phase B — content level.** Over HTTP against the running `core`, so the real contract is exercised:

1. Create an email/password dev user (`emailAndPassword` is enabled — `auth.provider.ts:184`) and sign in to obtain a session cookie.
2. Register a workspace through the normal tenant-registration flow, yielding a known slug.
3. Upload the nine files in `photos/` (including the HEIC + `.mov` Live Photo pairs) via `POST /api/photos/assets/upload`, consuming the SSE progress stream.

Phase B therefore also acts as a smoke test of EXIF extraction, thumbnailing, blurhash, and Live Photo pairing. It is skipped (with a clear message) if `core` is not reachable.

**Identity caveat.** The seeded email/password user and a later GitHub/Google sign-in are the same identity only if Better Auth links them by email. No `accountLinking` block is configured, so the effective default must be confirmed during implementation. Mitigation regardless of outcome: `SEED_USER_EMAIL` is configurable, and the app gains a dev-only email/password sign-in (below) so day-to-day work never depends on which way linking resolves.

### 3. App: environment module

`apps/mobile/src/api/endpoints.ts` currently hardcodes `API_BASE_URL` and `SAAS_BASE_DOMAIN`, and `getGalleryApiBaseUrl` hardcodes the `https://` scheme. Extract the environment into its own module holding `{ scheme, baseDomain, port }`, from which both the platform base URL and per-tenant base URLs are derived.

Two built-in environments — `production` (`https`, `afilmory.art`, no port) and `local` (`http`, `localhost`, `1841`) — plus a custom entry.

Persistence follows the established pattern in `columnPreference.ts`: SecureStore, a module-level cached value, and an exported hydration promise. `app/_layout.tsx` awaits hydration before the first request, otherwise the initial fetch races against a stale default.

**Switching environments must clear the auth session and the query cache.** A cookie issued for `afilmory.art` is meaningless on `localhost`; leaving it in place produces a cascade of 401s instead of a clean signed-out state.

### 4. App: Dev Lab surface

`app/dev/index.tsx` already exists and redirects away when `!__DEV__`. `DevLabScreen` is currently a single-scenario parameter playground (`registry.ts` holds one entry). Add a section above the scenario list:

- environment selector (production / local / custom) with the current resolved base URL displayed
- a reachability probe against the selected platform API so a misconfigured stack fails loudly here rather than as an opaque error on the photos tab
- dev-only email/password sign-in, making the local environment usable without any third-party provider

Reuse the existing `SectionHeading` / `ParameterField` / `SegmentedParameter` components.

### 5. App: ATS

`Info.plist` currently sets `NSAllowsArbitraryLoads=false` with `NSAllowsLocalNetworking=true`. Whether that covers a dotted name like `alpha.localhost` is unverified. If the Simulator blocks it, add a targeted exception rather than disabling ATS:

```
NSExceptionDomains → localhost → { NSIncludesSubdomains: true, NSExceptionAllowsInsecureHTTPLoads: true }
```

## Data flow: photo bytes

`manifest.service.ts` rewrites each `s3Key` into `/api/storage/sign?objectKey=…` (`storage-access.utils.ts:21`). The app requests that path against the tenant host; `core` issues a presigned URL; the app fetches it directly.

The presigned host participates in the SigV4 signature, so `core` must sign against the same origin the Simulator will call. Because both `core` and the Simulator run on the same machine, `http://localhost:9000` satisfies both sides with no proxy and no host rewriting.

## Error handling

| Failure | Surfacing |
|---|---|
| Docker services down | `seed:dev` waits on healthchecks, then fails with the specific unreachable service |
| `core` not running during Phase B | Phase A completes, Phase B skipped with an explicit message |
| Bucket already exists / seed re-run | Idempotent: bucket creation tolerates `BucketAlreadyOwnedByYou`, setting writes are upserts, and the seed queries the workspace's existing photos to skip files it already uploaded (it does not assume the upload endpoint dedupes) |
| App pointed at a dead stack | Dev Lab reachability probe reports it in place |
| Stale session after switch | Session and query cache cleared on switch |

## Verification

Static: `pnpm --filter @afilmory/mobile type-check` and `pnpm lint` scoped to changed files.

Behavioral — each of these must be observed running, not inferred:

1. `docker compose -f docker-compose.dev.yml up -d` → all three healthy.
2. `pnpm seed:dev` from a wiped volume set → bucket created, settings written, nine photos uploaded with thumbnails and blurhash.
3. Simulator resolves `<slug>.localhost` (host-side resolution is verified; in-Simulator is not).
4. ATS permits `http://alpha.localhost:1841` — or the exception above is added and then permits it.
5. RustFS path-style presigned URLs verify against `core`'s S3 client; an image actually renders in the app.
6. GitHub OAuth completes end to end against the local stack and lands back in the app via `afilmory://`.
7. Live Photo playback works for the seeded HEIC + `.mov` pairs.
8. Switching production → local → production in Dev Lab leaves no stale session.

## Open items

- Better Auth account-linking default between the seeded email/password user and OAuth identities — Components §2; fallback is the dev-only email/password sign-in.
- Whether `core`'s S3 client sets `forcePathStyle` for custom endpoints, or whether the storage setting must carry it — Verification step 5; fallback is adding the flag to the seeded storage setting.
- Whether ATS blocks `alpha.localhost` — Components §5; fallback is the `NSExceptionDomains` entry given there.

Each is a verification step in the implementation plan, not a design fork — every outcome has a stated fallback.
