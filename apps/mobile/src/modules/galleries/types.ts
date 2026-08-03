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
  isSubscribed: boolean
  isOwnGallery: boolean
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
