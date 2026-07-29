import { SymbolView } from 'expo-symbols'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenStack, ScreenStackItem } from 'react-native-screens'

import { font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import type { PageRuntime } from './page'
import { PageRuntimeProvider } from './page'
import type { PresentationSession } from './presentationStore'
import {
  cancelPresentation,
  completePresentation,
  getPresentationSnapshot,
  present,
  subscribeToPresentations,
} from './presentationStore'

const ignoreRequestClose = () => {}

export function PresentationHost() {
  const sessions = useSyncExternalStore(subscribeToPresentations, getPresentationSnapshot, getPresentationSnapshot)

  return sessions.map(session =>
    session.presentation.detents ? (
      <PresentationSheet key={session.id} session={session} />
    ) : (
      <PresentationModal key={session.id} session={session} />
    ))
}

function useSessionRuntime(session: PresentationSession) {
  const cancel = useCallback(() => cancelPresentation(session.id), [session.id])
  const finish = useCallback((value?: unknown) => completePresentation(session.id, value), [session.id])
  const runtime = useMemo<PageRuntime<unknown, unknown>>(
    () => ({ cancel, finish, params: session.params, present, source: 'presentation' }),
    [cancel, finish, session.params],
  )
  return { cancel, runtime }
}

function PresentationModal({ session }: { session: PresentationSession }) {
  const { palette } = useTheme()
  const { animationType, dismissible, style } = session.presentation
  const { cancel, runtime } = useSessionRuntime(session)

  return (
    <Modal
      visible
      allowSwipeDismissal={dismissible}
      animationType={animationType}
      backdropColor={palette.bgCanvas}
      presentationStyle={style}
      onRequestClose={dismissible ? cancel : ignoreRequestClose}
    >
      <PageRuntimeProvider value={runtime}>
        <SessionBody backgroundColor={palette.bgCanvas} cancel={cancel} session={session} />
      </PageRuntimeProvider>
    </Modal>
  )
}

function PresentationSheet({ session }: { session: PresentationSession }) {
  const { palette } = useTheme()
  const { detents, dismissible } = session.presentation
  const { cancel, runtime } = useSessionRuntime(session)
  const onDismissed = useCallback(() => {
    if (dismissible) {
      cancel()
    }
  }, [cancel, dismissible])

  return (
    <ScreenStack style={styles.sheetStack}>
      {/* react-native-screens always treats the first ScreenStackItem in a stack as the
          base "push" screen — only later siblings get natively presented as modals — so
          a formSheet needs an empty screen underneath it to present over. */}
      <ScreenStackItem screenId={`sheet-host-${session.id}`} />
      <ScreenStackItem
        contentStyle={{ backgroundColor: palette.bgSurface }}
        headerConfig={{ hidden: true }}
        preventNativeDismiss={!dismissible}
        screenId={`sheet-${session.id}`}
        sheetAllowedDetents={detents}
        sheetCornerRadius={radiusLg}
        sheetGrabberVisible
        stackPresentation="formSheet"
        onDismissed={onDismissed}
      >
        <PageRuntimeProvider value={runtime}>
          <SessionBody backgroundColor={palette.bgSurface} cancel={cancel} session={session} />
        </PageRuntimeProvider>
      </ScreenStackItem>
    </ScreenStack>
  )
}

function SessionBody({
  backgroundColor,
  cancel,
  session,
}: {
  backgroundColor: string
  cancel: () => void
  session: PresentationSession
}) {
  const { palette } = useTheme()
  const { Component } = session.page
  const { dismissible, headerShown } = session.presentation

  return (
    <View style={[styles.modal, { backgroundColor }]}>
      {headerShown ? (
        <View style={[styles.headerSurface, { backgroundColor: palette.bgSurface, borderBottomColor: palette.border }]}>
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <View style={styles.headerSide} />
              <Text numberOfLines={1} style={[styles.title, { color: palette.textPrimary }]}>
                {session.page.title}
              </Text>
              <View style={[styles.headerSide, styles.headerAction]}>
                {dismissible ? (
                  <Pressable
                    accessibilityLabel={`Close ${session.page.title}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                    onPress={cancel}
                  >
                    <SymbolView name="xmark" size={16} tintColor={palette.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>
      ) : null}
      <View style={styles.content}>
        <Component />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  content: { flex: 1 },
  sheetStack: { height: 0, width: 0 },
  headerSurface: { borderBottomWidth: StyleSheet.hairlineWidth },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 52,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerSide: { width: 44 },
  headerAction: { alignItems: 'flex-end' },
  title: {
    flex: 1,
    fontFamily: font.ui,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: { opacity: 0.5 },
})
