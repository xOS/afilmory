import Foundation
import UniformTypeIdentifiers

actor ShareUploadBatchStore {
  static let appGroupIdentifier = "group.app.afilmory"
  static let contextKey = "share-upload.context.v1"
  static let inboxDirectory = "share-upload/inbox"
  static let receiptDirectory = "share-upload/receipts"

  nonisolated let batchID: String
  private let workspaceID: String
  private let containerURL: URL
  private let batchURL: URL
  private var items: [ShareUploadBatchItem] = []

  init(workspaceID: String) throws {
    guard let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
    ) else { throw ShareUploadError.missingContainer }
    let batchID = UUID().uuidString
    self.batchID = batchID
    self.workspaceID = workspaceID
    self.containerURL = containerURL
    self.batchURL = containerURL
      .appendingPathComponent(Self.inboxDirectory, isDirectory: true)
      .appendingPathComponent(batchID, isDirectory: true)
    try FileManager.default.createDirectory(
      at: batchURL.appendingPathComponent("files", isDirectory: true),
      withIntermediateDirectories: true
    )
    try FileManager.default.createDirectory(
      at: batchURL.appendingPathComponent("previews", isDirectory: true),
      withIntermediateDirectories: true
    )
    let manifest = ShareUploadBatchManifest(
      id: batchID,
      workspaceID: workspaceID,
      createdAt: .now,
      items: []
    )
    let data = try JSONEncoder().encode(manifest)
    try data.write(to: batchURL.appendingPathComponent("manifest.json"), options: .atomic)
  }

  static func loadContext() -> ShareUploadContextSnapshot? {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier),
          let data = defaults.data(forKey: contextKey)
    else { return nil }
    return try? JSONDecoder().decode(ShareUploadContextSnapshot.self, from: data)
  }

  static func cleanupStaleContent() {
    guard let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupIdentifier
    ) else { return }
    let cutoff = Date.now.addingTimeInterval(-86_400)
    for relativeDirectory in [inboxDirectory, receiptDirectory] {
      let directory = containerURL.appendingPathComponent(relativeDirectory, isDirectory: true)
      guard let children = try? FileManager.default.contentsOfDirectory(
        at: directory,
        includingPropertiesForKeys: [.contentModificationDateKey],
        options: [.skipsHiddenFiles]
      ) else { continue }
      for child in children {
        let values = try? child.resourceValues(forKeys: [.contentModificationDateKey])
        if values?.contentModificationDate.map({ $0 < cutoff }) ?? false {
          try? FileManager.default.removeItem(at: child)
        }
      }
    }
  }

  func stage(_ provider: NSItemProvider) async throws -> ShareUploadBatchItem {
    guard let type = preferredImageType(for: provider) else {
      throw ShareUploadError.unreadableImage
    }
    let itemID = UUID().uuidString
    let extensionName = type.preferredFilenameExtension ?? "img"
    let sourceName = normalizedFilename(
      provider.suggestedName,
      fallback: "Photo-\(items.count + 1)",
      extensionName: extensionName
    )
    let relativePath = "files/\(itemID).\(extensionName)"
    let destinationURL = batchURL.appendingPathComponent(relativePath)

    try await copyRepresentation(
      provider: provider,
      typeIdentifier: type.identifier,
      destinationURL: destinationURL
    )

    let previewRelativePath = "previews/\(itemID).jpg"
    let previewURL = batchURL.appendingPathComponent(previewRelativePath)
    ShareThumbnailGenerator.write(sourceURL: destinationURL, destinationURL: previewURL)
    let bytes = ((try? destinationURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
    let item = ShareUploadBatchItem(
      id: itemID,
      relativePath: relativePath,
      previewRelativePath: FileManager.default.fileExists(atPath: previewURL.path)
        ? previewRelativePath
        : nil,
      name: sourceName,
      mimeType: type.preferredMIMEType ?? "application/octet-stream",
      bytes: Int64(bytes)
    )
    items.append(item)
    try writeManifest()
    return item
  }

  func remove(itemID: String) throws {
    guard let index = items.firstIndex(where: { $0.id == itemID }) else { return }
    let item = items.remove(at: index)
    try? FileManager.default.removeItem(at: batchURL.appendingPathComponent(item.relativePath))
    if let previewRelativePath = item.previewRelativePath {
      try? FileManager.default.removeItem(at: batchURL.appendingPathComponent(previewRelativePath))
    }
    try writeManifest()
  }

  func previewURL(for item: ShareUploadBatchItem) -> URL? {
    guard let previewRelativePath = item.previewRelativePath else { return nil }
    return batchURL.appendingPathComponent(previewRelativePath)
  }

  func readReceipt() -> ShareUploadReceipt? {
    let url = containerURL
      .appendingPathComponent(Self.receiptDirectory, isDirectory: true)
      .appendingPathComponent("\(batchID).json")
    guard let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(ShareUploadReceipt.self, from: data)
  }

  func removeReceipt() {
    let url = containerURL
      .appendingPathComponent(Self.receiptDirectory, isDirectory: true)
      .appendingPathComponent("\(batchID).json")
    try? FileManager.default.removeItem(at: url)
  }

  func cleanup() {
    try? FileManager.default.removeItem(at: batchURL)
    removeReceipt()
  }

  private func preferredImageType(for provider: NSItemProvider) -> UTType? {
    let types = provider.registeredTypeIdentifiers.compactMap(UTType.init)
    return types.first { $0.conforms(to: .image) && $0 != .image }
      ?? types.first { $0.conforms(to: .image) }
  }

  private func normalizedFilename(
    _ suggestedName: String?,
    fallback: String,
    extensionName: String
  ) -> String {
    let raw = suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines)
    let base = ((raw?.isEmpty == false ? raw : nil) ?? fallback)
      .replacingOccurrences(of: "/", with: "-")
      .replacingOccurrences(of: "\\", with: "-")
    return (base as NSString).pathExtension.isEmpty ? "\(base).\(extensionName)" : base
  }

  private func copyRepresentation(
    provider: NSItemProvider,
    typeIdentifier: String,
    destinationURL: URL
  ) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { sourceURL, error in
        do {
          if let error { throw error }
          guard let sourceURL else { throw ShareUploadError.unreadableImage }
          try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
          continuation.resume()
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private func writeManifest() throws {
    let manifest = ShareUploadBatchManifest(
      id: batchID,
      workspaceID: workspaceID,
      createdAt: .now,
      items: items
    )
    let data = try JSONEncoder().encode(manifest)
    try data.write(to: batchURL.appendingPathComponent("manifest.json"), options: .atomic)
  }
}
