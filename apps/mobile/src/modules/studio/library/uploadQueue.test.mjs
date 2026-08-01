import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { summarizeQueue } from './uploadQueueModel.ts'

function job(overrides = {}) {
  return {
    attempt: 1,
    bytes: 0,
    error: null,
    id: 'j',
    name: 'n',
    previewUri: '',
    progress: 0,
    status: 'queued',
    ...overrides,
  }
}

test('cancelled jobs leave the denominator', () => {
  const summary = summarizeQueue([
    job({ id: 'a', progress: 1, status: 'done' }),
    job({ id: 'b', status: 'cancelled' }),
  ])
  assert.equal(summary.total, 1)
  assert.equal(summary.done, 1)
  assert.equal(summary.progress, 1)
  assert.equal(summary.running, false)
})

test('a failed job stops the queue counting as running', () => {
  const summary = summarizeQueue([job({ id: 'a', status: 'failed' }), job({ id: 'b', progress: 1, status: 'done' })])
  assert.equal(summary.running, false)
  assert.equal(summary.failed, 1)
  assert.equal(summary.progress, 0.5)
})

test('an in-flight job reports the queue as running', () => {
  const summary = summarizeQueue([job({ progress: 0.4, status: 'uploading' })])
  assert.equal(summary.running, true)
  assert.equal(summary.progress, 0.4)
})
