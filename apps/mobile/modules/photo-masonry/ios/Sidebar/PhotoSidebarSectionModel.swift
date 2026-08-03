import Foundation

enum PhotoSidebarQuickFilterID: String, Equatable, Sendable {
  case rating4
  case thisMonth
  case thisYear
}

struct PhotoSidebarItem: Equatable, Identifiable, Sendable {
  let count: Int
  let id: String
  let label: String
  let selected: Bool
}

struct PhotoSidebarQuickFilterLabels: Equatable, Sendable {
  let rating4: String
  let thisMonth: String
  let thisYear: String
}

struct PhotoSidebarTagItems: Equatable, Sendable {
  let hasMore: Bool
  let items: [PhotoSidebarItem]
}

enum PhotoSidebarSectionModel {
  static func quickFilters(
    photos: [GalleryPhoto],
    filters: PhotoFilters,
    labels: PhotoSidebarQuickFilterLabels,
    now: Date = .now,
    calendar: Calendar = .current
  ) -> [PhotoSidebarItem] {
    let month = PhotoFilterEngine.presetRange(.thisMonth, now: now, calendar: calendar)
    let year = PhotoFilterEngine.presetRange(.thisYear, now: now, calendar: calendar)
    let items = [
      PhotoSidebarItem(
        count: countDates(photos, from: month.from, to: month.to),
        id: PhotoSidebarQuickFilterID.thisMonth.rawValue,
        label: labels.thisMonth,
        selected: filters.datePreset == .thisMonth
      ),
      PhotoSidebarItem(
        count: countDates(photos, from: year.from, to: year.to),
        id: PhotoSidebarQuickFilterID.thisYear.rawValue,
        label: labels.thisYear,
        selected: filters.datePreset == .thisYear
      ),
      PhotoSidebarItem(
        count: photos.count { ($0.rating ?? -1) >= 4 },
        id: PhotoSidebarQuickFilterID.rating4.rawValue,
        label: labels.rating4,
        selected: filters.minRating == 4
      ),
    ]
    return items.filter { $0.count > 0 || $0.selected }
  }

  static func tags(
    options: [PhotoFilterOption],
    selectedTags: [String],
    limit: Int = 8
  ) -> PhotoSidebarTagItems {
    let optionByValue = Dictionary(uniqueKeysWithValues: options.map { ($0.value, $0) })
    let selected = selectedTags.map { value in
      PhotoSidebarItem(
        count: optionByValue[value]?.count ?? 0,
        id: value,
        label: value,
        selected: true
      )
    }
    let selectedSet = Set(selectedTags)
    let available = options.filter { !selectedSet.contains($0.value) }
    let remainingSlots = max(0, limit - selected.count)
    let availableItems = available.prefix(remainingSlots).map { option in
      PhotoSidebarItem(
        count: option.count,
        id: option.value,
        label: option.value,
        selected: false
      )
    }
    return PhotoSidebarTagItems(
      hasMore: available.count > remainingSlots,
      items: selected + availableItems
    )
  }

  private static func countDates(_ photos: [GalleryPhoto], from: String, to: String) -> Int {
    photos.count { photo in
      guard let date = photo.dateTaken.map({ String($0.prefix(10)) }) else { return false }
      return date >= from && date <= to
    }
  }
}
