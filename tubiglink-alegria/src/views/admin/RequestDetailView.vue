<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { collection, doc, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useLive, useLiveDoc } from '@/composables/useLive'
import { useStaffNames } from '@/composables/useStaffData'
import StatusBadge from '@/components/StatusBadge.vue'
import { errorMessage, revealContact, updateRequestStatus, type RevealedContact } from '@/lib/api'
import {
  COORDINATOR_TARGETS,
  DURATION_LABELS_EN,
  ISSUE_LABELS_EN,
  NOTE_REQUIRED,
  STATUS_LABELS_EN,
  TRANSITIONS,
  type RequestStatus
} from '@/lib/constants'
import { fmtDateTime, toDate } from '@/lib/format'
import type { StatusHistoryEntry, WaterRequest } from '@/types'

const props = defineProps<{ id: string }>()
const { isMuni } = useAuth()
const { nameFor } = useStaffNames()

const { data: request, loading, error } = useLiveDoc<WaterRequest>(() => doc(db, 'waterRequests', props.id))

// The barangayId filter is required by the Firestore rules for coordinators, and harmless for municipal staff.
const history = useLive<StatusHistoryEntry>(() =>
  request.value
    ? query(collection(db, 'statusHistory'), where('requestId', '==', props.id), where('barangayId', '==', request.value.barangayId))
    : null
)
const timeline = computed(() =>
  [...history.items.value].sort((a, b) => (toDate(a.timestamp)?.getTime() ?? 0) - (toDate(b.timestamp)?.getTime() ?? 0))
)

// ---- status change ----
const targets = computed<RequestStatus[]>(() => {
  const r = request.value
  if (!r) return []
  const next = TRANSITIONS[r.status] ?? []
  return isMuni.value ? next : next.filter((s) => COORDINATOR_TARGETS.includes(s))
})
const newStatus = ref<RequestStatus | ''>('')
const publicNote = ref('')
const internalNote = ref('')
const busy = ref(false)
const formError = ref('')
const saved = ref(false)

const noteRequired = computed(() => newStatus.value !== '' && NOTE_REQUIRED.includes(newStatus.value))
const canSubmit = computed(
  () => newStatus.value !== '' && !busy.value && (!noteRequired.value || publicNote.value.trim().length >= 5)
)

async function submit(): Promise<void> {
  if (!request.value || newStatus.value === '') return
  formError.value = ''
  saved.value = false
  busy.value = true
  try {
    await updateRequestStatus({
      requestId: request.value.id,
      newStatus: newStatus.value,
      publicNote: publicNote.value.trim(),
      internalNote: internalNote.value.trim()
    })
    newStatus.value = ''
    publicNote.value = ''
    internalNote.value = ''
    saved.value = true
  } catch (err) {
    formError.value = errorMessage(err, 'The status could not be updated. Please try again.')
  } finally {
    busy.value = false
  }
}

// ---- private contact details (every view is recorded in the audit log) ----
const contact = shallowRef<RevealedContact | null>(null)
const contactBusy = ref(false)
const contactError = ref('')

async function reveal(): Promise<void> {
  contactError.value = ''
  contactBusy.value = true
  try {
    contact.value = await revealContact(props.id)
  } catch (err) {
    contactError.value = errorMessage(err, 'The contact details could not be loaded.')
  } finally {
    contactBusy.value = false
  }
}

watch(
  () => props.id,
  () => {
    contact.value = null
    contactError.value = ''
    saved.value = false
    formError.value = ''
    newStatus.value = ''
  }
)
</script>

