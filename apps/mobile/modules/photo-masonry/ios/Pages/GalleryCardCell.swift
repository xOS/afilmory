import SDWebImage
import UIKit

final class GalleryCardCell: UICollectionViewCell {
  static let reuseIdentifier = "GalleryCardCell"

  private let primaryCover = GalleryCoverView()
  private let secondaryTopCover = GalleryCoverView()
  private let secondaryBottomCover = GalleryCoverView()
  private let avatarView = UIImageView()
  private let avatarFallback = UILabel()
  private let nameLabel = UILabel()
  private let descriptionLabel = UILabel()
  private let photoCountLabel = UILabel()
  private let subscriptionButton = UIButton(type: .system)
  private var tagLabels: [InsetLabel] = []
  private var onSubscriptionToggle: (() -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.backgroundColor = .secondarySystemGroupedBackground
    contentView.layer.borderColor = UIColor.separator.withAlphaComponent(0.45).cgColor
    contentView.layer.borderWidth = 1 / max(UIScreen.main.scale, 1)
    contentView.layer.cornerCurve = .continuous
    contentView.layer.cornerRadius = 16
    contentView.clipsToBounds = true

    [primaryCover, secondaryTopCover, secondaryBottomCover].forEach(contentView.addSubview)

    avatarView.contentMode = .scaleAspectFill
    avatarView.clipsToBounds = true
    avatarView.backgroundColor = .tertiarySystemFill
    contentView.addSubview(avatarView)

    avatarFallback.font = .systemFont(ofSize: 15, weight: .bold)
    avatarFallback.textAlignment = .center
    avatarFallback.textColor = .tintColor
    avatarFallback.backgroundColor = .tintColor.withAlphaComponent(0.12)
    contentView.addSubview(avatarFallback)

    nameLabel.font = .systemFont(ofSize: 16, weight: .semibold)
    nameLabel.textColor = .label
    nameLabel.numberOfLines = 1
    contentView.addSubview(nameLabel)

    descriptionLabel.font = .systemFont(ofSize: 13, weight: .regular)
    descriptionLabel.textColor = .secondaryLabel
    descriptionLabel.numberOfLines = 1
    contentView.addSubview(descriptionLabel)

    photoCountLabel.font = .systemFont(ofSize: 12, weight: .medium)
    photoCountLabel.textColor = .tertiaryLabel
    photoCountLabel.numberOfLines = 1
    contentView.addSubview(photoCountLabel)

    subscriptionButton.addAction(
      UIAction { [weak self] _ in self?.onSubscriptionToggle?() },
      for: .touchUpInside
    )
    subscriptionButton.titleLabel?.numberOfLines = 1
    subscriptionButton.titleLabel?.lineBreakMode = .byTruncatingTail
    contentView.addSubview(subscriptionButton)

    addInteraction(UIPointerInteraction(delegate: self))
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let width = contentView.bounds.width
    let coverHeight = width * 9 / 16
    let primaryWidth = (width - 2) * 2 / 3
    let secondaryWidth = width - primaryWidth - 2
    let secondaryHeight = (coverHeight - 2) / 2

    primaryCover.frame = CGRect(x: 0, y: 0, width: primaryWidth, height: coverHeight)
    secondaryTopCover.frame = CGRect(
      x: primaryWidth + 2,
      y: 0,
      width: secondaryWidth,
      height: secondaryHeight
    )
    secondaryBottomCover.frame = CGRect(
      x: primaryWidth + 2,
      y: secondaryHeight + 2,
      width: secondaryWidth,
      height: secondaryHeight
    )

    let contentX: CGFloat = 14
    let identityY = coverHeight + 14
    let avatarSize: CGFloat = 36
    avatarView.frame = CGRect(x: contentX, y: identityY, width: avatarSize, height: avatarSize)
    avatarFallback.frame = avatarView.frame
    avatarView.layer.cornerRadius = avatarSize / 2
    avatarFallback.layer.cornerRadius = avatarSize / 2
    avatarFallback.clipsToBounds = true

    let buttonWidth: CGFloat
    if subscriptionButton.isHidden {
      buttonWidth = 0
    } else {
      let fittingWidth = subscriptionButton.sizeThatFits(
        CGSize(width: 240, height: avatarSize)
      ).width
      let maximumButtonWidth = min(160, width * 0.44)
      buttonWidth = min(maximumButtonWidth, max(76, ceil(fittingWidth)))
      subscriptionButton.frame = CGRect(
        x: width - contentX - buttonWidth,
        y: identityY + 2,
        width: buttonWidth,
        height: 32
      )
    }

    let textX = contentX + avatarSize + 10
    let textRight = subscriptionButton.isHidden
      ? width - contentX
      : subscriptionButton.frame.minX - 10
    let textWidth = max(0, textRight - textX)
    nameLabel.frame = CGRect(x: textX, y: identityY, width: textWidth, height: 20)
    descriptionLabel.frame = CGRect(x: textX, y: identityY + 21, width: textWidth, height: 17)

    let metaY = identityY + avatarSize + 10
    photoCountLabel.sizeToFit()
    photoCountLabel.frame = CGRect(
      x: contentX,
      y: metaY,
      width: min(photoCountLabel.bounds.width, width - contentX * 2),
      height: 22
    )
    var tagX = photoCountLabel.frame.maxX + 6
    for label in tagLabels {
      let fitting = label.sizeThatFits(CGSize(width: 120, height: 22))
      let labelWidth = min(120, fitting.width)
      guard tagX + labelWidth <= width - contentX else {
        label.isHidden = true
        continue
      }
      label.isHidden = false
      label.frame = CGRect(x: tagX, y: metaY, width: labelWidth, height: 22)
      tagX += labelWidth + 6
    }
  }

