import ExpoModulesCore
import Foundation
import SwiftUI
import UIKit

public final class PhotoSheetsModule: Module {
  private var commentsSession: SheetPromiseSession?
  private var filterSession: SheetPromiseSession?
  private var profileSession: SheetPromiseSession?
  private var uploadReviewSession: SheetPromiseSession?

  public func definition() -> ModuleDefinition {
    Name("PhotoSheets")

    View(PhotoInfoPanelView.self) {
      Events("onClose")

      Prop("infoJSON") { (view: PhotoInfoPanelView, infoJSON: String) in
        view.setInfoJSON(infoJSON)
      }

      Prop("showsHeader") { (view: PhotoInfoPanelView, showsHeader: Bool) in
        view.setShowsHeader(showsHeader)
      }
    }

    AsyncFunction("presentPhotoInfo") { (info: PhotoInfoSheetRecord, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(
          "ERR_PHOTO_SHEET_PRESENTER",
          "Unable to find a view controller for the photo info sheet."
        )
        return
      }

      let hostingController = UIHostingController(rootView: PhotoInfoSectionsList(info: info))
      hostingController.navigationItem.title = info.localization.title
      hostingController.navigationItem.rightBarButtonItem = UIBarButtonItem(
        title: info.localization.done,
        image: nil,
        primaryAction: UIAction { [weak hostingController] _ in
          hostingController?.dismiss(animated: true)
        },
        menu: nil
      )

      let navigationController = self.makeNavigationController(
        root: hostingController,
        presenter: presenter,
        anchor: nil,
        preferredContentSize: CGSize(width: 520, height: 680)
      )
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
        promise.reject(
          "ERR_FILTER_SHEET_PRESENTER",
          "Unable to find a view controller for the filter sheet."
        )
        return
      }

      let model = PhotoFilterViewModel(request: request)
      let hostingController = UIHostingController(rootView: PhotoFilterSheetView(model: model))
      hostingController.navigationItem.title = request.localization.title

      let session = SheetPromiseSession(promise: promise) { [weak self] in
        self?.filterSession = nil
      }
      self.filterSession = session

      hostingController.navigationItem.leftBarButtonItem = UIBarButtonItem(
        title: request.localization.cancel,
        image: nil,
        primaryAction: UIAction { [weak hostingController, weak session] _ in
          session?.cancel()
          hostingController?.dismiss(animated: true)
        },
        menu: nil
      )
      hostingController.navigationItem.rightBarButtonItem = UIBarButtonItem(
        title: request.localization.done,
        image: nil,
        primaryAction: UIAction { [weak hostingController, weak session, weak model] _ in
          guard let model else { return }
          session?.complete(with: model.makeRecord())
          hostingController?.dismiss(animated: true)
        },
        menu: nil
      )

      let navigationController = self.makeNavigationController(
        root: hostingController,
        presenter: presenter,
        anchor: request.anchor,
        preferredContentSize: CGSize(width: 430, height: 620)
      )
      navigationController.presentationController?.delegate = session
      presenter.present(navigationController, animated: true)
    }
    .runOnQueue(.main)

