Pod::Spec.new do |s|
  s.name           = 'PhotoMasonry'
  s.version        = '1.0.0'
  s.summary        = 'Native masonry photo grid with pinch column transitions'
  s.description    = 'Native masonry photo grid with pinch column transitions'
  s.author         = 'Afilmory'
  s.homepage       = 'https://github.com/Afilmory/afilmory'
  s.license        = { type: 'MIT' }
  s.platforms      = { ios: '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'RNScreens'
  s.dependency 'SDWebImage', '~> 5.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
