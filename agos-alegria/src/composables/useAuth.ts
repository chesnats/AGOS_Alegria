import { computed, shallowRef, ref, watch } from 'vue'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { StaffProfile } from '@/types'

// Module-level singleton: one auth listener for the whole app.
const user = shallowRef<User | null>(null)
const profile = shallowRef<StaffProfile | null>(null)
const ready = ref(false)

async function loadProfile(u: User | null): Promise<void> {
  if (!u) {
    profile.value = null
    return
  }
  try {
    const snap = await getDoc(doc(db, 'users', u.uid))
    profile.value = snap.exists() ? ({ uid: u.uid, ...(snap.data() as Omit<StaffProfile, 'uid'>) } as StaffProfile) : null
  } catch {
    profile.value = null
  }
}

onAuthStateChanged(auth, async (u) => {
  user.value = u
  await loadProfile(u)
  ready.value = true
})

export function whenAuthReady(): Promise<void> {
  if (ready.value) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(ready, (v) => {
      if (v) {
        stop()
        resolve()
      }
    })
  })
}

export function homeFor(role: string | undefined): string {
  return role === 'provider' ? '/admin/deliveries' : '/admin/dashboard'
}

const isActive = computed(() => !!profile.value && profile.value.active === true)
const isSysAdmin = computed(() => isActive.value && profile.value?.role === 'system_admin')
const isMuni = computed(
  () => isActive.value && (profile.value?.role === 'municipal_admin' || profile.value?.role === 'system_admin')
)
const isCoordinator = computed(() => isActive.value && profile.value?.role === 'barangay_coordinator')
const isProvider = computed(() => isActive.value && profile.value?.role === 'provider')
/** Coordinators are limited to one barangay; municipal admins see everything (null). */
const scopeBarangayId = computed<string | null>(() =>
  isCoordinator.value ? profile.value?.assignedBarangayId ?? null : null
)

async function signIn(email: string, password: string): Promise<void> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  user.value = cred.user
  await loadProfile(cred.user)
  if (!profile.value || !profile.value.active) {
    await fbSignOut(auth)
    throw new Error('no-staff-profile')
  }
}

async function signOut(): Promise<void> {
  await fbSignOut(auth)
  profile.value = null
}

export function useAuth() {
  return { user, profile, ready, isActive, isSysAdmin, isMuni, isCoordinator, isProvider, scopeBarangayId, signIn, signOut }
}
