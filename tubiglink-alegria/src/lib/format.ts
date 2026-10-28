const TZ = 'Asia/Manila'

/** Accepts Firestore Timestamps, Dates, epoch millis and ISO strings. */
export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate()
  }
  if (typeof v === 'number' || typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function fmtDateTime(v: unknown): string {
  const d = toDate(v)
  if (!d) return '–'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d)
}

export function fmtDate(v: unknown): string {
  const d = toDate(v)
  if (!d) return '–'
  return new Intl.DateTimeFormat('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

/** "2026-11-03" -> "Tue, Nov 3, 2026" without timezone drift. */
export function fmtIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Today's date in the Philippines as YYYY-MM-DD. */
export function todayIso(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function hoursBetween(a: unknown, b: unknown): number | null {
  const da = toDate(a)
  const db = toDate(b)
  if (!da || !db) return null
  return (db.getTime() - da.getTime()) / 3600000
}

export function fmtHours(h: number | null): string {
  if (h === null || Number.isNaN(h)) return '–'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} days`
}

/** CSV with spreadsheet-formula-injection protection. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown): string => {
    let s = v === null || v === undefined ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n')
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
