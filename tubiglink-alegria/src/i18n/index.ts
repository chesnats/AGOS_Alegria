import { ref } from 'vue'
import en from './en'
import ceb from './ceb'
import fil from './fil'

export type Locale = 'en' | 'ceb' | 'fil'
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ceb', label: 'Cebuano' },
  { code: 'fil', label: 'Filipino' }
]
const dicts: Record<Locale, Record<string, string>> = { en, ceb, fil }
const STORE = 'tubiglink-lang'

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORE)
    if (saved === 'en' || saved === 'ceb' || saved === 'fil') return saved
  } catch {
    /* storage can be blocked: fall back to the browser language */
  }
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase()
  if (n.startsWith('ceb')) return 'ceb'
  if (n.startsWith('fil') || n.startsWith('tl')) return 'fil'
  return 'en'
}

export const locale = ref<Locale>(detect())

export function setLocale(l: Locale): void {
  locale.value = l
  try {
    localStorage.setItem(STORE, l)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l
}
if (typeof document !== 'undefined') document.documentElement.lang = locale.value

/** Translate a key; falls back to English, then to the key itself. {name} placeholders are filled from params. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[locale.value][key] ?? en[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}
