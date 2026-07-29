import * as SecureStore from 'expo-secure-store'

const KEY = 'home.columnCount'

let value = 2

const hydration = SecureStore.getItemAsync(KEY)
  .then((raw) => {
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 4) {
      value = parsed
    }
  })
  .catch(() => {})

export function getPreferredColumnCount(): number {
  return value
}

export function setPreferredColumnCount(next: number): void {
  value = next
  void SecureStore.setItemAsync(KEY, String(next)).catch(() => {})
}

export function waitForColumnPreference(): Promise<void> {
  return hydration
}
