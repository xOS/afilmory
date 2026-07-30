import { signInPage } from '@/modules/auth/signInPage'
import { galleriesPage } from '@/modules/galleries/galleriesPage'
import { galleryDetailPage } from '@/modules/galleries/galleryDetailPage'
import { photoDetailPage } from '@/modules/photo-viewer/photoDetailPage'
import { photosPage } from '@/modules/photos/photosPage'
import { profileSheetPage } from '@/modules/photos/profileSheetPage'
import { settingsPage } from '@/modules/settings/settingsPage'

export const Pages = {
  galleries: galleriesPage,
  galleryDetail: galleryDetailPage,
  photoDetail: photoDetailPage,
  photos: photosPage,
  profile: profileSheetPage,
  settings: settingsPage,
  signIn: signInPage,
} as const
