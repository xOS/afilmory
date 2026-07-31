export const API_BASE_URL = 'https://api.afilmory.art/api'
export const SAAS_BASE_DOMAIN = 'afilmory.art'

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

export function getGalleryApiBaseUrl(slug: string): string {
  const normalized = normalizeTenantSlug(slug)
  if (!normalized) {
    throw new Error('A gallery workspace is required for this request.')
  }
  return `https://${normalized}.${SAAS_BASE_DOMAIN}/api`
}

export function getTenantApiBaseUrl(): string {
  if (!activeTenantSlug) {
    throw new Error('No active workspace is available for this request.')
  }
  return getGalleryApiBaseUrl(activeTenantSlug)
}
