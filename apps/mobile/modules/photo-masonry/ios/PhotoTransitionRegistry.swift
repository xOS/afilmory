import UIKit

private final class PhotoTransitionSession {
  weak var source: PhotoMasonryView?
  var activePhotoId: String

  init(source: PhotoMasonryView, photoId: String) {
    self.source = source
    activePhotoId = photoId
  }
}

final class PhotoTransitionRegistry {
  static let shared = PhotoTransitionRegistry()

  private var sessions: [String: PhotoTransitionSession] = [:]

  private init() {}

  func register(source: PhotoMasonryView, photoId: String) -> String {
    sessions = sessions.filter { $0.value.source != nil }
    let id = UUID().uuidString
    sessions[id] = PhotoTransitionSession(source: source, photoId: photoId)
    return id
  }

  func updatePhoto(id: String, photoId: String) {
    sessions[id]?.activePhotoId = photoId
  }

  func sourceView(id: String) -> UIView? {
    guard let session = sessions[id] else { return nil }
    return session.source?.transitionSourceView(for: session.activePhotoId)
  }

  func release(id: String) {
    sessions.removeValue(forKey: id)
  }
}
