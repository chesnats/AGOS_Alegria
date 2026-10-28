import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { homeFor, useAuth, whenAuthReady } from '@/composables/useAuth'
import type { Role } from '@/lib/constants'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: Role[]
    requiresStaff?: boolean
    title?: string
  }
}

const MUNI: Role[] = ['municipal_admin', 'system_admin']
const OPS: Role[] = ['municipal_admin', 'system_admin', 'barangay_coordinator']
const ALL_STAFF: Role[] = ['municipal_admin', 'system_admin', 'barangay_coordinator', 'provider']

const routes: RouteRecordRaw[] = [
  { path: '/welcome', component: () => import('@/views/resident/WelcomeView.vue'), meta: { title: 'Welcome' } },
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/resident/HomeView.vue') },
      { path: 'request', name: 'request', component: () => import('@/views/resident/RequestFormView.vue'), meta: { title: 'Request water' } },
      { path: 'request/done/:reference', name: 'request-done', component: () => import('@/views/resident/RequestDoneView.vue'), props: true, meta: { title: 'Request received' } },
      { path: 'track', name: 'track', component: () => import('@/views/resident/TrackView.vue'), meta: { title: 'Track a request' } },
      { path: 'my-requests', component: () => import('@/views/resident/MyRequestsView.vue'), meta: { title: 'My requests' } },
      { path: 'schedule', name: 'schedule', component: () => import('@/views/resident/ScheduleView.vue'), meta: { title: 'Water schedule' } },
      { path: 'updates', name: 'updates', component: () => import('@/views/resident/UpdatesView.vue'), meta: { title: 'Water updates' } },
      { path: 'water-points', component: () => import('@/views/resident/WaterPointsView.vue'), meta: { title: 'Water points' } },
      { path: 'help', component: () => import('@/views/resident/HelpView.vue'), meta: { title: 'Help & contact' } },
      { path: 'install', component: () => import('@/views/resident/InstallView.vue'), meta: { title: 'Install' } },
      { path: 'privacy', component: () => import('@/views/resident/PrivacyView.vue'), meta: { title: 'Privacy notice' } }
    ]
  },
  { path: '/admin/login', name: 'admin-login', component: () => import('@/views/admin/LoginView.vue'), meta: { title: 'Staff sign in' } },
  {
    path: '/admin',
    component: () => import('@/components/AdminLayout.vue'),
    meta: { requiresStaff: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', component: () => import('@/views/admin/DashboardView.vue'), meta: { roles: OPS, title: 'Dashboard' } },
      { path: 'requests', component: () => import('@/views/admin/RequestsView.vue'), meta: { roles: OPS, title: 'Requests' } },
      { path: 'requests/:id', component: () => import('@/views/admin/RequestDetailView.vue'), props: true, meta: { roles: OPS, title: 'Request' } },
      { path: 'distribution', component: () => import('@/views/admin/DistributionView.vue'), meta: { roles: OPS, title: 'Distribution' } },
      { path: 'deliveries', component: () => import('@/views/admin/DeliveriesView.vue'), meta: { roles: ALL_STAFF, title: 'Deliveries' } },
      { path: 'announcements', component: () => import('@/views/admin/AnnouncementsView.vue'), meta: { roles: OPS, title: 'Announcements' } },
      { path: 'water-points', component: () => import('@/views/admin/WaterPointsAdminView.vue'), meta: { roles: OPS, title: 'Water points' } },
      { path: 'barangays', component: () => import('@/views/admin/BarangaysView.vue'), meta: { roles: MUNI, title: 'Barangays' } },
      { path: 'users', component: () => import('@/views/admin/UsersView.vue'), meta: { roles: MUNI, title: 'Staff accounts' } },
      { path: 'reports', component: () => import('@/views/admin/ReportsView.vue'), meta: { roles: OPS, title: 'Reports' } },
      { path: 'audit', component: () => import('@/views/admin/AuditView.vue'), meta: { roles: MUNI, title: 'Audit log' } },
      { path: 'settings', component: () => import('@/views/admin/SettingsView.vue'), meta: { roles: MUNI, title: 'Settings' } }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/components/AppShell.vue'),
    children: [{ path: '', component: () => import('@/views/resident/NotFoundView.vue') }]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

function seenWelcome(): boolean {
  try {
    return localStorage.getItem('tl.welcomed') === '1'
  } catch {
    return true
  }
}

router.beforeEach(async (to) => {
  // First visit lands on the welcome / install screen.
  if (to.path === '/' && !seenWelcome()) return '/welcome'

  if (!to.matched.some((r) => r.meta.requiresStaff)) return true

  await whenAuthReady()
  const { profile } = useAuth()
  const p = profile.value
  if (!p || !p.active) return { name: 'admin-login', query: { redirect: to.fullPath } }

  // The server and Firestore rules enforce access; this just keeps staff out of screens they cannot use.
  const roles = to.meta.roles
  if (roles && !roles.includes(p.role)) return homeFor(p.role)
  if (to.path === '/admin/dashboard' && p.role === 'provider') return homeFor(p.role)
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · TubigLink Alegria` : 'TubigLink Alegria'
})

export default router
