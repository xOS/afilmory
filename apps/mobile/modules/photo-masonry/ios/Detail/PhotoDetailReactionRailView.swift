import UIKit

private let reactionItemDiameter: CGFloat = 40
private let reactionItemSpacing: CGFloat = 8
private let reactionContainerInset = UIEdgeInsets(top: 5, left: 4, bottom: 3, right: 4)
private let reactionBadgeMinHeight: CGFloat = 16
private let reactionBadgeHorizontalPadding: CGFloat = 5

final class PhotoDetailReactionRailView: UIView {
  var onSelect: ((String) -> Void)?
  var anchorXCenter: CGFloat?

  private let container = UIVisualEffectView()
  private var itemGlasses: [UIVisualEffectView] = []
  private var itemBadges: [PhotoDetailReactionBadge] = []
  private var items: [PhotoDetailReactionItem] = []
  private var presented = false

  override init(frame: CGRect) {
    super.init(frame: frame)

    alpha = 0
    isHidden = true

    let clusterEffect = UIGlassContainerEffect()
    clusterEffect.spacing = reactionItemSpacing
    container.effect = clusterEffect
    addSubview(container)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    container.frame = bounds

    var x = reactionContainerInset.left
    for (glass, badge) in zip(itemGlasses, itemBadges) {
      let itemFrame = CGRect(x: x, y: reactionContainerInset.top, width: reactionItemDiameter, height: reactionItemDiameter)
      glass.frame = itemFrame
      glass.contentView.subviews.first?.frame = glass.contentView.bounds

      if !badge.isHidden {
        let height = reactionBadgeMinHeight
        let width = max(height, badge.intrinsicContentSize.width + reactionBadgeHorizontalPadding * 2)
        badge.frame = CGRect(x: itemFrame.maxX - width + 3, y: itemFrame.minY - 4, width: width, height: height)
        badge.layer.cornerRadius = height / 2
      }

      x += reactionItemDiameter + reactionItemSpacing
    }
  }

  override func sizeThatFits(_ size: CGSize) -> CGSize {
    let height = reactionItemDiameter + reactionContainerInset.top + reactionContainerInset.bottom
    guard !items.isEmpty else {
      return CGSize(width: reactionContainerInset.left + reactionContainerInset.right, height: height)
    }
    let width = CGFloat(items.count) * reactionItemDiameter
      + CGFloat(items.count - 1) * reactionItemSpacing
      + reactionContainerInset.left + reactionContainerInset.right
    return CGSize(width: width, height: height)
  }

  func preferredFrame(containerWidth: CGFloat, bottomY: CGFloat) -> CGRect {
    let size = sizeThatFits(.zero)
    let x = anchorXCenter.map { center in
      min(max(12, center - size.width / 2), containerWidth - size.width - 12)
    } ?? max(12, containerWidth - size.width - 12)
    return CGRect(x: x, y: bottomY - size.height - 8, width: min(size.width, containerWidth - 24), height: size.height)
  }

  func setItems(_ items: [PhotoDetailReactionItem]) {
    self.items = items
    itemGlasses.forEach { $0.removeFromSuperview() }
    itemGlasses.removeAll()
    itemBadges.forEach { $0.removeFromSuperview() }
    itemBadges.removeAll()

    for item in items {
      let button = PhotoDetailReactionButton(item: item)
      button.addAction(
        UIAction { [weak self] _ in self?.onSelect?(item.reaction) },
        for: .touchUpInside
      )

      let effect = UIGlassEffect(style: .regular)
      effect.isInteractive = false // interactive glass would swallow the tap meant for the button in its content view
      let glass = UIVisualEffectView(effect: effect)
      glass.clipsToBounds = true
      glass.layer.cornerCurve = .circular
      glass.layer.cornerRadius = reactionItemDiameter / 2
      glass.contentView.addSubview(button)
      container.contentView.addSubview(glass)
      itemGlasses.append(glass)

      let badge = PhotoDetailReactionBadge(count: item.count)
      container.contentView.addSubview(badge)
      itemBadges.append(badge)
    }
    setNeedsLayout()
  }

  func setPresented(_ presented: Bool, animated: Bool) {
    guard presented != self.presented else { return }
    self.presented = presented
    if presented {
      isHidden = false
    }

    let changes = {
      self.alpha = presented ? 1 : 0
      self.transform = presented
        ? .identity
        : CGAffineTransform(translationX: 0, y: 8).scaledBy(x: 0.96, y: 0.96)
    }
    let completion: (Bool) -> Void = { [weak self] _ in
      guard let self else { return }
      if !self.presented {
        isHidden = true
      }
    }

    guard animated, !UIAccessibility.isReduceMotionEnabled else {
      changes()
      completion(true)
      return
    }
    UIView.animate(
      withDuration: 0.2,
      delay: 0,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
      animations: changes,
      completion: completion
    )
  }
}

private final class PhotoDetailReactionButton: UIButton {
  init(item: PhotoDetailReactionItem) {
    super.init(frame: .zero)

    var configuration = UIButton.Configuration.plain()
    configuration.title = item.reaction
    configuration.baseForegroundColor = .white
    configuration.contentInsets = .zero
    self.configuration = configuration
    titleLabel?.font = .systemFont(ofSize: 21)
    accessibilityLabel = item.accessibilityLabel
    accessibilityTraits = item.active ? [.button, .selected] : .button
    isEnabled = !item.pending
    alpha = item.pending ? 0.66 : 1
    backgroundColor = item.active ? UIColor.systemBlue.withAlphaComponent(0.24) : .clear
    layer.cornerCurve = .circular
    layer.cornerRadius = reactionItemDiameter / 2
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}

private final class PhotoDetailReactionBadge: UILabel {
  init(count: Int) {
    super.init(frame: .zero)

    backgroundColor = UIColor.black.withAlphaComponent(0.72)
    clipsToBounds = true
    font = .monospacedDigitSystemFont(
      ofSize: UIFont.preferredFont(forTextStyle: .caption2).pointSize,
      weight: .semibold
    )
    isAccessibilityElement = false
    layer.cornerCurve = .continuous
    textAlignment = .center
    textColor = .white
    text = count > 999 ? "999+" : "\(count)"
    isHidden = count <= 0
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}
