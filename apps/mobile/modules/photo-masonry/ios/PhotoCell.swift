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
  private let liveBadge = UIImageView()

  var transitionSourceView: UIView { imageView }

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.clipsToBounds = true
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.sd_imageTransition = .fade(duration: 0.15)
    contentView.addSubview(imageView)

    let config = UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold)
    liveBadge.image = UIImage(systemName: "livephoto", withConfiguration: config)
    liveBadge.tintColor = .white
    liveBadge.contentMode = .center
    liveBadge.layer.shadowColor = UIColor.black.cgColor
    liveBadge.layer.shadowOpacity = 0.5
    liveBadge.layer.shadowOffset = CGSize(width: 0, height: 1)
    liveBadge.layer.shadowRadius = 2
    liveBadge.isHidden = true
    contentView.addSubview(liveBadge)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = contentView.bounds
    liveBadge.frame = CGRect(x: 7, y: 7, width: 18, height: 18)
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
    contentView.transform = .identity
    contentView.alpha = 1
  }

  func configure(with photo: MasonryPhoto, targetWidth: CGFloat) {
    contentView.isAccessibilityElement = true
    contentView.accessibilityLabel = photo.accessibilityLabel
    liveBadge.isHidden = !photo.isLive
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
}
