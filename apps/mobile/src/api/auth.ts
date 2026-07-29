let authToken: string | null = null
const listeners = new Set<(token: string | null) => void>()

export function getAuthToken(): string | null {
  return authToken
}

export function setAuthToken(token: string | null): void {
  if (authToken === token) {
    return
  }
  authToken = token
  for (const listener of listeners) {
    listener(token)
  }
}

export function subscribeAuthToken(listener: (token: string | null) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
