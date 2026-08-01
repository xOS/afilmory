import ExpoModulesCore
import UIKit

final class PhotoDetailView: ExpoView {
  let onCommentsRequest = EventDispatcher()
  let onIndexChange = EventDispatcher()
  let onReactionRequest = EventDispatcher()
  let onRequestClose = EventDispatcher()

  private static let maximumPageControlDots = 20

  private let viewer: PhotoViewerView
  private let mediaViewport = UIView()
  private let infoView = PhotoDetailInfoView()
  private let topScrim = PhotoDetailScrimView(edge: .top)
  private let bottomScrim = PhotoDetailScrimView(edge: .bottom)
  private let navigationBar = PhotoDetailNavigationBar()
  private let pageControl = UIPageControl()
  private let toolbar = PhotoDetailToolbar()
  private let reactionRail = PhotoDetailReactionRailView()
  private lazy var inspector = PhotoDetailInspectorPresenter(
    host: self,
    mediaViewport: mediaViewport,
    viewer: viewer,
    infoView: infoView
  )

  private var currentIndex = 0
  private var initialIndex = 0
  private var photos: [MasonryPhoto] = []
  private var metadataByID: [String: PhotoDetailMetadata] = [:]
  private var strings = PhotoDetailStrings()
  private var commentCount = -1
  private var socialActionsEnabled = false
  private var reactionRailPresented = false
  private var visibility = PhotoDetailChromeVisibility(userHidden: false, infoProgress: 0, zoomed: false)
  private var lastLayoutSize = CGSize.zero

  required init(appContext: AppContext? = nil) {
    viewer = PhotoViewerView(appContext: appContext)
    super.init(appContext: appContext)

    backgroundColor = .black
    clipsToBounds = true
    accessibilityIdentifier = "photo-detail-native"

    mediaViewport.backgroundColor = .black
    mediaViewport.clipsToBounds = true
    addSubview(mediaViewport)
    mediaViewport.addSubview(viewer)
    addSubview(infoView)
    addSubview(topScrim)
    addSubview(bottomScrim)
    addSubview(navigationBar)
    addSubview(pageControl)
    addSubview(toolbar)
    addSubview(reactionRail)

    configureChrome()
    configureViewer()
    configureInspector()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.width > 0, bounds.height > 0 else { return }

    if lastLayoutSize != bounds.size {
      inspector.stopAnimationAtCurrentPosition()
      lastLayoutSize = bounds.size
    }
    inspector.reapplyProgress()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsLayout()
  }

  func setPhotos(_ photos: [MasonryPhoto]) {
    self.photos = photos
    currentIndex = clampedIndex(initialIndex)
    viewer.setPhotos(photos)
    updateCurrentMetadata()
    updatePageControl()
  }

  func setInitialIndex(_ index: Int) {
    initialIndex = index
    currentIndex = clampedIndex(index)
    viewer.initialIndex = index
    updateCurrentMetadata()
    updatePageControl()
  }

  func setTransitionID(_ id: String) {
    viewer.transitionId = id
  }

  func setMetadataJSON(_ json: String) {
    metadataByID = PhotoDetailJSON.decodeMetadata(json).reduce(into: [:]) { result, item in
      result[item.id] = item
    }
    updateCurrentMetadata()
  }

  func setStringsJSON(_ json: String) {
    strings = PhotoDetailJSON.decodeStrings(json)
    viewer.keyboardCloseTitle = strings.close
    viewer.keyboardInfoTitle = strings.info
    viewer.keyboardNextTitle = strings.next
    viewer.keyboardPreviousTitle = strings.previous
    updateAccessibilityLabels()
  }

  func setLivePhotoStringsJSON(_ json: String) {
    viewer.livePhotoStringsJSON = json
  }

  func setCommentCount(_ count: Int) {
    commentCount = count
    updateCommentBadge()
  }

  func setReactionItemsJSON(_ json: String) {
    reactionRail.setItems(PhotoDetailJSON.decodeReactionItems(json))
    setNeedsLayout()
  }

