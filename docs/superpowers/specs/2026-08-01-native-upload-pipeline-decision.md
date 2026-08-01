# Native upload pipeline — decision record

Status: agreed. Drop `expo-image-picker`; the pipeline moves to Swift end to end,
including the upload itself. No backend change is required.

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
2. `Caches/` is reclaimable. A long queue can outlive its own input files.

Owning selection in Swift keeps `PHAsset` identifiers and removes the copy.

## What is NOT a problem

**Image bytes never cross the bridge today.** Verified in React Native's source:
`Libraries/Network/FormData.js:91-100` returns a `{uri}` part as
`{...value, headers, fieldName}` — JS reads no file data — and
`Libraries/Network/RCTNetworking.mm:90` has native read the uri and stream the
file. So "large images over the bridge" is not the motivation for this work; the
disk duplication above is.

**Swift can consume SSE.** An earlier draft of this document claimed a background
`URLSession` cannot read a streaming response and concluded the server needed a
submit → `taskId` → poll contract. That was wrong and is retracted.
`URLSessionDataTask` with `URLSessionDataDelegate.urlSession(_:dataTask:didReceive:)`
receives bytes incrementally — that is how a native SSE client is written.

The one real restriction is narrow: a **background-configured** session does not
support data tasks, only upload and download tasks. Upload tasks still deliver
the response body to the data delegate, so even there the SSE bytes arrive; what
is unreliable is their *timing*, since callbacks are held until the app is woken
or relaunched. During that window nobody is watching a progress bar anyway, and
the final outcome still arrives.

**`be/apps/core` therefore needs no changes.** The existing SSE endpoint is
consumed directly from Swift.

## What moving to Swift commits us to

1. **The queue moves into Swift.** `uploadQueue.ts` / `uploadQueueModel.ts` were
   built around an in-JS serial runner driving `sendSseRequest`. Authority for
   retry, cancel and ordering becomes native; JS keeps at most a mirror of
   native task state for rendering.
2. **Hand every task to the daemon rather than stepping the queue from app code.**
   A serial "start the next job when this one finishes" loop depends on app
   runtime that a suspended app does not have. Enqueue all upload tasks to the
   background session and let `nsurlsessiond` schedule them. This gives up strict
   serial ordering, which measurement says costs little: per-request overhead is
   ~80 ms against ~1.4 s of per-file server work, so batching versus one-at-a-time
   differed by ~5% (9.11 s vs 8.63 s for six files).
3. **Swift receives the session cookie across the bridge.** JS passes it down,
   keeping `authStorage.ts` the single keychain reader. But a background session
   can resume after the app is reclaimed, when no JS exists to supply a fresh
   value, and a cookie handed over hours earlier may have rotated. Native must
   persist what it was given and reload it on a background relaunch — holding
   only an in-memory copy is what breaks.
4. **Retry classification is re-expressed natively.** Keep the tested behaviour:
   4xx is terminal, transport failures and 5xx retry with backoff. Port the
   behaviour, not the code.
5. **`uploadTags.ts` stays in JS.** The server only trims the directory field, so
   path sanitisation is client-side and must match the dashboard exactly. JS
   computes the directory string and passes it down; Swift must not reimplement
   the sanitiser.

## Live Activity / Dynamic Island

A Live Activity is a **presentation surface**, not an execution grant. It does
not keep the app running and cannot hold the queue open. What keeps an upload
alive in the background is the background `URLSession` above.

The two do pair well: background transfers are invisible otherwise, and task
completion briefly wakes the app via
`application(_:handleEventsForBackgroundURLSession:)` — enough runtime to update
the activity. With one request per photo, each completion is a natural update
tick.

Treat it as a separate increment, after background upload works. It needs a
Widget Extension target, which in an Expo prebuild project means a config plugin
or a hand-maintained target, and touches the existing release pipeline. Live
Activities also have an active-duration ceiling (~8 h) and update-frequency
budgets.

## Carried over

- `UploadReviewSheetView.swift` is written but never compiled, and its
  `UploadReviewImage` decodes whole images via `Data(contentsOf:)` before
  thumbnailing. Replace with `CGImageSourceCreateThumbnailAtIndex` +
  `kCGImageSourceThumbnailMaxPixelSize`; a grid of 25 MB RAWs will otherwise
  spike memory.
- `PhotoSheetsModule` still needs a `presentUploadReview` function.
- Cancel, failure and retry paths have never run against a real upload — only
  unit tests. Still owed after the rewrite.

## Unverified

- Timing of response delivery for upload tasks in a background session.
- Whether re-uploading after a lost response is idempotent.
  `collectExistingPhotoRecords` matches on `storageKey`, which suggests an update
  rather than a duplicate, but this has not been exercised.
- Reading `ph://` assets that are in iCloud but not downloaded locally.
