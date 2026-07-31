import { clearFilters } from './filters/filterStore'

let currentSlug: string | null = null

export function setHomeFeed(slug: string): void {
  if (currentSlug === slug) {
    return
  }
  currentSlug = slug
  clearFilters()
}

export function clearHomeFeed(): void {
  currentSlug = null
}
