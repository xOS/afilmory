import ExpoModulesCore
import SwiftUI
import UIKit

public final class PhotoSidebarModule: Module {
  private let model = PhotoSidebarModel()
  private weak var installedController: UITabBarController?
  private weak var layoutController: UITabBarController?
  private var bottomBarView: UIView?
  private var generation = 0
  private var lastEmittedTrailingInset: CGFloat?
  private var layoutGeneration = 0
  private var layoutProbeView: PhotoSidebarLayoutProbeView?
  private var pendingContentLayoutUpdate: DispatchWorkItem?
  private var pendingLayoutRetry: DispatchWorkItem?
  private var pendingRetry: DispatchWorkItem?
  private var sidebarVisibilityDelegate: PhotoSidebarVisibilityDelegate?

  public func definition() -> ModuleDefinition {
    Name("PhotoSidebar")
    Events(
      "onClearFilters",
      "onContentLayoutChange",
      "onFiltersPress",
      "onQuickFilterPress",
      "onTagPress"
    )

    AsyncFunction("configure") { (request: PhotoSidebarRequest) in
      self.configure(request)
    }
    .runOnQueue(.main)

    AsyncFunction("clear") { (ownerID: String) in
      self.clear(ownerID: ownerID)
    }
    .runOnQueue(.main)

    AsyncFunction("setTiledLayout") {
      self.setTiledLayout()
    }
    .runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { [weak self] in
        self?.pendingContentLayoutUpdate?.cancel()
        self?.pendingLayoutRetry?.cancel()
        self?.pendingRetry?.cancel()
        self?.removeInstalledContent()
        self?.removeLayoutObservation()
      }
    }
  }

  private func configure(_ request: PhotoSidebarRequest) {
    generation += 1
    pendingRetry?.cancel()
    model.update(request)

    if let installedController, installedController.viewIfLoaded?.window != nil {
      return
    }
    install(generation: generation, attemptsRemaining: 20)
  }

  private func clear(ownerID: String) {
    guard model.request.ownerID == ownerID else { return }
    generation += 1
    pendingRetry?.cancel()
    pendingRetry = nil
    removeInstalledContent()
  }

  private func setTiledLayout() {
    layoutGeneration += 1
    lastEmittedTrailingInset = nil
    pendingLayoutRetry?.cancel()
    installTiledLayout(generation: layoutGeneration, attemptsRemaining: 20)
  }

  private func installTiledLayout(generation: Int, attemptsRemaining: Int) {
    guard generation == layoutGeneration else { return }
    guard UIDevice.current.userInterfaceIdiom == .pad else { return }

    if let controller = resolveTabBarController() {
      pendingLayoutRetry = nil
      applyTiledLayout(to: controller)
      return
    }

    guard attemptsRemaining > 0 else { return }
    let retry = DispatchWorkItem { [weak self] in
      self?.installTiledLayout(generation: generation, attemptsRemaining: attemptsRemaining - 1)
    }
    pendingLayoutRetry = retry
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: retry)
  }

  private func install(generation: Int, attemptsRemaining: Int) {
    guard generation == self.generation else { return }
    guard UIDevice.current.userInterfaceIdiom == .pad else { return }

    if let controller = resolveTabBarController() {
      pendingRetry = nil
      installContent(on: controller)
      return
    }

    guard attemptsRemaining > 0 else { return }
    let retry = DispatchWorkItem { [weak self] in
      self?.install(generation: generation, attemptsRemaining: attemptsRemaining - 1)
    }
    pendingRetry = retry
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: retry)
  }

  private func installContent(on controller: UITabBarController) {
    applyTiledLayout(to: controller)

    if installedController !== controller {
      removeInstalledContent()
      installedController = controller
    }

    let footerConfiguration = UIHostingConfiguration {
      PhotoSidebarFooterView(
        model: model,
        onFiltersPress: { [weak self] in self?.emitFiltersPress() },
        onQuickFilterPress: { [weak self] id in self?.emitItemPress(event: "onQuickFilterPress", id: id) },
        onTagPress: { [weak self] id in self?.emitItemPress(event: "onTagPress", id: id) }
      )
    }
    .margins(.all, 0)
    .background(Color.clear)
    controller.sidebar.footerContentConfiguration = footerConfiguration

    let bottomConfiguration = UIHostingConfiguration {
      PhotoSidebarBottomBarView(
        model: model,
        onClearFilters: { [weak self] in self?.emitOwnerEvent("onClearFilters") },
        onFiltersPress: { [weak self] in self?.emitFiltersPress() }
      )
    }
    .margins(.all, 0)
    .background(Color.clear)
    let bottomView = MainActor.assumeIsolated {
      bottomConfiguration.makeContentView()
    }
    bottomView.backgroundColor = .clear
    controller.sidebar.bottomBarView = bottomView
    bottomBarView = bottomView
  }

  private func applyTiledLayout(to controller: UITabBarController) {
    // UIKit defaults to overlap on iPad; tiled layout keeps full-screen React Native
    // surfaces from rendering underneath the expanded system sidebar.
    controller.sidebar.preferredLayout = .tile
    installLayoutObservation(on: controller)
    controller.view.setNeedsLayout()
    controller.view.layoutIfNeeded()
    scheduleContentLayoutUpdate(for: controller)
  }

  private func installLayoutObservation(on controller: UITabBarController) {
    if layoutController !== controller {
      removeLayoutObservation()
      layoutController = controller
      lastEmittedTrailingInset = nil

      let probe = PhotoSidebarLayoutProbeView { [weak self, weak controller] in
        guard let controller else { return }
        self?.scheduleContentLayoutUpdate(for: controller)
      }
      probe.frame = controller.view.bounds
      probe.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      controller.view.insertSubview(probe, at: 0)
      layoutProbeView = probe
    }

    if controller.sidebar.delegate == nil || controller.sidebar.delegate === sidebarVisibilityDelegate {
      if sidebarVisibilityDelegate == nil {
        sidebarVisibilityDelegate = PhotoSidebarVisibilityDelegate { [weak self] controller in
          self?.scheduleContentLayoutUpdate(for: controller)
        }
      }
      controller.sidebar.delegate = sidebarVisibilityDelegate
    }
  }

  private func removeLayoutObservation() {
    pendingContentLayoutUpdate?.cancel()
    pendingContentLayoutUpdate = nil
    layoutProbeView?.removeFromSuperview()
    layoutProbeView = nil
    if let layoutController, layoutController.sidebar.delegate === sidebarVisibilityDelegate {
      layoutController.sidebar.delegate = nil
    }
    sidebarVisibilityDelegate = nil
    layoutController = nil
    lastEmittedTrailingInset = nil
  }

  private func scheduleContentLayoutUpdate(for controller: UITabBarController) {
    pendingContentLayoutUpdate?.cancel()
    let update = DispatchWorkItem { [weak self, weak controller] in
      guard let self, let controller, controller === self.layoutController else { return }
      self.emitContentLayout(for: controller)
    }
    pendingContentLayoutUpdate = update
    DispatchQueue.main.async(execute: update)
  }

  private func emitContentLayout(for controller: UITabBarController) {
    guard controller.viewIfLoaded?.window != nil,
          let selectedView = controller.selectedViewController?.viewIfLoaded else { return }

    let containerWidth = controller.view.bounds.width
    let contentWidth = min(containerWidth, selectedView.bounds.width)
    let trailingInset = max(0, containerWidth - contentWidth)
    guard lastEmittedTrailingInset.map({ abs($0 - trailingInset) >= 0.5 }) ?? true else { return }

    lastEmittedTrailingInset = trailingInset
    sendEvent(
      "onContentLayoutChange",
      [
        "containerWidth": containerWidth,
        "contentWidth": contentWidth,
        "trailingInset": trailingInset,
      ]
    )
  }

  private func emitItemPress(event: String, id: String) {
    sendEvent(event, ["id": id, "ownerID": model.request.ownerID])
  }

  private func emitOwnerEvent(_ event: String) {
    sendEvent(event, ["ownerID": model.request.ownerID])
  }

  private func emitFiltersPress() {
    let frame: CGRect
    if let bottomBarView, let window = bottomBarView.window {
      frame = bottomBarView.convert(bottomBarView.bounds, to: window)
    } else {
      frame = .zero
    }
    sendEvent(
      "onFiltersPress",
      [
        "frame": [
          "height": frame.height,
          "width": frame.width,
          "x": frame.minX,
          "y": frame.minY,
        ],
        "ownerID": model.request.ownerID,
      ]
    )
  }

  private func removeInstalledContent() {
    guard let installedController else {
      bottomBarView = nil
      return
    }
    installedController.sidebar.footerContentConfiguration = nil
    if installedController.sidebar.bottomBarView === bottomBarView {
      installedController.sidebar.bottomBarView = nil
    }
    bottomBarView = nil
    self.installedController = nil
  }

  private func resolveTabBarController() -> UITabBarController? {
    if let current = appContext?.utilities?.currentViewController(),
       let controller = findTabBarController(from: current) {
      return controller
    }

    for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
      for window in scene.windows where window.isKeyWindow {
        if let root = window.rootViewController,
           let controller = findTabBarController(from: root) {
          return controller
        }
      }
    }
    return nil
  }

  private func findTabBarController(from root: UIViewController) -> UITabBarController? {
    var queue = [root]
    var visited = Set<ObjectIdentifier>()

    while !queue.isEmpty {
      let current = queue.removeFirst()
      guard visited.insert(ObjectIdentifier(current)).inserted else { continue }
      if let controller = current as? UITabBarController {
        return controller
      }
      if let controller = current.tabBarController {
        return controller
      }
      if let parent = current.parent {
        queue.append(parent)
      }
      if let presenting = current.presentingViewController {
        queue.append(presenting)
      }
      if let presented = current.presentedViewController {
        queue.append(presented)
      }
      queue.append(contentsOf: current.children)
    }
    return nil
  }
}

private final class PhotoSidebarVisibilityDelegate: NSObject, UITabBarController.Sidebar.Delegate {
  private let onVisibilityChange: (UITabBarController) -> Void

  init(onVisibilityChange: @escaping (UITabBarController) -> Void) {
    self.onVisibilityChange = onVisibilityChange
  }

  func tabBarController(
    _ tabBarController: UITabBarController,
    sidebarVisibilityWillChange sidebar: UITabBarController.Sidebar,
    animator: any UITabBarController.Sidebar.Animating
  ) {
    animator.addCompletion { [weak self, weak tabBarController] in
      guard let tabBarController else { return }
      self?.onVisibilityChange(tabBarController)
    }
  }
}

private final class PhotoSidebarLayoutProbeView: UIView {
  private let onLayout: () -> Void

  init(onLayout: @escaping () -> Void) {
    self.onLayout = onLayout
    super.init(frame: .zero)
    accessibilityElementsHidden = true
    backgroundColor = .clear
    isUserInteractionEnabled = false
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    onLayout()
  }
}
