const SQL_DATE_TIME_RE =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)([zZ]|[+-]\d{2}:?\d{2})?$/
const ISO_DATE_TIME_WITHOUT_ZONE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/

export const KST_TIME_ZONE = 'Asia/Seoul'

export type DateTimeInput = string | number | Date

function normalizeDateTimeInput(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const sqlMatch = trimmed.match(SQL_DATE_TIME_RE)
  if (sqlMatch) {
    const [, date, time, timezone] = sqlMatch
    return `${date}T${time}${timezone ?? 'Z'}`
  }

  if (ISO_DATE_TIME_WITHOUT_ZONE_RE.test(trimmed)) {
    return `${trimmed}Z`
  }

  return trimmed
}

export function parseUtcDateTime(value: DateTimeInput | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = normalizeDateTimeInput(value)
  if (!normalized) {
    return null
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getUtcDateTimeMs(value: DateTimeInput | null | undefined) {
  return parseUtcDateTime(value)?.getTime() ?? Number.NaN
}

export function formatDateTimeInKst(
  value: DateTimeInput | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  const date = parseUtcDateTime(value)
  if (!date) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: KST_TIME_ZONE,
  }).format(date)
}

export function formatDateTimePartsInKst(
  value: DateTimeInput | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  const date = parseUtcDateTime(value)
  if (!date) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: KST_TIME_ZONE,
  }).formatToParts(date)
}

export function formatCompactKstDateTime(value: DateTimeInput | null | undefined) {
  const parts = formatDateTimePartsInKst(value, 'ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (!parts) {
    return null
  }

  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${valueByType.year}.${valueByType.month}.${valueByType.day} ${valueByType.hour}:${valueByType.minute}`
}
