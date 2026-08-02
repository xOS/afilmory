import ExpoModulesCore

struct MapPhoto: Record {
  @Field var accessibilityLabel: String = ""
  @Field var id: String = ""
  @Field var index: Int = 0
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  @Field var openAccessibilityLabel: String = ""
  @Field var subtitle: String = ""
  @Field var thumbnailUrl: String = ""
  @Field var title: String = ""
}

public class PhotoMapModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoMap")

    View(PhotoMapView.self) {
      Events("onClearFilters", "onPhotoPress", "onRetry", "onSignIn")

      Prop("photos") { (view: PhotoMapView, photos: [MapPhoto]) in
        view.setPhotos(photos)
      }

      Prop("state") { (view: PhotoMapView, state: String) in
        view.setState(state)
      }

      Prop("stringsJSON") { (view: PhotoMapView, json: String) in
        view.setStringsJSON(json)
      }
    }
  }
}
