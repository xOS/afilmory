import { buildPlatformOrigin, buildTenantOrigin, getActiveEnvironment } from './environment'

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

let activeTenantSlug: string | null = null

function normalizeTenantSlug(slug: string | null | undefined): string | null {
  const normalized = slug?.trim().toLowerCase() || null
  if (normalized && !TENANT_SLUG_PATTERN.test(normalized)) {
    throw new Error('The workspace has an invalid slug.')
  }
  return normalized
}

export function setActiveTenantSlug(slug: string | null | undefined): void {
  activeTenantSlug = normalizeTenantSlug(slug)
}

export function getApiBaseUrl(): string {
  return `${buildPlatformOrigin(getActiveEnvironment())}/api`
}

export function getGalleryOrigin(slug: string): string {
  const normalized = normalizeTenantSlug(slug)
  if (!normalized) {
    throw new Error('A gallery workspace is required for this request.')
  }
  return buildTenantOrigin(getActiveEnvironment(), normalized)
}

export function getGalleryApiBaseUrl(slug: string): string {
  return `${getGalleryOrigin(slug)}/api`
}

export function getTenantApiBaseUrl(): string {
  if (!activeTenantSlug) {
    throw new Error('No active workspace is available for this request.')
  }
  return getGalleryApiBaseUrl(activeTenantSlug)
}
