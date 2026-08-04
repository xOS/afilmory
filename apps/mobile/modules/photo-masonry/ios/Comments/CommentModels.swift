import ExpoModulesCore
import Foundation

enum CommentStatus: String, Decodable {
  case approved
  case pending
  case hidden
  case rejected
}

enum CommentDeliveryState: String, Decodable {
  case sending
  case sent
}

struct CommentItem: Decodable, Identifiable {
  var id: String
  var photoId: String
  var parentId: String?
  var userId: String
  var content: String
  var status: CommentStatus
  var createdAt: String
  var updatedAt: String
  var reactionCounts: [String: Int]
  var viewerReactions: [String]
  var clientId: String?
  var deliveryState: CommentDeliveryState?

  var identity: String { clientId ?? id }

  var createdDate: Date? {
    try? Date(createdAt, strategy: .iso8601)
  }
}

struct CommentUser: Decodable {
  var id: String
  var name: String
  var image: String?
  var website: String?
}

struct CommentPage: Decodable {
  var comments: [CommentItem]
  var relations: [String: CommentItem]
  var users: [String: CommentUser]
  var nextCursor: String?
}

struct CommentReactionResponse: Decodable {
  var item: CommentItem
}

struct CommentCollection {
  var comments: [CommentItem]
  var relations: [String: CommentItem]
  var users: [String: CommentUser]

  static let empty = CommentCollection(comments: [], relations: [:], users: [:])
}

struct CreateCommentBody: Encodable {
  let content: String
  let photoId: String
  let parentId: String?
}

struct CommentReactionBody: Encodable {
  let reaction: String
}

struct PhotoCommentsSheetRequest: Record {
  @Field var gallerySlug: String = ""
  @Field var photoId: String = ""
  @Field var photoTitle: String = ""
  @Field var baseURL: String = ""
  @Field var viewerUserId: String?
  @Field var initialCommentCount: Int = -1
  @Field var localizationJSON: String = ""
}

struct CommentLocalization: Decodable {
  let locale: String
  let title: String
  let done: String
  let empty: String
  let error: String
  let retry: String
  let loadMoreFailed: String
  let loginRequired: String
  let reauthenticate: String
  let signIn: String
  let pending: String
  let placeholder: String
  let postFailed: String
  let reactionFailed: String
  let reply: String
  let replyingToTemplate: String
  let cancelReply: String
  let send: String
  let sending: String
  let like: String
  let unlike: String
  let copy: String
  let you: String
  let anonymous: String
  let userTemplate: String

  static func decode(_ json: String) -> CommentLocalization? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(CommentLocalization.self, from: data)
  }

  static func resolve(_ localization: Localization = .shared) -> CommentLocalization {
    CommentLocalization(
      locale: localization.language.localeIdentifier,
      title: localization.value("comments.title"),
      done: localization.value("common.done"),
      empty: localization.value("comments.empty"),
      error: localization.value("comments.error"),
      retry: localization.value("common.retry"),
      loadMoreFailed: localization.value("comments.loadMoreFailed"),
      loginRequired: localization.value("comments.loginRequired"),
      reauthenticate: localization.value("comments.reauthenticate"),
      signIn: localization.value("common.signIn"),
      pending: localization.value("comments.pending"),
      placeholder: localization.value("comments.placeholder"),
      postFailed: localization.value("comments.postFailed"),
      reactionFailed: localization.value("comments.reactionFailed"),
      reply: localization.value("comments.reply"),
      replyingToTemplate: localization.value(
        "comments.replyingToPlain",
        arguments: ["user": "__USER__"]
      ),
      cancelReply: localization.value("comments.cancelReply"),
      send: localization.value("comments.send"),
      sending: localization.value("comments.sending"),
      like: localization.value("comments.like"),
      unlike: localization.value("comments.unlike"),
      copy: localization.value("common.copy"),
      you: localization.value("comments.you"),
      anonymous: localization.value("comments.anonymous"),
      userTemplate: localization.value(
        "comments.user",
        arguments: ["id": "__ID__"]
      )
    )
  }

  func replyingTo(_ user: String) -> String {
    replyingToTemplate.replacingOccurrences(of: "__USER__", with: user)
  }

  func user(id: String) -> String {
    userTemplate.replacingOccurrences(of: "__ID__", with: id)
  }
}

struct PhotoCommentsSheetResult {
  let commentCount: Int
  let requestedSignIn: Bool

  var dictionary: [String: Any] {
    [
      "commentCount": commentCount,
      "requestedSignIn": requestedSignIn,
    ]
  }
}
