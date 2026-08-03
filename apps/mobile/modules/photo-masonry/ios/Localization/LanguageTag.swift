import Foundation

enum LanguageTag: String, CaseIterable, Codable, Sendable {
  case english = "en"
  case simplifiedChinese = "zh-CN"
  case hongKongChinese = "zh-HK"
  case traditionalChinese = "zh-TW"
  case japanese = "jp"
  case korean = "ko"

  static func resolve(_ value: String?) -> LanguageTag {
    let language = value?.replacingOccurrences(of: "_", with: "-").lowercased() ?? ""
    if language.hasPrefix("zh") {
      if language.contains("hk") || language.contains("mo") {
        return .hongKongChinese
      }
      if language.contains("tw") || language.contains("hant") {
        return .traditionalChinese
      }
      return .simplifiedChinese
    }
    if language.hasPrefix("ja") || language.hasPrefix("jp") {
      return .japanese
    }
    if language.hasPrefix("ko") {
      return .korean
    }
    return .english
  }

  var localeIdentifier: String {
    switch self {
    case .english:
      "en"
    case .simplifiedChinese:
      "zh-CN"
    case .hongKongChinese:
      "zh-HK"
    case .traditionalChinese:
      "zh-TW"
    case .japanese:
      "ja-JP"
    case .korean:
      "ko-KR"
    }
  }
}
