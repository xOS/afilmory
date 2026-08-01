import UIKit

final class PhotoDetailGlassSurface: UIVisualEffectView {
  init(cornerRadius: CGFloat) {
    super.init(effect: nil)

    if #available(iOS 26.0, *) {
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = true
      effect = glass
    } else {
      effect = UIBlurEffect(style: .systemChromeMaterialDark)
      contentView.backgroundColor = UIColor.black.withAlphaComponent(0.18)
    }

    clipsToBounds = true
    layer.cornerCurve = .continuous
    layer.cornerRadius = cornerRadius
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}
