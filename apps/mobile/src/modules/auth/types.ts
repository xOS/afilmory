export type AuthProviderId = 'github' | 'google'

export interface SessionUser {
  id: string
  name: string
  email: string
  image?: string | null
  role?: 'user' | 'superadmin' | null
}

export interface SessionWorkspace {
  id: string
  slug: string
  name: string
  status: string
  isPlaceholder?: boolean
}

export interface SessionMembership {
  id: string
  role: 'member' | 'admin' | 'owner'
  status: 'active' | 'suspended'
  workspace: SessionWorkspace
}

export interface SessionInfo {
  user: SessionUser
  activeWorkspace: SessionWorkspace | null
  requestedWorkspace: SessionWorkspace | null
  requestedMembership: Omit<SessionMembership, 'workspace'> | null
  memberships: SessionMembership[]
  activeMembership: SessionMembership | null
}
