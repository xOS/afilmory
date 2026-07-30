import ExpoModulesCore

public class PhotoViewerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoViewer")

    View(PhotoViewerView.self) {
      Events("onIndexChange")

      Prop("photos") { (view: PhotoViewerView, photos: [MasonryPhoto]) in
        view.setPhotos(photos)
      }

      Prop("initialIndex") { (view: PhotoViewerView, index: Int) in
        view.initialIndex = index
      }

      Prop("transitionId") { (view: PhotoViewerView, id: String) in
        view.transitionId = id
      }

    }
  }
}
