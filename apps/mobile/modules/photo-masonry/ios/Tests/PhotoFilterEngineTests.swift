import XCTest
@testable import PhotoMasonry

final class PhotoFilterEngineTests: XCTestCase {
  private struct Fixture: Decodable {
    struct Case: Decodable {
      let name: String
      let filters: PhotoFilters
      let ids: [String]
    }

    let cases: [Case]
    let options: PhotoFilterOptions
  }

  func testMatchesGoldenFilterCases() throws {
    let photos = try NativeFixtureTestSupport.decode([GalleryPhoto].self, name: "expected-normalized")
    let fixture = try NativeFixtureTestSupport.decode(Fixture.self, name: "expected-filters")
    XCTAssertEqual(PhotoFilterEngine.buildOptions(photos), fixture.options)
    for entry in fixture.cases {
      XCTAssertEqual(PhotoFilterEngine.apply(entry.filters, to: photos).map(\.id), entry.ids, entry.name)
    }
  }

  func testPresetRangeUsesInjectedNow() {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = NativeFixtureTestSupport.singapore
    let range = PhotoFilterEngine.presetRange(
      .last7,
      now: NativeFixtureTestSupport.fixedNow,
      calendar: calendar
    )
    XCTAssertEqual(range.from, "2026-07-28")
    XCTAssertEqual(range.to, "2026-08-03")
  }
}
