import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './utils'

describe('verification utils', () => {
  it('formats onchain timestamps in KST', () => {
    const timestamp = BigInt(Date.parse('2026-04-16T07:34:00.000Z') / 1000)

    expect(formatDate(timestamp, 'en')).toContain('16:34')
    expect(formatDateTime(timestamp, 'en')).toContain('16:34:00')
  })
})
