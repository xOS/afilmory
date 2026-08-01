export class SseRequestError extends Error {
  readonly aborted: boolean
  readonly status: number | null

  constructor(message: string, options: { aborted?: boolean, status?: number | null } = {}) {
    super(message)
    this.name = 'SseRequestError'
    this.aborted = options.aborted ?? false
    this.status = options.status ?? null
  }
}
