import type { GalleryPhoto } from '@/modules/galleries/types'
import { normalizeGalleryVideoSource } from '@/modules/galleries/videoSource'

import type { PhotoAssetListItem, UiFieldNode, UiNode } from './types'

export function formatBytes(value: number | null | undefined, locale: string): string {
  if (!value || value < 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** unitIndex
  return `${amount.toLocaleString(locale, { maximumFractionDigits: amount >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

export function formatCount(value: number, locale: string): string {
  return value.toLocaleString(locale)
}

export function formatDateTime(value: string | null | undefined, locale: string): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatTrendMonth(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return value
  }
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    return value
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

export function photoAssetToGalleryPhoto(asset: PhotoAssetListItem): GalleryPhoto | null {
  const source = asset.manifest?.data
  const originalUrl = source?.originalUrl ?? asset.publicUrl
  const thumbnailUrl = source?.thumbnailUrl ?? originalUrl
  if (!originalUrl || !thumbnailUrl) {
    return null
  }

  const width = source.width && source.width > 0 ? source.width : 1
  const height = source.height && source.height > 0 ? source.height : 1
  const aspectRatio = source.aspectRatio && source.aspectRatio > 0 ? source.aspectRatio : width / height

  return {
    aspectRatio,
    camera: source.camera ?? null,
    city: source.city ?? source.location?.city ?? null,
    dateTaken: source.dateTaken ?? null,
    description: source.description ?? '',
    exif: source.exif ?? null,
    format: source.format ?? null,
    height,
    id: asset.id,
    lens: source.lens ?? null,
    location: source.location ?? null,
    originalUrl,
    rating: source.rating ?? null,
    size: asset.size ?? source.size ?? null,
    tags: source.tags ?? [],
    thumbnailUrl,
    thumbHash: source.thumbHash ?? null,
    title: source.title ?? source.id ?? asset.photoId,
    toneAnalysis: source.toneAnalysis ?? null,
    video: normalizeGalleryVideoSource(source.video, originalUrl),
    width,
  }
}

export function collectSettingFields(nodes: readonly UiNode[]): UiFieldNode[] {
  const fields: UiFieldNode[] = []
  for (const node of nodes) {
    if (node.type === 'field') {
      if (!node.hidden) {
        fields.push(node)
      }
      continue
    }
    fields.push(...collectSettingFields(node.children))
  }
  return fields
}

export function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 32)
}
