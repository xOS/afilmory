import ExpoModulesCore
import UIKit

final class SheetPromiseSession: NSObject, UIAdaptivePresentationControllerDelegate {
  private let promise: Promise
  private let onSettle: () -> Void
  private var isSettled = false

  init(promise: Promise, onSettle: @escaping () -> Void) {
    self.promise = promise
    self.onSettle = onSettle
  }

  func complete(with value: Any?) {
    settle(with: value)
  }

  func cancel() {
    settle(with: nil)
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    cancel()
  }

  private func settle(with value: Any?) {
    guard !isSettled else { return }
    isSettled = true
    promise.resolve(value)
    onSettle()
  }
}
