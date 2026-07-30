import SwiftUI

struct PhotoInfoSheetView: View {
  let info: PhotoInfoSheetRecord

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var parameterColumns: [GridItem] {
    let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
    return Array(repeating: GridItem(.flexible(), spacing: 10), count: count)
  }

  var body: some View {
    List {
      if !info.title.isEmpty || info.description != nil {
        Section {
          VStack(alignment: .leading, spacing: 6) {
            if !info.title.isEmpty {
              Text(info.title)
                .font(.title2.bold())
                .textSelection(.enabled)
            }
            if let description = info.description, !description.isEmpty {
              Text(description)
                .font(.body)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            }
          }
          .padding(.vertical, 4)
        }
      }

      if let basicSection = info.sections.first {
        Section(basicSection.title) {
          ForEach(basicSection.rows) { row in
            PhotoInfoRowView(row: row)
          }
        }
      }

      if !info.captureParameters.isEmpty {
        Section("Capture Parameters") {
          LazyVGrid(columns: parameterColumns, spacing: 10) {
            ForEach(info.captureParameters) { parameter in
              PhotoCaptureParameterView(parameter: parameter)
            }
          }
          .padding(.vertical, 4)
        }
      }

      if !info.tags.isEmpty {
        Section("Tags") {
          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
              ForEach(info.tags, id: \.self) { tag in
                Text(tag)
                  .font(.subheadline)
                  .padding(.horizontal, 10)
                  .padding(.vertical, 6)
                  .background(.quaternary, in: Capsule())
                  .textSelection(.enabled)
              }
            }
          }
          .padding(.vertical, 4)
        }
      }

      ForEach(info.sections.dropFirst()) { section in
        Section(section.title) {
          ForEach(section.rows) { row in
            PhotoInfoRowView(row: row)
          }
        }
      }

      if let emptyMessage = info.emptyMessage {
        Section {
          Label(emptyMessage, systemImage: "info.circle")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }
    }
    .listStyle(.insetGrouped)
  }
}

private struct PhotoInfoRowView: View {
  let row: PhotoInfoRowRecord

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 16) {
      Text(row.label)
        .foregroundStyle(.secondary)
      Spacer(minLength: 16)
      Text(row.value)
        .multilineTextAlignment(.trailing)
        .textSelection(.enabled)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct PhotoCaptureParameterView: View {
  let parameter: PhotoCaptureParameterRecord

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(parameter.value)
        .font(.headline.monospacedDigit())
        .lineLimit(2)
        .minimumScaleFactor(0.8)
      Text(parameter.label)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
    .padding(12)
    .background(.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityElement(children: .combine)
  }
}
