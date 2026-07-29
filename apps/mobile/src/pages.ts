import { signInPage } from '@/modules/auth/signInPage'
import { galleriesPage } from '@/modules/galleries/galleriesPage'
import { galleryDetailPage } from '@/modules/galleries/galleryDetailPage'
import { filterSheetPage } from '@/modules/photos/filterSheetPage'
import { photosPage } from '@/modules/photos/photosPage'
import { profileSheetPage } from '@/modules/photos/profileSheetPage'
import { settingsPage } from '@/modules/settings/settingsPage'

export const Pages = {
  filterSheet: filterSheetPage,
  galleries: galleriesPage,
  galleryDetail: galleryDetailPage,
  photos: photosPage,
  profile: profileSheetPage,
  settings: settingsPage,
  signIn: signInPage,
} as const
