import SwiftUI

struct PhotoInfoSectionsList: View {
  let info: PhotoInfoSheetRecord
  var bottomContentInset: CGFloat = 0

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
    .contentMargins(.bottom, bottomContentInset, for: .scrollContent)
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
      PhotoInfoSectionsList(info: info)
        .safeAreaBar(edge: .top, spacing: 0) {
          header
        }
        .scrollEdgeEffectStyle(.soft, for: .top)
    } else {
      PhotoInfoSectionsList(info: info, bottomContentInset: bottomContentInset)
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
