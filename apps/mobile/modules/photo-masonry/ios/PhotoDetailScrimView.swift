import UIKit

final class PhotoDetailScrimView: UIView {
  enum Edge {
    case bottom
    case top
  }

  static let alpha: CGFloat = 0.38
  static let span: CGFloat = 96

  private let gradientLayer = CAGradientLayer()

  init(edge: Edge) {
    super.init(frame: .zero)

    isUserInteractionEnabled = false
    backgroundColor = .clear
    layer.addSublayer(gradientLayer)

    let opaque = UIColor.black.withAlphaComponent(Self.alpha).cgColor
    let clear = UIColor.clear.cgColor

    switch edge {
    case .top:
      gradientLayer.colors = [opaque, clear]
    case .bottom:
      gradientLayer.colors = [clear, opaque]
    }
    gradientLayer.locations = [0, 1]
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Frame changes happen mid-rotation and mid-inspector-drag; disable
    // implicit actions so the layer snaps instead of animating along.
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    gradientLayer.frame = bounds
    CATransaction.commit()
  }
}
