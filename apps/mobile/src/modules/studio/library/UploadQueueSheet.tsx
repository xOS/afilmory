import { useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTranslation } from '@/i18n'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import type { UploadJob, UploadJobStatus } from './uploadQueue'
import {
  cancelAllUploads,
  cancelUploadJob,
  clearFinishedUploads,
  retryFailedUploads,
  retryUploadJob,
  summarizeQueue,
  useUploadQueue,
} from './uploadQueue'
import { formatBytes } from './uploadTags'

const STATUS_KEY: Record<UploadJobStatus, string> = {
  cancelled: 'studio.upload.status.cancelled',
  done: 'studio.upload.status.done',
  failed: 'studio.upload.status.failed',
  processing: 'studio.upload.status.processing',
  queued: 'studio.upload.status.queued',
  uploading: 'studio.upload.status.uploading',
}

export function UploadQueueSheet() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const jobs = useUploadQueue()
  const summary = useMemo(() => summarizeQueue(jobs), [jobs])

  const retryable = jobs.some(job => job.status === 'failed' || job.status === 'cancelled')
  const clearable = jobs.some(job => job.status === 'done' || job.status === 'cancelled')

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headline}>
          {t('studio.upload.queue.headline', { done: summary.done, total: summary.total })}
        </Text>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.round(summary.progress * 100)}%` }]} />
        </View>
        {summary.failed > 0 ? (
          <Text style={styles.headerFailed}>{t('studio.upload.queue.failedCount', { count: summary.failed })}</Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {jobs.map(job => (
          <JobRow job={job} key={job.id} styles={styles} />
        ))}
      </ScrollView>

      <View style={styles.actions}>
        {summary.running ? (
          <Pressable accessibilityRole="button" onPress={cancelAllUploads} style={styles.action}>
            <Text style={[styles.actionLabel, styles.actionDanger]}>{t('studio.upload.queue.cancelAll')}</Text>
          </Pressable>
        ) : null}
        {retryable ? (
          <Pressable accessibilityRole="button" onPress={retryFailedUploads} style={styles.action}>
            <Text style={styles.actionLabel}>{t('studio.upload.queue.retryAll')}</Text>
          </Pressable>
        ) : null}
        {clearable ? (
          <Pressable accessibilityRole="button" onPress={clearFinishedUploads} style={styles.action}>
            <Text style={styles.actionLabel}>{t('studio.upload.queue.clear')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function JobRow({ job, styles }: { job: UploadJob, styles: ReturnType<typeof createStyles> }) {
  const { t } = useTranslation()
  const active = job.status === 'uploading' || job.status === 'processing' || job.status === 'queued'
  const statusStyle
    = job.status === 'failed' ? styles.statusFailed : job.status === 'done' ? styles.statusDone : styles.statusIdle

  return (
    <View style={styles.row}>
      <Image source={{ uri: job.previewUri }} style={styles.rowThumb} />
      <View style={styles.rowMain}>
        <View style={styles.rowHead}>
          <Text numberOfLines={1} style={styles.rowName}>
            {job.name}
          </Text>
          <Text style={[styles.rowStatus, statusStyle]}>
            {t(STATUS_KEY[job.status])}
            {job.attempt > 1 && active ? ` · ${t('studio.upload.queue.attempt', { attempt: job.attempt })}` : ''}
          </Text>
        </View>

        <Text style={styles.rowMeta}>{formatBytes(job.bytes)}</Text>

        {active ? (
          <View style={styles.rowTrack}>
            <View style={[styles.rowTrackFill, { width: `${Math.round(job.progress * 100)}%` }]} />
          </View>
        ) : null}

        {job.error && job.status === 'failed' ? (
          <Text numberOfLines={2} style={styles.rowError}>
            {job.error}
          </Text>
        ) : null}

        <View style={styles.rowActions}>
          {active ? (
            <Pressable accessibilityRole="button" onPress={() => cancelUploadJob(job.id)}>
              <Text style={styles.rowAction}>{t('common.cancel')}</Text>
            </Pressable>
          ) : null}
          {job.status === 'failed' || job.status === 'cancelled' ? (
            <Pressable accessibilityRole="button" onPress={() => retryUploadJob(job.id)}>
              <Text style={styles.rowAction}>{t('studio.upload.queue.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { backgroundColor: palette.bgCanvas, flex: 1 },
    header: { gap: 10, paddingHorizontal: 20, paddingTop: 20 },
    headline: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 17, fontWeight: '700' },
    headerFailed: { color: palette.danger, fontFamily: font.mono, fontSize: 11 },
    track: { backgroundColor: palette.bgElement, borderRadius: 3, height: 6, overflow: 'hidden' },
    trackFill: { backgroundColor: palette.accent, height: 6 },
    list: { gap: 10, padding: 20 },
    row: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    rowThumb: { borderCurve: 'continuous', borderRadius: 8, height: 48, width: 48 },
    rowMain: { flex: 1, gap: 6, justifyContent: 'center' },
    rowHead: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
    rowMeta: { color: palette.textMuted, fontFamily: font.mono, fontSize: 10 },
    rowName: { color: palette.textPrimary, flexShrink: 1, fontFamily: font.mono, fontSize: 12 },
    rowStatus: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.4 },
    statusIdle: { color: palette.textSecondary },
    statusDone: { color: palette.accentHi },
    statusFailed: { color: palette.danger },
    rowTrack: { backgroundColor: palette.bgElement, borderRadius: 2, height: 4, overflow: 'hidden' },
    rowTrackFill: { backgroundColor: palette.accent, height: 4 },
    rowError: { color: palette.danger, fontFamily: font.mono, fontSize: 10 },
    rowActions: { flexDirection: 'row', gap: 16 },
    rowAction: { color: palette.accentHi, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    actions: {
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 32,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    action: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 10,
      flex: 1,
      paddingVertical: 11,
    },
    actionLabel: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 13, fontWeight: '600' },
    actionDanger: { color: palette.danger },
  })
}
