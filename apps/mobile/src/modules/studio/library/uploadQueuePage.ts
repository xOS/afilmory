import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import { UploadQueueSheet } from './UploadQueueSheet'

export const uploadQueuePage = definePage({
  Component: UploadQueueSheet,
  id: 'upload-queue',
  presentation: { style: 'pageSheet' },
  title: translate('studio.upload.queue.title'),
})
