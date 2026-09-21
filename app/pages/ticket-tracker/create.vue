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
import { HRIS_DIRECTORY, MATRIX, REASON_LABELS, resolvedPathFor, isP12, createTicket, findOpenDuplicate } from '~/data/ticketTrackers'

useSeoMeta({ title: 'AMS · Create Ticket Tracker' })

const selectedEmployee = ref<HrisRecord | null>(null)
const employeeQuery = ref('')

const employeeOptions = computed(() => HRIS_DIRECTORY.map(e => ({ ...e, label: e.name })))

function selectEmployee(emp: HrisRecord | null) {
  selectedEmployee.value = emp
  if (!emp) return
  reason.value = emp.suggestedReason
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
const lwd = ref('')
const sep = ref('')
const authorizingEndorsement = ref('')

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

// Guardrail: block creating a second ticket for a team member who already
// has one open. This is a business-critical duplicate to catch, not just a
// convenience warning - two open retrieval tickets for the same person
// means two parallel notices, two deadlines, two closures for one set of
// equipment.
const duplicateTicket = computed(() => selectedEmployee.value ? findOpenDuplicate(selectedEmployee.value.id) : undefined)

const canSubmit = computed(() =>
  !!selectedEmployee.value && !!reason.value && !!mode.value && !!lwd.value && !!sep.value
  && !duplicateTicket.value
  && (!modeOverridden.value || modeOverrideReason.value.trim().length > 0)
)

function submit() {
  if (!canSubmit.value || !selectedEmployee.value || !reason.value || !mode.value) return
  const ticket = createTicket(selectedEmployee.value, reason.value, mode.value, lwd.value, sep.value, authorizingEndorsement.value)
  navigateTo(`/ticket-tracker/${ticket.id}`)
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
        <h1 class="text-lg font-semibold text-highlighted">Create Ticket Tracker: Retrieval</h1>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-6 py-6">
      <!-- Team member - always on screen, never swapped away for the rest of the form -->
      <div class="mb-2">
        <label class="text-xs font-semibold text-gray-700 mb-1.5 block">Find Team Member (from HRIS) <span class="text-red-600">*</span></label>
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
        <p v-else class="text-xs text-dimmed mt-1.5">Start typing to search HRIS - results come straight from HRIS (department, contact info, on-file address, offboarding dates).</p>

        <!-- Duplicate guardrail - blocks a second open ticket for the same team member outright, not just a soft warning -->
        <div v-if="duplicateTicket" class="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <UIcon name="i-lucide-triangle-alert" class="size-4 text-red-600 shrink-0 mt-0.5" />
          <div class="text-sm text-red-700">
            <span class="font-semibold">{{ selectedEmployee!.name }} already has an open retrieval ticket.</span>
            Ticket {{ duplicateTicket.ticketNumber }}, created {{ duplicateTicket.createdAt }}. A team member can only have one open retrieval ticket at a time.
            <NuxtLink :to="`/ticket-tracker/${duplicateTicket.id}`" class="font-semibold underline">View that ticket</NuxtLink>
          </div>
        </div>
      </div>

      <!-- Reason/Mode/Dates - always present, just inert until a team member is picked -->
      <fieldset :disabled="!selectedEmployee" class="flex flex-col gap-4 mt-5 pt-5 border-t border-default transition-opacity" :class="{ 'opacity-40 pointer-events-none select-none': !selectedEmployee }">
        <div>
          <label class="text-xs font-semibold text-gray-700 mb-1.5 block">Reason <span class="text-red-600">*</span></label>
          <USelect
            v-model="reason"
            :items="Object.entries(REASON_LABELS).map(([value, label]) => ({ label, value }))"
            placeholder="Select a reason..."
            size="lg"
            class="w-full"
            @update:model-value="onReasonChange"
          />
          <p class="text-xs text-primary font-semibold mt-1">Pre-filled from HRIS's offboarding case. Confirm or change.</p>
        </div>

        <div>
          <label class="text-xs font-semibold text-gray-700 mb-1.5 block">Mode <span class="text-red-600">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-md border px-3 py-2.5 text-sm font-medium transition-colors"
              :class="mode === 'onsite' ? 'border-primary bg-primary/10 text-primary font-semibold' : p12Blocked ? 'border-default bg-gray-50 text-dimmed cursor-not-allowed' : 'border-default text-gray-700'"
              :disabled="p12Blocked"
              @click="mode = 'onsite'; modeOverrideReason = mode !== modeAutoFilled ? modeOverrideReason : ''"
            >
              Onsite
            </button>
            <button
              type="button"
              class="rounded-md border px-3 py-2.5 text-sm font-medium transition-colors"
              :class="mode === 'remote' ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-default text-gray-700'"
              @click="mode = 'remote'"
            >
              Remote
            </button>
          </div>
          <p v-if="p12Blocked" class="text-xs text-red-600 mt-1.5">Not available. Unexplained Absence must be Remote.</p>
          <p v-else class="text-xs text-primary font-semibold mt-1.5">Auto-derived from HRIS on-file address.</p>
        </div>

        <div v-if="modeOverridden" class="border-l-2 border-amber-400 bg-amber-50 rounded-r-md p-3">
          <label class="text-xs font-semibold text-gray-700 mb-1 block">Reason for Mode override <span class="text-red-600">*</span></label>
          <UTextarea v-model="modeOverrideReason" :rows="2" class="w-full" placeholder="Explain why Mode was changed from HRIS's on-file address..." />
          <p class="text-xs text-dimmed mt-1">Recorded on the ticket.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold text-gray-700 mb-1.5 block">Last Working Day <span class="text-red-600">*</span></label>
            <UInput v-model="lwd" type="date" size="lg" class="w-full" />
            <p class="text-xs text-dimmed mt-1">Drives the return clock and IT lock.</p>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-700 mb-1.5 block">Separation Date <span class="text-red-600">*</span></label>
            <UInput v-model="sep" type="date" size="lg" class="w-full" />
            <p class="text-xs text-dimmed mt-1">Drives clearance and final pay computation.</p>
          </div>
        </div>

        <div>
          <label class="text-xs font-semibold text-gray-700 mb-1.5 block">Authorizing Endorsement</label>
          <UInput v-model="authorizingEndorsement" placeholder="e.g. P&C-END-2026-0417" size="lg" class="w-full" />
        </div>

        <div v-if="resolvedPath || matrixEntry" class="rounded-lg border border-default bg-gray-50 p-4">
          <div v-if="resolvedPath" class="flex flex-col gap-1 text-sm">
            <div class="flex justify-between py-1 border-b border-default"><span class="text-muted font-medium">Day-0 Anchor</span><span class="font-semibold">{{ resolvedPath.anchor }}</span></div>
            <div class="flex justify-between py-1 border-b border-default"><span class="text-muted font-medium">Deadline</span><span class="font-semibold">{{ resolvedPath.deadline }}</span></div>
            <div class="flex justify-between py-1 border-b border-default"><span class="text-muted font-medium">Notice Sender</span><span class="font-semibold">{{ resolvedPath.sender }}</span></div>
            <div class="flex justify-between py-1"><span class="text-muted font-medium">Template</span><span class="font-semibold">{{ resolvedPath.templateKey.toUpperCase() }}</span></div>
          </div>
          <div v-else class="text-sm text-muted">Not available yet. Pending a separate flow definition.</div>

          <div v-if="matrixEntry && matrixEntry.gateCount > 0" class="mt-3 flex gap-2 items-start bg-red-50 border border-red-200 rounded-md p-3">
            <UIcon name="i-lucide-lock" class="size-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div class="text-xs font-bold uppercase text-red-600">Requires: {{ matrixEntry.gateCount === 1 ? matrixEntry.gateName : `${matrixEntry.gateCount} sequential P&C gates` }}</div>
              <div class="text-xs text-red-700 mt-0.5">Team-member-facing sends blocked until recorded.</div>
            </div>
          </div>
        </div>
      </fieldset>

      <div class="flex gap-2 mt-6">
        <UButton color="primary" size="lg" :disabled="!canSubmit" @click="submit">Create Ticket Tracker</UButton>
        <UButton color="neutral" variant="outline" size="lg" to="/ticket-tracker">Cancel</UButton>
      </div>
    </div>
  </div>
</template>
