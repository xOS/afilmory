import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { createAppConfig, resolveAppVariant } from './app.config.ts'

const baseConfig = {
  name: 'Afilmory',
  slug: 'afilmory',
  scheme: 'afilmory',
  ios: {
    bundleIdentifier: 'app.afilmory',
    entitlements: {
      'aps-environment': 'development',
      'com.apple.security.application-groups': ['group.app.afilmory'],
    },
    infoPlist: { NSSupportsLiveActivities: true },
    usesAppleSignIn: true,
  },
  plugins: [
    '@bacons/apple-targets',
    'expo-router',
    'expo-apple-authentication',
    './plugins/with-share-upload-handoff',
  ],
}

test('production remains the safe default build variant', () => {
  assert.equal(resolveAppVariant(), 'production')
  assert.equal(resolveAppVariant('production'), 'production')
  assert.throws(() => resolveAppVariant('preview'), /Unsupported AFILMORY_APP_VARIANT/)
})

test('local variant is independently installable and omits production-only capabilities', () => {
  const config = createAppConfig(baseConfig, 'local')

  assert.equal(config.name, 'Afilmory Local')
  assert.equal(config.icon, './assets/images/icon-local.png')
  assert.equal(config.scheme, 'afilmory-local')
  assert.equal(config.ios?.bundleIdentifier, 'app.afilmory.local')
  assert.equal(config.android?.package, 'app.afilmory.local')
  assert.equal(config.ios?.usesAppleSignIn, false)
  assert.deepEqual(config.ios?.entitlements, {})
  assert.equal(config.ios?.infoPlist?.AfilmoryApiEnvironment, 'local')
  assert.equal(config.ios?.infoPlist?.NSSupportsLiveActivities, undefined)
  assert.deepEqual(config.plugins, ['expo-router'])
})

test('production variant retains extensions and production capabilities', () => {
  const config = createAppConfig(baseConfig, 'production')

  assert.equal(config.ios?.bundleIdentifier, 'app.afilmory')
  assert.equal(config.ios?.usesAppleSignIn, true)
  assert.equal(config.ios?.infoPlist?.AfilmoryApiEnvironment, 'production')
  assert.equal(config.ios?.infoPlist?.AfilmoryAppGroupIdentifier, 'group.app.afilmory')
  assert.deepEqual(config.plugins, baseConfig.plugins)
})
