import { requireNativeModule, requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'

import { translate } from '@/i18n'

export interface NativePickedPhoto {
  id: string
  isLivePhoto: boolean
  name: string
}

export type NativeUploadJobStatus = 'cancelled' | 'done' | 'failed' | 'processing' | 'queued' | 'uploading'

export interface NativeUploadJob {
  id: string
  name: string
  bytes: number
  previewUri: string
  status: NativeUploadJobStatus
  progress: number
  attempt: number
  error: string | null
}

export interface NativeUploadEnqueueRequest {
  activityTitle: string
  directory: string | null
  endpoint: string
  items: { id: string, name: string }[]
}

interface UploadQueueChangeEvent {
  jobs: NativeUploadJob[]
}

interface PhotoUploadNativeModule {
  pickPhotos: () => Promise<NativePickedPhoto[]>
  enqueueUploads: (request: NativeUploadEnqueueRequest) => Promise<number>
  getQueueSnapshot: () => NativeUploadJob[]
  cancelUpload: (id: string) => void
  cancelAllUploads: () => void
  retryUpload: (id: string) => void
  retryFailedUploads: () => void
  clearFinishedUploads: () => void
  addListener: (
    event: 'onUploadQueueChange',
    listener: (event: UploadQueueChangeEvent) => void,
  ) => { remove: () => void }
}

export const nativePhotoUpload = requireNativeModule('PhotoUpload') as PhotoUploadNativeModule

export interface NativeUploadFabProps extends ViewProps {
  localization: Record<string, string>
}

export const NativeUploadFab = requireNativeView<NativeUploadFabProps>('PhotoUpload')

export function pickNativePhotos(): Promise<NativePickedPhoto[]> {
  return nativePhotoUpload.pickPhotos()
}

// The queue sheet is presented and rendered natively from the FAB, so its
// strings travel once as a plain dictionary instead of per-render props.
export function buildUploadQueueLocalization(): Record<string, string> {
  return {
    attemptTemplate: translate('studio.upload.queue.attempt'),
    cancel: translate('common.cancel'),
    cancelAll: translate('studio.upload.queue.cancelAll'),
    clear: translate('studio.upload.queue.clear'),
    done: translate('common.done'),
    failedTemplateOne: translate('studio.upload.queue.failedTemplate_one'),
    failedTemplateOther: translate('studio.upload.queue.failedTemplate_other'),
    headlineTemplate: translate('studio.upload.queue.headlineTemplate'),
    retry: translate('studio.upload.queue.retry'),
    retryAll: translate('studio.upload.queue.retryAll'),
    statusCancelled: translate('studio.upload.status.cancelled'),
    statusDone: translate('studio.upload.status.done'),
    statusFailed: translate('studio.upload.status.failed'),
    statusProcessing: translate('studio.upload.status.processing'),
    statusQueued: translate('studio.upload.status.queued'),
    statusUploading: translate('studio.upload.status.uploading'),
    title: translate('studio.upload.queue.title'),
  }
}
