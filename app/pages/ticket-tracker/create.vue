<script setup lang="ts">
// Create Ticket Tracker - Retrieval. The HRIS lookup used to be its own
// full-page step that swapped away entirely once a team member was picked -
// that read as a separate screen/flow for what's really just the first field
// of one continuous form. Now the search box and the Reason/Mode/Dates
// section are both always on screen: the form section starts disabled
// (nothing to resolve yet) and simply activates in place once a team member
// is selected, with a compact "fetched" summary appearing inline rather than
// replacing the search step.
import type { HrisRecord, TicketMode, TicketReason } from '~/data/ticketTrackers'
import { localISO, HRIS_DIRECTORY, ticketStatusLabel, templateForKey, MATRIX, computeTargetDateForPath, REASON_LABELS, resolvedPathFor, createTicket, findOpenDuplicate, ASSET_TEAM_MEMBERS, assetTeamMemberByName, currentUserName } from '~/data/ticketTrackers'
import { flushTicketsToStorage } from '~/utils/ticketStorage'

definePageMeta({ layout: 'retrieval', pageTransition: { name: 'page', mode: 'out-in' } })
useSeoMeta({ title: 'AMS · Create Retrieval Ticket' })

const toast = useToast()
// Same pattern as the workspace page (ticket-tracker/[id].vue): a
// visually-disabled action should still explain itself on hover (tooltip)
// and on click (toast), not silently do nothing - see that file's own
// guardedClick for the fuller rationale.
function guardedClick(ready: boolean, reason: string, action: () => void) {
  if (!ready) {
    toast.add({ title: 'Not ready yet', description: reason, icon: 'i-lucide-info', color: 'warning' })
    return
  }
  action()
}

const selectedEmployee = ref<HrisRecord | null>(null)
// UInputMenu types its model as the picked item, but this form also keeps the typed text in it until a person is picked.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const employeeQuery = ref<any>('')

const employeeOptions = computed(() => HRIS_DIRECTORY.map(e => ({ ...e, label: e.name })))

function selectEmployee(emp: HrisRecord | null) {
  selectedEmployee.value = emp
  if (!emp) return
  reason.value = emp.suggestedReason
  reasonOverrideReason.value = ''
  modeAutoFilled.value = emp.addressMode
  lwd.value = emp.lwd
  sep.value = emp.sep
  applyP12Guard()
  autoFillMode()
}

const reason = ref<TicketReason | ''>('')
const mode = ref<TicketMode | ''>('')
const modeAutoFilled = ref<TicketMode>('remote')
const modeOverrideReason = ref('')
// Reason is overridable the same way Mode is - HRIS's suggestedReason is a
// best guess (its own offboarding case type), not a hard fact, so the
// operator can correct it. Same guardrail as Mode's override, though:
// changing it away from what HRIS actually reported needs a recorded
// justification, not a silent, unexplained edit.
const reasonOverrideReason = ref('')
const reasonOverridden = computed(() => !!selectedEmployee.value && !!reason.value && reason.value !== selectedEmployee.value.suggestedReason)
// Clears the note the moment the operator picks the suggested reason back -
// a leftover justification for an override that no longer exists is just
// confusing, not useful history.
watch(reason, () => { if (!reasonOverridden.value) reasonOverrideReason.value = '' })
const lwd = ref('')
const sep = ref('')
const authorizingEndorsement = ref('')
const recallEffectiveDate = ref('')
// FR-003.4: "the date the Asset Team received it" - distinct from LWD/Separation
// Date and from the endorsement artifact itself.
const authorizingEndorsementDate = ref('')
const assigneeName = ref(currentUserName())
const assigneeOptions = ASSET_TEAM_MEMBERS.map(m => ({ label: m.name, value: m.name }))

const p12Blocked = computed(() => reason.value === 'unexplained-absence')

function applyP12Guard() {
  if (reason.value === 'unexplained-absence' && mode.value === 'onsite') mode.value = 'remote'
}

function autoFillMode() {
  mode.value = reason.value === 'unexplained-absence' ? 'remote' : modeAutoFilled.value
  modeOverrideReason.value = ''
}

const modeOverridden = computed(() => {
  const expectedAuto = reason.value === 'unexplained-absence' ? 'remote' : modeAutoFilled.value
  return !!mode.value && mode.value !== expectedAuto
})

function onReasonChange() {
  applyP12Guard()
  autoFillMode()
}

