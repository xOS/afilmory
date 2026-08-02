import assert from 'node:assert/strict'
// The mobile workspace has no Vitest runtime; use Node's behavioral test runner through tsx.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoInfoSheetModel } from './photoInfoModel'

const basePhoto = {
  id: 'photo-1',
  title: 'DSCF0001.RAF',
  description: '',
  originalUrl: 'https://example.com/original.jpg',
  thumbnailUrl: 'https://example.com/thumbnail.jpg',
  thumbHash: null,
  aspectRatio: 1.5,
  width: 6000,
  height: 4000,
  format: 'jpeg',
  size: 5 * 1024 * 1024,
  dateTaken: '2026-07-30T12:00:00.000Z',
  video: null,
  tags: [],
  exif: null,
  toneAnalysis: null,
  location: null,
  camera: null,
  lens: null,
  rating: null,
  city: null,
}

function section(model, sectionId) {
  return model.sections.find(item => item.id === sectionId) ?? null
}

function rowValue(model, sectionId, rowId) {
  return section(model, sectionId)?.rows.find(row => row.id === rowId)?.value ?? null
}

test('gear exposure strip carries the five Photos-style values', () => {
  const { gear } = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: {
      ExposureCompensation: 0,
      ExposureTime: 1 / 125,
      FNumber: 2.8,
      FocalLengthIn35mmFormat: '35',
      ISO: 400,
    },
  })

  assert.deepEqual(gear.exposure, ['ISO 400', '35 mm', '0 ev', 'ƒ2.8', '1/125 s'])

  // Same value in both fields (full frame) collapses back to a single number.
  const fullFrame = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: { FocalLength: '50.0 mm', FocalLengthIn35mmFormat: '50 mm' },
  })
  assert.deepEqual(fullFrame.gear.exposure, ['50 mm'])
})

test('gear exposure bias keeps an explicit sign', () => {
  const positive = buildPhotoInfoSheetModel({ ...basePhoto, exif: { ExposureCompensation: 0.33 } })
  const negative = buildPhotoInfoSheetModel({ ...basePhoto, exif: { ExposureCompensation: -0.67 } })

  assert.equal(positive.gear.exposure[0], '+0.3 ev')
  assert.equal(negative.gear.exposure[0], '-0.7 ev')
})

test('the focal cell pairs actual with 35mm-equivalent', () => {
  const { gear } = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: { FocalLength: '70.0 mm', FocalLengthIn35mmFormat: '105 mm', MaxApertureValue: 2.8 },
  })

  assert.deepEqual(gear.exposure, ['70→105 mm'])
})

test('gear card absorbs body, lens, badges, specs, and rating', () => {
  const { gear } = buildPhotoInfoSheetModel({
    ...basePhoto,
    rating: 4,
    exif: {
      FocalLength: 33,
      FujiRecipe: { FilmMode: 'F0/Standard (Provia)' },
      LensMake: 'FUJINON',
      LensModel: 'XF33mmF1.4 R LM WR',
      Make: 'FUJIFILM',
      MaxApertureValue: 1.4,
      Model: 'FUJIFILM X-T5',
    },
  })

  assert.equal(gear.model, 'FUJIFILM X-T5')
  assert.equal(gear.lens, 'FUJINON XF33mmF1.4 R LM WR')
  assert.equal(gear.formatBadge, 'JPEG')
  assert.equal(gear.styleBadge, 'Provia')
  assert.equal(gear.rating, 4)
  assert.deepEqual(gear.specs, ['24 MP', '6000 × 4000', '5 MB'])
})

test('gear falls back through camera then filename when no EXIF body is present', () => {
  const withCamera = buildPhotoInfoSheetModel({ ...basePhoto, camera: 'RICOH GR III' })
  const bare = buildPhotoInfoSheetModel(basePhoto)

  assert.equal(withCamera.gear.model, 'RICOH GR III')
  assert.equal(bare.gear.model, 'DSCF0001.RAF')
  assert.equal(bare.gear.lens, null)
  assert.equal(bare.gear.rating, 0)
  assert.deepEqual(bare.gear.exposure, [])
})

test('file details survive when EXIF is absent', () => {
  const model = buildPhotoInfoSheetModel(basePhoto)

  assert.ok(model.emptyMessage)
  assert.equal(rowValue(model, 'file', 'filename'), 'DSCF0001.RAF')
  assert.deepEqual(
    model.sections.map(item => item.id),
    ['file'],
  )
})

test('a Fuji recipe suppresses the plain EXIF white balance row', () => {
  const fuji = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: { MeteringMode: 'Pattern', WhiteBalance: 'Auto', FujiRecipe: { WhiteBalance: 'Kelvin', ColorTemperature: 5200 } },
  })
  const plain = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: { MeteringMode: 'Pattern', WhiteBalance: 'Auto' },
  })

  assert.equal(rowValue(fuji, 'exposure', 'white-balance'), null)
  assert.equal(rowValue(fuji, 'fuji-recipe', 'white-balance'), '5200 K')
  assert.equal(rowValue(plain, 'exposure', 'white-balance'), 'Auto White Balance')
})

