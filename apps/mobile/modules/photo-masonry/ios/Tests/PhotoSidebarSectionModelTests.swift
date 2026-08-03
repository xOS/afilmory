import XCTest
@testable import PhotoMasonry

final class PhotoSidebarSectionModelTests: XCTestCase {
  func testShowsUsefulQuickFiltersAndCounts() {
    let photos = [
      NativeFixtureTestSupport.photo(dateTaken: "2026-08-01T10:00:00Z", rating: 4),
      NativeFixtureTestSupport.photo(dateTaken: "2026-04-02T10:00:00Z", rating: 5),
      NativeFixtureTestSupport.photo(dateTaken: "2025-12-20T10:00:00Z", rating: 3),
    ]
    var filters = PhotoFilters.empty
    filters.datePreset = .thisMonth
    let items = PhotoSidebarSectionModel.quickFilters(
      photos: photos,
      filters: filters,
      labels: labels,
      now: NativeFixtureTestSupport.fixedNow,
      calendar: calendar
    )
    XCTAssertEqual(items.map(\.count), [1, 2, 2])
    XCTAssertEqual(items.map(\.id), ["thisMonth", "thisYear", "rating4"])
    XCTAssertEqual(items.map(\.selected), [true, false, false])
  }

  func testKeepsSelectedZeroResultQuickFilter() {
    var filters = PhotoFilters.empty
    filters.minRating = 4
    let items = PhotoSidebarSectionModel.quickFilters(
      photos: [],
      filters: filters,
      labels: labels,
      now: NativeFixtureTestSupport.fixedNow,
      calendar: calendar
    )
    XCTAssertEqual(items.map(\.id), ["rating4"])
    XCTAssertTrue(items[0].selected)
  }

  func testPinsSelectedTagsAndPreservesMissingSelections() {
    let result = PhotoSidebarSectionModel.tags(
      options: [
        PhotoFilterOption(value: "travel", count: 12),
        PhotoFilterOption(value: "street", count: 9),
        PhotoFilterOption(value: "film", count: 4),
        PhotoFilterOption(value: "night", count: 2),
      ],
      selectedTags: ["film", "archived"],
      limit: 3
    )
    XCTAssertEqual(result.items.map(\.count), [4, 0, 12])
    XCTAssertEqual(result.items.map(\.id), ["film", "archived", "travel"])
    XCTAssertEqual(result.items.map(\.selected), [true, true, false])
    XCTAssertTrue(result.hasMore)
  }

  func testDoesNotOfferAllTagsWhenEveryTagIsVisible() {
    let result = PhotoSidebarSectionModel.tags(
      options: [
        PhotoFilterOption(value: "travel", count: 3),
        PhotoFilterOption(value: "film", count: 2),
      ],
      selectedTags: []
    )
    XCTAssertFalse(result.hasMore)
  }

  private var labels: PhotoSidebarQuickFilterLabels {
    PhotoSidebarQuickFilterLabels(rating4: "4+", thisMonth: "Month", thisYear: "Year")
  }

  private var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = NativeFixtureTestSupport.singapore
    return calendar
  }
}
