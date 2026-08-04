import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { createDevLabShortcutState, registerDevLabTabPress } from './devLabShortcut.ts'

function pressSequence(tabNames, intervals = []) {
  let state = createDevLabShortcutState()
  let pressedAt = 0
  let result

  for (const [index, tabName] of tabNames.entries()) {
    pressedAt += intervals[index] ?? 100
    result = registerDevLabTabPress(state, tabName, pressedAt)
    state = result.state
  }

  return result
}

test('opens the development Lab on the fifth consecutive Studio tab press', () => {
  const result = pressSequence(['studio', 'studio', 'studio', 'studio', 'studio'])

  assert.equal(result?.shouldOpen, true)
  assert.deepEqual(result?.state, createDevLabShortcutState())
})

test('requires five uninterrupted Studio presses within the tap window', () => {
  const interrupted = pressSequence(['studio', 'studio', 'photos', 'studio', 'studio', 'studio'])
  const expired = pressSequence(['studio', 'studio', 'studio', 'studio', 'studio'], [100, 100, 1_001, 100, 100])

  assert.equal(interrupted?.shouldOpen, false)
  assert.equal(expired?.shouldOpen, false)
})
