import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoHeaderModel } from './photoHeaderModel.ts'

test('uses a localized relative capture day when a photo has no explicit title', () => {
  const model = buildPhotoHeaderModel(
    { dateTaken: '2026-08-01T13:23:00', title: '' },
    6,
    12,
    'en',
    'Photo',
    new Date('2026-08-01T15:00:00'),
  )

  assert.equal(model.title, 'Today')
  assert.match(model.subtitle, /1:23 PM/)
  assert.match(model.subtitle, /7 \/ 12/)
})

test('keeps an explicit title and falls back cleanly for an invalid capture date', () => {
  assert.deepEqual(
    buildPhotoHeaderModel(
      { dateTaken: 'not-a-date', title: 'Quiet coast' },
      0,
      1,
      'en',
      'Photo',
      new Date('2026-08-01T15:00:00'),
    ),
    { subtitle: '', title: 'Quiet coast' },
  )
})
