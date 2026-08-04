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

    let inFlight = CommentFlightMath.interpolatedRect(
      from: origin,
      to: target,
      progress: 0.25
    )

    XCTAssertGreaterThan(inFlight.minX, origin.minX)
    XCTAssertLessThan(inFlight.minX, target.minX)
    XCTAssertLessThan(inFlight.width, origin.width)
    XCTAssertGreaterThan(inFlight.width, target.width)
    XCTAssertLessThan(inFlight.midY, origin.midY)
    XCTAssertGreaterThan(inFlight.midY, target.midY)
  }

  func testBoundsMorphKeepsTheTrailingEdgeAnchored() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 40)
    let target = CGRect(x: 252, y: 320, width: 120, height: 44)

    for progress in stride(from: CGFloat(0), through: 1, by: 0.1) {
      let rect = CommentFlightMath.interpolatedRect(
        from: origin,
        to: target,
        progress: progress
      )
      XCTAssertEqual(rect.maxX, origin.maxX, accuracy: 0.001)
    }
  }

  func testDoubleSpeedMotionLandsHalfwayThroughTheTimeline() {
    let origin = CGRect(x: 12, y: 500, width: 360, height: 40)
    let target = CGRect(x: 250, y: 320, width: 120, height: 44)

    XCTAssertEqual(CommentFlightMath.interpolatedRect(from: origin, to: target, progress: 0.5), target)
  }

  func testBubbleCompressesThenSettlesAfterLanding() {
    XCTAssertEqual(CommentFlightMath.bubbleScale(0), 1)
    XCTAssertEqual(CommentFlightMath.bubbleScale(0.35), 0.88, accuracy: 0.000_1)
    XCTAssertGreaterThan(CommentFlightMath.bubbleScale(0.5), 0.88)
    XCTAssertLessThan(CommentFlightMath.bubbleScale(0.5), 1)
    XCTAssertEqual(CommentFlightMath.bubbleScale(1), 1)
  }

  func testBubbleAndButtonUseIndependentChoreography() {
    XCTAssertEqual(CommentFlightMath.bubbleOpacity(0), 0)
    XCTAssertEqual(CommentFlightMath.bubbleOpacity(1 / 6), 0.5, accuracy: 0.000_1)
    XCTAssertEqual(CommentFlightMath.bubbleOpacity(1 / 3), 1)
    XCTAssertGreaterThan(CommentFlightMath.sendButtonScale(0.3), 0)
    XCTAssertEqual(CommentFlightMath.sendButtonScale(0.625), 0, accuracy: 0.000_1)
    XCTAssertEqual(CommentFlightMath.whiteTextMaskOpacity(0), 1)
    XCTAssertEqual(CommentFlightMath.whiteTextMaskOpacity(0.75), 0, accuracy: 0.000_1)
  }

  func testVeryWideDestinationUsesTheCompressedDuration() {
    let origin = CGRect(x: 12, y: 500, width: 100, height: 40)
    let regularTarget = CGRect(x: 180, y: 320, width: 166, height: 44)
    let wideTarget = CGRect(x: 180, y: 320, width: 167, height: 44)

    XCTAssertEqual(CommentFlightMath.animationDuration(from: origin, to: regularTarget), 0.4)
    XCTAssertEqual(CommentFlightMath.animationDuration(from: origin, to: wideTarget), 0.35)
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
