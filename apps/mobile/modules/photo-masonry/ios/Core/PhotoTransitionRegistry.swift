import UIKit

final class PhotoOpeningSnapshot {
  let contentView: UIView
  let frameInWindow: CGRect
  let sourceImage: UIImage?
  let sourceFrameInWindow: CGRect
  weak var hostWindow: UIWindow?

  init?(sourceView: UIView) {
    guard let hostWindow = sourceView.window,
          sourceView.bounds.width > 0,
          sourceView.bounds.height > 0,
          let contentView = hostWindow.snapshotView(afterScreenUpdates: false)
    else { return nil }

    let sourceFrameInWindow = sourceView.convert(sourceView.bounds, to: hostWindow)
    guard sourceFrameInWindow.width > 0,
          sourceFrameInWindow.height > 0,
          sourceFrameInWindow.intersects(hostWindow.bounds)
    else { return nil }

    self.contentView = contentView
    frameInWindow = hostWindow.bounds
    sourceImage = (sourceView as? UIImageView)?.image
    self.sourceFrameInWindow = sourceFrameInWindow
    self.hostWindow = hostWindow

    // Freeze the presenter before React begins the route push. The snapshot is
    // moved into PhotoDetailView once its native layout is ready, so neither an
    // animation-less navigation commit nor RNScreens detachment can expose an
    // intermediate screen.
    contentView.frame = hostWindow.bounds
    contentView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    contentView.isUserInteractionEnabled = false
    contentView.accessibilityElementsHidden = true
    hostWindow.addSubview(contentView)
  }

  func removeFromSuperview() {
    contentView.removeFromSuperview()
  }
}

private final class PhotoTransitionSession {
  weak var source: PhotoMasonryView?
  var activePhotoId: String
  var openingSnapshot: PhotoOpeningSnapshot?

  init(source: PhotoMasonryView, photoId: String) {
    self.source = source
    activePhotoId = photoId
    openingSnapshot = nil
    if let sourceView = source.transitionSourceView(for: photoId) {
      openingSnapshot = PhotoOpeningSnapshot(sourceView: sourceView)
    }
  }
}

final class PhotoTransitionRegistry {
  static let shared = PhotoTransitionRegistry()

  private var sessions: [String: PhotoTransitionSession] = [:]

  private init() {}

  func register(source: PhotoMasonryView, photoId: String) -> String {
    let staleSessions = sessions.values.filter { $0.source == nil }
    staleSessions.forEach { $0.openingSnapshot?.removeFromSuperview() }
    sessions = sessions.filter { $0.value.source != nil }
    let id = UUID().uuidString
    let session = PhotoTransitionSession(source: source, photoId: photoId)
    sessions[id] = session

    if let openingSnapshot = session.openingSnapshot {
      DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self, weak openingSnapshot] in
        guard let self,
              let openingSnapshot,
              self.sessions[id]?.openingSnapshot === openingSnapshot
        else { return }
        openingSnapshot.removeFromSuperview()
        self.sessions[id]?.openingSnapshot = nil
      }
    }
    return id
  }

  func updatePhoto(id: String, photoId: String) {
    sessions[id]?.activePhotoId = photoId
  }

  func sourceView(id: String) -> UIView? {
    guard let session = sessions[id] else { return nil }
    return session.source?.transitionSourceView(for: session.activePhotoId)
  }

  func takeOpeningSnapshot(id: String) -> PhotoOpeningSnapshot? {
    guard let session = sessions[id] else { return nil }
    let snapshot = session.openingSnapshot
    session.openingSnapshot = nil
    return snapshot
  }

  func release(id: String) {
    sessions[id]?.openingSnapshot?.removeFromSuperview()
    sessions.removeValue(forKey: id)
  }
}
