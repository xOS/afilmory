import assert from 'node:assert/strict'
// The mobile workspace has no Vitest runtime; use Node's behavioral test runner through tsx.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { buildPhotoInfoModel } from './photoInfoModel'

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
  isLive: false,
  tags: [],
  exif: null,
  toneAnalysis: null,
  location: null,
  camera: null,
  lens: null,
  rating: null,
  city: null,
}

function rowValue(model, sectionId, rowId) {
  const section = sectionId === 'basic' ? model.basic : model.sections.find(item => item.id === sectionId)
  return section?.rows.find(row => row.id === rowId)?.value ?? null
}

test('buildPhotoInfoModel formats the primary exposure parameters', () => {
  const model = buildPhotoInfoModel({
    ...basePhoto,
    exif: {
      ExposureCompensation: 0,
      ExposureTime: 1 / 125,
      FNumber: 2.8,
      FocalLengthIn35mmFormat: '35',
      ISO: 400,
    },
  })

  assert.deepEqual(
    model.captureParameters.map(parameter => [parameter.id, parameter.value]),
    [
      ['focal-length', '35 mm'],
      ['aperture', 'f/2.8'],
      ['shutter-speed', '1/125 s'],
      ['iso', 'ISO 400'],
      ['exposure-bias', '0 EV'],
    ],
  )
})

test('buildPhotoInfoModel keeps the web inspector device, location, and Fuji groups', () => {
  const model = buildPhotoInfoModel({
    ...basePhoto,
    camera: 'FUJIFILM X-T5',
    lens: 'XF33mmF1.4 R LM WR',
    city: 'Singapore',
    exif: {
      FujiRecipe: {
        FilmMode: 'F0/Standard (Provia)',
        DynamicRange: 'Wide',
        DynamicRangeSetting: 'Manual',
        DevelopmentDynamicRange: 400,
        WhiteBalance: 'Kelvin',
        ColorTemperature: 5200,
        HighlightTone: '-1 (medium soft)',
        ShadowTone: '0 (normal)',
        Saturation: '+1 (medium high)',
      },
      GPSAltitude: 15,
      GPSAltitudeRef: 1,
      GPSLatitude: 1.3521,
      GPSLatitudeRef: 'N',
      GPSLongitude: 103.8198,
      GPSLongitudeRef: 'E',
      LensMake: 'FUJINON',
      LensModel: 'XF33mmF1.4 R LM WR',
      Make: 'FUJIFILM',
      Model: 'FUJIFILM X-T5',
    },
  })

  assert.equal(rowValue(model, 'device', 'camera'), 'FUJIFILM X-T5')
  assert.equal(rowValue(model, 'location', 'latitude'), '1.3521° N')
  assert.equal(rowValue(model, 'location', 'altitude'), '-15 m')
  assert.equal(rowValue(model, 'fuji-recipe', 'film-mode'), 'Provia')
  assert.equal(rowValue(model, 'fuji-recipe', 'dynamic-range'), 'DR400')
  assert.equal(rowValue(model, 'fuji-recipe', 'highlight-tone'), '-1')
})

test('buildPhotoInfoModel still exposes file information when EXIF is absent', () => {
  const model = buildPhotoInfoModel(basePhoto)

  assert.equal(model.hasExif, false)
  assert.equal(rowValue(model, 'basic', 'dimensions'), '6000 × 4000')
  assert.equal(rowValue(model, 'basic', 'megapixels'), '24 MP')
  assert.equal(rowValue(model, 'basic', 'file-size'), '5 MB')
  assert.deepEqual(model.captureParameters, [])
  assert.deepEqual(model.sections, [])
})

test('buildPhotoInfoModel preserves server-derived location when embedded EXIF is absent', () => {
  const model = buildPhotoInfoModel({
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

  assert.equal(model.hasExif, false)
  assert.equal(rowValue(model, 'location', 'latitude'), '1.3521°')
  assert.equal(rowValue(model, 'location', 'place'), 'Singapore')
  assert.equal(rowValue(model, 'location', 'address'), 'Marina Bay')
  assert.deepEqual(model.mapLocation, { latitude: 1.3521, longitude: 103.8198 })
})

test('buildPhotoInfoModel exposes the web tone analysis and histogram source', () => {
  const model = buildPhotoInfoModel({
    ...basePhoto,
    toneAnalysis: {
      toneType: 'high-contrast',
      brightness: 48,
      contrast: 72,
      shadowRatio: 0.234,
      highlightRatio: 0.119,
    },
  })

  assert.equal(model.toneAnalysis?.tone.value, 'High Contrast')
  assert.deepEqual(
    model.toneAnalysis?.metrics.map(metric => [metric.id, metric.value]),
    [
      ['brightness', '48%'],
      ['contrast', '72%'],
      ['shadow-ratio', '23%'],
      ['highlight-ratio', '12%'],
    ],
  )
  assert.equal(model.toneAnalysis?.histogramUrl, basePhoto.thumbnailUrl)
})

test('buildPhotoInfoModel applies GPS references to the native map coordinates', () => {
  const model = buildPhotoInfoModel({
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

test('buildPhotoInfoModel uses ShutterSpeedValue when ExposureTime is unavailable', () => {
  const model = buildPhotoInfoModel({
    ...basePhoto,
    exif: {
      ShutterSpeedValue: 1 / 250,
    },
  })

  assert.equal(model.captureParameters.find(parameter => parameter.id === 'shutter-speed')?.value, '1/250 s')
})

test('buildPhotoInfoModel localizes metadata labels and known EXIF values', async () => {
  const { i18n } = await import('../../i18n')
  const model = buildPhotoInfoModel(
    {
      ...basePhoto,
      exif: {
        FNumber: 2.8,
        MeteringMode: 'Pattern',
      },
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

  assert.equal(model.basic.title, '基本信息')
  assert.equal(model.captureParameters.find(parameter => parameter.id === 'aperture')?.label, '光圈')
  assert.equal(rowValue(model, 'capture-mode', 'metering-mode'), '图案')
  assert.equal(model.toneAnalysis?.tone.label, '影调类型')
  assert.equal(model.toneAnalysis?.tone.value, '高对比度')
})
