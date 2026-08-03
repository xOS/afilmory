import Foundation

private final class AfilmoryLocalesBundleToken {}

struct Localization: Sendable {
  static let shared = Localization(
    language: LanguageTag.resolve(Locale.preferredLanguages.first)
  )

  let language: LanguageTag
  private let current: [String: String]
  private let english: [String: String]

  init(language: LanguageTag, bundle: Bundle? = nil) {
    self.language = language
    let resourceBundle = bundle ?? Self.resourceBundle
    english = Self.catalog(language: .english, bundle: resourceBundle)
    current = language == .english ? english : Self.catalog(language: language, bundle: resourceBundle)
  }

  static func t(
    _ key: String,
    _ arguments: [String: String] = [:],
    count: Int? = nil,
    defaultValue: String? = nil
  ) -> String {
    shared.value(key, arguments: arguments, count: count, defaultValue: defaultValue)
  }

  func value(
    _ key: String,
    arguments: [String: String] = [:],
    count: Int? = nil,
    defaultValue: String? = nil
  ) -> String {
    let resolvedKey: String
    if let count {
      let candidate = "\(key)_\(PluralRule.category(language: language, count: count).rawValue)"
      resolvedKey = current[candidate] != nil || english[candidate] != nil ? candidate : key
    } else {
      resolvedKey = key
    }
    var result = current[resolvedKey] ?? english[resolvedKey] ?? defaultValue ?? resolvedKey
    var values = arguments
    if let count {
      values["count"] = String(count)
    }
    for (name, value) in values {
      result = result.replacingOccurrences(of: "{{\(name)}}", with: value)
    }
    return result
  }

  private static var resourceBundle: Bundle {
    let owner = Bundle(for: AfilmoryLocalesBundleToken.self)
    for candidate in [owner, .main] {
      if let url = candidate.url(forResource: "AfilmoryLocales", withExtension: "bundle"),
         let bundle = Bundle(url: url)
      {
        return bundle
      }
    }
    return owner
  }

  private static func catalog(language: LanguageTag, bundle: Bundle) -> [String: String] {
    var result: [String: String] = [:]
    for namespace in ["app", "mobile"] {
      guard let url = bundle.url(
        forResource: "\(namespace)-\(language.rawValue)",
        withExtension: "json"
      ),
      let data = try? Data(contentsOf: url),
      let values = try? JSONDecoder().decode([String: String].self, from: data)
      else { continue }
      result.merge(values) { _, mobile in mobile }
    }
    return result
  }
}
