import ExpoModulesCore
import SDWebImage
import UIKit

struct FeaturedGalleryAuthor: Decodable, Hashable, Sendable {
  let name: String
  let avatar: String?
}

struct FeaturedGallery: Decodable, Hashable, Sendable {
  let id: String
  let name: String
  let slug: String
  let domain: String?
  let description: String?
  let author: FeaturedGalleryAuthor?
  let photoCount: Int
  let tags: [String]
  let createdAt: String
  let lastUpload: String?
}

struct GalleryCoverPhoto: Hashable, Sendable {
  let id: String
  let thumbnailUrl: String
  let thumbHash: String?
  let aspectRatio: Double
  let isLivePhoto: Bool
}

private struct FeaturedGalleriesEnvelope: Decodable, Sendable {
  let galleries: [FeaturedGallery]
}

private struct GalleryCoverSearchRequest: Encodable {
  let limit: Int
  let sort: String
}

final class GalleriesController: UIViewController {
  let appContext: AppContext?

  private let localization = Localization.shared
  private let onRequestSignIn: () -> Void
  private let layout = UICollectionViewFlowLayout()
  private lazy var collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
  private let refreshControl = UIRefreshControl()
  private var galleries: [FeaturedGallery] = []
  private var coverCache: [String: [GalleryCoverPhoto]] = [:]
  private var coverTasks: [String: Task<Void, Never>] = [:]
  private var loadTask: Task<Void, Never>?
  private var previousLayoutWidth: CGFloat = 0

  init(appContext: AppContext?, onRequestSignIn: @escaping () -> Void) {
    self.appContext = appContext
    self.onRequestSignIn = onRequestSignIn
    super.init(nibName: nil, bundle: nil)
    title = localization.value("tabs.explore")
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  deinit {
    loadTask?.cancel()
    coverTasks.values.forEach { $0.cancel() }
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    collectionView.backgroundColor = .systemGroupedBackground
    collectionView.alwaysBounceVertical = true
    collectionView.contentInsetAdjustmentBehavior = .automatic
    collectionView.showsVerticalScrollIndicator = false
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.prefetchDataSource = self
    collectionView.register(
      GalleryCardCell.self,
      forCellWithReuseIdentifier: GalleryCardCell.reuseIdentifier
    )
    refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)
    collectionView.refreshControl = refreshControl
    collectionView.frame = view.bounds
    collectionView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(collectionView)
    loadGalleries()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let width = collectionView.bounds.width
    guard abs(width - previousLayoutWidth) >= 0.5 else { return }
    previousLayoutWidth = width
    configureLayout(width: width)
  }

  @objc private func refresh() {
    loadGalleries(force: true)
  }

  private func loadGalleries(force: Bool = false) {
    if loadTask != nil, !force { return }
    loadTask?.cancel()
    if galleries.isEmpty {
      contentUnavailableConfiguration = UIContentUnavailableConfiguration.loading()
    }
    loadTask = Task { @MainActor [weak self] in
      guard let self else { return }
      do {
        let endpoint = APIEndpoint(
          baseURL: .platform,
          path: "featured-galleries",
          retryPolicy: .transientGET(maxAttempts: 2, delay: 0.25)
        )
        let response: FeaturedGalleriesEnvelope = try await AfilmoryAPI.shared.request(endpoint)
        try Task.checkCancellation()
        galleries = response.galleries
        collectionView.reloadData()
        contentUnavailableConfiguration = galleries.isEmpty ? emptyConfiguration() : nil
        prefetchVisibleCovers()
      } catch {
        guard !Task.isCancelled else { return }
        if galleries.isEmpty {
          contentUnavailableConfiguration = errorConfiguration()
        }
      }
      refreshControl.endRefreshing()
      loadTask = nil
    }
  }

  private func loadCovers(for gallery: FeaturedGallery) {
    guard coverCache[gallery.slug] == nil, coverTasks[gallery.slug] == nil else { return }
    coverTasks[gallery.slug] = Task { @MainActor [weak self] in
      guard let self else { return }
      defer { coverTasks[gallery.slug] = nil }
      do {
        let origin = try ApiEnvironmentStore.shared.galleryOrigin(slug: gallery.slug)
        let apiBase = try ApiEnvironmentStore.shared.galleryAPIBaseURL(slug: gallery.slug)
        let body = try APIEndpoint.jsonBody(GalleryCoverSearchRequest(limit: 3, sort: "desc"))
        let endpoint = APIEndpoint(
          baseURL: .explicit(apiBase.absoluteString),
          path: "manifest/photos/search",
          method: .post,
          body: body
        )
        let response: ManifestEnvelope = try await AfilmoryAPI.shared.request(endpoint)
        try Task.checkCancellation()
        let covers = response.data.compactMap { photo -> GalleryCoverPhoto? in
          guard let thumbnailUrl = photo.thumbnailUrl?.trimmingToNil else { return nil }
          let width = photo.width ?? 0
          let height = photo.height ?? 0
          let video = ManifestDecoding.normalizeVideo(photo.video, baseURL: origin)
          let isLivePhoto: Bool
          if case .livePhoto = video {
            isLivePhoto = true
          } else {
            isLivePhoto = false
          }
          return GalleryCoverPhoto(
            id: photo.id,
            thumbnailUrl: thumbnailUrl,
            thumbHash: photo.thumbHash,
            aspectRatio: photo.aspectRatio ?? (width > 0 && height > 0 ? width / height : 1),
            isLivePhoto: isLivePhoto
          )
        }
        coverCache[gallery.slug] = covers
        guard let index = galleries.firstIndex(where: { $0.id == gallery.id }) else { return }
        collectionView.reloadItems(at: [IndexPath(item: index, section: 0)])
      } catch {
        guard !Task.isCancelled else { return }
        coverCache[gallery.slug] = []
      }
    }
  }

