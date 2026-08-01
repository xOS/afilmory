import type { ImagePickerAsset } from 'expo-image-picker'

export type UploadJobStatus = 'cancelled' | 'done' | 'failed' | 'processing' | 'queued' | 'uploading'

export interface UploadJob {
  id: string
  name: string
  bytes: number
  status: UploadJobStatus
  progress: number
  attempt: number
  error: string | null
}

export interface UploadJobPayload {
  assets: readonly ImagePickerAsset[]
  bytes: number
  name: string
}

export interface UploadQueueSummary {
  total: number
  done: number
  failed: number
  progress: number
  running: boolean
}

export const MAX_ATTEMPTS = 3

const RETRY_DELAYS_MS = [1000, 3000]

// One job per picked photo, carrying its paired video: the server matches Live
// Photo videos to stills by base name within a single request, so splitting a
// pair across jobs would land the video as an unmatched orphan.
export function groupAssetsIntoJobs(assets: readonly ImagePickerAsset[]): UploadJobPayload[] {
  const jobs: UploadJobPayload[] = []
  const seen = new Set<string>()

  for (const asset of assets) {
    if (seen.has(asset.uri)) {
      continue
    }
    seen.add(asset.uri)

    const files = [asset]
    const paired = asset.pairedVideoAsset
    if (paired && !seen.has(paired.uri)) {
      seen.add(paired.uri)
      files.push(paired)
    }

    jobs.push({
      assets: files,
      bytes: files.reduce((total, file) => total + (file.fileSize ?? 0), 0),
      name: asset.fileName ?? `afilmory-upload-${jobs.length + 1}`,
    })
  }

  return jobs
}

// Reads SseRequestError structurally rather than by instanceof: this module is
// kept free of runtime imports so the queue rules stay unit-testable outside
// the Metro bundler.
export function isRetryableUploadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return true
  }
  const { aborted, status } = error as { aborted?: unknown, status?: unknown }
  if (aborted === true) {
    return false
  }
  // A 4xx is the server refusing these exact bytes — size limits, quota, a
  // rejected format. Only transport failures and 5xx are worth another attempt.
  return typeof status !== 'number' || status >= 500
}

export function retryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) ?? 0
}

export function summarizeQueue(jobs: readonly UploadJob[]): UploadQueueSummary {
  const counted = jobs.filter(job => job.status !== 'cancelled')
  const done = jobs.filter(job => job.status === 'done').length
  const failed = jobs.filter(job => job.status === 'failed').length
  const running = jobs.some(
    job => job.status === 'queued' || job.status === 'uploading' || job.status === 'processing',
  )
  const progress
    = counted.length === 0
      ? 0
      : counted.reduce((total, job) => total + (job.status === 'done' ? 1 : job.progress), 0) / counted.length

  return { done, failed, progress, running, total: counted.length }
}
