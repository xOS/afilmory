export interface GalleryAuthor {
  name: string
  avatar: string | null
}

export interface FeaturedGallery {
  id: string
  name: string
  slug: string
  domain: string | null
  description: string | null
  author: GalleryAuthor | null
  photoCount: number
  tags: string[]
  createdAt: string
  lastUpload: string | null
}

export interface GalleryCoverPhoto {
  id: string
  thumbnailUrl: string
  thumbHash: string | null
  aspectRatio: number
  isLivePhoto: boolean
}

export interface GalleryLocation {
  latitude: number | null
  longitude: number | null
  country: string | null
  city: string | null
  locationName: string | null
}

export type GalleryToneType = 'low-key' | 'high-key' | 'normal' | 'high-contrast'

export interface GalleryToneAnalysis {
  toneType: GalleryToneType
  brightness: number
  contrast: number
  shadowRatio: number
  highlightRatio: number
}

export interface GalleryFujiRecipe {
  FilmMode?: string
  GrainEffectRoughness?: string
  GrainEffectSize?: string
  ColorChromeEffect?: string
  ColorChromeFxBlue?: string
  WhiteBalance?: string
  WhiteBalanceFineTune?: string
  DynamicRange?: string
  HighlightTone?: string
  ShadowTone?: string
  Saturation?: string
  Sharpness?: string
  NoiseReduction?: string
  Clarity?: number
  ColorTemperature?: string | number
  DevelopmentDynamicRange?: number
  DynamicRangeSetting?: string
}

/**
 * JSON-safe EXIF fields exposed by the public manifest.
 *
 * This mobile transport type intentionally does not import the builder's
 * exiftool-backed types into the React Native dependency graph.
 */
export interface GalleryExif {
  zone?: string
  tz?: string
  Orientation?: number
  Make?: string
  Model?: string
  Software?: string
  Artist?: string
  Copyright?: string
  ExposureTime?: string | number
  FNumber?: number
  ExposureProgram?: string
  ISO?: number
  ShutterSpeedValue?: string | number
  ApertureValue?: number
  BrightnessValue?: number
  ExposureCompensation?: number
  MaxApertureValue?: number
  LightSource?: string
  Flash?: string
  FocalLength?: string
  FocalLengthIn35mmFormat?: string
  LensMake?: string
  LensModel?: string
  ColorSpace?: string
  ExposureMode?: string
  SceneCaptureType?: string
  ShutterSpeed?: string | number
  DateTimeOriginal?: string
  MeteringMode?: string | number
  WhiteBalance?: string | number
  WBShiftAB?: string | number
  WBShiftGM?: string | number
  WhiteBalanceBias?: string | number
  FlashMeteringMode?: string | number
  SensingMethod?: string | number
  FocalPlaneXResolution?: string | number
  FocalPlaneYResolution?: string | number
  GPSAltitude?: string | number
  GPSLatitude?: string | number
  GPSLongitude?: string | number
  GPSAltitudeRef?: string | number
  GPSLatitudeRef?: string
  GPSLongitudeRef?: string
  Rating?: number
  FujiRecipe?: GalleryFujiRecipe
}

export type GalleryVideoSource
  = | {
    type: 'live-photo'
    videoUrl: string
  }
  | {
    type: 'motion-photo'
    offset: number
    size?: number
    presentationTimestamp?: number
  }

export interface GalleryPhoto {
  id: string
  title: string
  description: string
  originalUrl: string
  thumbnailUrl: string
  thumbHash: string | null
  aspectRatio: number
  width: number
  height: number
  format: string | null
  size: number | null
  dateTaken: string | null
  video: GalleryVideoSource | null
  tags: string[]
  exif: GalleryExif | null
  toneAnalysis: GalleryToneAnalysis | null
  location: GalleryLocation | null
  camera: string | null
  lens: string | null
  rating: number | null
  city: string | null
}
