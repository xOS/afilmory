import UIKit

final class PhotoDetailToolbar: UIToolbar {
  var onShare: (() -> Void)?
  var onInfo: (() -> Void)?
  var onComments: (() -> Void)?
  var onReactions: (() -> Void)?

  private static let reactionsAccessibilityIdentifier = "photo-detail-reactions"
  // The face.smiling family is drawn the wrong way round: the base symbol is the
  // solid glyph and `.fill` is the outlined one.
  private static let reactionsActiveSymbol = "face.smiling"
  private static let reactionsInactiveSymbol = "face.smiling.fill"

  private let shareItem = UIBarButtonItem(image: UIImage(systemName: "square.and.arrow.up"), style: .plain, target: nil, action: nil)
  private let infoItem = UIBarButtonItem(image: UIImage(systemName: "info.circle"), style: .plain, target: nil, action: nil)
  private let reactionsItem = UIBarButtonItem(
    image: UIImage(systemName: PhotoDetailToolbar.reactionsInactiveSymbol),
    style: .plain,
    target: nil,
    action: nil
  )
  private let commentsButton = PhotoDetailCommentsButton()
  private lazy var commentsItem = UIBarButtonItem(customView: commentsButton)

  private var socialActionsEnabled = true

  var shareBarButtonItem: UIBarButtonItem { shareItem }

  override init(frame: CGRect) {
    super.init(frame: frame)

    overrideUserInterfaceStyle = .dark
    tintColor = .white

    shareItem.accessibilityIdentifier = "photo-detail-share"
    infoItem.accessibilityIdentifier = "photo-detail-info"
    reactionsItem.accessibilityIdentifier = Self.reactionsAccessibilityIdentifier
    commentsButton.accessibilityIdentifier = "photo-detail-comments"

    let appearance = UIToolbarAppearance()
    appearance.configureWithTransparentBackground()
    standardAppearance = appearance
    scrollEdgeAppearance = appearance

    shareItem.primaryAction = UIAction { [weak self] _ in self?.onShare?() }
    infoItem.primaryAction = UIAction { [weak self] _ in self?.onInfo?() }
    reactionsItem.primaryAction = UIAction { [weak self] _ in self?.onReactions?() }
    commentsButton.addAction(UIAction { [weak self] _ in self?.onComments?() }, for: .touchUpInside)

    updateItems()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func setSocialActionsEnabled(_ enabled: Bool) {
    guard enabled != socialActionsEnabled else { return }
    socialActionsEnabled = enabled
    updateItems()
  }

  func setInfoActive(_ active: Bool) {
    infoItem.image = UIImage(systemName: active ? "info.circle.fill" : "info.circle")
  }

  func setReactionsActive(_ active: Bool) {
    reactionsItem.image = UIImage(
      systemName: active ? Self.reactionsActiveSymbol : Self.reactionsInactiveSymbol
    )
  }

  func setCommentCount(_ count: Int) {
    commentsButton.count = count
  }

  func setShareAccessibilityLabel(_ label: String) {
    shareItem.accessibilityLabel = label
  }

  func setInfoAccessibilityLabel(_ label: String) {
    infoItem.accessibilityLabel = label
  }

  func setCommentsAccessibilityLabel(_ label: String) {
    commentsButton.accessibilityLabel = label
  }

  func setReactionsAccessibilityLabel(_ label: String) {
    reactionsItem.accessibilityLabel = label
  }

  // UIKit exposes no view for a plain UIBarButtonItem; the identifier it forwards
  // onto its backing button is the only public handle on the item's geometry.
  func reactionsItemCenterX(in view: UIView) -> CGFloat? {
    guard socialActionsEnabled,
          let itemView = firstDescendant(withAccessibilityIdentifier: Self.reactionsAccessibilityIdentifier)
    else { return nil }
    return itemView.convert(itemView.bounds, to: view).midX
  }

  private func firstDescendant(withAccessibilityIdentifier identifier: String) -> UIView? {
    var queue = subviews
    while !queue.isEmpty {
      let candidate = queue.removeFirst()
      if candidate.accessibilityIdentifier == identifier {
        return candidate
      }
      queue.append(contentsOf: candidate.subviews)
    }
    return nil
  }

  private func updateItems() {
    var barItems: [UIBarButtonItem] = [shareItem, .flexibleSpace(), infoItem]
    if socialActionsEnabled {
      barItems += [.flexibleSpace(), commentsItem, .flexibleSpace(), reactionsItem]
    }
    setItems(barItems, animated: false)
    commentsButton.badgeVisible = socialActionsEnabled
  }
}

private final class PhotoDetailCommentsButton: UIButton {
  private static let badgeMinHeight: CGFloat = 16
  private static let badgeHorizontalPadding: CGFloat = 5

  private let badgeLabel = UILabel()

  var count = 0 {
    didSet { updateBadge() }
  }

  var badgeVisible = false {
    didSet { updateBadge() }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)

    var configuration = UIButton.Configuration.plain()
    configuration.image = UIImage(systemName: "bubble.left")
    self.configuration = configuration

    badgeLabel.backgroundColor = .systemRed
    badgeLabel.clipsToBounds = true
    badgeLabel.font = .monospacedDigitSystemFont(
      ofSize: UIFont.preferredFont(forTextStyle: .caption2).pointSize,
      weight: .semibold
    )
    badgeLabel.isAccessibilityElement = false
    badgeLabel.isHidden = true
    badgeLabel.layer.cornerCurve = .continuous
    badgeLabel.textAlignment = .center
    badgeLabel.textColor = .white
    addSubview(badgeLabel)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard !badgeLabel.isHidden, let iconFrame = imageView?.frame else { return }
    let height = Self.badgeMinHeight
    let width = max(height, badgeLabel.intrinsicContentSize.width + Self.badgeHorizontalPadding * 2)
    badgeLabel.frame = CGRect(x: iconFrame.maxX - width / 2, y: iconFrame.minY - height / 2, width: width, height: height)
    badgeLabel.layer.cornerRadius = height / 2
  }

  private func updateBadge() {
    badgeLabel.text = count > 99 ? "99+" : "\(count)"
    badgeLabel.isHidden = !(badgeVisible && count > 0)
    setNeedsLayout()
  }
}
