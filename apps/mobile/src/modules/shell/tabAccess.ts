import type { AuthStatus } from '@/modules/auth/sessionStore'

export type AppTabName = 'photos' | 'map' | 'explore' | 'studio'

const AUTHENTICATED_TABS: readonly AppTabName[] = ['photos', 'map', 'explore', 'studio']
const SIGNED_OUT_TABS: readonly AppTabName[] = ['explore']

export function getAvailableTabNames(status: AuthStatus): readonly AppTabName[] {
  if (status === 'signedIn') {
    return AUTHENTICATED_TABS
  }
  if (status === 'signedOut') {
    return SIGNED_OUT_TABS
  }
  return []
}

export function getDefaultTabPath(status: AuthStatus): '/photos' | '/explore' | null {
  if (status === 'signedIn') {
    return '/photos'
  }
  if (status === 'signedOut') {
    return '/explore'
  }
  return null
}

export function shouldShowTabBar(status: AuthStatus): boolean {
  return status === 'signedIn'
}
