import { Button, ContentUnavailableView, Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, controlSize, fixedSize, frame, padding } from '@expo/ui/swift-ui/modifiers'
import type { ComponentProps, ReactNode } from 'react'
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

const OPTICAL_CENTER_LIFT = 40

export function StudioPlaceholder({
  action,
  description,
  systemImage,
  title,
}: {
  action?: { label: string, onPress: () => void }
  description: string
  systemImage: ComponentProps<typeof ContentUnavailableView>['systemImage']
  title: string
}) {
  return (
    <StudioHost>
      <VStack
        spacing={8}
        modifiers={[
          padding({ bottom: OPTICAL_CENTER_LIFT * 2, horizontal: 24 }),
          frame({ maxHeight: Infinity, maxWidth: Infinity }),
        ]}
      >
        <ContentUnavailableView
          description={description}
          modifiers={[fixedSize({ horizontal: false, vertical: true })]}
          systemImage={systemImage}
          title={title}
        />
        {action ? (
          <Button
            label={action.label}
            modifiers={[buttonStyle('borderedProminent'), controlSize('large')]}
            onPress={action.onPress}
          />
        ) : null}
      </VStack>
    </StudioHost>
  )
}

export function StudioAccessBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { t } = useTranslation()

  if (auth.status === 'loading') {
    return <StudioLoadingState />
  }

  if (auth.status === 'signedOut') {
    return (
      <StudioPlaceholder
        action={{ label: t('common.signIn'), onPress: () => void present(signInPage) }}
        description={t('studio.access.signedOut.description')}
        systemImage="lock"
        title={t('studio.access.signedOut.title')}
      />
    )
  }

  const membership = auth.session?.activeMembership
  const canManage = membership?.role === 'admin' || membership?.role === 'owner'
  if (!canManage || auth.session?.activeWorkspace?.status !== 'active') {
    return (
      <StudioPlaceholder
        description={t('studio.access.admin.description')}
        systemImage="person.badge.shield.checkmark"
        title={t('studio.access.admin.title')}
      />
    )
  }

  return children
}

export function StudioErrorState({ message, onRetry }: { message?: string, onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <StudioPlaceholder
      action={{ label: t('common.retry'), onPress: onRetry }}
      description={message ?? t('studio.error.description')}
      systemImage="exclamationmark.triangle"
      title={t('studio.error.title')}
    />
  )
}

export function StudioLoadingState() {
  return (
    <StudioHost>
      <VStack
        modifiers={[padding({ bottom: OPTICAL_CENTER_LIFT * 2 }), frame({ maxHeight: Infinity, maxWidth: Infinity })]}
      >
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
