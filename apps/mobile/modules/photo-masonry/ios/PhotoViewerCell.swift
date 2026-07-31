import SDWebImage
import UIKit

enum PhotoViewerImageSizing {
  static func aspectRatio(for photo: MasonryPhoto) -> CGFloat {
    if photo.width > 0, photo.height > 0 {
      return CGFloat(photo.width / photo.height)
    }
    return max(CGFloat(photo.aspectRatio), 0.01)
  }

  static func pixelSize(
    for photo: MasonryPhoto,
    viewportSize: CGSize,
    screenScale: CGFloat,
    tier: Int
  ) -> CGSize {
    let boundingPixelSize = CGSize(
      width: viewportSize.width * screenScale * CGFloat(tier),
      height: viewportSize.height * screenScale * CGFloat(tier)
    )
    let aspectRatio = aspectRatio(for: photo)
    var pixelSize = CGSize(
      width: boundingPixelSize.width,
      height: boundingPixelSize.width / aspectRatio
    )
    if pixelSize.height > boundingPixelSize.height {
      pixelSize = CGSize(
        width: boundingPixelSize.height * aspectRatio,
        height: boundingPixelSize.height
      )
    }
    if photo.width > 0, photo.height > 0 {
      let nativeScale = min(
        1,
        min(CGFloat(photo.width) / pixelSize.width, CGFloat(photo.height) / pixelSize.height)
      )
      pixelSize = CGSize(width: pixelSize.width * nativeScale, height: pixelSize.height * nativeScale)
    }
    return pixelSize
  }
}

final class PhotoViewerCell: UICollectionViewCell, UIGestureRecognizerDelegate, UIScrollViewDelegate {
  static let reuseIdentifier = "PhotoViewerCell"

  private let scrollView = UIScrollView()
  private let imageContainerView = UIView()
  private let previewImageView = UIImageView()
  private let detailImageView = UIImageView()
  private let livePhotoPlaybackView = LivePhotoPlaybackView()
  private let livePhotoBadge = UIButton(type: .system)
  private let livePhotoHaptics = UIImpactFeedbackGenerator(style: .medium)
  private lazy var livePhotoLongPress = UILongPressGestureRecognizer(
    target: self,
    action: #selector(handleLivePhotoLongPress(_:))
  )
  private var photo: MasonryPhoto?
  private var isActive = false
  private var isHoldingLivePhoto = false
  private var loadedTier = 0
  private var displayedTier = 0
  private var lastViewportSize = CGSize.zero
  private var wasZoomed = false

  var onZoomStateChange: ((Bool) -> Void)?
  var onLivePhotoPlaybackStateChange: ((Bool) -> Void)?

  var isZoomed: Bool {
    scrollView.zoomScale > scrollView.minimumZoomScale + 0.01
  }

  var isPlayingLivePhoto: Bool {
    livePhotoPlaybackView.isPlaying
  }

  override init(frame: CGRect) {
    super.init(frame: frame)

    backgroundColor = .black
    contentView.backgroundColor = .black

    scrollView.backgroundColor = .black
    scrollView.bouncesZoom = true
    scrollView.contentInsetAdjustmentBehavior = .never
    scrollView.decelerationRate = .fast
    scrollView.delegate = self
    scrollView.maximumZoomScale = 4
    scrollView.minimumZoomScale = 1
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.showsVerticalScrollIndicator = false
    contentView.addSubview(scrollView)

    imageContainerView.isAccessibilityElement = true
    imageContainerView.accessibilityIdentifier = "photo-viewer-image"
    imageContainerView.isUserInteractionEnabled = true
    scrollView.addSubview(imageContainerView)

    previewImageView.clipsToBounds = true
    previewImageView.contentMode = .scaleAspectFit
    previewImageView.sd_imageTransition = .fade(duration: 0.14)
    imageContainerView.addSubview(previewImageView)

    detailImageView.alpha = 0
    detailImageView.clipsToBounds = true
    detailImageView.contentMode = .scaleAspectFit
    imageContainerView.addSubview(detailImageView)

    livePhotoPlaybackView.onPlaybackStateChange = { [weak self] playing in
      guard let self else { return }
      self.updateLivePhotoBadge(playing: playing)
      self.onLivePhotoPlaybackStateChange?(playing)
    }
    imageContainerView.addSubview(livePhotoPlaybackView)

    var badgeConfiguration = UIButton.Configuration.filled()
    badgeConfiguration.baseBackgroundColor = UIColor.black.withAlphaComponent(0.58)
    badgeConfiguration.baseForegroundColor = .white
    badgeConfiguration.cornerStyle = .capsule
    badgeConfiguration.image = UIImage(systemName: "livephoto")
    badgeConfiguration.imagePadding = 5
    badgeConfiguration.contentInsets = NSDirectionalEdgeInsets(
      top: 6,
      leading: 10,
      bottom: 6,
      trailing: 10
    )
    livePhotoBadge.configuration = badgeConfiguration
    livePhotoBadge.isHidden = true
    livePhotoBadge.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
    livePhotoBadge.addTarget(
      self,
      action: #selector(toggleLivePhotoPlayback),
      for: .touchUpInside
    )
    contentView.addSubview(livePhotoBadge)

    let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
    doubleTap.numberOfTapsRequired = 2
    imageContainerView.addGestureRecognizer(doubleTap)

    livePhotoLongPress.minimumPressDuration = 0.18
    livePhotoLongPress.allowableMovement = 16
    livePhotoLongPress.delegate = self
    imageContainerView.addGestureRecognizer(livePhotoLongPress)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    scrollView.frame = contentView.bounds
    layoutImageIfNeeded()
    centerImage()
    layoutLivePhotoBadge()
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    previewImageView.sd_cancelCurrentImageLoad()
    detailImageView.sd_cancelCurrentImageLoad()
    setActive(false)
    livePhotoPlaybackView.configure(videoURL: nil)
    previewImageView.image = nil
    detailImageView.image = nil
    detailImageView.alpha = 0
    photo = nil
    isHoldingLivePhoto = false
    loadedTier = 0
    displayedTier = 0
    lastViewportSize = .zero
    wasZoomed = false
    onZoomStateChange = nil
    onLivePhotoPlaybackStateChange = nil
    livePhotoBadge.isHidden = true
    livePhotoBadge.accessibilityLabel = nil
    livePhotoBadge.accessibilityHint = nil
    scrollView.setZoomScale(1, animated: false)
    scrollView.panGestureRecognizer.isEnabled = false
  }

