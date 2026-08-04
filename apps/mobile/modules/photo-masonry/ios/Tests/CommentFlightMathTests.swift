import XCTest
@testable import PhotoMasonry

final class CommentFlightMathTests: XCTestCase {
  func testMorphBeginsAtTheCompleteComposerRectAndEndsAtTheBubbleRect() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 40)
    let target = CGRect(x: 180, y: 320, width: 120, height: 44)

    let start = CommentFlightMath.interpolatedRect(from: origin, to: target, progress: 0)
    let end = CommentFlightMath.interpolatedRect(from: origin, to: target, progress: 1)

    XCTAssertEqual(start, origin)
    XCTAssertEqual(end, target)
  }

  func testMorphShrinksAndFliesDuringTheSameProgressInterval() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 40)
    let target = CGRect(x: 250, y: 320, width: 120, height: 44)

    let midpoint = CommentFlightMath.interpolatedRect(
      from: origin,
      to: target,
      progress: 0.5
    )

    XCTAssertEqual(midpoint.width, 240)
    XCTAssertEqual(midpoint.height, 42)
    XCTAssertEqual(midpoint.minX, 131)
    XCTAssertEqual(midpoint.minY, 410 - CommentFlightMath.lift)
    XCTAssertEqual(midpoint.maxX, (origin.maxX + target.maxX) / 2)
  }

  func testArcOffsetIsZeroAtEndpointsAndPeaksAtMidpoint() {
    XCTAssertEqual(CommentFlightMath.arcOffset(0), 0)
    XCTAssertEqual(CommentFlightMath.arcOffset(1), 0)
    XCTAssertEqual(CommentFlightMath.arcOffset(0.5), -CommentFlightMath.lift)
    XCTAssertEqual(CommentFlightMath.arcOffset(0.5, lift: 20), -20)
  }

  func testProgressClampsWithoutBreakingEitherHandoff() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 40)
    let target = CGRect(x: 250, y: 320, width: 120, height: 44)

    XCTAssertEqual(
      CommentFlightMath.interpolatedRect(from: origin, to: target, progress: -1),
      origin
    )
    XCTAssertEqual(
      CommentFlightMath.interpolatedRect(from: origin, to: target, progress: 2),
      target
    )
    XCTAssertEqual(CommentFlightMath.shadowProgress(0), 0)
    XCTAssertEqual(CommentFlightMath.shadowProgress(1), 0)
  }

  func testLandingTargetRejectsThePreScrollFrameUnderTheComposer() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 44)
    let preScrollTarget = CGRect(x: 250, y: 490, width: 120, height: 44)

    XCTAssertFalse(
      CommentFlightMath.isValidLandingTarget(from: origin, to: preScrollTarget)
    )
  }

  func testLandingTargetAcceptsThePostScrollFrameAboveTheComposer() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 44)
    let postScrollTarget = CGRect(x: 250, y: 420, width: 120, height: 44)

    XCTAssertTrue(
      CommentFlightMath.isValidLandingTarget(from: origin, to: postScrollTarget)
    )
  }
}
