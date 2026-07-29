import { definePage } from '@/presentation'

import { SignInScreen } from './SignInScreen'

export const signInPage = definePage({
  Component: SignInScreen,
  id: 'sign-in',
  presentation: { headerShown: false, style: 'pageSheet' },
  title: 'Sign in',
})
