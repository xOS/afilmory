import ExpoModulesCore
import SDWebImage
import UIKit

private let minColumnCount = 1
private let maxColumnCount = 4
private let chromeEdgeInset: CGFloat = 12
private let chromeControlSize: CGFloat = 44
private let chromeControlGap: CGFloat = 12
private let chromeTopOffset: CGFloat = 8
private let chromeDateRightGap: CGFloat = 12
private let avatarImageSize: CGFloat = 34
private let filterBadgeSize: CGFloat = 16

private final class PassthroughOverlayView: UIView {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hitView = super.hitTest(point, with: event)
    return hitView === self ? nil : hitView
  }
}

final class PhotoMasonryView: ExpoView {
  let onPhotoPress = EventDispatcher()
  let onVisibleRangeChange = EventDispatcher()
  let onScrollBeyondThreshold = EventDispatcher()
  let onColumnCountChange = EventDispatcher()
  let onRefresh = EventDispatcher()
  let onDatePress = EventDispatcher()
  let onProfilePress = EventDispatcher()
  let onFilterPress = EventDispatcher()

  var defaultColumnCount = 2 {
    didSet { applyDefaultColumnCountIfNeeded() }
  }

  var gap: CGFloat = 4 {
    didSet {
      layout.gap = gap
      layout.invalidateLayout()
    }
  }

  var extraTopInset: CGFloat = 0 {
    didSet {
      updateInsets()
      setNeedsLayout()
    }
  }

  var extraBottomInset: CGFloat = 0 {
    didSet { updateInsets() }
  }

  var scrollThreshold: CGFloat = 400

  var chromeDateLabel = "" {
    didSet { updateDateButton() }
  }

  var chromeDateVisible = false {
    didSet { updateDateVisibility(animated: window != nil) }
  }

  var chromeDateInteractive = false {
    didSet { updateDateInteraction() }
  }

  var profileImageURL = "" {
    didSet { updateProfile() }
  }

  var profileInitial = "?" {
    didSet { updateProfile() }
  }

  var filterActive = false {
    didSet { updateFilterButton() }
  }

  var filterCount = 0 {
    didSet { updateFilterButton() }
  }

  private var photos: [MasonryPhoto] = []
  private var layout = MasonryLayout()
  private var collectionView: UICollectionView!
  private let refreshControl = UIRefreshControl()
  private let haptics = UIImpactFeedbackGenerator(style: .light)
  private let overlayView = PassthroughOverlayView()
  private let dateButton = UIButton()
  private let profileButton = UIButton()
  private let profileInitialLabel = UILabel()
  private let avatarImageView = UIImageView()
  private let filterButton = UIButton()
  private let filterBadge = UILabel()

  private var columnCount = 2
  private var hasAppliedDefaultColumnCount = false
  private var pinchStartPosition: CGFloat = 2
  private var pinchAnchorItem: Int?
  private var pinchAnchorViewportOffset: CGFloat = 0
  private var lastPinchDetent = 2
  private var settleGeneration = 0
  private var beyondThreshold = false
  private var lastReportedRange = (start: -1, end: -1)
  private var lastVisibleRangeEmit: CFTimeInterval = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    layout.zoomPosition = CGFloat(columnCount)
    layout.gap = gap

    collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    collectionView.backgroundColor = .clear
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.prefetchDataSource = self
    collectionView.contentInsetAdjustmentBehavior = .always
    collectionView.showsVerticalScrollIndicator = false
    collectionView.alwaysBounceVertical = true
    if #available(iOS 26.0, *) {
      collectionView.topEdgeEffect.style = .soft

