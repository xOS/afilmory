import { signInPage } from '@/modules/auth/signInPage'
import { photoCommentsPage } from '@/modules/comments/photoCommentsPage'
import { galleriesPage } from '@/modules/galleries/galleriesPage'
import { galleryDetailPage } from '@/modules/galleries/galleryDetailPage'
import { photoDetailPage } from '@/modules/photo-viewer/photoDetailPage'
import { photosPage } from '@/modules/photos/photosPage'

export const Pages = {
  galleries: galleriesPage,
  galleryDetail: galleryDetailPage,
  photoComments: photoCommentsPage,
  photoDetail: photoDetailPage,
  photos: photosPage,
  signIn: signInPage,
} as const
