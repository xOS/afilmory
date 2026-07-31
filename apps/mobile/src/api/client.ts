import { ofetch } from 'ofetch'

import { getAuthCookie } from './auth'
import { API_BASE_URL, getTenantApiBaseUrl } from './endpoints'

export {
  API_BASE_URL,
  getGalleryApiBaseUrl,
  getTenantApiBaseUrl,
  SAAS_BASE_DOMAIN,
  setActiveTenantSlug,
} from './endpoints'

function attachAuthCookie(headers: Headers): void {
  const cookie = getAuthCookie()
  if (cookie) {
    headers.set('Cookie', cookie)
  }
}

export const apiClient = ofetch.create({
  baseURL: API_BASE_URL,
  onRequest({ options }) {
    attachAuthCookie(options.headers)
  },
})

export const tenantApiClient = ofetch.create({
  onRequest({ options }) {
    options.baseURL = getTenantApiBaseUrl()
    attachAuthCookie(options.headers)
  },
})

export const galleryApiClient = ofetch.create({
  onRequest({ options }) {
    attachAuthCookie(options.headers)
  },
})
