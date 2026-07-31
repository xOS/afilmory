export interface ProfileStatsPhoto {
  dateTaken: string | null
  camera: string | null
  lens: string | null
}

export interface ProfileStats {
  photoCount: number
  cameraCount: number
  lensCount: number
  yearSpan: string | null
}

export function collectProfileStats(photos: ProfileStatsPhoto[]): ProfileStats {
  const cameras = new Set<string>()
  const lenses = new Set<string>()
  let minYear = Number.POSITIVE_INFINITY
  let maxYear = Number.NEGATIVE_INFINITY

  for (const photo of photos) {
    if (photo.camera) {
      cameras.add(photo.camera)
    }
    if (photo.lens) {
      lenses.add(photo.lens)
    }
    if (photo.dateTaken) {
      const year = new Date(photo.dateTaken).getFullYear()
      if (!Number.isNaN(year)) {
        minYear = Math.min(minYear, year)
        maxYear = Math.max(maxYear, year)
      }
    }
  }

  const yearSpan = Number.isFinite(minYear) ? (minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`) : null

  return {
    photoCount: photos.length,
    cameraCount: cameras.size,
    lensCount: lenses.size,
    yearSpan,
  }
}
