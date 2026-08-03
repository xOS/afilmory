import Foundation

struct PhotoDetailMetadata: Sendable {
  let id: String
  let title: String
  let subtitle: String
  let infoJSON: String
}

struct PhotoDetailStrings {
  var close = ""
  var comments = ""
  var info = ""
  var next = ""
  var previous = ""
  var reaction = ""
  var share = ""
}

struct PhotoDetailReactionItem {
  let accessibilityLabel: String
  let count: Int
  let reaction: String
}

struct PhotoInfoLocalizationPayload: Encodable {
  let done: String
  let histogram: String
  let histogramAccessibilityLabel: String
  let histogramFailure: String
  let mapAccessibilityLabel: String
  let ratingLabel: String
  let tags: String
  let title: String
}

struct PhotoInfoSheetPayload: Encodable {
  let gear: PhotoInfoGear
  let description: String?
  let histogramUrl: String?
  let sections: [PhotoInfoSection]
  let tags: [String]
  let place: String?
  let mapLocation: PhotoInfoMapLocation?
  let emptyMessage: String?
  let localization: PhotoInfoLocalizationPayload
}

extension PhotoInfoSheetModel {
  func detailJSON(localization: Localization) -> String {
    let mapAccessibilityLabel = mapLocation.map {
      localization.value(
        "sheet.map.accessibility",
        arguments: [
          "latitude": String($0.latitude),
          "longitude": String($0.longitude),
        ]
      )
    } ?? ""
    let payload = PhotoInfoSheetPayload(
      gear: gear,
      description: description,
      histogramUrl: histogramUrl,
      sections: sections,
      tags: tags,
      place: place,
      mapLocation: mapLocation,
      emptyMessage: emptyMessage,
      localization: PhotoInfoLocalizationPayload(
        done: localization.value("common.done"),
        histogram: localization.value("exif.histogram"),
        histogramAccessibilityLabel: localization.value("sheet.histogram.accessibility"),
        histogramFailure: localization.value("sheet.histogram.failed"),
        mapAccessibilityLabel: mapAccessibilityLabel,
        ratingLabel: localization.value("exif.rating"),
        tags: localization.value("exif.tags"),
        title: localization.value("sheet.info")
      )
    )
    guard let data = try? JSONEncoder().encode(payload) else { return "{}" }
    return String(decoding: data, as: UTF8.self)
  }
}
