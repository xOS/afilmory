import UIKit

final class PhotoDetailReactionRailView: UIView {
  var onSelect: ((String) -> Void)?

  private let surface = PhotoDetailGlassSurface(cornerRadius: 20)
  private let stackView = UIStackView()
  private var items: [PhotoDetailReactionItem] = []
  private var presented = false

  override init(frame: CGRect) {
    super.init(frame: frame)

    alpha = 0
    isHidden = true
    stackView.alignment = .center
    stackView.axis = .horizontal
    stackView.distribution = .fillEqually
    stackView.spacing = 2
    addSubview(surface)
    surface.contentView.addSubview(stackView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    surface.frame = bounds
    stackView.frame = bounds.insetBy(dx: 4, dy: 3)
  }

  override func sizeThatFits(_ size: CGSize) -> CGSize {
    CGSize(width: CGFloat(items.count) * 42 + 8, height: 46)
  }

  func setItems(_ items: [PhotoDetailReactionItem]) {
    self.items = items
    for view in stackView.arrangedSubviews {
      stackView.removeArrangedSubview(view)
      view.removeFromSuperview()
    }

    for item in items {
      let button = PhotoDetailReactionButton(item: item)
      button.addAction(
        UIAction { [weak self] _ in self?.onSelect?(item.reaction) },
        for: .touchUpInside
      )
      stackView.addArrangedSubview(button)
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
  private let countLabel = UILabel()

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
    clipsToBounds = false
    layer.cornerCurve = .continuous
    layer.cornerRadius = 14

    countLabel.backgroundColor = UIColor.black.withAlphaComponent(0.72)
    countLabel.clipsToBounds = true
    countLabel.font = .monospacedDigitSystemFont(ofSize: 8, weight: .bold)
    countLabel.isAccessibilityElement = false
    countLabel.text = item.count > 999 ? "999+" : "\(item.count)"
    countLabel.textAlignment = .center
    countLabel.textColor = .white
    countLabel.isHidden = item.count <= 0
    addSubview(countLabel)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard !countLabel.isHidden else { return }
    let width = max(15, countLabel.intrinsicContentSize.width + 6)
    countLabel.frame = CGRect(x: bounds.maxX - width + 3, y: -3, width: width, height: 15)
    countLabel.layer.cornerRadius = 7.5
  }
}
