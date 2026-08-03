import UIKit

final class PhotoTransitionInteraction: UIPercentDrivenInteractiveTransition,
  UIGestureRecognizerDelegate
{
  private static let commitProgress: CGFloat = 0.45
  private static let commitVelocity: CGFloat = 1_200
  private static let commitMinimumTranslation: CGFloat = 100

  private weak var viewController: PhotoDetailViewController?
  private weak var detailView: PhotoDetailView?
  private weak var sourceView: UIView?
  private(set) var isInteracting = false
  private(set) var translation = CGPoint.zero
  private(set) var velocity = CGPoint.zero
  private var gestureGeneration = 0

  private lazy var panGestureRecognizer: UIPanGestureRecognizer = {
    let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    recognizer.delegate = self
    recognizer.maximumNumberOfTouches = 1
    return recognizer
  }()

  override init() {
    super.init()
    completionCurve = .easeOut
    wantsInteractiveStart = false
  }

  func attach(to viewController: PhotoDetailViewController, detailView: PhotoDetailView) {
    self.viewController = viewController
    self.detailView = detailView
    detailView.addGestureRecognizer(panGestureRecognizer)
    detailView.configureExternalDismissGesture(panGestureRecognizer)
  }

  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    guard let detailView else { return }
    translation = gesture.translation(in: detailView)
    velocity = gesture.velocity(in: detailView)

    switch gesture.state {
    case .began:
      gestureGeneration += 1
      viewController?.prepareForInteractiveDismissal()
      isInteracting = true
      wantsInteractiveStart = true
      completionSpeed = 1
      sourceView = viewController?.transitionSourceView()
      sourceView?.isHidden = true
      detailView.beginViewControllerDismissal()
      viewController?.dismiss(animated: true)
    case .changed:
      update(detailView.updateViewControllerDismissal(translation: translation))
    case .ended:
      let progress = detailView.updateViewControllerDismissal(translation: translation)
      update(progress)
      let commits = progress > Self.commitProgress
        || (velocity.y > Self.commitVelocity
          && translation.y > Self.commitMinimumTranslation)
      isInteracting = false
      wantsInteractiveStart = false
      if commits {
        viewController?.flushPendingSocialActions()
        commitDismissal(detailView: detailView, velocity: velocity)
      } else {
        cancelDismissal(detailView: detailView, velocity: velocity)
      }
    case .cancelled, .failed:
      isInteracting = false
      wantsInteractiveStart = false
      cancelDismissal(detailView: detailView, velocity: velocity)
    default:
      break
    }
  }

  private func commitDismissal(detailView: PhotoDetailView, velocity: CGPoint) {
    let source = sourceView
    let target = source.flatMap {
      detailView.transitionGeometry(targetRect: $0.convert($0.bounds, to: detailView))
    }
    detailView.commitViewControllerDismissal(target: target, velocity: velocity) { [weak self] in
      source?.isHidden = false
      guard let self else { return }
      completionSpeed = 1_000
      finish()
      if sourceView === source {
        sourceView = nil
      }
    }
  }

  private func cancelDismissal(detailView: PhotoDetailView, velocity: CGPoint) {
    let generation = gestureGeneration
    let source = sourceView
    detailView.cancelViewControllerDismissal(velocity: velocity) { [weak self] in
      guard let self, gestureGeneration == generation else { return }
      source?.isHidden = false
      if sourceView === source {
        sourceView = nil
      }
    }
    completionSpeed = 1_000
    cancel()
    translation = .zero
    self.velocity = .zero
  }

  func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard let detailView, detailView.canBeginViewControllerDismissal() else { return false }
    let translation = panGestureRecognizer.translation(in: detailView)
    let velocity = panGestureRecognizer.velocity(in: detailView)
    let direction = abs(translation.x) + abs(translation.y) > 0.5 ? translation : velocity
    guard abs(direction.y) > abs(direction.x) * 1.12 else { return false }
    return direction.y > 0
  }
}
