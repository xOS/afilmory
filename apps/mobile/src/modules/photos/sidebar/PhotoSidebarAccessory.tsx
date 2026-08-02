import { useRouter, useSegments } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import { Platform } from 'react-native'

import { useTranslation } from '@/i18n'
import type { GalleryPhoto } from '@/modules/galleries/types'
import { presentNativePhotoFilters } from '@/native/photoSheets'
import { nativePhotoSidebar } from '@/native/photoSidebar'

import type { FilterOptions } from '../filters/aggregates'
import { clearFilters, replaceFilters, toggleDatePreset, toggleMinRating, toggleTag } from '../filters/filterStore'
import type { PhotoFilters } from '../filters/filterTypes'
import { countActiveDimensions } from '../filters/filterTypes'
import { buildPhotoSidebarQuickFilters, buildPhotoSidebarTags } from './sidebarModel'

let nextOwnerID = 0

interface PhotoSidebarAccessoryProps {
  filterOptions: FilterOptions
  filters: PhotoFilters
  photos: GalleryPhoto[]
}

export function PhotoSidebarAccessory({ filterOptions, filters, photos }: PhotoSidebarAccessoryProps) {
  const supportsSidebar = Platform.OS === 'ios' && Platform.isPad
  const { t } = useTranslation()
  const router = useRouter()
  const segments = useSegments() as string[]
  const ownerIDRef = useRef<string | null>(null)
  ownerIDRef.current ??= `photo-sidebar-${++nextOwnerID}`
  const ownerID = ownerIDRef.current
  const quickFilters = useMemo(
    () =>
      buildPhotoSidebarQuickFilters(photos, filters, {
        rating4: t('filter.ratingOrBetter', { count: 4 }),
        thisMonth: t('action.date.preset.thisMonth'),
        thisYear: t('action.date.preset.thisYear'),
      }),
    [filters, photos, t],
  )
  const tags = useMemo(
    () => buildPhotoSidebarTags(filterOptions.tags, filters.tags),
    [filterOptions.tags, filters.tags],
  )
  const latestRef = useRef({ activeSurface: 'other', filterOptions, filters })
  latestRef.current = {
    activeSurface: segments.includes('photos') ? 'photos' : segments.includes('map') ? 'map' : 'other',
    filterOptions,
    filters,
  }

  const request = useMemo(
    () => ({
      activeFilterCount: countActiveDimensions(filters),
      localization: {
        clearFilters: t('common.clearFilters'),
        filters: t('action.filter.title'),
        moreTags: t('sidebar.moreTags'),
        notSelected: t('filter.notSelected'),
        quickFilters: t('sidebar.quickFilters'),
        selected: t('filter.selected'),
        tags: t('exif.tags'),
      },
      ownerID,
      quickFilters,
      showsMoreTags: tags.hasMore,
      tags: tags.items,
    }),
    [filters, ownerID, quickFilters, t, tags.hasMore, tags.items],
  )

  useEffect(() => {
    if (!supportsSidebar) {
      return
    }
    void nativePhotoSidebar.configure(request)
  }, [request, supportsSidebar])

  useEffect(() => {
    if (!supportsSidebar) {
      return
    }

    const isCurrentOwner = (event: { ownerID: string }) => event.ownerID === ownerID
    const revealFilteredGallery = () => {
      if (latestRef.current.activeSurface === 'other') {
        router.navigate('/photos')
      }
    }
    const subscriptions = [
      nativePhotoSidebar.addListener('onQuickFilterPress', (event) => {
        if (!isCurrentOwner(event)) {
          return
        }
        if (event.id === 'thisMonth' || event.id === 'thisYear') {
          toggleDatePreset(event.id)
        }
        else if (event.id === 'rating4') {
          toggleMinRating(4)
        }
        revealFilteredGallery()
      }),
      nativePhotoSidebar.addListener('onTagPress', (event) => {
        if (!isCurrentOwner(event)) {
          return
        }
        toggleTag(event.id)
        revealFilteredGallery()
      }),
      nativePhotoSidebar.addListener('onClearFilters', (event) => {
        if (isCurrentOwner(event)) {
          clearFilters()
        }
      }),
      nativePhotoSidebar.addListener('onFiltersPress', (event) => {
        if (!isCurrentOwner(event)) {
          return
        }
        const current = latestRef.current
        void presentNativePhotoFilters(current.filters, current.filterOptions, event.frame).then((next) => {
          if (!next) {
            return
          }
          replaceFilters(next)
          revealFilteredGallery()
        })
      }),
    ]

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove()
      }
    }
  }, [ownerID, router, supportsSidebar])

  useEffect(
    () => () => {
      if (supportsSidebar) {
        void nativePhotoSidebar.clear(ownerID)
      }
    },
    [ownerID, supportsSidebar],
  )

  return null
}
