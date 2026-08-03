import Foundation
import Security

struct AfilmorySessionSnapshot: Sendable {
  let cookie: String?
  let platformBaseURL: String?
  let tenantBaseURL: String?
  let state: AfilmorySessionState
}

final class AfilmorySessionStore: @unchecked Sendable {
  static let shared = AfilmorySessionStore()

  private static let cookieService = "app.afilmory.session.cookie"
  private static let cookieAccount = "authenticated-session"

  private let lock = NSLock()
  private var platformBaseURL: String?
  private var tenantBaseURL: String?
  private var state: AfilmorySessionState
  private var observers: [UUID: @Sendable (AfilmorySessionState) -> Void] = [:]
  private var refreshTask: Task<Void, Never>?
  private var refreshGeneration: UInt64 = 0
  private var bootstrapped = false

  private init() {
    let environment = ApiEnvironmentStore.storedOrProduction()
    platformBaseURL = environment.platformAPIBaseURL().absoluteString
    tenantBaseURL = nil
    state = Self.readCookie() == nil ? .signedOut : .loading
  }

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
    refreshSession()
  }

  func registerEnvironment(platformBaseURL: String, tenantBaseURL: String?) {
    lock.withLock {
      self.platformBaseURL = Self.normalizedBaseURL(platformBaseURL)
      self.tenantBaseURL = tenantBaseURL.flatMap(Self.normalizedBaseURL)
    }
  }

  func clearSession() {
    APNsRegistrationCoordinator.unregisterCurrentDevice(using: current())
    deleteCookie()
    ShareUploadContextStore.clear()
    let observers = lock.withLock { () -> [@Sendable (AfilmorySessionState) -> Void] in
      refreshGeneration &+= 1
      refreshTask?.cancel()
      refreshTask = nil
      tenantBaseURL = nil
      state = .signedOut
      return Array(self.observers.values)
    }
    ApiEnvironmentStore.shared.activateTenant(slug: nil)
    notify(observers, state: .signedOut)
  }

  func current() -> AfilmorySessionSnapshot {
    let environment = lock.withLock { (platformBaseURL, tenantBaseURL) }
    return AfilmorySessionSnapshot(
      cookie: loadCookie(),
      platformBaseURL: environment.0,
      tenantBaseURL: environment.1,
      state: lock.withLock { state }
    )
  }

  func bootstrap() {
    let shouldRefresh = lock.withLock { () -> Bool in
      guard !bootstrapped else { return false }
      bootstrapped = true
      return true
    }
    guard shouldRefresh else { return }
    refreshSession()
  }

  func refreshSession() {
    guard loadCookie() != nil else {
      publish(.signedOut)
      return
    }

    let generation = lock.withLock { () -> UInt64 in
      refreshGeneration &+= 1
      refreshTask?.cancel()
      state = .loading
      return refreshGeneration
    }
    publishCurrent()

    let task = Task { [weak self] in
      guard let self else { return }
      do {
        let endpoint = APIEndpoint(baseURL: .platform, path: "auth/session")
        let response: AfilmorySessionResponse? = try await AfilmoryAPI.shared.request(endpoint)
        guard !Task.isCancelled else { return }
        if let session = response?.resolved() {
          ApiEnvironmentStore.shared.activateTenant(slug: session.activeWorkspace?.slug)
          completeRefresh(generation: generation, state: .signedIn(session))
        } else {
          APNsRegistrationCoordinator.unregisterCurrentDevice(using: current())
          deleteCookie()
          ApiEnvironmentStore.shared.activateTenant(slug: nil)
          completeRefresh(generation: generation, state: .signedOut)
        }
      } catch APIError.unauthorized {
        APNsRegistrationCoordinator.unregisterCurrentDevice(using: current())
        deleteCookie()
        ApiEnvironmentStore.shared.activateTenant(slug: nil)
        completeRefresh(generation: generation, state: .signedOut)
      } catch APIError.cancelled {
        return
      } catch {
        completeRefresh(generation: generation, state: .failed(error.localizedDescription))
      }
    }
    lock.withLock {
      if generation == refreshGeneration {
        refreshTask = task
      } else {
        task.cancel()
      }
    }
  }

  func observe(
    _ observer: @escaping @Sendable (AfilmorySessionState) -> Void
  ) -> AfilmorySessionObservationToken {
    let id = UUID()
    let currentState = lock.withLock { () -> AfilmorySessionState in
      observers[id] = observer
      return state
    }
    observer(currentState)
    return AfilmorySessionObservationToken { [weak self] in
      _ = self?.lock.withLock {
        self?.observers.removeValue(forKey: id)
      }
    }
  }

  func hasStoredCookie() -> Bool {
    loadCookie() != nil
  }

  private func loadCookie() -> String? {
    Self.readCookie()
  }

  private static func readCookie() -> String? {
    var query = Self.cookieQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data
    else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private func deleteCookie() {
    let status = SecItemDelete(Self.cookieQuery as CFDictionary)
    if status != errSecSuccess, status != errSecItemNotFound {
      NSLog("[AfilmorySessionStore] Unable to clear the session cookie: %d", status)
    }
  }

  private func completeRefresh(generation: UInt64, state: AfilmorySessionState) {
    let observers = lock.withLock { () -> [@Sendable (AfilmorySessionState) -> Void] in
      guard generation == refreshGeneration else { return [] }
      refreshTask = nil
      self.state = state
      return Array(self.observers.values)
    }
    if let session = state.session {
      ShareUploadContextStore.update(session: session)
    } else if state == .signedOut {
      ShareUploadContextStore.clear()
    }
    notify(observers, state: state)
  }

  private func publish(_ state: AfilmorySessionState) {
    let observers = lock.withLock { () -> [@Sendable (AfilmorySessionState) -> Void] in
      self.state = state
      return Array(self.observers.values)
    }
    notify(observers, state: state)
  }

  private func publishCurrent() {
    let snapshot = lock.withLock { (state, Array(observers.values)) }
    notify(snapshot.1, state: snapshot.0)
  }

  private func notify(
    _ observers: [@Sendable (AfilmorySessionState) -> Void],
    state: AfilmorySessionState
  ) {
    for observer in observers {
      observer(state)
    }
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