test('exposure section merges the former capture-mode and technical groups', () => {
  const model = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: {
      BrightnessValue: 8.2,
      ExposureProgram: 'Aperture-priority AE',
      MeteringMode: 'Pattern',
      SensingMethod: 'One-chip color area',
      ShutterSpeedValue: 1 / 250,
      ApertureValue: 2.8,
    },
  })

  assert.equal(rowValue(model, 'exposure', 'brightness'), '8.2 EV')
  assert.equal(rowValue(model, 'exposure', 'sensing-method'), 'One-chip color area')
  assert.equal(section(model, 'exposure')?.summary, 'Aperture Priority AE')
  // APEX duplicates of the shutter and aperture already shown on the gear card.
  assert.equal(rowValue(model, 'exposure', 'shutter-value'), null)
  assert.equal(rowValue(model, 'exposure', 'aperture-value'), null)
})

test('place moves out of the location section and onto the map caption', () => {
  const model = buildPhotoInfoSheetModel({
    ...basePhoto,
    city: 'Singapore',
    location: {
      latitude: 1.3521,
      longitude: 103.8198,
      country: 'Singapore',
      city: 'Singapore',
      locationName: 'Marina Bay',
    },
  })

  assert.equal(model.place, 'Singapore')
  assert.equal(rowValue(model, 'location', 'place'), null)
  assert.equal(rowValue(model, 'location', 'latitude'), '1.3521°')
  assert.equal(rowValue(model, 'location', 'address'), 'Marina Bay')
  assert.deepEqual(model.mapLocation, { latitude: 1.3521, longitude: 103.8198 })
})

test('altitude drives the location summary and honours the below-sea-level ref', () => {
  const model = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: { GPSAltitude: 15, GPSAltitudeRef: 1, GPSLatitude: 1.3521, GPSLatitudeRef: 'N' },
  })

  assert.equal(rowValue(model, 'location', 'altitude'), '-15 m')
  assert.equal(section(model, 'location')?.summary, '-15 m')
})

test('tone type lands on the gear card while the metrics stay in a section', () => {
  const model = buildPhotoInfoSheetModel({
    ...basePhoto,
    toneAnalysis: {
      toneType: 'high-contrast',
      brightness: 48,
      contrast: 72,
      shadowRatio: 0.234,
      highlightRatio: 0.119,
    },
  })

  assert.equal(model.gear.tone, 'High Contrast')
  assert.equal(model.histogramUrl, basePhoto.thumbnailUrl)
  assert.deepEqual(
    section(model, 'tone')?.rows.map(row => [row.id, row.value]),
    [
      ['brightness', '48%'],
      ['contrast', '72%'],
      ['shadow-ratio', '23%'],
      ['highlight-ratio', '12%'],
    ],
  )
  assert.equal(section(model, 'tone')?.summary, '48%')
})

test('no tone analysis means no histogram source', () => {
  const model = buildPhotoInfoSheetModel(basePhoto)

  assert.equal(model.histogramUrl, null)
  assert.equal(model.gear.tone, null)
  assert.equal(section(model, 'tone'), null)
})

test('GPS references apply to the native map coordinates', () => {
  const model = buildPhotoInfoSheetModel({
    ...basePhoto,
    exif: {
      GPSLatitude: 33.8688,
      GPSLatitudeRef: 'S',
      GPSLongitude: 151.2093,
      GPSLongitudeRef: 'E',
    },
  })

  assert.deepEqual(model.mapLocation, { latitude: -33.8688, longitude: 151.2093 })
})

test('ShutterSpeedValue backs the exposure strip when ExposureTime is unavailable', () => {
  const { gear } = buildPhotoInfoSheetModel({ ...basePhoto, exif: { ShutterSpeedValue: 1 / 250 } })

  assert.deepEqual(gear.exposure, ['1/250 s'])
})

test('section titles and EXIF values localize', async () => {
  const { i18n } = await import('../../i18n')
  const model = buildPhotoInfoSheetModel(
    {
      ...basePhoto,
      exif: { FNumber: 2.8, MeteringMode: 'Pattern' },
      toneAnalysis: {
        brightness: 50,
        contrast: 75,
        highlightRatio: 0.12,
        shadowRatio: 0.2,
        toneType: 'high-contrast',
      },
    },
    i18n.getFixedT('zh-CN'),
    'zh-CN',
  )

  assert.equal(section(model, 'exposure')?.title, '曝光与测光')
  assert.equal(section(model, 'tone')?.title, '影调')
  assert.equal(section(model, 'file')?.title, '图像与文件')
  assert.equal(rowValue(model, 'exposure', 'metering-mode'), '图案')
  assert.equal(model.gear.tone, '高对比度')
})
