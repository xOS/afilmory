import UIKit

final class PhotoDetailNavigationBar: UINavigationBar {
  var onRequestClose: (() -> Void)?

  private let item = UINavigationItem()
  private let backButtonItem = UIBarButtonItem(image: UIImage(systemName: "chevron.backward"), style: .plain, target: nil, action: nil)

  override init(frame: CGRect) {
    super.init(frame: frame)

    // The backdrop is always black; without this the glass bar items resolve
    // against the ambient trait and wash out.
    overrideUserInterfaceStyle = .dark
    tintColor = .white

    let appearance = UINavigationBarAppearance()
    appearance.configureWithTransparentBackground()
    appearance.shadowColor = nil
    appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
    appearance.subtitleTextAttributes = [.foregroundColor: UIColor.white.withAlphaComponent(0.6)]
    standardAppearance = appearance
    scrollEdgeAppearance = appearance

    backButtonItem.accessibilityIdentifier = "photo-detail-back"
    backButtonItem.primaryAction = UIAction { [weak self] _ in self?.onRequestClose?() }
    item.leftBarButtonItem = backButtonItem
    setItems([item], animated: false)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func setTitle(_ title: String, subtitle: String) {
    item.title = title
    item.subtitle = subtitle.isEmpty ? nil : subtitle
  }

  func setBackAccessibilityLabel(_ label: String) {
    backButtonItem.accessibilityLabel = label
  }
}
