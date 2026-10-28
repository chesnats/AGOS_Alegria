<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { addDoc, collection, doc, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useLive } from '@/composables/useLive'
import ScheduleBadge from '@/components/ScheduleBadge.vue'
import { SCHEDULE_STATUSES, type ScheduleStatus } from '@/lib/constants'
import { fmtDateTime, fmtIsoDate, todayIso } from '@/lib/format'
import { toNumberOrNull } from '@/lib/stats'
import type { Schedule, WaterPoint } from '@/types'

const STATUS_OPTIONS: Record<ScheduleStatus, string> = {
  planned: 'Planned (not yet confirmed)',
  confirmed: 'Confirmed',
  in_progress: 'Under way',
  completed: 'Completed (record the outcome)',
  cancelled: 'Cancelled'
}
const NEEDS_VERIFIER: ScheduleStatus[] = ['confirmed', 'in_progress', 'completed']

const { profile, isMuni, scopeBarangayId } = useAuth()
const { active: barangays, nameOf } = useBarangays()

const { items, loading, error } = useLive<Schedule>(() => {
  const p = profile.value
  if (!p) return null
  const base = collection(db, 'distributionSchedules')
  if (p.role === 'barangay_coordinator') {
    const scope = scopeBarangayId.value
    return scope ? query(base, where('barangayId', '==', scope), orderBy('date'), limit(300)) : null
  }
  return query(base, orderBy('date', 'desc'), limit(300))
})
const points = useLive<WaterPoint>(() => query(collection(db, 'waterPoints')))

