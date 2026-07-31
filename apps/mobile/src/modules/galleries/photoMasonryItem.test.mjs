import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoMasonryItem } from './photoMasonryItem.ts'

const basePhoto = {
  aspectRatio: 1.5,
  height: 800,
  id: 'photo-1',
  originalUrl: 'https://cdn.example.com/photo-1.jpg',
  thumbnailUrl: 'https://cdn.example.com/photo-1-thumb.jpg',
  width: 1200,
}

test('omits null optional values before passing a photo through the native Record bridge', () => {
  const item = buildPhotoMasonryItem(
    {
      ...basePhoto,
      thumbHash: null,
      video: null,
    },
    'Open photo 1',
  )

  assert.equal('thumbHash' in item, false)
  assert.equal('livePhotoVideoUrl' in item, false)
  assert.deepEqual(item, {
    accessibilityLabel: 'Open photo 1',
    aspectRatio: 1.5,
    height: 800,
    id: 'photo-1',
    originalUrl: 'https://cdn.example.com/photo-1.jpg',
    url: 'https://cdn.example.com/photo-1-thumb.jpg',
    width: 1200,
  })
})

test('preserves present thumbnail and Live Photo fields for native rendering', () => {
  const item = buildPhotoMasonryItem(
    {
      ...basePhoto,
      thumbHash: 'thumbnail-hash',
      video: { type: 'live-photo', videoUrl: 'https://cdn.example.com/photo-1.mov' },
    },
    'Open photo 1',
  )

  assert.equal(item.thumbHash, 'thumbnail-hash')
  assert.equal(item.livePhotoVideoUrl, 'https://cdn.example.com/photo-1.mov')
})
