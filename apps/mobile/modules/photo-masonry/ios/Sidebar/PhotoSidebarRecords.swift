import ExpoModulesCore

struct PhotoSidebarItemRecord: Record, Identifiable {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var count: Int = 0
  @Field var selected: Bool = false
}

struct PhotoSidebarLocalizationRecord: Record {
  @Field var clearFilters: String = ""
  @Field var filters: String = ""
  @Field var moreTags: String = ""
  @Field var notSelected: String = ""
  @Field var quickFilters: String = ""
  @Field var searchPlaceholder: String = ""
  @Field var selected: String = ""
  @Field var tags: String = ""
}

struct PhotoSidebarRequest: Record {
  @Field var activeFilterCount: Int = 0
  @Field var localization: PhotoSidebarLocalizationRecord = .init()
  @Field var ownerID: String = ""
  @Field var query: String = ""
  @Field var quickFilters: [PhotoSidebarItemRecord] = []
  @Field var showsMoreTags: Bool = false
  @Field var tags: [PhotoSidebarItemRecord] = []
}
