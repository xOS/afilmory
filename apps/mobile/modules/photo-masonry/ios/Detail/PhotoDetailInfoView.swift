import ExpoModulesCore
import SwiftUI
import UIKit

final class PhotoDetailInfoView: UIView {
  private var info = PhotoInfoSheetRecord()
  private var hostingController: UIHostingController<PhotoInfoInspectorView>!

  override init(frame: CGRect) {
    super.init(frame: frame)

    backgroundColor = .systemGroupedBackground
    hostingController = UIHostingController(rootView: makeRootView())
    hostingController.view.backgroundColor = .systemGroupedBackground
    addSubview(hostingController.view)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController.view.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      hostingController.willMove(toParent: nil)
      hostingController.removeFromParent()
    } else {
      attachHostingControllerIfNeeded()
    }
  }

  func setInfoJSON(_ json: String, appContext: AppContext?) {
    guard let appContext,
          let decoded = PhotoInfoSheetRecord.decode(json: json, appContext: appContext)
    else { return }
    info = decoded
    hostingController.rootView = makeRootView()
  }

  private func makeRootView() -> PhotoInfoInspectorView {
    PhotoInfoInspectorView(
      info: info,
      showsHeader: false,
      bottomContentInset: 82,
      onClose: {}
    )
  }

  private func attachHostingControllerIfNeeded() {
    guard hostingController.parent == nil else { return }
    var responder: UIResponder? = next
    while let current = responder {
      if let viewController = current as? UIViewController {
        viewController.addChild(hostingController)
        hostingController.didMove(toParent: viewController)
        return
      }
      responder = current.next
    }
  }
}
