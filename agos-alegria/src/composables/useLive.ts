import { getCurrentScope, onScopeDispose, ref, shallowRef, watchEffect } from 'vue'
import { onSnapshot, type DocumentData, type DocumentReference, type Query } from 'firebase/firestore'

/**
 * Live query. `build` may read reactive state (for example the signed-in profile);
 * the listener is re-created whenever that state changes. Return null to pause.
 */
export function useLive<T>(build: () => Query<DocumentData> | null) {
  const items = shallowRef<T[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  let unsub: (() => void) | null = null

  const stop = watchEffect(() => {
    if (unsub) unsub()
    unsub = null
    const q = build()
    if (!q) {
      items.value = []
      loading.value = false
      return
    }
    loading.value = true
    unsub = onSnapshot(
      q,
      (snap) => {
        items.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
        loading.value = false
        error.value = null
      },
      (err) => {
        error.value = err.message
        loading.value = false
      }
    )
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      if (unsub) unsub()
    })
  }
  return { items, loading, error }
}

/** Live single document. */
export function useLiveDoc<T>(build: () => DocumentReference<DocumentData> | null) {
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let unsub: (() => void) | null = null

  const stop = watchEffect(() => {
    if (unsub) unsub()
    unsub = null
    const r = build()
    if (!r) {
      data.value = null
      loading.value = false
      return
    }
    loading.value = true
    unsub = onSnapshot(
      r,
      (snap) => {
        data.value = snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null
        loading.value = false
        error.value = null
      },
      (err) => {
        error.value = err.message
        loading.value = false
      }
    )
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      if (unsub) unsub()
    })
  }
  return { data, loading, error }
}
