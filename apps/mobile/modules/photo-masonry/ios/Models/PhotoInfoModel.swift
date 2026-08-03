import Foundation

struct PhotoInfoRow: Codable, Equatable, Identifiable, Sendable {
  let id: String
  let label: String
  let value: String
}

struct PhotoInfoSection: Codable, Equatable, Identifiable, Sendable {
  let id: String
  let title: String
  let summary: String?
  let rows: [PhotoInfoRow]
}

struct PhotoInfoMapLocation: Codable, Equatable, Sendable {
  let latitude: Double
  let longitude: Double
}

struct PhotoInfoSheetModel: Codable, Equatable, Sendable {
  let gear: PhotoInfoGear
  let description: String?
  let emptyMessage: String?
  let histogramUrl: String?
  let mapLocation: PhotoInfoMapLocation?
  let place: String?
  let sections: [PhotoInfoSection]
  let tags: [String]
}

enum PhotoInfoModel {
  static func build(
    photo: GalleryPhoto,
    localization: Localization,
    localeIdentifier: String,
    timeZone: TimeZone = .current
  ) -> PhotoInfoSheetModel {
    let exif = photo.exif
    var sections: [PhotoInfoSection] = []
    if let exif {
      if let section = exposureSection(exif: exif, localization: localization) {
        sections.append(section)
      }
      if let section = fujiSection(recipe: exif["FujiRecipe"]?.object, localization: localization) {
        sections.append(section)
      }
    }
    if let section = toneSection(photo: photo, localization: localization) {
      sections.append(section)
    }
    if let section = locationSection(photo: photo, exif: exif, localization: localization) {
      sections.append(section)
    }
    if let section = fileSection(
      photo: photo,
      exif: exif,
      localization: localization,
      localeIdentifier: localeIdentifier,
      timeZone: timeZone
    ) {
      sections.append(section)
    }
    if let section = attributionSection(exif: exif, localization: localization) {
      sections.append(section)
    }
    return PhotoInfoSheetModel(
      gear: PhotoInfoGear.build(
        photo: photo,
        exif: exif,
        localization: localization,
        localeIdentifier: localeIdentifier
      ),
      description: photo.description.isEmpty ? nil : photo.description,
      emptyMessage: exif == nil ? localization.value("photo.noExif") : nil,
      histogramUrl: photo.toneAnalysis == nil ? nil : photo.thumbnailUrl,
      mapLocation: mapLocation(photo: photo, exif: exif),
      place: place(photo: photo),
      sections: sections,
      tags: photo.tags
    )
  }

