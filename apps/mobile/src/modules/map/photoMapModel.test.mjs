import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoMapItems, resolvePhotoMapLocation } from './photoMapModel.ts'

const basePhoto = {
  id: 'photo-1',
  title: 'Harbour',
  description: '',
  originalUrl: 'https://example.com/original.jpg',
  thumbnailUrl: 'https://example.com/thumbnail.jpg',
  thumbHash: null,
  aspectRatio: 1.5,
  width: 6000,
  height: 4000,
  format: 'jpeg',
  size: null,
  dateTaken: null,
  video: null,
  tags: [],
  exif: null,
  toneAnalysis: null,
  location: null,
  camera: null,
  lens: null,
  rating: null,
  city: null,
}

test('resolves signed EXIF coordinates before server-derived coordinates', () => {
  const location = resolvePhotoMapLocation({
    ...basePhoto,
    exif: {
      GPSLatitude: 33.8688,
      GPSLatitudeRef: 'S',
      GPSLongitude: 151.2093,
      GPSLongitudeRef: 'E',
    },
    location: {
      latitude: 1.3521,
      longitude: 103.8198,
      country: 'Singapore',
      city: 'Singapore',
      locationName: null,
    },
  })

  assert.deepEqual(location, { latitude: -33.8688, longitude: 151.2093 })
})

test('falls back to the manifest location when embedded EXIF is unavailable', () => {
  const location = resolvePhotoMapLocation({
    ...basePhoto,
    location: {
      latitude: 1.3521,
      longitude: 103.8198,
      country: 'Singapore',
      city: 'Singapore',
      locationName: 'Marina Bay',
    },
  })

  assert.deepEqual(location, { latitude: 1.3521, longitude: 103.8198 })
})

test('excludes incomplete and invalid coordinates from map annotations', () => {
  const photos = [
    basePhoto,
    { ...basePhoto, id: 'incomplete', location: { latitude: 1, longitude: null } },
    { ...basePhoto, id: 'invalid', exif: { GPSLatitude: 95, GPSLongitude: 10 } },
    {
      ...basePhoto,
      id: 'valid',
      title: '',
      location: { latitude: 51.5072, longitude: -0.1276 },
    },
  ]

  assert.deepEqual(buildPhotoMapItems(photos, photo => `Open ${photo.id}`), [
    {
      accessibilityLabel: 'Open valid',
      id: 'valid',
      index: 3,
      latitude: 51.5072,
      longitude: -0.1276,
      thumbnailUrl: basePhoto.thumbnailUrl,
      title: 'valid',
    },
  ])
})
