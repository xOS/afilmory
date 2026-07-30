import SwiftUI

struct PhotoFilterSheetView: View {
  @ObservedObject var model: PhotoFilterViewModel

  var body: some View {
    Form {
      Section(model.localization.date) {
        Picker(model.localization.range, selection: $model.dateSelection) {
          Text(model.localization.anyDate).tag(PhotoFilterViewModel.noDate)
          ForEach(model.localization.datePresets) { preset in
            Text(preset.label).tag(preset.value)
          }
          Text(model.localization.customRange).tag(PhotoFilterViewModel.customDate)
        }

        if model.dateSelection == PhotoFilterViewModel.customDate {
          DatePicker(
            model.localization.from,
            selection: $model.dateFrom,
            in: ...model.dateTo,
            displayedComponents: .date
          )
          DatePicker(
            model.localization.to,
            selection: $model.dateTo,
            in: model.dateFrom...,
            displayedComponents: .date
          )
        }
      }

      if !model.options.tags.isEmpty {
        Section(model.localization.tags) {
          if model.tags.count > 1 {
            Picker(model.localization.match, selection: $model.tagMode) {
              Text(model.localization.any).tag("any")
              Text(model.localization.all).tag("all")
            }
            .pickerStyle(.segmented)
          }
          ForEach(model.options.tags) { option in
            SelectionRow(
              count: option.count,
              isSelected: model.tags.contains(option.value),
              notSelectedValue: model.localization.notSelected,
              selectedValue: model.localization.selected,
              title: option.value,
              onSelect: { model.toggleTag(option.value) }
            )
          }
        }
      }

      if !model.options.cameras.isEmpty {
        Section(model.localization.camera) {
          ForEach(model.options.cameras) { option in
            SelectionRow(
              count: option.count,
              isSelected: model.cameras.contains(option.value),
              notSelectedValue: model.localization.notSelected,
              selectedValue: model.localization.selected,
              title: option.value,
              onSelect: { model.toggleCamera(option.value) }
            )
          }
        }
      }

      if !model.options.lenses.isEmpty {
        Section(model.localization.lens) {
          ForEach(model.options.lenses) { option in
            SelectionRow(
              count: option.count,
              isSelected: model.lenses.contains(option.value),
              notSelectedValue: model.localization.notSelected,
              selectedValue: model.localization.selected,
              title: option.value,
              onSelect: { model.toggleLens(option.value) }
            )
          }
        }
      }

      if model.options.ratedCount > 0 {
        Section(model.localization.rating) {
          Picker(model.localization.minimumRating, selection: $model.minRating) {
            Text(model.localization.anyRating).tag(Int?.none)
            ForEach(1...5, id: \.self) { rating in
              Text(model.localization.ratingOptions[rating - 1]).tag(Int?.some(rating))
            }
          }
        }
      }

      if model.hasActiveFilters {
        Section {
          Button(model.localization.reset, role: .destructive, action: model.reset)
            .frame(maxWidth: .infinity, alignment: .center)
        }
      }
    }
  }
}

private struct SelectionRow: View {
  let count: Int
  let isSelected: Bool
  let notSelectedValue: String
  let selectedValue: String
  let title: String
  let onSelect: () -> Void

  var body: some View {
    Button(action: onSelect) {
      HStack(spacing: 12) {
        Image(systemName: "checkmark")
          .font(.body.weight(.semibold))
          .foregroundStyle(.tint)
          .frame(width: 20, alignment: .leading)
          .opacity(isSelected ? 1 : 0)
          .accessibilityHidden(true)

        Text(title)
          .foregroundStyle(.primary)

        Spacer()

        Text(count, format: .number)
          .foregroundStyle(.secondary)
          .monospacedDigit()
          .frame(minWidth: 36, alignment: .trailing)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityValue(isSelected ? selectedValue : notSelectedValue)
  }
}
