import { requireNativeModule } from 'expo'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

export type AfilmoryAppVariant = 'local' | 'production'

export interface AfilmoryBuildConfiguration {
  allowsApiEnvironmentOverride: boolean
  apiEnvironment: AfilmoryAppVariant
  appVariant: AfilmoryAppVariant
  supportsAppleAuthentication: boolean
  urlScheme: string
}

interface AfilmorySessionNativeModule {
  clearSession: () => void
  getBuildConfiguration: () => AfilmoryBuildConfiguration
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

const fallbackVariant = Constants.expoConfig?.extra?.appVariant === 'local' ? 'local' : 'production'
const fallbackBuildConfiguration: AfilmoryBuildConfiguration = {
  allowsApiEnvironmentOverride: __DEV__,
  apiEnvironment: fallbackVariant,
  appVariant: fallbackVariant,
  supportsAppleAuthentication: fallbackVariant === 'production',
  urlScheme: fallbackVariant === 'local' ? 'afilmory-local' : 'afilmory',
}

export function getBuildConfiguration(): AfilmoryBuildConfiguration {
  try {
    return nativeSession?.getBuildConfiguration() ?? fallbackBuildConfiguration
  }
  catch {
    return fallbackBuildConfiguration
  }
}

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
