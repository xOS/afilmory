import type { ImagePickerAsset } from 'expo-image-picker'
import * as ImagePicker from 'expo-image-picker'

import { sendSseRequest } from '../sseRequest'
import type { DataSyncProgressEvent } from '../types'
import type { UploadJobPayload } from './uploadQueueModel'

export interface UploadPhase {
  phase: 'processing' | 'uploading'
  progress: number
}

export async function pickPhotosForUpload(): Promise<ImagePickerAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: true,
    mediaTypes: ['images', 'livePhotos'],
    orderedSelection: true,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    quality: 1,
    selectionLimit: 0,
  })
  return result.canceled ? [] : result.assets
}

export async function uploadJob(
  payload: UploadJobPayload,
  options: { onPhase: (phase: UploadPhase) => void, signal: AbortSignal },
): Promise<void> {
  const body = new FormData()
  payload.assets.forEach((asset, index) => {
    body.append('files', {
      name: asset.fileName ?? fallbackFilename(asset, index),
      type: asset.mimeType ?? fallbackMimeType(asset),
      uri: asset.uri,
    } as unknown as Blob)
  })

  options.onPhase({ phase: 'uploading', progress: 0 })
  await sendSseRequest<DataSyncProgressEvent>({
    body,
    onEvent(event) {
      if (event.type === 'start') {
        options.onPhase({ phase: 'processing', progress: 0 })
      }
      else if (event.type === 'stage' || event.type === 'action') {
        const total = Math.max(event.payload.total, 1)
        const current = event.type === 'stage' ? event.payload.processed : event.payload.index
        options.onPhase({ phase: 'processing', progress: Math.min(1, current / total) })
      }
      else if (event.type === 'complete') {
        options.onPhase({ phase: 'processing', progress: 1 })
      }
    },
    onUploadProgress(progress) {
      options.onPhase({ phase: 'uploading', progress })
    },
    path: '/photos/assets/upload',
    signal: options.signal,
  })
}

function fallbackFilename(asset: ImagePickerAsset, index: number): string {
  const extension = asset.type === 'pairedVideo' || asset.type === 'video' ? 'mov' : 'jpg'
  return `afilmory-upload-${index + 1}.${extension}`
}

function fallbackMimeType(asset: ImagePickerAsset): string {
  return asset.type === 'pairedVideo' || asset.type === 'video' ? 'video/quicktime' : 'image/jpeg'
}
