import ExpoModulesCore

public final class PhotoDetailModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoDetail")

    View(PhotoDetailView.self) {
      Events("onCommentsRequest", "onIndexChange", "onReactionRequest", "onRequestClose")

      Prop("photos") { (view: PhotoDetailView, photos: [MasonryPhoto]) in
        view.setPhotos(photos)
      }

      Prop("initialIndex") { (view: PhotoDetailView, index: Int) in
        view.setInitialIndex(index)
      }

      Prop("transitionId") { (view: PhotoDetailView, id: String) in
        view.setTransitionID(id)
      }

      Prop("metadataJSON") { (view: PhotoDetailView, json: String) in
        view.setMetadataJSON(json)
      }

      Prop("stringsJSON") { (view: PhotoDetailView, json: String) in
        view.setStringsJSON(json)
      }

      Prop("livePhotoStringsJSON") { (view: PhotoDetailView, json: String) in
        view.setLivePhotoStringsJSON(json)
      }

      Prop("commentCount") { (view: PhotoDetailView, count: Int) in
        view.setCommentCount(count)
      }

      Prop("reactionItemsJSON") { (view: PhotoDetailView, json: String) in
        view.setReactionItemsJSON(json)
      }

      Prop("reactionFailureNonce") { (view: PhotoDetailView, nonce: Double) in
        view.setReactionFailureNonce(nonce)
      }

      Prop("socialActionsEnabled") { (view: PhotoDetailView, enabled: Bool) in
        view.setSocialActionsEnabled(enabled)
      }
    }
  }
}
