import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import type { UploadReviewParams, UploadReviewResult } from './UploadReviewSheet'
import { UploadReviewSheet } from './UploadReviewSheet'

export const uploadReviewPage = definePage<UploadReviewParams, UploadReviewResult>({
  Component: UploadReviewSheet,
  id: 'upload-review',
  // Its payload is in-memory picker assets, so there is no URL form of this
  // screen — it exists only as an imperative presentation.
  parseRouteParams: () => {
    throw new Error('The upload review sheet cannot be opened from a link.')
  },
  // No detents: a detent-backed FormSheet only lays out two subviews, and this
  // screen is a scrolling body plus a pinned action bar.
  presentation: { style: 'pageSheet' },
  title: translate('studio.upload.review.title'),
})
