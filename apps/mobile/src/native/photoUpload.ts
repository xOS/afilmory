import { requireNativeModule } from 'expo'

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
  cookie: string
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

export function pickNativePhotos(): Promise<NativePickedPhoto[]> {
  return nativePhotoUpload.pickPhotos()
}
