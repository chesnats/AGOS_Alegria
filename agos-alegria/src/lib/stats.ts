import { toDate } from './format'

/** Median of a list of numbers, or null when the list is empty. */
export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const k = key(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Whole days since a timestamp (never negative). Null when the date is unknown. */
export function ageDays(from: unknown, now: number = Date.now()): number | null {
  const d = toDate(from)
  if (!d) return null
  return Math.max(0, Math.floor((now - d.getTime()) / 86400000))
}

export function fmtAge(days: number | null): string {
  if (days === null) return '–'
  if (days === 0) return 'today'
  return days === 1 ? '1 day' : `${days} days`
}

/** Blank -> null. Anything else -> Number(text), which may be NaN, so callers must check. */
export function toNumberOrNull(text: string): number | null {
  const s = text.trim()
  return s === '' ? null : Number(s)
}

/** "Santa Filomena" -> "santa-filomena" (used for barangay document ids). */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Start of a Philippine calendar day (UTC+8) as epoch millis. */
export function phDayStart(iso: string): number {
  return new Date(`${iso}T00:00:00+08:00`).getTime()
}

/** End of a Philippine calendar day (UTC+8) as epoch millis. */
export function phDayEnd(iso: string): number {
  return new Date(`${iso}T23:59:59.999+08:00`).getTime()
}
