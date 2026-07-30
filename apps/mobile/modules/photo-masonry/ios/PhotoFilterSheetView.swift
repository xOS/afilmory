import SwiftUI

struct PhotoFilterSheetView: View {
  @ObservedObject var model: PhotoFilterViewModel

  private let datePresets: [(value: String, label: String)] = [
    ("last7", "Last 7 Days"),
    ("last30", "Last 30 Days"),
    ("last90", "Last 90 Days"),
    ("thisMonth", "This Month"),
    ("thisYear", "This Year"),
    ("lastYear", "Last Year"),
  ]

  var body: some View {
    Form {
      Section("Date") {
        Picker("Range", selection: $model.dateSelection) {
          Text("Any Date").tag(PhotoFilterViewModel.noDate)
          ForEach(datePresets, id: \.value) { preset in
            Text(preset.label).tag(preset.value)
          }
          Text("Custom Range").tag(PhotoFilterViewModel.customDate)
        }

        if model.dateSelection == PhotoFilterViewModel.customDate {
          DatePicker("From", selection: $model.dateFrom, in: ...model.dateTo, displayedComponents: .date)
          DatePicker("To", selection: $model.dateTo, in: model.dateFrom..., displayedComponents: .date)
        }
      }

      if !model.options.tags.isEmpty {
        Section("Tags") {
          if model.tags.count > 1 {
            Picker("Match", selection: $model.tagMode) {
              Text("Any").tag("any")
              Text("All").tag("all")
            }
            .pickerStyle(.segmented)
          }
          ForEach(model.options.tags) { option in
            SelectionRow(
              count: option.count,
              isSelected: model.tags.contains(option.value),
              title: option.value,
              onSelect: { model.toggleTag(option.value) }
            )
          }
        }
      }

      if !model.options.cameras.isEmpty {
        Section("Camera") {
          ForEach(model.options.cameras) { option in
            SelectionRow(
              count: option.count,
              isSelected: model.cameras.contains(option.value),
              title: option.value,
              onSelect: { model.toggleCamera(option.value) }
            )
          }
        }
      }

      if !model.options.lenses.isEmpty {
        Section("Lens") {
          ForEach(model.options.lenses) { option in
            SelectionRow(
              count: option.count,
              isSelected: model.lenses.contains(option.value),
              title: option.value,
              onSelect: { model.toggleLens(option.value) }
            )
          }
        }
      }

      if model.options.ratedCount > 0 {
        Section("Rating") {
          Picker("Minimum Rating", selection: $model.minRating) {
            Text("Any Rating").tag(Int?.none)
            ForEach(1...5, id: \.self) { rating in
              Text("\(rating) Star\(rating == 1 ? "" : "s") or Better").tag(Int?.some(rating))
            }
          }
        }
      }

      if model.hasActiveFilters {
        Section {
          Button("Reset Filters", role: .destructive, action: model.reset)
            .frame(maxWidth: .infinity, alignment: .center)
        }
      }
    }
  }
}

private struct SelectionRow: View {
  let count: Int
  let isSelected: Bool
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
    .accessibilityValue(isSelected ? "Selected" : "Not selected")
  }
}
