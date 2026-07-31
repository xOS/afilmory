import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { collectProfileStats } from './profileStats.ts'

function photo(dateTaken, camera = null, lens = null) {
  return { dateTaken, camera, lens }
}

test('counts photos, distinct cameras, and distinct lenses', () => {
  const stats = collectProfileStats([
    photo('2024-06-02T10:00:00Z', 'X-T5', '23mm'),
    photo('2024-06-03T10:00:00Z', 'X-T5', '56mm'),
    photo('2024-06-04T10:00:00Z', 'GR III', '23mm'),
  ])
  assert.equal(stats.photoCount, 3)
  assert.equal(stats.cameraCount, 2)
  assert.equal(stats.lensCount, 2)
})

test('spans the earliest and latest years', () => {
  const stats = collectProfileStats([
    photo('2019-01-01T00:00:00Z'),
    photo('2026-05-01T00:00:00Z'),
    photo('2022-08-01T00:00:00Z'),
  ])
  assert.equal(stats.yearSpan, '2019–2026')
})

test('collapses a single year', () => {
  const stats = collectProfileStats([
    photo('2024-02-01T00:00:00Z'),
    photo('2024-11-01T00:00:00Z'),
  ])
  assert.equal(stats.yearSpan, '2024')
})

test('ignores missing and invalid dates', () => {
  const stats = collectProfileStats([
    photo(null, 'X-T5'),
    photo('not-a-date'),
    photo('2023-03-01T00:00:00Z'),
  ])
  assert.equal(stats.yearSpan, '2023')
  assert.equal(stats.cameraCount, 1)
})

test('returns null span for an undated or empty feed', () => {
  assert.equal(collectProfileStats([]).yearSpan, null)
  assert.equal(collectProfileStats([photo(null)]).yearSpan, null)
})
