import { photoLoader } from '@afilmory/data'
import siteConfig from '@config'
import { useAtomValue, useSetAtom } from 'jotai'
// import { AnimatePresence } from 'motion/react'
import { useEffect, useRef } from 'react'
import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { ScrollElementContext } from '~/components/ui/scroll-areas/ctx'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { useMobile } from '~/hooks/useMobile'
import {
  getFilteredPhotos,
  usePhotos,
  usePhotoViewer,
} from '~/hooks/usePhotoViewer'
import { MasonryRoot } from '~/modules/gallery/MasonryRoot'
import { PhotosProvider } from '~/providers/photos-provider'

export const Component = () => {
  useStateRestoreFromUrl()
  useSyncStateToUrl()

  // const location = useLocation()
  const isMobile = useMobile()

  const photos = usePhotos()
  return (
    <>
      <PhotosProvider photos={photos}>
        {siteConfig.accentColor && (
          <style
            dangerouslySetInnerHTML={{
              __html: `
          :root:has(input.theme-controller[value=dark]:checked), [data-theme="dark"] {
            --color-primary: ${siteConfig.accentColor};
            --color-accent: ${siteConfig.accentColor};
            --color-secondary: ${siteConfig.accentColor};
          }
          `,
            }}
          />
        )}
        {isMobile ? (
          <ScrollElementContext value={document.body}>
            <MasonryRoot />
          </ScrollElementContext>
        ) : (
          <ScrollArea
            rootClassName={'h-svh w-full'}
            viewportClassName="size-full"
          >
            <MasonryRoot />
          </ScrollArea>
        )}

        <Outlet />
      </PhotosProvider>
    </>
  )
}

let isRestored = false
const useStateRestoreFromUrl = () => {
  const triggerOnceRef = useRef(false)

  const { openViewer } = usePhotoViewer()
  const { photoId } = useParams()
  const setGallerySetting = useSetAtom(gallerySettingAtom)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (triggerOnceRef.current) return
    triggerOnceRef.current = true
    isRestored = true

    if (photoId) {
      const photo = photoLoader
        .getPhotos()
        .find((photo) => photo.id === photoId)
      if (photo) {
        openViewer(photoLoader.getPhotos().indexOf(photo))
      }
    }

    const tagsFromSearchParams = searchParams.get('tags')?.split(',')
    const camerasFromSearchParams = searchParams.get('cameras')?.split(',')
    const lensesFromSearchParams = searchParams.get('lenses')?.split(',')

    if (
      tagsFromSearchParams ||
      camerasFromSearchParams ||
      lensesFromSearchParams
    ) {
      setGallerySetting((prev) => ({
        ...prev,
        selectedTags: tagsFromSearchParams || prev.selectedTags,
        selectedCameras: camerasFromSearchParams || prev.selectedCameras,
        selectedLenses: lensesFromSearchParams || prev.selectedLenses,
      }))
    }
  }, [openViewer, photoId, searchParams, setGallerySetting])
}

const useSyncStateToUrl = () => {
  const { selectedTags, selectedCameras, selectedLenses } =
    useAtomValue(gallerySettingAtom)
  const [_, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const location = useLocation()
  const { isOpen, currentIndex } = usePhotoViewer()

  useEffect(() => {
    if (!isRestored) return

    if (!isOpen) {
      const isExploryPath = location.pathname === '/explory'
      if (!isExploryPath) {
        const timer = setTimeout(() => {
          navigate('/')
        }, 500)
        return () => clearTimeout(timer)
      }
    } else {
      const photos = getFilteredPhotos()
      const targetPathname = `/${photos[currentIndex].id}`
      if (location.pathname !== targetPathname) {
        navigate(targetPathname)
      }
    }
  }, [currentIndex, isOpen, location.pathname, navigate])

  useEffect(() => {
    if (!isRestored) return

    const tags = selectedTags.join(',')
    const cameras = selectedCameras.join(',')
    const lenses = selectedLenses.join(',')

    setSearchParams((search) => {
      const currentTags = search.get('tags')
      const currentCameras = search.get('cameras')
      const currentLenses = search.get('lenses')

      // Check if anything has changed
      if (
        currentTags === tags &&
        currentCameras === cameras &&
        currentLenses === lenses
      ) {
        return search
      }

      const newer = new URLSearchParams(search)

      // Update tags
      if (tags) {
        newer.set('tags', tags)
      } else {
        newer.delete('tags')
      }

      // Update cameras
      if (cameras) {
        newer.set('cameras', cameras)
      } else {
        newer.delete('cameras')
      }

      // Update lenses
      if (lenses) {
        newer.set('lenses', lenses)
      } else {
        newer.delete('lenses')
      }

      return newer
    })
  }, [selectedTags, selectedCameras, selectedLenses, setSearchParams])
}
