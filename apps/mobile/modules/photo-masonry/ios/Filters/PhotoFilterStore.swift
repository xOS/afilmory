import Foundation
import Observation

@Observable
final class PhotoFilterStore {
  static let shared = PhotoFilterStore()

  private(set) var filters = PhotoFilters.empty
  @ObservationIgnored private var observers: [UUID: () -> Void] = [:]

  func replace(_ filters: PhotoFilters, now: Date = .now, calendar: Calendar = .current) {
    guard let preset = filters.datePreset else {
      self.filters = filters
      notifyObservers()
      return
    }
    let range = PhotoFilterEngine.presetRange(preset, now: now, calendar: calendar)
    var resolved = filters
    resolved.dateFrom = range.from
    resolved.dateTo = range.to
    self.filters = resolved
    notifyObservers()
  }

  func clear() {
    filters = .empty
    notifyObservers()
  }

  func observe(_ observer: @escaping () -> Void) -> PhotoFeedObservationToken {
    let id = UUID()
    observers[id] = observer
    return PhotoFeedObservationToken { [weak self] in
      self?.observers.removeValue(forKey: id)
    }
  }

  private func notifyObservers() {
    for observer in observers.values {
      observer()
    }
  }
}
