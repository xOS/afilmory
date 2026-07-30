import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import { PhotosHomeScreen } from './PhotosHomeScreen'

export const photosPage = definePage({
  Component: PhotosHomeScreen,
  id: 'photos',
  presentation: { style: 'fullScreen' },
  title: translate('tabs.photos'),
})
