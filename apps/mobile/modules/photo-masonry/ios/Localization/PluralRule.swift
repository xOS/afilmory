enum PluralCategory: String, Sendable {
  case one
  case other
}

enum PluralRule {
  static func category(language: LanguageTag, count: Int) -> PluralCategory {
    language == .english && count == 1 ? .one : .other
  }
}
