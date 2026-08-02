import SwiftUI

struct CommentComposerView: View {
  @Bindable var store: CommentsStore
  @FocusState private var isFocused: Bool

  var body: some View {
    VStack(spacing: 0) {
      if let reply = store.replyComment {
        HStack(spacing: 8) {
          Image(systemName: "arrowshape.turn.up.left")
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)
          Text(store.localization.replyingTo(store.authorName(for: reply)))
            .font(.footnote)
            .foregroundStyle(.secondary)
            .lineLimit(1)
          Spacer(minLength: 8)
          Button(store.localization.cancelReply, systemImage: "xmark") {
            store.cancelReply()
          }
          .labelStyle(.iconOnly)
          .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)

        Divider()
      }

      HStack(alignment: .bottom, spacing: 10) {
        VStack(alignment: .trailing, spacing: 3) {
          TextField(store.localization.placeholder, text: $store.draft, axis: .vertical)
            .focused($isFocused)
            .lineLimit(1...5)
            .textFieldStyle(.plain)
            .submitLabel(.send)
            .disabled(store.isSending)
            .accessibilityLabel(store.localization.placeholder)
            .onSubmit {
              guard store.canSend else { return }
              Task { await store.send() }
            }

          if store.characterCount >= 900 {
            Text("\(store.characterCount) / 1000")
              .font(.caption2.monospacedDigit())
              .foregroundStyle(store.characterCount > 1_000 ? .red : .secondary)
              .accessibilityLabel("\(store.characterCount) / 1000")
          }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemFill), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

        Button(store.localization.send, systemImage: "arrow.up.circle.fill") {
          Task { await store.send() }
        }
        .labelStyle(.iconOnly)
        .font(.system(size: 29, weight: .semibold))
        .buttonStyle(.plain)
        .disabled(!store.canSend)
        .accessibilityLabel(store.localization.send)
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 9)
    }
    .background(.bar)
    .onChange(of: store.replyCommentId) { _, next in
      if next != nil {
        isFocused = true
      }
    }
  }
}
