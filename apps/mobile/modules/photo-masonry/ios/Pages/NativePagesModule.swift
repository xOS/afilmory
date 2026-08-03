import ExpoModulesCore

public final class NativePagesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativePages")

    View(PageControllerHostView.self) {
      Events("onRequestSignIn")

      Prop("page") { (view: PageControllerHostView, page: String) in
        view.setPage(page)
      }
    }
  }
}
