# iOS Release

CI: `.github/workflows/mobile-testflight.yml` — prebuild → archive → upload to TestFlight.
Trigger: push a `mobile-v*` tag, or run manually via workflow_dispatch.

## One-time setup

### Apple Developer portal ([developer.apple.com](https://developer.apple.com/account))

1. **Identifiers → +** — register App ID `app.afilmory` (explicit, no extra capabilities).
2. **Certificates** — create an **Apple Distribution** certificate. Easiest via Xcode:
   Settings → Accounts → team → Manage Certificates → + → Apple Distribution.
   Then export it from Keychain Access as `.p12` with a password.
3. **Profiles → +** — create an **App Store Connect** distribution profile for
   `app.afilmory` using that certificate. Download the `.mobileprovision`.

### App Store Connect ([appstoreconnect.apple.com](https://appstoreconnect.apple.com))

4. **My Apps → + → New App** — platform iOS, bundle ID `app.afilmory`,
   name `Afilmory`, SKU `afilmory-ios`.
5. **Users and Access → Integrations → App Store Connect API → Team Keys → +** —
   role **App Manager**. Note the Key ID and Issuer ID, download the `.p8`
   (downloadable only once).

### GitHub secrets (repo → Settings → Secrets → Actions)

| Secret | Value |
| --- | --- |
| `IOS_DIST_CERT_P12` | `base64 -i dist.p12 \| pbcopy` |
| `IOS_DIST_CERT_PASSWORD` | password chosen when exporting the `.p12` |
| `IOS_APPSTORE_PROFILE` | `base64 -i profile.mobileprovision \| pbcopy` |
| `ASC_KEY_ID` | API key ID |
| `ASC_ISSUER_ID` | API key issuer ID |
| `ASC_API_KEY_P8` | raw contents of the `.p8` file |

### First submission only

- App Privacy declarations (account data: email/name via sign-in; photos the user uploads).
- Privacy policy URL + support URL (App Information).
- Screenshots: 6.9" iPhone set (capture on iPhone Pro Max simulator).
- App Review: demo account credentials — the app requires sign-in.

## Per release

1. Bump `expo.version` in `app.json` (build number is set by CI from the run number —
   `ios.buildNumber` in `app.json` is only a local fallback).
2. Tag and push:

   ```bash
   git tag mobile-v1.0 && git push origin mobile-v1.0
   ```

3. Wait for the workflow, then check App Store Connect → TestFlight
   (processing takes 5–30 min). Export compliance is pre-declared
   (`usesNonExemptEncryption: false`), so builds go live for internal testers
   without questions.
4. Ship to external TestFlight testers first; submit for App Store review from
   the ASC UI once stable.