<template>
  <div>
    <p><RouterLink to="/admin/requests">← All requests</RouterLink></p>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="error || !request" class="error" role="alert">
      This request could not be loaded. It may not exist, or it may belong to another barangay.
    </p>

    <template v-else>
      <div class="row between mb">
        <h1 class="mono" style="margin: 0">{{ request.id }}</h1>
        <StatusBadge :status="request.status" admin />
      </div>

      <div v-if="request.possibleDuplicate" class="notice">
        ⚠ This may duplicate an earlier request
        <template v-if="request.duplicateOf">
          (<RouterLink :to="`/admin/requests/${request.duplicateOf}`" class="mono">{{ request.duplicateOf }}</RouterLink>).
        </template>
        Check both before deciding. If it is the same household, update this one with a note pointing to the other.
      </div>

      <div class="grid cols-2">
        <section class="panel">
          <h2>Request</h2>
          <dl class="kv">
            <dt>Barangay</dt><dd>{{ request.barangayName }}</dd>
            <dt>Purok / sitio</dt><dd>{{ request.purok }}</dd>
            <dt>Problem</dt><dd>{{ ISSUE_LABELS_EN[request.issueType] }}</dd>
            <dt>Lasting</dt><dd>{{ DURATION_LABELS_EN[request.duration] }}</dd>
            <dt>People affected</dt><dd>{{ request.householdMembers }}</dd>
            <dt>Received</dt><dd>{{ fmtDateTime(request.createdAt) }}</dd>
            <dt>Last updated</dt><dd>{{ fmtDateTime(request.updatedAt) }}</dd>
            <dt>Verified</dt><dd>{{ fmtDateTime(request.verifiedAt) }}</dd>
            <dt>Assistance started</dt><dd>{{ fmtDateTime(request.assistanceAt) }}</dd>
            <dt>Resolved</dt><dd>{{ fmtDateTime(request.resolvedAt) }}</dd>
          </dl>
        </section>

        <section class="panel private">
          <h2>Contact details (private)</h2>
          <template v-if="contact">
            <dl class="kv">
              <dt>Name</dt><dd>{{ contact.contactName || '–' }}</dd>
              <dt>Contact</dt><dd>{{ contact.contactValue || '–' }} <span v-if="contact.contactMethod" class="muted small">({{ contact.contactMethod }})</span></dd>
              <dt>Landmark</dt><dd>{{ contact.landmark || '–' }}</dd>
              <dt>Description</dt><dd class="pre">{{ contact.description || '–' }}</dd>
            </dl>
            <p class="small muted mt">Do not copy these details into public notes or chats.</p>
          </template>
          <template v-else>
            <p class="small">Contact details are hidden by default. Viewing them is recorded in the audit log with your name.</p>
            <p v-if="contactError" class="error" role="alert">{{ contactError }}</p>
            <button class="btn secondary" type="button" :disabled="contactBusy" @click="reveal">
              {{ contactBusy ? 'Loading…' : 'Show contact details' }}
            </button>
          </template>
        </section>
      </div>

      <section class="panel">
        <h2>Update status</h2>
        <p v-if="!targets.length" class="muted">No further status changes are available for your role.</p>
        <form v-else @submit.prevent="submit">
          <p v-if="saved" class="success" role="status">Saved. The resident will see this update when they track the request.</p>
          <p v-if="formError" class="error" role="alert">{{ formError }}</p>
          <div class="form-grid">
            <div class="field">
              <label for="ns">New status</label>
              <select id="ns" v-model="newStatus">
                <option value="" disabled>Choose…</option>
                <option v-for="s in targets" :key="s" :value="s">{{ STATUS_LABELS_EN[s] }}</option>
              </select>
              <p v-if="!isMuni" class="hint">Scheduling, closing or declining assistance is done by the municipal team.</p>
            </div>
          </div>
          <div class="field">
            <label for="pn">
              Message shown to the resident
              <span class="hint">{{ noteRequired ? '(required, at least 5 characters)' : '(optional)' }}</span>
            </label>
            <textarea id="pn" v-model="publicNote" maxlength="400" placeholder="For example: Water delivery is planned for Friday morning at the barangay hall." />
            <p class="hint">This text is visible to anyone who has the reference number. Do not include names or phone numbers.</p>
          </div>
          <div class="field">
            <label for="in">Internal note <span class="hint">(staff only, optional)</span></label>
            <textarea id="in" v-model="internalNote" maxlength="800" />
          </div>
          <button class="btn" type="submit" :disabled="!canSubmit">{{ busy ? 'Saving…' : 'Save status change' }}</button>
        </form>
      </section>

      <section class="panel">
        <h2>History</h2>
        <p v-if="!timeline.length" class="muted">No history yet.</p>
        <ol v-else class="timeline">
          <li v-for="h in timeline" :key="h.id">
            <StatusBadge :status="h.newStatus" admin />
            <span class="small muted"> · {{ fmtDateTime(h.timestamp) }} · {{ nameFor(h.changedBy) }}</span>
            <p v-if="h.publicNote" class="small" style="margin: 0.3rem 0 0"><strong>Shown to resident:</strong> {{ h.publicNote }}</p>
            <p v-if="h.internalNote" class="small" style="margin: 0.2rem 0 0"><strong>Internal:</strong> {{ h.internalNote }}</p>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