  func setSocialActionsEnabled(_ enabled: Bool) {
    socialActionsEnabled = enabled
    toolbar.setSocialActionsEnabled(enabled)
    if !enabled {
      setReactionRailPresented(false, animated: false)
    }
    updateCommentBadge()
    setNeedsLayout()
  }

  private func configureChrome() {
    navigationBar.onRequestClose = { [weak self] in self?.requestClose() }

    toolbar.onShare = { [weak self] in self?.shareCurrentPhoto() }
    toolbar.onInfo = { [weak self] in self?.toggleInfo() }
    toolbar.onComments = { [weak self] in self?.requestComments() }
    toolbar.onReactions = { [weak self] in self?.toggleReactionRail() }

    pageControl.isUserInteractionEnabled = false
    pageControl.overrideUserInterfaceStyle = .dark

    reactionRail.onSelect = { [weak self] reaction in
      self?.requestReaction(reaction)
    }
  }

  private func configureViewer() {
    viewer.interactiveDismissEnabled = true
    viewer.onNativeIndexChange = { [weak self] photo, index in
      guard let self else { return }
      currentIndex = index
      setReactionRailPresented(false, animated: true)
      updateCurrentMetadata()
      updatePageControl()
      onIndexChange(["id": photo.id, "index": index])
    }
    viewer.onNativeZoomChange = { [weak self] zoomed in
      guard let self else { return }
      visibility.zoomed = zoomed
      applyVisibility(animated: true)
    }
    viewer.onNativeInfoRequest = { [weak self] in self?.toggleInfo() }
    viewer.onNativeRequestClose = { [weak self] in self?.requestClose() }
  }

  private func configureInspector() {
    inspector.canPresent = { [weak self] in self?.currentMetadata != nil }
    inspector.onGestureBegan = { [weak self] in self?.setReactionRailPresented(false, animated: true) }
    inspector.onProgressChange = { [weak self] progress in
      guard let self else { return }
      visibility.infoProgress = progress
      layoutChrome()
      applyVisibility(animated: false)
      updateToolbarState()
    }
    addGestureRecognizer(inspector.panGestureRecognizer)
    viewer.configureExternalInfoGesture(inspector.panGestureRecognizer)
  }

  private func layoutChrome() {
    let width = mediaViewport.frame.width
    let safeInsets = safeAreaInsets
    let scrimSpan = PhotoDetailScrimView.span

    let navigationBarHeight = navigationBar.sizeThatFits(CGSize(width: width, height: 0)).height
    navigationBar.frame = CGRect(x: 0, y: safeInsets.top, width: width, height: navigationBarHeight)
    topScrim.frame = CGRect(x: 0, y: 0, width: width, height: scrimSpan)

    let toolbarHeight = toolbar.sizeThatFits(CGSize(width: width, height: 0)).height
    let toolbarY = bounds.height - safeInsets.bottom - toolbarHeight
    toolbar.frame = CGRect(x: 0, y: toolbarY, width: width, height: toolbarHeight)
    bottomScrim.frame = CGRect(x: 0, y: bounds.height - scrimSpan, width: width, height: scrimSpan)

    let pageControlSize = pageControl.sizeThatFits(CGSize(width: width, height: 0))
    pageControl.frame = CGRect(
      x: (width - pageControlSize.width) / 2,
      y: toolbarY - pageControlSize.height,
      width: pageControlSize.width,
      height: pageControlSize.height
    )

    toolbar.layoutIfNeeded()
    reactionRail.anchorXCenter = toolbar.reactionsItemCenterX(in: self)
    let railFrame = reactionRail.preferredFrame(
      containerWidth: width,
      bottomY: pageControl.isHidden ? toolbarY : pageControl.frame.minY
    )
    reactionRail.bounds = CGRect(origin: .zero, size: railFrame.size)
    reactionRail.center = CGPoint(x: railFrame.midX, y: railFrame.midY)
  }

