import { useSyncExternalStore } from 'react'

import { getAuthCookie } from '@/api/auth'
import { getTenantApiBaseUrl } from '@/api/client'
import { translate } from '@/i18n'
import type { NativePickedPhoto, NativeUploadJob } from '@/native/photoUpload'
import { nativePhotoUpload } from '@/native/photoUpload'

import type { UploadJob } from './uploadQueueModel'
import { summarizeQueue } from './uploadQueueModel'

export type { UploadJob, UploadJobStatus, UploadQueueSummary } from './uploadQueueModel'
export { summarizeQueue } from './uploadQueueModel'

let jobs: UploadJob[] = normalize(nativePhotoUpload.getQueueSnapshot())
let running = summarizeQueue(jobs).running

const listeners = new Set<() => void>()
const drainListeners = new Set<() => void>()

function normalize(next: NativeUploadJob[]): UploadJob[] {
  return next.map(job => ({ ...job, error: job.error ?? null }))
}

nativePhotoUpload.addListener('onUploadQueueChange', ({ jobs: next }) => {
  jobs = normalize(next)
  for (const listener of listeners) {
    listener()
  }
  const nowRunning = summarizeQueue(jobs).running
  if (running && !nowRunning) {
    for (const listener of drainListeners) {
      listener()
    }
  }
  running = nowRunning
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): UploadJob[] {
  return jobs
}

export function useUploadQueue(): UploadJob[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function onQueueDrained(listener: () => void): () => void {
  drainListeners.add(listener)
  return () => {
    drainListeners.delete(listener)
  }
}

export async function enqueueUploads(
  items: readonly NativePickedPhoto[],
  directory: string | null = null,
): Promise<number> {
  if (items.length === 0) {
    return 0
  }
  const cookie = getAuthCookie()
  if (!cookie) {
    throw new Error(translate('studio.upload.signInRequired'))
  }
  return nativePhotoUpload.enqueueUploads({
    activityTitle: translate('studio.upload.activity.title'),
    directory,
    endpoint: `${getTenantApiBaseUrl()}/photos/assets/upload`,
    items: items.map(({ id, name }) => ({ id, name })),
  })
}

export function retryUploadJob(id: string) {
  nativePhotoUpload.retryUpload(id)
}

export function retryFailedUploads() {
  nativePhotoUpload.retryFailedUploads()
}

export function cancelUploadJob(id: string) {
  nativePhotoUpload.cancelUpload(id)
}

export function cancelAllUploads() {
  nativePhotoUpload.cancelAllUploads()
}

export function clearFinishedUploads() {
  nativePhotoUpload.clearFinishedUploads()
}
