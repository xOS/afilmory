import ExpoModulesCore

public class PhotoViewerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoViewer")

    View(PhotoViewerView.self) {
      Events("onIndexChange", "onInfoGesture", "onInfoRequest", "onRequestClose")

      Prop("photos") { (view: PhotoViewerView, photos: [MasonryPhoto]) in
        view.setPhotos(photos)
      }

      Prop("initialIndex") { (view: PhotoViewerView, index: Int) in
        view.initialIndex = index
      }

      Prop("transitionId") { (view: PhotoViewerView, id: String) in
        view.transitionId = id
      }

      Prop("keyboardCloseTitle") { (view: PhotoViewerView, title: String) in
        view.keyboardCloseTitle = title
      }

      Prop("keyboardInfoTitle") { (view: PhotoViewerView, title: String) in
        view.keyboardInfoTitle = title
      }

      Prop("keyboardNextTitle") { (view: PhotoViewerView, title: String) in
        view.keyboardNextTitle = title
      }

      Prop("keyboardPreviousTitle") { (view: PhotoViewerView, title: String) in
        view.keyboardPreviousTitle = title
      }

      Prop("livePhotoStringsJSON") { (view: PhotoViewerView, json: String) in
        view.livePhotoStringsJSON = json
      }

      Prop("infoPresented") { (view: PhotoViewerView, presented: Bool) in
        view.infoPresented = presented
      }

      Prop("interactiveDismissEnabled") { (view: PhotoViewerView, enabled: Bool) in
        view.interactiveDismissEnabled = enabled
      }

    }
  }
}
