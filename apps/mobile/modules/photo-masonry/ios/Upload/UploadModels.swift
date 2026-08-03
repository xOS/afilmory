import ExpoModulesCore
import Foundation

enum UploadJobStatus: String, Codable {
  case queued
  case uploading
  case processing
  case done
  case failed
  case cancelled

  var isActive: Bool {
    self == .queued || self == .uploading || self == .processing
  }
}

struct UploadServerLogLine: Codable, Hashable {
  var message: String
  var level: String
}

struct UploadStagedFile {
  let url: URL
  let name: String
  let mimeType: String
}

struct UploadStagedAsset {
  let id: String
  let photo: UploadStagedFile
  let pairedVideo: UploadStagedFile?

  init(id: String, photo: UploadStagedFile, pairedVideo: UploadStagedFile? = nil) throws {
    if let pairedVideo {
      let photoBase = Self.normalizedBaseName(photo.name)
      let videoBase = Self.normalizedBaseName(pairedVideo.name)
      guard !photoBase.isEmpty, photoBase == videoBase else {
        throw UploadPrepareError.mismatchedLivePhotoResources
      }
    }
    self.id = id
    self.photo = photo
    self.pairedVideo = pairedVideo
  }

  var files: [UploadStagedFile] {
    if let pairedVideo {
      return [photo, pairedVideo]
    }
    return [photo]
  }

  private static func normalizedBaseName(_ filename: String) -> String {
    let leaf = (filename as NSString).lastPathComponent
    return (leaf as NSString)
      .deletingPathExtension
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
  }
}

struct UploadJobState: Codable {
  let id: String
  let assetId: String
  var name: String
  var bytes: Int64
  var status: UploadJobStatus
  var progress: Double
  var attempt: Int
  var error: String?
  var serverLogs: [UploadServerLogLine]?
  var endpoint: String
  var directory: String?
  var boundary: String

  var latestServerLog: String? {
    serverLogs?.last?.message
  }
}

struct UploadEnqueueItemRecord: Record {
  @Field var id: String = ""
  @Field var name: String = ""
}

struct UploadEnqueueRecord: Record {
  @Field var endpoint: String = ""
  @Field var directory: String?
  @Field var activityTitle: String = ""
  @Field var items: [UploadEnqueueItemRecord] = []
}
