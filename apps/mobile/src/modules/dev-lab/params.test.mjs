import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  COMMENT_SEND_SCENARIO_DEFAULTS,
  parseDevLabParams,
  serializeDevLabParams,
} from './params.ts'

test('UI Lab parameters use stable defaults when the route has no query', () => {
  const parsed = parseDevLabParams({})

  assert.deepEqual(parsed.value, COMMENT_SEND_SCENARIO_DEFAULTS)
  assert.deepEqual(parsed.issues, [])
})

test('UI Lab parameters accept the full supported comment-flight contract', () => {
  const parsed = parseDevLabParams({
    duration: '520',
    latency: '1200',
    lift: '18',
    message: '  Preview this trajectory  ',
    motion: 'never',
    outcome: 'failure',
    scene: 'comment-send-flight',
  })

  assert.deepEqual(parsed.issues, [])
  assert.deepEqual(parsed.value, {
    durationMs: 520,
    latencyMs: 1200,
    lift: 18,
    message: 'Preview this trajectory',
    motion: 'never',
    outcome: 'failure',
    scene: 'comment-send-flight',
  })
  assert.deepEqual(serializeDevLabParams(parsed.value), {
    duration: '520',
    latency: '1200',
    lift: '18',
    message: 'Preview this trajectory',
    motion: 'never',
    outcome: 'failure',
    scene: 'comment-send-flight',
  })
})

test('invalid UI Lab parameters report issues and fall back without crashing the scene', () => {
  const parsed = parseDevLabParams({
    duration: 'fast',
    latency: '-1',
    lift: '49',
    message: '   ',
    motion: 'sometimes',
    outcome: 'timeout',
    scene: 'unknown',
  })

  assert.equal(parsed.issues.length, 7)
  assert.deepEqual(parsed.value, COMMENT_SEND_SCENARIO_DEFAULTS)
})

test('repeated route parameters use the first value and report the ambiguity', () => {
  const parsed = parseDevLabParams({ duration: ['480', '900'] })

  assert.equal(parsed.value.durationMs, 480)
  assert.equal(parsed.issues.length, 1)
  assert.equal(parsed.issues[0].field, 'durationMs')
})
