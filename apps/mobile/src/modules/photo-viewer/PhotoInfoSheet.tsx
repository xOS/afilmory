import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { GalleryPhoto } from '@/modules/galleries/types'
import { usePageRuntime } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long',
  timeStyle: 'short',
})

function formatDate(value: string | null): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

export function PhotoInfoSheet() {
  const { cancel, params: photo } = usePageRuntime<GalleryPhoto>()
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const details = [
    ['Date', formatDate(photo.dateTaken)],
    ['Location', photo.city],
    ['Camera', photo.camera],
    ['Lens', photo.lens],
    ['Dimensions', photo.width > 0 && photo.height > 0 ? `${photo.width} × ${photo.height}` : null],
    ['Rating', photo.rating ? `${photo.rating} / 5` : null],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.heading}>Photo information</Text>
        <View style={styles.headerSide}>
          <Pressable
            accessibilityLabel="Close photo information"
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            onPress={cancel}
          >
            <SymbolView name="xmark" size={15} tintColor={palette.textSecondary} />
          </Pressable>
        </View>
      </View>

      {photo.title ? <Text style={styles.title}>{photo.title}</Text> : null}
      {photo.description ? <Text style={styles.description}>{photo.description}</Text> : null}

      <View style={styles.details}>
        {details.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text selectable style={styles.value}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingHorizontal: 20 },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      height: 52,
      justifyContent: 'space-between',
    },
    headerSide: { alignItems: 'flex-end', width: 40 },
    heading: {
      color: palette.textPrimary,
      flex: 1,
      fontFamily: font.ui,
      fontSize: 17,
      fontWeight: '600',
      textAlign: 'center',
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    title: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    description: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 15,
      lineHeight: 22,
    },
    details: {
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    row: {
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    label: {
      color: palette.textMuted,
      fontFamily: font.ui,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    value: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 15,
      lineHeight: 20,
    },
    pressed: { opacity: 0.55 },
  })
}
