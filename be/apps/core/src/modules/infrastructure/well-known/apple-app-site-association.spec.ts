import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { APPLE_APP_SITE_ASSOCIATION, appleAppSiteAssociationResponse } from './apple-app-site-association'

const TEAM_APP_ID = 'KAMM5N88X3.app.afilmory'

const expectedPaths = ['/photos', '/map', '/explore', '/studio', '/studio/*']

describe('apple-app-site-association', () => {
  it('binds Universal Links to the production iOS app id', () => {
    expect(APPLE_APP_SITE_ASSOCIATION.applinks.details).toEqual([
      {
        appIDs: [TEAM_APP_ID],
        components: expectedPaths.map(path => ({ '/': path })),
      },
    ])
  })

  it('does not claim the site homepage so the landing page stays in Safari', () => {
    const paths = APPLE_APP_SITE_ASSOCIATION.applinks.details.flatMap(detail =>
      detail.components.map(component => component['/']))

    expect(paths).not.toContain('/')
    expect(paths).not.toContain('/privacy')
    expect(paths).not.toContain('/support')
    expect(paths).not.toContain('/terms')
  })

  it('advertises webcredentials for Sign in with Apple', () => {
    expect(APPLE_APP_SITE_ASSOCIATION.webcredentials.apps).toEqual([TEAM_APP_ID])
  })

  it('returns JSON without wrapping or snake_case rewriting', async () => {
    const response = appleAppSiteAssociationResponse()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    await expect(response.json()).resolves.toEqual(APPLE_APP_SITE_ASSOCIATION)
  })

  it('matches the public static copies on the backend and landing site', () => {
    const payload = JSON.stringify(APPLE_APP_SITE_ASSOCIATION)
    const files = [
      resolve(process.cwd(), 'public/.well-known/apple-app-site-association'),
      resolve(process.cwd(), '../../../apps/site/public/.well-known/apple-app-site-association'),
      resolve(process.cwd(), '../../../apps/site/public/apple-app-site-association'),
    ]

    for (const file of files) {
      expect(readFileSync(file, 'utf8').trim()).toBe(payload)
    }
  })
})
