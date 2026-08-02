import SwiftUI

struct CommentSignInView: View {
  let store: CommentsStore

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "person.crop.circle")
        .font(.title3)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
      Text(store.requiresAuthentication ? store.localization.reauthenticate : store.localization.loginRequired)
        .font(.footnote)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
      Button(store.localization.signIn) {
        store.requestSignIn()
      }
      .buttonStyle(.borderedProminent)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 10)
    .background(.bar)
  }
}
