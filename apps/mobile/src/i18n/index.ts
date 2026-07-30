import type { TOptions } from 'i18next'
import i18next from 'i18next'
import { initReactI18next, useTranslation as useReactTranslation } from 'react-i18next'

import appEn from '../../../../locales/app/en.json'
import appJp from '../../../../locales/app/jp.json'
import appKo from '../../../../locales/app/ko.json'
import appZhCn from '../../../../locales/app/zh-CN.json'
import appZhHk from '../../../../locales/app/zh-HK.json'
import appZhTw from '../../../../locales/app/zh-TW.json'
import mobileEn from '../../../../locales/mobile/en.json'
import mobileJp from '../../../../locales/mobile/jp.json'
import mobileKo from '../../../../locales/mobile/ko.json'
import mobileZhCn from '../../../../locales/mobile/zh-CN.json'
import mobileZhHk from '../../../../locales/mobile/zh-HK.json'
import mobileZhTw from '../../../../locales/mobile/zh-TW.json'

export const supportedLanguages = ['en', 'zh-CN', 'zh-HK', 'zh-TW', 'jp', 'ko'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

const resources = {
  'en': { translation: { ...appEn, ...mobileEn } },
  'jp': { translation: { ...appJp, ...mobileJp } },
  'ko': { translation: { ...appKo, ...mobileKo } },
  'zh-CN': { translation: { ...appZhCn, ...mobileZhCn } },
  'zh-HK': { translation: { ...appZhHk, ...mobileZhHk } },
  'zh-TW': { translation: { ...appZhTw, ...mobileZhTw } },
} satisfies Record<SupportedLanguage, { translation: Record<string, string> }>

export function resolveLanguageTag(value: string | null | undefined): SupportedLanguage {
  const language = value?.replaceAll('_', '-').toLowerCase() ?? ''
  if (language.startsWith('zh')) {
    if (language.includes('hk') || language.includes('mo')) {
      return 'zh-HK'
    }
    if (language.includes('tw') || language.includes('hant')) {
      return 'zh-TW'
    }
    return 'zh-CN'
  }
  if (language.startsWith('ja') || language.startsWith('jp')) {
    return 'jp'
  }
  if (language.startsWith('ko')) {
    return 'ko'
  }
  return 'en'
}

function detectDeviceLanguage(): SupportedLanguage {
  return resolveLanguageTag(Intl.DateTimeFormat().resolvedOptions().locale)
}

export const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
  lng: detectDeviceLanguage(),
  react: { useSuspense: false },
  resources,
  returnNull: false,
  supportedLngs: [...supportedLanguages],
})

export function getIntlLocale(language = i18n.resolvedLanguage ?? i18n.language): string {
  switch (resolveLanguageTag(language)) {
    case 'jp': {
      return 'ja-JP'
    }
    case 'ko': {
      return 'ko-KR'
    }
    case 'zh-CN': {
      return 'zh-CN'
    }
    case 'zh-HK': {
      return 'zh-HK'
    }
    case 'zh-TW': {
      return 'zh-TW'
    }
    default: {
      return 'en'
    }
  }
}

export function translate(key: string, options?: TOptions): string {
  return i18n.t(key, options) as string
}

export const useTranslation = useReactTranslation