  func configure(
    with photo: MasonryPhoto,
    viewportSize: CGSize,
    livePhotoBadgeTitle: String,
    livePhotoAccessibilityHint: String
  ) {
    let mediaChanged = self.photo?.id != photo.id
      || self.photo?.livePhotoVideoUrl != photo.livePhotoVideoUrl
    self.photo = photo
    imageContainerView.accessibilityLabel = photo.accessibilityLabel
    imageContainerView.accessibilityHint = photo.hasLivePhoto ? livePhotoAccessibilityHint : nil
    if var configuration = livePhotoBadge.configuration {
      configuration.title = livePhotoBadgeTitle
      livePhotoBadge.configuration = configuration
    }
    livePhotoBadge.accessibilityLabel = livePhotoBadgeTitle
    livePhotoBadge.accessibilityHint = livePhotoAccessibilityHint
    livePhotoBadge.isHidden = !photo.hasLivePhoto
    livePhotoPlaybackView.configure(videoURL: photo.livePhotoVideoUrl.flatMap(URL.init(string:)))
    setNeedsLayout()

    guard mediaChanged else { return }
    loadedTier = 0
    displayedTier = 0
    lastViewportSize = .zero
    wasZoomed = false
    scrollView.setZoomScale(1, animated: false)
    scrollView.panGestureRecognizer.isEnabled = false
    previewImageView.image = ThumbHashCache.image(forHex: photo.thumbHash)
    detailImageView.sd_cancelCurrentImageLoad()
    detailImageView.image = nil
    detailImageView.alpha = 0

    if let thumbnailURL = URL(string: photo.url) {
      previewImageView.sd_setImage(
        with: thumbnailURL,
        placeholderImage: previewImageView.image,
        options: [.retryFailed, .scaleDownLargeImages]
      )
    }
    loadTier(1, viewportSize: viewportSize)
  }

  func setActive(_ active: Bool) {
    guard active != isActive else { return }
    isActive = active
    if !active {
      isHoldingLivePhoto = false
    }
    livePhotoPlaybackView.setActive(active)
  }

  func loadTier(forZoomScale zoomScale: CGFloat, viewportSize: CGSize) {
    let tier = min(4, max(1, Int(ceil(zoomScale))))
    loadTier(tier, viewportSize: viewportSize)
  }

  func viewForZooming(in scrollView: UIScrollView) -> UIView? {
    imageContainerView
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === livePhotoLongPress else {
      return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
    return isActive && !isZoomed && (photo?.hasLivePhoto ?? false)
  }

  func scrollViewDidZoom(_ scrollView: UIScrollView) {
    centerImage()
    let zoomed = isZoomed
    scrollView.panGestureRecognizer.isEnabled = zoomed
    if zoomed != wasZoomed {
      wasZoomed = zoomed
      updateLivePhotoBadgeVisibility()
      onZoomStateChange?(zoomed)
    }
  }

  func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
    loadTier(forZoomScale: scale, viewportSize: bounds.size)
  }

