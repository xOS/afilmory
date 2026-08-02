import ExpoModulesCore
import RNScreens
import SDWebImage
import UIKit

final class PhotoViewerView: ExpoView {
  let onIndexChange = EventDispatcher()
  let onInfoGesture = EventDispatcher()
  let onInfoRequest = EventDispatcher()
  let onRequestClose = EventDispatcher()

  var onNativeIndexChange: ((MasonryPhoto, Int) -> Void)?
  var onNativeInfoRequest: (() -> Void)?
  var onNativeRequestClose: (() -> Void)?
  var onNativeZoomChange: ((Bool) -> Void)?

  var keyboardCloseTitle = ""
  var keyboardInfoTitle = ""
  var keyboardNextTitle = ""
  var keyboardPreviousTitle = ""
  var interactiveDismissEnabled = true
  var infoPresented = false

  var livePhotoStringsJSON = "" {
    didSet {
      guard livePhotoStringsJSON != oldValue else { return }
      livePhotoStrings = LivePhotoBadgeStrings.decoded(from: livePhotoStringsJSON)
      collectionView.reloadData()
    }
  }

  private var livePhotoStrings = LivePhotoBadgeStrings()
  // Playback modes deliberately live for the length of the viewer session only:
  // Afilmory photos are remote and shareable, so there is no per-asset store to
  // persist them into the way the Photos library does.
  private var livePhotoModes: [String: LivePhotoPlaybackMode] = [:]

  var initialIndex = 0 {
    didSet {
      hasPositionedInitialPhoto = false
      setNeedsLayout()
    }
  }

  var transitionId = "" {
    didSet {
      guard transitionId != oldValue else { return }
      configureRouteTransitionWhenReady()
    }
  }

  private var photos: [MasonryPhoto] = []
  private let layout = UICollectionViewFlowLayout()
  private var collectionView: UICollectionView!
  private var currentIndex = 0
  private var hasPositionedInitialPhoto = false
  private var reportedZoomState = false
  private lazy var infoPanGestureRecognizer = UIPanGestureRecognizer(target: self, action: #selector(handleInfoPan))
  private var externalTapGestureRecognizer: UITapGestureRecognizer?
  private weak var configuredScreen: RNSScreen?
  private var configuredTransitionId = ""
  private var prefetchTokens: [Int: SDWebImagePrefetchToken] = [:]
  private var liveBadgeAlpha: CGFloat = 1
  private var statusBarHidden = false
  private var homeIndicatorHidden = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    layout.minimumInteritemSpacing = 0
    layout.minimumLineSpacing = 0
    layout.scrollDirection = .horizontal

    collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    collectionView.backgroundColor = .clear
    collectionView.contentInsetAdjustmentBehavior = .never
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.decelerationRate = .fast
    collectionView.isPagingEnabled = true
    collectionView.showsHorizontalScrollIndicator = false
    collectionView.register(PhotoViewerCell.self, forCellWithReuseIdentifier: PhotoViewerCell.reuseIdentifier)
    addSubview(collectionView)

    infoPanGestureRecognizer.cancelsTouchesInView = false
    infoPanGestureRecognizer.delegate = self
    infoPanGestureRecognizer.maximumNumberOfTouches = 1
    addGestureRecognizer(infoPanGestureRecognizer)
    collectionView.panGestureRecognizer.require(toFail: infoPanGestureRecognizer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.width > 0, bounds.height > 0 else { return }

    let sizeChanged = layout.itemSize != bounds.size
    if sizeChanged, hasPositionedInitialPhoto, collectionView.bounds.width > 0 {
      updateCurrentIndexFromOffset()
    }
    collectionView.frame = bounds
    if sizeChanged {
      cancelPrefetches()
      layout.itemSize = bounds.size
      layout.invalidateLayout()
    }

    positionInitialPhotoIfNeeded()
    if sizeChanged, hasPositionedInitialPhoto {
      collectionView.layoutIfNeeded()
      collectionView.setContentOffset(
        CGPoint(x: CGFloat(currentIndex) * collectionView.bounds.width, y: 0),
        animated: false
      )
      prefetchNeighborPhotos()
    }
  }

  override var canBecomeFirstResponder: Bool { true }

  override var keyCommands: [UIKeyCommand]? {
    [
      makeKeyCommand(
        input: UIKeyCommand.inputLeftArrow,
        modifiers: [],
        action: #selector(showPreviousPhoto),
        title: keyboardPreviousTitle
      ),
      makeKeyCommand(
        input: UIKeyCommand.inputRightArrow,
        modifiers: [],
        action: #selector(showNextPhoto),
        title: keyboardNextTitle
      ),
      makeKeyCommand(
        input: UIKeyCommand.inputEscape,
        modifiers: [],
        action: #selector(requestClose),
        title: keyboardCloseTitle
      ),
      makeKeyCommand(
        input: "i",
        modifiers: .command,
        action: #selector(requestInfo),
        title: keyboardInfoTitle
      ),
    ]
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      becomeFirstResponder()
    }
  }

