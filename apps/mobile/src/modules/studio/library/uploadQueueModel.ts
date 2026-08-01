export type UploadJobStatus = 'cancelled' | 'done' | 'failed' | 'processing' | 'queued' | 'uploading'

export interface UploadJob {
  id: string
  name: string
  bytes: number
  previewUri: string
  status: UploadJobStatus
  progress: number
  attempt: number
  error: string | null
}

export interface UploadQueueSummary {
  total: number
  done: number
  failed: number
  progress: number
  running: boolean
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
