import ExpoModulesCore
import UIKit

private enum PhotoOpeningState {
  case waiting
  case animating
  case completed
}

final class PhotoDetailView: ExpoView, UIGestureRecognizerDelegate {
  let onCommentsRequest = EventDispatcher()
  let onIndexChange = EventDispatcher()
  let onReactionRequest = EventDispatcher()
  let onRequestClose = EventDispatcher()

  private let viewer: PhotoViewerView
  private let backgroundView = UIView()
  private let mediaViewport = UIView()
  private let infoView = PhotoDetailInfoView()
  private let topScrim = PhotoDetailScrimView(edge: .top)
  private let bottomScrim = PhotoDetailScrimView(edge: .bottom)
  private let navigationBar = PhotoDetailNavigationBar()
  private let toolbar = PhotoDetailToolbar()
  private let reactionRail = PhotoDetailReactionRailView()
  private let reactionBurst = PhotoDetailReactionBurstLayer()
  private lazy var inspector = PhotoDetailInspectorPresenter(
    host: self,
    mediaViewport: mediaViewport,
    viewer: viewer,
    infoView: infoView
  )
  private lazy var tapGestureRecognizer: UITapGestureRecognizer = {
    let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleUserTap))
    recognizer.delegate = self
    recognizer.numberOfTapsRequired = 1
    return recognizer
  }()

  private lazy var dismissPanGestureRecognizer: UIPanGestureRecognizer = {
    let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handleDismissPan))
    recognizer.delegate = self
    recognizer.maximumNumberOfTouches = 1
    return recognizer
  }()

  private var currentIndex = 0
  private var initialIndex = 0
  private var photos: [MasonryPhoto] = []
  private var metadataByID: [String: PhotoDetailMetadata] = [:]
  private var strings = PhotoDetailStrings()
  private var commentCount = -1
  private var socialActionsEnabled = false
  private var reactionRailPresented = false
  private var reactionFailureNonce: Double = 0
  private var visibility = PhotoDetailChromeVisibility(userHidden: false, infoProgress: 0, zoomed: false)
  private var lastLayoutSize = CGSize.zero
  private var presenterSnapshotView: PhotoPresenterSnapshotView?
  private var pendingOpeningSnapshot: PhotoOpeningSnapshot?
  private var openingFallbackWorkItem: DispatchWorkItem?
  private var openingState = PhotoOpeningState.waiting
  private var transitionID = ""
  private var hasReceivedTransitionID = false
  private var dismissCommitted = false
  private var dragTranslation = CGPoint.zero
  private var dragScale: CGFloat = 1
  private var flyTargetRect: CGRect?

  required init(appContext: AppContext? = nil) {
    viewer = PhotoViewerView(appContext: appContext)
    super.init(appContext: appContext)

    backgroundColor = .clear
    clipsToBounds = true
    accessibilityIdentifier = "photo-detail-native"

    // The backdrop is a standalone view (instead of layer backgrounds) so the
    // interactive dismiss can fade it independently of the photo.
    backgroundView.backgroundColor = .black
    addSubview(backgroundView)

    mediaViewport.backgroundColor = .clear
    mediaViewport.clipsToBounds = true
    addSubview(mediaViewport)
    mediaViewport.addSubview(viewer)
    addSubview(bottomScrim)
    addSubview(infoView)
    addSubview(topScrim)
    addSubview(navigationBar)
    addSubview(toolbar)
    // Particles rise straight through where the combo counter sits, so they go
    // under the rail rather than over it.
    addSubview(reactionBurst)
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

    backgroundView.frame = bounds
    infoView.installScrollEdgeEffect(under: toolbar)
    if lastLayoutSize != bounds.size {
      inspector.stopAnimationAtCurrentPosition()
      lastLayoutSize = bounds.size
    }
    // Reapplying inspector layout sets frames on the media viewport, which is
    // undefined while the dismiss drag has a transform on it.
    if !visibility.dismissing, openingState != .animating {
      inspector.reapplyProgress()
    }
    beginOpeningTransitionIfReady()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsLayout()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      openingFallbackWorkItem?.cancel()
      openingFallbackWorkItem = nil
      pendingOpeningSnapshot?.removeFromSuperview()
      pendingOpeningSnapshot = nil
      let snapshot = presenterSnapshotView
      presenterSnapshotView = nil
      if dismissCommitted {
        snapshot?.beginPresenterHandoff()
      } else {
        snapshot?.removeFromSuperview()
      }
      return
    }
    beginOpeningTransitionIfReady()
    DispatchQueue.main.async { [weak self] in
      self?.beginOpeningTransitionIfReady()
    }
  }

  private static let openingDuration: TimeInterval = 0.42
  private static let openingBackdropDuration: TimeInterval = 0.24
  private static let openingChromeDuration: TimeInterval = 0.16

  private func beginOpeningTransitionIfReady() {
    guard openingState == .waiting, hasReceivedTransitionID else { return }
    guard !transitionID.isEmpty else {
      completeOpeningWithoutAnimation()
      return
    }
    if pendingOpeningSnapshot == nil {
      pendingOpeningSnapshot = PhotoTransitionRegistry.shared.takeOpeningSnapshot(id: transitionID)
    }
    guard let openingSnapshot = pendingOpeningSnapshot,
          let hostWindow = openingSnapshot.hostWindow,
          window === hostWindow,
          bounds.width > 0,
          bounds.height > 0,
          photos.indices.contains(currentIndex)
    else { return }

    viewer.layoutIfNeeded()
    guard let imageFrame = viewer.currentImageFrame() else { return }
    viewer.setOpeningPlaceholderImage(openingSnapshot.sourceImage)
    let imageFrameInViewport = viewer.convert(imageFrame, to: mediaViewport)
    let sourceRect = convert(openingSnapshot.sourceFrameInWindow, from: hostWindow)
    let snapshotFrame = convert(openingSnapshot.frameInWindow, from: hostWindow)
    guard let openingTransition = mediaViewportTransition(
      imageFrame: imageFrameInViewport,
      targetRect: sourceRect
    ) else { return }

    openingState = .animating
    openingFallbackWorkItem?.cancel()
    openingFallbackWorkItem = nil
    pendingOpeningSnapshot = nil
    isUserInteractionEnabled = false

    let sourceView = PhotoTransitionRegistry.shared.sourceView(id: transitionID)
    let presenter = PhotoPresenterSnapshotView(
      frame: snapshotFrame,
      contentView: openingSnapshot.contentView,
      handoffFrameInWindow: openingSnapshot.frameInWindow,
      hostWindow: hostWindow,
      presenterView: viewer.presenterScreenView(),
      sourceView: sourceView
    )

    UIView.performWithoutAnimation {
      insertSubview(presenter, belowSubview: backgroundView)
      let holeRect = presenter.convert(sourceRect, from: self)
      presenter.coverLandingSlot(holeRect)
      presenterSnapshotView = presenter
      flyTargetRect = sourceRect

      backgroundView.alpha = 0
      mediaViewport.alpha = 1
      mediaViewport.transform = openingTransition.transform
      setOpeningChromeAlpha(0)
      layoutIfNeeded()
    }

    guard !UIAccessibility.isReduceMotionEnabled else {
      completeOpeningTransition()
      return
    }

    UIView.animate(
      withDuration: Self.openingDuration,
      delay: 0,
      usingSpringWithDamping: 0.92,
      initialSpringVelocity: 0,
      options: [.allowUserInteraction, .beginFromCurrentState],
      animations: { [self] in
        mediaViewport.transform = .identity
      },
      completion: { [weak self] _ in self?.completeOpeningTransition() }
    )
    UIView.animate(
      withDuration: Self.openingBackdropDuration,
      delay: 0,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
      animations: { [self] in backgroundView.alpha = 1 }
    )
    UIView.animate(
      withDuration: Self.openingChromeDuration,
      delay: Self.openingDuration - Self.openingChromeDuration,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
      animations: visibilityChanges()
    )
  }

  private func completeOpeningTransition() {
    guard openingState != .completed else { return }
    openingState = .completed
    openingFallbackWorkItem?.cancel()
    openingFallbackWorkItem = nil
    UIView.performWithoutAnimation { [self] in
      backgroundView.alpha = 1
      mediaViewport.alpha = 1
      mediaViewport.transform = .identity
      applyVisibility(animated: false)
      presenterSnapshotView?.isHidden = true
      isUserInteractionEnabled = true
      setNeedsLayout()
    }
  }

  private func completeOpeningWithoutAnimation() {
    guard openingState == .waiting else { return }
    pendingOpeningSnapshot?.removeFromSuperview()
    pendingOpeningSnapshot = nil
    openingState = .completed
    openingFallbackWorkItem?.cancel()
    openingFallbackWorkItem = nil
    backgroundView.alpha = 1
    mediaViewport.alpha = 1
    mediaViewport.transform = .identity
    applyVisibility(animated: false)
    isUserInteractionEnabled = true
  }

  private func scheduleOpeningFallback() {
    guard openingState == .waiting, openingFallbackWorkItem == nil else { return }
    let workItem = DispatchWorkItem { [weak self] in
      self?.completeOpeningWithoutAnimation()
    }
    openingFallbackWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: workItem)
  }

  private func setOpeningChromeAlpha(_ alpha: CGFloat) {
    navigationBar.alpha = alpha
    toolbar.alpha = alpha
    topScrim.alpha = alpha
    bottomScrim.alpha = alpha
    viewer.setLiveBadgeAlpha(alpha)
  }

  private func mediaViewportTransition(
    imageFrame: CGRect,
    targetRect: CGRect
  ) -> (transform: CGAffineTransform, translation: CGPoint)? {
    guard imageFrame.width > 0,
          imageFrame.height > 0,
          targetRect.width > 0,
          targetRect.height > 0
    else { return nil }

    let scale = max(targetRect.width / imageFrame.width, targetRect.height / imageFrame.height)
    let viewportCenter = CGPoint(x: mediaViewport.bounds.midX, y: mediaViewport.bounds.midY)
    let imageOffset = CGPoint(
      x: imageFrame.midX - viewportCenter.x,
      y: imageFrame.midY - viewportCenter.y
    )
    let translation = CGPoint(
      x: targetRect.midX - mediaViewport.center.x - scale * imageOffset.x,
      y: targetRect.midY - mediaViewport.center.y - scale * imageOffset.y
    )
    return (
      CGAffineTransform(translationX: translation.x, y: translation.y)
        .scaledBy(x: scale, y: scale),
      translation
    )
  }

  func setPhotos(_ photos: [MasonryPhoto]) {
    self.photos = photos
    currentIndex = clampedIndex(initialIndex)
    viewer.setPhotos(photos)
    updateCurrentMetadata()
    setNeedsLayout()
  }

  func setInitialIndex(_ index: Int) {
    initialIndex = index
    currentIndex = clampedIndex(index)
    viewer.initialIndex = index
    updateCurrentMetadata()
    setNeedsLayout()
  }

  func setTransitionID(_ id: String) {
    transitionID = id
    hasReceivedTransitionID = true
    viewer.transitionId = id
    if id.isEmpty {
      completeOpeningWithoutAnimation()
      return
    }
    pendingOpeningSnapshot = PhotoTransitionRegistry.shared.takeOpeningSnapshot(id: id)
    scheduleOpeningFallback()
    setNeedsLayout()
    DispatchQueue.main.async { [weak self] in
      self?.beginOpeningTransitionIfReady()
    }
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

  // JS has no haptic engine of its own; a bumped nonce is how a failed submit
  // asks the native side to buzz.
  func setReactionFailureNonce(_ nonce: Double) {
    let increased = nonce > reactionFailureNonce
    reactionFailureNonce = nonce
    guard increased else { return }
    reactionRail.playFailureFeedback()
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

    reactionRail.onSend = { [weak self] reaction, count in
      self?.requestReaction(reaction, count: count)
    }
    reactionRail.onEmitParticle = { [weak self] reaction, origin in
      guard let self else { return }
      reactionBurst.emit(reaction, from: reactionRail.convert(origin, to: reactionBurst))
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
    viewer.onNativeZoomChange = { [weak self] zoomed in
      guard let self else { return }
      visibility.zoomed = zoomed
      if zoomed {
        setReactionRailPresented(false, animated: true)
      }
      applyVisibility(animated: true)
      applyScreenTraits()
    }
    viewer.onNativeInfoRequest = { [weak self] in self?.toggleInfo() }
    viewer.onNativeRequestClose = { [weak self] in self?.requestClose() }

    addGestureRecognizer(tapGestureRecognizer)
    viewer.configureExternalTapGesture(tapGestureRecognizer)
    addGestureRecognizer(dismissPanGestureRecognizer)
    viewer.configureExternalDismissGesture(dismissPanGestureRecognizer)
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

    toolbar.layoutIfNeeded()
    let reactionsItemFrame = toolbar.reactionsItemFrame(in: self)
    reactionRail.anchorXCenter = reactionsItemFrame?.midX
    let railFrame = reactionRail.preferredFrame(
      containerWidth: width,
      bottomY: reactionsItemFrame?.minY ?? toolbarY
    )
    reactionRail.bounds = CGRect(origin: .zero, size: railFrame.size)
    reactionRail.center = CGPoint(x: railFrame.midX, y: railFrame.midY)
    reactionBurst.frame = CGRect(x: 0, y: 0, width: width, height: bounds.height)
  }

  private func applyVisibility(animated: Bool) {
    let changes = visibilityChanges()
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

  private func visibilityChanges() -> () -> Void {
    { [self] in
      navigationBar.alpha = visibility.navBarAlpha
      toolbar.alpha = visibility.toolbarAlpha
      topScrim.alpha = visibility.topScrimAlpha
      bottomScrim.alpha = visibility.bottomScrimAlpha
      viewer.setLiveBadgeAlpha(visibility.liveBadgeAlpha)
    }
  }

  private static let dismissDistance: CGFloat = 340
  private static let dismissCommitProgress: CGFloat = 0.45
  private static let dismissCommitVelocity: CGFloat = 1200
  private static let dismissCommitMinimumTranslation: CGFloat = 100
  private static let dismissMinimumScale: CGFloat = 0.68

  @objc private func handleDismissPan(_ gesture: UIPanGestureRecognizer) {
    switch gesture.state {
    case .began:
      dismissDragBegan()
    case .changed:
      applyDismissDrag(gesture.translation(in: self))
    case .ended:
      let translation = gesture.translation(in: self)
      let velocity = gesture.velocity(in: self)
      if dismissProgress(for: translation) > Self.dismissCommitProgress
        || (velocity.y > Self.dismissCommitVelocity
          && translation.y > Self.dismissCommitMinimumTranslation) {
        commitDismissDrag(velocity: velocity)
      } else {
        cancelDismissDrag(velocity: velocity)
      }
    case .cancelled, .failed:
      cancelDismissDrag(velocity: gesture.velocity(in: self))
    default:
      break
    }
  }

  private func dismissDragBegan() {
    guard !visibility.dismissing else { return }
    visibility.dismissing = true
    presenterSnapshotView?.isHidden = false
    setReactionRailPresented(false, animated: true)

    let changes = visibilityChanges()
    if UIAccessibility.isReduceMotionEnabled {
      changes()
    } else {
      UIView.animate(
        withDuration: 0.15,
        delay: 0,
        options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
        animations: changes
      )
    }
  }

  private func dismissProgress(for translation: CGPoint) -> CGFloat {
    min(max(translation.y / Self.dismissDistance, 0), 1)
  }

  private func applyDismissDrag(_ translation: CGPoint) {
    guard !dismissCommitted else { return }
    let progress = dismissProgress(for: translation)
    let translationY = translation.y > 0 ? translation.y : translation.y / 3
    let scale = 1 - (1 - Self.dismissMinimumScale) * progress
    dragTranslation = CGPoint(x: translation.x, y: translationY)
    dragScale = scale
    mediaViewport.transform = CGAffineTransform(translationX: translation.x, y: translationY)
      .scaledBy(x: scale, y: scale)
    backgroundView.alpha = 1 - progress
  }

  private func commitDismissDrag(velocity: CGPoint) {
    guard !dismissCommitted else { return }
    dismissCommitted = true
    viewer.disableCloseTransition()

    guard !UIAccessibility.isReduceMotionEnabled else {
      UIView.animate(
        withDuration: 0.12,
        animations: { [self] in
          backgroundView.alpha = 0
          mediaViewport.alpha = 0
        },
        completion: { [weak self] _ in self?.completeDismissAndRequestClose() }
      )
      return
    }

    if let targetRect = flyTargetRect,
       currentIndex == initialIndex,
       let imageFrame = viewer.currentImageFrame(),
       let flyTransition = mediaViewportTransition(
         imageFrame: viewer.convert(imageFrame, to: mediaViewport),
         targetRect: targetRect
       ) {
      // Masonry cells preserve the photo's aspect ratio, so the aspect-fit
      // rect maps exactly onto the blank slot — landing there and popping
      // without animation swaps to the identical live cell.
      let duration = dismissSettlingDuration(
        from: dragTranslation,
        to: flyTransition.translation,
        velocity: velocity
      )
      let springVelocity = normalizedSpringVelocity(
        from: dragTranslation,
        to: flyTransition.translation,
        velocity: velocity
      )

      UIView.animate(
        withDuration: duration,
        delay: 0,
        usingSpringWithDamping: 0.92,
        initialSpringVelocity: springVelocity,
        options: [.allowUserInteraction, .beginFromCurrentState],
        animations: { [self] in
          mediaViewport.transform = flyTransition.transform
        },
        completion: { [weak self] _ in self?.completeDismissAndRequestClose() }
      )
      UIView.animate(
        withDuration: min(duration, 0.24),
        delay: 0,
        options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
        animations: { [self] in backgroundView.alpha = 0 }
      )
      return
    }

    // No reliable slot to land in (the pager moved to another photo) —
    // continue along the gesture's direction while fading out instead.
    let driftX = min(max(velocity.x * 0.08, -70), 70)
    let driftY = min(max(velocity.y * 0.08, 90), 260)
    let exitTransform = CGAffineTransform(
      translationX: dragTranslation.x + driftX,
      y: dragTranslation.y + driftY
    ).scaledBy(x: dragScale * 0.88, y: dragScale * 0.88)

    UIView.animate(
      withDuration: 0.22,
      delay: 0,
      options: [.curveEaseOut, .beginFromCurrentState],
      animations: { [self] in
        mediaViewport.transform = exitTransform
        mediaViewport.alpha = 0
        backgroundView.alpha = 0
      },
      completion: { [weak self] _ in self?.completeDismissAndRequestClose() }
    )
  }

  private func cancelDismissDrag(velocity: CGPoint) {
    guard !dismissCommitted else { return }
    visibility.dismissing = false
    let duration = dismissSettlingDuration(
      from: dragTranslation,
      to: .zero,
      velocity: velocity
    )
    let springVelocity = normalizedSpringVelocity(
      from: dragTranslation,
      to: .zero,
      velocity: velocity
    )
    if UIAccessibility.isReduceMotionEnabled {
      mediaViewport.transform = .identity
      backgroundView.alpha = 1
      dragTranslation = .zero
      dragScale = 1
      presenterSnapshotView?.isHidden = true
    } else {
      UIView.animate(
        withDuration: duration,
        delay: 0,
        usingSpringWithDamping: 0.9,
        initialSpringVelocity: springVelocity,
        options: [.allowUserInteraction, .beginFromCurrentState],
        animations: { [self] in mediaViewport.transform = .identity },
        completion: { [weak self] _ in
          guard let self, !visibility.dismissing else { return }
          dragTranslation = .zero
          dragScale = 1
        }
      )
      UIView.animate(
        withDuration: min(duration, 0.22),
        delay: 0,
        options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
        animations: { [self] in backgroundView.alpha = 1 },
        completion: { [weak self] _ in
          guard let self, !visibility.dismissing else { return }
          presenterSnapshotView?.isHidden = true
        }
      )
    }

    let chromeDelay = UIAccessibility.isReduceMotionEnabled ? 0 : min(duration * 0.28, 0.12)
    let changes = visibilityChanges()
    guard chromeDelay > 0 else {
      changes()
      return
    }
    UIView.animate(
      withDuration: min(duration - chromeDelay, 0.24),
      delay: chromeDelay,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
      animations: changes
    )
  }

  private func normalizedSpringVelocity(
    from current: CGPoint,
    to target: CGPoint,
    velocity: CGPoint
  ) -> CGFloat {
    let delta = CGPoint(x: target.x - current.x, y: target.y - current.y)
    let squaredDistance = delta.x * delta.x + delta.y * delta.y
    guard squaredDistance > 1 else { return 0 }
    let projectedVelocity = (velocity.x * delta.x + velocity.y * delta.y) / squaredDistance
    return min(max(projectedVelocity, -1.2), 3)
  }

  private func dismissSettlingDuration(
    from current: CGPoint,
    to target: CGPoint,
    velocity: CGPoint
  ) -> TimeInterval {
    let delta = CGPoint(x: target.x - current.x, y: target.y - current.y)
    let distance = hypot(delta.x, delta.y)
    guard distance > 1 else { return 0.26 }
    let velocityTowardTarget = max(0, (velocity.x * delta.x + velocity.y * delta.y) / distance)
    let distanceAddition = min(distance / 1_200, 0.14)
    let velocityReduction = min(velocityTowardTarget / 12_000, 0.08)
    return min(max(0.28 + distanceAddition - velocityReduction, 0.26), 0.42)
  }

  private func completeDismissAndRequestClose() {
    // Replace the moving photo with the complete frozen grid in the same
    // transaction. React may process the route pop one or more frames later;
    // keeping this snapshot visible prevents the navigation container from
    // becoming the visual owner during that variable interval.
    UIView.performWithoutAnimation { [self] in
      presenterSnapshotView?.revealLandingSlot()
      backgroundView.alpha = 0
      mediaViewport.alpha = 0
      layoutIfNeeded()
    }
    onRequestClose([:])
  }

  private func applyScreenTraits() {
    viewer.applyScreenTraits(
      statusBarHidden: visibility.statusBarHidden,
      homeIndicatorHidden: visibility.homeIndicatorHidden
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

  @objc private func handleUserTap() {
    guard visibility.allowsImmersiveToggle else { return }
    visibility.userHidden.toggle()
    if visibility.userHidden {
      setReactionRailPresented(false, animated: true)
    }
    applyVisibility(animated: true)
    applyScreenTraits()
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === dismissPanGestureRecognizer else {
      return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
    guard !dismissCommitted,
          viewer.interactiveDismissEnabled,
          inspector.progress <= 0.001,
          viewer.allowsInfoGesture()
    else { return false }

    let translation = dismissPanGestureRecognizer.translation(in: self)
    let velocity = dismissPanGestureRecognizer.velocity(in: self)
    let direction = abs(translation.x) + abs(translation.y) > 0.5 ? translation : velocity
    guard abs(direction.y) > abs(direction.x) * 1.12 else { return false }
    return direction.y > 0
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldReceive touch: UITouch
  ) -> Bool {
    guard gestureRecognizer === tapGestureRecognizer || gestureRecognizer === dismissPanGestureRecognizer,
          let touchView = touch.view
    else { return true }

    // Buttons and controls hosted in the chrome must perform their own action
    // instead of toggling immersive mode. The inspector counts as chrome: its
    // disclosure groups need the tap, and the recogniser cancels touches in view.
    let chromeSubtrees: [UIView] = [navigationBar, toolbar, reactionRail, infoView]
    if chromeSubtrees.contains(where: touchView.isDescendant(of:)) {
      return false
    }

    var ancestor: UIView? = touchView
    while let current = ancestor {
      if current is LivePhotoBadgeView { return false }
      ancestor = current.superview
    }
    return true
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
    // UIBarButtonItem exposes no touch-down, so this is the earliest hook for
    // warming the generators — still ahead of the first scrub tick.
    reactionRail.prepareHaptics()
    setReactionRailPresented(!reactionRailPresented, animated: true)
  }

  private func setReactionRailPresented(_ presented: Bool, animated: Bool) {
    reactionRailPresented = presented
    reactionRail.setPresented(presented, animated: animated)
    if !presented {
      reactionBurst.clear()
    }
    updateToolbarState()
  }

  private func requestClose() {
    guard openingState == .completed, !dismissCommitted else { return }
    setReactionRailPresented(false, animated: false)
    dismissDragBegan()
    commitDismissDrag(velocity: .zero)
  }

  private func requestComments() {
    guard socialActionsEnabled, photos.indices.contains(currentIndex) else { return }
    setReactionRailPresented(false, animated: true)
    let photo = photos[currentIndex]
    onCommentsRequest(["id": photo.id, "index": currentIndex])
  }

  // The rail deliberately stays up: applause is repeatable, and dismissing after
  // every send would make a second clap cost two taps.
  private func requestReaction(_ reaction: String, count: Int) {
    guard socialActionsEnabled, count > 0, photos.indices.contains(currentIndex) else { return }
    let photo = photos[currentIndex]
    onReactionRequest([
      "count": count,
      "id": photo.id,
      "index": currentIndex,
      "reaction": reaction,
    ])
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

/// A frozen presenter that remains composited until React Navigation has
/// restored the live screen. The view owns its display link, so its lifetime is
/// independent of `PhotoDetailView`, which is released during the route pop.
private final class PhotoPresenterSnapshotView: UIView {
  private let contentView: UIView
  private let handoffFrameInWindow: CGRect
  private weak var hostWindow: UIWindow?
  private weak var presenterView: UIView?
  private weak var sourceView: UIView?
  private var landingSlotCover: UIView?
  private var landingSlotReplica: UIView?
  private var handoffDisplayLink: CADisplayLink?
  private var handoffStartedAt: CFTimeInterval = 0
  private var presenterReadySince: CFTimeInterval?

  init(
    frame: CGRect,
    contentView: UIView,
    handoffFrameInWindow: CGRect,
    hostWindow: UIWindow?,
    presenterView: UIView?,
    sourceView: UIView?
  ) {
    self.contentView = contentView
    self.handoffFrameInWindow = handoffFrameInWindow
    self.hostWindow = hostWindow
    self.presenterView = presenterView
    self.sourceView = sourceView
    super.init(frame: frame)

    isUserInteractionEnabled = false
    backgroundColor = .black
    contentView.frame = bounds
    contentView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(contentView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  deinit {
    handoffDisplayLink?.invalidate()
  }

  func coverLandingSlot(_ frame: CGRect) {
    let replica: UIView?
    if let sourceImageView = sourceView as? UIImageView,
       let image = sourceImageView.image {
      let imageReplica = UIImageView(image: image)
      imageReplica.contentMode = sourceImageView.contentMode
      imageReplica.clipsToBounds = sourceImageView.clipsToBounds
      imageReplica.layer.cornerCurve = sourceImageView.layer.cornerCurve
      imageReplica.layer.cornerRadius = sourceImageView.layer.cornerRadius
      imageReplica.layer.maskedCorners = sourceImageView.layer.maskedCorners
      replica = imageReplica
    } else {
      replica = sourceView?.snapshotView(afterScreenUpdates: false)
    }
    if let replica {
      replica.frame = frame
      addSubview(replica)
      landingSlotReplica = replica
    }

    let cover = UIView(frame: frame)
    cover.backgroundColor = .black
    addSubview(cover)
    landingSlotCover = cover
  }

  func revealLandingSlot() {
    landingSlotCover?.isHidden = true
  }

  func beginPresenterHandoff() {
    guard handoffDisplayLink == nil else { return }
    guard superview != nil || hostWindow != nil else {
      removeFromSuperview()
      return
    }

    isHidden = false
    if let hostWindow {
      removeFromSuperview()
      frame = handoffFrameInWindow
      hostWindow.addSubview(self)
    }
    superview?.bringSubviewToFront(self)
    handoffStartedAt = CACurrentMediaTime()
    let displayLink = CADisplayLink(target: self, selector: #selector(handleHandoffFrame(_:)))
    handoffDisplayLink = displayLink
    displayLink.add(to: .main, forMode: .common)
  }

  @objc private func handleHandoffFrame(_ displayLink: CADisplayLink) {
    guard superview != nil else {
      stopHandoff()
      return
    }

    if isLivePresenterReady {
      presenterView?.layoutIfNeeded()
      sourceView?.superview?.layoutIfNeeded()
      // RNScreens can reorder its children again while completing the pop.
      // Reassert the frozen presenter's ownership until the handoff finishes.
      superview?.bringSubviewToFront(self)
      if presenterReadySince == nil {
        presenterReadySince = displayLink.timestamp
      }
    } else {
      presenterReadySince = nil
    }

    // The source view can report visible before RNScreens and Core Animation
    // have committed its final layer tree. A short stable interval bridges
    // that compositor handoff without relying on a fixed frame count.
    if let presenterReadySince,
       displayLink.timestamp - presenterReadySince >= 0.18 {
      finishHandoff(animated: true)
    } else if displayLink.timestamp - handoffStartedAt >= 1 {
      // A bounded fallback prevents a stale snapshot from surviving an
      // interrupted or replaced navigation operation indefinitely.
      finishHandoff(animated: isLivePresenterReady)
    }
  }

  private var isLivePresenterReady: Bool {
    guard let presenterView,
          presenterView.window != nil,
          presenterView.superview != nil,
          presenterView.bounds.width > 0,
          presenterView.bounds.height > 0,
          !presenterView.isHidden,
          presenterView.alpha > 0.01
    else { return false }

    guard let sourceView else { return true }
    guard sourceView.window != nil,
          sourceView.superview != nil,
          !(sourceView is UIImageView) || (sourceView as? UIImageView)?.image != nil
    else { return false }

    // Window membership alone is insufficient: every ancestor through the
    // presenter must be visibly composited before the frozen grid is released.
    var candidate: UIView? = sourceView
    while let view = candidate {
      let renderedOpacity = view.layer.presentation()?.opacity ?? view.layer.opacity
      guard !view.isHidden,
            !view.layer.isHidden,
            view.alpha > 0.99,
            renderedOpacity > 0.99
      else { return false }
      if view === presenterView { return true }
      candidate = view.superview
    }
    return false
  }

  private func finishHandoff(animated: Bool) {
    stopHandoff()
    guard animated else {
      removeFromSuperview()
      return
    }

    // The snapshot content is already opaque, so clearing the backing color is
    // visually neutral. Fading both the content and its black backing together
    // would expose the black layer between two otherwise identical grid frames,
    // causing a brief whole-screen dim during the crossfade.
    UIView.performWithoutAnimation {
      backgroundColor = .clear
    }
    UIView.animate(
      withDuration: 0.08,
      delay: 0,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
      animations: {
        self.contentView.alpha = 0
        self.landingSlotCover?.alpha = 0
      },
      completion: { [weak self] _ in self?.finishLandingSlotHandoff() }
    )
  }

  private func finishLandingSlotHandoff() {
    contentView.removeFromSuperview()
    landingSlotCover?.removeFromSuperview()
    guard let landingSlotReplica else {
      removeFromSuperview()
      return
    }

    // Keep a stable copy of the destination cell above the live grid through
    // its final compositor commit. The copy is noninteractive and visually
    // identical, preventing a one-frame empty source slot.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self, weak landingSlotReplica] in
      guard let self, let landingSlotReplica else { return }
      UIView.animate(
        withDuration: 0.06,
        delay: 0,
        options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
        animations: { landingSlotReplica.alpha = 0 },
        completion: { [weak self] _ in self?.removeFromSuperview() }
      )
    }
  }

  private func stopHandoff() {
    handoffDisplayLink?.invalidate()
    handoffDisplayLink = nil
  }
}
