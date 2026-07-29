import { definePage } from '@/presentation'

import { GalleriesScreen } from './GalleriesScreen'

export const galleriesPage = definePage({
  Component: GalleriesScreen,
  id: 'galleries',
  presentation: { style: 'fullScreen' },
  title: 'Galleries',
})
