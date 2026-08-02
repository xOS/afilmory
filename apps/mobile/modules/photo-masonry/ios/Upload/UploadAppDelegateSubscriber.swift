import ExpoModulesCore
import UIKit

public final class UploadAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    guard identifier == UploadCenter.sessionIdentifier else {
      completionHandler()
      return
    }
    UploadCenter.backgroundCompletionHandler = completionHandler
    _ = UploadCenter.shared
  }
}
