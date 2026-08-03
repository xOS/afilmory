import ExpoModulesCore
import UIKit

final class PageControllerHostView: ExpoView {
  let onRequestSignIn = EventDispatcher()

  private var page = ""
  private var controller: UIViewController?
  private weak var parentController: UIViewController?

  deinit {
    detachController()
  }

  func setPage(_ page: String) {
    guard page != self.page else { return }
    detachController()
    self.page = page
    installControllerIfPossible()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    controller?.view.frame = bounds
    updateTabletLayout()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    updateTabletLayout()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    installControllerIfPossible()
  }

  private func installControllerIfPossible() {
    guard controller == nil,
          window != nil,
          let parent = enclosingViewController(),
          let child = makeController()
    else { return }
    parent.addChild(child)
    child.view.frame = bounds
    child.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(child.view)
    child.didMove(toParent: parent)
    controller = child
    parentController = parent
    updateTabletLayout()
  }

  private func detachController() {
    guard let controller else { return }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    self.controller = nil
    parentController = nil
  }

  private func makeController() -> UIViewController? {
    let requestSignIn: () -> Void = { [weak self] in
      guard let self else { return }
      onRequestSignIn([:])
    }
    switch page {
    case "photos":
      return PhotosHomeController(appContext: appContext, onRequestSignIn: requestSignIn)
    case "explore":
      let root = GalleriesController(appContext: appContext, onRequestSignIn: requestSignIn)
      return UINavigationController(rootViewController: root)
    case "map":
      return PhotoMapController(appContext: appContext, onRequestSignIn: requestSignIn)
    case "studio-library":
      let root = StudioLibraryController(appContext: appContext, onRequestSignIn: requestSignIn)
      return UINavigationController(rootViewController: root)
    default:
      return nil
    }
  }

  private func enclosingViewController() -> UIViewController? {
    var responder: UIResponder? = next
    while let current = responder {
      if let viewController = current as? UIViewController {
        return viewController
      }
      responder = current.next
    }
    return nil
  }

  private func updateTabletLayout() {
    guard UIDevice.current.userInterfaceIdiom == .pad,
          let controller,
          let tabBarController = parentController?.tabBarController
    else {
      if controller?.additionalSafeAreaInsets.right != 0 {
        controller?.additionalSafeAreaInsets.right = 0
      }
      return
    }
    tabBarController.sidebar.preferredLayout = .tile
    tabBarController.view.layoutIfNeeded()
    let containerWidth = tabBarController.view.bounds.width
    let contentWidth = min(
      containerWidth,
      tabBarController.selectedViewController?.viewIfLoaded?.bounds.width ?? containerWidth
    )
    let trailingInset = max(0, containerWidth - contentWidth)
    guard abs(controller.additionalSafeAreaInsets.right - trailingInset) >= 0.5 else { return }
    controller.additionalSafeAreaInsets.right = trailingInset
  }
}
