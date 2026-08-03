import Foundation
import Observation

enum PhotoFeedLoadState: Equatable, Sendable {
  case idle
  case loading
  case loaded
  case failed
}

@Observable
final class PhotoFeed {
  let key: PhotoFeedKey
  private(set) var photos: [GalleryPhoto] = []
  private(set) var studioPhotos: [StudioFeedPhoto] = []
  private(set) var loadState: PhotoFeedLoadState = .idle
  private(set) var lastError: String?

  @ObservationIgnored private var observers: [UUID: @MainActor () -> Void] = [:]

  init(key: PhotoFeedKey) {
    self.key = key
  }

  @MainActor
  func update(
    photos: [GalleryPhoto],
    studioPhotos: [StudioFeedPhoto] = [],
    state: PhotoFeedLoadState,
    error: String? = nil
  ) {
    self.photos = photos
    self.studioPhotos = studioPhotos
    loadState = state
    lastError = error
    for observer in observers.values {
      observer()
    }
  }

  @MainActor
  func observe(_ observer: @escaping @MainActor () -> Void) -> PhotoFeedObservationToken {
    let id = UUID()
    observers[id] = observer
    return PhotoFeedObservationToken { [weak self] in
      Task { @MainActor in
        self?.observers.removeValue(forKey: id)
      }
    }
  }
}

final class PhotoFeedObservationToken {
  private var cancellation: (() -> Void)?

  init(cancellation: @escaping () -> Void) {
    self.cancellation = cancellation
  }

  func cancel() {
    cancellation?()
    cancellation = nil
  }

  deinit {
    cancel()
  }
}

@MainActor
final class PhotoFeedStore {
  static let shared = PhotoFeedStore()

  private var feeds: [PhotoFeedKey: PhotoFeed] = [:]
  private var loads: [PhotoFeedKey: Task<Void, Never>] = [:]

  func feed(for key: PhotoFeedKey) -> PhotoFeed {
    if let feed = feeds[key] {
      return feed
    }
    let feed = PhotoFeed(key: key)
    feeds[key] = feed
    return feed
  }

  func load(_ key: PhotoFeedKey, force: Bool = false) {
    let feed = feed(for: key)
    if !force, feed.loadState == .loaded || loads[key] != nil {
      return
    }
    loads[key]?.cancel()
    feed.update(photos: feed.photos, studioPhotos: feed.studioPhotos, state: .loading)
    loads[key] = Task { [weak self, weak feed] in
      guard let self, let feed else { return }
      do {
        switch key {
        case .manifest(let slug):
          let origin = try ApiEnvironmentStore.shared.galleryOrigin(slug: slug)
          let apiBaseURL = try ApiEnvironmentStore.shared.galleryAPIBaseURL(slug: slug)
          let endpoint = APIEndpoint(baseURL: .explicit(apiBaseURL.absoluteString), path: "manifest")
          let response: ManifestEnvelope = try await AfilmoryAPI.shared.request(endpoint)
          let photos = ManifestDecoding.normalize(response.data, galleryOrigin: origin)
          guard !Task.isCancelled else { return }
          feed.update(photos: photos, state: .loaded)
        case .studioLibrary:
          let endpoint = APIEndpoint(baseURL: .tenant, path: "photos/assets")
          let assets: [StudioAsset] = try await AfilmoryAPI.shared.request(endpoint)
          let studioPhotos = StudioAssetDecoding.normalize(assets)
          guard !Task.isCancelled else { return }
          feed.update(photos: studioPhotos.map(\.photo), studioPhotos: studioPhotos, state: .loaded)
        }
      } catch {
        guard !Task.isCancelled else { return }
        feed.update(
          photos: feed.photos,
          studioPhotos: feed.studioPhotos,
          state: .failed,
          error: error.localizedDescription
        )
      }
      self.loads[key] = nil
    }
  }
}
