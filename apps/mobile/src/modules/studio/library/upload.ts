import type { ImagePickerAsset } from 'expo-image-picker'
import * as ImagePicker from 'expo-image-picker'

import { sendSseRequest } from '../sseRequest'
import type { DataSyncProgressEvent } from '../types'

export interface UploadProgress {
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
  if (result.canceled) {
    return []
  }

  const assets: ImagePickerAsset[] = []
  const seen = new Set<string>()
  for (const asset of result.assets) {
    for (const candidate of [asset, asset.pairedVideoAsset]) {
      if (candidate && !seen.has(candidate.uri)) {
        seen.add(candidate.uri)
        assets.push(candidate)
      }
    }
  }
  return assets
}

export async function uploadPhotos(
  assets: readonly ImagePickerAsset[],
  onProgress: (progress: UploadProgress) => void,
): Promise<void> {
  if (assets.length === 0) {
    return
  }

  const body = new FormData()
  assets.forEach((asset, index) => {
    body.append('files', {
      name: asset.fileName ?? fallbackFilename(asset, index),
      type: asset.mimeType ?? fallbackMimeType(asset),
      uri: asset.uri,
    } as unknown as Blob)
  })

  onProgress({ phase: 'uploading', progress: 0 })
  await sendSseRequest<DataSyncProgressEvent>({
    body,
    onEvent(event) {
      if (event.type === 'start') {
        onProgress({ phase: 'processing', progress: 0 })
      }
      else if (event.type === 'stage' || event.type === 'action') {
        const total = Math.max(event.payload.total, 1)
        const current = event.type === 'stage' ? event.payload.processed : event.payload.index
        onProgress({ phase: 'processing', progress: Math.min(1, current / total) })
      }
      else if (event.type === 'complete') {
        onProgress({ phase: 'processing', progress: 1 })
      }
    },
    onUploadProgress(progress) {
      onProgress({ phase: 'uploading', progress })
    },
    path: '/photos/assets/upload',
  })
}

function fallbackFilename(asset: ImagePickerAsset, index: number): string {
  const extension = asset.type === 'pairedVideo' || asset.type === 'video' ? 'mov' : 'jpg'
  return `afilmory-upload-${index + 1}.${extension}`
}

function fallbackMimeType(asset: ImagePickerAsset): string {
  return asset.type === 'pairedVideo' || asset.type === 'video' ? 'video/quicktime' : 'image/jpeg'
}
