import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import { SignInScreen } from './SignInScreen'

export const signInPage = definePage({
  Component: SignInScreen,
  id: 'sign-in',
  presentation: { headerShown: false, style: 'pageSheet' },
  title: translate('page.signIn'),
})