  override func didMoveToSuperview() {
    super.didMoveToSuperview()
    if superview != nil {
      configureRouteTransitionWhenReady()
      pushScreenTraitsWhenReady()
      return
    }

    cancelPrefetches()
    deactivateVisibleCells()
    guard !transitionId.isEmpty else { return }
    let releasedId = transitionId
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
      PhotoTransitionRegistry.shared.release(id: releasedId)
    }
  }

  func setPhotos(_ newPhotos: [MasonryPhoto]) {
    cancelPrefetches()
    deactivateVisibleCells()
    photos = newPhotos
    currentIndex = clampedIndex(initialIndex)
    hasPositionedInitialPhoto = false
    collectionView.reloadData()
    setNeedsLayout()
  }

  private func positionInitialPhotoIfNeeded() {
    guard !hasPositionedInitialPhoto, !photos.isEmpty, collectionView.bounds.width > 0 else { return }
    currentIndex = clampedIndex(initialIndex)
    collectionView.layoutIfNeeded()
    collectionView.setContentOffset(
      CGPoint(x: CGFloat(currentIndex) * collectionView.bounds.width, y: 0),
      animated: false
    )
    hasPositionedInitialPhoto = true
    updateActivePhoto(emit: false)
  }

  private func clampedIndex(_ index: Int) -> Int {
    guard !photos.isEmpty else { return 0 }
    return min(max(index, 0), photos.count - 1)
  }

  private func updateCurrentIndexFromOffset() {
    guard collectionView.bounds.width > 0, !photos.isEmpty else { return }
    let index = clampedIndex(Int(round(collectionView.contentOffset.x / collectionView.bounds.width)))
    guard index != currentIndex else { return }
    currentIndex = index
    updateActivePhoto(emit: true)
  }

  private func updateActivePhoto(emit: Bool) {
    guard photos.indices.contains(currentIndex) else { return }
    let photo = photos[currentIndex]
    if !transitionId.isEmpty {
      PhotoTransitionRegistry.shared.updatePhoto(id: transitionId, photoId: photo.id)
    }
    if emit {
      onIndexChange(["id": photo.id, "index": currentIndex])
    }
    onNativeIndexChange?(photo, currentIndex)
    updateVisibleCellActivity()
    prefetchNeighborPhotos()
  }

  private func prefetchNeighborPhotos() {
    let viewportSize = collectionView.bounds.size
    guard viewportSize.width > 0, viewportSize.height > 0, !photos.isEmpty else { return }

    let desiredIndices = Set([currentIndex - 1, currentIndex + 1].filter { photos.indices.contains($0) })
    let staleIndices = prefetchTokens.keys.filter { !desiredIndices.contains($0) }
    for index in staleIndices {
      prefetchTokens[index]?.cancel()
      prefetchTokens.removeValue(forKey: index)
    }

    let screenScale = window?.screen.scale ?? UIScreen.main.scale
    for index in desiredIndices where prefetchTokens[index] == nil {
      let photo = photos[index]
      guard let url = URL(string: photo.originalUrl), !photo.originalUrl.isEmpty else { continue }
      let pixelSize = PhotoViewerImageSizing.pixelSize(
        for: photo,
        viewportSize: viewportSize,
        screenScale: screenScale,
        tier: 1
      )
      prefetchTokens[index] = SDWebImagePrefetcher.shared.prefetchURLs(
        [url],
        options: [.lowPriority, .retryFailed, .scaleDownLargeImages],
        context: [
          .imagePreserveAspectRatio: true,
          .imageThumbnailPixelSize: NSValue(cgSize: pixelSize),
        ],
        progress: nil,
        completed: nil
      )
    }
  }

  private func cancelPrefetches() {
    for token in prefetchTokens.values {
      token.cancel()
    }
    prefetchTokens.removeAll()
  }

  private func currentCell() -> PhotoViewerCell? {
    collectionView.cellForItem(at: IndexPath(item: currentIndex, section: 0)) as? PhotoViewerCell
  }

  private func updateVisibleCellActivity() {
    for case let cell as PhotoViewerCell in collectionView.visibleCells {
      guard let indexPath = collectionView.indexPath(for: cell) else { continue }
      cell.setActive(indexPath.item == currentIndex)
    }
    updatePagingEnabled()
  }

  private func deactivateVisibleCells() {
    for case let cell as PhotoViewerCell in collectionView.visibleCells {
      cell.setActive(false)
    }
    collectionView.isScrollEnabled = true
  }

  private func updatePagingEnabled() {
    let currentCell = currentCell()
    let zoomed = currentCell?.isZoomed ?? false
    collectionView.isScrollEnabled = !zoomed && !(currentCell?.blocksPaging ?? false)
    guard zoomed != reportedZoomState else { return }
    reportedZoomState = zoomed
    onNativeZoomChange?(zoomed)
  }

  private func makeKeyCommand(
    input: String,
    modifiers: UIKeyModifierFlags,
    action: Selector,
    title: String
  ) -> UIKeyCommand {
    let command = UIKeyCommand(input: input, modifierFlags: modifiers, action: action)
    command.wantsPriorityOverSystemBehavior = true
    if !title.isEmpty {
      command.discoverabilityTitle = title
    }
    return command
  }

  private func navigate(by delta: Int) {
    guard !photos.isEmpty else { return }
    let nextIndex = clampedIndex(currentIndex + delta)
    guard nextIndex != currentIndex else { return }
    currentCell()?.setActive(false)
    collectionView.setContentOffset(
      CGPoint(x: CGFloat(nextIndex) * collectionView.bounds.width, y: 0),
      animated: true
    )
  }

  @objc private func showPreviousPhoto() {
    navigate(by: -1)
  }

  @objc private func showNextPhoto() {
    navigate(by: 1)
  }

  @objc private func requestClose() {
    onNativeRequestClose?()
    onRequestClose([:])
  }

  @objc private func requestInfo() {
    onNativeInfoRequest?()
    onInfoRequest([:])
  }

  @objc private func handleInfoPan(_ gesture: UIPanGestureRecognizer) {
    let translation = gesture.translation(in: self).y
    let velocity = gesture.velocity(in: self).y
    switch gesture.state {
    case .began:
      onInfoGesture(["state": "began", "translationY": translation, "velocityY": velocity])
    case .changed:
      onInfoGesture(["state": "changed", "translationY": translation, "velocityY": velocity])
    case .ended:
      onInfoGesture(["state": "ended", "translationY": translation, "velocityY": velocity])
    case .cancelled:
      onInfoGesture(["state": "cancelled", "translationY": translation, "velocityY": velocity])
    default:
      break
    }
  }

  private func configureRouteTransitionWhenReady() {
    guard superview != nil, !transitionId.isEmpty else { return }
    DispatchQueue.main.async { [weak self] in
      self?.configureRouteTransition()
    }
  }

  private func pushScreenTraitsWhenReady() {
    guard superview != nil else { return }
    DispatchQueue.main.async { [weak self] in
      self?.pushScreenTraits()
    }
  }

  private func pushScreenTraits() {
    guard let screenView = findScreen()?.screenView() else { return }
    screenView.statusBarHidden = statusBarHidden
    screenView.homeIndicatorHidden = homeIndicatorHidden
    screenView.statusBarStyle = .light
    screenView.statusBarAnimation = .fade
  }

  private func configureRouteTransition() {
    guard let screen = findScreen() else { return }
    guard configuredScreen !== screen
      || configuredTransitionId != transitionId
    else { return }

    // The system zoom treats the complete RNSScreen as the shared element.
    // PhotoDetailView instead owns both directions as a photo-only transform,
    // so navigation must commit without adding a second visible animation.
    screen.preferredTransition = nil
    screen.screenView().stackAnimation = .none

    configuredScreen = screen
    configuredTransitionId = transitionId
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === infoPanGestureRecognizer else {
      return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
    guard !(currentCell()?.isZoomed ?? false), !(currentCell()?.blocksPaging ?? false) else {
      return false
    }
    let translation = infoPanGestureRecognizer.translation(in: self)
    let velocity = infoPanGestureRecognizer.velocity(in: self)
    let direction = abs(translation.x) + abs(translation.y) > 0.5 ? translation : velocity
    guard abs(direction.y) > abs(direction.x) * 1.12 else { return false }
    return true
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    gestureRecognizer === infoPanGestureRecognizer || otherGestureRecognizer === infoPanGestureRecognizer
  }

  private func findScreen() -> RNSScreen? {
    var responder: UIResponder? = self
    while let current = responder {
      if let screen = current as? RNSScreen {
        return screen
      }
      responder = current.next
    }
    return nil
  }

  func configureExternalInfoGesture(_ gestureRecognizer: UIPanGestureRecognizer) {
    infoPanGestureRecognizer.isEnabled = false
    collectionView.panGestureRecognizer.require(toFail: gestureRecognizer)
  }

  func configureExternalDismissGesture(_ gestureRecognizer: UIPanGestureRecognizer) {
    collectionView.panGestureRecognizer.require(toFail: gestureRecognizer)
  }

  func currentPhotoId() -> String? {
    guard photos.indices.contains(currentIndex) else { return nil }
    return photos[currentIndex].id
  }

  func currentImageFrame() -> CGRect? {
    guard photos.indices.contains(currentIndex), bounds.width > 0, bounds.height > 0 else {
      return nil
    }
    let photo = photos[currentIndex]
    let width = CGFloat(photo.width)
    let height = CGFloat(photo.height)
    guard width > 0, height > 0 else { return bounds }

    let aspectRatio = width / height
    var targetWidth = bounds.width
    var targetHeight = targetWidth / aspectRatio
    if targetHeight > bounds.height {
      targetHeight = bounds.height
      targetWidth = targetHeight * aspectRatio
    }
    return CGRect(
      x: bounds.midX - targetWidth / 2,
      y: bounds.midY - targetHeight / 2,
      width: targetWidth,
      height: targetHeight
    )
  }

  func setOpeningPlaceholderImage(_ image: UIImage?) {
    guard let image else { return }
    currentCell()?.setOpeningPlaceholderImage(image)
  }

  // The native photo has already completed the visible close. Keep the route
  // pop animation-less so RNScreens cannot add a second page-level motion.
  func disableCloseTransition() {
    guard let screen = findScreen() else { return }
    screen.preferredTransition = nil
    screen.screenView().stackAnimation = .none
  }

  func presenterScreenView() -> UIView? {
    guard let screen = findScreen(), let navigationController = screen.navigationController else {
      return nil
    }
    let stack = navigationController.viewControllers
    guard let index = stack.firstIndex(of: screen), index > 0 else { return nil }
    return stack[index - 1].view
  }

  func configureExternalTapGesture(_ gestureRecognizer: UITapGestureRecognizer) {
    externalTapGestureRecognizer = gestureRecognizer
  }

  func setLiveBadgeAlpha(_ alpha: CGFloat) {
    liveBadgeAlpha = alpha
    for case let cell as PhotoViewerCell in collectionView.visibleCells {
      cell.setLiveBadgeAlpha(alpha)
    }
  }

  func applyScreenTraits(statusBarHidden: Bool, homeIndicatorHidden: Bool) {
    self.statusBarHidden = statusBarHidden
    self.homeIndicatorHidden = homeIndicatorHidden
    pushScreenTraits()
  }

  func allowsInfoGesture() -> Bool {
    !(currentCell()?.isZoomed ?? false) && !(currentCell()?.blocksPaging ?? false)
  }

  func mediaBottomInset(in viewportSize: CGSize) -> CGFloat {
    guard photos.indices.contains(currentIndex), viewportSize.width > 0, viewportSize.height > 0 else {
      return 0
    }
    let aspectRatio = PhotoViewerImageSizing.aspectRatio(for: photos[currentIndex])
    var renderedHeight = viewportSize.width / aspectRatio
    if renderedHeight > viewportSize.height {
      renderedHeight = viewportSize.height
    }
    return max(0, (viewportSize.height - renderedHeight) / 2)
  }
}

