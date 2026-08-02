import SwiftUI

struct PhotoSidebarSelectionRow: View {
  let accessibilityIdentifier: String
  let item: PhotoSidebarItemRecord
  let notSelectedValue: String
  let selectedValue: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 10) {
        Image(systemName: "checkmark")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.tint)
          .frame(width: 20, alignment: .leading)
          .opacity(item.selected ? 1 : 0)
          .accessibilityHidden(true)

        Text(item.label)
          .font(.subheadline)
          .fontWeight(item.selected ? .semibold : .regular)
          .foregroundStyle(item.selected ? Color.accentColor : Color.primary)
          .lineLimit(1)

        Spacer(minLength: 8)

        Text(item.count, format: .number)
          .font(.caption)
          .foregroundStyle(.secondary)
          .monospacedDigit()
          .frame(minWidth: 36, alignment: .trailing)
      }
      .padding(.horizontal, 12)
      .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier(accessibilityIdentifier)
    .accessibilityValue(item.selected ? selectedValue : notSelectedValue)
  }
}
