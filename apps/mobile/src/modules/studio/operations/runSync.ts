import { sendSseRequest } from '../sseRequest'
import type { DataSyncProgressEvent } from '../types'

export async function runDataSync(dryRun: boolean, onEvent: (event: DataSyncProgressEvent) => void): Promise<void> {
  await sendSseRequest<DataSyncProgressEvent>({
    body: JSON.stringify({ dryRun }),
    contentType: 'application/json',
    onEvent,
    path: '/data-sync/run',
  })
}
