import Photos
import PhotosUI
import UIKit

enum UploadPickError: LocalizedError {
  case accessDenied
  case limitedSelection(Int)

  var errorDescription: String? {
    switch self {
    case .accessDenied:
      return "Photo library access is required to upload photos."
    case .limitedSelection(let count):
      return "\(count) selected item(s) are outside this app's limited photo access. Allow full access in Settings to upload them."
    }
  }
}

final class UploadPickerSession: NSObject, PHPickerViewControllerDelegate {
  private static var active: UploadPickerSession?
  private let completion: (Result<[[String: Any]], Error>) -> Void

  private init(completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
    self.completion = completion
  }

  static func present(
    from presenter: UIViewController,
    completion: @escaping (Result<[[String: Any]], Error>) -> Void
  ) {
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
      DispatchQueue.main.async {
        guard status == .authorized || status == .limited else {
          completion(.failure(UploadPickError.accessDenied))
          return
        }
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .any(of: [.images, .livePhotos])
        configuration.selectionLimit = 0
        configuration.selection = .ordered
        configuration.preferredAssetRepresentationMode = .current
        let picker = PHPickerViewController(configuration: configuration)
        let session = UploadPickerSession(completion: completion)
        picker.delegate = session
        active = session
        presenter.present(picker, animated: true)
      }
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    Self.active = nil
    let identifiers = results.compactMap(\.assetIdentifier)
    guard !identifiers.isEmpty else {
      completion(.success([]))
      return
    }
    let completion = self.completion
    DispatchQueue.global(qos: .userInitiated).async {
      var assetsById: [String: PHAsset] = [:]
      PHAsset.fetchAssets(withLocalIdentifiers: identifiers, options: nil)
        .enumerateObjects { asset, _, _ in
          assetsById[asset.localIdentifier] = asset
        }
      var items: [[String: Any]] = []
      var missing = 0
      for identifier in identifiers {
        guard let asset = assetsById[identifier] else {
          missing += 1
          continue
        }
        let resources = PHAssetResource.assetResources(for: asset)
        let original = resources.first { $0.type == .photo } ?? resources.first
        items.append([
          "id": identifier,
          "isLivePhoto": asset.mediaSubtypes.contains(.photoLive),
          "name": original?.originalFilename ?? "Photo",
        ])
      }
      DispatchQueue.main.async {
        if missing > 0 {
          completion(.failure(UploadPickError.limitedSelection(missing)))
        } else {
          completion(.success(items))
        }
      }
    }
  }
}
