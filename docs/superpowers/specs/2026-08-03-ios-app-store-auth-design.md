# iOS App Store Auth Compliance — Design

**Date:** 2026-08-03
**Scope:** Unblock the first App Store submission by closing three review gaps: no reviewable demo credentials (Guideline 2.1), social-only primary login (4.8), and no in-app account deletion (5.1.1(v)). Adds email/password sign-in, native Sign in with Apple, a web-onboarding escape hatch for workspace-less accounts, and a full-cascade account deletion pipeline.
**Touches:** `be/apps/core/src/modules/platform/auth/**`, `be/apps/core/src/modules/platform/data-management/**`, `be/apps/core/src/modules/configuration/system-setting/system-setting.ui-schema.ts`, `apps/mobile/src/modules/auth/**`, `apps/mobile/src/modules/photos/PhotosHomeScreen.tsx`, `apps/mobile/modules/photo-masonry/ios/Sheets/ProfileSheetView.swift`, `apps/mobile/package.json`, `apps/mobile/RELEASE.md`, `locales/mobile/*.json`.

## Problem

The mobile app has a TestFlight pipeline but has never passed App Review. Three guidelines block it, and the app's current shape violates all three.

**2.1 App Completeness** requires demo credentials when the app has a login:

> include demo account info (and turn on your back-end service!) if your app includes a login

`SignInSection.tsx:15-18` offers only GitHub and Google. Handing a reviewer a real GitHub or Google account fails in practice — both providers challenge new-device/new-IP sign-ins with verification codes the reviewer cannot receive.

**4.8 Login Services** fires on the same fact. The trigger clause has no "exclusively" qualifier — using Google Sign-In *at all* for the primary account requires offering an alternative login service that limits collection to name and email, lets users keep their email private, and does not collect app interactions for advertising. The exemption *does* carry the qualifier ("Your app **exclusively** uses your company's own account setup and sign-in systems"), so adding email/password alongside Google/GitHub does not exempt us. Only Sign in with Apple satisfies the "keep their email address private" clause, because that is Hide My Email.

**5.1.1(v)** requires in-app account deletion for any app supporting account creation. Social sign-in auto-creates users, so this applies. Nothing in `apps/mobile/src/` or `ProfileSheetView.swift` deletes an account. `DELETE /data-management/account` (`data-management.controller.ts:16`) deletes a *tenant*, not a user, and is gated `@TenantRoles('owner')`.

A fourth problem is created by the fix. Sign in with Apple must be the most prominent button per HIG, so a reviewer will tap it before using the demo credentials. They land as a brand-new user with no membership, and `PhotosHomeScreen.tsx` renders a "complete setup on the web" dead end — workspace registration requires the requested slug to match the current subdomain (`auth-registration.service.ts:194`), which is structurally a web flow. A dead end at that point reads as an incomplete app.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Email/password scope | Sign-in only, no registration | The demo account is seeded server-side. Registration would drag in verification email, password reset, and rate limiting for no review benefit. |
| SIWA integration | Native `expo-apple-authentication` + `signIn.social({ idToken })` | Skips the `auth.afilmory.art` gateway entirely, so no Services ID, no Apple `response_mode=form_post` handling, and it is the native sheet HIG asks for. |
| SIWA on web | Mobile only for now | `buildProviderResponse` (`auth.controller.ts:55`) derives the web login list from the same config, so apple needs filtering out. Web is not subject to 4.8. |
| Account deletion | better-auth `user.deleteUser` + `beforeDelete` hook | better-auth owns `authUsers`/`authSessions`/`authAccounts` cleanup; the hook owns everything better-auth cannot know about. `session.freshAge` is already `0`, so no re-auth friction. |
| Workspace-less users | Open web onboarding in `expo-web-browser` | In-app onboarding is a separate feature. Registration has no billing gate (default plan is `free`, `billing-plan.service.ts:157`), so this is not a 3.1.1 external-purchase surface. |

## Account Deletion

The most consequential part of the design, because getting it wrong either leaves orphaned data or fails review.

### What the schema already handles

Five tables carry `onDelete: 'cascade'` against `authUsers.id`, so deleting the user row clears them with no extra code:

