import { requireNativeModule } from 'expo'
import { Platform } from 'react-native'

interface AfilmorySessionNativeModule {
  clearSession: () => void
  hasStoredCookie: () => boolean
  registerSession: (cookie: string) => void
  setApiEnvironment: (
    id: string,
    label: string,
    scheme: 'http' | 'https',
    platformHost: string,
    baseDomain: string,
    port: number | null,
  ) => void
}

const nativeSession
  = Platform.OS === 'ios' ? (requireNativeModule('AfilmorySession') as AfilmorySessionNativeModule) : null

export function registerNativeSession(cookie: string): void {
  nativeSession?.registerSession(cookie)
}

export function clearNativeSession(): void {
  nativeSession?.clearSession()
}

export function hasStoredNativeCookie(): boolean {
  return nativeSession?.hasStoredCookie() ?? false
}

export function setNativeApiEnvironment(environment: {
  id: string
  label: string
  scheme: 'http' | 'https'
  platformHost: string
  baseDomain: string
  port: number | null
}): void {
  nativeSession?.setApiEnvironment(
    environment.id,
    environment.label,
    environment.scheme,
    environment.platformHost,
    environment.baseDomain,
    environment.port,
  )
}