      let interaction = UIScrollEdgeElementContainerInteraction()
      interaction.scrollView = collectionView
      interaction.edge = .top
      overlayView.addInteraction(interaction)
    }
    collectionView.register(PhotoCell.self, forCellWithReuseIdentifier: PhotoCell.reuseIdentifier)

    refreshControl.tintColor = .white
    refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    collectionView.refreshControl = refreshControl

    let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
    collectionView.addGestureRecognizer(pinch)

    addSubview(collectionView)
    addSubview(overlayView)

    configureChrome()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    collectionView.frame = bounds
    overlayView.frame = bounds
    layoutChrome()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsLayout()
  }

  // Registers the collection view as the screen's content scroll view so UIKit drives
  // tab bar minimization, scroll edge effects, and status-bar tap scroll-to-top (iOS 26).
  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    var responder: UIResponder? = next
    while let current = responder {
      if let viewController = current as? UIViewController {
        viewController.setContentScrollView(collectionView, for: .all)
        break
      }
      responder = current.next
    }
  }

  func setPhotos(_ newPhotos: [MasonryPhoto]) {
    photos = newPhotos
    layout.aspectRatios = newPhotos.map { CGFloat($0.aspectRatio) }
    layout.invalidateLayout()
    collectionView.reloadData()
    lastReportedRange = (-1, -1)
    DispatchQueue.main.async { [weak self] in
      self?.emitVisibleRange()
    }
  }

  func setRefreshing(_ refreshing: Bool) {
    if !refreshing, refreshControl.isRefreshing {
      refreshControl.endRefreshing()
    }
  }

  private func configureChrome() {
    dateButton.addTarget(self, action: #selector(handleDatePress), for: .touchUpInside)
    dateButton.accessibilityIdentifier = "photo-masonry-date"
    dateButton.alpha = 0
    dateButton.isHidden = true
    overlayView.addSubview(dateButton)

    profileButton.addTarget(self, action: #selector(handleProfilePress), for: .touchUpInside)
    profileButton.accessibilityIdentifier = "photo-masonry-profile"
    profileButton.accessibilityLabel = "Profile"
    profileButton.configuration = makeChromeConfiguration()
    overlayView.addSubview(profileButton)

    profileInitialLabel.font = .systemFont(ofSize: 14, weight: .bold)
    profileInitialLabel.textAlignment = .center
    profileInitialLabel.textColor = .label
    profileInitialLabel.isUserInteractionEnabled = false
    profileButton.addSubview(profileInitialLabel)

    avatarImageView.clipsToBounds = true
    avatarImageView.contentMode = .scaleAspectFill
    avatarImageView.isUserInteractionEnabled = false
    profileButton.addSubview(avatarImageView)

    filterButton.addTarget(self, action: #selector(handleFilterPress), for: .touchUpInside)
    filterButton.accessibilityIdentifier = "photo-masonry-filters"
    overlayView.addSubview(filterButton)

    filterBadge.backgroundColor = .systemBlue
    filterBadge.clipsToBounds = true
    filterBadge.font = .systemFont(ofSize: 10, weight: .bold)
    filterBadge.isAccessibilityElement = false
    filterBadge.textAlignment = .center
    filterBadge.textColor = .white
    overlayView.addSubview(filterBadge)

    updateDateButton()
    updateDateInteraction()
    updateProfile()
    updateFilterButton()
  }

  private func makeChromeConfiguration(prominent: Bool = false) -> UIButton.Configuration {
    var configuration: UIButton.Configuration
    if #available(iOS 26.0, *) {
      configuration = prominent ? .prominentGlass() : .glass()
    } else {
      configuration = .gray()
    }
    if prominent {
      // Prominent glass takes its fill from the tint, which would otherwise resolve to the
      // system accent. A neutral translucent black keeps it glass while giving the fixed
      // near-white title a floor to read against on bright photos.
      configuration.baseBackgroundColor = UIColor(white: 0, alpha: 0.4)
      configuration.baseForegroundColor = .white
    }
    configuration.buttonSize = .medium
    configuration.cornerStyle = .capsule
    return configuration
  }

  private func updateDateButton() {
    var configuration = makeChromeConfiguration(prominent: true)
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)
    configuration.title = chromeDateLabel
    configuration.titleLineBreakMode = .byTruncatingTail
    configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = .systemFont(ofSize: 17, weight: .semibold)
      return outgoing
    }
    dateButton.configuration = configuration
    dateButton.accessibilityLabel = chromeDateLabel
    updateDateVisibility(animated: false)
    setNeedsLayout()
  }

  private func updateDateInteraction() {
    dateButton.isUserInteractionEnabled = chromeDateInteractive
    dateButton.accessibilityTraits = chromeDateInteractive ? .button : .staticText
  }

  private func updateDateVisibility(animated: Bool) {
    let shouldShow = chromeDateVisible && !chromeDateLabel.isEmpty
    let changes = {
      self.dateButton.alpha = shouldShow ? 1 : 0
      self.dateButton.transform = shouldShow ? .identity : CGAffineTransform(translationX: 0, y: -6)
    }

    if shouldShow {
      dateButton.isHidden = false
    }

    guard animated else {
      changes()
      dateButton.isHidden = !shouldShow
      return
    }

    UIView.animate(
      withDuration: shouldShow ? 0.2 : 0.15,
      delay: 0,
      options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut],
      animations: changes,
      completion: { [weak self] finished in
        if finished, !shouldShow {
          self?.dateButton.isHidden = true
        }
      }
    )
  }

  private func updateProfile() {
    let initial = profileInitial.trimmingCharacters(in: .whitespacesAndNewlines).first.map(String.init) ?? "?"
    profileInitialLabel.text = initial.uppercased()
    profileButton.accessibilityLabel = "Profile, \(profileInitial.isEmpty ? "unknown user" : profileInitial)"

    avatarImageView.sd_cancelCurrentImageLoad()
    avatarImageView.image = nil
    guard let url = URL(string: profileImageURL), !profileImageURL.isEmpty else {
      avatarImageView.isHidden = true
      return
    }

    avatarImageView.isHidden = false
    avatarImageView.sd_setImage(with: url, placeholderImage: nil, options: [.retryFailed])
  }

  private func updateFilterButton() {
    var configuration = makeChromeConfiguration()
    configuration.contentInsets = .zero
    configuration.image = UIImage(systemName: "line.3.horizontal.decrease")
    configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)
    if filterActive {
      configuration.baseForegroundColor = .systemBlue
    }
    filterButton.configuration = configuration

    let count = max(filterCount, 0)
    filterBadge.text = String(count)
    filterBadge.isHidden = !filterActive || count == 0
    filterButton.accessibilityLabel = filterActive ? "Filters, \(count) active" : "Filters"
    filterButton.accessibilityTraits = filterActive ? [.button, .selected] : .button
  }

  private func layoutChrome() {
    let controlY = safeAreaInsets.top + chromeTopOffset
    let filterX = bounds.width - chromeEdgeInset - chromeControlSize
    let profileX = filterX - chromeControlGap - chromeControlSize

    filterButton.frame = CGRect(x: filterX, y: controlY, width: chromeControlSize, height: chromeControlSize)
    profileButton.frame = CGRect(x: profileX, y: controlY, width: chromeControlSize, height: chromeControlSize)

    let avatarInset = (chromeControlSize - avatarImageSize) / 2
    let avatarFrame = profileButton.bounds.insetBy(dx: avatarInset, dy: avatarInset)
    avatarImageView.frame = avatarFrame
    avatarImageView.layer.cornerRadius = avatarImageSize / 2
    profileInitialLabel.frame = avatarFrame

    let dateMaxWidth = max(profileX - chromeDateRightGap - chromeEdgeInset, 0)
    let fittingWidth = dateButton.sizeThatFits(
      CGSize(width: dateMaxWidth, height: chromeControlSize)
    ).width
    dateButton.frame = CGRect(
      x: chromeEdgeInset,
      y: controlY,
      width: min(fittingWidth, dateMaxWidth),
      height: chromeControlSize
    )

    filterBadge.frame = CGRect(
      x: filterButton.frame.maxX - filterBadgeSize + 4,
      y: filterButton.frame.minY - 4,
      width: filterBadgeSize,
      height: filterBadgeSize
    )
    filterBadge.layer.cornerRadius = filterBadgeSize / 2
  }

  private func applyDefaultColumnCountIfNeeded() {
    guard !hasAppliedDefaultColumnCount else { return }
    hasAppliedDefaultColumnCount = true
    let clamped = min(max(defaultColumnCount, minColumnCount), maxColumnCount)
    guard clamped != columnCount else { return }
    columnCount = clamped
    layout.zoomPosition = CGFloat(clamped)
    layout.invalidateLayout()
  }

  private func updateInsets() {
    // The props land after the first layout has already parked the offset at the old inset,
    // and UIKit does not re-pin it, so a grown top inset would otherwise hide content
    // behind the chrome instead of reserving room for it.
    let wasPinnedToTop = collectionView.contentOffset.y <= -collectionView.adjustedContentInset.top + 1
    collectionView.contentInset = UIEdgeInsets(top: extraTopInset, left: 0, bottom: extraBottomInset, right: 0)
    if wasPinnedToTop {
      collectionView.setContentOffset(CGPoint(x: 0, y: -collectionView.adjustedContentInset.top), animated: false)
    }
  }

  @objc private func handleRefresh() {
    onRefresh([:])
  }

  @objc private func handleDatePress() {
    guard chromeDateInteractive else { return }
    onDatePress([:])
  }

  @objc private func handleProfilePress() {
    onProfilePress([:])
  }

  @objc private func handleFilterPress() {
    onFilterPress([:])
  }

  @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    switch gesture.state {
    case .began:
      guard !photos.isEmpty else { return }
      settleGeneration += 1
      pinchStartPosition = layout.zoomPosition
      lastPinchDetent = Int(layout.zoomPosition.rounded())
      let location = gesture.location(in: collectionView)
      if let anchor = collectionView.indexPathForItem(at: location) {
        pinchAnchorItem = anchor.item
        pinchAnchorViewportOffset = layout.interpolatedFrame(at: anchor.item).midY - collectionView.contentOffset.y
      } else {
        pinchAnchorItem = nil
      }
      haptics.prepare()
    case .changed:
      guard !photos.isEmpty else { return }
      // Cell width scales with 1/columns, so the finger's scale maps inversely onto
      // the continuous column position — no per-step commits, no stalls.
      let position = clampPosition(pinchStartPosition / gesture.scale)
      applyZoomPosition(position)
      let detent = Int(position.rounded())
      if detent != lastPinchDetent {
        lastPinchDetent = detent
        haptics.impactOccurred()
      }
    case .ended, .cancelled, .failed:
      settlePinch(velocity: gesture.velocity)
    default:
      break
    }
  }

  private func clampPosition(_ position: CGFloat) -> CGFloat {
    min(max(position, CGFloat(minColumnCount)), CGFloat(maxColumnCount))
  }

  private func applyZoomPosition(_ position: CGFloat) {
    layout.zoomPosition = position
    layout.invalidateLayout()
    guard let anchorItem = pinchAnchorItem else { return }
    let frame = layout.interpolatedFrame(at: anchorItem)
    let minOffset = -collectionView.adjustedContentInset.top
    // Without the upper bound, pinching to more columns near the end of the list shortens
    // the content while the anchor keeps its viewport slot, parking blank space below the
    // last row.
    let contentBottom = layout.interpolatedContentHeight() + collectionView.adjustedContentInset.bottom
    let maxOffset = max(minOffset, contentBottom - collectionView.bounds.height)
    collectionView.contentOffset.y = min(max(frame.midY - pinchAnchorViewportOffset, minOffset), maxOffset)
  }

  private func settlePinch(velocity: CGFloat) {
    guard !photos.isEmpty else { return }
    // A pinch starting inside the 0.25s settle cancels this animation but still runs its
    // completion, which would nil the new gesture's anchor and emit a stale column count.
    settleGeneration += 1
    let generation = settleGeneration
    let current = layout.zoomPosition
    var target = current.rounded()
    if abs(velocity) > 1.5, current != current.rounded() {
      target = velocity > 0 ? current.rounded(.down) : current.rounded(.up)
    }
    target = clampPosition(target)
    let settled = Int(target)
    UIView.animate(
      withDuration: 0.25,
      delay: 0,
      options: [.curveEaseOut, .allowUserInteraction, .beginFromCurrentState],
      animations: {
        self.applyZoomPosition(target)
        self.collectionView.layoutIfNeeded()
      },
      completion: { _ in
        guard generation == self.settleGeneration else { return }
        self.pinchAnchorItem = nil
        if settled != self.columnCount {
          self.columnCount = settled
          self.onColumnCountChange(["columnCount": settled])
        }
        self.emitVisibleRange()
      }
    )
  }

  private func emitVisibleRange() {
    guard !photos.isEmpty else { return }
    let indexPaths = collectionView.indexPathsForVisibleItems
    guard !indexPaths.isEmpty else { return }
    var start = Int.max
    var end = Int.min
    for indexPath in indexPaths {
      start = min(start, indexPath.item)
      end = max(end, indexPath.item)
    }
    guard start != lastReportedRange.start || end != lastReportedRange.end else { return }
    lastReportedRange = (start, end)
    onVisibleRangeChange(["startIndex": start, "endIndex": end])
  }
}

