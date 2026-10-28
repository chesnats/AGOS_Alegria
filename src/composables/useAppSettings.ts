import { shallowRef } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'
import type { AppSettings } from '@/types'

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'AGOS Alegria',
  officialContacts: [],
  maintenanceMode: false,
  maintenanceMessage: '',
  privacyContact: ''
}

const settings = shallowRef<AppSettings>(DEFAULT_SETTINGS)
const loaded = shallowRef(false)
let started = false

/** Public operational settings (contacts, maintenance banner). One shared listener. */
export function useAppSettings() {
  if (!started) {
    started = true
    onSnapshot(
      doc(db, 'appSettings', 'public'),
      (snap) => {
        settings.value = snap.exists() ? { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) } : DEFAULT_SETTINGS
        loaded.value = true
      },
      () => {
        loaded.value = true
      }
    )
  }
  return { settings, loaded }
}
