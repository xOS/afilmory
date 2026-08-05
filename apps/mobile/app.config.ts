import type { ConfigContext, ExpoConfig } from 'expo/config'

export type AfilmoryAppVariant = 'local' | 'production'

const APPLE_TARGETS_PLUGIN = '@bacons/apple-targets'
const APPLE_AUTHENTICATION_PLUGIN = 'expo-apple-authentication'
const SHARE_UPLOAD_HANDOFF_PLUGIN = './plugins/with-share-upload-handoff'

const variantConfiguration = {
  local: {
    apiEnvironment: 'local',
    bundleIdentifier: 'app.afilmory.local',
    icon: './assets/images/icon-local.png',
    name: 'Afilmory Local',
    scheme: 'afilmory-local',
  },
  production: {
    apiEnvironment: 'production',
    bundleIdentifier: 'app.afilmory',
    icon: './assets/images/icon.png',
    name: 'Afilmory',
    scheme: 'afilmory',
  },
} as const satisfies Record<
  AfilmoryAppVariant,
  {
    apiEnvironment: AfilmoryAppVariant
    bundleIdentifier: string
    icon: string
    name: string
    scheme: string
  }
>

export function resolveAppVariant(value = process.env.AFILMORY_APP_VARIANT): AfilmoryAppVariant {
  if (!value || value === 'production') {
    return 'production'
  }
  if (value === 'local') {
    return 'local'
  }
  throw new Error(`Unsupported AFILMORY_APP_VARIANT: ${value}`)
}

function pluginName(plugin: NonNullable<ExpoConfig['plugins']>[number]): string {
  return Array.isArray(plugin) ? (plugin[0] ?? '') : plugin
}

export function createAppConfig(config: Partial<ExpoConfig>, variant: AfilmoryAppVariant): ExpoConfig {
  const selected = variantConfiguration[variant]
  const isLocal = variant === 'local'
  const infoPlist = { ...config.ios?.infoPlist }

  if (isLocal) {
    delete infoPlist.NSSupportsLiveActivities
  }

  const plugins = (config.plugins ?? []).filter((plugin) => {
    if (!isLocal) {
      return true
    }
    return ![APPLE_AUTHENTICATION_PLUGIN, APPLE_TARGETS_PLUGIN, SHARE_UPLOAD_HANDOFF_PLUGIN].includes(
      pluginName(plugin),
    )
  })

  return {
    ...config,
    icon: selected.icon,
    name: selected.name,
    scheme: selected.scheme,
    slug: config.slug ?? 'afilmory',
    extra: {
      ...config.extra,
      apiEnvironment: selected.apiEnvironment,
      appVariant: variant,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: selected.bundleIdentifier,
      entitlements: isLocal ? {} : config.ios?.entitlements,
      infoPlist: {
        ...infoPlist,
        AfilmoryApiEnvironment: selected.apiEnvironment,
        ...(!isLocal && { AfilmoryAppGroupIdentifier: 'group.app.afilmory' }),
        AfilmoryAppVariant: variant,
        AfilmoryURLScheme: selected.scheme,
      },
      usesAppleSignIn: !isLocal,
    },
    android: {
      ...config.android,
      package: selected.bundleIdentifier,
    },
    plugins,
  }
}

export default ({ config }: ConfigContext): ExpoConfig => createAppConfig(config, resolveAppVariant())