  private static func exposureSection(
    exif: GalleryExif,
    localization: Localization
  ) -> PhotoInfoSection? {
    let hasRecipe = exif["FujiRecipe"] != nil
    let summary = PhotoInfoFormatters.translatedExifValue(
      localization,
      prefix: "exif.exposureprogram",
      value: exif["ExposureProgram"]
    )
    let x = PhotoInfoFormatters.text(exif["FocalPlaneXResolution"])
    let y = PhotoInfoFormatters.text(exif["FocalPlaneYResolution"])
    return section(
      id: "exposure",
      title: localization.value("mobile.photoInfo.exposure"),
      summary: summary,
      rows: [
        row(
          id: "exposure-program",
          label: localization.value("exif.exposureprogram.title"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.exposureprogram",
            value: exif["ExposureProgram"]
          )
        ),
        row(
          id: "exposure-mode",
          label: localization.value("exif.exposure.mode.title"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.exposure.mode",
            value: exif["ExposureMode"]
          )
        ),
        row(
          id: "metering-mode",
          label: localization.value("exif.metering.mode.type"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.metering.mode",
            value: exif["MeteringMode"]
          )
        ),
        row(
          id: "white-balance",
          label: localization.value("exif.white.balance.title"),
          value: hasRecipe ? nil : PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.white.balance",
            value: exif["WhiteBalance"]
          )
        ),
        row(
          id: "white-balance-bias",
          label: localization.value("exif.white.balance.bias"),
          value: PhotoInfoFormatters.formatMired(exif["WhiteBalanceBias"])
        ),
        row(
          id: "white-balance-ab",
          label: localization.value("exif.white.balance.shift.ab"),
          value: PhotoInfoFormatters.text(exif["WBShiftAB"])
        ),
        row(
          id: "white-balance-gm",
          label: localization.value("exif.white.balance.shift.gm"),
          value: PhotoInfoFormatters.text(exif["WBShiftGM"])
        ),
        row(
          id: "flash",
          label: localization.value("exif.flash.title"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.flash",
            value: exif["Flash"]
          )
        ),
        row(
          id: "flash-metering",
          label: localization.value("exif.flash.metering.mode"),
          value: PhotoInfoFormatters.text(exif["FlashMeteringMode"])
        ),
        row(
          id: "light-source",
          label: localization.value("exif.light.source.type"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.light.source",
            value: exif["LightSource"]
          )
        ),
        row(
          id: "scene-type",
          label: localization.value("exif.scene.capture.type"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.scene.capture",
            value: exif["SceneCaptureType"]
          )
        ),
        row(
          id: "brightness",
          label: localization.value("exif.brightness.value"),
          value: PhotoInfoFormatters.formatEV(exif["BrightnessValue"])
        ),
        row(
          id: "sensing-method",
          label: localization.value("exif.sensing.method.type"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.sensing.method",
            value: exif["SensingMethod"]
          )
        ),
        row(
          id: "focal-plane",
          label: localization.value("exif.focal.plane.resolution"),
          value: x == nil && y == nil ? nil : "\(x ?? "—") × \(y ?? "—")"
        ),
      ]
    )
  }

  private static func fujiSection(
    recipe: [String: JSONValue]?,
    localization: Localization
  ) -> PhotoInfoSection? {
    guard let recipe else { return nil }
    return section(
      id: "fuji-recipe",
      title: localization.value("mobile.photoInfo.filmSimulation"),
      summary: PhotoInfoFormatters.formatFilmMode(recipe["FilmMode"]),
      rows: [
        row(
          id: "film-mode",
          label: localization.value("exif.film.mode"),
          value: PhotoInfoFormatters.formatFilmMode(recipe["FilmMode"])
        ),
        row(
          id: "dynamic-range",
          label: localization.value("exif.dynamic.range"),
          value: PhotoInfoFormatters.formatFujiDynamicRange(recipe, localization: localization)
        ),
        row(
          id: "white-balance",
          label: localization.value("exif.white.balance.title"),
          value: PhotoInfoFormatters.formatFujiWhiteBalance(recipe, localization: localization)
        ),
        row(
          id: "highlight-tone",
          label: localization.value("exif.highlight.tone"),
          value: PhotoInfoFormatters.cleanRecipeValue(recipe["HighlightTone"])
        ),
        row(
          id: "shadow-tone",
          label: localization.value("exif.shadow.tone"),
          value: PhotoInfoFormatters.cleanRecipeValue(recipe["ShadowTone"])
        ),
        row(
          id: "saturation",
          label: localization.value("exif.saturation"),
          value: PhotoInfoFormatters.cleanRecipeValue(recipe["Saturation"])
        ),
        row(
          id: "sharpness",
          label: localization.value("exif.sharpness"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.fujirecipe-sharpness",
            value: recipe["Sharpness"]
          )
        ),
        row(
          id: "noise-reduction",
          label: localization.value("exif.noise.reduction"),
          value: PhotoInfoFormatters.cleanRecipeValue(recipe["NoiseReduction"])
        ),
        row(
          id: "clarity",
          label: localization.value("exif.clarity"),
          value: PhotoInfoFormatters.text(recipe["Clarity"])
        ),
        row(
          id: "color-chrome",
          label: localization.value("exif.color.effect"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.fujirecipe-colorchromeeffect",
            value: recipe["ColorChromeEffect"]
          )
        ),
        row(
          id: "color-chrome-blue",
          label: localization.value("exif.blue.color.effect"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.fujirecipe-colorchromefxblue",
            value: recipe["ColorChromeFxBlue"]
          )
        ),
        row(
          id: "white-balance-fine-tune",
          label: localization.value("exif.white.balance.fine.tune"),
          value: PhotoInfoFormatters.text(recipe["WhiteBalanceFineTune"])
        ),
        row(
          id: "grain-intensity",
          label: localization.value("exif.grain.effect.intensity"),
          value: PhotoInfoFormatters.text(recipe["GrainEffectRoughness"])
        ),
        row(
          id: "grain-size",
          label: localization.value("exif.grain.effect.size"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.fujirecipe-graineffectsize",
            value: recipe["GrainEffectSize"]
          )
        ),
      ]
    )
  }

  private static func toneSection(
    photo: GalleryPhoto,
    localization: Localization
  ) -> PhotoInfoSection? {
    guard let tone = photo.toneAnalysis else { return nil }
    let brightness = PhotoInfoFormatters.formatPercentage(tone.brightness, scale: 1)
    return section(
      id: "tone",
      title: localization.value("mobile.photoInfo.tone"),
      summary: brightness,
      rows: [
        row(id: "brightness", label: localization.value("exif.brightness.title"), value: brightness),
        row(
          id: "contrast",
          label: localization.value("exif.contrast.title"),
          value: PhotoInfoFormatters.formatPercentage(tone.contrast, scale: 1)
        ),
        row(
          id: "shadow-ratio",
          label: localization.value("exif.shadow.ratio"),
          value: PhotoInfoFormatters.formatPercentage(tone.shadowRatio, scale: 100)
        ),
        row(
          id: "highlight-ratio",
          label: localization.value("exif.highlight.ratio"),
          value: PhotoInfoFormatters.formatPercentage(tone.highlightRatio, scale: 100)
        ),
      ]
    )
  }

  private static func locationSection(
    photo: GalleryPhoto,
    exif: GalleryExif?,
    localization: Localization
  ) -> PhotoInfoSection? {
    let altitude = PhotoInfoFormatters.formatAltitude(exif)
    return section(
      id: "location",
      title: localization.value("mobile.photoInfo.locationDetail"),
      summary: altitude,
      rows: [
        row(
          id: "latitude",
          label: localization.value("exif.gps.latitude"),
          value: PhotoInfoFormatters.formatCoordinate(
            exif?["GPSLatitude"] ?? photo.location?.latitude.map(JSONValue.number),
            reference: exif?["GPSLatitudeRef"]
          )
        ),
        row(
          id: "longitude",
          label: localization.value("exif.gps.longitude"),
          value: PhotoInfoFormatters.formatCoordinate(
            exif?["GPSLongitude"] ?? photo.location?.longitude.map(JSONValue.number),
            reference: exif?["GPSLongitudeRef"]
          )
        ),
        row(id: "altitude", label: localization.value("exif.gps.altitude"), value: altitude),
        row(
          id: "address",
          label: localization.value("exif.gps.address"),
          value: photo.location?.locationName
        ),
      ]
    )
  }

  private static func fileSection(
    photo: GalleryPhoto,
    exif: GalleryExif?,
    localization: Localization,
    localeIdentifier: String,
    timeZone: TimeZone
  ) -> PhotoInfoSection? {
    let filename = PhotoInfoFormatters.text(photo.title)
    return section(
      id: "file",
      title: localization.value("mobile.photoInfo.file"),
      summary: filename,
      rows: [
        row(id: "filename", label: localization.value("exif.filename"), value: filename),
        row(
          id: "color-space",
          label: localization.value("exif.color.space"),
          value: PhotoInfoFormatters.translatedExifValue(
            localization,
            prefix: "exif.colorspace",
            value: exif?["ColorSpace"]
          )
        ),
        row(
          id: "capture-time",
          label: localization.value("exif.capture.time"),
          value: PhotoInfoFormatters.formatDate(
            PhotoInfoFormatters.text(exif?["DateTimeOriginal"]) ?? photo.dateTaken,
            localeIdentifier: localeIdentifier,
            timeZone: timeZone
          )
        ),
        row(
          id: "time-zone",
          label: localization.value("exif.time.zone"),
          value: PhotoInfoFormatters.text(exif?["zone"] ?? exif?["tz"])
        ),
      ]
    )
  }

  private static func attributionSection(
    exif: GalleryExif?,
    localization: Localization
  ) -> PhotoInfoSection? {
    let artist = PhotoInfoFormatters.text(exif?["Artist"])
    return section(
      id: "attribution",
      title: localization.value("mobile.photoInfo.attribution"),
      summary: artist,
      rows: [
        row(id: "artist", label: localization.value("exif.artist"), value: artist),
        row(
          id: "copyright",
          label: localization.value("exif.copyright"),
          value: PhotoInfoFormatters.text(exif?["Copyright"])
        ),
        row(
          id: "software",
          label: localization.value("exif.software"),
          value: PhotoInfoFormatters.text(exif?["Software"])
        ),
      ]
    )
  }

  private static func mapLocation(photo: GalleryPhoto, exif: GalleryExif?) -> PhotoInfoMapLocation? {
    let latitude = PhotoInfoFormatters.decimalCoordinate(
      exif?["GPSLatitude"] ?? photo.location?.latitude.map(JSONValue.number),
      reference: exif?["GPSLatitudeRef"],
      limit: 90
    )
    let longitude = PhotoInfoFormatters.decimalCoordinate(
      exif?["GPSLongitude"] ?? photo.location?.longitude.map(JSONValue.number),
      reference: exif?["GPSLongitudeRef"],
      limit: 180
    )
    guard let latitude, let longitude else { return nil }
    return PhotoInfoMapLocation(latitude: latitude, longitude: longitude)
  }

  private static func place(photo: GalleryPhoto) -> String? {
    let city = PhotoInfoFormatters.text(photo.location?.city) ?? PhotoInfoFormatters.text(photo.city)
    let country = PhotoInfoFormatters.text(photo.location?.country)
    if let city, let country, city.compare(country, options: .caseInsensitive) == .orderedSame {
      return city
    }
    return [city, country].compactMap { $0 }.joined(separator: ", ").trimmingToNil
  }

  private static func row(id: String, label: String, value: String?) -> PhotoInfoRow? {
    value.map { PhotoInfoRow(id: id, label: label, value: $0) }
  }

  private static func section(
    id: String,
    title: String,
    summary: String?,
    rows: [PhotoInfoRow?]
  ) -> PhotoInfoSection? {
    let rows = rows.compactMap { $0 }
    return rows.isEmpty ? nil : PhotoInfoSection(id: id, title: title, summary: summary, rows: rows)
  }
}
