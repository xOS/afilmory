import XCTest
@testable import PhotoMasonry

final class StudioLibraryDeletePolicyTests: XCTestCase {
  func testManagedStorageRequiresDeletingFiles() {
    XCTAssertTrue(
      StudioLibraryDeletePolicy.requiresStorageDeletion(storageProviders: ["managed"])
    )
  }

  func testManagedStorageRequirementAppliesToMixedSelection() {
    XCTAssertTrue(
      StudioLibraryDeletePolicy.requiresStorageDeletion(storageProviders: ["s3", " managed "])
    )
  }

  func testSelfManagedStorageKeepsDeletionChoice() {
    XCTAssertFalse(
      StudioLibraryDeletePolicy.requiresStorageDeletion(storageProviders: ["s3", "oss"])
    )
  }
}
