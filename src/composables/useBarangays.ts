import { computed, shallowRef } from 'vue'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'
import type { Barangay } from '@/types'

const all = shallowRef<Barangay[]>([])
const loading = shallowRef(true)
let started = false

/** Shared, live list of barangays. One listener for the whole app. */
export function useBarangays() {
  if (!started) {
    started = true
    onSnapshot(
      collection(db, 'barangays'),
      (snap) => {
        all.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Barangay).sort((a, b) => a.name.localeCompare(b.name))
        loading.value = false
      },
      () => {
        loading.value = false
      }
    )
  }
  const active = computed(() => all.value.filter((b) => b.active !== false))
  const nameOf = (id: string | null | undefined): string => (id ? all.value.find((b) => b.id === id)?.name ?? id : '–')
  return { all, active, nameOf, loading }
}
