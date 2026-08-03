import ExpoModulesCore

struct MasonryPhoto: Record {
  @Field var accessibilityLabel: String = ""
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var originalUrl: String = ""
  @Field var thumbHash: String?
  @Field var aspectRatio: Double = 1
  @Field var width: Double = 0
  @Field var height: Double = 0
  @Field var livePhotoVideoUrl: String?

  var hasLivePhoto: Bool {
    guard let livePhotoVideoUrl else { return false }
    return !livePhotoVideoUrl.isEmpty
  }
}

extension MasonryPhoto {
  init(photo: GalleryPhoto, localization: Localization) {
    self.init()
    accessibilityLabel = localization.value(
      "photo.accessibility",
      arguments: ["id": photo.title.isEmpty ? photo.id : photo.title]
    )
    id = photo.id
    url = photo.thumbnailUrl
    originalUrl = photo.originalUrl
    thumbHash = photo.thumbHash
    aspectRatio = photo.aspectRatio
    width = photo.width
    height = photo.height
    livePhotoVideoUrl = photo.video?.livePhotoVideoURL
  }
}

public class PhotoMasonryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoMasonry")

    View(PhotoMasonryView.self) {
      Prop("feedKey") { (view: PhotoMasonryView, feedKey: String) in
        view.setFeedKey(feedKey)
      }

      Prop("appliesFilters") { (view: PhotoMasonryView, applies: Bool) in
        view.setAppliesFilters(applies)
      }
    }
  }
}
