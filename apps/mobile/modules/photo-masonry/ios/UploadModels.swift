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