extension PhotoViewerView: UIGestureRecognizerDelegate {}

extension PhotoViewerView: UICollectionViewDataSource {
  func collectionView(
    _ collectionView: UICollectionView,
    numberOfItemsInSection section: Int
  ) -> Int {
    photos.count
  }

  func collectionView(
    _ collectionView: UICollectionView,
    cellForItemAt indexPath: IndexPath
  ) -> UICollectionViewCell {
    let cell = collectionView.dequeueReusableCell(
      withReuseIdentifier: PhotoViewerCell.reuseIdentifier,
      for: indexPath
    ) as! PhotoViewerCell
    cell.onZoomStateChange = { [weak self, weak cell] _ in
      guard let self, cell === self.currentCell() else { return }
      self.updatePagingEnabled()
    }
    cell.onLivePhotoPlaybackStateChange = { [weak self, weak cell] _ in
      guard let self, cell === self.currentCell() else { return }
      self.updatePagingEnabled()
    }
    cell.onLivePhotoModeChange = { [weak self] photoId, mode in
      self?.livePhotoModes[photoId] = mode
    }
    let photo = photos[indexPath.item]
    cell.configure(
      with: photo,
      viewportSize: collectionView.bounds.size,
      livePhotoStrings: livePhotoStrings,
      livePhotoMode: livePhotoModes[photo.id] ?? .live
    )
    cell.setActive(indexPath.item == currentIndex)
    cell.setLiveBadgeAlpha(liveBadgeAlpha)
    if let externalTapGestureRecognizer {
      externalTapGestureRecognizer.require(toFail: cell.doubleTapGestureRecognizer)
    }
    return cell
  }
}

extension PhotoViewerView: UICollectionViewDelegate {
  func collectionView(
    _ collectionView: UICollectionView,
    willDisplay cell: UICollectionViewCell,
    forItemAt indexPath: IndexPath
  ) {
    (cell as? PhotoViewerCell)?.setActive(indexPath.item == currentIndex)
  }

  func collectionView(
    _ collectionView: UICollectionView,
    didEndDisplaying cell: UICollectionViewCell,
    forItemAt indexPath: IndexPath
  ) {
    (cell as? PhotoViewerCell)?.setActive(false)
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    updateCurrentIndexFromOffset()
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate {
      updateCurrentIndexFromOffset()
    }
  }

  func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
    updateCurrentIndexFromOffset()
  }
}
