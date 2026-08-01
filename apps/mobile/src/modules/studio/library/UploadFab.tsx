import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { present } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import type { UploadJob } from './uploadQueue'
import { summarizeQueue } from './uploadQueue'
import { uploadQueuePage } from './uploadQueuePage'

export function UploadFab({ jobs }: { jobs: readonly UploadJob[] }) {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const summary = useMemo(() => summarizeQueue(jobs), [jobs])

  if (jobs.length === 0) {
    return null
  }

  const failed = summary.failed > 0
  const label = summary.running ? `${summary.done}/${summary.total}` : failed ? String(summary.failed) : '✓'

  return (
    <Pressable
      accessibilityLabel={t('studio.upload.queue.title')}
      accessibilityRole="button"
      onPress={() => void present(uploadQueuePage)}
      style={styles.fab}
    >
      <View style={[styles.track, failed && styles.trackFailed]}>
        <View
          style={[
            styles.fill,
            failed && styles.fillFailed,
            { width: `${Math.round((failed ? 1 : summary.progress) * 100)}%` },
          ]}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    // Sits clear of the tab bar so it never competes with navigation targets.
    fab: {
      alignItems: 'center',
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      bottom: 108,
      elevation: 6,
      height: 52,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'absolute',
      right: 18,
      shadowColor: '#000',
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      width: 52,
    },
    track: { bottom: 0, height: 3, left: 0, position: 'absolute', right: 0 },
    trackFailed: { opacity: 1 },
    fill: { backgroundColor: palette.accent, height: 3 },
    fillFailed: { backgroundColor: palette.danger },
    label: { color: palette.textPrimary, fontFamily: font.mono, fontSize: 13, fontWeight: '700' },
  })
}
