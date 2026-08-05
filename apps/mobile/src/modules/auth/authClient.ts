import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'

import { getApiBaseUrl } from '@/api/client'
import { getBuildConfiguration } from '@/native/afilmorySession'

import { AUTH_COOKIE_PREFIX, AUTH_STORAGE_PREFIX, authStorage } from './authStorage'

function createClient() {
  return createAuthClient({
    baseURL: `${getApiBaseUrl()}/auth`,
    plugins: [
      expoClient({
        // Must track auth.provider.ts's cookiePrefix: the plugin drops every
        // Set-Cookie whose name does not start with this, so a mismatch means
        // the session is silently never persisted.
        cookiePrefix: AUTH_COOKIE_PREFIX,
        scheme: getBuildConfiguration().urlScheme,
        storagePrefix: AUTH_STORAGE_PREFIX,
        storage: authStorage,
      }),
    ],
  })
}

let instance: ReturnType<typeof createClient> | null = null

// Built lazily: the API base URL is only final once the environment override
// has hydrated, which happens after this module is first imported.
export function getAuthClient(): ReturnType<typeof createClient> {
  instance ??= createClient()
  return instance
}
