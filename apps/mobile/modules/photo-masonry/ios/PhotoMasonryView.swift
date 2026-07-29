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
    if transitionLayout != nil {
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
    collectionView.contentInset = UIEdgeInsets(top: extraTopInset, left: 0, bottom: extraBottomInset, right: 0)
  }

  @objc private func handleRefresh() {
    onRefresh([:])
  }

  @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    switch gesture.state {
    case .began, .changed:
      if transitionLayout == nil {
        startTransition(gesture: gesture)
      }
      guard let transitionLayout, let target = transitionTargetColumns else { return }
      transitionLayout.transitionProgress = transitionProgress(scale: gesture.scale, target: target)
    case .ended, .cancelled, .failed:
      endTransition(gesture: gesture)
    default:
      break
    }
  }

  private func startTransition(gesture: UIPinchGestureRecognizer) {
    guard !photos.isEmpty, abs(gesture.scale - 1) > 0.02 else { return }
    let target = gesture.scale > 1 ? columnCount - 1 : columnCount + 1
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

    pinchBaseScale = gesture.scale
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
      self.emitVisibleRange()
    }
  }

  private func transitionProgress(scale: CGFloat, target: Int) -> CGFloat {
    let normalized = scale / pinchBaseScale
    let ratio = CGFloat(columnCount) / CGFloat(target)
    let raw: CGFloat
    if ratio > 1 {
      raw = (normalized - 1) / (ratio - 1)
    } else {
      raw = (1 - normalized) / (1 - ratio)
    }
    // Progress 1.0 mid-gesture makes UIKit consider the transition settled; keep it interactive.
    return min(max(raw, 0.001), 0.99)
  }

  private func endTransition(gesture: UIPinchGestureRecognizer) {
    guard let transitionLayout, let target = transitionTargetColumns else { return }
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
