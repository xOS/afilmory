import { Redirect } from 'expo-router'

import { DevLabScreen } from '@/modules/dev-lab/DevLabScreen'

export default function DevLabRoute() {
  if (!__DEV__) {
    return <Redirect href="/photos" />
  }

  return <DevLabScreen />
}