const resolvedPath = computed(() => {
  if (!reason.value || !mode.value) return null
  return resolvedPathFor(reason.value, mode.value)
})

const matrixEntry = computed(() => reason.value ? MATRIX[reason.value] : null)

// The real Target Date this ticket would get, from the dates typed so far
// (the written rule lives in the info tooltip beside it).
const computedDeadline = computed(() => {
  if (!reason.value || !mode.value) return ''
  const iso = computeTargetDateForPath({
    reason: reason.value, mode: mode.value, lwd: lwd.value,
    createdAt: localISO(new Date()),
    recallEffectiveDate: reason.value === 'recalled' ? recallEffectiveDate.value : undefined
  })
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

// Guardrail: block creating a second ticket for a team member who already
// has one open. This is a business-critical duplicate to catch, not just a
// convenience warning - two open retrieval tickets for the same person
// means two parallel notices, two deadlines, two closures for one set of
// equipment.
const duplicateTicket = computed(() => selectedEmployee.value ? findOpenDuplicate(selectedEmployee.value.id) : undefined)

// FR-003.4: "Where the path configuration carries a gate, the ticket cannot
// progress past entry until this field is populated" - so the endorsement
// (and its recorded date) are only a hard requirement on a gated path
// (End of Contract, Recalled, Unexplained Absence). Voluntary paths
// (Resignation, Immediate Resignation) carry no gate and no such requirement.
const endorsementRequired = computed(() => (matrixEntry.value?.gateCount ?? 0) > 0)

// Guardrail: the endorsement authorizes this retrieval (FR-003.4), so its
// own recorded date must be strictly earlier than the Separation Date, not
// just no-later-than it - the two can't land on the same day either,
// confirmed live. Checked whenever both dates are present, regardless of
// whether this path's gate makes the endorsement itself required. Not
// compared against Last Working Day: unlike Separation Date, LWD has no
// fixed before/after relationship to the endorsement across every path (a
// Gate-3 termination endorsement is expected to land well after an
// absence, and so after the LWD, has already begun).
const endorsementAfterSeparation = computed(() =>
  !!authorizingEndorsementDate.value && !!sep.value && authorizingEndorsementDate.value >= sep.value
)

function fmtIso(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The latest Endorsement Recorded Date the calendar picker allows: one real calendar day before the (synced) Separation Date, since the two can't share a day. Formatted from the Date object's own local getters, not toISOString() - that converts to UTC, which silently shifts the date back a day in any timezone ahead of UTC. */
const endorsementMaxDate = computed(() => {
  if (!sep.value) return undefined
  const d = new Date(`${sep.value}T00:00:00`)
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

const canSubmit = computed(() =>
  !!selectedEmployee.value && !!reason.value && !!mode.value && !!lwd.value && !!sep.value
  && !duplicateTicket.value
  && (reason.value !== 'recalled' || !!recallEffectiveDate.value)
  && (!reasonOverridden.value || reasonOverrideReason.value.trim().length > 0)
  && (!modeOverridden.value || modeOverrideReason.value.trim().length > 0)
  && (!endorsementRequired.value || (!!authorizingEndorsement.value.trim() && !!authorizingEndorsementDate.value))
  && !endorsementAfterSeparation.value
)

// First unmet requirement, in the order a user would naturally fill the
// form - used for the Submit button's tooltip/toast so a disabled button
// always says exactly what's missing rather than just refusing silently.
const canSubmitReason = computed(() => {
  if (!selectedEmployee.value) return 'Search for and select a team member first.'
  if (!reason.value) return 'Select a reason first.'
  if (!mode.value) return 'Select a mode first.'
  if (!lwd.value) return 'Enter the Last Working Day first.'
  if (!sep.value) return 'Enter the Separation Date first.'
  if (duplicateTicket.value) return 'This team member already has an open retrieval ticket.'
  if (reason.value === 'recalled' && !recallEffectiveDate.value) return 'Enter the Recall Effective Date first.'
  if (reasonOverridden.value && !reasonOverrideReason.value.trim()) return 'Enter a reason for overriding the suggested reason.'
  if (modeOverridden.value && !modeOverrideReason.value.trim()) return 'Enter a reason for overriding the auto-derived mode.'
  if (endorsementRequired.value && (!authorizingEndorsement.value.trim() || !authorizingEndorsementDate.value)) {
    return 'This path carries an approval gate - enter both the Authorizing Endorsement and its Recorded Date first.'
  }
  if (endorsementAfterSeparation.value) return 'Endorsement Recorded Date must be before the Separation Date.'
  return 'Create Retrieval Ticket'
})

function submit() {
  if (!canSubmit.value || !selectedEmployee.value || !reason.value || !mode.value) return
  const ticket = createTicket(
    selectedEmployee.value, reason.value, mode.value, lwd.value, sep.value,
    authorizingEndorsement.value, authorizingEndorsementDate.value, undefined,
    assetTeamMemberByName(assigneeName.value),
    reasonOverridden.value ? reasonOverrideReason.value.trim() : undefined,
    modeOverridden.value ? modeOverrideReason.value.trim() : undefined,
    reason.value === 'recalled' ? recallEffectiveDate.value : undefined
  )
  flushTicketsToStorage()
  navigateTo(`/ticket-tracker/${ticket.ticketNumber}`)
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="bg-gray-50 min-h-[calc(100vh-4rem)]">
    <div class="sticky top-16 z-10 bg-white px-6 pt-4 pb-3 border-b border-default">
      <div class="flex items-center gap-1.5">
        <UTooltip text="Back to Ticket Tracker">
          <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-arrow-left" class="text-muted shrink-0" aria-label="Back to Ticket Tracker" to="/ticket-tracker" />
        </UTooltip>
        <h1 class="text-lg font-semibold text-highlighted">Create Retrieval Ticket</h1>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-6 py-6">
      <!-- Team member - always on screen, never swapped away for the rest of the form -->
      <div class="mb-2">
        <label class="text-xs text-muted mb-1.5 block">Find Team Member <span class="text-red-600">*</span></label>
        <UInputMenu
          v-model="employeeQuery"
          :items="employeeOptions"
          option-attribute="label"
          placeholder="Type a name or employee ID..."
          icon="i-lucide-search"
          size="lg"
          class="w-full"
          @update:model-value="(v) => typeof v === 'object' && v && selectEmployee(v as unknown as HrisRecord)"
        >
          <template #item-label="{ item }">
            <div class="flex flex-col">
              <span class="text-sm font-medium">{{ item.name }}</span>
              <span class="text-xs text-muted">{{ item.id }} &middot; {{ item.dept }}</span>
            </div>
          </template>
        </UInputMenu>

        <!-- Compact inline "fetched" summary - a strip under the search box, not a separate step -->
        <div v-if="selectedEmployee" class="mt-2 flex items-center gap-2.5 rounded-lg border border-default bg-primary/5 px-3 py-2">
          <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-primary/10 text-primary size-8 text-xs font-semibold">{{ initials(selectedEmployee.name) }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-highlighted truncate">{{ selectedEmployee.name }}</div>
            <div class="text-xs text-muted truncate">{{ selectedEmployee.dept }} &middot; {{ selectedEmployee.email }} &middot; {{ selectedEmployee.caseType }}</div>
          </div>
          <button type="button" class="text-xs font-semibold text-primary shrink-0" @click="selectEmployee(null); employeeQuery = ''">Change</button>
        </div>
        <p v-else class="text-xs text-muted mt-1.5">Type a name or employee ID. Department, contact details, address and offboarding dates fill in on their own.</p>

        <!-- Duplicate guardrail: a second open ticket for the same person is blocked outright. -->
        <SharedBanner v-if="duplicateTicket" tone="danger" role="alert" class="mt-3" :title="`${selectedEmployee!.name} already has an open retrieval ticket`">
          Only one retrieval can be open per team member, so a new ticket cannot be created yet.
          <template #body>
            <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              <div><dt class="text-xs text-muted">Ticket</dt><dd class="text-sm font-medium text-default">#{{ duplicateTicket.ticketNumber }}</dd></div>
              <div><dt class="text-xs text-muted">Status</dt><dd class="text-sm font-medium text-default">{{ ticketStatusLabel(duplicateTicket) }}</dd></div>
              <div><dt class="text-xs text-muted">Reason</dt><dd class="text-sm font-medium text-default">{{ REASON_LABELS[duplicateTicket.reason] }}</dd></div>
              <div><dt class="text-xs text-muted">Assigned to</dt><dd class="text-sm font-medium text-default">{{ duplicateTicket.assignee.name }}</dd></div>
            </dl>
            <div class="mt-4">
              <UButton :to="`/ticket-tracker/${duplicateTicket.ticketNumber}`" size="sm" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-up-right">Open ticket #{{ duplicateTicket.ticketNumber }}</UButton>
              <p class="text-xs text-muted mt-2">To start a new one, close or cancel that ticket first.</p>
            </div>
          </template>
        </SharedBanner>
      </div>

      <!-- Reason/Mode/Dates - always present, just inert until a team member is picked -->
      <fieldset :disabled="!selectedEmployee" class="flex flex-col gap-6 mt-5 pt-5 border-t border-default transition-opacity" :class="{ 'opacity-40 pointer-events-none select-none': !selectedEmployee }">
        <div>
          <label class="text-xs text-muted mb-1.5 block">Reason <span class="text-red-600">*</span></label>
          <USelect
            v-model="reason"
            :items="Object.entries(REASON_LABELS).map(([value, label]) => ({ label, value }))"
            placeholder="Select a reason..."
            size="lg"
            class="w-full"
            @update:model-value="onReasonChange"
          />
          <p v-if="selectedEmployee && reason" class="text-xs text-primary font-semibold mt-1">Pre-filled from the offboarding case. Confirm or change.</p>
        </div>

        <SharedOverrideNote
          v-if="reasonOverridden && selectedEmployee"
          v-model="reasonOverrideReason"
          title="Why are you changing the reason?"
          :context="`The offboarding case says ${REASON_LABELS[selectedEmployee.suggestedReason]}. You chose ${reason ? REASON_LABELS[reason] : ''}.`"
          placeholder="For example, the contract was ended early by the client"
        />

        <div>
          <label class="text-xs text-muted mb-1.5 block">Mode <span class="text-red-600">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            <UTooltip :text="p12Blocked ? 'Unexplained Absence must be Remote' : 'Onsite'">
              <button
                type="button"
                class="w-full rounded-md border px-4 py-2.5 text-sm font-medium transition-colors"
                :class="mode === 'onsite' ? 'border-primary bg-primary/10 text-primary font-semibold' : p12Blocked ? 'border-default bg-gray-50 text-muted cursor-not-allowed' : 'border-default text-default'"
                @click="guardedClick(!p12Blocked, 'Unexplained Absence must be Remote.', () => { mode = 'onsite'; modeOverrideReason = mode !== modeAutoFilled ? modeOverrideReason : '' })"
              >
                Onsite
              </button>
            </UTooltip>
            <button
              type="button"
              class="rounded-md border px-4 py-2.5 text-sm font-medium transition-colors"
              :class="mode === 'remote' ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-default text-default'"
              @click="mode = 'remote'"
            >
              Remote
            </button>
          </div>
          <p v-if="selectedEmployee && !p12Blocked" class="text-xs text-primary font-semibold mt-1.5">Set from the address on file.</p>
        </div>

        <SharedOverrideNote
          v-if="modeOverridden"
          v-model="modeOverrideReason"
          title="Why are you changing the mode?"
          :context="`The address on file points to ${modeAutoFilled === 'onsite' ? 'Onsite' : 'Remote'}. You chose ${mode === 'onsite' ? 'Onsite' : 'Remote'}.`"
          placeholder="For example, the team member has relocated"
        />

        <!-- Endorsement fields moved above the two dates they gate, so the
             artifact that authorizes this ticket is entered before the dates
             it constrains - reads in the order an operator would naturally
             reason about them, and matches where endorsementAfterSeparation/
             endorsementMaxDate below actually take effect. -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-muted mb-1.5 block">Authorizing Endorsement <span v-if="endorsementRequired" class="text-red-600">*</span></label>
            <UInput v-model="authorizingEndorsement" placeholder="e.g. P&C-END-2026-0417" size="lg" class="w-full" />
          </div>
          <div>
            <label class="text-xs text-muted mb-1.5 block">Endorsement Recorded Date <span v-if="endorsementRequired" class="text-red-600">*</span></label>
            <!-- `max` stops the picker offering the Separation Date or anything after it: the endorsement must come first. -->
            <SharedDatePicker v-model="authorizingEndorsementDate" size="lg" :max="endorsementMaxDate" />
            <p v-if="endorsementAfterSeparation" class="text-xs text-red-600 mt-1">Must be before the Separation Date.</p>
            <p v-else class="text-xs text-muted mt-1">The date the Asset Team received it.</p>
          </div>
        </div>

        <!-- Last Working Day and Separation Date come from the employee record
             (R24 sync), so they are shown, not typed. -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="lwd-synced" class="text-xs text-muted mb-1.5 block">Last Working Day</label>
            <UInput id="lwd-synced" :model-value="lwd ? fmtIso(lwd) : ''" disabled icon="i-lucide-calendar" size="lg" class="w-full" placeholder="Fills in once you pick a team member" />
            <p class="text-xs text-muted mt-1">Synced from the employee record. Drives the return clock and IT lock.</p>
          </div>
          <div>
            <label for="sep-synced" class="text-xs text-muted mb-1.5 block">Separation Date</label>
            <UInput id="sep-synced" :model-value="sep ? fmtIso(sep) : ''" disabled icon="i-lucide-calendar" size="lg" class="w-full" placeholder="Fills in once you pick a team member" />
            <p class="text-xs text-muted mt-1">Synced from the employee record. Drives clearance and final pay.</p>
          </div>
        </div>

        <!-- FR-003.2: the Recalled paths anchor their clock on the Recall Effective Date. -->
        <div v-if="reason === 'recalled'">
          <label class="text-xs text-muted mb-1.5 block">Recall Effective Date <span class="text-red-600">*</span></label>
          <SharedDatePicker v-model="recallEffectiveDate" size="lg" />
          <p class="text-xs text-muted mt-1">The date the recall takes effect. The return clock starts from it.</p>
        </div>

        <div>
          <label class="text-xs text-muted mb-1.5 block">Assignee</label>
          <USelect v-model="assigneeName" :items="assigneeOptions" size="lg" class="w-full" />
          <p class="text-xs text-muted mt-1">The Asset Team member responsible for this ticket. Defaults to you.</p>
        </div>

        <div v-if="resolvedPath || matrixEntry" class="rounded-lg border border-default bg-white p-4">
          <div v-if="resolvedPath" class="flex flex-col gap-1 text-sm">
            <div class="flex justify-between py-1 border-b border-default"><span class="text-muted font-medium">Deadline counted from</span><span class="font-semibold">{{ resolvedPath.anchor }}</span></div>
            <div class="flex justify-between items-center py-1 border-b border-default">
              <span class="text-muted font-medium">Deadline</span>
              <span class="flex items-center gap-1.5">
                <span v-if="computedDeadline" class="font-semibold">{{ computedDeadline }}</span>
                <span v-else class="text-muted">Enter the dates above</span>
                <UTooltip :text="resolvedPath.deadline">
                  <button type="button" class="inline-flex text-muted hover:text-default" aria-label="How the deadline is set">
                    <UIcon name="i-lucide-info" class="size-4" />
                  </button>
                </UTooltip>
              </span>
            </div>
            <div class="flex justify-between py-1 border-b border-default"><span class="text-muted font-medium">Notice sent by</span><span class="font-semibold">{{ resolvedPath.sender }}</span></div>
            <div class="flex justify-between py-1"><span class="text-muted font-medium">Notice email</span><span class="font-semibold">{{ templateForKey(resolvedPath.templateKey)?.name ?? resolvedPath.templateKey }}</span></div>
          </div>
          <div v-else class="text-sm text-muted">Not available yet. Pending a separate flow definition.</div>

          <!-- Matches the ticket workspace's own P&C Acknowledgement card
               (see [id].vue) - same naming, same "Optional" badge instead of
               "Approval gate" framing, same no-fill white card, since this
               is a preview of that same real thing, not a separate concept. -->
          <div v-if="matrixEntry && matrixEntry.gateCount > 0" class="mt-3 flex gap-2 items-start bg-white border border-default rounded-md p-4">
            <UIcon name="i-lucide-shield" class="size-4 text-muted shrink-0 mt-0.5" />
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-semibold text-default">P&amp;C Acknowledgement</span>
                <UBadge color="neutral" variant="outline" size="sm">Optional</UBadge>
              </div>
              <div class="text-xs text-muted mt-0.5">A P&amp;C compliance record. Doesn't block this ticket's stages or sends.</div>
            </div>
          </div>
        </div>
      </fieldset>

      <div class="flex gap-2 mt-6">
        <UTooltip :text="canSubmitReason">
          <UButton color="primary" size="lg" :class="{ 'opacity-50 cursor-not-allowed hover:opacity-50': !canSubmit }" @click="guardedClick(canSubmit, canSubmitReason, submit)">Create Retrieval Ticket</UButton>
        </UTooltip>
        <UButton color="neutral" variant="outline" size="lg" to="/ticket-tracker">Cancel</UButton>
      </div>
    </div>
  </div>
</template>
