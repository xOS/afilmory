import { definePage } from '@/presentation'

import { FilterSheet } from './FilterSheet'

export const filterSheetPage = definePage({
  Component: FilterSheet,
  id: 'filterSheet',
  presentation: { detents: [0.5, 1], headerShown: false, style: 'formSheet' },
  title: 'Filters',
})