extension PhotoMasonryView: UICollectionViewDataSource {
  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
    photos.count
  }

  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let cell = collectionView.dequeueReusableCell(withReuseIdentifier: PhotoCell.reuseIdentifier, for: indexPath) as! PhotoCell
    cell.configure(with: photos[indexPath.item], targetWidth: layout.itemWidth)
    return cell
  }
}

extension PhotoMasonryView: UICollectionViewDelegate {
  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    guard photos.indices.contains(indexPath.item) else { return }
    let photo = photos[indexPath.item]
    var frame = CGRect.zero
    if let attributes = collectionView.layoutAttributesForItem(at: indexPath) {
      frame = collectionView.convert(attributes.frame, to: self)
    }
    onPhotoPress([
      "id": photo.id,
      "index": indexPath.item,
      "frame": [
        "x": frame.origin.x,
        "y": frame.origin.y,
        "width": frame.width,
        "height": frame.height,
      ],
    ])
  }

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    let offset = scrollView.contentOffset.y + scrollView.adjustedContentInset.top
    let beyond = offset > scrollThreshold
    if beyond != beyondThreshold {
      beyondThreshold = beyond
      onScrollBeyondThreshold(["beyond": beyond])
    }

    let now = CACurrentMediaTime()
    if now - lastVisibleRangeEmit > 0.12 {
      lastVisibleRangeEmit = now
      emitVisibleRange()
    }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    emitVisibleRange()
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate {
      emitVisibleRange()
    }
  }
}

extension PhotoMasonryView: UICollectionViewDataSourcePrefetching {
  func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
    let urls = indexPaths.compactMap { indexPath -> URL? in
      guard photos.indices.contains(indexPath.item) else { return nil }
      return URL(string: photos[indexPath.item].url)
    }
    SDWebImagePrefetcher.shared.prefetchURLs(urls)
  }
}
