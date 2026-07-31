import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { createSseParser } from './sse'

test('SSE parser preserves partial events across transport chunks', () => {
  const messages = []
  const parser = createSseParser(message => messages.push(message))

  parser.push(': keep-alive\r\nevent: progress\r\ndata: {"type":"sta')
  parser.push('rt"}\r\n\r\nevent: progress\ndata: {"type":"complete"}\n\n')

  assert.deepEqual(messages, [
    { event: 'progress', data: '{"type":"start"}' },
    { event: 'progress', data: '{"type":"complete"}' },
  ])
})

test('SSE parser joins multiple data lines and flushes the final event', () => {
  const messages = []
  const parser = createSseParser(message => messages.push(message))

  parser.push('event: progress\ndata: first\ndata: second')
  parser.finish()

  assert.deepEqual(messages, [{ event: 'progress', data: 'first\nsecond' }])
})
