import { Button, ContentUnavailableView, Form, Host, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, frame, padding } from '@expo/ui/swift-ui/modifiers'
import type { ReactNode } from 'react'
import { useCallback } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { StyleSheet, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { signInPage } from '@/modules/auth/signInPage'
import { present } from '@/presentation'
import { useTheme } from '@/theme/useTheme'

export function StudioHost({
  children,
  onWidthChange,
}: {
  children: ReactNode
  onWidthChange?: (width: number) => void
}) {
  const { palette } = useTheme()
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onWidthChange?.(event.nativeEvent.layout.width),
    [onWidthChange],
  )
  return (
    <View style={styles.hostContainer} onLayout={handleLayout}>
      <Host colorScheme="dark" seedColor={palette.accent} style={styles.host}>
        {children}
      </Host>
    </View>
  )
}

export function StudioAccessBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { t } = useTranslation()

  if (auth.status === 'loading') {
    return (
      <StudioHost>
        <VStack modifiers={[frame({ maxHeight: Infinity, maxWidth: Infinity })]}>
          <ProgressView />
        </VStack>
      </StudioHost>
    )
  }

  if (auth.status === 'signedOut') {
    return (
      <StudioHost>
        <Form>
          <Section>
            <ContentUnavailableView
              description={t('studio.access.signedOut.description')}
              systemImage="lock"
              title={t('studio.access.signedOut.title')}
            />
            <Button
              label={t('common.signIn')}
              modifiers={[buttonStyle('borderedProminent')]}
              onPress={() => void present(signInPage)}
            />
          </Section>
        </Form>
      </StudioHost>
    )
  }

  const membership = auth.session?.activeMembership
  const canManage = membership?.role === 'admin' || membership?.role === 'owner'
  if (!canManage || auth.session?.activeWorkspace?.status !== 'active') {
    return (
      <StudioHost>
        <VStack modifiers={[frame({ maxHeight: Infinity, maxWidth: Infinity }), padding({ horizontal: 24 })]}>
          <ContentUnavailableView
            description={t('studio.access.admin.description')}
            systemImage="person.badge.shield.checkmark"
            title={t('studio.access.admin.title')}
          />
        </VStack>
      </StudioHost>
    )
  }

  return children
}

export function StudioErrorState({ message, onRetry }: { message?: string, onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <StudioHost>
      <Form>
        <Section>
          <ContentUnavailableView
            description={message ?? t('studio.error.description')}
            systemImage="exclamationmark.triangle"
            title={t('studio.error.title')}
          />
          <Button label={t('common.retry')} onPress={onRetry} />
        </Section>
      </Form>
    </StudioHost>
  )
}

export function StudioLoadingState() {
  return (
    <StudioHost>
      <VStack modifiers={[frame({ maxHeight: Infinity, maxWidth: Infinity })]}>
        <ProgressView />
      </VStack>
    </StudioHost>
  )
}

export function SecondaryText({ children }: { children: ReactNode }) {
  return <Text modifiers={[padding({ top: 2 })]}>{children}</Text>
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  hostContainer: { flex: 1 },
})
