import type { GalleryVideoSource } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function httpUrl(value: unknown, baseUrl?: string): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  try {
    const url = baseUrl ? new URL(value.trim(), baseUrl) : new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  }
  catch {
    return null
  }
}

/**
 * Converts the public manifest video union into the JSON-safe subset consumed
 * by the mobile application. Invalid or incomplete sources are not exposed to
 * the native media layer.
 */
export function normalizeGalleryVideoSource(value: unknown, baseUrl?: string): GalleryVideoSource | null {
  if (!isRecord(value)) {
    return null
  }

  if (value.type === 'live-photo') {
    const videoUrl = httpUrl(value.videoUrl, baseUrl)
    return videoUrl ? { type: 'live-photo', videoUrl } : null
  }

  if (value.type === 'motion-photo') {
    const offset = finiteNumber(value.offset)
    if (offset === undefined || offset < 0) {
      return null
    }

    const size = finiteNumber(value.size)
    const presentationTimestamp = finiteNumber(value.presentationTimestamp)
    return {
      type: 'motion-photo',
      offset,
      ...(size !== undefined && size >= 0 ? { size } : {}),
      ...(presentationTimestamp !== undefined ? { presentationTimestamp } : {}),
    }
  }

  return null
}

export function livePhotoVideoUrl(video: GalleryVideoSource | null | undefined): string | null {
  return video?.type === 'live-photo' ? video.videoUrl : null
}

export function isLivePhoto(video: GalleryVideoSource | null | undefined): boolean {
  return livePhotoVideoUrl(video) !== null
}
