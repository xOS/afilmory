import type { PhotoContextMenuActionEvent } from 'photo-masonry'
import { useCallback } from 'react'
import { Share } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'
import type { GalleryPhoto } from '@/modules/galleries/types'
import { presentNativePhotoInfo } from '@/native/photoSheets'

import { buildPhotoInfoSheetModel } from './photoInfoModel'

export function usePhotoContextMenu(photos: GalleryPhoto[]) {
  const { i18n, t } = useTranslation()

  return useCallback(
    (event: { nativeEvent: PhotoContextMenuActionEvent }) => {
      const requested = event.nativeEvent
      const photo
        = photos[requested.index]?.id === requested.id
          ? photos[requested.index]
          : photos.find(candidate => candidate.id === requested.id)
      if (!photo) {
        return
      }

      switch (requested.action) {
        case 'info': {
          void presentNativePhotoInfo(buildPhotoInfoSheetModel(photo, t, getIntlLocale(i18n.resolvedLanguage)))
          break
        }
        case 'share': {
          void Share.share({
            message: photo.title || photo.originalUrl,
            url: photo.originalUrl,
          })
          break
        }
      }
    },
    [i18n.resolvedLanguage, photos, t],
  )
}
