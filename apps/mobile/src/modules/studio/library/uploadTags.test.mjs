import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  deriveDirectoryFromTags,
  mergeRecentTags,
  orderTagSuggestions,
  sanitizeTagSegment,
} from './uploadTags.ts'

test('a tag cannot escape its directory segment', () => {
  // Dots are legal in a segment; what matters is that no separator survives,
  // so traversal collapses into one harmless directory name.
  assert.equal(sanitizeTagSegment('../../etc'), '..-..-etc')
  assert.equal(sanitizeTagSegment('a/b'), 'a-b')
  assert.equal(sanitizeTagSegment('a\\b'), 'a-b')
  assert.equal(deriveDirectoryFromTags(['../..']), '..-..')
})

test('whitespace and repeats collapse to a single dash', () => {
  assert.equal(sanitizeTagSegment('  summer   trip  '), 'summer-trip')
  assert.equal(sanitizeTagSegment('a---b'), 'a-b')
  assert.equal(sanitizeTagSegment('-lead-trail-'), 'lead-trail')
})

test('non-latin tags survive sanitization', () => {
  assert.equal(sanitizeTagSegment('南京'), '南京')
})

test('tags join into a nested directory, empties drop out', () => {
  assert.equal(deriveDirectoryFromTags(['travel', 'japan']), 'travel/japan')
  assert.equal(deriveDirectoryFromTags([]), null)
  assert.equal(deriveDirectoryFromTags(['', '   ']), null)
  assert.equal(deriveDirectoryFromTags(['ok', '///']), 'ok')
})

test('recent tags keep newest first and cap at the limit', () => {
  assert.deepEqual(mergeRecentTags(['b'], ['a', 'b', 'c']), ['b', 'a', 'c'])
  const overflow = mergeRecentTags(['x'], ['1', '2', '3', '4', '5', '6', '7', '8'])
  assert.equal(overflow.length, 8)
  assert.equal(overflow[0], 'x')
})

test('suggestions put recent tags first without dropping the rest', () => {
  const ordered = orderTagSuggestions(['alpha', 'beta', 'gamma'], ['gamma'])
  assert.deepEqual(ordered, ['gamma', 'alpha', 'beta'])
})

test('suggestion list is deduped case-insensitively', () => {
  assert.deepEqual(orderTagSuggestions(['Alpha', 'alpha'], []), ['alpha'])
})
