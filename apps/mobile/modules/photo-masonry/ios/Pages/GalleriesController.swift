import UIKit

final class GalleriesController: UIViewController {
  private let onRequestSignIn: () -> Void
  private let segmentControl = UISegmentedControl(items: [
    String(localized: "Timeline"),
    String(localized: "Following"),
    String(localized: "Explore"),
  ])
  private let directory: ExploreDirectoryController
  private let following: FollowingGalleriesController
  private let timeline: GalleryTimelineController
  private var currentSegment: ExploreSegment = .explore
  private var userHasChosen = false
  private var sessionObservation: AfilmorySessionObservationToken?
  private var lastGalleryRouteRequestID: String?

  init(onRequestSignIn: @escaping () -> Void) {
    self.onRequestSignIn = onRequestSignIn
    var openGallery: ((String, String, String?) -> Void)!
    directory = ExploreDirectoryController(
      onRequestSignIn: onRequestSignIn,
      onOpenGallery: { slug, title, photoID in openGallery?(slug, title, photoID) },
      onSubscriptionsChanged: {}
    )
    following = FollowingGalleriesController(
      onRequestSignIn: onRequestSignIn,
      onOpenGallery: { slug, title, photoID in openGallery?(slug, title, photoID) },
      onBrowseExplore: {}
    )
    timeline = GalleryTimelineController(
      onOpenGallery: { slug, title, photoID in openGallery?(slug, title, photoID) },
      onBrowseExplore: {}
    )
    super.init(nibName: nil, bundle: nil)
    title = String(localized: "Explore")
    openGallery = { [weak self] slug, title, photoID in
      self?.pushGallery(slug: slug, title: title, focusPhotoID: photoID)
    }
    directory.onSubscriptionsChanged = { [weak self] in
      self?.refreshSubscriptionSurfaces()
    }
    following.onBrowseExploreHandler = { [weak self] in
      self?.selectExploreSegment()
    }
    timeline.onBrowseExploreHandler = { [weak self] in
      self?.selectExploreSegment()
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func openGallery(_ route: GalleryRouteRequest) {
    guard lastGalleryRouteRequestID != route.requestId else { return }
    lastGalleryRouteRequestID = route.requestId
    pushGallery(slug: route.slug, title: route.title, focusPhotoID: nil)
  }

  func selectExploreSegment() {
    userHasChosen = true
    show(.explore)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    segmentControl.selectedSegmentIndex = ExploreSegment.explore.rawValue
    segmentControl.addAction(
      UIAction { [weak self] _ in
        guard let self else { return }
        userHasChosen = true
        show(ExploreSegment(rawValue: segmentControl.selectedSegmentIndex) ?? .explore)
      },
      for: .valueChanged
    )
    addChild(directory)
    addChild(following)
    addChild(timeline)
    for child in [directory, following, timeline] {
      child.view.translatesAutoresizingMaskIntoConstraints = false
      view.addSubview(child.view)
      NSLayoutConstraint.activate([
        child.view.topAnchor.constraint(equalTo: view.topAnchor),
        child.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
        child.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        child.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      ])
      child.didMove(toParent: self)
    }
    sessionObservation = AfilmorySessionStore.shared.observe { [weak self] state in
      DispatchQueue.main.async {
        self?.handleSession(state)
      }
    }
    handleSession(AfilmorySessionStore.shared.current().state)
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    applyDefaultSegmentIfNeeded()
  }

  private func handleSession(_ state: AfilmorySessionState) {
    switch state {
    case .signedOut:
      navigationItem.rightBarButtonItem = signInItem()
      navigationItem.titleView = nil
      userHasChosen = false
      show(.explore)
    case .loading, .failed:
      navigationItem.rightBarButtonItem = nil
      navigationItem.titleView = nil
      userHasChosen = false
      show(.explore)
    case .signedIn:
      navigationItem.rightBarButtonItem = nil
      navigationItem.titleView = segmentControl
      applyDefaultSegmentIfNeeded()
    }
  }

  private func signInItem() -> UIBarButtonItem {
    let item = UIBarButtonItem(
      title: String(localized: "Sign in"),
      style: .plain,
      target: self,
      action: #selector(requestSignIn)
    )
    item.accessibilityIdentifier = "explore.signIn"
    return item
  }

  @objc private func requestSignIn() {
    onRequestSignIn()
  }

  private func applyDefaultSegmentIfNeeded() {
    guard case .signedIn(let session) = AfilmorySessionStore.shared.current().state else {
      show(.explore)
      return
    }
    if !userHasChosen {
      let cached = GallerySubscriptionStore.shared.cachedHasSubscriptions(userId: session.user.id)
      show(resolveExploreDefaultSegment(isSignedIn: true, cachedHasSubscriptions: cached))
    }
    Task { @MainActor [weak self] in
      guard let self else { return }
      await GallerySubscriptionStore.shared.load(userId: session.user.id, force: true)
      if !userHasChosen {
        show(
          resolveExploreSegmentAfterFetch(
            current: currentSegment,
            userHasChosen: false,
            hasSubscriptions: GallerySubscriptionStore.shared.hasSubscriptions
          )
        )
      }
      following.reloadFromStore()
      if currentSegment == .timeline {
        await GalleryTimelineStore.shared.refresh(timeZone: TimeZone.current.identifier)
        timeline.reloadFromStore()
      }
    }
  }

  private func refreshSubscriptionSurfaces() {
    Task { @MainActor [weak self] in
      guard let self else { return }
      if case .signedIn(let session) = AfilmorySessionStore.shared.current().state {
        await GallerySubscriptionStore.shared.load(userId: session.user.id, force: true)
      }
      await GalleryTimelineStore.shared.refresh(timeZone: TimeZone.current.identifier)
      following.reloadFromStore()
      timeline.reloadFromStore()
    }
  }

  private func show(_ segment: ExploreSegment) {
    currentSegment = segment
    segmentControl.selectedSegmentIndex = segment.rawValue
    directory.view.isHidden = segment != .explore
    following.view.isHidden = segment != .following
    timeline.view.isHidden = segment != .timeline
    if segment == .explore {
      navigationItem.searchController = directory.searchController
      navigationItem.hidesSearchBarWhenScrolling = false
    } else if navigationItem.searchController === directory.searchController {
      navigationItem.searchController = nil
    }
    if segment == .timeline {
      Task { @MainActor [weak self] in
        await GalleryTimelineStore.shared.refresh(timeZone: TimeZone.current.identifier)
        self?.timeline.reloadFromStore()
      }
    }
    if segment == .following {
      following.reloadFromStore()
    }
  }

  private func pushGallery(slug: String, title: String, focusPhotoID: String?) {
    navigationController?.pushViewController(
      GalleryDetailController(
        slug: slug,
        title: title,
        onRequestSignIn: onRequestSignIn,
        focusPhotoID: focusPhotoID
      ),
      animated: viewIfLoaded?.window != nil
    )
  }
}
