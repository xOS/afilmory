import SwiftUI

struct PhotoCommentsSheetView: View {
  @Bindable var store: CommentsStore

  var body: some View {
    content
      .safeAreaInset(edge: .bottom, spacing: 0) {
        Divider()
        if store.isSignedIn {
          CommentComposerView(store: store)
        } else {
          CommentSignInView(store: store)
        }
      }
      .task {
        await store.loadInitial()
      }
  }

  @ViewBuilder private var content: some View {
    switch store.loadState {
    case .idle, .loading:
      List(0..<4, id: \.self) { _ in
        CommentSkeletonRowView()
      }
      .listStyle(.plain)
    case .failed:
      ContentUnavailableView {
        Label(store.localization.error, systemImage: "exclamationmark.triangle")
      } actions: {
        Button(store.localization.retry) {
          Task { await store.loadInitial() }
        }
      }
    case .loaded:
      if store.collection.comments.isEmpty {
        ContentUnavailableView {
          Label(store.localization.empty, systemImage: "bubble.left")
        } actions: {
          Button(store.localization.retry) {
            Task { await store.refresh() }
          }
        }
      } else {
        commentsList
      }
    }
  }

  private var commentsList: some View {
    List {
      if let inlineError = store.inlineError {
        CommentInlineErrorView(
          message: inlineError,
          dismissLabel: store.localization.done,
          onDismiss: store.dismissInlineError
        )
        .listRowSeparator(.hidden)
      }

      ForEach(store.collection.comments, id: \.identity) { comment in
        CommentRowView(comment: comment, store: store)
          .task(id: comment.id) {
            await store.loadMoreIfNeeded(lastVisibleCommentId: comment.id)
          }
      }

      if store.isLoadingMore {
        HStack {
          Spacer()
          ProgressView()
            .accessibilityLabel(store.localization.sending)
          Spacer()
        }
        .listRowSeparator(.hidden)
      } else if store.loadMoreFailed {
        Button {
          Task { await store.retryLoadMore() }
        } label: {
          Label(store.localization.loadMoreFailed, systemImage: "arrow.clockwise")
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .listRowSeparator(.hidden)
      }
    }
    .listStyle(.plain)
    .refreshable {
      await store.refresh()
    }
  }
}
