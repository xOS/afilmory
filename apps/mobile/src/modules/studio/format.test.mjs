import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { collectSettingFields, formatBytes, formatTrendMonth, parseTags, photoAssetToGalleryPhoto } from './format'

test('photoAssetToGalleryPhoto produces a viewable native-gallery item with safe geometry', () => {
  const photo = photoAssetToGalleryPhoto({
    id: 'asset-1',
    photoId: 'photo-1',
    storageKey: 'photos/photo-1.jpg',
    storageProvider: 's3',
    manifest: {
      version: '1',
      data: {
        id: 'photo-1',
        originalUrl: 'https://example.com/photo.jpg',
        tags: ['street'],
        title: 'Night Walk',
      },
    },
    syncedAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
    createdAt: '2026-07-31T00:00:00.000Z',
    publicUrl: null,
    size: 1024,
    syncStatus: 'synced',
  })

  assert.equal(photo?.id, 'asset-1')
  assert.equal(photo?.thumbnailUrl, 'https://example.com/photo.jpg')
  assert.equal(photo?.aspectRatio, 1)
  assert.deepEqual(photo?.tags, ['street'])
})

test('photoAssetToGalleryPhoto rejects assets that have no displayable URL', () => {
  assert.equal(
    photoAssetToGalleryPhoto({
      id: 'asset-2',
      photoId: 'photo-2',
      storageKey: 'photos/photo-2.jpg',
      storageProvider: 's3',
      manifest: { version: '1', data: {} },
      syncedAt: '',
      updatedAt: '',
      createdAt: '',
      publicUrl: null,
      size: null,
      syncStatus: 'pending',
    }),
    null,
  )
})

test('parseTags trims, deduplicates, and caps submitted tags', () => {
  const input = ['travel', ' night ', 'travel', ...Array.from({ length: 40 }, (_, index) => `tag-${index}`)].join(',')
  const tags = parseTags(input)

  assert.deepEqual(tags.slice(0, 2), ['travel', 'night'])
  assert.equal(tags.length, 32)
})

test('formatTrendMonth produces compact locale-aware chart labels', () => {
  assert.equal(formatTrendMonth('2026-07', 'en-US'), 'Jul')
  assert.equal(formatTrendMonth('2026-07', 'zh-CN'), '7月')
  assert.equal(formatTrendMonth('invalid', 'en-US'), 'invalid')
})

test('collectSettingFields preserves server schema order through nested groups', () => {
  const fields = collectSettingFields([
    {
      type: 'group',
      id: 'social',
      title: 'Social',
      children: [
        { type: 'field', id: 'twitter', title: 'Twitter', key: 'site.social.twitter', component: { type: 'text' } },
        {
          type: 'field',
          id: 'hidden',
          title: 'Hidden',
          key: 'site.social.github',
          component: { type: 'text' },
          hidden: true,
        },
      ],
    },
    { type: 'field', id: 'name', title: 'Name', key: 'site.name', component: { type: 'text' } },
  ])

  assert.deepEqual(
    fields.map(field => field.key),
    ['site.social.twitter', 'site.name'],
  )
  assert.equal(formatBytes(1536, 'en'), '1.5 KB')
})
