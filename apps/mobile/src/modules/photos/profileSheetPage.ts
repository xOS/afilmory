import { definePage } from '@/presentation'

import { ProfileSheet } from './ProfileSheet'

export const profileSheetPage = definePage({
  Component: ProfileSheet,
  id: 'profile',
  presentation: { detents: [0.5], headerShown: false, style: 'formSheet' },
  title: '',
})