| Table | Covers |
|---|---|
| `tenantMemberships` (`schema.ts:144-146`) | Membership in every tenant, **including tenants owned by other people** |
| `comments` (`schema.ts:282-284`) | Every comment in every tenant, including other people's galleries |
| `commentReactions` (`schema.ts:319-321`) | Same |
| `authSessions` (`schema.ts:172-175`) | All sessions |
| `authAccounts` (`schema.ts:184-186`) | All OAuth links and the password hash |

`reactions` (photo-level) has no `userId` — it is anonymous by construction. `photoAccessLogs` and `billingUsageEvents` key only on `tenantId` and follow tenant deletion.

### Every tenant the user owns is solely theirs

`schema.ts:155` defines a partial unique index:

```sql
uq_tenant_membership_active_owner ON (tenant_id) WHERE role = 'owner' AND status = 'active'
```

At most one active owner per tenant. There is no "co-owned workspace" case to reason about: every tenant the user owns dies with them, and every tenant they merely belong to loses only their membership row via cascade.

### What the cascade misses

1. **The owned tenants themselves.** Deleting the user drops the membership row and leaves the tenant, its `photoAssets`, and its managed-storage objects unreachable by anyone. Each owned tenant needs `deleteTenantWithMetadata` (`data-management.service.ts:134`), which also runs `deleteFolder('')` against managed storage.

2. **Pending tenants are currently undeletable.** `assertTenantDeletable` (`data-management.service.ts:120-132`) rejects `status === 'pending'` alongside the root tenant. A user who signed in but never finished web onboarding owns exactly such a tenant — and that is the state a reviewer is most likely to be in. Left as-is, those users can never delete their account, which is a direct 5.1.1(v) violation. Add an `allowPending` flag threaded only from the user-deletion path; the root-tenant guard stays unconditional.

3. **Orphaned comment replies.** `comments.parentId` (`schema.ts:285`) is a bare `text` column with **no foreign key**. When the user's comment is cascade-deleted, replies written by other people keep a `parentId` pointing at a row that no longer exists, breaking the comment tree in someone else's gallery. Before deletion, null out `parentId` on any comment whose parent belongs to this user, promoting those replies to top level.

4. **Creem subscriptions.** `creemSubscriptions.creemCustomerId` (`schema.ts:217`) and `authUsers.creemCustomerId` (`schema.ts:122`) are same-named columns with no FK between them, and `creemSubscriptions.tenantId` is `set null`. Deleting the user orphans the record while the upstream subscription keeps billing. Cancel through Creem, then delete the local rows. Scope: every subscription whose `tenantId` is one of the user's owned tenants, union every subscription matching the user's `creemCustomerId` — the two sets overlap but neither contains the other, since `tenantId` can already be null from an earlier tenant deletion.

