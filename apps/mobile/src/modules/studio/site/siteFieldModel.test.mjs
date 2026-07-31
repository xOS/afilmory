import assert from 'node:assert/strict'

import test from 'vitest'

import {
  formatSettingOption,
  normalizeColorSelection,
  parseMultiSelectValue,
  resolveNativeFieldComponent,
  updateMultiSelectValue,
} from './siteFieldModel.ts'

test('resolves semantic native controls independently of legacy schema presentation', () => {
  assert.deepEqual(
    resolveNativeFieldComponent({ key: 'site.accentColor', component: { type: 'text' } }),
    { type: 'color', supportsOpacity: false },
  )
  assert.deepEqual(
    resolveNativeFieldComponent({
      key: 'site.mapProjection',
      component: { type: 'select', options: ['mercator', 'globe'] },
    }),
    { type: 'select', options: ['mercator', 'globe'], presentation: 'segmented' },
  )
})

test('normalizes color selections without accepting malformed values', () => {
  assert.equal(normalizeColorSelection('#12abef'), '#12ABEF')
  assert.equal(normalizeColorSelection('#12abef80'), '#12ABEF80')
  assert.equal(normalizeColorSelection('blue'), null)
})

test('updates JSON-backed multi-select values without duplicate options', () => {
  assert.deepEqual(parseMultiSelectValue('["maplibre","maplibre",7]'), ['maplibre'])
  assert.equal(updateMultiSelectValue('["maplibre"]', 'custom', true), '["maplibre","custom"]')
  assert.equal(updateMultiSelectValue('["maplibre","custom"]', 'maplibre', false), '["custom"]')
  assert.equal(formatSettingOption('maplibre'), 'MapLibre')
  assert.equal(formatSettingOption('mercator'), 'Mercator')
})
