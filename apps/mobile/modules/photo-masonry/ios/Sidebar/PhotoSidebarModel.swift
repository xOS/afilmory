import Combine

final class PhotoSidebarModel: ObservableObject {
  @Published private(set) var request: PhotoSidebarRequest = .init()

  func update(_ request: PhotoSidebarRequest) {
    self.request = request
  }
}
