import { Redirect } from 'expo-router'

import { useAuth } from '@/modules/auth/sessionStore'
import { getDefaultTabPath } from '@/modules/shell/tabAccess'

export default function IndexRoute() {
  const auth = useAuth()
  const href = getDefaultTabPath(auth.status)

  return href ? <Redirect href={href} /> : null
}
