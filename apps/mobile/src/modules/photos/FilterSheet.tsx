import DateTimePicker from '@react-native-community/datetimepicker'
import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { usePageRuntime } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { buildFilterOptions } from './filters/aggregates'
import { applyFilters } from './filters/applyFilters'
import { FilterChip, FilterOptionRow, FilterSection, SegmentedControl } from './filters/filterControls'
import {
  clearFilters,
  setCustomRange,
  setDatePreset,
  setMinRating,
  setTagMode,
  toggleCamera,
  toggleLens,
  toggleTag,
  useFilters,
} from './filters/filterStore'
import type { DatePreset, TagMode } from './filters/filterTypes'
import { DATE_PRESET_LABELS, hasActiveFilters, parseDateString, toDateString } from './filters/filterTypes'
import { useHomeFeed } from './homeFeedStore'

const DATE_PRESETS: DatePreset[] = ['last7', 'last30', 'last90', 'thisMonth', 'thisYear', 'lastYear']
const TAG_MODES: { label: string, value: TagMode }[] = [
  { label: 'Any', value: 'any' },
  { label: 'All', value: 'all' },
]
const RATINGS = [1, 2, 3, 4, 5]

export function FilterSheet() {
  const { palette } = useTheme()
  const styles = useSheetStyles()
  const { cancel } = usePageRuntime()
  const { photos } = useHomeFeed()
  const filters = useFilters()
  const options = useMemo(() => buildFilterOptions(photos), [photos])
  const matchCount = useMemo(() => applyFilters(photos, filters).length, [filters, photos])

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerSides}>
          {hasActiveFilters(filters) ? (
            <Pressable
              accessibilityLabel="Clear all filters"
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
              onPress={clearFilters}
            >
              <Text style={styles.clearAll}>Clear All</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            accessibilityLabel="Close filters"
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
            onPress={cancel}
          >
            <SymbolView name="xmark" size={13} tintColor={palette.textSecondary} weight="semibold" />
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.headerCenter}>
          <Text style={styles.title}>Filters</Text>
          <Text style={styles.subtitle}>{`${matchCount} of ${photos.length}`}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
        <FilterSection title="Date">
          <View style={styles.chipWrap}>
            {DATE_PRESETS.map(preset => (
              <FilterChip
                key={preset}
                label={DATE_PRESET_LABELS[preset]}
                selected={filters.datePreset === preset}
                onPress={() => setDatePreset(filters.datePreset === preset ? null : preset)}
              />
            ))}
          </View>
          <DateBoundRow
            label="From"
            value={filters.dateFrom}
            onChange={next => setCustomRange(next, filters.dateTo)}
          />
          <DateBoundRow label="To" value={filters.dateTo} onChange={next => setCustomRange(filters.dateFrom, next)} />
        </FilterSection>

        {options.tags.length > 0 ? (
          <FilterSection title="Tags">
            <View style={styles.chipWrap}>
              {options.tags.map(option => (
                <FilterChip
                  count={option.count}
                  key={option.value}
                  label={option.value}
                  selected={filters.tags.includes(option.value)}
                  onPress={() => toggleTag(option.value)}
                />
              ))}
            </View>
            <SegmentedControl
              disabled={filters.tags.length < 2}
              options={TAG_MODES}
              value={filters.tagMode}
              onChange={setTagMode}
            />
          </FilterSection>
        ) : null}

        {options.cameras.length > 0 ? (
          <FilterSection title="Camera">
            {options.cameras.map(option => (
              <FilterOptionRow
                count={option.count}
                key={option.value}
                label={option.value}
                selected={filters.cameras.includes(option.value)}
                onPress={() => toggleCamera(option.value)}
              />
            ))}
          </FilterSection>
        ) : null}

        {options.lenses.length > 0 ? (
          <FilterSection title="Lens">
            {options.lenses.map(option => (
              <FilterOptionRow
                count={option.count}
                key={option.value}
                label={option.value}
                selected={filters.lenses.includes(option.value)}
                onPress={() => toggleLens(option.value)}
              />
            ))}
          </FilterSection>
        ) : null}

        {options.ratedCount > 0 ? (
          <FilterSection title="Rating">
            <View style={styles.starRow}>
              {RATINGS.map((rating) => {
                const filled = filters.minRating !== null && rating <= filters.minRating
                return (
                  <Pressable
                    accessibilityLabel={`At least ${rating} stars`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filled }}
                    key={rating}
                    style={({ pressed }) => [styles.star, pressed && styles.pressed]}
                    onPress={() => setMinRating(filters.minRating === rating ? null : rating)}
                  >
                    <SymbolView
                      name={filled ? 'star.fill' : 'star'}
                      size={22}
                      tintColor={filled ? palette.accent : palette.textMuted}
                    />
                  </Pressable>
                )
              })}
            </View>
          </FilterSection>
        ) : null}
      </ScrollView>
    </View>
  )
}

function DateBoundRow({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string | null
}) {
  const { palette } = useTheme()
  const styles = useSheetStyles()

  return (
    <View style={styles.dateRow}>
      <Text style={styles.dateLabel}>{label}</Text>
      <DateTimePicker
        accentColor={palette.accent}
        display="compact"
        mode="date"
        themeVariant="dark"
        value={value === null ? new Date() : parseDateString(value)}
        onValueChange={(_event, date) => onChange(toDateString(date))}
      />
    </View>
  )
}

function useSheetStyles() {
  const { palette } = useTheme()
  return useMemo(() => createStyles(palette), [palette])
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: {
      gap: 24,
      paddingBottom: 48,
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    header: {
      height: 60,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    headerSides: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerCenter: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    title: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 17,
      fontWeight: '600',
    },
    subtitle: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
    },
    dismiss: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    clearAll: {
      color: palette.danger,
      fontFamily: font.ui,
      fontSize: 17,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    dateRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 40,
    },
    dateLabel: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 15,
    },
    starRow: {
      flexDirection: 'row',
      gap: 6,
    },
    star: {
      alignItems: 'center',
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    pressed: { opacity: 0.6 },
  })
}
