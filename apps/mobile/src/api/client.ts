import { ofetch } from 'ofetch'

import { getAuthCookie } from './auth'
import { getApiBaseUrl, getTenantApiBaseUrl } from './endpoints'

export {
  getApiBaseUrl,
  getGalleryApiBaseUrl,
  getGalleryOrigin,
  getTenantApiBaseUrl,
  setActiveTenantSlug,
} from './endpoints'

function attachAuthCookie(headers: Headers): void {
  const cookie = getAuthCookie()
  if (cookie) {
    headers.set('Cookie', cookie)
  }
}

export const apiClient = ofetch.create({
  onRequest({ options }) {
    options.baseURL = getApiBaseUrl()
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
