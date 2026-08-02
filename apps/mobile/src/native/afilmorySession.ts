import { requireNativeModule } from 'expo'
import { Platform } from 'react-native'

interface AfilmorySessionNativeModule {
  clearSession: () => void
  hasStoredCookie: () => boolean
  registerEnvironment: (platformBaseURL: string, tenantBaseURL: string | null) => void
  registerSession: (cookie: string) => void
}

const nativeSession
  = Platform.OS === 'ios' ? (requireNativeModule('AfilmorySession') as AfilmorySessionNativeModule) : null

export function registerNativeSession(cookie: string): void {
  nativeSession?.registerSession(cookie)
}

export function clearNativeSession(): void {
  nativeSession?.clearSession()
}

export function registerNativeEnvironment(platformBaseURL: string, tenantBaseURL: string | null): void {
  nativeSession?.registerEnvironment(platformBaseURL, tenantBaseURL)
}

export function hasStoredNativeCookie(): boolean {
  return nativeSession?.hasStoredCookie() ?? false
}
