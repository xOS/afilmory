import type { GalleryPhoto } from '@/modules/galleries/types'

import type { FilterOption } from '../filters/aggregates'
import type { PhotoFilters } from '../filters/filterTypes'
import { presetRange } from '../filters/filterTypes'

export type PhotoSidebarQuickFilterId = 'rating4' | 'thisMonth' | 'thisYear'

export interface PhotoSidebarItem {
  count: number
  id: string
  label: string
  selected: boolean
}

export interface PhotoSidebarQuickFilterLabels {
  rating4: string
  thisMonth: string
  thisYear: string
}

export interface PhotoSidebarTagItems {
  hasMore: boolean
  items: PhotoSidebarItem[]
}

const DEFAULT_TAG_LIMIT = 8
const HIGH_RATING = 4

function countDates(photos: GalleryPhoto[], from: string, to: string): number {
  let count = 0
  for (const photo of photos) {
    const date = photo.dateTaken?.slice(0, 10)
    if (date && date >= from && date <= to) {
      count++
    }
  }
  return count
}

export function buildPhotoSidebarQuickFilters(
  photos: GalleryPhoto[],
  filters: PhotoFilters,
  labels: PhotoSidebarQuickFilterLabels,
  now = new Date(),
): PhotoSidebarItem[] {
  const thisMonth = presetRange('thisMonth', now)
  const thisYear = presetRange('thisYear', now)
  const items: PhotoSidebarItem[] = [
    {
      count: countDates(photos, thisMonth.from, thisMonth.to),
      id: 'thisMonth',
      label: labels.thisMonth,
      selected: filters.datePreset === 'thisMonth',
    },
    {
      count: countDates(photos, thisYear.from, thisYear.to),
      id: 'thisYear',
      label: labels.thisYear,
      selected: filters.datePreset === 'thisYear',
    },
    {
      count: photos.filter(photo => photo.rating !== null && photo.rating >= HIGH_RATING).length,
      id: 'rating4',
      label: labels.rating4,
      selected: filters.minRating === HIGH_RATING,
    },
  ]

  return items.filter(item => item.count > 0 || item.selected)
}

export function buildPhotoSidebarTags(
  options: FilterOption[],
  selectedTags: string[],
  limit = DEFAULT_TAG_LIMIT,
): PhotoSidebarTagItems {
  const optionByValue = new Map(options.map(option => [option.value, option]))
  const selected = selectedTags.map((value) => {
    const option = optionByValue.get(value)
    return {
      count: option?.count ?? 0,
      id: value,
      label: value,
      selected: true,
    }
  })
  const selectedSet = new Set(selectedTags)
  const available = options.filter(option => !selectedSet.has(option.value))
  const remainingSlots = Math.max(0, limit - selected.length)
  const items = [
    ...selected,
    ...available.slice(0, remainingSlots).map(option => ({
      count: option.count,
      id: option.value,
      label: option.value,
      selected: false,
    })),
  ]

  return {
    hasMore: available.length > remainingSlots,
    items,
  }
}
