import * as SecureStore from 'expo-secure-store'

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

function readPersistedEnvironment(): ApiEnvironment {
  if (!__DEV__) {
    return PRODUCTION_ENVIRONMENT
  }

  try {
    return parseEnvironment(SecureStore.getItem(STORAGE_KEY)) ?? PRODUCTION_ENVIRONMENT
  }
  catch {
    return PRODUCTION_ENVIRONMENT
  }
}

// Resolved once at module load via the synchronous SecureStore API so that
// every URL-building module below can stay a plain constant. Changing the
// environment therefore requires an app reload, which is also what clears the
// in-memory session and query caches.
const activeEnvironment = readPersistedEnvironment()

export function getActiveEnvironment(): ApiEnvironment {
  return activeEnvironment
}

export function persistEnvironment(next: ApiEnvironment): void {
  SecureStore.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function buildPlatformOrigin(environment: ApiEnvironment): string {
  return `${environment.scheme}://${environment.platformHost}`
}

export function buildTenantOrigin(environment: ApiEnvironment, slug: string): string {
  const port = environment.port === null ? '' : `:${environment.port}`
  return `${environment.scheme}://${slug}.${environment.baseDomain}${port}`
}
