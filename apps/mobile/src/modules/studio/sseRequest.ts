import { getAuthCookie } from '@/api/auth'
import { getTenantApiBaseUrl } from '@/api/client'
import { camelCaseKeys } from '@/modules/auth/case'

import { createSseParser } from './sse'
import { SseRequestError } from './sseError'

export { SseRequestError }

interface SseRequestOptions<T> {
  body: FormData | string
  contentType?: string
  onEvent: (event: T) => void
  onUploadProgress?: (progress: number) => void
  path: string
  signal?: AbortSignal
}

export async function sendSseRequest<T>({
  body,
  contentType,
  onEvent,
  onUploadProgress,
  path,
  signal,
}: SseRequestOptions<T>): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new SseRequestError('The operation was cancelled.', { aborted: true }))
      return
    }

    const xhr = new XMLHttpRequest()
    const cookie = getAuthCookie()
    let completed = false
    let lastIndex = 0
    let settled = false

    const abort = () => xhr.abort()

    const settle = (error?: Error) => {
      if (settled) {
        return
      }
      settled = true
      signal?.removeEventListener('abort', abort)
      if (error) {
        reject(error)
      }
      else {
        resolve()
      }
    }

    const parser = createSseParser(({ data, event }) => {
      if (event !== 'progress') {
        return
      }
      try {
        const parsed = camelCaseKeys<T>(JSON.parse(data))
        onEvent(parsed)
        const eventType = (parsed as { type?: string }).type
        if (eventType === 'complete') {
          completed = true
        }
        if (eventType === 'error') {
          const message = (parsed as { payload?: { message?: string } }).payload?.message
          // The stream itself succeeded, so the failure is the server rejecting
          // this payload — retrying the same bytes cannot change the outcome.
          settle(new SseRequestError(message ?? 'The server could not complete the operation.', { status: 400 }))
        }
      }
      catch {
        settle(new SseRequestError('The server returned an invalid progress event.'))
      }
    })

    const processResponse = () => {
      const next = xhr.responseText.slice(lastIndex)
      if (!next) {
        return
      }
      lastIndex = xhr.responseText.length
      parser.push(next)
    }

    xhr.open('POST', `${getTenantApiBaseUrl()}${path}`, true)
    xhr.withCredentials = true
    xhr.setRequestHeader('accept', 'text/event-stream')
    if (cookie) {
      xhr.setRequestHeader('Cookie', cookie)
    }
    if (contentType) {
      xhr.setRequestHeader('content-type', contentType)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onUploadProgress?.(Math.min(1, event.loaded / event.total))
      }
    }
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
        processResponse()
      }
    }
    xhr.onprogress = processResponse
    xhr.onerror = () => settle(new SseRequestError('A network error interrupted the operation.'))
    xhr.onabort = () => settle(new SseRequestError('The operation was cancelled.', { aborted: true }))
    xhr.onload = () => {
      processResponse()
      parser.finish()
      if (xhr.status >= 200 && xhr.status < 300 && completed) {
        settle()
        return
      }
      settle(
        new SseRequestError(
          xhr.status ? `The server returned HTTP ${xhr.status}.` : 'The server response was incomplete.',
          { status: xhr.status || null },
        ),
      )
    }

    signal?.addEventListener('abort', abort)
    xhr.send(body)
  })
}
