import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { thumbHashHexToBase64 } from '@/modules/galleries/thumbhash'
import type { GalleryCoverPhoto } from '@/modules/galleries/types'
import type { Palette } from '@/theme/palette'
import { radius } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const COLUMNS = 3
const GAP = 6
const CYCLE_DURATIONS_MS = [80_000, 100_000, 90_000]
const MAX_ITEMS_PER_COLUMN = 60

interface ShowcaseItem {
  key: string
  photo: GalleryCoverPhoto
  height: number
}

interface ShowcaseColumnData {
  contentHeight: number
  items: ShowcaseItem[]
  width: number
}

export function ShowcaseMasonry({
  height,
  photos,
  width,
}: {
  height: number
  photos: GalleryCoverPhoto[]
  width: number
}) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const reducedMotion = useReducedMotion()

  const columns = useMemo(() => buildColumns(photos, width, height), [height, photos, width])

  if (!columns) {
    return <LinearGradient colors={[palette.bgSurface, palette.bgCanvas]} style={styles.fill} />
  }

  return (
    <View pointerEvents="none" style={styles.row}>
      {columns.map((column, index) => (
        <ShowcaseColumn
          key={column.items[0].key}
          animate={!reducedMotion}
          column={column}
          durationMs={CYCLE_DURATIONS_MS[index % CYCLE_DURATIONS_MS.length]}
          styles={styles}
        />
      ))}
    </View>
  )
}

function buildColumns(photos: GalleryCoverPhoto[], width: number, height: number): ShowcaseColumnData[] | null {
  if (photos.length === 0 || width <= 0 || height <= 0) {
    return null
  }
  const columnWidth = (width - GAP * (COLUMNS - 1)) / COLUMNS
  const assigned: GalleryCoverPhoto[][] = []
  for (let index = 0; index < COLUMNS; index++) {
    assigned.push([])
  }
  for (const [index, photo] of photos.entries()) {
    assigned[index % COLUMNS].push(photo)
  }

  const columns: ShowcaseColumnData[] = []
  for (const columnPhotos of assigned) {
    if (columnPhotos.length === 0) {
      continue
    }
    const items: ShowcaseItem[] = []
    let contentHeight = 0
    let repeat = 0
    while (contentHeight < height * 2 && items.length < MAX_ITEMS_PER_COLUMN) {
      for (const photo of columnPhotos) {
        const ratio = photo.aspectRatio > 0 ? photo.aspectRatio : 1
        const itemHeight = columnWidth / ratio
        items.push({ key: `${photo.id}:${repeat}`, photo, height: itemHeight })
        contentHeight += itemHeight + GAP
      }
      repeat++
    }
    columns.push({ contentHeight, items, width: columnWidth })
  }
  return columns
}

function ShowcaseColumn({
  animate,
  column,
  durationMs,
  styles,
}: {
  animate: boolean
  column: ShowcaseColumnData
  durationMs: number
  styles: ReturnType<typeof createStyles>
}) {
  const translateY = useSharedValue(0)

  useEffect(() => {
    translateY.value = 0
    if (!animate || column.contentHeight <= 0) {
      return
    }
    translateY.value = withRepeat(
      withTiming(-column.contentHeight, { duration: durationMs, easing: Easing.linear }),
      -1,
    )
    return () => {
      cancelAnimation(translateY)
    }
  }, [animate, column.contentHeight, durationMs, translateY])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <View style={{ width: column.width }}>
      <Animated.View style={animatedStyle}>
        {column.items.map(item => (
          <ShowcaseTile key={item.key} item={item} styles={styles} />
        ))}
        {animate
          ? column.items.map(item => <ShowcaseTile key={`${item.key}:dup`} item={item} styles={styles} />)
          : null}
      </Animated.View>
    </View>
  )
}

function ShowcaseTile({ item, styles }: { item: ShowcaseItem, styles: ReturnType<typeof createStyles> }) {
  const thumbhash = item.photo.thumbHash ? thumbHashHexToBase64(item.photo.thumbHash) : null
  return (
    <Image
      contentFit="cover"
      placeholder={thumbhash ? { thumbhash } : undefined}
      source={{ uri: item.photo.thumbnailUrl }}
      style={[styles.tile, { height: item.height }]}
      transition={200}
    />
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1 },
    row: {
      flex: 1,
      flexDirection: 'row',
      gap: GAP,
      overflow: 'hidden',
    },
    tile: {
      backgroundColor: palette.bgSurface,
      borderCurve: 'continuous',
      borderRadius: radius,
      marginBottom: GAP,
      width: '100%',
    },
  })
}
