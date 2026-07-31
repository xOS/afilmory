import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { isLivePhoto, livePhotoVideoUrl, normalizeGalleryVideoSource } from './videoSource.ts'

test('preserves a valid Live Photo video URL for native playback', () => {
  const video = normalizeGalleryVideoSource({
    type: 'live-photo',
    videoUrl: '  https://cdn.example.com/photos/paired.mov  ',
    s3Key: 'photos/paired.mov',
  })

  assert.deepEqual(video, {
    type: 'live-photo',
    videoUrl: 'https://cdn.example.com/photos/paired.mov',
  })
  assert.equal(isLivePhoto(video), true)
  assert.equal(livePhotoVideoUrl(video), 'https://cdn.example.com/photos/paired.mov')
})

test('rejects an incomplete Live Photo instead of presenting an unusable playback affordance', () => {
  const video = normalizeGalleryVideoSource({ type: 'live-photo', videoUrl: '  ' })

  assert.equal(isLivePhoto(video), false)
  assert.equal(video, null)
  assert.equal(livePhotoVideoUrl(video), null)
})

test('resolves a server proxy path against the gallery origin', () => {
  const video = normalizeGalleryVideoSource(
    { type: 'live-photo', videoUrl: '/api/photos/assets/IMG_5484.mov/live-video' },
    'https://innei.afilmory.art',
  )

  assert.equal(livePhotoVideoUrl(video), 'https://innei.afilmory.art/api/photos/assets/IMG_5484.mov/live-video')
})

test('keeps Motion Photo metadata distinct from separately paired Live Photo media', () => {
  const video = normalizeGalleryVideoSource({
    type: 'motion-photo',
    offset: 4096,
    size: 1024,
    presentationTimestamp: 250_000,
  })

  assert.deepEqual(video, {
    type: 'motion-photo',
    offset: 4096,
    size: 1024,
    presentationTimestamp: 250_000,
  })
  assert.equal(isLivePhoto(video), false)
  assert.equal(livePhotoVideoUrl(video), null)
})
