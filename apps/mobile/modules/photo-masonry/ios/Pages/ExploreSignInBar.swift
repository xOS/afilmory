import UIKit

final class ExploreSignInBar: UIView {
  var onSignIn: (() -> Void)?

  private let button = UIButton(type: .system)

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .systemGroupedBackground

    let hairline = UIView()
    hairline.translatesAutoresizingMaskIntoConstraints = false
    hairline.backgroundColor = UIColor.separator.withAlphaComponent(0.45)
    addSubview(hairline)

    var configuration = AdaptiveGlass.buttonConfiguration(prominent: true)
    configuration.title = String(localized: "Sign in")
    configuration.cornerStyle = .capsule
    configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = .systemFont(ofSize: 17, weight: .semibold)
      return outgoing
    }
    button.configuration = configuration
    button.translatesAutoresizingMaskIntoConstraints = false
    button.accessibilityIdentifier = "explore.signIn"
    button.addAction(
      UIAction { [weak self] _ in self?.onSignIn?() },
      for: .touchUpInside
    )
    addSubview(button)

    NSLayoutConstraint.activate([
      hairline.topAnchor.constraint(equalTo: topAnchor),
      hairline.leadingAnchor.constraint(equalTo: leadingAnchor),
      hairline.trailingAnchor.constraint(equalTo: trailingAnchor),
      hairline.heightAnchor.constraint(equalToConstant: 1 / max(UIScreen.main.scale, 1)),

      button.topAnchor.constraint(equalTo: topAnchor, constant: 10),
      button.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
      button.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
      button.heightAnchor.constraint(equalToConstant: 50),
      button.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -10),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}
