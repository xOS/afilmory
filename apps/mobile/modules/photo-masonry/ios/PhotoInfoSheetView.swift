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
        Section(info.localization.captureParameters) {
          LazyVGrid(columns: parameterColumns, spacing: 10) {
            ForEach(info.captureParameters) { parameter in
              PhotoCaptureParameterView(parameter: parameter)
            }
          }
          .padding(.vertical, 4)
        }
      }

      if !info.tags.isEmpty {
        Section(info.localization.tags) {
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

      if let toneAnalysis = info.toneAnalysis {
        Section(info.localization.toneAnalysis) {
          PhotoInfoRowView(row: toneAnalysis.tone)

          if !toneAnalysis.metrics.isEmpty {
            LazyVGrid(columns: parameterColumns, spacing: 10) {
              ForEach(toneAnalysis.metrics) { metric in
                PhotoToneMetricView(metric: metric)
              }
            }
            .padding(.vertical, 4)
          }

          VStack(alignment: .leading, spacing: 8) {
            Text(info.localization.histogram)
              .font(.caption)
              .foregroundStyle(.secondary)
            PhotoHistogramView(
              urlString: toneAnalysis.histogramUrl,
              failedMessage: info.localization.histogramFailure,
              accessibilityLabel: info.localization.histogramAccessibilityLabel
            )
            .frame(height: 128)
          }
          .padding(.vertical, 4)
        }
      }

      ForEach(info.sections.dropFirst()) { section in
        Section(section.title) {
          ForEach(section.rows) { row in
            PhotoInfoRowView(row: row)
          }

          if section.id == "location", let mapLocation = info.mapLocation {
            PhotoMapPreview(
              latitude: mapLocation.latitude,
              longitude: mapLocation.longitude,
              accessibilityLabel: info.localization.mapAccessibilityLabel
            )
            .frame(height: 160)
            .padding(.vertical, 4)
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

struct PhotoInfoInspectorView: View {
  let info: PhotoInfoSheetRecord
  var showsHeader = true
  var bottomContentInset: CGFloat = 0
  let onClose: () -> Void

  @ViewBuilder
  var body: some View {
    if showsHeader {
      PhotoInfoSheetView(info: info)
        .safeAreaBar(edge: .top, spacing: 0) {
          header
        }
        .scrollEdgeEffectStyle(.soft, for: .top)
    } else {
      PhotoInfoCompactView(info: info, bottomContentInset: bottomContentInset)
    }
  }

  private var header: some View {
    HStack(spacing: 12) {
      Text(info.localization.title)
        .font(.headline)
      Spacer()
      Button(action: onClose) {
        Image(systemName: "xmark")
          .font(.body.weight(.semibold))
          .frame(width: 28, height: 28)
          .contentShape(Circle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(info.localization.done)
    }
    .padding(.horizontal, 16)
    .frame(height: 52)
  }
}

private struct PhotoInfoCompactView: View {
  let info: PhotoInfoSheetRecord
  let bottomContentInset: CGFloat

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var basicSection: PhotoInfoSectionRecord? {
    info.sections.first
  }

  private var captureTime: PhotoInfoRowRecord? {
    basicSection?.rows.first { $0.id == "capture-time" }
  }

  private var summaryRows: [PhotoInfoRowRecord] {
    let summaryIDs: Set<String> = ["format", "dimensions", "file-size", "megapixels"]
    return basicSection?.rows.filter { summaryIDs.contains($0.id) } ?? []
  }

  private var additionalBasicRows: [PhotoInfoRowRecord] {
    let featuredIDs: Set<String> = [
      "filename",
      "format",
      "dimensions",
      "file-size",
      "megapixels",
      "capture-time",
    ]
    return basicSection?.rows.filter { !featuredIDs.contains($0.id) } ?? []
  }

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 18) {
        overview

        if !summaryRows.isEmpty {
          PhotoInfoCompactRowsCard(rows: summaryRows)
        }

        if !info.captureParameters.isEmpty {
          PhotoInfoCompactSectionHeader(title: info.localization.captureParameters)
          PhotoInfoCompactParametersCard(
            parameters: info.captureParameters,
            usesVerticalLayout: dynamicTypeSize.isAccessibilitySize
          )
        }

        if !additionalBasicRows.isEmpty, let basicSection {
          PhotoInfoCompactSectionHeader(title: basicSection.title)
          PhotoInfoCompactRowsCard(rows: additionalBasicRows)
        }

        if !info.tags.isEmpty {
          PhotoInfoCompactSectionHeader(title: info.localization.tags)
          PhotoInfoCompactTagsCard(tags: info.tags)
        }

        if let toneAnalysis = info.toneAnalysis {
          PhotoInfoCompactSectionHeader(title: info.localization.toneAnalysis)
          PhotoInfoCompactToneCard(info: info, toneAnalysis: toneAnalysis)
        }

        ForEach(info.sections.dropFirst()) { section in
          PhotoInfoCompactSectionHeader(title: section.title)
          PhotoInfoCompactRowsCard(rows: section.rows)

          if section.id == "location", let mapLocation = info.mapLocation {
            PhotoMapPreview(
              latitude: mapLocation.latitude,
              longitude: mapLocation.longitude,
              accessibilityLabel: info.localization.mapAccessibilityLabel
            )
            .frame(height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          }
        }

        if let emptyMessage = info.emptyMessage {
          Label(emptyMessage, systemImage: "info.circle")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
              Color(uiColor: .secondarySystemGroupedBackground),
              in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
        }
      }
      .padding(.horizontal, 16)
      .padding(.top, 12)
      .padding(.bottom, 28 + bottomContentInset)
    }
    .scrollIndicators(.hidden)
    .background(Color(uiColor: .systemGroupedBackground))
  }

  @ViewBuilder
  private var overview: some View {
    if !info.title.isEmpty || info.description != nil {
      VStack(alignment: .leading, spacing: 5) {
        if !info.title.isEmpty {
          Text(info.title)
            .font(.body.weight(.semibold))
            .textSelection(.enabled)
        }
        if let description = info.description, !description.isEmpty {
          Text(description)
            .font(.body)
            .foregroundStyle(.secondary)
            .textSelection(.enabled)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(14)
      .background(
        Color(uiColor: .secondarySystemGroupedBackground),
        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
      )
    }

    if let captureTime {
      VStack(alignment: .leading, spacing: 3) {
        Text(captureTime.value)
          .font(.headline)
          .textSelection(.enabled)
        Text(captureTime.label)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(.horizontal, 2)
      .accessibilityElement(children: .combine)
    }
  }
}

private struct PhotoInfoCompactSectionHeader: View {
  let title: String

  var body: some View {
    Text(title)
      .font(.footnote.weight(.semibold))
      .foregroundStyle(.secondary)
      .padding(.horizontal, 2)
      .accessibilityAddTraits(.isHeader)
  }
}

private struct PhotoInfoCompactRowsCard: View {
  let rows: [PhotoInfoRowRecord]

  var body: some View {
    VStack(spacing: 0) {
      ForEach(rows.indices, id: \.self) { index in
        PhotoInfoRowView(row: rows[index])
          .padding(.horizontal, 14)
          .padding(.vertical, 11)

        if index < rows.index(before: rows.endIndex) {
          Divider()
            .padding(.leading, 14)
        }
      }
    }
    .background(
      Color(uiColor: .secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 16, style: .continuous)
    )
  }
}

private struct PhotoInfoCompactParametersCard: View {
  let parameters: [PhotoCaptureParameterRecord]
  let usesVerticalLayout: Bool

  var body: some View {
    Group {
      if usesVerticalLayout {
        VStack(spacing: 0) {
          ForEach(parameters.indices, id: \.self) { index in
            PhotoInfoCompactParameterView(parameter: parameters[index])
              .padding(.horizontal, 14)
              .padding(.vertical, 10)

            if index < parameters.index(before: parameters.endIndex) {
              Divider()
                .padding(.leading, 14)
            }
          }
        }
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 0) {
            ForEach(parameters.indices, id: \.self) { index in
              PhotoInfoCompactParameterView(parameter: parameters[index])
                .frame(width: 104)
                .padding(.horizontal, 10)
                .padding(.vertical, 12)

              if index < parameters.index(before: parameters.endIndex) {
                Divider()
                  .frame(height: 38)
              }
            }
          }
        }
      }
    }
    .background(
      Color(uiColor: .secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 16, style: .continuous)
    )
  }
}

private struct PhotoInfoCompactParameterView: View {
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
    .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}

private struct PhotoInfoCompactTagsCard: View {
  let tags: [String]

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(tags, id: \.self) { tag in
          Text(tag)
            .font(.subheadline)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.quaternary, in: Capsule())
            .textSelection(.enabled)
        }
      }
      .padding(12)
    }
    .background(
      Color(uiColor: .secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 16, style: .continuous)
    )
  }
}

private struct PhotoInfoCompactToneCard: View {
  let info: PhotoInfoSheetRecord
  let toneAnalysis: PhotoToneAnalysisRecord

  private var parameterColumns: [GridItem] {
    [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      PhotoInfoRowView(row: toneAnalysis.tone)

      if !toneAnalysis.metrics.isEmpty {
        Divider()
        LazyVGrid(columns: parameterColumns, spacing: 10) {
          ForEach(toneAnalysis.metrics) { metric in
            PhotoToneMetricView(metric: metric)
          }
        }
      }

      Divider()

      VStack(alignment: .leading, spacing: 8) {
        Text(info.localization.histogram)
          .font(.caption)
          .foregroundStyle(.secondary)
        PhotoHistogramView(
          urlString: toneAnalysis.histogramUrl,
          failedMessage: info.localization.histogramFailure,
          accessibilityLabel: info.localization.histogramAccessibilityLabel
        )
        .frame(height: 128)
      }
    }
    .padding(14)
    .background(
      Color(uiColor: .secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 16, style: .continuous)
    )
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

private struct PhotoToneMetricView: View {
  let metric: PhotoInfoRowRecord

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(metric.value)
        .font(.headline.monospacedDigit())
      Text(metric.label)
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
    .padding(12)
    .background(.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityElement(children: .combine)
  }
}
