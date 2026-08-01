import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'

import { getApiBaseUrl } from '@/api/client'

function createClient() {
  return createAuthClient({
    baseURL: `${getApiBaseUrl()}/auth`,
    plugins: [
      expoClient({
        scheme: 'afilmory',
        storagePrefix: 'afilmory',
        storage: SecureStore,
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
