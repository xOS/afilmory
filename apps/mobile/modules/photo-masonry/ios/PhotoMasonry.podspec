Pod::Spec.new do |s|
  s.name           = 'PhotoMasonry'
  s.version        = '1.0.0'
  s.summary        = 'Native masonry photo grid with pinch column transitions'
  s.description    = 'Native masonry photo grid with pinch column transitions'
  s.author         = 'Afilmory'
  s.homepage       = 'https://github.com/Afilmory/afilmory'
  s.license        = { type: 'MIT' }
  s.platforms      = { ios: '26.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'RNScreens'
  s.dependency 'SDWebImage', '~> 5.0'
  s.frameworks = 'ActivityKit', 'AVFoundation', 'MapKit', 'StoreKit', 'Photos', 'PhotosUI', 'UniformTypeIdentifiers'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
  s.exclude_files = 'Tests/**/*'

  s.test_spec 'Tests' do |test_spec|
    test_spec.source_files = 'Tests/**/*.swift'
  end
end
