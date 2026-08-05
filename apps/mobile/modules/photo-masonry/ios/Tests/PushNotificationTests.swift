import Foundation
import XCTest

@testable import PhotoMasonry

final class PushNotificationTests: XCTestCase {
  func testDeviceTokenUsesStableLowercaseHexEncoding() {
    XCTAssertEqual(apnsDeviceTokenString(Data([0x00, 0x0f, 0xa5, 0xff])), "000fa5ff")
  }

  func testGalleryNotificationBuildsAnExploreDeepLink() throws {
    let url = try XCTUnwrap(
      galleryNotificationDeepLink(
        userInfo: [
          "route": "gallery",
          "gallerySlug": "street-photo",
          "galleryName": "Street Photo",
          "eventId": "event-123",
        ]
      )
    )
    let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
    let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap { item in
      item.value.map { (item.name, $0) }
    })

    XCTAssertEqual(components.scheme, "afilmory")
    XCTAssertEqual(components.path, "/explore")
    XCTAssertEqual(query["gallery"], "street-photo")
    XCTAssertEqual(query["name"], "Street Photo")
    XCTAssertEqual(query["event"], "event-123")
  }

  func testUnrelatedNotificationDoesNotProduceADeepLink() {
    XCTAssertNil(galleryNotificationDeepLink(userInfo: ["route": "comment"]))
  }

  func testGalleryNotificationUsesTheInstalledVariantsScheme() throws {
    let url = try XCTUnwrap(
      galleryNotificationDeepLink(
        userInfo: ["route": "gallery", "gallerySlug": "street-photo"],
        scheme: "afilmory-local"
      )
    )

    XCTAssertEqual(url.scheme, "afilmory-local")
  }
}
