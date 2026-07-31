export type AdaptiveWidthClass = 'compact' | 'regular' | 'wide'

export interface ExploreGridMetrics {
  columns: number
  gap: number
  horizontalPadding: number
}

const REGULAR_WIDTH = 600
const WIDE_WIDTH = 1000
const PHOTO_INSPECTOR_WIDTH = 900
const STUDIO_GRID_WIDTH = 760
const STUDIO_SPLIT_VIEW_WIDTH = 900
const EXPLORE_MIN_CARD_WIDTH = 300
const EXPLORE_MAX_COLUMNS = 3

export function classifyAdaptiveWidth(width: number): AdaptiveWidthClass {
  if (width < REGULAR_WIDTH) {
    return 'compact'
  }
  if (width < WIDE_WIDTH) {
    return 'regular'
  }
  return 'wide'
}

export function getExploreGridMetrics(width: number): ExploreGridMetrics {
  const widthClass = classifyAdaptiveWidth(width)
  const horizontalPadding = widthClass === 'wide' ? 28 : widthClass === 'regular' ? 20 : 16
  const gap = widthClass === 'compact' ? 14 : 16
  const availableWidth = Math.max(0, width - horizontalPadding * 2)
  const columns = Math.max(
    1,
    Math.min(EXPLORE_MAX_COLUMNS, Math.floor((availableWidth + gap) / (EXPLORE_MIN_CARD_WIDTH + gap))),
  )

  return { columns, gap, horizontalPadding }
}

export function supportsPhotoInspector(width: number): boolean {
  return width >= PHOTO_INSPECTOR_WIDTH
}

export function supportsStudioGrid(width: number): boolean {
  return width >= STUDIO_GRID_WIDTH
}

export function supportsStudioSplitView(width: number): boolean {
  return width >= STUDIO_SPLIT_VIEW_WIDTH
}
