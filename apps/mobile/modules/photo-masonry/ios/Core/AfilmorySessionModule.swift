import ExpoModulesCore

public final class AfilmorySessionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AfilmorySession")

    Function("registerSession") { (cookie: String) in
      AfilmorySessionStore.shared.register(cookie: cookie)
    }

    Function("registerEnvironment") { (platformBaseURL: String, tenantBaseURL: String?) in
      AfilmorySessionStore.shared.registerEnvironment(
        platformBaseURL: platformBaseURL,
        tenantBaseURL: tenantBaseURL
      )
    }

    Function("clearSession") {
      AfilmorySessionStore.shared.clearSession()
    }

    Function("hasStoredCookie") {
      AfilmorySessionStore.shared.hasStoredCookie()
    }
  }
}
