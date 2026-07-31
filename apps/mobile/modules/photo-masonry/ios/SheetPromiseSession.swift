import ExpoModulesCore
import UIKit

final class PhotoFilterSheetSession: NSObject, UIAdaptivePresentationControllerDelegate {
  private let promise: Promise
  private let onSettle: () -> Void
  private var isSettled = false

  init(promise: Promise, onSettle: @escaping () -> Void) {
    self.promise = promise
    self.onSettle = onSettle
  }

  func complete(with filters: PhotoFiltersRecord) {
    settle(with: filters)
  }

  func cancel() {
    settle(with: nil)
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    cancel()
  }

  private func settle(with filters: PhotoFiltersRecord?) {
    guard !isSettled else { return }
    isSettled = true
    promise.resolve(filters)
    onSettle()
  }
}