  private func applyVisibility(animated: Bool) {
    let changes = { [self] in
      navigationBar.alpha = visibility.navBarAlpha
      toolbar.alpha = visibility.toolbarAlpha
      pageControl.alpha = visibility.pageControlAlpha
      topScrim.alpha = visibility.topScrimAlpha
      bottomScrim.alpha = visibility.bottomScrimAlpha
    }
    guard animated, !UIAccessibility.isReduceMotionEnabled else {
      changes()
      return
    }
    UIView.animate(
      withDuration: 0.25,
      delay: 0,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseInOut],
      animations: changes
    )
  }

  private func updateAccessibilityLabels() {
    navigationBar.setBackAccessibilityLabel(strings.close)
    toolbar.setShareAccessibilityLabel(strings.share)
    toolbar.setInfoAccessibilityLabel(strings.info)
    toolbar.setReactionsAccessibilityLabel(strings.reaction)
    updateCommentBadge()
  }

  private func updateCurrentMetadata() {
    guard photos.indices.contains(currentIndex),
          let metadata = metadataByID[photos[currentIndex].id]
    else {
      navigationBar.setTitle("", subtitle: "")
      return
    }
    navigationBar.setTitle(metadata.title, subtitle: metadata.subtitle)
    infoView.setInfoJSON(metadata.infoJSON, appContext: appContext)
    setNeedsLayout()
  }

  private func updateCommentBadge() {
    let showsBadge = socialActionsEnabled && commentCount > 0
    toolbar.setCommentCount(max(commentCount, 0))
    toolbar.setCommentsAccessibilityLabel(
      showsBadge ? "\(strings.comments), \(commentCount)" : strings.comments
    )
  }

  private func updatePageControl() {
    pageControl.numberOfPages = photos.count
    pageControl.currentPage = currentIndex
    pageControl.isHidden = photos.count > Self.maximumPageControlDots || photos.count <= 1
  }

  private func updateToolbarState() {
    toolbar.setInfoActive(inspector.progress > 0.5)
    toolbar.setReactionsActive(reactionRailPresented)
  }

  private func clampedIndex(_ index: Int) -> Int {
    guard !photos.isEmpty else { return 0 }
    return min(max(index, 0), photos.count - 1)
  }

  private var currentMetadata: PhotoDetailMetadata? {
    guard photos.indices.contains(currentIndex) else { return nil }
    return metadataByID[photos[currentIndex].id]
  }

  private func toggleInfo() {
    guard currentMetadata != nil else { return }
    setReactionRailPresented(false, animated: true)
    inspector.settle(open: inspector.progress < 0.5, velocity: 0)
  }

  private func toggleReactionRail() {
    guard socialActionsEnabled else { return }
    if inspector.progress > 0.001 {
      inspector.settle(open: false, velocity: 0)
    }
    setReactionRailPresented(!reactionRailPresented, animated: true)
  }

  private func setReactionRailPresented(_ presented: Bool, animated: Bool) {
    reactionRailPresented = presented
    reactionRail.setPresented(presented, animated: animated)
    updateToolbarState()
  }

  private func requestClose() {
    setReactionRailPresented(false, animated: false)
    onRequestClose([:])
  }

  private func requestComments() {
    guard socialActionsEnabled, photos.indices.contains(currentIndex) else { return }
    setReactionRailPresented(false, animated: true)
    let photo = photos[currentIndex]
    onCommentsRequest(["id": photo.id, "index": currentIndex])
  }

  private func requestReaction(_ reaction: String) {
    guard socialActionsEnabled, photos.indices.contains(currentIndex) else { return }
    setReactionRailPresented(false, animated: true)
    let photo = photos[currentIndex]
    onReactionRequest(["id": photo.id, "index": currentIndex, "reaction": reaction])
  }

  private func shareCurrentPhoto() {
    guard photos.indices.contains(currentIndex),
          let presenter = appContext?.utilities?.currentViewController()
    else { return }

    let photo = photos[currentIndex]
    let title = currentMetadata?.title ?? ""
    let activityItems: [Any]
    if let url = URL(string: photo.originalUrl), !photo.originalUrl.isEmpty {
      activityItems = [url]
    } else if !title.isEmpty {
      activityItems = [title]
    } else {
      return
    }

    let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    controller.popoverPresentationController?.barButtonItem = toolbar.shareBarButtonItem
    presenter.present(controller, animated: true)
  }
}
