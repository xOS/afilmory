import UIKit

final class PhotoDetailSoftEdgeView: UIView {
  enum Edge {
    case bottom
    case top
  }

  private let effectView = UIVisualEffectView(
    effect: UIBlurEffect(style: .systemUltraThinMaterialDark)
  )
  private let effectMask = CAGradientLayer()
  private let tintLayer = CAGradientLayer()

  init(edge: Edge) {
    super.init(frame: .zero)

    isUserInteractionEnabled = false
    backgroundColor = .clear
    effectView.isUserInteractionEnabled = false
    addSubview(effectView)
    layer.addSublayer(tintLayer)
    effectView.layer.mask = effectMask

    let clear = UIColor.clear.cgColor
    let opaque = UIColor.black.cgColor
    let tint = UIColor.black.withAlphaComponent(0.42).cgColor
    let tintMiddle = UIColor.black.withAlphaComponent(0.16).cgColor

    switch edge {
    case .top:
      effectMask.colors = [opaque, opaque, clear]
      effectMask.locations = [0, 0.42, 1]
      tintLayer.colors = [tint, tintMiddle, clear]
      tintLayer.locations = [0, 0.45, 1]
    case .bottom:
      effectMask.colors = [clear, opaque, opaque]
      effectMask.locations = [0, 0.58, 1]
      tintLayer.colors = [clear, tintMiddle, tint]
      tintLayer.locations = [0, 0.55, 1]
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    effectView.frame = bounds
    effectMask.frame = effectView.bounds
    tintLayer.frame = bounds
  }
}
