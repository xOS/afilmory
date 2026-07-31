import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { formatVisibleMonthAnchor } from './dateRange.ts'

const currentYear = new Date().getFullYear()

function photo(dateTaken) {
  return { dateTaken }
}

test('picks the month holding the most visible photos', () => {
  const photos = [
    photo(`${currentYear}-06-02T10:00:00Z`),
    photo(`${currentYear}-06-01T10:00:00Z`),
    photo(`${currentYear}-05-20T10:00:00Z`),
  ]
  assert.equal(formatVisibleMonthAnchor(photos, 0, 2, 'en-US'), 'June')
})

test('breaks ties toward the newer month', () => {
  const photos = [
    photo(`${currentYear}-06-10T10:00:00Z`),
    photo(`${currentYear}-05-10T10:00:00Z`),
  ]
  assert.equal(formatVisibleMonthAnchor(photos, 0, 1, 'en-US'), 'June')
})

test('appends the year outside the current year', () => {
  const photos = [photo('2019-03-05T10:00:00Z')]
  assert.equal(formatVisibleMonthAnchor(photos, 0, 0, 'en-US'), 'March 2019')
})

test('returns null when no visible photo has a valid date', () => {
  const photos = [photo(null), photo('not-a-date')]
  assert.equal(formatVisibleMonthAnchor(photos, 0, 1, 'en-US'), null)
  assert.equal(formatVisibleMonthAnchor([], 0, 0, 'en-US'), null)
})

test('ignores out-of-range and undated photos when bucketing', () => {
  const photos = [
    photo(`${currentYear}-01-01T10:00:00Z`),
    photo(null),
    photo(`${currentYear}-02-01T10:00:00Z`),
    photo(`${currentYear}-06-01T10:00:00Z`),
  ]
  assert.equal(formatVisibleMonthAnchor(photos, 0, 2, 'en-US'), 'February')
})

test('formats through the locale', () => {
  const photos = [photo(`${currentYear}-06-01T10:00:00Z`)]
  assert.equal(formatVisibleMonthAnchor(photos, 0, 0, 'zh-CN'), '六月')
})
