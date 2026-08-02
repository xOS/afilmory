import SwiftUI
import UIKit

struct CommentRowView: View {
  let comment: CommentItem
  let store: CommentsStore

  private var user: CommentUser? { store.user(for: comment) }
  private var author: String { store.authorName(for: comment) }
  private var parent: CommentItem? { store.parent(for: comment) }
  private var likeCount: Int { comment.reactionCounts["like"] ?? 0 }
  private var liked: Bool { comment.viewerReactions.contains("like") }
  private var isSending: Bool { comment.deliveryState == .sending }

  var body: some View {
    HStack(alignment: .top, spacing: 11) {
      CommentAvatarView(imageURL: user?.image, name: author)

      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
          Text(author)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)

          if let relativeTime {
            Text(relativeTime)
              .font(.caption)
              .foregroundStyle(.secondary)
          }

          Spacer(minLength: 8)

          if likeCount > 0 {
            Label(String(likeCount), systemImage: liked ? "heart.fill" : "heart")
              .font(.caption.monospacedDigit())
              .foregroundStyle(liked ? Color.accentColor : .secondary)
              .accessibilityLabel("\(liked ? store.localization.unlike : store.localization.like), \(likeCount)")
          }
        }

        if let parent {
          Label(store.localization.replyingTo(store.authorName(for: parent)), systemImage: "arrowshape.turn.up.left")
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

        Text(comment.content)
          .font(.body)
          .foregroundStyle(.primary)
          .textSelection(.enabled)

        if isSending || comment.status == .pending {
          Label(
            isSending ? store.localization.sending : store.localization.pending,
            systemImage: isSending ? "clock" : "hourglass"
          )
          .font(.caption)
          .foregroundStyle(.secondary)
        }
      }
    }
    .padding(.vertical, 5)
    .contentShape(Rectangle())
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      Button(store.localization.reply, systemImage: "arrowshape.turn.up.left") {
        store.beginReply(to: comment)
      }
      .tint(.accentColor)
      .disabled(isSending)
    }
    .contextMenu {
      Button(liked ? store.localization.unlike : store.localization.like, systemImage: liked ? "heart.slash" : "heart") {
        Task { await store.toggleReaction(comment.id) }
      }
      .disabled(isSending || store.pendingReactionIds.contains(comment.id))

      Button(store.localization.copy, systemImage: "document.on.document") {
        UIPasteboard.general.string = comment.content
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(accessibilityLabel)
    .accessibilityAction(named: Text(store.localization.reply)) {
      guard !isSending else { return }
      store.beginReply(to: comment)
    }
    .accessibilityAction(named: Text(liked ? store.localization.unlike : store.localization.like)) {
      guard !isSending, !store.pendingReactionIds.contains(comment.id) else { return }
      Task { await store.toggleReaction(comment.id) }
    }
    .accessibilityAction(named: Text(store.localization.copy)) {
      UIPasteboard.general.string = comment.content
    }
  }

  private var relativeTime: String? {
    guard let date = comment.createdDate else { return nil }
    return date.formatted(
      Date.RelativeFormatStyle(presentation: .named, unitsStyle: .abbreviated)
        .locale(Locale(identifier: store.localization.locale))
    )
  }

  private var accessibilityLabel: String {
    [author, relativeTime, parent.map { store.localization.replyingTo(store.authorName(for: $0)) }, comment.content]
      .compactMap { $0 }
      .joined(separator: ", ")
  }
}
