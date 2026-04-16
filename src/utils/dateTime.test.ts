import { describe, expect, it } from 'vitest'
import { formatCompactKstDateTime, getUtcDateTimeMs, parseUtcDateTime } from './dateTime'

describe('dateTime', () => {
  it('treats timezone-less database timestamps as UTC', () => {
    expect(getUtcDateTimeMs('2026-04-16 07:34:00.000')).toBe(
      Date.parse('2026-04-16T07:34:00.000Z'),
    )
  })

  it('keeps timezone-aware timestamps intact', () => {
    expect(getUtcDateTimeMs('2026-04-16T16:34:00.000+09:00')).toBe(
      Date.parse('2026-04-16T07:34:00.000Z'),
    )
  })

  it('formats UTC-like timestamps in KST', () => {
    expect(formatCompactKstDateTime('2026-04-16 07:34:00.000')).toBe('2026.04.16 16:34')
  })

  it('returns null for invalid timestamps', () => {
    expect(parseUtcDateTime('not-a-date')).toBeNull()
  })
})
