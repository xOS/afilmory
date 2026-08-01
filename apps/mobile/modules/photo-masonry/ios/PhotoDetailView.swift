import ExpoModulesCore
import UIKit

final class PhotoDetailView: ExpoView, UIGestureRecognizerDelegate {
  let onCommentsRequest = EventDispatcher()
  let onIndexChange = EventDispatcher()
  let onReactionRequest = EventDispatcher()
  let onRequestClose = EventDispatcher()

  private static let compactInspectorHeightRatio: CGFloat = 0.46
  private static let compactInspectorMaximumHeight: CGFloat = 520
  private static let compactInspectorMinimumHeight: CGFloat = 300
  private static let sideInspectorMinimumWidth: CGFloat = 900
  private static let sideInspectorWidth: CGFloat = 380

  private let viewer: PhotoViewerView
  private let mediaViewport = UIView()
  private let infoView = PhotoDetailInfoView()
  private let detailTopSoftEdge = PhotoDetailSoftEdgeView(edge: .bottom)
  private let statusBarSoftEdge = PhotoDetailSoftEdgeView(edge: .top)
  private let footerSoftEdge = PhotoDetailSoftEdgeView(edge: .bottom)
  private let headerContainer = UIView()
  private let footerContainer = UIView()
  private let backSurface = PhotoDetailGlassSurface(cornerRadius: 22)
  private let moreSurface = PhotoDetailGlassSurface(cornerRadius: 22)
  private let shareSurface = PhotoDetailGlassSurface(cornerRadius: 22)
  private let actionsSurface = PhotoDetailGlassSurface(cornerRadius: 22)
  private let backButton = UIButton(type: .system)
  private let moreButton = UIButton(type: .system)
  private let shareButton = UIButton(type: .system)
  private let infoButton = UIButton(type: .system)
  private let commentsButton = UIButton(type: .system)
  private let reactionButton = UIButton(type: .system)
  private let actionStack = UIStackView()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let commentBadge = UILabel()
  private let reactionRail = PhotoDetailReactionRailView()
  private lazy var infoPanGestureRecognizer = UIPanGestureRecognizer(
    target: self,
    action: #selector(handleInfoPan(_:))
  )

  private var currentIndex = 0
  private var initialIndex = 0
  private var photos: [MasonryPhoto] = []
  private var metadataByID: [String: PhotoDetailMetadata] = [:]
  private var strings = PhotoDetailStrings()
  private var commentCount = -1
  private var socialActionsEnabled = false
  private var reactionRailPresented = false
  private var infoProgress: CGFloat = 0
  private var infoGestureStartProgress: CGFloat = 0
  private var infoAnimator: UIViewPropertyAnimator?
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
    addSubview(detailTopSoftEdge)
    addSubview(statusBarSoftEdge)
    addSubview(headerContainer)
    addSubview(footerSoftEdge)
    addSubview(footerContainer)
    addSubview(reactionRail)

    configureHeader()
    configureFooter()
    configureViewer()
    configureGestures()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.width > 0, bounds.height > 0 else { return }

