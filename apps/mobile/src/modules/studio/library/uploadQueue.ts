import type { ImagePickerAsset } from 'expo-image-picker'
import { useSyncExternalStore } from 'react'

import { uploadJob } from './upload'
import type { UploadJob, UploadJobPayload } from './uploadQueueModel'
import { groupAssetsIntoJobs, isRetryableUploadError, MAX_ATTEMPTS, retryDelayMs } from './uploadQueueModel'

export type { UploadJob, UploadJobStatus, UploadQueueSummary } from './uploadQueueModel'
export { summarizeQueue } from './uploadQueueModel'

let jobs: UploadJob[] = []
let running = false
let sequence = 0

const payloads = new Map<string, UploadJobPayload>()
const controllers = new Map<string, AbortController>()
const listeners = new Set<() => void>()
const drainListeners = new Set<() => void>()

function setJobs(next: UploadJob[]) {
  jobs = next
  for (const listener of listeners) {
    listener()
  }
}

function patchJob(id: string, patch: Partial<UploadJob>) {
  setJobs(jobs.map(job => (job.id === id ? { ...job, ...patch } : job)))
}

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

export function enqueueUploads(assets: readonly ImagePickerAsset[]): number {
  const grouped = groupAssetsIntoJobs(assets)
  if (grouped.length === 0) {
    return 0
  }

  const created = grouped.map((payload) => {
    sequence += 1
    const id = `upload-${sequence}`
    payloads.set(id, payload)
    return {
      attempt: 0,
      bytes: payload.bytes,
      error: null,
      id,
      name: payload.name,
      progress: 0,
      status: 'queued' as const,
    }
  })

  setJobs([...jobs, ...created])
  void run()
  return created.length
}

export function retryUploadJob(id: string) {
  const job = jobs.find(entry => entry.id === id)
  if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) {
    return
  }
  patchJob(id, { attempt: 0, error: null, progress: 0, status: 'queued' })
  void run()
}

export function retryFailedUploads() {
  const ids = new Set(jobs.filter(job => job.status === 'failed' || job.status === 'cancelled').map(job => job.id))
  if (ids.size === 0) {
    return
  }
  setJobs(
    jobs.map(job => (ids.has(job.id) ? { ...job, attempt: 0, error: null, progress: 0, status: 'queued' } : job)),
  )
  void run()
}

export function cancelUploadJob(id: string) {
  const job = jobs.find(entry => entry.id === id)
  if (!job || job.status === 'done' || job.status === 'cancelled') {
    return
  }
  patchJob(id, { error: null, status: 'cancelled' })
  controllers.get(id)?.abort()
}

export function cancelAllUploads() {
  const inFlight = jobs.filter(job => job.status !== 'done' && job.status !== 'cancelled')
  if (inFlight.length === 0) {
    return
  }
  const ids = new Set(inFlight.map(job => job.id))
  setJobs(jobs.map(job => (ids.has(job.id) ? { ...job, error: null, status: 'cancelled' as const } : job)))
  for (const id of ids) {
    controllers.get(id)?.abort()
  }
}

export function clearFinishedUploads() {
  const removed = jobs.filter(job => job.status === 'done' || job.status === 'cancelled')
  if (removed.length === 0) {
    return
  }
  for (const job of removed) {
    payloads.delete(job.id)
  }
  setJobs(jobs.filter(job => job.status !== 'done' && job.status !== 'cancelled'))
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish)
  })
}

async function run() {
  if (running) {
    return
  }
  running = true

  try {
    // Serial by design: measured per-request overhead is ~80ms against ~1.4s of
    // per-file server work, so overlapping buys little while making progress
    // attribution and cancellation ambiguous.
    let next = jobs.find(job => job.status === 'queued')
    while (next) {
      await runJob(next.id)
      next = jobs.find(job => job.status === 'queued')
    }
  }
  finally {
    running = false
    for (const listener of drainListeners) {
      listener()
    }
  }
}

async function runJob(id: string) {
  const payload = payloads.get(id)
  if (!payload) {
    patchJob(id, { error: 'The picked file is no longer available.', status: 'failed' })
    return
  }

  const controller = new AbortController()
  controllers.set(id, controller)

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (controller.signal.aborted) {
        return
      }
      patchJob(id, { attempt, error: null, progress: 0, status: 'uploading' })

      try {
        await uploadJob(payload, {
          onPhase({ phase, progress }) {
            patchJob(id, {
              progress: phase === 'uploading' ? progress * 0.5 : 0.5 + progress * 0.5,
              status: phase,
            })
          },
          signal: controller.signal,
        })
        patchJob(id, { error: null, progress: 1, status: 'done' })
        return
      }
      catch (error) {
        if (controller.signal.aborted) {
          return
        }
        const message = error instanceof Error ? error.message : 'Upload failed.'
        if (attempt >= MAX_ATTEMPTS || !isRetryableUploadError(error)) {
          patchJob(id, { error: message, status: 'failed' })
          return
        }
        // Held as `failed` while waiting so the sheet explains the pause, but
        // the outer loop must not pick it up again — runJob owns the retry.
        patchJob(id, { error: message, status: 'failed' })
        await sleep(retryDelayMs(attempt), controller.signal)
      }
    }
  }
  finally {
    controllers.delete(id)
  }
}
