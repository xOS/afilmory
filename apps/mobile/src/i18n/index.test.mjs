import assert from 'node:assert/strict'
// The mobile workspace has no Vitest runtime; use Node's behavioral test runner through tsx.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { i18n, resolveLanguageTag } from './index'

test('resolveLanguageTag maps device locale variants to supported mobile catalogs', () => {
  assert.equal(resolveLanguageTag('zh-Hans-SG'), 'zh-CN')
  assert.equal(resolveLanguageTag('zh-Hant-HK'), 'zh-HK')
  assert.equal(resolveLanguageTag('zh-Hant-TW'), 'zh-TW')
  assert.equal(resolveLanguageTag('ja-JP'), 'jp')
  assert.equal(resolveLanguageTag('ko-KR'), 'ko')
  assert.equal(resolveLanguageTag('fr-FR'), 'en')
})

test('mobile catalogs translate navigation, interpolation, and pluralized photo counts', () => {
  const chinese = i18n.getFixedT('zh-CN')
  const japanese = i18n.getFixedT('jp')

  assert.equal(chinese('tabs.studio'), 'Studio')
  assert.equal(chinese('accessibility.openGallery', { name: '夏日' }), '打开夏日')
  assert.equal(chinese('gallery.photos', { count: 2 }), '2 张照片')
  assert.equal(japanese('tabs.photos'), '写真')
})

test('Studio navigation and primary actions are available in every mobile catalog', () => {
  for (const language of ['en', 'zh-CN', 'zh-HK', 'zh-TW', 'jp', 'ko']) {
    const translate = i18n.getFixedT(language)
    assert.notEqual(translate('tabs.studio'), 'tabs.studio')
    assert.notEqual(translate('studio.library.title'), 'studio.library.title')
    assert.notEqual(translate('studio.operations.run.action'), 'studio.operations.run.action')
  }
})

test('photo comment actions are localized without Web-only markup', () => {
  for (const language of ['en', 'zh-CN', 'zh-HK', 'zh-TW', 'jp', 'ko']) {
    const translate = i18n.getFixedT(language)
    assert.notEqual(translate('photo.comments'), 'photo.comments')
    assert.notEqual(translate('comments.like'), 'comments.like')
    assert.ok(translate('comments.replyingToPlain', { user: 'Ada' }).includes('Ada'))
    assert.doesNotMatch(translate('comments.replyingToPlain', { user: 'Ada' }), /<[^>]+>/)
  }
})
