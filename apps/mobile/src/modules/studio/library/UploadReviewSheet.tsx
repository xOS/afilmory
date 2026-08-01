import type { ImagePickerAsset } from 'expo-image-picker'
import { useCallback, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { usePageRuntime } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { getRecentTags } from './recentTags'
import { pickPhotosForUpload } from './upload'
import { deriveDirectoryFromTags, formatBytes, orderTagSuggestions, parseTagInput } from './uploadTags'

export interface UploadReviewParams {
  assets: ImagePickerAsset[]
  availableTags: string[]
}

export interface UploadReviewResult {
  assets: ImagePickerAsset[]
  tags: string[]
}

const THUMB_COLUMNS = 3
const THUMB_GAP = 6

export function UploadReviewSheet() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const { cancel, finish, params } = usePageRuntime<UploadReviewParams, UploadReviewResult>()

  const [assets, setAssets] = useState<ImagePickerAsset[]>(params.assets)
  const [tags, setTags] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const suggestions = useMemo(
    () => orderTagSuggestions(params.availableTags, getRecentTags()).filter(tag => !tags.includes(tag)),
    [params.availableTags, tags],
  )
  const totalBytes = useMemo(
    () => assets.reduce((total, asset) => total + (asset.fileSize ?? 0) + (asset.pairedVideoAsset?.fileSize ?? 0), 0),
    [assets],
  )
  const directory = deriveDirectoryFromTags(tags)

  const commitDraft = useCallback(() => {
    const parsed = parseTagInput(draft)
    if (parsed.length > 0) {
      setTags(current => [...current, ...parsed.filter(tag => !current.includes(tag))])
    }
    setDraft('')
  }, [draft])

  const addMore = useCallback(async () => {
    const picked = await pickPhotosForUpload()
    if (picked.length === 0) {
      return
    }
    setAssets((current) => {
      const seen = new Set(current.map(asset => asset.uri))
      return [...current, ...picked.filter(asset => !seen.has(asset.uri))]
    })
  }, [])

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.summary}>
          {t('studio.upload.review.summary', { count: assets.length, size: formatBytes(totalBytes) })}
        </Text>

        <View style={styles.grid}>
          {assets.map(asset => (
            <View key={asset.uri} style={styles.cell}>
              <Image source={{ uri: asset.uri }} style={styles.thumb} />
              {asset.pairedVideoAsset ? <View style={styles.liveBadge} /> : null}
              <Pressable
                accessibilityLabel={t('studio.upload.review.remove')}
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => setAssets(current => current.filter(entry => entry.uri !== asset.uri))}
                style={styles.removeButton}
              >
                <Text style={styles.removeGlyph}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => void addMore()} style={[styles.cell, styles.addCell]}>
            <Text style={styles.addGlyph}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t('studio.upload.review.tagsLabel')}</Text>
        {tags.length > 0 ? (
          <View style={styles.chipRow}>
            {tags.map(tag => (
              <Pressable
                accessibilityRole="button"
                key={tag}
                onPress={() => setTags(current => current.filter(entry => entry !== tag))}
                style={[styles.chip, styles.chipSelected]}
              >
                <Text style={styles.chipSelectedLabel}>{`${tag} ×`}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDraft}
          onSubmitEditing={commitDraft}
          placeholder={t('studio.upload.review.tagsPlaceholder')}
          placeholderTextColor={palette.textMuted}
          returnKeyType="done"
          style={styles.input}
          value={draft}
        />
        {suggestions.length > 0 ? (
          <View style={styles.chipRow}>
            {suggestions.slice(0, 12).map(tag => (
              <Pressable
                accessibilityRole="button"
                key={tag}
                onPress={() => setTags(current => [...current, tag])}
                style={styles.chip}
              >
                <Text style={styles.chipLabel}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {directory ? <Text style={styles.directoryHint}>{`→ ${directory}/`}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => cancel()} style={styles.secondary}>
          <Text style={styles.secondaryLabel}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={assets.length === 0}
          onPress={() => finish({ assets, tags })}
          style={[styles.primary, assets.length === 0 && styles.disabled]}
        >
          <Text style={styles.primaryLabel}>{t('studio.upload.review.start', { count: assets.length })}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { backgroundColor: palette.bgCanvas, flex: 1 },
    body: { gap: 12, padding: 20 },
    summary: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 13 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: THUMB_GAP },
    cell: {
      aspectRatio: 1,
      borderCurve: 'continuous',
      borderRadius: 10,
      overflow: 'hidden',
      width: `${100 / THUMB_COLUMNS}%`,
    },
    thumb: { height: '100%', width: '100%' },
    liveBadge: {
      backgroundColor: palette.accentContrast,
      borderRadius: 4,
      height: 8,
      left: 6,
      opacity: 0.9,
      position: 'absolute',
      top: 6,
      width: 8,
    },
    removeButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 11,
      height: 22,
      justifyContent: 'center',
      position: 'absolute',
      right: 4,
      top: 4,
      width: 22,
    },
    removeGlyph: { color: '#fff', fontSize: 15, lineHeight: 18 },
    addCell: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      justifyContent: 'center',
    },
    addGlyph: { color: palette.textSecondary, fontSize: 26 },
    sectionLabel: { color: palette.textMuted, fontFamily: font.mono, fontSize: 10, letterSpacing: 0.8, marginTop: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    chipSelected: { backgroundColor: palette.accentDim },
    chipLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 12 },
    chipSelectedLabel: { color: palette.accentHi, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    input: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    directoryHint: { color: palette.textMuted, fontFamily: font.mono, fontSize: 11 },
    footer: {
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 32,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    secondary: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 12,
      paddingHorizontal: 22,
      paddingVertical: 13,
    },
    secondaryLabel: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 15, fontWeight: '600' },
    primary: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderCurve: 'continuous',
      borderRadius: 12,
      flex: 1,
      paddingVertical: 13,
    },
    primaryLabel: { color: '#fff', fontFamily: font.ui, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.4 },
  })
}
