const DEV_LAB_TAB_NAME = 'studio'
const REQUIRED_DEV_LAB_TAPS = 5
const MAX_TAP_INTERVAL_MS = 1_000

export interface DevLabShortcutState {
  count: number
  lastPressedAt: number | null
}

interface DevLabShortcutResult {
  shouldOpen: boolean
  state: DevLabShortcutState
}

export function createDevLabShortcutState(): DevLabShortcutState {
  return { count: 0, lastPressedAt: null }
}

export function registerDevLabTabPress(
  state: DevLabShortcutState,
  tabName: string,
  pressedAt: number,
): DevLabShortcutResult {
  if (tabName !== DEV_LAB_TAB_NAME) {
    return { shouldOpen: false, state: createDevLabShortcutState() }
  }

  const interval = state.lastPressedAt === null ? null : pressedAt - state.lastPressedAt
  const followsPreviousTap = interval !== null && interval >= 0 && interval <= MAX_TAP_INTERVAL_MS
  const count = followsPreviousTap ? state.count + 1 : 1

  if (count >= REQUIRED_DEV_LAB_TAPS) {
    return { shouldOpen: true, state: createDevLabShortcutState() }
  }

  return {
    shouldOpen: false,
    state: { count, lastPressedAt: pressedAt },
  }
}
