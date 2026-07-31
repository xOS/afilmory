import SDWebImage
import UIKit

enum ThumbHashCache {
  private static let cache = NSCache<NSString, UIImage>()

  static func image(forHex hex: String?) -> UIImage? {
    guard let hex, !hex.isEmpty else { return nil }
    if let cached = cache.object(forKey: hex as NSString) {
      return cached
    }
    guard let data = Data(thumbHashHex: hex) else { return nil }
    let image = thumbHashToImage(hash: data)
    cache.setObject(image, forKey: hex as NSString)
    return image
  }
}

private extension Data {
  init?(thumbHashHex hex: String) {
    let length = hex.count
    guard length >= 2, length % 2 == 0 else { return nil }
    var bytes = [UInt8]()
    bytes.reserveCapacity(length / 2)
    var index = hex.startIndex
    while index < hex.endIndex {
      let next = hex.index(index, offsetBy: 2)
      guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
      bytes.append(byte)
      index = next
    }
    self.init(bytes)
  }
}

final class PhotoCell: UICollectionViewCell {
  static let reuseIdentifier = "PhotoCell"

  private let imageView = UIImageView()
  private let liveBadge = UIButton(type: .system)
  private let selectionShade = UIView()
  private let selectionBadge = UIView()
  private let selectionCheck = UIImageView()
  private var livePhotoBadgeTitle = "LIVE"

  var transitionSourceView: UIView { imageView }

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.clipsToBounds = true
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.sd_imageTransition = .fade(duration: 0.15)
    contentView.addSubview(imageView)

    var liveConfiguration = UIButton.Configuration.filled()
    liveConfiguration.baseBackgroundColor = UIColor.black.withAlphaComponent(0.62)
    liveConfiguration.baseForegroundColor = .white
    liveConfiguration.cornerStyle = .capsule
    liveConfiguration.image = UIImage(systemName: "livephoto")
    liveConfiguration.imagePadding = 4
    liveConfiguration.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8)
    liveBadge.configuration = liveConfiguration
    liveBadge.isHidden = true
    liveBadge.isUserInteractionEnabled = false
    contentView.addSubview(liveBadge)

    selectionShade.backgroundColor = UIColor.black.withAlphaComponent(0.2)
    selectionShade.isHidden = true
    selectionShade.isUserInteractionEnabled = false
    contentView.addSubview(selectionShade)

    selectionBadge.backgroundColor = .systemBlue
    selectionBadge.layer.borderColor = UIColor.white.cgColor
    selectionBadge.layer.borderWidth = 1.5
    selectionBadge.isHidden = true
    selectionBadge.isUserInteractionEnabled = false
    contentView.addSubview(selectionBadge)

    let checkConfig = UIImage.SymbolConfiguration(pointSize: 12, weight: .bold)
    selectionCheck.image = UIImage(systemName: "checkmark", withConfiguration: checkConfig)
    selectionCheck.tintColor = .white
    selectionCheck.contentMode = .center
    selectionBadge.addSubview(selectionCheck)

    if #available(iOS 13.4, *) {
      addInteraction(UIPointerInteraction(delegate: self))
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = contentView.bounds
    layoutLivePhotoBadge()
    selectionShade.frame = contentView.bounds
    let badgeSize: CGFloat = 26
    selectionBadge.frame = CGRect(
      x: contentView.bounds.width - badgeSize - 8,
      y: contentView.bounds.height - badgeSize - 8,
      width: badgeSize,
      height: badgeSize
    )
    selectionBadge.layer.cornerRadius = badgeSize / 2
    selectionCheck.frame = selectionBadge.bounds
  }

  override var isHighlighted: Bool {
    didSet {
      UIView.animate(withDuration: 0.12, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
        self.contentView.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.97, y: 0.97) : .identity
        self.contentView.alpha = self.isHighlighted ? 0.88 : 1
      }
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    imageView.sd_cancelCurrentImageLoad()
    imageView.image = nil
    liveBadge.isHidden = true
    contentView.accessibilityValue = nil
    selectionShade.isHidden = true
    selectionBadge.isHidden = true
    contentView.transform = .identity
    contentView.alpha = 1
  }

  func configure(
    with photo: MasonryPhoto,
    targetWidth: CGFloat,
    livePhotoBadgeTitle: String,
    selectionMode: Bool,
    selected: Bool
  ) {
    contentView.isAccessibilityElement = true
    contentView.accessibilityLabel = photo.accessibilityLabel
    contentView.accessibilityTraits.insert(.button)
    self.livePhotoBadgeTitle = livePhotoBadgeTitle
    liveBadge.isHidden = !photo.hasLivePhoto
    contentView.accessibilityValue = photo.hasLivePhoto ? livePhotoBadgeTitle : nil
    setNeedsLayout()
    configureSelection(selectionMode: selectionMode, selected: selected)
    let scale = window?.screen.scale ?? UIScreen.main.scale
    let targetHeight = targetWidth / max(photo.aspectRatio, 0.01)
    let pixelSize = CGSize(width: targetWidth * scale, height: targetHeight * scale)
    imageView.sd_setImage(
      with: URL(string: photo.url),
      placeholderImage: ThumbHashCache.image(forHex: photo.thumbHash),
      options: [.retryFailed],
      context: [.imageThumbnailPixelSize: NSValue(cgSize: pixelSize)]
    )
  }

  func setLivePhotoBadgeTitle(_ title: String) {
    livePhotoBadgeTitle = title
    if !liveBadge.isHidden {
      contentView.accessibilityValue = title
      setNeedsLayout()
    }
  }

  private func layoutLivePhotoBadge() {
    guard !liveBadge.isHidden else { return }
    let showsTitle = contentView.bounds.width >= 124
    if var configuration = liveBadge.configuration {
      configuration.title = showsTitle ? livePhotoBadgeTitle : nil
      configuration.imagePadding = showsTitle ? 4 : 0
      liveBadge.configuration = configuration
    }
    let availableWidth = max(contentView.bounds.width - 14, 28)
    let fittingSize = liveBadge.sizeThatFits(CGSize(width: availableWidth, height: 26))
    liveBadge.frame = CGRect(
      x: 7,
      y: 7,
      width: min(max(fittingSize.width, 28), availableWidth),
      height: 26
    )
  }

  func configureSelection(selectionMode: Bool, selected: Bool) {
    selectionShade.isHidden = !selected
    selectionBadge.isHidden = !selectionMode
    selectionBadge.backgroundColor = selected ? .systemBlue : UIColor.black.withAlphaComponent(0.35)
    selectionCheck.isHidden = !selected
    if selected {
      contentView.accessibilityTraits.insert(.selected)
    } else {
      contentView.accessibilityTraits.remove(.selected)
    }
  }
}

@available(iOS 13.4, *)
extension PhotoCell: UIPointerInteractionDelegate {
  func pointerInteraction(
    _ interaction: UIPointerInteraction,
    styleFor region: UIPointerRegion
  ) -> UIPointerStyle? {
    UIPointerStyle(effect: .lift(UITargetedPreview(view: contentView)))
  }
}