  private func loadTier(_ tier: Int, viewportSize: CGSize) {
    guard tier > loadedTier, viewportSize.width > 0, viewportSize.height > 0,
      let photo, let url = URL(string: photo.originalUrl), !photo.originalUrl.isEmpty
    else {
      return
    }

    loadedTier = tier
    let screenScale = window?.screen.scale ?? UIScreen.main.scale
    let pixelSize = PhotoViewerImageSizing.pixelSize(
      for: photo,
      viewportSize: viewportSize,
      screenScale: screenScale,
      tier: tier
    )
    let expectedPhotoId = photo.id
    let hadDetailImage = detailImageView.image != nil

    detailImageView.sd_setImage(
      with: url,
      placeholderImage: detailImageView.image,
      options: [.avoidAutoSetImage, .retryFailed, .scaleDownLargeImages],
      context: [
        .imagePreserveAspectRatio: true,
        .imageThumbnailPixelSize: NSValue(cgSize: pixelSize),
      ],
      progress: nil,
      completed: { [weak self] image, error, _, _ in
        guard let self, self.photo?.id == expectedPhotoId, self.loadedTier == tier else { return }
        guard error == nil, let image else {
          self.loadedTier = self.displayedTier
          return
        }
        self.detailImageView.image = image
        self.displayedTier = tier
        guard !hadDetailImage else { return }
        UIView.animate(
          withDuration: 0.14,
          delay: 0,
          options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut]
        ) {
          self.detailImageView.alpha = 1
        }
      }
    )
  }

  private func centerImage() {
    let horizontal = max((scrollView.bounds.width - scrollView.contentSize.width) / 2, 0)
    let vertical = max((scrollView.bounds.height - scrollView.contentSize.height) / 2, 0)
    scrollView.contentInset = UIEdgeInsets(top: vertical, left: horizontal, bottom: vertical, right: horizontal)
  }

  private func layoutImageIfNeeded() {
    let viewportSize = scrollView.bounds.size
    guard viewportSize.width > 0, viewportSize.height > 0, viewportSize != lastViewportSize else { return }

    lastViewportSize = viewportSize
    scrollView.setZoomScale(1, animated: false)

    let aspectRatio = resolvedAspectRatio()
    var imageSize = CGSize(width: viewportSize.width, height: viewportSize.width / aspectRatio)
    if imageSize.height > viewportSize.height {
      imageSize = CGSize(width: viewportSize.height * aspectRatio, height: viewportSize.height)
    }

    imageContainerView.frame = CGRect(origin: .zero, size: imageSize)
    previewImageView.frame = imageContainerView.bounds
    detailImageView.frame = imageContainerView.bounds
    livePhotoPlaybackView.frame = imageContainerView.bounds
    scrollView.contentSize = imageSize
  }

  private func layoutLivePhotoBadge() {
    guard !livePhotoBadge.isHidden else { return }
    let availableWidth = max(contentView.bounds.width - 24, 44)
    let fittingSize = livePhotoBadge.sizeThatFits(CGSize(width: availableWidth, height: 32))
    let badgeWidth = min(max(fittingSize.width, 44), availableWidth)
    let imageTop = scrollView.contentInset.top + 10
    let safeTop = contentView.safeAreaInsets.top + 10
    livePhotoBadge.frame = CGRect(
      x: (contentView.bounds.width - badgeWidth) / 2,
      y: max(imageTop, safeTop),
      width: badgeWidth,
      height: 32
    )
    updateLivePhotoBadgeVisibility()
  }

  private func updateLivePhotoBadgeVisibility() {
    livePhotoBadge.alpha = isZoomed ? 0 : 1
    livePhotoBadge.isUserInteractionEnabled = !isZoomed
  }

  private func updateLivePhotoBadge(playing: Bool) {
    guard var configuration = livePhotoBadge.configuration else { return }
    configuration.baseBackgroundColor =
      playing
      ? UIColor.systemBlue.withAlphaComponent(0.82)
      : UIColor.black.withAlphaComponent(0.58)
    livePhotoBadge.configuration = configuration
  }

  private func beginLivePhotoPlayback() {
    livePhotoHaptics.prepare()
    guard !isZoomed, livePhotoPlaybackView.startPlayback() else { return }
    livePhotoHaptics.impactOccurred(intensity: 0.72)
  }

  private func resolvedAspectRatio() -> CGFloat {
    guard let photo else { return 1 }
    return PhotoViewerImageSizing.aspectRatio(for: photo)
  }

  @objc private func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
    if isZoomed {
      scrollView.setZoomScale(1, animated: true)
      return
    }

    let scale = min(2.5, scrollView.maximumZoomScale)
    let point = gesture.location(in: imageContainerView)
    let width = scrollView.bounds.width / scale
    let height = scrollView.bounds.height / scale
    scrollView.zoom(
      to: CGRect(x: point.x - width / 2, y: point.y - height / 2, width: width, height: height),
      animated: true
    )
  }

  @objc private func handleLivePhotoLongPress(_ gesture: UILongPressGestureRecognizer) {
    switch gesture.state {
    case .began:
      isHoldingLivePhoto = true
      beginLivePhotoPlayback()
    case .ended, .cancelled, .failed:
      guard isHoldingLivePhoto else { return }
      isHoldingLivePhoto = false
      livePhotoPlaybackView.stopPlayback(animated: true)
    default:
      break
    }
  }

  @objc private func toggleLivePhotoPlayback() {
    isHoldingLivePhoto = false
    if livePhotoPlaybackView.isPlaying {
      livePhotoPlaybackView.stopPlayback(animated: true)
    } else {
      beginLivePhotoPlayback()
    }
  }
}
