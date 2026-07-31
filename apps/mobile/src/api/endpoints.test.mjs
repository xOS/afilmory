import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { getGalleryApiBaseUrl, getTenantApiBaseUrl, setActiveTenantSlug } from './endpoints.ts'

test('builds tenant-scoped API URLs from the active workspace slug', () => {
  setActiveTenantSlug(' Innei ')
  assert.equal(getTenantApiBaseUrl(), 'https://innei.afilmory.art/api')
})

test('rejects missing and invalid tenant slugs', () => {
  setActiveTenantSlug(null)
  assert.throws(() => getTenantApiBaseUrl(), /No active workspace/)
  assert.throws(() => setActiveTenantSlug('invalid.slug'), /invalid slug/)
})

test('builds an isolated API URL for the gallery being viewed', () => {
  setActiveTenantSlug('owner-workspace')

  assert.equal(getGalleryApiBaseUrl(' Featured-Artist '), 'https://featured-artist.afilmory.art/api')
  assert.equal(getTenantApiBaseUrl(), 'https://owner-workspace.afilmory.art/api')
  assert.throws(() => getGalleryApiBaseUrl('attacker.example'), /invalid slug/)
})
