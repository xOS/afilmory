import Foundation

private struct ShareUploadBatchManifest: Decodable {
  let id: String
  let workspaceID: String
  let items: [ShareUploadBatchItem]
}

private struct ShareUploadBatchItem: Decodable {
  let id: String
  let relativePath: String
  let name: String
  let mimeType: String
}

private struct ShareUploadReceipt: Encodable {
  let status: String
  let count: Int
  let message: String?
  let updatedAt: Date
}

private enum ShareUploadBridgeError: LocalizedError {
  case invalidBatch
  case missingContext
  case missingSession
  case missingSharedContainer
  case workspaceChanged

  var errorDescription: String? {
    switch self {
    case .invalidBatch:
      "The shared upload is no longer available."
    case .missingContext:
      "Open Afilmory and select a workspace before uploading."
    case .missingSession:
      "Open Afilmory and sign in before uploading."
    case .missingSharedContainer:
      "Afilmory could not access its shared upload container."
    case .workspaceChanged:
      "The selected workspace changed. Review the shared photos and try again."
    }
  }
}

public enum ShareUploadIntentBridge {
  public static func start(batchID: String, tags: String) async throws {
    do {
      let count = try await startValidated(batchID: batchID, tags: tags)
      writeReceipt(batchID: batchID, status: "accepted", count: count, message: nil)
    } catch {
      writeReceipt(
        batchID: batchID,
        status: "failed",
        count: 0,
        message: error.localizedDescription
      )
      throw error
    }
  }

  private static func startValidated(batchID: String, tags: String) async throws -> Int {
    guard UUID(uuidString: batchID) != nil else { throw ShareUploadBridgeError.invalidBatch }
    guard AfilmorySessionStore.shared.current().cookie != nil else {
      throw ShareUploadBridgeError.missingSession
    }
    guard let context = ShareUploadContextStore.load() else {
      throw ShareUploadBridgeError.missingContext
    }
    guard let containerURL = ShareUploadContract.containerURL else {
      throw ShareUploadBridgeError.missingSharedContainer
    }

    let batchURL = containerURL
      .appendingPathComponent(ShareUploadContract.inboxDirectory, isDirectory: true)
      .appendingPathComponent(batchID, isDirectory: true)
    let manifestURL = batchURL.appendingPathComponent("manifest.json")
    let manifest = try JSONDecoder().decode(
      ShareUploadBatchManifest.self,
      from: Data(contentsOf: manifestURL)
    )
    guard manifest.id == batchID, !manifest.items.isEmpty else {
      throw ShareUploadBridgeError.invalidBatch
    }
    guard manifest.workspaceID == context.workspaceID else {
      throw ShareUploadBridgeError.workspaceChanged
    }

    let stagedFiles = try manifest.items.map { item -> UploadStagedFile in
      let fileURL = batchURL.appendingPathComponent(item.relativePath).standardizedFileURL
      let batchPath = batchURL.standardizedFileURL.path + "/"
      guard fileURL.path.hasPrefix(batchPath),
            FileManager.default.fileExists(atPath: fileURL.path)
      else { throw ShareUploadBridgeError.invalidBatch }
      return UploadStagedFile(
        id: item.id,
        url: fileURL,
        name: item.name,
        mimeType: item.mimeType
      )
    }

    let normalizedTags = UploadTagPath.parse(tags)
    let activityTitle = Localization.shared.value("studio.upload.activity.title")
    await MainActor.run {
      UploadActivityController.shared.setTitle(activityTitle)
    }
    let count = try UploadCenter.shared.enqueuePreparedFiles(
      endpoint: "\(context.tenantBaseURL)/photos/assets/upload",
      directory: UploadTagPath.directory(from: normalizedTags),
      items: stagedFiles
    )
    try? FileManager.default.removeItem(at: batchURL)
    await MainActor.run {
      UploadActivityController.shared.sync(jobs: UploadCenter.shared.currentJobs())
    }
    return count
  }

  private static func writeReceipt(
    batchID: String,
    status: String,
    count: Int,
    message: String?
  ) {
    guard UUID(uuidString: batchID) != nil,
          let containerURL = ShareUploadContract.containerURL
    else { return }
    let directory = containerURL.appendingPathComponent(
      ShareUploadContract.receiptDirectory,
      isDirectory: true
    )
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let receipt = ShareUploadReceipt(
      status: status,
      count: count,
      message: message,
      updatedAt: .now
    )
    guard let data = try? JSONEncoder().encode(receipt) else { return }
    try? data.write(
      to: directory.appendingPathComponent("\(batchID).json"),
      options: .atomic
    )
  }
}