const filter = ref<'' | ScheduleStatus>('')
const upcomingOnly = ref(true)
const shown = computed(() =>
  items.value
    .filter((s) => (!filter.value || s.status === filter.value) && (!upcomingOnly.value || s.date >= todayIso(-1)))
    .sort((a, b) => (a.date === b.date ? a.timeStart.localeCompare(b.timeStart) : upcomingOnly.value ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
)

function blank() {
  return {
    barangayId: scopeBarangayId.value ?? '',
    date: todayIso(1),
    timeStart: '08:00',
    timeEnd: '12:00',
    locationId: '',
    locationName: '',
    quantity: '',
    status: 'planned' as ScheduleStatus,
    notes: '',
    changeNote: '',
    distributed: '',
    outcomeNote: ''
  }
}
const form = reactive(blank())
const editing = ref<Schedule | null>(null)
const showForm = ref(false)
const busy = ref(false)
const formError = ref('')
const message = ref('')

const pointOptions = computed(() => points.items.value.filter((p) => p.barangayId === form.barangayId && p.status !== 'closed'))

function onPoint(): void {
  const p = points.items.value.find((x) => x.id === form.locationId)
  if (p) form.locationName = p.name
}

function startNew(): void {
  Object.assign(form, blank())
  editing.value = null
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function startEdit(s: Schedule): void {
  Object.assign(form, {
    barangayId: s.barangayId,
    date: s.date,
    timeStart: s.timeStart,
    timeEnd: s.timeEnd,
    locationId: s.locationId ?? '',
    locationName: s.locationName,
    quantity: s.estimatedQuantityLiters != null ? String(s.estimatedQuantityLiters) : '',
    status: s.status,
    notes: s.notes ?? '',
    changeNote: s.changeNote ?? '',
    distributed: s.quantityDistributed != null ? String(s.quantityDistributed) : '',
    outcomeNote: s.outcomeNote ?? ''
  })
  editing.value = s
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function validate(): string {
  if (!form.barangayId) return 'Choose a barangay.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return 'Choose a date.'
  if (!form.timeStart || !form.timeEnd) return 'Enter the start and end times.'
  if (form.timeEnd <= form.timeStart) return 'The end time must be after the start time.'
  if (!form.locationName.trim()) return 'Enter the pick-up or delivery location.'
  const q = toNumberOrNull(form.quantity)
  if (q !== null && (!Number.isFinite(q) || q < 0)) return 'Estimated quantity must be a number, or left blank when unknown.'
  if (form.status === 'completed') {
    const d = toNumberOrNull(form.distributed)
    if (d === null || !Number.isFinite(d) || d < 0) return 'Enter the quantity actually distributed before marking this completed.'
    if (!form.outcomeNote.trim()) return 'Describe the outcome before marking this completed.'
  }
  const prev = editing.value
  if (prev && prev.status !== 'planned') {
    const changed =
      prev.date !== form.date ||
      prev.timeStart !== form.timeStart ||
      prev.timeEnd !== form.timeEnd ||
      prev.locationName !== form.locationName.trim() ||
      (form.status === 'cancelled' && prev.status !== 'cancelled')
    if (changed && !form.changeNote.trim()) return 'Add a change note so residents can see what changed and why.'
  }
  return ''
}

async function save(): Promise<void> {
  formError.value = validate()
  if (formError.value || !profile.value) return
  busy.value = true
  const uid = profile.value.uid
  const prev = editing.value
  try {
    const wasConfirmed = !!prev && NEEDS_VERIFIER.includes(prev.status)
    const prevVerifier = prev?.verifiedBy ?? null
    // The confirming staff member is recorded, so residents can trust "Confirmed" means a named person checked it.
    const verifiedBy = NEEDS_VERIFIER.includes(form.status) && (!wasConfirmed || !prevVerifier) ? uid : prevVerifier
    const completed = form.status === 'completed'
    const data = {
      barangayId: form.barangayId,
      barangayName: nameOf(form.barangayId),
      date: form.date,
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      locationName: form.locationName.trim(),
      locationId: form.locationId || null,
      estimatedQuantityLiters: toNumberOrNull(form.quantity),
      status: form.status,
      notes: form.notes.trim(),
      changeNote: form.changeNote.trim(),
      verifiedBy,
      quantityDistributed: completed ? toNumberOrNull(form.distributed) : null,
      outcomeNote: completed ? form.outcomeNote.trim() : '',
      updatedAt: serverTimestamp(),
      updatedBy: uid
    }
    if (prev) {
      const { barangayId: _b, barangayName: _n, ...rest } = data // the barangay of a schedule never changes
      await updateDoc(doc(db, 'distributionSchedules', prev.id), rest)
    } else {
      await addDoc(collection(db, 'distributionSchedules'), { ...data, createdAt: serverTimestamp() })
    }
    message.value = 'Schedule saved.'
    showForm.value = false
  } catch {
    formError.value = 'The schedule could not be saved. Check that you are allowed to manage this barangay, then try again.'
  } finally {
    busy.value = false
  }
}

async function confirm(s: Schedule): Promise<void> {
  if (!profile.value) return
  message.value = ''
  try {
    await updateDoc(doc(db, 'distributionSchedules', s.id), {
      status: 'confirmed',
      verifiedBy: profile.value.uid,
      updatedAt: serverTimestamp(),
      updatedBy: profile.value.uid
    })
    message.value = `Confirmed: ${fmtIsoDate(s.date)} · ${s.locationName}.`
  } catch {
    message.value = 'The schedule could not be confirmed.'
  }
}
</script>

<template>
  <div>
    <div class="row between">
      <h1>Distribution schedules</h1>
      <button class="btn" type="button" @click="startNew">New schedule</button>
    </div>
    <p class="small muted">
      Residents see every schedule here. Only <strong>Confirmed</strong>, <strong>Under way</strong> and <strong>Completed</strong> schedules
      are shown as verified; <strong>Planned</strong> ones are labelled as not yet confirmed.
    </p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <section v-if="showForm" class="panel">
      <h2>{{ editing ? 'Edit schedule' : 'New schedule' }}</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="field">
            <label for="b">Barangay</label>
            <select id="b" v-model="form.barangayId" :disabled="!isMuni || !!editing" required>
              <option value="" disabled>Choose…</option>
              <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="field"><label for="d">Date</label><input id="d" v-model="form.date" type="date" required /></div>
          <div class="field"><label for="ts">From</label><input id="ts" v-model="form.timeStart" type="time" required /></div>
          <div class="field"><label for="te">Until</label><input id="te" v-model="form.timeEnd" type="time" required /></div>
          <div class="field">
            <label for="lp">Water point <span class="hint">(optional)</span></label>
            <select id="lp" v-model="form.locationId" @change="onPoint">
              <option value="">Not listed</option>
              <option v-for="p in pointOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="field"><label for="ln">Pick-up / delivery location</label><input id="ln" v-model="form.locationName" type="text" maxlength="160" required /></div>
          <div class="field">
            <label for="q">Estimated water (liters) <span class="hint">leave blank if unknown</span></label>
            <input id="q" v-model="form.quantity" type="number" min="0" inputmode="numeric" />
          </div>
          <div class="field">
            <label for="s">Status</label>
            <select id="s" v-model="form.status">
              <option v-for="s in SCHEDULE_STATUSES" :key="s" :value="s">{{ STATUS_OPTIONS[s] }}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="n">Note for residents <span class="hint">(optional, public)</span></label>
          <textarea id="n" v-model="form.notes" maxlength="500" placeholder="What to bring, queue rules, who to contact…" />
        </div>
        <div class="field">
          <label for="cn">Change note <span class="hint">(public; required when you change or cancel a confirmed schedule)</span></label>
          <input id="cn" v-model="form.changeNote" type="text" maxlength="200" placeholder="Moved from Tuesday because the truck is under repair" />
        </div>
        <div v-if="form.status === 'completed'" class="form-grid">
          <div class="field">
            <label for="dq">Liters actually distributed</label>
            <input id="dq" v-model="form.distributed" type="number" min="0" inputmode="numeric" />
          </div>
          <div class="field">
            <label for="oc">Outcome</label>
            <input id="oc" v-model="form.outcomeNote" type="text" maxlength="300" placeholder="e.g. 38 households served; queue ended 11:30" />
          </div>
        </div>
        <div class="row">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save schedule' }}</button>
          <button class="btn secondary" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>
    </section>

    <div class="toolbar">
      <div>
        <label for="f">Status</label>
        <select id="f" v-model="filter">
          <option value="">All</option>
          <option v-for="s in SCHEDULE_STATUSES" :key="s" :value="s">{{ STATUS_OPTIONS[s] }}</option>
        </select>
      </div>
      <label class="check" style="flex: 0 0 auto; align-self: center">
        <input v-model="upcomingOnly" type="checkbox" /> Upcoming only
      </label>
    </div>

    <p v-if="error" class="error" role="alert">We could not load schedules.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <p v-else-if="!shown.length" class="muted">No schedules to show.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Time</th><th>Barangay</th><th>Location</th><th>Est. liters</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in shown" :key="s.id">
            <td>{{ fmtIsoDate(s.date) }}</td>
            <td>{{ s.timeStart }}–{{ s.timeEnd }}</td>
            <td>{{ s.barangayName }}</td>
            <td>{{ s.locationName }}</td>
            <td>{{ s.estimatedQuantityLiters ?? '–' }}</td>
            <td><ScheduleBadge :status="s.status" admin /></td>
            <td>{{ fmtDateTime(s.updatedAt) }}</td>
            <td>
              <div class="row" style="flex-wrap: nowrap">
                <button v-if="s.status === 'planned'" class="btn sm" type="button" @click="confirm(s)">Confirm</button>
                <button class="btn sm secondary" type="button" @click="startEdit(s)">Edit</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
