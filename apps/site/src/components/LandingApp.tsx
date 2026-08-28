import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Locale } from '../i18n'
import { otherLocale, resolveLocale, t as translate } from '../i18n'
import { CreateSpaceModal } from './CreateSpaceModal'
import { Discover } from './Discover'
import { LiveDemo } from './LiveDemo'
import { LoginSpaceModal } from './LoginSpaceModal'

const DOCS_URL = (import.meta.env.PUBLIC_DOCS_URL as string | undefined) ?? 'https://docs.afilmory.art'
const GITHUB_URL = (import.meta.env.PUBLIC_GITHUB_URL as string | undefined) ?? 'https://github.com/Afilmory/Afilmory'
const SELF_HOST_URL = `${GITHUB_URL}#option-2-self-hosting`
const APP_STORE_URL = 'https://apps.apple.com/app/id6796660831'

function IconApple({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
    </svg>
  )
}

export interface LandingAppProps {
  initialLocale?: string
}

export function LandingApp({ initialLocale }: LandingAppProps) {
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(initialLocale))
  const [createOpen, setCreateOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const copy = useMemo(() => translate(locale), [locale])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
    document.title = copy.meta.title
  }, [locale, copy.meta.title])

  const openCreate = useCallback(() => setCreateOpen(true), [])
  const closeCreate = useCallback(() => setCreateOpen(false), [])
  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  const switchLocale = () => {
    const next = otherLocale(locale)
    setLocale(next)
    try {
      localStorage.setItem('afilmory-site-locale', next)
    }
    catch {
      /* ignore */
    }
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState({}, '', url)
  }

  return (
    <>
      <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-line bg-page-80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" width={28} height={28} className="site-logo" />
            <span className="font-serif text-lg tracking-wide">Afilmory</span>
          </a>
          <nav className="flex items-center gap-4 text-xs tracking-wide text-muted md:gap-6">
            <a href="#demo" className="nav-link-desktop hover:text-fg">
              {copy.nav.demo}
            </a>
            <a href="#discover" className="nav-link-desktop hover:text-fg">
              {copy.nav.discover}
            </a>
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className="nav-link-wide hover:text-fg">
              {copy.nav.docs}
            </a>
            <button
              type="button"
              onClick={switchLocale}
              className="font-mono text-xs tracking-wider text-dim hover:text-fg"
            >
              {copy.nav.lang}
            </button>
            <button type="button" className="hover:text-fg" onClick={openLogin}>
              {copy.nav.login}
            </button>
            <button type="button" className="btn btn-compact" onClick={openCreate}>
              {copy.nav.create}
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-section relative flex flex-col justify-center px-5 pb-24 pt-28 md:px-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="hero-glow-a absolute rounded-full" />
            <div className="hero-glow-b absolute" />
          </div>
          <div className="relative mx-auto w-full max-w-6xl">
            <p className="font-mono text-xs tracking-widest uppercase text-accent">{copy.hero.eyebrow}</p>
            <h1 className="hero-title mt-6 max-w-4xl font-serif tracking-tight">{copy.hero.title}</h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted md:text-lg">{copy.hero.subtitle}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button type="button" className="btn" onClick={openCreate}>
                {copy.hero.cta}
              </button>
              <button type="button" className="btn btn-ghost" onClick={openLogin}>
                {copy.hero.login}
              </button>
              <a href="#demo" className="text-sm tracking-wide text-muted hover:text-fg">
                {copy.hero.secondary}
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="app-store-badge">
                <IconApple className="app-store-badge-icon" />
                <span className="app-store-badge-copy">
                  <span className="app-store-badge-eyebrow">{copy.hero.appStoreEyebrow}</span>
                  <span className="app-store-badge-title">{copy.hero.appStore}</span>
                </span>
              </a>
              <p className="font-mono text-xs tracking-wide text-dim">{copy.hero.note}</p>
            </div>
          </div>
        </section>

        <LiveDemo locale={locale} onCreate={openCreate} />
        <Discover locale={locale} />
      </main>

      <footer className="border-t border-line px-5 py-12 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-serif text-xl">{copy.footer.copy}</p>
            <p className="mt-2 text-xs text-dim">afilmory.art</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs tracking-wide text-muted">
            <a href="/terms" className="hover:text-fg">
              {copy.footer.terms}
            </a>
            <a href="/privacy" className="hover:text-fg">
              {copy.footer.privacy}
            </a>
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className="hover:text-fg">
              {copy.footer.docs}
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-fg">
              {copy.footer.github}
            </a>
            <a href={SELF_HOST_URL} target="_blank" rel="noreferrer" className="hover:text-fg">
              {copy.footer.selfHost}
            </a>
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="hover:text-fg">
              {copy.footer.appStore}
            </a>
          </div>
        </div>
      </footer>

      <CreateSpaceModal open={createOpen} onClose={closeCreate} locale={locale} />
      <LoginSpaceModal open={loginOpen} onClose={closeLogin} locale={locale} />
    </>
  )
}
