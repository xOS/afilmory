import SwiftUI

struct PhotoSidebarFooterView: View {
  @ObservedObject var model: PhotoSidebarModel
  let onFiltersPress: () -> Void
  let onQuickFilterPress: (String) -> Void
  let onSearchChange: (String) -> Void
  let onTagPress: (String) -> Void

  var body: some View {
    let request = model.request
    VStack(alignment: .leading, spacing: 16) {
      HStack(spacing: 8) {
        Image(systemName: "magnifyingglass")
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
        TextField(
          request.localization.searchPlaceholder,
          text: $model.query
        )
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .submitLabel(.search)
        .onChange(of: model.query) { _, query in
          guard query != model.request.query else { return }
          onSearchChange(query)
        }
      }
      .padding(.horizontal, 12)
      .frame(minHeight: 38)
      .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
      .padding(.horizontal, 8)

      if !request.quickFilters.isEmpty {
        VStack(alignment: .leading, spacing: 2) {
          sectionHeader(request.localization.quickFilters)
          ForEach(request.quickFilters) { item in
            PhotoSidebarSelectionRow(
              accessibilityIdentifier: "photo-sidebar-quick-\(item.id)",
              item: item,
              notSelectedValue: request.localization.notSelected,
              selectedValue: request.localization.selected,
              action: { onQuickFilterPress(item.id) }
            )
          }
        }
      }

      if !request.tags.isEmpty || request.showsMoreTags {
        VStack(alignment: .leading, spacing: 2) {
          sectionHeader(request.localization.tags)
          ForEach(request.tags) { item in
            PhotoSidebarSelectionRow(
              accessibilityIdentifier: "photo-sidebar-tag-\(item.id)",
              item: item,
              notSelectedValue: request.localization.notSelected,
              selectedValue: request.localization.selected,
              action: { onTagPress(item.id) }
            )
          }
          if request.showsMoreTags {
            Button(action: onFiltersPress) {
              HStack(spacing: 10) {
                Image(systemName: "tag")
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
                  .frame(width: 20, alignment: .leading)
                  .accessibilityHidden(true)
                Text(request.localization.moreTags)
                  .font(.subheadline)
                  .foregroundStyle(.primary)
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                  .font(.caption.weight(.semibold))
                  .foregroundStyle(.tertiary)
                  .accessibilityHidden(true)
              }
              .padding(.horizontal, 12)
              .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("photo-sidebar-all-tags")
          }
        }
      }
    }
    .padding(.vertical, 12)
  }

  private func sectionHeader(_ title: String) -> some View {
    Text(title)
      .font(.caption.weight(.semibold))
      .foregroundStyle(.secondary)
      .padding(.horizontal, 12)
      .padding(.bottom, 2)
  }
}
