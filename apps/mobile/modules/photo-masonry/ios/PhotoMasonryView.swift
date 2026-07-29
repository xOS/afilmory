import ExpoModulesCore
import SDWebImage
import UIKit

private let minColumnCount = 1
private let maxColumnCount = 4

final class PhotoMasonryView: ExpoView {
  let onPhotoPress = EventDispatcher()
  let onVisibleRangeChange = EventDispatcher()
  let onScrollBeyondThreshold = EventDispatcher()
  let onColumnCountChange = EventDispatcher()
  let onRefresh = EventDispatcher()

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
    didSet { updateInsets() }
  }

  var extraBottomInset: CGFloat = 0 {
    didSet { updateInsets() }
  }

  var scrollThreshold: CGFloat = 400

  private var photos: [MasonryPhoto] = []
  private var layout = MasonryLayout()
  private var collectionView: UICollectionView!
  private let refreshControl = UIRefreshControl()
  private let haptics = UIImpactFeedbackGenerator(style: .light)

  private var columnCount = 2
  private var hasAppliedDefaultColumnCount = false
  private var transitionLayout: UICollectionViewTransitionLayout?
  private var transitionTargetColumns: Int?
  private var pinchBaseScale: CGFloat = 1
  private var pinchArmScale: CGFloat = 1
  private var lastPinchScale: CGFloat = 1
  private var isChainSettling = false
  private var beyondThreshold = false
  private var lastReportedRange = (start: -1, end: -1)
  private var lastVisibleRangeEmit: CFTimeInterval = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    layout.columnCount = columnCount
    layout.gap = gap

    collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    collectionView.backgroundColor = .clear
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.prefetchDataSource = self
    collectionView.contentInsetAdjustmentBehavior = .always
    collectionView.showsVerticalScrollIndicator = false
    collectionView.alwaysBounceVertical = true
    // No navigation bar sits above this grid, so the automatic style resolves to nothing.
    // Forcing .soft draws the same progressive blur UIKit puts under a navigation bar,
    // sized to the top inset (safe area + extraTopInset).
    if #available(iOS 26.0, *) {
      collectionView.topEdgeEffect.style = .soft
    }
    collectionView.register(PhotoCell.self, forCellWithReuseIdentifier: PhotoCell.reuseIdentifier)

    refreshControl.tintColor = .white
    refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    collectionView.refreshControl = refreshControl

    let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
    collectionView.addGestureRecognizer(pinch)

    addSubview(collectionView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    collectionView.frame = bounds
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
    if transitionLayout != nil, !isChainSettling {
      collectionView.cancelInteractiveTransition()
    }
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

  private func applyDefaultColumnCountIfNeeded() {
    guard !hasAppliedDefaultColumnCount else { return }
    hasAppliedDefaultColumnCount = true
    let clamped = min(max(defaultColumnCount, minColumnCount), maxColumnCount)
    guard clamped != columnCount else { return }
    columnCount = clamped
    layout.columnCount = clamped
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

  @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    lastPinchScale = gesture.scale
    switch gesture.state {
    case .began:
      pinchArmScale = gesture.scale
      driveTransition(gesture: gesture)
    case .changed:
      driveTransition(gesture: gesture)
    case .ended, .cancelled, .failed:
      endTransition(gesture: gesture)
    default:
      break
    }
  }

  // Only one transition layout can run at a time; a chained step settles through its
  // completion block before the next one arms, so mid-settle pinch events are dropped.
  private func driveTransition(gesture: UIPinchGestureRecognizer) {
    guard !isChainSettling else { return }
    if transitionLayout == nil {
      startTransition(gesture: gesture)
    }
    guard let transitionLayout, let target = transitionTargetColumns else { return }
    let raw = rawTransitionProgress(scale: gesture.scale, target: target)
    if raw >= 1 {
      settleChainStep(finish: true)
    } else if raw <= 0 {
      settleChainStep(finish: false)
    } else {
      // Progress 1.0 mid-gesture makes UIKit consider the transition settled; keep it interactive.
      transitionLayout.transitionProgress = min(max(raw, 0.001), 0.99)
    }
  }

  private func settleChainStep(finish: Bool) {
    guard transitionLayout != nil else { return }
    isChainSettling = true
    if finish {
      transitionLayout?.transitionProgress = 0.99
      collectionView.finishInteractiveTransition()
    } else {
      collectionView.cancelInteractiveTransition()
    }
  }

  private func startTransition(gesture: UIPinchGestureRecognizer) {
    guard !photos.isEmpty else { return }
    let normalized = gesture.scale / pinchArmScale
    guard abs(normalized - 1) > 0.02 else { return }
    let target = normalized > 1 ? columnCount - 1 : columnCount + 1
    guard target >= minColumnCount, target <= maxColumnCount else { return }

    let newLayout = MasonryLayout()
    newLayout.columnCount = target
    newLayout.gap = gap
    newLayout.aspectRatios = layout.aspectRatios

    let location = gesture.location(in: collectionView)
    if let anchor = collectionView.indexPathForItem(at: location),
       let frame = collectionView.layoutAttributesForItem(at: anchor)?.frame {
      newLayout.anchorItem = anchor.item
      newLayout.anchorViewportOffset = frame.midY - collectionView.contentOffset.y
    }

    pinchBaseScale = pinchArmScale
    transitionTargetColumns = target
    haptics.prepare()
    transitionLayout = collectionView.startInteractiveTransition(to: newLayout) { [weak self] _, _ in
      guard let self else { return }
      let committed = self.collectionView.collectionViewLayout === newLayout
      if committed {
        self.columnCount = target
        self.layout = newLayout
        self.haptics.impactOccurred()
        self.onColumnCountChange(["columnCount": target])
      }
      newLayout.anchorItem = nil
      self.transitionLayout = nil
      self.transitionTargetColumns = nil
      self.isChainSettling = false
      self.pinchArmScale = self.lastPinchScale
      self.emitVisibleRange()
    }
  }

  private func rawTransitionProgress(scale: CGFloat, target: Int) -> CGFloat {
    let normalized = scale / pinchBaseScale
    let ratio = CGFloat(columnCount) / CGFloat(target)
    if ratio > 1 {
      return (normalized - 1) / (ratio - 1)
    }
    return (1 - normalized) / (1 - ratio)
  }

  private func endTransition(gesture: UIPinchGestureRecognizer) {
    guard !isChainSettling, let transitionLayout, let target = transitionTargetColumns else { return }
    let zoomingIn = target < columnCount
    let velocity = gesture.velocity
    let fastCommit = zoomingIn ? velocity > 1.5 : velocity < -1.5
    if transitionLayout.transitionProgress > 0.35 || fastCommit {
      collectionView.finishInteractiveTransition()
    } else {
      collectionView.cancelInteractiveTransition()
    }
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
