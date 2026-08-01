/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'AfilmoryWidgets',
  bundleIdentifier: '.widgets',
  deploymentTarget: '26.0',
  colors: {
    $accent: '#0A84FF',
  },
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
}
