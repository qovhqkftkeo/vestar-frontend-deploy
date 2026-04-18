import { beforeEach, describe, expect, it } from 'vitest'
import { LANGUAGE_STORAGE_KEY, resolveStoredLanguage } from './language'

describe('resolveStoredLanguage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to English when there is no stored preference', () => {
    expect(resolveStoredLanguage()).toBe('en')
  })

  it('returns the stored Korean preference when present', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ko')

    expect(resolveStoredLanguage()).toBe('ko')
  })

  it('returns the stored English preference when present', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')

    expect(resolveStoredLanguage()).toBe('en')
  })
})
