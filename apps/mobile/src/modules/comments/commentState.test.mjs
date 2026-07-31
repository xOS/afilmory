import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  emptyCommentCollection,
  formatCommentRelativeTime,
  mergeCommentPage,
  removeOptimisticComment,
  replaceComment,
  settleOptimisticComment,
  toggleLocalReaction,
} from './commentState.ts'

function comment(id, overrides = {}) {
  return {
    id,
    photoId: 'photo-1',
    parentId: null,
    userId: 'user-1',
    content: id,
    status: 'approved',
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
    reactionCounts: {},
    viewerReactions: [],
    ...overrides,
  }
}

test('pagination merges relations and users while de-duplicating comments in server order', () => {
  const first = mergeCommentPage(
    emptyCommentCollection(),
    {
      comments: [
        comment('one', { createdAt: '2026-07-31T00:00:00.000Z' }),
        comment('two', { createdAt: '2026-07-31T00:01:00.000Z' }),
      ],
      relations: { parent: comment('parent') },
      users: { 'user-1': { id: 'user-1', image: null, name: 'First' } },
    },
    true,
  )
  const merged = mergeCommentPage(first, {
    comments: [
      comment('two', { content: 'updated', createdAt: '2026-07-31T00:01:00.000Z' }),
      comment('three', { createdAt: '2026-07-31T00:02:00.000Z' }),
    ],
    relations: {},
    users: { 'user-2': { id: 'user-2', image: null, name: 'Second' } },
  })

  assert.deepEqual(merged.comments.map(item => item.id), ['one', 'two', 'three'])
  assert.equal(merged.comments[1].content, 'updated')
  assert.equal(merged.relations.parent.id, 'parent')
  assert.deepEqual(Object.keys(merged.users), ['user-1', 'user-2'])
})

test('a later page remains chronological when a newly posted comment is already present', () => {
  const withCreatedComment = mergeCommentPage(emptyCommentCollection(), {
    comments: [
      comment('oldest', { createdAt: '2026-07-31T00:00:00.000Z' }),
      comment('created-now', { createdAt: '2026-07-31T00:03:00.000Z' }),
    ],
    relations: {},
    users: {},
  })
  const merged = mergeCommentPage(withCreatedComment, {
    comments: [comment('middle', { createdAt: '2026-07-31T00:02:00.000Z' })],
    relations: {},
    users: {},
  })

  assert.deepEqual(merged.comments.map(item => item.id), ['oldest', 'middle', 'created-now'])
})

test('optimistic reaction toggling is reversible and never produces a negative count', () => {
  const original = comment('one', { reactionCounts: { like: 0 } })
  const reacted = toggleLocalReaction(original)
  const reverted = toggleLocalReaction(reacted)

  assert.deepEqual(reacted.viewerReactions, ['like'])
  assert.equal(reacted.reactionCounts.like, 1)
  assert.deepEqual(reverted.viewerReactions, [])
  assert.equal(reverted.reactionCounts.like, 0)
})

test('an optimistic comment keeps its list identity when the server response settles', () => {
  const optimistic = comment('local-comment', {
    clientId: 'send-1',
    deliveryState: 'sending',
    status: 'pending',
  })
  const collection = mergeCommentPage(emptyCommentCollection(), {
    comments: [optimistic],
    relations: {},
    users: { 'user-1': { id: 'user-1', image: null, name: 'Sender' } },
  })
  const settled = settleOptimisticComment(collection, 'send-1', {
    comments: [comment('server-comment', { content: 'Saved' })],
    relations: {},
    users: { 'user-1': { id: 'user-1', image: null, name: 'Sender' } },
  })

  assert.equal(settled.comments.length, 1)
  assert.equal(settled.comments[0].id, 'server-comment')
  assert.equal(settled.comments[0].clientId, 'send-1')
  assert.equal(settled.comments[0].deliveryState, 'sent')
})

test('a failed optimistic comment is removed without disturbing server comments', () => {
  const collection = mergeCommentPage(emptyCommentCollection(), {
    comments: [
      comment('server-comment'),
      comment('local-comment', { clientId: 'send-1', deliveryState: 'sending' }),
    ],
    relations: {},
    users: {},
  })
  const rolledBack = removeOptimisticComment(collection, 'send-1')

  assert.deepEqual(rolledBack.comments.map(item => item.id), ['server-comment'])
})

test('server updates preserve a settled comment animation identity', () => {
  const settledComment = comment('server-comment', { clientId: 'send-1', deliveryState: 'sent' })
  const collection = mergeCommentPage(emptyCommentCollection(), {
    comments: [settledComment],
    relations: {},
    users: {},
  })
  const updated = replaceComment(collection, comment('server-comment', { reactionCounts: { like: 1 } }))

  assert.equal(updated.comments[0].clientId, 'send-1')
  assert.equal(updated.comments[0].deliveryState, 'sent')
  assert.equal(updated.comments[0].reactionCounts.like, 1)
})

test('relative comment timestamps match the Web comment time scale', () => {
  const now = Date.parse('2026-07-31T12:00:00.000Z')

  assert.equal(formatCommentRelativeTime('2026-07-31T11:58:00.000Z', 'en', now), '2 minutes ago')
  assert.equal(formatCommentRelativeTime('2026-07-30T12:00:00.000Z', 'en', now), 'yesterday')
  assert.equal(formatCommentRelativeTime('not-a-date', 'en', now), '')
})
