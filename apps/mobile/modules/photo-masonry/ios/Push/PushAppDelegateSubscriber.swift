import ExpoModulesCore
import UIKit
import UserNotifications

func galleryNotificationDeepLink(
  userInfo: [AnyHashable: Any],
  scheme: String = AfilmoryBuildConfiguration.urlScheme
) -> URL? {
  guard userInfo["route"] as? String == "gallery",
        let rawSlug = userInfo["gallerySlug"] as? String,
        let slug = rawSlug.trimmingToNil
  else { return nil }

  let galleryName = (userInfo["galleryName"] as? String)?.trimmingToNil ?? slug
  let eventId = (userInfo["eventId"] as? String)?.trimmingToNil ?? UUID().uuidString
  guard var components = URLComponents(string: "\(scheme):///explore") else { return nil }
  components.queryItems = [
    URLQueryItem(name: "gallery", value: slug),
    URLQueryItem(name: "name", value: galleryName),
    URLQueryItem(name: "event", value: eventId),
  ]
  return components.url
}
public final class PushAppDelegateSubscriber: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    guard AfilmoryBuildConfiguration.supportsPushNotifications else { return true }
    UNUserNotificationCenter.current().delegate = self
    APNsRegistrationCoordinator.shared.start()
    return true
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    guard AfilmoryBuildConfiguration.supportsPushNotifications else { return }
    APNsRegistrationCoordinator.shared.registerForRemoteNotificationsIfAuthorized()
  }

  public func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    guard AfilmoryBuildConfiguration.supportsPushNotifications else { return }
    APNsRegistrationCoordinator.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
  }

  public func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    guard AfilmoryBuildConfiguration.supportsPushNotifications else { return }
    APNsRegistrationCoordinator.shared.didFailToRegisterForRemoteNotifications(error)
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound])
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    guard let url = galleryNotificationDeepLink(userInfo: userInfo) else {
      completionHandler()
      return
    }
    UIApplication.shared.open(url, options: [:]) { _ in
      completionHandler()
    }
  }
}
