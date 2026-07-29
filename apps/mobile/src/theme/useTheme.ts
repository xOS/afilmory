import type { Palette } from './palette'
import { palette } from './palette'

export interface Theme {
  palette: Palette
}

const theme: Theme = { palette }

// Keeps the hook-shaped seam so components survive a future dynamic theme.
// eslint-disable-next-line react/no-unnecessary-use-prefix
export function useTheme(): Theme {
  return theme
}
