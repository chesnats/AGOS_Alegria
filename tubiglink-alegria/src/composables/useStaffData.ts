import { collection, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useLive } from '@/composables/useLive'
import type { StaffProfile, Ts, WaterRequest } from '@/types'

/** A document in the users collection. The document id is the Firebase Auth uid. */
export type StaffRow = Omit<StaffProfile, 'uid'> & { id: string; updatedAt?: Ts }

/**
 * Requests the signed-in staff member may see, newest first.
 * Coordinators are scoped to their barangay in the query itself, which is what the
 * Firestore rules require; municipal staff see everything.
 */
export function useScopedRequests(max = 500) {
  const { profile, scopeBarangayId } = useAuth()
  return useLive<WaterRequest>(() => {
    const p = profile.value
    if (!p || !p.active || p.role === 'provider') return null
    const base = collection(db, 'waterRequests')
    if (p.role === 'barangay_coordinator') {
      const scope = scopeBarangayId.value
      return scope ? query(base, where('barangayId', '==', scope), orderBy('createdAt', 'desc'), limit(max)) : null
    }
    return query(base, orderBy('createdAt', 'desc'), limit(max))
  })
}

/** Staff accounts. Only municipal administrators may list them (the rules enforce this). */
export function useStaffList() {
  const { isMuni } = useAuth()
  return useLive<StaffRow>(() => (isMuni.value ? query(collection(db, 'users'), orderBy('displayName')) : null))
}

/** Resolve a user id to a display name for history and audit screens. */
export function useStaffNames() {
  const { profile } = useAuth()
  const { items } = useStaffList()
  function nameFor(uid: string | null | undefined): string {
    if (!uid) return 'Unknown'
    if (uid === 'resident') return 'Resident'
    if (uid === profile.value?.uid) return `${profile.value.displayName} (you)`
    return items.value.find((u) => u.id === uid)?.displayName ?? 'Staff member'
  }
  return { nameFor }
}
