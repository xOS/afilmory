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
        "onFilterPress",
        "onPhotoContextMenuAction",
        "onSelectionChange",
        "onSelectionModeChange"
      )

      Prop("photos") { (view: PhotoMasonryView, photos: [MasonryPhoto]) in
        view.setPhotos(photos)
      }

      Prop("contextMenuInfoTitle") { (view: PhotoMasonryView, title: String) in
        view.contextMenuInfoTitle = title
      }

      Prop("contextMenuShareTitle") { (view: PhotoMasonryView, title: String) in
        view.contextMenuShareTitle = title
      }

      Prop("contextMenuSelectTitle") { (view: PhotoMasonryView, title: String?) in
        view.contextMenuSelectTitle = title ?? ""
      }

      Prop("defaultColumnCount") { (view: PhotoMasonryView, count: Int) in
        view.defaultColumnCount = count
      }

      Prop("preferredItemWidth") { (view: PhotoMasonryView, width: Double) in
        view.preferredItemWidth = CGFloat(width)
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

      Prop("chromeIdentityLabel") { (view: PhotoMasonryView, label: String) in
        view.chromeIdentityLabel = label
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

      Prop("livePhotoAccessibilityLabel") { (view: PhotoMasonryView, label: String) in
        view.livePhotoAccessibilityLabel = label
      }

      Prop("selectionEnabled") { (view: PhotoMasonryView, enabled: Bool) in
        view.selectionEnabled = enabled
      }

      Prop("selectionMode") { (view: PhotoMasonryView, active: Bool) in
        view.setSelectionMode(active)
      }

      Prop("selectedPhotoIds") { (view: PhotoMasonryView, ids: [String]) in
        view.setSelectedPhotoIds(ids)
      }
    }
  }
}
