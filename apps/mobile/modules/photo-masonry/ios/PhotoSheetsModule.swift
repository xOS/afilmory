import ExpoModulesCore
import SwiftUI
import UIKit

public final class PhotoSheetsModule: Module {
  private var filterSession: PhotoFilterSheetSession?

  public func definition() -> ModuleDefinition {
    Name("PhotoSheets")

    AsyncFunction("presentPhotoInfo") { (info: PhotoInfoSheetRecord, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_PHOTO_SHEET_PRESENTER", "Unable to find a view controller for the photo info sheet.")
        return
      }

      let hostingController = UIHostingController(rootView: PhotoInfoSheetView(info: info))
      hostingController.navigationItem.title = "Info"
      hostingController.navigationItem.rightBarButtonItem = UIBarButtonItem(
        systemItem: .done,
        primaryAction: UIAction { [weak hostingController] _ in
          hostingController?.dismiss(animated: true)
        }
      )

      let navigationController = self.makeSheetNavigationController(root: hostingController)
      presenter.present(navigationController, animated: true) {
        promise.resolve()
      }
    }
    .runOnQueue(.main)

    AsyncFunction("presentPhotoFilters") { (request: PhotoFilterSheetRequest, promise: Promise) in
      guard self.filterSession == nil else {
        promise.reject("ERR_FILTER_SHEET_ACTIVE", "The filter sheet is already presented.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_FILTER_SHEET_PRESENTER", "Unable to find a view controller for the filter sheet.")
        return
      }

      let model = PhotoFilterViewModel(request: request)
      let hostingController = UIHostingController(rootView: PhotoFilterSheetView(model: model))
      hostingController.navigationItem.title = "Filters"

      let session = PhotoFilterSheetSession(promise: promise) { [weak self] in
        self?.filterSession = nil
      }
      self.filterSession = session

      hostingController.navigationItem.leftBarButtonItem = UIBarButtonItem(
        systemItem: .cancel,
        primaryAction: UIAction { [weak hostingController, weak session] _ in
          session?.cancel()
          hostingController?.dismiss(animated: true)
        }
      )
      hostingController.navigationItem.rightBarButtonItem = UIBarButtonItem(
        systemItem: .done,
        primaryAction: UIAction { [weak hostingController, weak session, weak model] _ in
          guard let model else { return }
          session?.complete(with: model.makeRecord())
          hostingController?.dismiss(animated: true)
        }
      )

      let navigationController = self.makeSheetNavigationController(root: hostingController)
      navigationController.presentationController?.delegate = session
      presenter.present(navigationController, animated: true)
    }
    .runOnQueue(.main)
  }

  private func makeSheetNavigationController(root: UIViewController) -> UINavigationController {
    let navigationController = UINavigationController(rootViewController: root)
    navigationController.modalPresentationStyle = .pageSheet
    navigationController.navigationBar.prefersLargeTitles = false

    if let sheet = navigationController.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.selectedDetentIdentifier = .medium
      sheet.prefersGrabberVisible = true
      sheet.prefersScrollingExpandsWhenScrolledToEdge = true
    }
    return navigationController
  }
}
