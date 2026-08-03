import AppIntents

#if canImport(PhotoMasonry)
internal import PhotoMasonry
#endif

struct StartShareUploadIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Upload shared photos"
  static let description = IntentDescription("Adds photos from the share sheet to the Afilmory upload queue.")
  static var isDiscoverable: Bool { false }
  static var supportedModes: IntentModes { .background }

  @Parameter(title: "Batch", default: "")
  var batchID: String

  @Parameter(title: "Tags", default: "")
  var tags: String

  init() {}

  init(batchID: String, tags: String) {
    self.batchID = batchID
    self.tags = tags
  }

  func perform() async throws -> IntentResultContainer<Never, Never, Never, Never> {
    #if canImport(PhotoMasonry)
    try await ShareUploadIntentBridge.start(batchID: batchID, tags: tags)
    return .result()
    #else
    throw StartShareUploadIntentError.mainAppRequired
    #endif
  }
}

private enum StartShareUploadIntentError: LocalizedError {
  case mainAppRequired

  var errorDescription: String? {
    "Afilmory could not start its upload process."
  }
}
