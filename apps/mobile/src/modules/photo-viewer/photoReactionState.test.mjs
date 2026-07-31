import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  createPhotoReactionState,
  mergePhotoReactionCounts,
  normalizePhotoReactionCounts,
  rollbackLocalPhotoReaction,
  toggleLocalPhotoReaction,
} from './photoReactionState.ts'

test('normalizes the public reaction analysis response at the network boundary', () => {
  assert.deepEqual(normalizePhotoReactionCounts({ '🔥': 3.8, '👏': 0, '👍': 2, 'invalid': '4' }), { '🔥': 3, '👍': 2 })
  assert.deepEqual(normalizePhotoReactionCounts(null), {})
})

test('optimistic photo reactions match the Web add and local-toggle behavior', () => {
  const initial = createPhotoReactionState({ '👍': 4 })
  const reacted = toggleLocalPhotoReaction(initial, '👍')
  const toggledOff = toggleLocalPhotoReaction(reacted, '👍')

  assert.deepEqual(reacted.activeReactions, ['👍'])
  assert.equal(reacted.counts['👍'], 5)
  assert.deepEqual(toggledOff.activeReactions, [])
  assert.equal(toggledOff.counts['👍'], 4)
})

test('a failed optimistic request rolls back only its own reaction', () => {
  const withLike = toggleLocalPhotoReaction(createPhotoReactionState({ '🔥': 2 }), '👍')
  const withBoth = toggleLocalPhotoReaction(withLike, '🔥')
  const rolledBack = rollbackLocalPhotoReaction(withBoth, '👍')

  assert.deepEqual(rolledBack.activeReactions, ['🔥'])
  assert.equal(rolledBack.counts['👍'], undefined)
  assert.equal(rolledBack.counts['🔥'], 3)
})

test('late analysis results preserve reactions selected while counts were loading', () => {
  const optimistic = toggleLocalPhotoReaction(createPhotoReactionState(), '🙌')
  const merged = mergePhotoReactionCounts(optimistic, { '👍': 7, '🙌': 2 })

  assert.deepEqual(merged.activeReactions, ['🙌'])
  assert.equal(merged.counts['👍'], 7)
  assert.equal(merged.counts['🙌'], 3)
})
