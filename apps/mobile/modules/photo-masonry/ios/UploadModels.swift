import ExpoModulesCore
import Foundation
import Security

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
  @Field var cookie: String = ""
  @Field var directory: String?
  @Field var activityTitle: String = ""
  @Field var items: [UploadEnqueueItemRecord] = []
}

enum UploadCookieStore {
  private static let service = "app.afilmory.upload.cookie"

  static func save(_ cookie: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
    ]
    SecItemDelete(query as CFDictionary)
    var attributes = query
    attributes[kSecValueData as String] = Data(cookie.utf8)
    // Retry tasks can be created from a background relaunch while the device
    // is locked, so the default whenUnlocked accessibility would lose the
    // cookie exactly when the queue needs it.
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    SecItemAdd(attributes as CFDictionary, nil)
  }

  static func load() -> String? {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
    ]
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data
    else { return nil }
    return String(data: data, encoding: .utf8)
  }
}
