import Foundation
import XCTest
@testable import PhotoMasonry

final class UploadJobPreparerTests: XCTestCase {
  func testFileBodySanitizesMultipartHeadersWithoutChangingPayload() throws {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }

    let payload = Data([0x00, 0x01, 0x02, 0xFF])
    let sourceURL = directory.appendingPathComponent("source.bin")
    let bodyURL = directory.appendingPathComponent("body.multipart")
    try payload.write(to: sourceURL)

    let prepared = try UploadJobPreparer.buildBody(
      forFileAt: sourceURL,
      filename: "unsafe\\\"\r\n.jpg",
      mimeType: "image/jpeg\r\nX-Injected: true",
      directory: "travel/night",
      boundary: "test-boundary",
      to: bodyURL
    )
    let body = try Data(contentsOf: bodyURL)

    XCTAssertEqual(prepared.name, "unsafe____.jpg")
    XCTAssertEqual(prepared.bytes, Int64(body.count))
    XCTAssertNotNil(body.range(of: Data("filename=\"unsafe____.jpg\"".utf8)))
    XCTAssertNotNil(body.range(of: Data("Content-Type: application/octet-stream".utf8)))
    XCTAssertNotNil(body.range(of: payload))
  }
}