    AsyncFunction("presentPhotoComments") { (request: PhotoCommentsSheetRequest, promise: Promise) in
      guard self.commentsSession == nil else {
        promise.reject("ERR_COMMENTS_SHEET_ACTIVE", "The comments sheet is already presented.")
        return
      }
      guard let localization = CommentLocalization.decode(request.localizationJSON) else {
        promise.reject(
          "ERR_COMMENTS_LOCALIZATION",
          "The comments sheet localization payload is invalid."
        )
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(
          "ERR_COMMENTS_SHEET_PRESENTER",
          "Unable to find a view controller for the comments sheet."
        )
        return
      }

      // Expo's runOnQueue(.main) guarantee is dynamic and is not visible to
      // Swift's actor checker, so bridge the verified queue at this boundary.
      let store = MainActor.assumeIsolated {
        CommentsStore(request: request, localization: localization)
      }
      let session = SheetPromiseSession(
        promise: promise,
        cancellationValue: {
          MainActor.assumeIsolated { store.result.dictionary }
        }
      ) { [weak self] in
        self?.commentsSession = nil
      }
      self.commentsSession = session

      let hostingController = UIHostingController(rootView: PhotoCommentsSheetView(store: store))
      hostingController.navigationItem.title = localization.title
      if !request.photoTitle.isEmpty {
        hostingController.navigationItem.prompt = request.photoTitle
      }
      hostingController.navigationItem.rightBarButtonItem = UIBarButtonItem(
        title: localization.done,
        image: nil,
        primaryAction: UIAction { [weak hostingController, weak session] _ in
          session?.complete(with: MainActor.assumeIsolated { store.result.dictionary })
          hostingController?.dismiss(animated: true)
        },
        menu: nil
      )
      MainActor.assumeIsolated {
        store.onRequestSignIn = { [weak hostingController, weak session] in
          session?.complete(with: MainActor.assumeIsolated { store.result.dictionary })
          hostingController?.dismiss(animated: true)
        }
      }

      let navigationController = self.makeNavigationController(
        root: hostingController,
        presenter: presenter,
        anchor: nil,
        preferredContentSize: CGSize(width: 520, height: 700)
      )
      if let sheet = navigationController.sheetPresentationController {
        let compactIdentifier = UISheetPresentationController.Detent.Identifier(
          "afilmory.photo-comments.compact"
        )
        let expandedIdentifier = UISheetPresentationController.Detent.Identifier(
          "afilmory.photo-comments.expanded"
        )
        sheet.detents = [
          .custom(identifier: compactIdentifier) { context in
            context.maximumDetentValue * 0.62
          },
          .custom(identifier: expandedIdentifier) { context in
            context.maximumDetentValue * 0.92
          },
        ]
        sheet.selectedDetentIdentifier = compactIdentifier
        sheet.prefersGrabberVisible = true
        sheet.prefersScrollingExpandsWhenScrolledToEdge = true
      }
      navigationController.presentationController?.delegate = session
      presenter.present(navigationController, animated: true)
    }
    .runOnQueue(.main)

    AsyncFunction("presentProfile") { (profile: ProfileSheetRecord, promise: Promise) in
      guard self.profileSession == nil else {
        promise.reject("ERR_PROFILE_SHEET_ACTIVE", "The profile sheet is already presented.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(
          "ERR_PROFILE_SHEET_PRESENTER",
          "Unable to find a view controller for the profile sheet."
        )
        return
      }

      let session = SheetPromiseSession(promise: promise) { [weak self] in
        self?.profileSession = nil
      }
      self.profileSession = session

      let hostingController = UIHostingController(
        rootView: ProfileSheetView(profile: profile) { [weak session, weak presenter] in
          session?.complete(with: "signOut")
          presenter?.dismiss(animated: true)
        }
      )
      hostingController.view.backgroundColor = .systemGroupedBackground
      if !self.configurePopover(
        hostingController,
        presenter: presenter,
        anchor: profile.anchor,
        preferredContentSize: CGSize(width: 390, height: 520)
      ) {
        hostingController.modalPresentationStyle = .pageSheet
        if let sheet = hostingController.sheetPresentationController {
          sheet.detents = [.medium()]
          sheet.prefersGrabberVisible = true
        }
      }
      hostingController.presentationController?.delegate = session
      presenter.present(hostingController, animated: true)
    }
    .runOnQueue(.main)

