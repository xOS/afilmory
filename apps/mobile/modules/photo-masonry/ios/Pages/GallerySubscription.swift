import Foundation

struct GallerySubscriptionMutationResponse: Decodable, Sendable {
  let tenantId: String
  let subscribed: Bool
}

enum GallerySubscriptionAPI {
  static func subscribe(tenantId: String) -> APIEndpoint {
    APIEndpoint(
      baseURL: .platform,
      path: "gallery-subscriptions/\(tenantId)",
      method: .put
    )
  }

  static func unsubscribe(tenantId: String) -> APIEndpoint {
    APIEndpoint(
      baseURL: .platform,
      path: "gallery-subscriptions/\(tenantId)",
      method: .delete
    )
  }
}

enum GallerySubscriptionButtonState: Equatable {
  case hidden
  case subscribe
  case subscribed
  case updating(isSubscribed: Bool)
}

func resolveGallerySubscriptionButtonState(
  isOwnGallery: Bool,
  isSubscribed: Bool,
  pendingTarget: Bool?
) -> GallerySubscriptionButtonState {
  if isOwnGallery {
    return .hidden
  }
  if let pendingTarget {
    return .updating(isSubscribed: pendingTarget)
  }
  return isSubscribed ? .subscribed : .subscribe
}
