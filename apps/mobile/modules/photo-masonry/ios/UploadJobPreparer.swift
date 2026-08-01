import Foundation
import Photos
import UIKit
import UniformTypeIdentifiers

enum UploadPrepareError: LocalizedError {
  case assetUnavailable
  case resourceUnreadable(String)

  var errorDescription: String? {
    switch self {
    case .assetUnavailable:
      return "The photo is no longer available in the photo library."
    case .resourceUnreadable(let message):
      return message
    }
  }
}

struct UploadPreparedBody {
  let name: String
  let bytes: Int64
}

enum UploadJobPreparer {
  static func fetchAsset(_ assetId: String) -> PHAsset? {
    PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject
  }

  static func writePreview(for asset: PHAsset, to url: URL) {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    // .fastFormat fails with PHPhotosErrorDomain 3303 for assets whose cached
    // thumbnail is absent; a network-allowed high-quality request always
    // decodes from the original instead.
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = true
    var thumbnail: UIImage?
    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: 192, height: 192),
      contentMode: .aspectFill,
      options: options
    ) { image, _ in
      thumbnail = image
    }
    guard let data = thumbnail?.jpegData(compressionQuality: 0.75) else { return }
    try? data.write(to: url, options: .atomic)
  }

  static func buildBody(
    for asset: PHAsset,
    directory: String?,
    boundary: String,
    to url: URL
  ) throws -> UploadPreparedBody {
    let resources = PHAssetResource.assetResources(for: asset)
    guard let photo = resources.first(where: { $0.type == .fullSizePhoto })
      ?? resources.first(where: { $0.type == .photo })
    else {
      throw UploadPrepareError.assetUnavailable
    }
    let video = asset.mediaSubtypes.contains(.photoLive)
      ? resources.first(where: { $0.type == .fullSizePairedVideo })
        ?? resources.first(where: { $0.type == .pairedVideo })
      : nil

    // The server pairs a Live Photo's video to its still by shared base name
    // within one request, and every edited asset exposes "FullSizeRender.*",
    // so both part names are rebuilt from the original still's base name.
    let original = resources.first(where: { $0.type == .photo }) ?? photo
    let base = (original.originalFilename as NSString).deletingPathExtension

    FileManager.default.createFile(atPath: url.path, contents: nil)
    let handle = try FileHandle(forWritingTo: url)
    defer { try? handle.close() }

    if let directory, !directory.isEmpty {
      // The server's multipart parser reads `directory` while streaming, so
      // the field must precede every file part.
      write(handle, "--\(boundary)\r\nContent-Disposition: form-data; name=\"directory\"\r\n\r\n\(directory)\r\n")
    }
    let photoName = partFilename(base: base, resource: photo)
    try appendFilePart(handle, boundary: boundary, filename: photoName, resource: photo)
    if let video {
      try appendFilePart(
        handle,
        boundary: boundary,
        filename: partFilename(base: base, resource: video),
        resource: video
      )
    }
    write(handle, "--\(boundary)--\r\n")
    let bytes = (try? handle.offset()).map(Int64.init(clamping:)) ?? 0
    return UploadPreparedBody(name: photoName, bytes: bytes)
  }

  private static func partFilename(base: String, resource: PHAssetResource) -> String {
    let ext = (resource.originalFilename as NSString).pathExtension
    if !ext.isEmpty {
      return "\(base).\(ext.lowercased())"
    }
    let fallback = UTType(resource.uniformTypeIdentifier)?.preferredFilenameExtension ?? "bin"
    return "\(base).\(fallback)"
  }

  private static func mimeType(for resource: PHAssetResource) -> String {
    UTType(resource.uniformTypeIdentifier)?.preferredMIMEType ?? "application/octet-stream"
  }

  private static func write(_ handle: FileHandle, _ text: String) {
    handle.write(Data(text.utf8))
  }

  private static func appendFilePart(
    _ handle: FileHandle,
    boundary: String,
    filename: String,
    resource: PHAssetResource
  ) throws {
    write(
      handle,
      "--\(boundary)\r\nContent-Disposition: form-data; name=\"files\"; filename=\"\(filename)\"\r\nContent-Type: \(mimeType(for: resource))\r\n\r\n"
    )
    let options = PHAssetResourceRequestOptions()
    options.isNetworkAccessAllowed = true
    let semaphore = DispatchSemaphore(value: 0)
    var failure: Error?
    PHAssetResourceManager.default().requestData(for: resource, options: options) { chunk in
      handle.write(chunk)
    } completionHandler: { error in
      failure = error
      semaphore.signal()
    }
    semaphore.wait()
    if let failure {
      throw UploadPrepareError.resourceUnreadable(failure.localizedDescription)
    }
    write(handle, "\r\n")
  }
}
