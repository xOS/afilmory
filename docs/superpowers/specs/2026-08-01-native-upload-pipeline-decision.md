# Native upload pipeline — decision record

Status: agreed. Drop `expo-image-picker`; the pipeline moves to Swift end to end,
including the upload itself (fork B below).

## Why the JS picker is being dropped

`expo-image-picker` copies every selected asset into the app's cache before it
returns. From `node_modules/expo-image-picker/ios/MediaHandler.swift:490-498`:

```swift
private func generateUrl(withFileExtension: String) throws -> URL {
  let directory = fileSystem.cachesDirectory.appending(... + "/ImagePicker")
  let path = fileSystem.generatePath(inDirectory: directory, ...)
  return URL(fileURLWithPath: path)
}
```

Every `uri:` in that file resolves through `generateUrl` or an already-cached
copy. There is no option that yields a `ph://` identifier. Two consequences:

1. Picking 50 × 25 MB RAW duplicates 1.25 GB into `Caches/` before a byte is sent.
2. `Caches/` is reclaimable. A long queue can outlive its own input files — the
   queue detects this (`payloads.get(id)` misses → "The picked file is no longer
   available") but cannot prevent it.

Owning selection in Swift keeps `PHAsset` identifiers and removes the copy.

## What is NOT a problem

Image bytes never cross the bridge today, so "large images over the bridge" is
not the motivation. Verified in React Native's own source:

- `Libraries/Network/FormData.js:91-100` — a `{uri}` part is returned as
  `{...value, headers, fieldName}`; JS reads no file data.
- `Libraries/Network/RCTNetworking.mm:90` — native reads `_parts[i]["uri"]` and
  streams the file itself.

The Swift review sheet is likewise strings-only in both directions.

## Open fork — resolve before wiring the module

Once Swift owns selection it holds `PHAsset`, not a file, and handing that off
splits two ways:

**A. Keep uploading through RN `FormData`, passing `ph://`.**
`RCTNetworking.mm:91` rewrites a `ph:` prefix to `RCTNetworkingPHUploadHackScheme`,
so RN can read PhotoKit assets directly. Queue, retry and the SSE progress
contract stay untouched. Unverified: Live Photo pairing, RAW, and iCloud assets
that are not downloaded locally. The scheme is named "hack" in RN's own source —
treat support as unproven until a spike says otherwise.

**B. Upload from Swift.** `PHAssetResourceManager.writeData(for:toFile:)` streams
into `URLSession`, so there is no copy and no bridge at all. But a background
`URLSession` cannot consume a streaming response, which reopens the decision
already taken in `2026-08-01-local-docker-dev-env-design.md` — foreground-only
reliability was chosen precisely to avoid rewriting the server's SSE progress
endpoint into submit-then-poll.

**B was chosen.** It knowingly overturns the foreground-only decision, so that
earlier spec's Verification item 10 no longer describes the intended design.

### What B commits us to

1. **The server needs a non-streaming progress contract.** A background
   `URLSession` cannot consume a streaming response, so `POST /photos/assets/upload`
   must gain a submit → `taskId` → poll path alongside (or instead of) its SSE
   response. This is a `be/apps/core` change, not just a mobile one.
2. **The queue moves into Swift.** `uploadQueue.ts` / `uploadQueueModel.ts` were
   built around an in-JS serial runner driving `sendSseRequest`. Under B the
   authority for retry, cancel and ordering is native; JS keeps at most a mirror
   of native task state for rendering.
3. **Swift needs the session cookie.** The Better Auth cookie currently lives in
   JS memory (`getAuthCookie()`), hydrated from the keychain by `authStorage.ts`.
   Native upload tasks must either receive it per request or read the keychain
   directly. Whichever is picked, it becomes a second reader of that value —
   keep the storage key in one place.
4. **Retry classification must be re-expressed natively.** The rule worth keeping
   is the tested one: 4xx is terminal, transport failures and 5xx retry with
   backoff. Port the behaviour, not the code.
5. `uploadTags.ts` still owns directory derivation. JS computes the directory
   string and passes it down; Swift must not reimplement the sanitiser.

## Carried over regardless of the fork

- `uploadTags.ts` and its tests stay in JS. The server only trims the directory
  field, so path sanitisation is client-side and must match the dashboard
  exactly; do not reimplement it in Swift.
- `uploadQueue.ts` / `uploadQueueModel.ts` are UI-independent and survive either
  option under fork A.
- `UploadReviewSheetView.swift` currently decodes whole images via
  `Data(contentsOf:)` before thumbnailing. Replace with
  `CGImageSourceCreateThumbnailAtIndex` + `kCGImageSourceThumbnailMaxPixelSize`;
  a grid of 25 MB RAWs will otherwise spike memory. Independent of the fork.
- The native sheet is written but not wired: `PhotoSheetsModule` still needs
  `presentUploadReview`, and nothing has been compiled yet.
