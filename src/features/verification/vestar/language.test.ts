import { beforeEach, describe, expect, it } from 'vitest'
import { resolveVerificationLanguage } from './language'

describe('resolveVerificationLanguage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to English when there is no stored preference', () => {
    expect(resolveVerificationLanguage()).toBe('en')
  })

  it('uses the stored language when present', () => {
    window.localStorage.setItem('vestar_lang', 'ko')

    expect(resolveVerificationLanguage()).toBe('ko')
  })
})
