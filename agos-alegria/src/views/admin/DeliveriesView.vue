<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { addDoc, collection, doc, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useLive } from '@/composables/useLive'
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/lib/constants'
import { fmtDateTime, fmtIsoDate, todayIso } from '@/lib/format'
import { toNumberOrNull } from '@/lib/stats'
import type { Delivery, Schedule, StaffProfile } from '@/types'

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  planned: 'Planned',
  dispatched: 'On the way',
  delivered: 'Delivered',
  failed: 'Not delivered'
}
const TONE: Record<DeliveryStatus, string> = { planned: 'warn', dispatched: 'info', delivered: 'ok', failed: 'bad' }

const { profile, isMuni, isProvider, scopeBarangayId } = useAuth()
const { active: barangays, nameOf } = useBarangays()

const { items, loading, error } = useLive<Delivery>(() => {
  const p = profile.value
  if (!p) return null
  const base = collection(db, 'deliveries')
  if (p.role === 'provider') return query(base, where('operatorUid', '==', p.uid), orderBy('createdAt', 'desc'), limit(100))
  if (p.role === 'barangay_coordinator') {
    const scope = scopeBarangayId.value
    return scope ? query(base, where('barangayId', '==', scope), orderBy('createdAt', 'desc'), limit(200)) : null
  }
  return query(base, orderBy('createdAt', 'desc'), limit(200))
})

// Municipal administrators can assign deliveries to a provider; others cannot list accounts.
const operators = useLive<StaffProfile & { id: string }>(() =>
  isMuni.value ? query(collection(db, 'users'), where('role', '==', 'provider'), where('active', '==', true)) : null
)
const schedules = useLive<Schedule>(() =>
  isProvider.value ? null : query(collection(db, 'distributionSchedules'), where('date', '>=', todayIso(-14)), orderBy('date'), limit(100))
)

const message = ref('')
const showForm = ref(false)
const editing = ref<Delivery | null>(null)
const busy = ref(false)
const formError = ref('')

function blank() {
  return {
    scheduleId: '',
    barangayId: scopeBarangayId.value ?? '',
    supplierName: '',
    vehicle: '',
    operatorUid: '',
    planned: '',
    status: 'planned' as DeliveryStatus,
    delivered: '',
    remaining: '',
    notes: ''
  }
}
const form = reactive(blank())

const scheduleOptions = computed(() =>
  schedules.items.value.filter((s) => (!form.barangayId || s.barangayId === form.barangayId) && s.status !== 'cancelled')
)

