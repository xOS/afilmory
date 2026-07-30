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
  @Field var isLive: Bool = false
}

public class PhotoMasonryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoMasonry")

    View(PhotoMasonryView.self) {
      Events(
        "onPhotoPress",
        "onVisibleRangeChange",
        "onScrollBeyondThreshold",
        "onColumnCountChange",
        "onRefresh",
        "onDatePress",
        "onProfilePress",
        "onFilterPress"
      )

      Prop("photos") { (view: PhotoMasonryView, photos: [MasonryPhoto]) in
        view.setPhotos(photos)
      }

      Prop("defaultColumnCount") { (view: PhotoMasonryView, count: Int) in
        view.defaultColumnCount = count
      }

      Prop("gap") { (view: PhotoMasonryView, gap: Double) in
        view.gap = CGFloat(gap)
      }

      Prop("extraTopInset") { (view: PhotoMasonryView, inset: Double) in
        view.extraTopInset = CGFloat(inset)
      }

      Prop("extraBottomInset") { (view: PhotoMasonryView, inset: Double) in
        view.extraBottomInset = CGFloat(inset)
      }

      Prop("scrollThreshold") { (view: PhotoMasonryView, threshold: Double) in
        view.scrollThreshold = CGFloat(threshold)
      }

      Prop("refreshing") { (view: PhotoMasonryView, refreshing: Bool) in
        view.setRefreshing(refreshing)
      }

      Prop("chromeVisible") { (view: PhotoMasonryView, visible: Bool) in
        view.chromeVisible = visible
      }

      Prop("chromeDateLabel") { (view: PhotoMasonryView, label: String) in
        view.chromeDateLabel = label
      }

      Prop("chromeDateDetail") { (view: PhotoMasonryView, detail: String) in
        view.chromeDateDetail = detail
      }

      Prop("chromeDateVisible") { (view: PhotoMasonryView, visible: Bool) in
        view.chromeDateVisible = visible
      }

      Prop("chromeDateInteractive") { (view: PhotoMasonryView, interactive: Bool) in
        view.chromeDateInteractive = interactive
      }

      Prop("profileImageURL") { (view: PhotoMasonryView, url: String) in
        view.profileImageURL = url
      }

      Prop("profileInitial") { (view: PhotoMasonryView, initial: String) in
        view.profileInitial = initial
      }

      Prop("profileAccessibilityLabel") { (view: PhotoMasonryView, label: String) in
        view.profileAccessibilityLabel = label
      }

      Prop("filterActive") { (view: PhotoMasonryView, active: Bool) in
        view.filterActive = active
      }

      Prop("filterAccessibilityLabel") { (view: PhotoMasonryView, label: String) in
        view.filterAccessibilityLabel = label
      }

      Prop("filterCount") { (view: PhotoMasonryView, count: Int) in
        view.filterCount = count
      }
    }
  }
}
