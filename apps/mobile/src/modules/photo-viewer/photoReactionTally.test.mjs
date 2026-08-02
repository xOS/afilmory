import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  accumulateReactionTally,
  drainReactionTally,
  expireReactionTally,
  REACTION_MERGE_WINDOW_MS,
} from './photoReactionTally.ts'

test('repeat claps on the same reaction inside the window merge into one submit', () => {
  const first = accumulateReactionTally(null, '🔥', 1, 1000)
  const second = accumulateReactionTally(first.tally, '🔥', 1, 1300)
  const third = accumulateReactionTally(second.tally, '🔥', 14, 1900)

  assert.equal(first.flush, null)
  assert.equal(second.flush, null)
  assert.equal(third.flush, null)
  assert.equal(third.tally.count, 16)
  assert.equal(third.tally.deadline, 1900 + REACTION_MERGE_WINDOW_MS)
})

test('touching a different reaction flushes the previous tally immediately', () => {
  const like = accumulateReactionTally(null, '👍', 3, 500)
  const fire = accumulateReactionTally(like.tally, '🔥', 1, 600)

  assert.deepEqual(fire.flush, { count: 3, reaction: '👍' })
  assert.deepEqual(fire.tally, { count: 1, deadline: 600 + REACTION_MERGE_WINDOW_MS, reaction: '🔥' })
})

test('a clap after the window closes flushes rather than extends', () => {
  const first = accumulateReactionTally(null, '👏', 2, 0)
  const late = accumulateReactionTally(first.tally, '👏', 1, REACTION_MERGE_WINDOW_MS)

  assert.deepEqual(late.flush, { count: 2, reaction: '👏' })
  assert.equal(late.tally.count, 1)
})

test('expiry flushes exactly once and only at the deadline', () => {
  const { tally } = accumulateReactionTally(null, '🌟', 5, 0)

  const early = expireReactionTally(tally, REACTION_MERGE_WINDOW_MS - 1)
  assert.equal(early.flush, null)
  assert.equal(early.tally, tally)

  const due = expireReactionTally(tally, REACTION_MERGE_WINDOW_MS)
  assert.deepEqual(due.flush, { count: 5, reaction: '🌟' })
  assert.equal(due.tally, null)

  assert.deepEqual(expireReactionTally(null, 9999), { flush: null, tally: null })
})

test('draining hands back whatever is pending and clears it', () => {
  const { tally } = accumulateReactionTally(null, '🙌', 7, 0)

  assert.deepEqual(drainReactionTally(tally), { flush: { count: 7, reaction: '🙌' }, tally: null })
  assert.deepEqual(drainReactionTally(null), { flush: null, tally: null })
})

test('a non-positive count is ignored without disturbing the pending tally', () => {
  const { tally } = accumulateReactionTally(null, '😍', 2, 0)
  const ignored = accumulateReactionTally(tally, '🔥', 0, 100)

  assert.equal(ignored.flush, null)
  assert.equal(ignored.tally, tally)
})
