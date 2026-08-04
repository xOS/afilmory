import Combine

final class PhotoSidebarModel: ObservableObject {
  @Published private(set) var request: PhotoSidebarRequest = .init()
  @Published var query = ""

  func update(_ request: PhotoSidebarRequest) {
    self.request = request
    if query != request.query {
      query = request.query
    }
  }
}
