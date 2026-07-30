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

struct PhotoInfoSheetRecord: Record {
  @Field var title: String = ""
  @Field var description: String?
  @Field var sections: [PhotoInfoSectionRecord] = []
  @Field var captureParameters: [PhotoCaptureParameterRecord] = []
  @Field var tags: [String] = []
  @Field var emptyMessage: String?
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
  @Field var options: PhotoFilterOptionsRecord = .init()
}
