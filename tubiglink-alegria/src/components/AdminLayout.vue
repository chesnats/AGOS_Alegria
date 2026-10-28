<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { ROLE_LABELS, type Role } from '@/lib/constants'

const router = useRouter()
const { profile, signOut } = useAuth()
const { nameOf } = useBarangays()

interface NavItem {
  to: string
  label: string
  roles: Role[]
}
const MUNI: Role[] = ['municipal_admin', 'system_admin']
const OPS: Role[] = [...MUNI, 'barangay_coordinator']
const NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', roles: OPS },
  { to: '/admin/requests', label: 'Requests', roles: OPS },
  { to: '/admin/distribution', label: 'Distribution', roles: OPS },
  { to: '/admin/deliveries', label: 'Deliveries', roles: [...OPS, 'provider'] },
  { to: '/admin/announcements', label: 'Announcements', roles: OPS },
  { to: '/admin/water-points', label: 'Water points', roles: OPS },
  { to: '/admin/reports', label: 'Reports', roles: OPS },
  { to: '/admin/barangays', label: 'Barangays', roles: MUNI },
  { to: '/admin/users', label: 'Staff', roles: MUNI },
  { to: '/admin/audit', label: 'Audit log', roles: MUNI },
  { to: '/admin/settings', label: 'Settings', roles: MUNI }
]

const links = computed(() => NAV.filter((n) => profile.value && n.roles.includes(profile.value.role)))
const scope = computed(() => {
  const p = profile.value
  if (!p) return ''
  const role = ROLE_LABELS[p.role]
  return p.role === 'barangay_coordinator' && p.assignedBarangayId ? `${role}, ${nameOf(p.assignedBarangayId)}` : role
})

async function logout(): Promise<void> {
  await signOut()
  router.push({ name: 'admin-login' })
}
</script>

<template>
  <div class="admin">
    <header class="admin-top">
      <strong>TubigLink Alegria · Staff</strong>
      <div class="row">
        <span class="who">{{ profile?.displayName }} · {{ scope }}</span>
        <RouterLink class="btn sm secondary" to="/">Public app</RouterLink>
        <button class="btn sm secondary" type="button" @click="logout">Sign out</button>
      </div>
    </header>
    <nav class="admin-nav" aria-label="Staff navigation">
      <RouterLink v-for="l in links" :key="l.to" :to="l.to">{{ l.label }}</RouterLink>
    </nav>
    <main class="admin-main">
      <RouterView />
    </main>
  </div>
</template>
