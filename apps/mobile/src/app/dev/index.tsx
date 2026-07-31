import { Redirect, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'

import { DevLabScreen } from '@/modules/dev-lab/DevLabScreen'
import type { DevLabRouteParams } from '@/modules/dev-lab/params'
import { parseDevLabParams } from '@/modules/dev-lab/params'

export default function DevLabRoute() {
  const routeParams = useLocalSearchParams() as DevLabRouteParams
  const parsed = useMemo(() => parseDevLabParams(routeParams), [routeParams])

  if (!__DEV__) {
    return <Redirect href="/photos" />
  }

  return <DevLabScreen initialInput={routeParams} initialParsed={parsed} />
}
