import ExpoModulesCore

struct PhotoInfoRowRecord: Record, Identifiable {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var value: String = ""
}

struct PhotoInfoSectionRecord: Record, Identifiable {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var rows: [PhotoInfoRowRecord] = []
}

struct PhotoCaptureParameterRecord: Record, Identifiable {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var value: String = ""
}

struct PhotoToneAnalysisRecord: Record {
  @Field var histogramUrl: String = ""
  @Field var metrics: [PhotoInfoRowRecord] = []
  @Field var tone: PhotoInfoRowRecord = .init()
}

struct PhotoMapLocationRecord: Record {
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
}

struct PhotoInfoLocalizationRecord: Record {
  @Field var captureParameters: String = ""
  @Field var done: String = ""
  @Field var histogram: String = ""
  @Field var histogramAccessibilityLabel: String = ""
  @Field var histogramFailure: String = ""
  @Field var mapAccessibilityLabel: String = ""
  @Field var tags: String = ""
  @Field var title: String = ""
  @Field var toneAnalysis: String = ""
}

struct PhotoInfoSheetRecord: Record {
  @Field var title: String = ""
  @Field var description: String?
  @Field var sections: [PhotoInfoSectionRecord] = []
  @Field var captureParameters: [PhotoCaptureParameterRecord] = []
  @Field var tags: [String] = []
  @Field var toneAnalysis: PhotoToneAnalysisRecord?
  @Field var mapLocation: PhotoMapLocationRecord?
  @Field var emptyMessage: String?
  @Field var localization: PhotoInfoLocalizationRecord = .init()
}

struct PhotoFilterDatePresetRecord: Record, Identifiable {
  @Field var label: String = ""
  @Field var value: String = ""

  var id: String { value }
}

struct PhotoFilterLocalizationRecord: Record {
  @Field var all: String = ""
  @Field var any: String = ""
  @Field var anyDate: String = ""
  @Field var anyRating: String = ""
  @Field var camera: String = ""
  @Field var cancel: String = ""
  @Field var customRange: String = ""
  @Field var date: String = ""
  @Field var datePresets: [PhotoFilterDatePresetRecord] = []
  @Field var done: String = ""
  @Field var from: String = ""
  @Field var lens: String = ""
  @Field var match: String = ""
  @Field var minimumRating: String = ""
  @Field var notSelected: String = ""
  @Field var range: String = ""
  @Field var rating: String = ""
  @Field var ratingOptions: [String] = []
  @Field var reset: String = ""
  @Field var selected: String = ""
  @Field var tags: String = ""
  @Field var title: String = ""
  @Field var to: String = ""
}

struct PhotoFilterOptionRecord: Record, Identifiable {
  @Field var value: String = ""
  @Field var count: Int = 0

  var id: String { value }
}

struct PhotoFilterOptionsRecord: Record {
  @Field var tags: [PhotoFilterOptionRecord] = []
  @Field var cameras: [PhotoFilterOptionRecord] = []
  @Field var lenses: [PhotoFilterOptionRecord] = []
  @Field var ratedCount: Int = 0
}

struct PhotoFiltersRecord: Record {
  @Field var tags: [String] = []
  @Field var tagMode: String = "any"
  @Field var datePreset: String?
  @Field var dateFrom: String?
  @Field var dateTo: String?
  @Field var cameras: [String] = []
  @Field var lenses: [String] = []
  @Field var minRating: Int?
}

struct PhotoFilterSheetRequest: Record {
  @Field var filters: PhotoFiltersRecord = .init()
  @Field var localization: PhotoFilterLocalizationRecord = .init()
  @Field var options: PhotoFilterOptionsRecord = .init()
}
