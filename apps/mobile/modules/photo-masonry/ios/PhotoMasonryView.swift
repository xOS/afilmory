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
  private var topEdgeEffectHost: UIView?

  private var columnCount = 2
  private var hasAppliedDefaultColumnCount = false
  private var pinchStartPosition: CGFloat = 2
  private var pinchAnchorItem: Int?
  private var pinchAnchorViewportOffset: CGFloat = 0
  private var lastPinchDetent = 2
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
    }
    collectionView.register(PhotoCell.self, forCellWithReuseIdentifier: PhotoCell.reuseIdentifier)

    refreshControl.tintColor = .white
    refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    collectionView.refreshControl = refreshControl

    let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
    collectionView.addGestureRecognizer(pinch)

    addSubview(collectionView)

    if #available(iOS 26.0, *) {
      let host = UIView()
      host.backgroundColor = .clear
      host.isUserInteractionEnabled = false

      let interaction = UIScrollEdgeElementContainerInteraction()
      interaction.scrollView = collectionView
      interaction.edge = .top
      host.addInteraction(interaction)

      topEdgeEffectHost = host
      addSubview(host)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    collectionView.frame = bounds
    topEdgeEffectHost?.frame = CGRect(
      x: 0,
      y: 0,
      width: bounds.width,
      height: safeAreaInsets.top + extraTopInset
    )
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

  @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    switch gesture.state {
    case .began:
      guard !photos.isEmpty else { return }
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
    collectionView.contentOffset.y = max(frame.midY - pinchAnchorViewportOffset, minOffset)
  }

  private func settlePinch(velocity: CGFloat) {
    guard !photos.isEmpty else { return }
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
