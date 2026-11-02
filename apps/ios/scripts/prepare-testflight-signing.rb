#!/usr/bin/env ruby
# Configure the generated native project without putting private signing files in Git.
require 'json'
begin
  require 'xcodeproj'
rescue LoadError
  # Homebrew isolates CocoaPods' gems from the shell's Ruby installation.
  cocoapods_prefix = IO.popen(['brew', '--prefix', 'cocoapods'], &:read).strip
  Gem.use_paths(Gem.dir, [File.join(cocoapods_prefix, 'libexec')] + Gem.path)
  require 'xcodeproj'
end

root = File.expand_path('..', __dir__)
config = JSON.parse(File.read(File.join(root, 'app.json'))).fetch('expo')
signing_dir = File.join(root, '.testflight.local')
signing = JSON.parse(File.read(File.join(signing_dir, 'signing-metadata.json')))
project = Xcodeproj::Project.open(File.join(root, 'ios', 'Schwanki.xcodeproj'))
target = project.targets.find { |candidate| candidate.name == 'Schwanki' }
raise 'Schwanki native target missing' unless target

target.build_configurations.each do |build|
  build.build_settings['MARKETING_VERSION'] = config.fetch('version')
  build.build_settings['CURRENT_PROJECT_VERSION'] = config.fetch('ios').fetch('buildNumber')
  next unless build.name == 'Release'
  build.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  build.build_settings['CODE_SIGN_IDENTITY'] = signing.fetch('signing_sha1')
  build.build_settings['DEVELOPMENT_TEAM'] = signing.fetch('team_id')
  build.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = signing.fetch('profile_name')
end
project.save

info_path = File.join(root, 'ios', 'Schwanki', 'Info.plist')
info = Xcodeproj::Plist.read_from_path(info_path)
info['CFBundleShortVersionString'] = config.fetch('version')
info['CFBundleVersion'] = config.fetch('ios').fetch('buildNumber')
Xcodeproj::Plist.write_to_path(info, info_path)

Xcodeproj::Plist.write_to_path({
  'method' => 'app-store-connect',
  'destination' => 'export',
  'signingStyle' => 'manual',
  'teamID' => signing.fetch('team_id'),
  'signingCertificate' => signing.fetch('signing_sha1'),
  'provisioningProfiles' => { config.fetch('ios').fetch('bundleIdentifier') => signing.fetch('profile_uuid') },
  'manageAppVersionAndBuildNumber' => false,
  'uploadSymbols' => true
}, File.join(signing_dir, 'ExportOptions.plist'))
puts "Prepared Schwanki #{config.fetch('version')} (#{config.fetch('ios').fetch('buildNumber')}) for App Store signing."