  override var isHighlighted: Bool {
    didSet {
      UIView.animate(
        withDuration: 0.12,
        delay: 0,
        options: [.allowUserInteraction, .beginFromCurrentState]
      ) {
        self.contentView.transform = self.isHighlighted
          ? CGAffineTransform(scaleX: 0.975, y: 0.975)
          : .identity
        self.contentView.alpha = self.isHighlighted ? 0.86 : 1
      }
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    primaryCover.prepareForReuse()
    secondaryTopCover.prepareForReuse()
    secondaryBottomCover.prepareForReuse()
    avatarView.sd_cancelCurrentImageLoad()
    avatarView.image = nil
    avatarFallback.isHidden = false
    nameLabel.text = nil
    descriptionLabel.text = nil
    photoCountLabel.text = nil
    subscriptionButton.configuration = nil
    subscriptionButton.isHidden = true
    subscriptionButton.isEnabled = true
    onSubscriptionToggle = nil
    contentView.accessibilityCustomActions = nil
    tagLabels.forEach { $0.removeFromSuperview() }
    tagLabels.removeAll()
    contentView.transform = .identity
    contentView.alpha = 1
  }

  func configure(
    gallery: FeaturedGallery,
    covers: [GalleryCoverPhoto]?,
    photoCount: String,
    subscriptionState: GallerySubscriptionButtonState,
    subscribeTitle: String,
    subscribedTitle: String,
    unsubscribeTitle: String,
    accessibilityLabel: String,
    onSubscriptionToggle: @escaping () -> Void
  ) {
    contentView.isAccessibilityElement = true
    contentView.accessibilityLabel = accessibilityLabel
    contentView.accessibilityTraits = .button
    nameLabel.text = gallery.name
    descriptionLabel.text = gallery.description
    descriptionLabel.isHidden = gallery.description?.trimmingToNil == nil
    photoCountLabel.text = photoCount
    self.onSubscriptionToggle = onSubscriptionToggle
    configureSubscriptionButton(
      state: subscriptionState,
      subscribeTitle: subscribeTitle,
      subscribedTitle: subscribedTitle,
      unsubscribeTitle: unsubscribeTitle
    )

    let avatarName = gallery.author?.name ?? gallery.name
    avatarFallback.text = avatarName.first.map { String($0).uppercased() }
    if let avatar = gallery.author?.avatar?.trimmingToNil, let url = URL(string: avatar) {
      avatarFallback.isHidden = true
      avatarView.sd_setImage(
        with: url,
        placeholderImage: nil,
        options: [.retryFailed],
        context: [.imageThumbnailPixelSize: NSValue(cgSize: CGSize(width: 108, height: 108))],
        progress: nil,
        completed: { [weak self] image, _, _, _ in
          self?.avatarFallback.isHidden = image != nil
        }
      )
    } else {
      avatarView.image = nil
      avatarFallback.isHidden = false
    }

    let resolvedCovers = covers ?? []
    primaryCover.configure(photo: resolvedCovers[safe: 0])
    secondaryTopCover.configure(photo: resolvedCovers[safe: 1])
    secondaryBottomCover.configure(photo: resolvedCovers[safe: 2])

    tagLabels.forEach { $0.removeFromSuperview() }
    tagLabels = gallery.tags.prefix(3).map { tag in
      let label = InsetLabel()
      label.text = tag
      label.font = .systemFont(ofSize: 11, weight: .medium)
      label.textColor = .secondaryLabel
      label.backgroundColor = .tertiarySystemFill
      label.layer.cornerCurve = .continuous
      label.layer.cornerRadius = 11
      label.clipsToBounds = true
      label.numberOfLines = 1
      label.lineBreakMode = .byTruncatingTail
      contentView.addSubview(label)
      return label
    }
    setNeedsLayout()
  }

  private func configureSubscriptionButton(
    state: GallerySubscriptionButtonState,
    subscribeTitle: String,
    subscribedTitle: String,
    unsubscribeTitle: String
  ) {
    guard state != .hidden else {
      subscriptionButton.isHidden = true
      contentView.accessibilityCustomActions = nil
      return
    }

    let isSubscribed: Bool
    let isUpdating: Bool
    switch state {
    case .hidden:
      return
    case .subscribe:
      isSubscribed = false
      isUpdating = false
    case .subscribed:
      isSubscribed = true
      isUpdating = false
    case .updating(let target):
      isSubscribed = target
      isUpdating = true
    }

    var configuration: UIButton.Configuration = isSubscribed ? .gray() : .filled()
    configuration.buttonSize = .small
    configuration.cornerStyle = .capsule

    let symbolConfig = UIImage.SymbolConfiguration(pointSize: 16.0, weight: .regular, scale: .medium)

    configuration.image = UIImage(systemName: isSubscribed ? "checkmark" : "plus", withConfiguration: symbolConfig)

    configuration.imagePadding = 5
    configuration.showsActivityIndicator = isUpdating
    configuration.title = isSubscribed ? subscribedTitle : subscribeTitle
    configuration.titleLineBreakMode = .byTruncatingTail
    subscriptionButton.configuration = configuration
    subscriptionButton.isEnabled = !isUpdating
    subscriptionButton.isHidden = false
    subscriptionButton.accessibilityLabel = isSubscribed ? unsubscribeTitle : subscribeTitle

    guard !isUpdating else {
      contentView.accessibilityCustomActions = nil
      return
    }
    let actionTitle = isSubscribed ? unsubscribeTitle : subscribeTitle
    contentView.accessibilityCustomActions = [
      UIAccessibilityCustomAction(name: actionTitle) { [weak self] _ in
        self?.onSubscriptionToggle?()
        return self != nil
      },
    ]
  }

  static func preferredHeight(for width: CGFloat) -> CGFloat {
    width * 9 / 16 + 98
  }
}

extension GalleryCardCell: UIPointerInteractionDelegate {
  func pointerInteraction(
    _ interaction: UIPointerInteraction,
    styleFor region: UIPointerRegion
  ) -> UIPointerStyle? {
    UIPointerStyle(effect: .lift(UITargetedPreview(view: contentView)))
  }
}

private final class GalleryCoverView: UIView {
  private let imageView = UIImageView()
  private let liveBadge = UIImageView()

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .tertiarySystemFill
    clipsToBounds = true
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.sd_imageTransition = .fade(duration: 0.2)
    addSubview(imageView)
    liveBadge.image = LivePhotoBadgeArtwork.overContent
    liveBadge.contentMode = .center
    liveBadge.isHidden = true
    addSubview(liveBadge)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = bounds
    let badgeSize = liveBadge.image?.size ?? CGSize(width: 24, height: 24)
    liveBadge.frame = CGRect(origin: CGPoint(x: 6, y: 6), size: badgeSize)
  }

