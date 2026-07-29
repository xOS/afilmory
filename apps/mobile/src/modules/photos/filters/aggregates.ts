import type { GalleryPhoto } from '@/modules/galleries/types'

export interface FilterOption {
  value: string
  count: number
}

export interface FilterOptions {
  tags: FilterOption[]
  cameras: FilterOption[]
  lenses: FilterOption[]
  ratedCount: number
}

function increment(counts: Map<string, number>, value: string): void {
  counts.set(value, (counts.get(value) ?? 0) + 1)
}

function toSortedOptions(counts: Map<string, number>): FilterOption[] {
  return Array.from(counts.entries(), ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  )
}

export function buildFilterOptions(photos: GalleryPhoto[]): FilterOptions {
  const tagCounts = new Map<string, number>()
  const cameraCounts = new Map<string, number>()
  const lensCounts = new Map<string, number>()
  let ratedCount = 0

  for (const photo of photos) {
    for (const tag of photo.tags) {
      increment(tagCounts, tag)
    }
    if (photo.camera) {
      increment(cameraCounts, photo.camera)
    }
    if (photo.lens) {
      increment(lensCounts, photo.lens)
    }
    if (photo.rating !== null) {
      ratedCount++
    }
  }

  return {
    tags: toSortedOptions(tagCounts),
    cameras: toSortedOptions(cameraCounts),
    lenses: toSortedOptions(lensCounts),
    ratedCount,
  }
}
