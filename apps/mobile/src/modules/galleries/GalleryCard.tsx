import { Image } from 'expo-image'
import { SymbolView } from 'expo-symbols'
import { useEffect, useMemo, useState } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTranslation } from '@/i18n'
import type { Palette } from '@/theme/palette'
import { font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { fetchGalleryCovers, getCachedGalleryCovers } from './api'
import { thumbHashHexToBase64 } from './thumbhash'
import type { FeaturedGallery, GalleryCoverPhoto } from './types'

export function GalleryCard({
  gallery,
  onPress,
}: {
  gallery: FeaturedGallery
  onPress: (gallery: FeaturedGallery) => void
}) {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const [covers, setCovers] = useState<GalleryCoverPhoto[] | null>(() => getCachedGalleryCovers(gallery.slug) ?? null)

  useEffect(() => {
    if (covers) {
      return
    }
    let alive = true
    fetchGalleryCovers(gallery)
      .then((result) => {
        if (alive) {
          setCovers(result)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [covers, gallery])

  const [primary, ...secondary] = covers ?? []

  return (
    <Pressable
      accessibilityLabel={t('accessibility.openGallery', { name: gallery.name })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(gallery)}
    >
      <View style={styles.coverRow}>
        <CoverImage photo={primary} style={styles.coverPrimary} styles={styles} />
        <View style={styles.coverColumn}>
          <CoverImage photo={secondary[0]} style={styles.coverSecondary} styles={styles} />
          <CoverImage photo={secondary[1]} style={styles.coverSecondary} styles={styles} />
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.identity}>
          {gallery.author?.avatar ? (
            <Image source={{ uri: gallery.author.avatar }} style={styles.avatar} transition={150} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(gallery.author?.name ?? gallery.name).slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={styles.name}>
              {gallery.name}
            </Text>
            {gallery.description ? (
              <Text numberOfLines={1} style={styles.description}>
                {gallery.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{t('gallery.photos', { count: gallery.photoCount })}</Text>
          {gallery.tags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.tagChip}>
              <Text numberOfLines={1} style={styles.tagText}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  )
}

function CoverImage({
  photo,
  style,
  styles,
}: {
  photo: GalleryCoverPhoto | undefined
  style: StyleProp<ViewStyle>
  styles: ReturnType<typeof createStyles>
}) {
  if (!photo) {
    return <View style={[style, styles.coverEmpty]} />
  }
  const thumbhash = photo.thumbHash ? thumbHashHexToBase64(photo.thumbHash) : null
  return (
    <View style={[style, styles.coverImage]}>
      <Image
        contentFit="cover"
        placeholder={thumbhash ? { thumbhash } : undefined}
        recyclingKey={photo.id}
        source={{ uri: photo.thumbnailUrl }}
        style={StyleSheet.absoluteFill}
        transition={200}
      />
      {photo.isLivePhoto ? (
        <View pointerEvents="none" style={styles.livePhotoBadge}>
          <SymbolView name="livephoto" size={16} tintColor="#fff" weight="medium" />
        </View>
      ) : null}
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    cardPressed: { opacity: 0.85 },
    coverRow: {
      aspectRatio: 16 / 9,
      flexDirection: 'row',
      gap: 2,
    },
    coverPrimary: { flex: 2 },
    coverColumn: { flex: 1, gap: 2 },
    coverSecondary: { flex: 1 },
    coverImage: { overflow: 'hidden' },
    coverEmpty: { backgroundColor: palette.bgElement },
    livePhotoBadge: {
      alignItems: 'center',
      height: 22,
      justifyContent: 'center',
      left: 6,
      position: 'absolute',
      shadowColor: '#000',
      shadowOffset: { height: 1, width: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 2.5,
      top: 6,
      width: 22,
    },
    info: {
      gap: 10,
      padding: 14,
    },
    identity: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    avatar: {
      borderRadius: 18,
      height: 36,
      width: 36,
    },
    avatarFallback: {
      alignItems: 'center',
      backgroundColor: palette.accentDim,
      justifyContent: 'center',
    },
    avatarInitial: {
      color: palette.accent,
      fontFamily: font.ui,
      fontSize: 15,
      fontWeight: '700',
    },
    titleBlock: { flex: 1, gap: 2 },
    name: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    description: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
    },
    metaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    metaText: {
      color: palette.textMuted,
      fontFamily: font.ui,
      fontSize: 12,
      fontWeight: '500',
    },
    tagChip: {
      backgroundColor: palette.bgElement,
      borderRadius: 999,
      maxWidth: 120,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    tagText: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 11,
      fontWeight: '500',
    },
  })
}
