import XCTest

@testable import Afilmory

final class ExploreSegmentPolicyTests: XCTestCase {
  func testSignedOutAlwaysExplore() {
    XCTAssertEqual(resolveExploreDefaultSegment(isSignedIn: false, cachedHasSubscriptions: true), .explore)
  }

  func testCachedTrueOpensTimeline() {
    XCTAssertEqual(resolveExploreDefaultSegment(isSignedIn: true, cachedHasSubscriptions: true), .timeline)
  }

  func testMissingCacheOpensExplore() {
    XCTAssertEqual(resolveExploreDefaultSegment(isSignedIn: true, cachedHasSubscriptions: nil), .explore)
    XCTAssertEqual(resolveExploreDefaultSegment(isSignedIn: true, cachedHasSubscriptions: false), .explore)
  }

  func testFetchDoesNotOverrideAManualChoice() {
    XCTAssertEqual(
      resolveExploreSegmentAfterFetch(current: .explore, userHasChosen: true, hasSubscriptions: true),
      .explore
    )
  }

  func testFetchCalibratesWhenTheUserHasNotChosen() {
    XCTAssertEqual(
      resolveExploreSegmentAfterFetch(current: .explore, userHasChosen: false, hasSubscriptions: true),
      .timeline
    )
    XCTAssertEqual(
      resolveExploreSegmentAfterFetch(current: .timeline, userHasChosen: false, hasSubscriptions: false),
      .explore
    )
  }
}
