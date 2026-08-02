import Foundation
import Security

struct AfilmorySessionSnapshot {
  let cookie: String?
  let platformBaseURL: String?
  let tenantBaseURL: String?
}

final class AfilmorySessionStore: @unchecked Sendable {
  static let shared = AfilmorySessionStore()

  private static let cookieService = "app.afilmory.session.cookie"
  private static let cookieAccount = "authenticated-session"

  private let lock = NSLock()
  private var platformBaseURL: String?
  private var tenantBaseURL: String?

  private init() {}

  func register(cookie: String) {
    let normalized = cookie.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalized.isEmpty else {
      clearSession()
      return
    }

    let query = Self.cookieQuery
    SecItemDelete(query as CFDictionary)

    var attributes = query
    attributes[kSecValueData as String] = Data(normalized.utf8)
    // Background upload retries can be recreated while the device is locked.
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let status = SecItemAdd(attributes as CFDictionary, nil)
    if status != errSecSuccess {
      NSLog("[AfilmorySessionStore] Unable to persist the session cookie: %d", status)
    }
  }

  func registerEnvironment(platformBaseURL: String, tenantBaseURL: String?) {
    lock.withLock {
      self.platformBaseURL = Self.normalizedBaseURL(platformBaseURL)
      self.tenantBaseURL = tenantBaseURL.flatMap(Self.normalizedBaseURL)
    }
  }

  func clearSession() {
    let status = SecItemDelete(Self.cookieQuery as CFDictionary)
    if status != errSecSuccess, status != errSecItemNotFound {
      NSLog("[AfilmorySessionStore] Unable to clear the session cookie: %d", status)
    }
    lock.withLock {
      platformBaseURL = nil
      tenantBaseURL = nil
    }
  }

  func current() -> AfilmorySessionSnapshot {
    let environment = lock.withLock { (platformBaseURL, tenantBaseURL) }
    return AfilmorySessionSnapshot(
      cookie: loadCookie(),
      platformBaseURL: environment.0,
      tenantBaseURL: environment.1
    )
  }

  func hasStoredCookie() -> Bool {
    loadCookie() != nil
  }

  private func loadCookie() -> String? {
    var query = Self.cookieQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data
    else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private static var cookieQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: cookieService,
      kSecAttrAccount as String: cookieAccount,
    ]
  }

  private static func normalizedBaseURL(_ value: String) -> String? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let components = URLComponents(string: trimmed),
          let scheme = components.scheme,
          scheme == "http" || scheme == "https",
          components.host != nil
    else { return nil }
    return trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }
}

private extension NSLock {
  func withLock<T>(_ operation: () throws -> T) rethrows -> T {
    lock()
    defer { unlock() }
    return try operation()
  }
}
