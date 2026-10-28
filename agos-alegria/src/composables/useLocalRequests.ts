import { ref } from 'vue'

export interface SavedRequest {
  ref: string
  barangayName?: string
  savedAt: number
}

const KEY = 'tl.requests'

function load(): SavedRequest[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as SavedRequest[]) : []
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r?.ref === 'string') : []
  } catch {
    return []
  }
}

const list = ref<SavedRequest[]>(load())

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.value))
  } catch {
    /* storage unavailable: the list simply will not survive a reload */
  }
}

/** Reference numbers kept on this device only. Nothing here is sent to the server. */
export function useLocalRequests() {
  function add(r: { ref: string; barangayName?: string }): void {
    if (list.value.some((x) => x.ref === r.ref)) return
    list.value = [{ ref: r.ref, barangayName: r.barangayName, savedAt: Date.now() }, ...list.value].slice(0, 20)
    persist()
  }
  function remove(refNumber: string): void {
    list.value = list.value.filter((x) => x.ref !== refNumber)
    persist()
  }
  function has(refNumber: string): boolean {
    return list.value.some((x) => x.ref === refNumber)
  }
  return { list, add, remove, has }
}
