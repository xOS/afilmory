import { ofetch } from 'ofetch'

import { getApiBaseUrl } from '@/api/client'

import { camelCaseKeys } from './case'
import type { SessionInfo, SessionMembership, SessionUser, SessionWorkspace } from './types'

interface SessionResponse {
  user?: SessionUser | null
  activeWorkspace?: SessionWorkspace | null
  requestedWorkspace?: SessionWorkspace | null
  requestedMembership?: Omit<SessionMembership, 'workspace'> | null
  memberships?: SessionMembership[]
}

export async function fetchSession(cookie: string | null): Promise<SessionInfo | null> {
  const raw = await ofetch<unknown>(`${getApiBaseUrl()}/auth/session`, {
    headers: cookie ? { cookie } : undefined,
  })
  if (!raw) {
    return null
  }

  const data = camelCaseKeys<SessionResponse>(raw)
  if (!data.user) {
    return null
  }

  const memberships = data.memberships ?? []
  const activeWorkspace = data.activeWorkspace ?? null
  const activeMembership = activeWorkspace
    ? (memberships.find(
        membership => membership.status === 'active' && membership.workspace.id === activeWorkspace.id,
      ) ?? null)
    : null

  return {
    user: data.user,
    activeWorkspace,
    requestedWorkspace: data.requestedWorkspace ?? null,
    requestedMembership: data.requestedMembership ?? null,
    memberships,
    activeMembership,
  }
}

export async function switchActiveWorkspace(cookie: string | null, tenantId: string): Promise<void> {
  await ofetch(`${getApiBaseUrl()}/auth/workspaces/switch`, {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
    body: { tenantId },
  })
}
