import Foundation

struct ShareUploadContextSnapshot: Codable {
  let tenantBaseURL: String
  let workspaceID: String
  let workspaceName: String
  let suggestedTags: [String]
  let updatedAt: Date
}

struct ShareUploadBatchManifest: Codable {
  let id: String
  let workspaceID: String
  let createdAt: Date
  var items: [ShareUploadBatchItem]
}

struct ShareUploadBatchItem: Codable, Identifiable, Equatable {
  let id: String
  let relativePath: String
  let previewRelativePath: String?
  let name: String
  let mimeType: String
  let bytes: Int64
}

struct ShareUploadReceipt: Decodable {
  let status: String
  let count: Int
  let message: String?
  let updatedAt: Date
}

enum ShareUploadPhase: Equatable {
  case idle
  case loading
  case ready
  case unavailable
  case failed
}

enum ShareUploadError: LocalizedError {
  case missingContainer
  case noImages
  case unreadableImage

  var errorDescription: String? {
    switch self {
    case .missingContainer:
      "Afilmory could not access its shared upload container."
    case .noImages:
      "No supported images were provided."
    case .unreadableImage:
      "One of the shared images could not be read."
    }
  }
}