  func configure(photo: GalleryCoverPhoto?) {
    imageView.sd_cancelCurrentImageLoad()
    imageView.image = nil
    guard let photo else {
      liveBadge.isHidden = true
      return
    }
    liveBadge.isHidden = !photo.isLivePhoto
    imageView.sd_setImage(
      with: URL(string: photo.thumbnailUrl),
      placeholderImage: ThumbHashCache.image(forHex: photo.thumbHash),
      options: [.retryFailed]
    )
  }

  func prepareForReuse() {
    imageView.sd_cancelCurrentImageLoad()
    imageView.image = nil
    liveBadge.isHidden = true
  }
}

private final class InsetLabel: UILabel {
  private let insets = UIEdgeInsets(top: 3, left: 9, bottom: 3, right: 9)

  override func drawText(in rect: CGRect) {
    super.drawText(in: rect.inset(by: insets))
  }

  override func sizeThatFits(_ size: CGSize) -> CGSize {
    let inner = CGSize(
      width: max(0, size.width - insets.left - insets.right),
      height: max(0, size.height - insets.top - insets.bottom)
    )
    let fitting = super.sizeThatFits(inner)
    return CGSize(
      width: fitting.width + insets.left + insets.right,
      height: fitting.height + insets.top + insets.bottom
    )
  }
}

private extension Collection {
  subscript(safe index: Index) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}
