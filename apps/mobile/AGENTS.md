# Mobile App Agent Guidelines

## Agent Testing

Use the **Local** application variant for Simulator-based Agent Testing unless the task explicitly
requires validating production-only capabilities.

| Property | Local Agent Testing value |
| --- | --- |
| App name | `Afilmory Local` |
| Bundle identifier | `app.afilmory.local` |
| URL scheme | `afilmory-local` |
| Default API | `http://localhost:1841` |
| Authentication | Local password account |

- Build and launch it with `pnpm --filter @afilmory/mobile ios:local`.
- Start the local Core service before testing authentication or API-backed flows. A connection
  failure to port `1841` means the app selected the correct environment but the backend is not
  running.
- Confirm that the Simulator target is `Afilmory Local`; the production `Afilmory` app may be
  installed at the same time and must not be used accidentally.
- Do not attempt Sign in with Apple in the Local variant. Push notifications, Share Extension,
  widgets, Live Activities, and StoreKit sponsorship are also production-only.
- Debug builds may temporarily change the API environment from Lab. Reset it to **Local** after a
  custom-environment test so later Agent Testing starts from the variant default.
- Treat `apps/mobile/ios` and `apps/mobile/android` as generated output. Make persistent changes in
  `app.config.ts`, config plugins, Expo modules, or `targets/`, then regenerate the native project.

## Verification

Run the smallest relevant checks first:

```bash
pnpm --filter @afilmory/mobile variant:test
pnpm --filter @afilmory/mobile type-check
pnpm --filter @afilmory/mobile bundle
```

For Local runtime changes, perform at least one Simulator build and verify that requests target
`localhost:1841`.

The native test setup currently expects the Production-generated `Afilmory` Xcode target. After a
Local run, regenerate Production before executing native tests:

```bash
cd apps/mobile
pnpm native:locales
AFILMORY_APP_VARIANT=production pnpm exec expo prebuild -p ios --clean
pnpm native:test
```

Use `pnpm --filter @afilmory/mobile ios:production` only when the task explicitly requires running
the production application or validating production-only integrations.