5. **Apple token revocation.** Apple requires apps offering both SIWA and account deletion to revoke tokens through the REST API. `/auth/revoke` accepts only a **refresh token or access token** — the `identityToken` from the native sheet is not accepted. See [Sign in with Apple](#sign-in-with-apple) for how the refresh token gets stored in the first place. The token lives in `authAccounts.refreshToken`, which the cascade destroys, so revocation must happen first.

### Ordering

The five gaps above are not in execution order. Sequenced, with the first four inside `user.deleteUser.beforeDelete` and the last being better-auth's own work:

```
a. Revoke the Apple refresh token        ← before authAccounts is cascaded away
b. Cancel the Creem subscription, then delete its rows
c. NULL out parentId on replies whose parent belongs to this user
d. deleteTenantWithMetadata(tenant, { allowPending: true }) for each owned tenant
e. better-auth deletes authUsers → the five cascade tables follow
```

`c` must precede `e`, because once the user's comments are cascaded away there is no way to identify which replies pointed at them. Any step throwing aborts the whole operation; no half-deleted state is committed.

### Revocation fallback

Apple's guidance is explicit that a missing token does not excuse skipping deletion: fulfil the request and direct the user to revoke access manually. Revocation failure therefore logs and continues — it never blocks steps 2–5. The confirmation UI tells the user they can also remove the app under Settings → Apple Account → Sign in with Apple.

## Sign in with Apple

### Client secret

Apple's `client_secret` is not a static string. It is an ES256 JWT signed with a `.p8` private key, valid for at most six months. Storing a pre-signed value means silent failure half a year later, so the backend signs on demand and caches.

`SocialProvidersConfig` (`auth.config.ts:9-12`) gains an `apple` entry carrying `teamId`, `keyId`, and `privateKey` in addition to the usual client id. `system-setting.ui-schema.ts` gains the matching fields.

Native ID-token sign-in does not need the secret — verification only needs Apple's JWKS plus an audience check. The secret exists for the `/auth/token` exchange and for `/auth/revoke`, both of which are required to make deletion compliant. For native tokens, `client_id` is the bundle ID `app.afilmory`, not a Services ID.

### Flow

```
expo-apple-authentication
  ├── identityToken   → signIn.social({ provider: 'apple', idToken: { token, nonce } })
  └── authorizationCode → POST /auth/apple/exchange
                            → Apple /auth/token (needs client_secret)
                            → store refresh token in authAccounts.refreshToken
```

The exchange runs immediately after sign-in and requires the session that sign-in just produced — the endpoint binds the resulting refresh token to the caller's own `authAccounts` row rather than trusting a user id from the request body. Without this step there is no revocable token, and deletion permanently falls back to the manual path.

`buildBetterAuthProvidersForHost` (`auth.provider.ts:96`) passes `appBundleIdentifier: 'app.afilmory'` for apple and skips `buildRedirectUri` — the native flow has no callback, and that function logs an error when no gateway is configured.

## Mobile Changes

**`SignInSection.tsx`** — Apple button first, at no less than the visual weight of the others (HIG prominence). GitHub and Google keep their current treatment. A secondary "sign in with email" entry sits below, revealing an email/password form. `signInWithPassword` (`sessionStore.ts:94`) already exists; drop its dev-only comment and wire it up. No registration, no password reset.

**`PhotosHomeScreen.tsx`** — replace the "complete setup on the web" dead end with a button that opens web onboarding via `expo-web-browser`. On browser dismissal, re-fetch the session; if a workspace became active, drop straight into the gallery.

**`ProfileSheetView.swift`** — a destructive "Delete account" row below the existing sign-out row, reusing that row's confirmation-dialog pattern (`ProfileSheetView.swift:39-44`). The confirmation spells out what disappears: the workspace, its photos, and every comment the user has written anywhere.

**`environment.ts`** — unchanged. Production stays hard-locked to `api.afilmory.art` in release builds.

## Out of Scope

- Email/password **registration**, verification mail, and password reset.
- Sign in with Apple on `apps/web`.
- In-app workspace onboarding — the web escape hatch stands in until that feature is designed separately.
- The missing `@RequireAuth` on `POST /reactions/add` (`content/reaction/reaction.controller.ts`), which lets anonymous clients write reactions. A real gap, unrelated to submission.

## Non-Code Checklist

- App ID `app.afilmory` already has the Sign In with Apple capability enabled. `RELEASE.md:10` still says "explicit, no extra capabilities" — correct it, and re-run the TestFlight workflow once to confirm automatic signing still resolves a profile.
- Seed `review@afilmory.art`: active tenant, `owner` membership, a sample gallery with GPS-bearing photos (an empty Map tab reads as broken), and at least one comment thread.
- App Store Connect → App Review Information: sign-in required, the demo credentials, and notes covering the sponsorship IAP path through the profile sheet (`RELEASE.md:48`).
- Backend stays up for the whole review window.

## Verification

- `pnpm --filter core exec vitest run` for the deletion pipeline: owned-tenant cascade, pending-tenant deletion, reply re-parenting, and abort-on-failure leaving no partial state.
- Manual on-device pass: sign in with Apple on a fresh Apple ID → web onboarding → gallery; sign in with the demo account → Photos, Map, Studio all reachable; delete the account → verify `authUsers`, owned tenants, managed-storage prefix, and cross-tenant comments are all gone, and that a second sign-in creates a genuinely new user.
- `pnpm lint` and `pnpm type-check` scoped to changed files.
