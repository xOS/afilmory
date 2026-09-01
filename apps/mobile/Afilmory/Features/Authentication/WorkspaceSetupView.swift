import SwiftUI

struct WorkspaceSetupView: View {
  @FocusState private var focusedField: Field?
  @State private var busy = false
  @State private var error: String?
  @State private var name = ""
  @State private var slug = ""
  @State private var slugEdited = false
  @State private var slugFieldVisible = false
  @State private var step = Step.name
  @State private var workspaceName = ""

  let mode: WorkspaceSetupMode

  private enum Field {
    case name
    case slug
    case workspaceName
  }

  private enum Step {
    case name
    case review
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        switch mode {
        case .create:
          switch step {
          case .name:
            nameContent
          case .review:
            reviewContent
          }
        case .waiting(let workspaceName, let workspaceSlug):
          waitingContent(name: workspaceName, slug: workspaceSlug)
        }
      }
      .navigationTitle(navigationTitle)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        toolbarContent
      }
      .task {
        if case .create = mode {
          applyAccountDefaultsIfNeeded()
          focusedField = .name
        }
      }
    }
  }

  private var navigationTitle: String {
    switch mode {
    case .create:
      switch step {
      case .name:
        String(localized: "Your name")
      case .review:
        String(localized: "New workspace")
      }
    case .waiting:
      String(localized: "Workspace setup")
    }
  }

  private var nameContent: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 8) {
        Text("What should we call you?")
          .font(.system(size: 24, weight: .bold))
        Text("This becomes the public name of your first gallery. You can edit it now.")
          .font(.system(size: 15))
          .foregroundStyle(.secondary)
          .lineSpacing(3)
      }

      VStack(alignment: .leading, spacing: 7) {
        Text("Name")
          .font(.system(size: 13, weight: .semibold))
        TextField(String(localized: "Ada"), text: $name)
          .submitLabel(slugFieldVisible ? .next : .continue)
          .focused($focusedField, equals: .name)
          .onChange(of: name) { _, value in
            if !slugEdited {
              slug = WorkspaceOnboardingDefaults.normalizeSlug(value)
            }
          }
          .onSubmit {
            if slugFieldVisible {
              focusedField = .slug
            } else {
              continueFromName()
            }
          }
          .afilmoryWorkspaceField()
      }

      if slugFieldVisible {
        slugField(submit: continueFromName)
      }

      if let error {
        Text(error)
          .font(.system(size: 13))
          .foregroundStyle(.red)
          .accessibilityAddTraits(.isStaticText)
      }
    }
    .padding(24)
    .padding(.bottom, 16)
  }

  private var reviewContent: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Create your gallery workspace")
          .font(.system(size: 24, weight: .bold))
        Text("Confirm the public name and URL identifier. Advanced configuration remains available in Studio.")
          .font(.system(size: 15))
          .foregroundStyle(.secondary)
          .lineSpacing(3)
      }

      VStack(alignment: .leading, spacing: 18) {
        VStack(alignment: .leading, spacing: 7) {
          Text("Workspace name")
            .font(.system(size: 13, weight: .semibold))
          TextField(String(localized: "My photography"), text: $workspaceName)
            .submitLabel(.next)
            .focused($focusedField, equals: .workspaceName)
            .onSubmit { focusedField = .slug }
            .afilmoryWorkspaceField()
        }
        slugField(submit: submit)
      }

      if let error {
        Text(error)
          .font(.system(size: 13))
          .foregroundStyle(.red)
          .accessibilityAddTraits(.isStaticText)
      }
    }
    .padding(24)
    .padding(.bottom, 16)
  }

  private func slugField(submit: @escaping () -> Void) -> some View {
    VStack(alignment: .leading, spacing: 7) {
      Text("URL identifier")
        .font(.system(size: 13, weight: .semibold))
      TextField("my-gallery", text: $slug)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .submitLabel(.done)
        .focused($focusedField, equals: .slug)
        .onChange(of: slug) { _, value in
          let normalized = WorkspaceOnboardingDefaults.normalizeSlug(value)
          slugEdited = true
          if normalized != value { slug = normalized }
        }
        .onSubmit(submit)
        .afilmoryWorkspaceField()
      Text("Lowercase letters, numbers, and hyphens only. At least three characters.")
        .font(.system(size: 12))
        .foregroundStyle(.tertiary)
    }
  }

  private func waitingContent(name: String, slug: String) -> some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Your workspace is still being set up")
          .font(.system(size: 24, weight: .bold))
        Text("“\(name)” is not ready yet. Sign out and come back later, or continue from another device.")
          .font(.system(size: 15))
          .foregroundStyle(.secondary)
          .lineSpacing(3)
      }

      VStack(alignment: .leading, spacing: 6) {
        Text(name)
          .font(.system(size: 17, weight: .semibold))
        Text(slug)
          .font(.system(size: 14, design: .monospaced))
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(18)
      .background(Color(uiColor: .secondarySystemBackground))
      .clipShape(.rect(cornerRadius: 16, style: .continuous))

    }
    .padding(24)
    .padding(.bottom, 16)
  }

  @ToolbarContentBuilder
  private var toolbarContent: some ToolbarContent {
    switch mode {
    case .create:
      switch step {
      case .name:
        ToolbarItem(placement: .cancellationAction) {
          Button(String(localized: "Sign out"), action: signOut)
            .disabled(busy)
        }
        ToolbarItem(placement: .confirmationAction) {
          if busy {
            ProgressView()
          } else {
            Button(String(localized: "Continue"), action: continueFromName)
          }
        }
      case .review:
        ToolbarItem(placement: .cancellationAction) {
          Button(String(localized: "Back")) {
            step = .name
            error = nil
            focusedField = .name
          }
          .disabled(busy)
        }
        ToolbarItem(placement: .confirmationAction) {
          if busy {
            ProgressView()
          } else {
            Button(String(localized: "Create"), action: submit)
          }
        }
      }
    case .waiting:
      ToolbarItem(placement: .cancellationAction) {
        Button(String(localized: "Sign out"), action: signOut)
      }
    }
  }

  private func signOut() {
    Task { @MainActor in
      await NativeAuthenticationService.shared.signOut()
    }
  }

  private func continueFromName() {
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedName.isEmpty else {
      error = String(localized: "Enter your name to continue.")
      return
    }
    let requestedSlug = WorkspaceOnboardingDefaults.normalizeSlug(slugEdited ? slug : trimmedName)
    if requestedSlug.count < WorkspaceSlugResolver.minimumLength {
      slugFieldVisible = true
      error = String(localized: "Choose a URL identifier of at least three characters.")
      focusedField = .slug
      return
    }
    guard !busy else { return }
    busy = true
    error = nil
    Task { @MainActor in
      defer { busy = false }
      do {
        let resolved: String?
        if slugEdited, slugFieldVisible {
          switch try await NativeAuthenticationService.shared.checkWorkspaceSlug(requestedSlug) {
          case .available(let slug):
            resolved = slug
          case .unavailable(let message):
            slugFieldVisible = true
            error = message
            focusedField = .slug
            return
          }
        } else {
          resolved = try await NativeAuthenticationService.shared.resolveAvailableWorkspaceSlug(from: trimmedName)
        }
        guard let resolved else {
          slugFieldVisible = true
          slug = requestedSlug
          slugEdited = true
          error = String(localized: "That URL identifier is reserved or already in use. Enter a different one.")
          focusedField = .slug
          return
        }
        name = trimmedName
        workspaceName = WorkspaceOnboardingDefaults.siteName(from: trimmedName)
        slug = resolved
        step = .review
        focusedField = .workspaceName
      } catch {
        self.error = String(localized: "The URL identifier could not be checked. Please try again.")
      }
    }
  }

  private func submit() {
    let siteDefaults = WorkspaceOnboardingDefaults.make(
      name: name,
      email: AfilmorySessionStore.shared.current().state.session?.user.email ?? ""
    )
    let normalizedName = workspaceName.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedSlug = WorkspaceOnboardingDefaults.normalizeSlug(slug)
    guard !normalizedName.isEmpty, normalizedSlug.count >= WorkspaceSlugResolver.minimumLength else {
      error = String(localized: "Enter a name and a URL identifier of at least three characters.")
      return
    }
    guard !busy else { return }
    busy = true
    error = nil
    Task { @MainActor in
      defer { busy = false }
      do {
        switch try await NativeAuthenticationService.shared.checkWorkspaceSlug(normalizedSlug) {
        case .available:
          break
        case .unavailable(let message):
          self.error = message
          return
        }
        try await NativeAuthenticationService.shared.createWorkspace(
          name: normalizedName,
          slug: normalizedSlug,
          settings: siteDefaults.siteSettings(for: normalizedName)
        )
      } catch {
        self.error = String(localized: "The workspace could not be created. The identifier may already be in use.")
      }
    }
  }

  private var accountDefaults: WorkspaceOnboardingDefaults {
    AfilmorySessionStore.shared.current().state.session?.workspaceOnboardingDefaults
      ?? WorkspaceOnboardingDefaults.make(name: "", email: "")
  }

  private func applyAccountDefaultsIfNeeded() {
    guard name.isEmpty, slug.isEmpty else { return }
    let defaults = accountDefaults
    name = defaults.displayName
    slug = defaults.slug
  }
}

private extension View {
  func afilmoryWorkspaceField() -> some View {
    padding(.horizontal, 14)
      .frame(height: 48)
      .background(Color(uiColor: .secondarySystemBackground))
      .clipShape(.rect(cornerRadius: 12, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .stroke(Color(uiColor: .separator), lineWidth: 0.5)
      }
  }
}
