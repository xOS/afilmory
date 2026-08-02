import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  addLocalReactions,
  createPhotoReactionState,
  mergePhotoReactionCounts,
  normalizePhotoReactionCounts,
  rollbackLocalReactions,
} from './photoReactionState.ts'

test('normalizes the public reaction analysis response at the network boundary', () => {
  assert.deepEqual(normalizePhotoReactionCounts({ '🔥': 3.8, '👏': 0, '👍': 2, 'invalid': '4' }), { '🔥': 3, '👍': 2 })
  assert.deepEqual(normalizePhotoReactionCounts(null), {})
})

test('applause accumulates instead of toggling', () => {
  const initial = createPhotoReactionState({ '👍': 4 })
  const once = addLocalReactions(initial, '👍', 1)
  const burst = addLocalReactions(once, '👍', 12)

  assert.equal(once.counts['👍'], 5)
  assert.equal(burst.counts['👍'], 17)
  assert.equal(burst.localDeltas['👍'], 13)
})

test('a non-positive count leaves the state untouched', () => {
  const initial = createPhotoReactionState({ '🔥': 2 })
  assert.equal(addLocalReactions(initial, '🔥', 0), initial)
  assert.equal(rollbackLocalReactions(initial, '🔥', -3), initial)
})

test('a failed submit rolls back only its own reaction and count', () => {
  const withLike = addLocalReactions(createPhotoReactionState({ '🔥': 2 }), '👍', 3)
  const withBoth = addLocalReactions(withLike, '🔥', 5)
  const rolledBack = rollbackLocalReactions(withBoth, '👍', 3)

  assert.equal(rolledBack.counts['👍'], undefined)
  assert.equal(rolledBack.localDeltas['👍'], undefined)
  assert.equal(rolledBack.counts['🔥'], 7)
  assert.equal(rolledBack.localDeltas['🔥'], 5)
})

test('rollback never drives a count below zero', () => {
  const state = addLocalReactions(createPhotoReactionState(), '🌟', 2)
  const rolledBack = rollbackLocalReactions(state, '🌟', 9)

  assert.equal(rolledBack.counts['🌟'], undefined)
  assert.equal(rolledBack.localDeltas['🌟'], undefined)
})

test('a late analysis snapshot replays claps sent while it was in flight', () => {
  const optimistic = addLocalReactions(createPhotoReactionState(), '🙌', 4)
  const merged = mergePhotoReactionCounts(optimistic, { '👍': 7, '🙌': 2 })

  assert.equal(merged.counts['👍'], 7)
  assert.equal(merged.counts['🙌'], 6)
  assert.equal(merged.localDeltas['🙌'], 4)
})
