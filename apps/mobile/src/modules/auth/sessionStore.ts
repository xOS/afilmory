import { useSyncExternalStore } from 'react'

import { setAuthCookie } from '@/api/auth'
import { setActiveTenantSlug } from '@/api/client'

import { fetchSession, switchActiveWorkspace } from './api'
import { getAuthClient } from './authClient'
import type { AuthProviderId, SessionInfo } from './types'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export interface AuthState {
  status: AuthStatus
  session: SessionInfo | null
}

let state: AuthState = { status: 'loading', session: null }
const listeners = new Set<() => void>()

function setState(next: AuthState) {
  state = next
  for (const listener of listeners) {
    listener()
  }
}

function getSnapshot(): AuthState {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function resetToSignedOut() {
  setAuthCookie(null)
  setActiveTenantSlug(null)
  setState({ status: 'signedOut', session: null })
}

function setSignedIn(session: SessionInfo, cookie: string | null) {
  setAuthCookie(cookie)
  setActiveTenantSlug(session.activeWorkspace?.slug)
  setState({ status: 'signedIn', session })
}

export async function hydrateAuth(): Promise<void> {
  try {
    const cookie = getAuthClient().getCookie()
    if (!cookie) {
      resetToSignedOut()
      return
    }
    const session = await fetchSession(cookie)
    if (!session) {
      resetToSignedOut()
      return
    }
    setSignedIn(session, cookie)
  }
  catch {
    resetToSignedOut()
  }
}

export async function signInWithProvider(provider: AuthProviderId): Promise<void> {
  const result = await getAuthClient().signIn.social({ provider, callbackURL: '/' })
  if (result.error) {
    throw new Error(result.error.message ?? 'Sign-in failed.')
  }
  const cookie = getAuthClient().getCookie()
  const session = await fetchSession(cookie)
  if (!session) {
    throw new Error('Sign-in did not produce a session.')
  }
  setSignedIn(session, cookie)
}

// Dev-only: the local stack has no usable third-party OAuth credentials, so
// email/password (enabled backend-side) is the only way into it.
export async function signInWithPassword(email: string, password: string): Promise<void> {
  // The cookie is read off the response rather than via authClient.getCookie():
  // the expo plugin backs that getter with SecureStore's synchronous getItem,
  // which throws `A required entitlement isn't present` on simulator builds.
  let responseCookie: string | null = null
  const result = await getAuthClient().signIn.email({
    email,
    password,
    fetchOptions: {
      onResponse({ response }) {
        const setCookie = response.headers.get('set-cookie')
        responseCookie = setCookie ? setCookie.split(';')[0] : null
      },
    },
  })
  if (result.error) {
    throw new Error(result.error.message ?? 'Sign-in failed.')
  }
  const session = await fetchSession(responseCookie)
  if (!session) {
    throw new Error('Sign-in did not produce a session.')
  }
  setSignedIn(session, responseCookie)
}

export async function signOut(): Promise<void> {
  await getAuthClient()
    .signOut()
    .catch(() => {})
  resetToSignedOut()
}

export async function switchWorkspace(tenantId: string): Promise<void> {
  const cookie = getAuthClient().getCookie()
  if (!cookie) {
    resetToSignedOut()
    throw new Error('A valid session is required to switch workspaces.')
  }

  await switchActiveWorkspace(cookie, tenantId)
  const session = await fetchSession(cookie)
  if (!session) {
    resetToSignedOut()
    throw new Error('The session expired while switching workspaces.')
  }
  setSignedIn(session, cookie)
}
