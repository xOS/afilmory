import { describe, expect, it } from 'vitest'

import { resolveAuthCookieScope } from './auth-cookie.policy'

describe('resolveAuthCookieScope', () => {
  it('shares the global session across platform-managed workspace subdomains', () => {
    expect(
      resolveAuthCookieScope({
        requestHost: 'alpha.afilmory.art',
        baseDomain: 'afilmory.art',
      }),
    ).toEqual({ kind: 'managed-domain', domain: 'afilmory.art' })
  })

  it('shares the session from the platform base and API hosts', () => {
    expect(
      resolveAuthCookieScope({
        requestHost: 'afilmory.art',
        baseDomain: 'afilmory.art',
      }),
    ).toEqual({ kind: 'managed-domain', domain: 'afilmory.art' })

    expect(
      resolveAuthCookieScope({
        requestHost: 'api.afilmory.art:443',
        baseDomain: 'afilmory.art',
      }),
    ).toEqual({ kind: 'managed-domain', domain: 'afilmory.art' })
  })

  it('uses a host-only cookie on verified custom domains', () => {
    expect(
      resolveAuthCookieScope({
        requestHost: 'photos.example.net',
        baseDomain: 'afilmory.art',
      }),
    ).toEqual({ kind: 'host-only' })
  })

  it('does not treat a lookalike suffix as a managed domain', () => {
    expect(
      resolveAuthCookieScope({
        requestHost: 'attacker-afilmory.art',
        baseDomain: 'afilmory.art',
      }),
    ).toEqual({ kind: 'host-only' })
  })

  it('supports the local workspace subdomain topology without sharing on IP hosts', () => {
    expect(
      resolveAuthCookieScope({
        requestHost: 'alpha.localhost:3000',
        baseDomain: 'localhost',
      }),
    ).toEqual({ kind: 'managed-domain', domain: 'localhost' })

    expect(
      resolveAuthCookieScope({
        requestHost: '127.0.0.1:3000',
        baseDomain: '127.0.0.1',
      }),
    ).toEqual({ kind: 'host-only' })
  })
})
