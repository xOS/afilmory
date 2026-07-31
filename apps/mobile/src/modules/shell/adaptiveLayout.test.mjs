import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  classifyAdaptiveWidth,
  getExploreGridMetrics,
  supportsPhotoInspector,
  supportsStudioGrid,
  supportsStudioSplitView,
} from './adaptiveLayout.ts'

test('classifies the current content width rather than a device model', () => {
  assert.equal(classifyAdaptiveWidth(430), 'compact')
  assert.equal(classifyAdaptiveWidth(744), 'regular')
  assert.equal(classifyAdaptiveWidth(1194), 'wide')
})

test('adds explore columns only when the cards retain a useful width', () => {
  assert.equal(getExploreGridMetrics(430).columns, 1)
  assert.equal(getExploreGridMetrics(744).columns, 2)
  assert.equal(getExploreGridMetrics(1024).columns, 3)
  assert.equal(getExploreGridMetrics(1366).columns, 3)
})

test('reserves inspectors and dashboard grids for sufficiently wide content', () => {
  assert.equal(supportsPhotoInspector(899), false)
  assert.equal(supportsPhotoInspector(900), true)
  assert.equal(supportsStudioGrid(759), false)
  assert.equal(supportsStudioGrid(760), true)
  assert.equal(supportsStudioSplitView(899), false)
  assert.equal(supportsStudioSplitView(900), true)
})
