import {
  Button,
  ContentUnavailableView,
  Form,
  HStack,
  Image,
  LabeledContent,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import { font, foregroundStyle, lineLimit, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers'
import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'

import { getDataSyncStatus, listDataSyncConflicts, resolveDataSyncConflict } from '../api'
import { formatCount, formatDateTime } from '../format'
import { StudioAccessBoundary, StudioErrorState, StudioHost, StudioLoadingState } from '../StudioNative'
import type { DataSyncConflict, DataSyncProgressEvent, DataSyncStatus } from '../types'
import { useRemoteResource } from '../useRemoteResource'
import { runDataSync } from './runSync'

interface OperationsData {
  conflicts: DataSyncConflict[]
  status: DataSyncStatus
}

export function StudioOperationsScreen() {
  return (
    <StudioAccessBoundary>
      <StudioOperationsContent />
    </StudioAccessBoundary>
  )
}

function StudioOperationsContent() {
  const { i18n, t } = useTranslation()
  const locale = getIntlLocale(i18n.resolvedLanguage)
  const load = useCallback(async (): Promise<OperationsData> => {
    const [status, conflicts] = await Promise.all([getDataSyncStatus(), listDataSyncConflicts()])
    return { conflicts, status }
  }, [])
  const resource = useRemoteResource(load, [load])
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState(0)
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const startRun = useCallback(
    async (dryRun: boolean) => {
      if (running) {
        return
      }
      setRunning(true)
      setRunProgress(0)
      setRunMessage(t(dryRun ? 'studio.operations.dryRunRunning' : 'studio.operations.syncRunning'))
      try {
        await runDataSync(dryRun, (event: DataSyncProgressEvent) => {
          if (event.type === 'stage' || event.type === 'action') {
            const total = Math.max(event.payload.total, 1)
            const current = event.type === 'stage' ? event.payload.processed : event.payload.index
            setRunProgress(Math.min(1, current / total))
          }
          else if (event.type === 'log') {
            setRunMessage(event.payload.message)
          }
          else if (event.type === 'complete') {
            setRunProgress(1)
          }
        })
        await resource.reload()
        Alert.alert(
          t(dryRun ? 'studio.operations.dryRunComplete.title' : 'studio.operations.syncComplete.title'),
          t(dryRun ? 'studio.operations.dryRunComplete.description' : 'studio.operations.syncComplete.description'),
        )
      }
      catch (error) {
        Alert.alert(t('studio.operations.runFailed'), error instanceof Error ? error.message : undefined)
      }
      finally {
        setRunning(false)
        setRunMessage(null)
      }
    },
    [resource, running, t],
  )

  const chooseRunMode = useCallback(() => {
    Alert.alert(t('studio.operations.run.title'), t('studio.operations.run.description'), [
      { style: 'cancel', text: t('common.cancel') },
      { text: t('studio.operations.run.dry'), onPress: () => void startRun(true) },
      { text: t('studio.operations.run.apply'), onPress: () => void startRun(false) },
    ])
  }, [startRun, t])

  const resolve = useCallback(
    async (conflict: DataSyncConflict, strategy: 'prefer-database' | 'prefer-storage') => {
      if (resolvingId) {
        return
      }
      setResolvingId(conflict.id)
      try {
        await resolveDataSyncConflict(conflict.id, strategy)
        await resource.reload()
      }
      catch (error) {
        Alert.alert(t('studio.operations.resolve.failed'), error instanceof Error ? error.message : undefined)
      }
      finally {
        setResolvingId(null)
      }
    },
    [resolvingId, resource, t],
  )

  const chooseResolution = useCallback(
    (conflict: DataSyncConflict) => {
      Alert.alert(t('studio.operations.resolve.title'), t('studio.operations.resolve.description'), [
        { style: 'cancel', text: t('common.cancel') },
        {
          text: t('studio.operations.resolve.database'),
          onPress: () => void resolve(conflict, 'prefer-database'),
        },
        {
          text: t('studio.operations.resolve.storage'),
          onPress: () => void resolve(conflict, 'prefer-storage'),
        },
      ])
    },
    [resolve, t],
  )

  if (resource.loading && !resource.data) {
    return <StudioLoadingState />
  }
  if (resource.error && !resource.data) {
    return <StudioErrorState message={resource.error.message} onRetry={() => void resource.reload()} />
  }
  if (!resource.data) {
    return null
  }

  const lastRun = resource.data.status.lastRun

  return (
    <StudioHost>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          disabled={running || resolvingId !== null}
          icon="arrow.triangle.2.circlepath"
          onPress={chooseRunMode}
        >
          {t('studio.operations.run.action')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Form modifiers={[listStyle('insetGrouped'), refreshable(async () => void (await resource.reload()))]}>
        {running ? (
          <Section title={t('studio.operations.currentRun')}>
            <VStack alignment="leading" spacing={8}>
              <Text>{runMessage ?? t('studio.operations.syncRunning')}</Text>
              <ProgressView value={runProgress} />
            </VStack>
          </Section>
        ) : null}

        <Section title={t('studio.operations.lastRun')}>
          {lastRun ? (
            <>
              <LabeledContent label={t('studio.operations.completedAt')}>
                <Text>{formatDateTime(lastRun.completedAt, locale) ?? '—'}</Text>
              </LabeledContent>
              <LabeledContent label={t('studio.operations.runMode')}>
                <Text>{t(lastRun.dryRun ? 'studio.operations.mode.dryRun' : 'studio.operations.mode.applied')}</Text>
              </LabeledContent>
              <LabeledContent label={t('studio.operations.actions')}>
                <Text>{formatCount(lastRun.actionsCount, locale)}</Text>
              </LabeledContent>
              <LabeledContent label={t('studio.metric.conflicts')}>
                <Text>{formatCount(lastRun.summary.conflicts, locale)}</Text>
              </LabeledContent>
              <LabeledContent label={t('studio.operations.errors')}>
                <Text>{formatCount(lastRun.summary.errors, locale)}</Text>
              </LabeledContent>
            </>
          ) : (
            <ContentUnavailableView
              description={t('studio.operations.neverSynced')}
              systemImage="clock.arrow.circlepath"
              title={t('studio.operations.noRuns')}
            />
          )}
        </Section>

        <Section title={t('studio.operations.conflicts', { count: resource.data.conflicts.length })}>
          {resource.data.conflicts.length === 0 ? (
            <ContentUnavailableView
              description={t('studio.operations.noConflicts.description')}
              systemImage="checkmark.circle"
              title={t('studio.operations.noConflicts.title')}
            />
          ) : (
            resource.data.conflicts.map(conflict => (
              <Button key={conflict.id} onPress={() => chooseResolution(conflict)}>
                <HStack spacing={12}>
                  <Image color="#ff9f0a" size={20} systemName="exclamationmark.triangle.fill" />
                  <VStack alignment="leading" spacing={3}>
                    <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(1)]}>
                      {conflict.photoId ?? conflict.storageKey}
                    </Text>
                    <Text
                      modifiers={[
                        foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
                        font({ textStyle: 'caption' }),
                        lineLimit(2),
                      ]}
                    >
                      {conflict.reason ?? conflict.storageProvider}
                    </Text>
                  </VStack>
                  <Spacer />
                  {resolvingId === conflict.id ? (
                    <ProgressView />
                  ) : (
                    <Image color="secondary" size={12} systemName="chevron.right" />
                  )}
                </HStack>
              </Button>
            ))
          )}
        </Section>
      </Form>
    </StudioHost>
  )
}
