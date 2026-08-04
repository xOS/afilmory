import ExpoModulesCore

public final class NativePagesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativePages")

    AsyncFunction("presentCommentsLab") { (outcome: String, latencyMs: Int) in
      await MainActor.run {
        CommentsLabPresenter.present(outcome: outcome, latencyMs: latencyMs)
      }
    }

    View(PageControllerHostView.self) {
      Events("onAuthChange", "onNavigate", "onRequestSignIn")

      Prop("page") { (view: PageControllerHostView, page: String) in
        view.setPage(page)
      }

      Prop("galleryRoute") { (view: PageControllerHostView, galleryRoute: String?) in
        view.setGalleryRoute(galleryRoute)
      }
    }
  }
}
