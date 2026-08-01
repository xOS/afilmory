import SwiftUI

struct UploadReviewItem: Identifiable, Equatable {
  let id: String
  let assetUri: String
  let isLivePhoto: Bool
}

enum UploadReviewOutcome {
  case cancel
  case start(itemIds: [String], tags: [String])
  // Re-picking lives in JS so the native sheet never owns a second presentation:
  // it hands back its current state, JS merges the new assets and re-presents.
  case addMore(itemIds: [String], tags: [String])
}

struct UploadReviewSheetView: View {
  let localization: UploadReviewLocalizationRecord
  let suggestedTags: [String]
  @State private var items: [UploadReviewItem]
  @State private var tags: [String] = []
  @State private var draft = ""
  @FocusState private var draftFocused: Bool

  private let onFinish: (UploadReviewOutcome) -> Void
  private let columns = [GridItem(.adaptive(minimum: 96), spacing: 8)]

  init(
    items: [UploadReviewItem],
    suggestedTags: [String],
    localization: UploadReviewLocalizationRecord,
    onFinish: @escaping (UploadReviewOutcome) -> Void
  ) {
    self._items = State(initialValue: items)
    self.suggestedTags = suggestedTags
    self.localization = localization
    self.onFinish = onFinish
  }

  private var availableSuggestions: [String] {
    suggestedTags.filter { !tags.contains($0) }
  }

  var body: some View {
    VStack(spacing: 0) {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text(localization.summary)
            .font(.subheadline)
            .foregroundStyle(.secondary)

          LazyVGrid(columns: columns, spacing: 8) {
            ForEach(items) { item in
              UploadReviewThumbnail(
                item: item,
                removeLabel: localization.remove,
                onRemove: { remove(item) }
              )
            }
            addMoreCell
          }

          tagSection
        }
        .padding(20)
      }

      Divider()

      HStack(spacing: 12) {
        Button(localization.cancel) { onFinish(.cancel) }
          .buttonStyle(.bordered)
          .controlSize(.large)

        Button {
          onFinish(.start(itemIds: items.map(\.id), tags: tags))
        } label: {
          Text(localization.start).frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(items.isEmpty)
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 12)
    }
    .background(Color(.systemGroupedBackground))
  }

  private var addMoreCell: some View {
    Button {
      onFinish(.addMore(itemIds: items.map(\.id), tags: tags))
    } label: {
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color(.secondarySystemGroupedBackground))
        .aspectRatio(1, contentMode: .fill)
        .overlay(
          Image(systemName: "plus")
            .font(.system(size: 22, weight: .medium))
            .foregroundStyle(.secondary)
        )
    }
    .accessibilityLabel(localization.addMore)
  }

  private var tagSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(localization.tagsLabel)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.tertiary)
        .textCase(.uppercase)

      if !tags.isEmpty {
        UploadReviewChipRow(labels: tags, isSelected: true) { tag in
          tags.removeAll { $0 == tag }
        }
      }

      TextField(localization.tagsPlaceholder, text: $draft)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .focused($draftFocused)
        .submitLabel(.done)
        .onSubmit(commitDraft)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color(.secondarySystemGroupedBackground))
        )

      if !availableSuggestions.isEmpty {
        UploadReviewChipRow(labels: availableSuggestions, isSelected: false) { tag in
          tags.append(tag)
        }
      }
    }
  }

  private func remove(_ item: UploadReviewItem) {
    items.removeAll { $0.id == item.id }
  }

  private func commitDraft() {
    // Comma separated so one keyboard trip can add several tags, matching the
    // dashboard's tag field.
    for part in draft.split(separator: ",") {
      let normalized = part.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      if !normalized.isEmpty, !tags.contains(normalized) {
        tags.append(normalized)
      }
    }
    draft = ""
  }
}

private struct UploadReviewThumbnail: View {
  let item: UploadReviewItem
  let removeLabel: String
  let onRemove: () -> Void

  var body: some View {
    ZStack(alignment: .topTrailing) {
      UploadReviewImage(uri: item.assetUri)
        .aspectRatio(1, contentMode: .fill)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

      Button(action: onRemove) {
        Image(systemName: "xmark.circle.fill")
          .font(.system(size: 20))
          .symbolRenderingMode(.palette)
          .foregroundStyle(.white, .black.opacity(0.55))
      }
      .padding(5)
      .accessibilityLabel(removeLabel)

      if item.isLivePhoto {
        Image(systemName: "livephoto")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white)
          .shadow(radius: 2)
          .padding(7)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
  }
}

// expo-image-picker hands back file:// URLs in the app container, which
// AsyncImage does not load, so the bytes are read directly off disk.
private struct UploadReviewImage: View {
  let uri: String
  @State private var image: UIImage?

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image).resizable().scaledToFill()
      } else {
        Color(.tertiarySystemFill)
      }
    }
    .task(id: uri) {
      guard image == nil, let url = URL(string: uri), url.isFileURL else { return }
      let loaded = await Task.detached(priority: .userInitiated) { () -> UIImage? in
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)?.preparingThumbnail(of: CGSize(width: 300, height: 300))
      }.value
      image = loaded
    }
  }
}

private struct UploadReviewChipRow: View {
  let labels: [String]
  let isSelected: Bool
  let onTap: (String) -> Void

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(labels, id: \.self) { label in
          Button {
            onTap(label)
          } label: {
            HStack(spacing: 4) {
              Text(label)
              if isSelected {
                Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
              }
            }
            .font(.footnote.weight(isSelected ? .semibold : .regular))
          }
          .buttonStyle(.bordered)
          .buttonBorderShape(.capsule)
          .tint(isSelected ? .accentColor : .secondary)
        }
      }
      .padding(.horizontal, 1)
    }
  }
}