    AsyncFunction("presentUploadReview") { (request: UploadReviewSheetRecord, promise: Promise) in
      guard self.uploadReviewSession == nil else {
        promise.reject("ERR_UPLOAD_REVIEW_ACTIVE", "The upload review sheet is already presented.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(
          "ERR_UPLOAD_REVIEW_PRESENTER",
          "Unable to find a view controller for the upload review sheet."
        )
        return
      }

      let session = SheetPromiseSession(promise: promise) { [weak self] in
        self?.uploadReviewSession = nil
      }
      self.uploadReviewSession = session

      var hostingController: UIHostingController<UploadReviewSheetView>?
      let rootView = UploadReviewSheetView(
        items: request.items.map { UploadReviewItem(id: $0.id, isLivePhoto: $0.isLivePhoto) },
        initialTags: request.initialTags,
        suggestedTags: request.suggestedTags,
        localization: request.localization
      ) { [weak session] outcome in
        switch outcome {
        case .cancel:
          session?.cancel()
        case .start(let itemIds, let tags):
          session?.complete(with: ["action": "start", "itemIds": itemIds, "tags": tags])
        case .addMore(let itemIds, let tags):
          session?.complete(with: ["action": "addMore", "itemIds": itemIds, "tags": tags])
        }
        hostingController?.dismiss(animated: true)
      }
      let host = UIHostingController(rootView: rootView)
      hostingController = host
      host.navigationItem.title = request.localization.title

      let navigationController = self.makeNavigationController(
        root: host,
        presenter: presenter,
        anchor: nil,
        preferredContentSize: CGSize(width: 560, height: 720)
      )
      if let sheet = navigationController.sheetPresentationController {
        sheet.selectedDetentIdentifier = .large
      }
      navigationController.presentationController?.delegate = session
      presenter.present(navigationController, animated: true)
    }
    .runOnQueue(.main)
  }

  private func makeNavigationController(
    root: UIViewController,
    presenter: UIViewController,
    anchor: PresentationAnchorRecord?,
    preferredContentSize: CGSize
  ) -> UINavigationController {
    let navigationController = UINavigationController(rootViewController: root)
    navigationController.navigationBar.prefersLargeTitles = false

    if !configurePopover(
      navigationController,
      presenter: presenter,
      anchor: anchor,
      preferredContentSize: preferredContentSize
    ) {
      navigationController.modalPresentationStyle = .pageSheet
      if let sheet = navigationController.sheetPresentationController {
        sheet.detents = [.medium(), .large()]
        sheet.selectedDetentIdentifier = .medium
        sheet.prefersGrabberVisible = true
        sheet.prefersScrollingExpandsWhenScrolledToEdge = true
      }
    }
    return navigationController
  }

  private func configurePopover(
    _ viewController: UIViewController,
    presenter: UIViewController,
    anchor: PresentationAnchorRecord?,
    preferredContentSize: CGSize
  ) -> Bool {
    guard presenter.traitCollection.horizontalSizeClass == .regular,
          let anchor,
          anchor.width > 0,
          anchor.height > 0
    else { return false }

    viewController.modalPresentationStyle = .popover
    viewController.preferredContentSize = preferredContentSize
    guard let popover = viewController.popoverPresentationController else { return false }
    popover.sourceView = presenter.view
    if let window = presenter.view.window {
      popover.sourceRect = presenter.view.convert(anchor.rect, from: window)
    } else {
      popover.sourceRect = anchor.rect
    }
    popover.permittedArrowDirections = .any
    return true
  }
}

final class PhotoInfoPanelView: ExpoView {
  let onClose = EventDispatcher()

  private var info: PhotoInfoSheetRecord = .init()
  private var showsHeader = true
  private var hostingController: UIHostingController<PhotoInfoInspectorView>!

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    hostingController = UIHostingController(
      rootView: PhotoInfoInspectorView(info: info, onClose: {})
    )
    hostingController.rootView = makeRootView()
    backgroundColor = .clear
    hostingController.view.backgroundColor = .clear
    hostingController.view.isOpaque = false
    addSubview(hostingController.view)
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

  func setInfoJSON(_ infoJSON: String) {
    guard let appContext,
          let decoded = PhotoInfoSheetRecord.decode(json: infoJSON, appContext: appContext)
    else { return }
    info = decoded
    hostingController.rootView = makeRootView()
  }

  func setShowsHeader(_ showsHeader: Bool) {
    guard self.showsHeader != showsHeader else { return }
    self.showsHeader = showsHeader
    hostingController.rootView = makeRootView()
  }

  private func makeRootView() -> PhotoInfoInspectorView {
    PhotoInfoInspectorView(info: info, showsHeader: showsHeader) { [weak self] in
      self?.onClose([:])
    }
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
