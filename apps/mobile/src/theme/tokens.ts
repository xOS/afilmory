import { Platform } from 'react-native'

export const font = {
  ui: Platform.select({ ios: 'System', default: 'sans-serif' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 12.5,
  md: 13,
  lg: 15,
  xl: 20,
} as const

export const radius = 6
export const radiusPill = 999

// Large chrome follows the iOS corner scale, not the 6px control radius.
export const radiusLg = 22

export const controlH = 44

export const tabularNums = { fontVariant: ['tabular-nums' as const] }
