import { signInPage } from '@/modules/auth/signInPage'
import { galleriesPage } from '@/modules/galleries/galleriesPage'
import { galleryDetailPage } from '@/modules/galleries/galleryDetailPage'
import { filterSheetPage } from '@/modules/photos/filterSheetPage'
import { photosPage } from '@/modules/photos/photosPage'
import { settingsPage } from '@/modules/settings/settingsPage'

export const Pages = {
  filterSheet: filterSheetPage,
  galleries: galleriesPage,
  galleryDetail: galleryDetailPage,
  photos: photosPage,
  settings: settingsPage,
  signIn: signInPage,
} as const
