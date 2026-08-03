/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'share',
  name: 'AfilmoryShare',
  displayName: 'Afilmory',
  bundleIdentifier: '.share',
  deploymentTarget: '26.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.app.afilmory'],
  },
  frameworks: ['AppIntents', 'ImageIO', 'Photos', 'SwiftUI', 'UniformTypeIdentifiers'],
}