    if lastLayoutSize != bounds.size {
      stopInfoAnimationAtCurrentPosition()
      lastLayoutSize = bounds.size
    }
    applyInfoProgress(infoProgress)
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
  }

  func setInitialIndex(_ index: Int) {
    initialIndex = index
    currentIndex = clampedIndex(index)
    viewer.initialIndex = index
    updateCurrentMetadata()
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
    updateMoreMenu()
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
    commentsButton.isHidden = !enabled
    reactionButton.isHidden = !enabled
    if !enabled {
      setReactionRailPresented(false, animated: false)
    }
    updateCommentBadge()
    setNeedsLayout()
  }

  private func configureHeader() {
    configureSymbolButton(backButton, symbol: "chevron.backward", pointSize: 22)
    configureSymbolButton(moreButton, symbol: "ellipsis", pointSize: 21)
    backButton.accessibilityIdentifier = "photo-detail-back"
    moreButton.accessibilityIdentifier = "photo-detail-more"
    backButton.addAction(UIAction { [weak self] _ in self?.requestClose() }, for: .touchUpInside)
    moreButton.showsMenuAsPrimaryAction = true

    backSurface.contentView.addSubview(backButton)
    moreSurface.contentView.addSubview(moreButton)
    headerContainer.addSubview(backSurface)
    headerContainer.addSubview(moreSurface)

    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.font = .preferredFont(forTextStyle: .headline)
    titleLabel.numberOfLines = 1
    titleLabel.textAlignment = .center
    titleLabel.textColor = .white
    headerContainer.addSubview(titleLabel)

    subtitleLabel.adjustsFontForContentSizeCategory = true
    subtitleLabel.font = .preferredFont(forTextStyle: .caption2)
    subtitleLabel.numberOfLines = 1
    subtitleLabel.textAlignment = .center
    subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.58)
    headerContainer.addSubview(subtitleLabel)
  }

  private func configureFooter() {
    configureSymbolButton(shareButton, symbol: "square.and.arrow.up", pointSize: 24)
    configureSymbolButton(infoButton, symbol: "info.circle", pointSize: 24)
    configureSymbolButton(commentsButton, symbol: "bubble.left", pointSize: 22)
    configureSymbolButton(reactionButton, symbol: "face.smiling", pointSize: 22)

    shareButton.accessibilityIdentifier = "photo-detail-share"
    infoButton.accessibilityIdentifier = "photo-detail-info"
    commentsButton.accessibilityIdentifier = "photo-detail-comments"
    reactionButton.accessibilityIdentifier = "photo-detail-reactions"

    shareButton.addAction(UIAction { [weak self] _ in self?.shareCurrentPhoto() }, for: .touchUpInside)
    infoButton.addAction(UIAction { [weak self] _ in self?.toggleInfo() }, for: .touchUpInside)
    commentsButton.addAction(UIAction { [weak self] _ in self?.requestComments() }, for: .touchUpInside)
    reactionButton.addAction(UIAction { [weak self] _ in self?.toggleReactionRail() }, for: .touchUpInside)

    shareSurface.contentView.addSubview(shareButton)
    footerContainer.addSubview(shareSurface)
    footerContainer.addSubview(actionsSurface)

    actionStack.alignment = .fill
    actionStack.axis = .horizontal
    actionStack.distribution = .fillEqually
    actionStack.spacing = 0
    actionStack.addArrangedSubview(infoButton)
    actionStack.addArrangedSubview(commentsButton)
    actionStack.addArrangedSubview(reactionButton)
    actionsSurface.contentView.addSubview(actionStack)

    commentBadge.backgroundColor = .systemBlue
    commentBadge.clipsToBounds = true
    commentBadge.font = .monospacedDigitSystemFont(ofSize: 9, weight: .bold)
    commentBadge.isAccessibilityElement = false
    commentBadge.textAlignment = .center
    commentBadge.textColor = .white
    commentsButton.addSubview(commentBadge)

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
      onIndexChange(["id": photo.id, "index": index])
    }
    viewer.onNativeInfoRequest = { [weak self] in self?.toggleInfo() }
    viewer.onNativeRequestClose = { [weak self] in self?.requestClose() }
  }

  private func configureGestures() {
    infoPanGestureRecognizer.cancelsTouchesInView = false
    infoPanGestureRecognizer.delegate = self
    infoPanGestureRecognizer.maximumNumberOfTouches = 1
    addGestureRecognizer(infoPanGestureRecognizer)
    viewer.configureExternalInfoGesture(infoPanGestureRecognizer)
  }

  private func configureSymbolButton(_ button: UIButton, symbol: String, pointSize: CGFloat) {
    var configuration = UIButton.Configuration.plain()
    configuration.baseForegroundColor = .white
    configuration.contentInsets = .zero
    configuration.image = UIImage(
      systemName: symbol,
      withConfiguration: UIImage.SymbolConfiguration(pointSize: pointSize, weight: .regular)
    )
    button.configuration = configuration
    button.tintColor = .white
  }

  private func updateAccessibilityLabels() {
    backButton.accessibilityLabel = strings.close
    moreButton.accessibilityLabel = strings.more
    shareButton.accessibilityLabel = strings.share
    infoButton.accessibilityLabel = strings.info
    reactionButton.accessibilityLabel = strings.reaction
    updateCommentBadge()
  }

  private func updateMoreMenu() {
    moreButton.menu = UIMenu(children: [
      UIAction(title: strings.share, image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
        self?.shareCurrentPhoto()
      },
      UIAction(title: strings.info, image: UIImage(systemName: "info.circle")) { [weak self] _ in
        self?.toggleInfo()
      },
    ])
  }

  private func updateCurrentMetadata() {
    guard photos.indices.contains(currentIndex) else {
      titleLabel.text = nil
      subtitleLabel.text = nil
      return
    }
    let photo = photos[currentIndex]
    guard let metadata = metadataByID[photo.id] else {
      titleLabel.text = nil
      subtitleLabel.text = nil
      return
    }
    titleLabel.text = metadata.title
    subtitleLabel.text = metadata.subtitle
    subtitleLabel.isHidden = metadata.subtitle.isEmpty
    infoView.setInfoJSON(metadata.infoJSON, appContext: appContext)
    setNeedsLayout()
  }

  private func updateCommentBadge() {
    let showsBadge = socialActionsEnabled && commentCount > 0
    commentBadge.isHidden = !showsBadge
    commentBadge.text = commentCount > 99 ? "99+" : "\(max(commentCount, 0))"
    commentsButton.accessibilityLabel = showsBadge
      ? "\(strings.comments), \(commentCount)"
      : strings.comments
  }

  private func updateToolbarState() {
    setButtonColor(infoButton, color: infoProgress > 0.5 ? .systemBlue : .white)
    setButtonColor(reactionButton, color: reactionRailPresented ? .systemBlue : .white)
    infoButton.accessibilityValue = infoProgress > 0.5 ? strings.info : nil
  }

  private func setButtonColor(_ button: UIButton, color: UIColor) {
    var configuration = button.configuration
    configuration?.baseForegroundColor = color
    button.configuration = configuration
  }

  private func clampedIndex(_ index: Int) -> Int {
    guard !photos.isEmpty else { return 0 }
    return min(max(index, 0), photos.count - 1)
  }

  private var usesSideInspector: Bool {
    bounds.width >= Self.sideInspectorMinimumWidth
  }

  private var compactInspectorHeight: CGFloat {
    min(
      max(bounds.height * Self.compactInspectorHeightRatio, Self.compactInspectorMinimumHeight),
      Self.compactInspectorMaximumHeight
    )
  }

  private var sideInspectorWidth: CGFloat {
    min(Self.sideInspectorWidth, bounds.width * 0.48)
  }

  private func applyInfoProgress(_ rawProgress: CGFloat) {
    let progress = min(max(rawProgress, 0), 1)
    infoProgress = progress
    viewer.infoPresented = progress > 0.001

    if usesSideInspector {
      applySideInspectorProgress(progress)
    } else {
      applyCompactInspectorProgress(progress)
    }
    updateToolbarState()
  }

  private func applyCompactInspectorProgress(_ progress: CGFloat) {
    let mediaBounds = bounds
    mediaViewport.frame = mediaBounds
    setBaseFrame(viewer, mediaViewport.bounds)

    let panelHeight = compactInspectorHeight
    setBaseFrame(
      infoView,
      CGRect(x: 0, y: bounds.height - panelHeight, width: bounds.width, height: panelHeight)
    )
    let inspectorTranslation = CGAffineTransform(translationX: 0, y: panelHeight * (1 - progress))
    infoView.transform = inspectorTranslation

    let detailEdgeHeight: CGFloat = 44
    detailTopSoftEdge.isHidden = false
    setBaseFrame(
      detailTopSoftEdge,
      CGRect(
        x: 0,
        y: bounds.height - panelHeight - detailEdgeHeight,
        width: bounds.width,
        height: detailEdgeHeight
      )
    )
    detailTopSoftEdge.transform = inspectorTranslation

    let mediaBottomInset = viewer.mediaBottomInset(in: mediaViewport.bounds.size)
    let mediaTranslation = mediaBottomInset - panelHeight
    viewer.transform = CGAffineTransform(translationX: 0, y: mediaTranslation * progress)

    layoutChrome(width: bounds.width)
    let headerTranslation = CGAffineTransform(translationX: 0, y: -panelHeight * progress)
    headerContainer.transform = headerTranslation
  }

  private func applySideInspectorProgress(_ progress: CGFloat) {
    let inspectorWidth = sideInspectorWidth
    let mediaWidth = bounds.width - inspectorWidth * progress
    mediaViewport.frame = CGRect(x: 0, y: 0, width: mediaWidth, height: bounds.height)
    viewer.transform = .identity
    setBaseFrame(viewer, mediaViewport.bounds)

    setBaseFrame(
      infoView,
      CGRect(x: bounds.width - inspectorWidth, y: 0, width: inspectorWidth, height: bounds.height)
    )
    infoView.transform = CGAffineTransform(translationX: inspectorWidth * (1 - progress), y: 0)
    detailTopSoftEdge.isHidden = true

    layoutChrome(width: mediaWidth)
    headerContainer.transform = .identity
  }

  private func layoutChrome(width: CGFloat) {
    let safeInsets = safeAreaInsets
    let headerHeight = safeInsets.top + 60
    setBaseFrame(statusBarSoftEdge, CGRect(x: 0, y: 0, width: width, height: headerHeight + 28))
    setBaseFrame(headerContainer, CGRect(x: 0, y: 0, width: width, height: headerHeight))

    let headerButtonY = safeInsets.top + 8
    backSurface.frame = CGRect(x: 12, y: headerButtonY, width: 44, height: 44)
    moreSurface.frame = CGRect(x: max(12, width - 56), y: headerButtonY, width: 44, height: 44)
    backButton.frame = backSurface.contentView.bounds
    moreButton.frame = moreSurface.contentView.bounds

    let copyFrame = CGRect(x: 68, y: safeInsets.top + 7, width: max(0, width - 136), height: 46)
    if subtitleLabel.isHidden {
      titleLabel.frame = copyFrame
      subtitleLabel.frame = .zero
    } else {
      titleLabel.frame = CGRect(x: copyFrame.minX, y: copyFrame.minY + 1, width: copyFrame.width, height: 22)
      subtitleLabel.frame = CGRect(x: copyFrame.minX, y: copyFrame.minY + 23, width: copyFrame.width, height: 17)
    }

    let footerHeight = safeInsets.bottom + 64
    let footerY = bounds.height - footerHeight
    footerSoftEdge.frame = CGRect(x: 0, y: footerY - 42, width: width, height: footerHeight + 42)
    footerContainer.frame = CGRect(x: 0, y: footerY, width: width, height: footerHeight)

    shareSurface.frame = CGRect(x: 18, y: 10, width: 44, height: 44)
    shareButton.frame = shareSurface.contentView.bounds

    let actionCount: CGFloat = socialActionsEnabled ? 3 : 1
    let actionWidth = actionCount * 44
    actionsSurface.frame = CGRect(
      x: max(74, (width - actionWidth) / 2),
      y: 10,
      width: actionWidth,
      height: 44
    )
    actionStack.frame = actionsSurface.contentView.bounds
    actionStack.layoutIfNeeded()

    if !commentBadge.isHidden {
      let badgeWidth = max(16, commentBadge.intrinsicContentSize.width + 7)
      commentBadge.frame = CGRect(x: commentsButton.bounds.maxX - badgeWidth + 3, y: -3, width: badgeWidth, height: 16)
      commentBadge.layer.cornerRadius = 8
    }

    let railSize = reactionRail.sizeThatFits(CGSize(width: width - 24, height: 46))
    reactionRail.frame = CGRect(
      x: max(12, width - railSize.width - 12),
      y: footerY - railSize.height - 8,
      width: min(railSize.width, width - 24),
      height: railSize.height
    )
  }

  private func setBaseFrame(_ view: UIView, _ frame: CGRect) {
    view.bounds = CGRect(origin: .zero, size: frame.size)
    view.center = CGPoint(x: frame.midX, y: frame.midY)
  }

  private func toggleInfo() {
    guard currentMetadata != nil else { return }
    setReactionRailPresented(false, animated: true)
    settleInfo(open: infoProgress < 0.5, velocity: 0)
  }

  private func settleInfo(open: Bool, velocity: CGFloat) {
    stopInfoAnimationAtCurrentPosition()
    let target: CGFloat = open ? 1 : 0
    guard abs(target - infoProgress) > 0.001 else {
      applyInfoProgress(target)
      return
    }

    guard !UIAccessibility.isReduceMotionEnabled else {
      applyInfoProgress(target)
      if open {
        UIAccessibility.post(notification: .screenChanged, argument: infoView)
      }
      return
    }

    let remainingTranslation: CGFloat
    if usesSideInspector {
      remainingTranslation = sideInspectorWidth * (infoProgress - target)
    } else {
      remainingTranslation = compactInspectorHeight * (infoProgress - target)
    }
    let normalizedVelocity = remainingTranslation == 0
      ? 0
      : min(max(velocity / remainingTranslation, -12), 12)
    let timing = UISpringTimingParameters(
      dampingRatio: 0.88,
      initialVelocity: usesSideInspector
        ? CGVector(dx: normalizedVelocity, dy: 0)
        : CGVector(dx: 0, dy: normalizedVelocity)
    )
    let animator = UIViewPropertyAnimator(duration: 0.5, timingParameters: timing)
    animator.isInterruptible = true
    animator.addAnimations { [weak self] in
      self?.applyInfoProgress(target)
    }
    animator.addCompletion { [weak self] position in
      guard let self else { return }
      infoAnimator = nil
      guard position == .end else { return }
      applyInfoProgress(target)
      if open {
        UIAccessibility.post(notification: .screenChanged, argument: infoView)
      }
    }
    infoAnimator = animator
    animator.startAnimation()
  }

  private func stopInfoAnimationAtCurrentPosition() {
    guard let animator = infoAnimator else { return }
    let progress = currentVisualInfoProgress()
    animator.stopAnimation(true)
    infoAnimator = nil
    applyInfoProgress(progress)
  }

  private func currentVisualInfoProgress() -> CGFloat {
    guard let presentation = infoView.layer.presentation() else { return infoProgress }
    let translationKey = usesSideInspector ? "transform.translation.x" : "transform.translation.y"
    guard let value = presentation.value(forKeyPath: translationKey) as? NSNumber else {
      return infoProgress
    }
    let translation = CGFloat(truncating: value)
    let distance = usesSideInspector ? sideInspectorWidth : compactInspectorHeight
    guard distance > 0 else { return infoProgress }
    return min(max(1 - translation / distance, 0), 1)
  }

  private var currentMetadata: PhotoDetailMetadata? {
    guard photos.indices.contains(currentIndex) else { return nil }
    return metadataByID[photos[currentIndex].id]
  }

  @objc private func handleInfoPan(_ gesture: UIPanGestureRecognizer) {
    let translation = gesture.translation(in: self).y
    let velocity = gesture.velocity(in: self).y
    let distance = max(compactInspectorHeight, 1)

    switch gesture.state {
    case .began:
      stopInfoAnimationAtCurrentPosition()
      infoGestureStartProgress = infoProgress
      setReactionRailPresented(false, animated: true)
    case .changed:
      applyInfoProgress(infoGestureStartProgress - translation / distance)
    case .ended:
      let progress = min(max(infoGestureStartProgress - translation / distance, 0), 1)
      applyInfoProgress(progress)
      let projectedProgress = progress - velocity / distance * 0.12
      settleInfo(open: projectedProgress >= 0.5, velocity: velocity)
    case .cancelled, .failed:
      settleInfo(open: infoProgress >= 0.5, velocity: 0)
    default:
      break
    }
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === infoPanGestureRecognizer else {
      return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
    guard !usesSideInspector,
          currentMetadata != nil,
          viewer.allowsInfoGesture()
    else {
      return false
    }

    let translation = infoPanGestureRecognizer.translation(in: self)
    let velocity = infoPanGestureRecognizer.velocity(in: self)
    let direction = abs(translation.x) + abs(translation.y) > 0.5 ? translation : velocity
    guard abs(direction.y) > abs(direction.x) * 1.12 else { return false }

    if infoProgress <= 0.001 {
      return direction.y < 0
    }
    if infoProgress >= 0.999 {
      guard direction.y > 0 else { return false }
      let point = infoPanGestureRecognizer.location(in: self)
      if infoView.frame.contains(point), let scrollView = scrollView(at: point) {
        let top = -scrollView.adjustedContentInset.top
        return scrollView.contentOffset.y <= top + 1
      }
    }
    return true
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    gestureRecognizer === infoPanGestureRecognizer || otherGestureRecognizer === infoPanGestureRecognizer
  }

  private func scrollView(at point: CGPoint) -> UIScrollView? {
    var candidate = hitTest(point, with: nil)
    while let view = candidate, view !== self {
      if let scrollView = view as? UIScrollView {
        return scrollView
      }
      candidate = view.superview
    }
    return nil
  }

  private func toggleReactionRail() {
    guard socialActionsEnabled else { return }
    if infoProgress > 0.001 {
      settleInfo(open: false, velocity: 0)
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
    if let popover = controller.popoverPresentationController {
      popover.sourceView = shareButton
      popover.sourceRect = shareButton.bounds
    }
    presenter.present(controller, animated: true)
  }
}
