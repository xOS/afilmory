import SwiftUI

struct PhotoSidebarBottomBarView: View {
  @ObservedObject var model: PhotoSidebarModel
  let onClearFilters: () -> Void
  let onFiltersPress: () -> Void

  var body: some View {
    let request = model.request
    HStack(spacing: 8) {
      Button(action: onFiltersPress) {
        HStack(spacing: 8) {
          Image(systemName: "magnifyingglass")
            .accessibilityHidden(true)
          Text(request.localization.filters)
            .lineLimit(1)
          Spacer(minLength: 4)
          if request.activeFilterCount > 0 {
            Text(request.activeFilterCount, format: .number)
              .font(.caption2.bold())
              .foregroundStyle(.white)
              .monospacedDigit()
              .padding(.horizontal, 6)
              .padding(.vertical, 2)
              .background(Color.accentColor, in: Capsule())
          }
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
      .accessibilityIdentifier("photo-sidebar-filters")

      if request.activeFilterCount > 0 {
        Button(action: onClearFilters) {
          Label(request.localization.clearFilters, systemImage: "xmark.circle.fill")
            .labelStyle(.iconOnly)
        }
        .buttonStyle(.borderless)
        .accessibilityIdentifier("photo-sidebar-clear")
        .accessibilityLabel(request.localization.clearFilters)
      }
    }
    .padding(12)
    .overlay(alignment: .top) {
      Divider()
    }
  }
}
