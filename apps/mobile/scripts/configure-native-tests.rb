require 'pathname'
require 'xcodeproj'

mobile_root = Pathname.new(__dir__).parent
project_path = mobile_root.join('ios/Afilmory.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == 'Afilmory' }
raise 'Afilmory target is missing' unless app_target

if existing = project.targets.find { |target| target.name == 'AfilmoryNativeTests' }
  existing.remove_from_project
end

if existing_group = project.main_group.children.find { |child| child.display_name == 'AfilmoryNativeTests' }
  existing_group.remove_from_project
end

tests_root = mobile_root.join('modules/photo-masonry/ios/Tests')
group = project.main_group.new_group('AfilmoryNativeTests', tests_root.relative_path_from(mobile_root.join('ios')).to_s)
target = project.new_target(:unit_test_bundle, 'AfilmoryNativeTests', :ios, '26.0')
target.add_system_framework('XCTest')

frameworks_phase = target.new_shell_script_build_phase('[CP] Embed Pods Frameworks')
frameworks_phase.shell_script = '"${PODS_ROOT}/Target Support Files/Pods-Afilmory/Pods-Afilmory-frameworks.sh"'

resources_phase = target.new_shell_script_build_phase('[CP] Copy Pods Resources')
resources_phase.shell_script = '"${PODS_ROOT}/Target Support Files/Pods-Afilmory/Pods-Afilmory-resources.sh"'

tests_root.glob('*.swift').sort.each do |path|
  reference = group.new_file(path.basename.to_s)
  target.source_build_phase.add_file_reference(reference)
end

fixtures_group = group.new_group('Fixtures', 'Fixtures')
tests_root.join('Fixtures').glob('*.json').sort.each do |path|
  reference = fixtures_group.new_file(path.basename.to_s)
  target.resources_build_phase.add_file_reference(reference)
end

locales_root = mobile_root.join('modules/photo-masonry/ios/Resources/Locales')
locales_group = group.new_group('Locales', '../Resources/Locales')
locales_root.glob('*.json').sort.each do |path|
  reference = locales_group.new_file(path.basename.to_s)
  target.resources_build_phase.add_file_reference(reference)
end

target.build_configurations.each do |configuration|
  app_configuration = app_target.build_configurations.find { |candidate| candidate.name == configuration.name }
  configuration.base_configuration_reference = app_configuration.base_configuration_reference
  configuration.build_settings.merge!(
    'BUNDLE_LOADER' => '',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'IPHONEOS_DEPLOYMENT_TARGET' => '26.0',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'app.afilmory.native-tests',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'SWIFT_VERSION' => '5.0',
    'TEST_HOST' => ''
  )
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target, false)
scheme.add_test_target(target)
scheme.save_as(project_path, 'AfilmoryNativeTests', true)
