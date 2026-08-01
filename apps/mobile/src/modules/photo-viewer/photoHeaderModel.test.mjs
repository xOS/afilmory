import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoHeaderModel } from './photoHeaderModel.ts'

// Node ships the full Intl but Hermes ships only Collator/DateTimeFormat/NumberFormat.
// Dropping the constructor here makes this suite fail the way the device does.
delete globalThis.Intl.RelativeTimeFormat

const now = new Date('2026-08-01T15:00:00')
const strings = { fallbackTitle: 'Photo', today: 'Today', yesterday: 'Yesterday' }

function photo(overrides = {}) {
  return {
    city: null,
    dateTaken: null,
    location: null,
    title: '',
    ...overrides,
  }
}

test('uses a localized relative capture day and resolves place from location.city', () => {
  const model = buildPhotoHeaderModel(
    photo({ dateTaken: '2026-08-01T13:23:00', location: { city: 'Kyoto', country: 'Japan' } }),
    'en',
    strings,
    now,
  )

  assert.equal(model.title, 'Today')
  assert.match(model.subtitle, /1:23 PM/)
  assert.match(model.subtitle, /Kyoto/)
  assert.doesNotMatch(model.subtitle, /Japan/)
})

test('falls back to photo.city when location.city is null', () => {
  const model = buildPhotoHeaderModel(
    photo({ city: 'Osaka', dateTaken: '2026-08-01T13:23:00', location: { city: null, country: 'Japan' } }),
    'en',
    strings,
    now,
  )

  assert.match(model.subtitle, /Osaka/)
  assert.doesNotMatch(model.subtitle, /Japan/)
})

test('falls back to location.country only when both city fields are absent', () => {
  const model = buildPhotoHeaderModel(
    photo({ dateTaken: '2026-08-01T13:23:00', location: { city: null, country: 'Japan' } }),
    'en',
    strings,
    now,
  )

  assert.match(model.subtitle, /Japan/)
})

test('treats whitespace-only city fields as absent', () => {
  const model = buildPhotoHeaderModel(
    photo({ city: '   ', dateTaken: '2026-08-01T13:23:00', location: { city: '  ', country: 'Japan' } }),
    'en',
    strings,
    now,
  )

  assert.match(model.subtitle, /Japan/)
})

test('labels a photo captured today', () => {
  const model = buildPhotoHeaderModel(photo({ dateTaken: '2026-08-01T13:23:00' }), 'en', strings, now)

  assert.equal(model.title, 'Today')
})

test('labels a photo captured yesterday', () => {
  const model = buildPhotoHeaderModel(photo({ dateTaken: '2026-07-31T13:23:00' }), 'en', strings, now)

  assert.equal(model.title, 'Yesterday')
})

test('formats a distant capture date instead of a relative day', () => {
  const model = buildPhotoHeaderModel(photo({ dateTaken: '2020-01-15T13:23:00' }), 'en', strings, now)

  assert.equal(model.title, 'Jan 15, 2020')
})

test('falls back to the photo title when dateTaken is missing', () => {
  const model = buildPhotoHeaderModel(photo({ title: 'Quiet coast' }), 'en', strings, now)

  assert.deepEqual(model, { subtitle: '', title: 'Quiet coast' })
})

test('falls back to fallbackTitle when dateTaken and title are both blank', () => {
  const model = buildPhotoHeaderModel(photo({ title: '   ' }), 'en', strings, now)

  assert.deepEqual(model, { subtitle: '', title: 'Photo' })
})

test('falls back to the photo title when dateTaken is unparseable', () => {
  const model = buildPhotoHeaderModel(photo({ dateTaken: 'not-a-date', title: 'Quiet coast' }), 'en', strings, now)

  assert.deepEqual(model, { subtitle: '', title: 'Quiet coast' })
})

test('never includes a page index in the title or subtitle', () => {
  const model = buildPhotoHeaderModel(
    photo({ dateTaken: '2026-08-01T13:23:00', location: { city: 'Kyoto', country: 'Japan' } }),
    'en',
    strings,
    now,
  )

  assert.doesNotMatch(model.title, /\d+ \/ \d+/)
  assert.doesNotMatch(model.subtitle, /\d+ \/ \d+/)
})
