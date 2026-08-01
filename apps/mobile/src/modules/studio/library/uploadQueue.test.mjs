import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  groupAssetsIntoJobs,
  isRetryableUploadError,
  retryDelayMs,
  summarizeQueue,
} from './uploadQueueModel.ts'

function failure(overrides = {}) {
  return { aborted: false, status: null, ...overrides }
}

function job(overrides = {}) {
  return { attempt: 1, bytes: 0, error: null, id: 'j', name: 'n', progress: 0, status: 'queued', ...overrides }
}

test('a live photo keeps its paired video in the same job', () => {
  const jobs = groupAssetsIntoJobs([
    {
      fileName: 'IMG_1.HEIC',
      fileSize: 100,
      pairedVideoAsset: { fileName: 'IMG_1.MOV', fileSize: 400, uri: 'file://1.mov' },
      uri: 'file://1.heic',
    },
    { fileName: 'IMG_2.jpg', fileSize: 50, uri: 'file://2.jpg' },
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs[0].assets.map(asset => asset.fileName),
    ['IMG_1.HEIC', 'IMG_1.MOV'],
  )
  assert.equal(jobs[0].bytes, 500)
  assert.equal(jobs[1].assets.length, 1)
})

test('an asset picked twice is only queued once', () => {
  const jobs = groupAssetsIntoJobs([
    { fileName: 'a.jpg', fileSize: 1, uri: 'file://a' },
    { fileName: 'a.jpg', fileSize: 1, uri: 'file://a' },
  ])
  assert.equal(jobs.length, 1)
})

test('a video already claimed as a pair is not queued on its own', () => {
  const jobs = groupAssetsIntoJobs([
    { fileName: 'p.HEIC', fileSize: 1, pairedVideoAsset: { fileName: 'p.MOV', fileSize: 2, uri: 'file://p.mov' }, uri: 'file://p.heic' },
    { fileName: 'p.MOV', fileSize: 2, uri: 'file://p.mov' },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].assets.length, 2)
})

test('a 4xx is not retried but transport failures and 5xx are', () => {
  assert.equal(isRetryableUploadError(failure({ status: 413 })), false)
  assert.equal(isRetryableUploadError(failure({ aborted: true })), false)
  assert.equal(isRetryableUploadError(failure()), true)
  assert.equal(isRetryableUploadError(failure({ status: 502 })), true)
  assert.equal(isRetryableUploadError(new Error('unknown shape')), true)
})

test('retry delays back off and then hold', () => {
  assert.equal(retryDelayMs(1), 1000)
  assert.equal(retryDelayMs(2), 3000)
  assert.equal(retryDelayMs(9), 3000)
})

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
