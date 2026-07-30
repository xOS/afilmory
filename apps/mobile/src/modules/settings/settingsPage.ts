import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import { SettingsScreen } from './SettingsScreen'

export const settingsPage = definePage({
  Component: SettingsScreen,
  id: 'settings',
  presentation: { style: 'fullScreen' },
  title: translate('tabs.settings'),
})
