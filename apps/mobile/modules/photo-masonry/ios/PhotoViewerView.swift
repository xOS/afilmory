import ExpoModulesCore
import RNScreens
import SDWebImage
import UIKit

final class PhotoViewerView: ExpoView {
  let onIndexChange = EventDispatcher()

  var initialIndex = 0 {
    didSet {
      hasPositionedInitialPhoto = false
      setNeedsLayout()
    }
  }

  var transitionId = "" {
    didSet {
      guard transitionId != oldValue else { return }
      configureZoomTransitionWhenReady()
    }
  }

  private var photos: [MasonryPhoto] = []
  private let layout = UICollectionViewFlowLayout()
  private var collectionView: UICollectionView!
  private var currentIndex = 0
  private var hasPositionedInitialPhoto = false
  private weak var configuredScreen: RNSScreen?
  private var configuredTransitionId = ""
  private var prefetchTokens: [Int: SDWebImagePrefetchToken] = [:]

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .black
    layout.minimumInteritemSpacing = 0
    layout.minimumLineSpacing = 0
    layout.scrollDirection = .horizontal

    collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    collectionView.backgroundColor = .black
    collectionView.contentInsetAdjustmentBehavior = .never
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.decelerationRate = .fast
    collectionView.isPagingEnabled = true
    collectionView.showsHorizontalScrollIndicator = false
    collectionView.register(PhotoViewerCell.self, forCellWithReuseIdentifier: PhotoViewerCell.reuseIdentifier)
    addSubview(collectionView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.width > 0, bounds.height > 0 else { return }

    let sizeChanged = layout.itemSize != bounds.size
    collectionView.frame = bounds
    if sizeChanged {
      cancelPrefetches()
      layout.itemSize = bounds.size
      layout.invalidateLayout()
    }

    positionInitialPhotoIfNeeded()
    if sizeChanged, hasPositionedInitialPhoto {
      prefetchNeighborPhotos()
    }
  }

  override func didMoveToSuperview() {
    super.didMoveToSuperview()
    if superview != nil {
      configureZoomTransitionWhenReady()
    } else if !transitionId.isEmpty {
      cancelPrefetches()
      let releasedId = transitionId
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
        PhotoTransitionRegistry.shared.release(id: releasedId)
      }
    }
  }

  func setPhotos(_ newPhotos: [MasonryPhoto]) {
    cancelPrefetches()
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

  private func targetRect(in viewController: UIViewController) -> CGRect? {
    guard photos.indices.contains(currentIndex) else { return nil }
    let photo = photos[currentIndex]
    let container = convert(bounds, to: viewController.view)
    let width = CGFloat(photo.width)
    let height = CGFloat(photo.height)
    guard width > 0, height > 0, container.width > 0, container.height > 0 else {
      return container
    }

    let aspectRatio = width / height
    var targetWidth = container.width
    var targetHeight = targetWidth / aspectRatio
    if targetHeight > container.height {
      targetHeight = container.height
      targetWidth = targetHeight * aspectRatio
    }
    return CGRect(
      x: container.midX - targetWidth / 2,
      y: container.midY - targetHeight / 2,
      width: targetWidth,
      height: targetHeight
    )
  }

  private func configureZoomTransitionWhenReady() {
    guard superview != nil, !transitionId.isEmpty else { return }
    DispatchQueue.main.async { [weak self] in
      self?.configureZoomTransition()
    }
  }

  private func configureZoomTransition() {
    guard #available(iOS 18.0, *), let screen = findScreen() else { return }
    guard configuredScreen !== screen || configuredTransitionId != transitionId else { return }

    let activeTransitionId = transitionId
    let options = UIViewController.Transition.ZoomOptions()
    options.alignmentRectProvider = { [weak self] context in
      self?.targetRect(in: context.zoomedViewController)
    }
    options.interactiveDismissShouldBegin = { [weak self] _ in
      !(self?.currentCell()?.isZoomed ?? false)
    }
    screen.preferredTransition = .zoom(options: options) { _ in
      PhotoTransitionRegistry.shared.sourceView(id: activeTransitionId)
    }

    configuredScreen = screen
    configuredTransitionId = transitionId
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
}

extension PhotoViewerView: UICollectionViewDataSource {
  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
    photos.count
  }

  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let cell = collectionView.dequeueReusableCell(
      withReuseIdentifier: PhotoViewerCell.reuseIdentifier,
      for: indexPath
    ) as! PhotoViewerCell
    cell.onZoomStateChange = { [weak self] zoomed in
      self?.collectionView.isScrollEnabled = !zoomed
    }
    cell.configure(with: photos[indexPath.item], viewportSize: collectionView.bounds.size)
    return cell
  }
}

extension PhotoViewerView: UICollectionViewDelegate {
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
