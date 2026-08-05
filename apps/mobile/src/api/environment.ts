import * as SecureStore from 'expo-secure-store'

import { getBuildConfiguration, setNativeApiEnvironment } from '@/native/afilmorySession'

export interface ApiEnvironment {
  id: string
  label: string
  scheme: 'http' | 'https'
  platformHost: string
  baseDomain: string
  port: number | null
}

export const PRODUCTION_ENVIRONMENT: ApiEnvironment = {
  id: 'production',
  label: 'Production',
  scheme: 'https',
  platformHost: 'api.afilmory.art',
  baseDomain: 'afilmory.art',
  port: null,
}

export const LOCAL_ENVIRONMENT: ApiEnvironment = {
  id: 'local',
  label: 'Local',
  scheme: 'http',
  platformHost: 'localhost:1841',
  baseDomain: 'localhost',
  port: 1841,
}

export const BUILT_IN_ENVIRONMENTS: readonly ApiEnvironment[] = [PRODUCTION_ENVIRONMENT, LOCAL_ENVIRONMENT]
export const BUILD_DEFAULT_ENVIRONMENT
  = getBuildConfiguration().apiEnvironment === 'local' ? LOCAL_ENVIRONMENT : PRODUCTION_ENVIRONMENT

const STORAGE_KEY = 'api.environment'
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i

function parseEnvironment(raw: string | null): ApiEnvironment | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ApiEnvironment>
    const { id, label, scheme, platformHost, baseDomain, port } = parsed

    if (typeof id !== 'string' || typeof label !== 'string') {
      return null
    }
    if (scheme !== 'http' && scheme !== 'https') {
      return null
    }
    if (typeof platformHost !== 'string' || !HOST_PATTERN.test(platformHost)) {
      return null
    }
    if (typeof baseDomain !== 'string' || !HOST_PATTERN.test(baseDomain)) {
      return null
    }
    if (port !== null && (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65_535)) {
      return null
    }

    return { id, label, scheme, platformHost, baseDomain, port }
  }
  catch {
    return null
  }
}

let activeEnvironment = BUILD_DEFAULT_ENVIRONMENT

// SecureStore's synchronous `getItem` throws `errSecMissingEntitlement` on
// simulator builds, so the override is hydrated asynchronously and the app
// blocks its first render on it — see waitForEnvironment.
const hydration: Promise<void> = getBuildConfiguration().allowsApiEnvironmentOverride
  ? SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        activeEnvironment = parseEnvironment(raw) ?? BUILD_DEFAULT_ENVIRONMENT
      })
      .catch(() => {})
  : Promise.resolve()

export function waitForEnvironment(): Promise<void> {
  return hydration
}

export function getActiveEnvironment(): ApiEnvironment {
  return activeEnvironment
}

export async function persistEnvironment(next: ApiEnvironment): Promise<void> {
  if (!getBuildConfiguration().allowsApiEnvironmentOverride) {
    throw new Error('API environment overrides are unavailable in release builds.')
  }
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next))
  setNativeApiEnvironment(next)
}

export async function resetEnvironment(): Promise<void> {
  if (!getBuildConfiguration().allowsApiEnvironmentOverride) {
    throw new Error('API environment overrides are unavailable in release builds.')
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY)
  setNativeApiEnvironment(BUILD_DEFAULT_ENVIRONMENT)
}

export function buildPlatformOrigin(environment: ApiEnvironment): string {
  return `${environment.scheme}://${environment.platformHost}`
}

export function buildTenantOrigin(environment: ApiEnvironment, slug: string): string {
  const port = environment.port === null ? '' : `:${environment.port}`
  return `${environment.scheme}://${slug}.${environment.baseDomain}${port}`
}
