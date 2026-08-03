import ExpoModulesCore

struct MapPhoto: Record {
  @Field var accessibilityLabel: String = ""
  @Field var id: String = ""
  @Field var index: Int = 0
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  @Field var openAccessibilityLabel: String = ""
  @Field var subtitle: String = ""
  @Field var thumbnailUrl: String = ""
  @Field var title: String = ""
}
