import { useRouter } from 'expo-router'
import type { PhotoPressEvent } from 'photo-masonry'
import { useCallback, useRef } from 'react'

import type { GalleryPhoto } from '@/modules/galleries/types'

import { createPhotoViewerSession } from './sessionStore'

export function useOpenPhotoViewer(photos: GalleryPhoto[], gallerySlug: string | null) {
  const router = useRouter()
  const openingRef = useRef(false)

  return useCallback(
    (event: { nativeEvent: PhotoPressEvent }) => {
      if (openingRef.current) {
        return
      }

      const pressed = event.nativeEvent
      const index
        = photos[pressed.index]?.id === pressed.id ? pressed.index : photos.findIndex(photo => photo.id === pressed.id)
      if (index < 0) {
        return
      }

      const session = createPhotoViewerSession(photos, index, pressed.transitionId, gallerySlug)
      const href = {
        pathname: '/photo/[photoId]',
        params: { photoId: pressed.id, session: session.id },
      } as const

      openingRef.current = true
      router.push(href)
      setTimeout(() => {
        openingRef.current = false
      }, 600)
    },
    [gallerySlug, photos, router],
  )
}