  private func prefetchVisibleCovers() {
    for indexPath in collectionView.indexPathsForVisibleItems {
      guard galleries.indices.contains(indexPath.item) else { continue }
      loadCovers(for: galleries[indexPath.item])
    }
  }

  private func configureLayout(width: CGFloat) {
    let horizontalPadding: CGFloat = width >= 1000 ? 28 : width >= 600 ? 20 : 16
    let gap: CGFloat = width < 600 ? 14 : 16
    let availableWidth = max(0, width - horizontalPadding * 2)
    let columns = max(1, min(3, Int(floor((availableWidth + gap) / (300 + gap)))))
    let itemWidth = floor((availableWidth - CGFloat(columns - 1) * gap) / CGFloat(columns))
    layout.minimumInteritemSpacing = gap
    layout.minimumLineSpacing = gap
    layout.sectionInset = UIEdgeInsets(top: 12, left: horizontalPadding, bottom: 120, right: horizontalPadding)
    layout.itemSize = CGSize(width: itemWidth, height: GalleryCardCell.preferredHeight(for: itemWidth))
    layout.invalidateLayout()
  }

  private func errorConfiguration() -> UIContentUnavailableConfiguration {
    var configuration = UIContentUnavailableConfiguration.empty()
    configuration.image = UIImage(systemName: "exclamationmark.triangle")
    configuration.text = localization.value("gallery.failed.galleries")
    configuration.secondaryText = localization.value("gallery.failed.detail")
    configuration.button = .filled()
    configuration.button.title = localization.value("common.retry")
    configuration.buttonProperties.primaryAction = UIAction { [weak self] _ in
      self?.loadGalleries(force: true)
    }
    return configuration
  }

  private func emptyConfiguration() -> UIContentUnavailableConfiguration {
    var configuration = UIContentUnavailableConfiguration.empty()
    configuration.image = UIImage(systemName: "rectangle.stack")
    configuration.text = localization.value("gallery.empty.title")
    return configuration
  }
}

extension GalleriesController: UICollectionViewDataSource, UICollectionViewDelegate {
  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
    galleries.count
  }

  func collectionView(
    _ collectionView: UICollectionView,
    cellForItemAt indexPath: IndexPath
  ) -> UICollectionViewCell {
    guard let cell = collectionView.dequeueReusableCell(
      withReuseIdentifier: GalleryCardCell.reuseIdentifier,
      for: indexPath
    ) as? GalleryCardCell else {
      return UICollectionViewCell()
    }
    let gallery = galleries[indexPath.item]
    cell.configure(
      gallery: gallery,
      covers: coverCache[gallery.slug],
      photoCount: localization.value("gallery.photos", count: gallery.photoCount),
      accessibilityLabel: localization.value(
        "accessibility.openGallery",
        arguments: ["name": gallery.name]
      )
    )
    loadCovers(for: gallery)
    return cell
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: true)
    guard galleries.indices.contains(indexPath.item) else { return }
    let gallery = galleries[indexPath.item]
    navigationController?.pushViewController(
      GalleryDetailController(
        slug: gallery.slug,
        title: gallery.name,
        appContext: appContext,
        onRequestSignIn: onRequestSignIn
      ),
      animated: true
    )
  }
}

extension GalleriesController: UICollectionViewDataSourcePrefetching {
  func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
    for indexPath in indexPaths where galleries.indices.contains(indexPath.item) {
      loadCovers(for: galleries[indexPath.item])
    }
  }

  func collectionView(_ collectionView: UICollectionView, cancelPrefetchingForItemsAt indexPaths: [IndexPath]) {
    let visibleSlugs = Set(collectionView.indexPathsForVisibleItems.compactMap { indexPath in
      galleries.indices.contains(indexPath.item) ? galleries[indexPath.item].slug : nil
    })
    for indexPath in indexPaths where galleries.indices.contains(indexPath.item) {
      let slug = galleries[indexPath.item].slug
      guard !visibleSlugs.contains(slug) else { continue }
      coverTasks[slug]?.cancel()
      coverTasks[slug] = nil
    }
  }
}
