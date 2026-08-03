import XCTest
@testable import PhotoMasonry

final class LocalizationTests: XCTestCase {
  func testResolvesLanguageTags() {
    XCTAssertEqual(LanguageTag.resolve("zh-Hant-TW"), .traditionalChinese)
    XCTAssertEqual(LanguageTag.resolve("zh-MO"), .hongKongChinese)
    XCTAssertEqual(LanguageTag.resolve("ja-JP"), .japanese)
    XCTAssertEqual(LanguageTag.resolve("ko_KR"), .korean)
    XCTAssertEqual(LanguageTag.resolve("fr-FR"), .english)
  }

  func testInterpolatesAndUsesEnglishFallback() {
    let localization = Localization(language: .japanese)
    XCTAssertFalse(localization.value("accessibility.profile", arguments: ["name": "Afilmory"]).contains("{{name}}"))
    XCTAssertEqual(localization.value("missing.fixture.key"), "missing.fixture.key")
  }

  func testMobileCatalogOverridesAppCatalog() {
    XCTAssertEqual(Localization(language: .english).value("comments.cancelReply"), "Cancel reply")
  }

  func testChineseCountOneUsesOtherPlural() {
    let localization = Localization(language: .simplifiedChinese)
    let expected = localization.value("accessibility.filtersActive_other", arguments: ["count": "1"])
    XCTAssertEqual(localization.value("accessibility.filtersActive", count: 1), expected)
    XCTAssertEqual(PluralRule.category(language: .simplifiedChinese, count: 1), .other)
    XCTAssertEqual(PluralRule.category(language: .japanese, count: 1), .other)
    XCTAssertEqual(PluralRule.category(language: .korean, count: 1), .other)
    XCTAssertEqual(PluralRule.category(language: .english, count: 1), .one)
  }
}
