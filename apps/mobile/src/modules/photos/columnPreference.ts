import * as SecureStore from 'expo-secure-store'

const KEY = 'home.preferredItemWidth'
const DEFAULT_ITEM_WIDTH = 190
const MIN_ITEM_WIDTH = 92
const MAX_ITEM_WIDTH = 640

let value = DEFAULT_ITEM_WIDTH

const hydration = SecureStore.getItemAsync(KEY)
  .then((raw) => {
    const parsed = raw === null ? Number.NaN : Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed >= MIN_ITEM_WIDTH && parsed <= MAX_ITEM_WIDTH) {
      value = parsed
    }
  })
  .catch(() => {})

export function getPreferredItemWidth(): number {
  return value
}

export function setPreferredItemWidth(next: number): void {
  value = Math.min(Math.max(next, MIN_ITEM_WIDTH), MAX_ITEM_WIDTH)
  void SecureStore.setItemAsync(KEY, value.toFixed(2)).catch(() => {})
}

export function waitForColumnPreference(): Promise<void> {
  return hydration
}
