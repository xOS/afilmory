import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoSidebarQuickFilters, buildPhotoSidebarTags } from './sidebarModel.ts'

const emptyFilters = {
  cameras: [],
  dateFrom: null,
  datePreset: null,
  dateTo: null,
  lenses: [],
  minRating: null,
  tagMode: 'any',
  tags: [],
}

function photo(dateTaken, rating = null) {
  return { dateTaken, rating }
}

test('shows only useful quick filters and reports their matching photo counts', () => {
  const items = buildPhotoSidebarQuickFilters(
    [photo('2026-08-01T10:00:00Z', 4), photo('2026-04-02T10:00:00Z', 5), photo('2025-12-20T10:00:00Z', 3)],
    { ...emptyFilters, datePreset: 'thisMonth' },
    { rating4: '4+', thisMonth: 'Month', thisYear: 'Year' },
    new Date(2026, 7, 2),
  )

  assert.deepEqual(
    items.map(({ count, id, selected }) => ({ count, id, selected })),
    [
      { count: 1, id: 'thisMonth', selected: true },
      { count: 2, id: 'thisYear', selected: false },
      { count: 2, id: 'rating4', selected: false },
    ],
  )
})

test('keeps a selected zero-result quick filter visible so it can be cleared', () => {
  const items = buildPhotoSidebarQuickFilters(
    [],
    { ...emptyFilters, minRating: 4 },
    { rating4: '4+', thisMonth: 'Month', thisYear: 'Year' },
    new Date(2026, 7, 2),
  )

  assert.deepEqual(
    items.map(item => item.id),
    ['rating4'],
  )
  assert.equal(items[0].selected, true)
})

test('pins selected tags before popular tags and preserves missing selections', () => {
  const result = buildPhotoSidebarTags(
    [
      { count: 12, value: 'travel' },
      { count: 9, value: 'street' },
      { count: 4, value: 'film' },
      { count: 2, value: 'night' },
    ],
    ['film', 'archived'],
    3,
  )

  assert.deepEqual(
    result.items.map(({ count, id, selected }) => ({ count, id, selected })),
    [
      { count: 4, id: 'film', selected: true },
      { count: 0, id: 'archived', selected: true },
      { count: 12, id: 'travel', selected: false },
    ],
  )
  assert.equal(result.hasMore, true)
})

test('does not offer an all-tags action when every available tag is visible', () => {
  const result = buildPhotoSidebarTags(
    [
      { count: 3, value: 'travel' },
      { count: 2, value: 'film' },
    ],
    [],
    8,
  )

  assert.equal(result.hasMore, false)
})
