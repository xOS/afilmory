import type { GalleryPhoto } from '@/modules/galleries/types'

export interface PhotoViewerSession {
  gallerySlug: string | null
  id: string
  initialIndex: number
  photos: GalleryPhoto[]
  transitionId: string
}

let nextSessionId = 1
const sessions = new Map<string, PhotoViewerSession>()

export function createPhotoViewerSession(
  photos: GalleryPhoto[],
  initialIndex: number,
  transitionId: string,
  gallerySlug: string | null,
): PhotoViewerSession {
  const session: PhotoViewerSession = {
    gallerySlug,
    id: `photo-viewer-${nextSessionId++}`,
    initialIndex,
    photos,
    transitionId,
  }
  sessions.set(session.id, session)
  return session
}

export function getPhotoViewerSession(id: string): PhotoViewerSession | null {
  return sessions.get(id) ?? null
}

export function releasePhotoViewerSession(id: string): void {
  sessions.delete(id)
}
