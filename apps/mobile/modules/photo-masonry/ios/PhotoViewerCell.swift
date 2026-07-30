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

final class PhotoViewerCell: UICollectionViewCell, UIScrollViewDelegate {
  static let reuseIdentifier = "PhotoViewerCell"

  private let scrollView = UIScrollView()
  private let imageContainerView = UIView()
  private let previewImageView = UIImageView()
  private let detailImageView = UIImageView()
  private var photo: MasonryPhoto?
  private var loadedTier = 0
  private var displayedTier = 0
  private var lastViewportSize = CGSize.zero
  private var wasZoomed = false

  var onZoomStateChange: ((Bool) -> Void)?

  var isZoomed: Bool {
    scrollView.zoomScale > scrollView.minimumZoomScale + 0.01
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

    let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
    doubleTap.numberOfTapsRequired = 2
    imageContainerView.addGestureRecognizer(doubleTap)
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
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    previewImageView.sd_cancelCurrentImageLoad()
    detailImageView.sd_cancelCurrentImageLoad()
    previewImageView.image = nil
    detailImageView.image = nil
    detailImageView.alpha = 0
    photo = nil
    loadedTier = 0
    displayedTier = 0
    lastViewportSize = .zero
    wasZoomed = false
    onZoomStateChange = nil
    scrollView.setZoomScale(1, animated: false)
    scrollView.panGestureRecognizer.isEnabled = false
  }

  func configure(with photo: MasonryPhoto, viewportSize: CGSize) {
    guard self.photo?.id != photo.id else { return }
    self.photo = photo
    imageContainerView.accessibilityLabel = photo.accessibilityLabel
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
    setNeedsLayout()

    if let thumbnailURL = URL(string: photo.url) {
      previewImageView.sd_setImage(
        with: thumbnailURL,
        placeholderImage: previewImageView.image,
        options: [.retryFailed, .scaleDownLargeImages]
      )
    }
    loadTier(1, viewportSize: viewportSize)
  }

  func loadTier(forZoomScale zoomScale: CGFloat, viewportSize: CGSize) {
    let tier = min(4, max(1, Int(ceil(zoomScale))))
    loadTier(tier, viewportSize: viewportSize)
  }

  func viewForZooming(in scrollView: UIScrollView) -> UIView? {
    imageContainerView
  }

  func scrollViewDidZoom(_ scrollView: UIScrollView) {
    centerImage()
    let zoomed = isZoomed
    scrollView.panGestureRecognizer.isEnabled = zoomed
    if zoomed != wasZoomed {
      wasZoomed = zoomed
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
    scrollView.contentSize = imageSize
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
}