function startNew(): void {
  Object.assign(form, blank())
  editing.value = null
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function startEdit(d: Delivery): void {
  Object.assign(form, {
    scheduleId: d.scheduleId ?? '',
    barangayId: d.barangayId,
    supplierName: d.supplierName,
    vehicle: d.vehicle,
    operatorUid: d.operatorUid ?? '',
    planned: d.quantityPlanned != null ? String(d.quantityPlanned) : '',
    status: d.status,
    delivered: d.quantityDelivered != null ? String(d.quantityDelivered) : '',
    remaining: d.remainingStock != null ? String(d.remainingStock) : '',
    notes: d.notes ?? ''
  })
  editing.value = d
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function validate(): string {
  if (!isProvider.value) {
    if (!form.barangayId) return 'Choose a barangay.'
    if (!form.supplierName.trim()) return 'Enter the supplier or team name.'
  }
  for (const [label, v] of [['Planned quantity', form.planned], ['Delivered quantity', form.delivered], ['Remaining stock', form.remaining]] as const) {
    const n = toNumberOrNull(v)
    if (n !== null && (!Number.isFinite(n) || n < 0)) return `${label} must be a number, or left blank.`
  }
  if (form.status === 'delivered') {
    const n = toNumberOrNull(form.delivered)
    if (n === null || !Number.isFinite(n)) return 'Record the quantity actually delivered (in liters) before marking this delivered.'
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
    const outcome = {
      status: form.status,
      quantityDelivered: toNumberOrNull(form.delivered),
      remainingStock: toNumberOrNull(form.remaining),
      notes: form.notes.trim(),
      ...(form.status === 'delivered' && !prev?.completedAt ? { completedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
      updatedBy: uid
    }
    if (prev && isProvider.value) {
      // Delivery operators may only report outcomes on their own assignments.
      await updateDoc(doc(db, 'deliveries', prev.id), outcome)
    } else if (prev) {
      await updateDoc(doc(db, 'deliveries', prev.id), {
        ...outcome,
        scheduleId: form.scheduleId || null,
        supplierName: form.supplierName.trim(),
        vehicle: form.vehicle.trim(),
        operatorUid: isMuni.value ? form.operatorUid || null : prev.operatorUid ?? null,
        quantityPlanned: toNumberOrNull(form.planned)
      })
    } else {
      await addDoc(collection(db, 'deliveries'), {
        scheduleId: form.scheduleId || null,
        barangayId: form.barangayId,
        barangayName: nameOf(form.barangayId),
        supplierName: form.supplierName.trim(),
        vehicle: form.vehicle.trim(),
        operatorUid: isMuni.value ? form.operatorUid || null : null,
        quantityPlanned: toNumberOrNull(form.planned),
        quantityDelivered: toNumberOrNull(form.delivered),
        remainingStock: toNumberOrNull(form.remaining),
        status: form.status,
        notes: form.notes.trim(),
        completedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: uid
      })
    }
    message.value = 'Delivery saved.'
    showForm.value = false
  } catch {
    formError.value = 'The delivery could not be saved. Check your permissions and connection, then try again.'
  } finally {
    busy.value = false
  }
}

function operatorName(uid: string | null | undefined): string {
  if (!uid) return '–'
  return operators.items.value.find((o) => o.id === uid)?.displayName ?? (uid === profile.value?.uid ? 'You' : 'Assigned')
}
</script>

<template>
  <div>
    <div class="row between">
      <h1>{{ isProvider ? 'My deliveries' : 'Deliveries' }}</h1>
      <button v-if="!isProvider" class="btn" type="button" @click="startNew">New delivery</button>
    </div>
    <p class="small muted">
      Record what was actually delivered. Quantities feed the municipal reports, so please enter liters delivered and remaining stock when you know them.
    </p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <section v-if="showForm" class="panel">
      <h2>{{ editing ? (isProvider ? 'Report outcome' : 'Edit delivery') : 'New delivery' }}</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <form @submit.prevent="save">
        <div v-if="!isProvider" class="form-grid">
          <div class="field">
            <label for="b">Barangay</label>
            <select id="b" v-model="form.barangayId" :disabled="!isMuni || !!editing" required>
              <option value="" disabled>Choose…</option>
              <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="field">
            <label for="sc">Linked schedule <span class="hint">(optional)</span></label>
            <select id="sc" v-model="form.scheduleId">
              <option value="">None</option>
              <option v-for="s in scheduleOptions" :key="s.id" :value="s.id">{{ fmtIsoDate(s.date) }} · {{ s.locationName }}</option>
            </select>
          </div>
          <div class="field"><label for="su">Supplier / team</label><input id="su" v-model="form.supplierName" type="text" maxlength="120" required /></div>
          <div class="field"><label for="ve">Vehicle <span class="hint">(optional)</span></label><input id="ve" v-model="form.vehicle" type="text" maxlength="80" /></div>
          <div v-if="isMuni" class="field">
            <label for="op">Assigned operator</label>
            <select id="op" v-model="form.operatorUid">
              <option value="">Not assigned</option>
              <option v-for="o in operators.items.value" :key="o.id" :value="o.id">{{ o.displayName }}</option>
            </select>
          </div>
          <div class="field"><label for="pq">Planned liters</label><input id="pq" v-model="form.planned" type="number" min="0" inputmode="numeric" /></div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="st">Status</label>
            <select id="st" v-model="form.status">
              <option v-for="s in DELIVERY_STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
            </select>
          </div>
          <div class="field"><label for="dq">Liters delivered</label><input id="dq" v-model="form.delivered" type="number" min="0" inputmode="numeric" /></div>
          <div class="field"><label for="rs">Remaining stock (liters)</label><input id="rs" v-model="form.remaining" type="number" min="0" inputmode="numeric" /></div>
        </div>
        <div class="field"><label for="nt">Notes <span class="hint">(optional)</span></label><textarea id="nt" v-model="form.notes" maxlength="500" /></div>
        <div class="row">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save' }}</button>
          <button class="btn secondary" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>
    </section>

    <p v-if="error" class="error" role="alert">We could not load deliveries.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <p v-else-if="!items.length" class="muted">{{ isProvider ? 'Nothing is assigned to you yet.' : 'No deliveries recorded yet.' }}</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Barangay</th><th>Supplier</th><th>Operator</th><th>Planned (L)</th><th>Delivered (L)</th><th>Remaining (L)</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="d in items" :key="d.id">
            <td>{{ d.barangayName }}</td>
            <td>{{ d.supplierName }}<span v-if="d.vehicle" class="small muted"><br />{{ d.vehicle }}</span></td>
            <td>{{ operatorName(d.operatorUid) }}</td>
            <td>{{ d.quantityPlanned ?? '–' }}</td>
            <td>{{ d.quantityDelivered ?? '–' }}</td>
            <td>{{ d.remainingStock ?? '–' }}</td>
            <td><span class="badge" :class="TONE[d.status]">{{ STATUS_LABEL[d.status] }}</span></td>
            <td>{{ fmtDateTime(d.updatedAt) }}</td>
            <td><button class="btn sm secondary" type="button" @click="startEdit(d)">{{ isProvider ? 'Report' : 'Edit' }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
