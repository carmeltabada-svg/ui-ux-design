<script setup lang="ts">
// Retrieval Workspace - the main ticket surface. Ports the prototype's stage
// engine (renderStage()/STAGE_CONTENT) onto a real per-ticket record (see
// ~/data/ticketTrackers), rendering interactive panels per STAGE_META.kind
// instead of one giant innerHTML switch. Sends (A6/B9/A8) resolve to the
// REAL TEMPLATE_RUNTIME content and the real Equipment Return Acknowledgment
// form via EmailAttachSection, in place of the prototype's mocked arrays.
import {
  TICKETS, GATE_STEPS, PHASE_LABELS, STAGE_PHASE, STAGE_NAMES, STAGE_META,
  STAGES_ONSITE, STAGES_REMOTE, SKIP_STAGES, OFFBOARDING_CHECKLIST_ITEMS,
  REASON_LABELS, REMINDER_TEMPLATES, COURIER_ENDORSEMENT_TEMPLATE_KEY,
  COURIER_PROVIDERS, courierProviderById, confirmCourierBranch, confirmItLockScheduling, confirmItLockExecution,
  branchCaptureUrgent, confirmInTransit as confirmInTransitStage, issueGatePass,
  currentStageKey, advanceStage, confirmAssets, releaseGate, pushHistory, goBackStage, verifyContact,
  sendsBlocked, safekeepingAvailable, resolvedPathFor, templateForKey, attachedFormFor, phasesFor,
  type StageKey, type PhaseKey, type GatePassAssetLine
} from '~/data/ticketTrackers'
import { RETRIEVAL_FORMS } from '~/data/retrievalForms'
import { TEMPLATES, TEMPLATE_GROUPS, SAMPLE_VALUES, resolveTokensForPrint } from '~/data/templates'
import { ensureTemplateRuntime } from '~/data/templateRuntime'

const route = useRoute()
const toast = useToast()

const ticket = computed(() => TICKETS[route.params.id as string])

useSeoMeta({ title: () => ticket.value ? `AMS · ${ticket.value.employee.name} (Retrieval)` : 'AMS · Ticket not found' })

const stageKey = computed<StageKey | null>(() => ticket.value ? currentStageKey(ticket.value) : null)
const meta = computed(() => stageKey.value ? STAGE_META[stageKey.value] : undefined)
const resolvedPath = computed(() => ticket.value ? resolvedPathFor(ticket.value.reason, ticket.value.mode) : null)

const blocked = computed(() => {
  if (!ticket.value || !stageKey.value) return false
  return ['A6', 'B9', 'A8', 'A9'].includes(stageKey.value) && sendsBlocked(ticket.value)
})
const t19Available = computed(() => !!ticket.value && stageKey.value === 'A6' && safekeepingAvailable(ticket.value))

function fmtDate(iso: string | null) {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// --- Phase tracker -----------------------------------------------------
// Only the phases that actually exist on this ticket's mode - Branch &
// Endorsement and Transit are remote-only (B8/B9/B11/B11a), so an onsite
// ticket must not show a node for them at all (it previously did, with an
// empty hover popover behind it since no onsite stage lives in that phase).
const applicablePhases = computed(() => phasesFor(ticket.value?.mode ?? 'onsite'))
const currentPhase = computed<PhaseKey | null>(() => stageKey.value ? STAGE_PHASE[stageKey.value] : (ticket.value?.status === 'closed' ? 'closure' : null))
const phaseNodes = computed(() => {
  const order = applicablePhases.value
  const cur = currentPhase.value
  const curIdx = cur ? order.indexOf(cur) : order.length
  return order.map((p, i) => ({
    key: p,
    label: PHASE_LABELS[p],
    state: ticket.value?.overdueForced && p === 'return' ? 'blocked' : i < curIdx ? 'done' : i === curIdx ? 'current' : 'future'
  }))
})

// Each phase node's own hover popover - the real child steps inside that
// phase, with a purely visual done/current/future cue (a dot, no text
// label) rather than restating "done"/"current" in words for every row.
function childStepsFor(phaseKey: PhaseKey) {
  if (!ticket.value) return []
  const modeList = ticket.value.mode === 'remote' ? STAGES_REMOTE : STAGES_ONSITE
  const steps = modeList.filter(s => STAGE_PHASE[s] === phaseKey && !SKIP_STAGES.includes(s))
  const curKey = stageKey.value
  const curIdx = curKey ? modeList.indexOf(curKey) : modeList.length
  return steps.map(s => ({
    key: s,
    label: STAGE_NAMES[s],
    dotState: modeList.indexOf(s) < curIdx || ticket.value!.status === 'closed' ? 'done' : modeList.indexOf(s) === curIdx ? 'current' : 'future'
  }))
}

// --- Gate banner ---------------------------------------------------------
// A gate release is a compliance checkpoint, so it always requires a
// documentation note (the endorsement reference, email subject, case
// number) rather than being a bare confirm click - see releaseGate() in the
// data layer. gateNoteDrafts holds the in-progress text per gate number
// until the operator actually records it.
const gateNoteDrafts = reactive<Record<number, string>>({})
function recordGate(n: number) {
  if (!ticket.value) return
  const note = (gateNoteDrafts[n] ?? '').trim()
  if (!note) return
  releaseGate(ticket.value, n, note)
  gateNoteDrafts[n] = ''
}

// --- Back navigation - lets an operator undo an accidental or premature
// advance. Never shown on the very first actionable step (A3), since
// stepping back from there would just land on the already-logged A1/A2
// entries and resolve straight back to A3 anyway - a visible no-op.
const canGoBack = computed(() => !!stageKey.value && stageKey.value !== 'A3')
function goBack() {
  if (!ticket.value) return
  goBackStage(ticket.value)
}

// --- A3 Offboarding Checklist -----------------------------------------
const checklistItems = OFFBOARDING_CHECKLIST_ITEMS
const checklistComplete = computed(() => !!ticket.value && ticket.value.checklistDone.every(Boolean))
function toggleChecklistItem(i: number, checked: boolean) {
  if (!ticket.value) return
  ticket.value.checklistDone[i] = checked
}

// --- B11/A12 - simple advance actions ----------------------------------
function simpleAdvance(action: string) {
  if (!ticket.value) return
  pushHistory(ticket.value, action)
  advanceStage(ticket.value)
}

// --- A4 IT lock scheduling - two distinct confirmations (FR-003.6): the
// lock is scheduled first (opens the Lock record), then separately
// confirmed as actually executed (closes it) - not one bare click. -------
function doConfirmItLockScheduling() {
  if (!ticket.value) return
  confirmItLockScheduling(ticket.value)
}
function doConfirmItLockExecution() {
  if (!ticket.value) return
  confirmItLockExecution(ticket.value)
}

// --- Custodian contact verification (explicit operator confirmation,
// separate from the A7 call-confirmation auto-verify path) ---------------
function onVerifyContact(field: 'number' | 'email') {
  if (!ticket.value) return
  verifyContact(ticket.value, field)
}

// --- A5 Asset Confirmation ------------------------------------------------
function toggleAsset(i: number, checked: boolean) {
  if (!ticket.value) return
  ticket.value.assets[i]!.checked = checked
}
function doConfirmAssets() {
  if (!ticket.value) return
  confirmAssets(ticket.value)
}

// --- A6/B9 template send ---------------------------------------------------
const sendTemplateKey = computed(() => {
  if (!ticket.value || !stageKey.value) return null
  if (stageKey.value === 'B9') return COURIER_ENDORSEMENT_TEMPLATE_KEY
  return resolvedPath.value?.templateKey ?? null
})
const attachedForm = computed(() => ticket.value ? attachedFormFor(ticket.value.mode) : null)
const useManualEmail = ref(false)
const manualEmail = ref('')

// Browse Active templates/forms instead of always sending whatever
// auto-resolved - an operator can pick a different one without leaving this
// page. Draft/Retired templates and forms never show up here: only what's
// actually live is safe to send. Resets whenever the stage (or which
// reminder we're on) changes, so a leftover pick from a previous send never
// silently carries into the next one.
const overrideTemplateKey = ref<string | null>(null)
const overrideFormId = ref<string | null>(null)
watch([stageKey, () => ticket.value?.reminderCount], () => { overrideTemplateKey.value = null; overrideFormId.value = null })

const activeTemplateOptions = computed(() => {
  const mode = ticket.value?.mode
  const seen = new Set<string>()
  return TEMPLATE_GROUPS.flatMap(g => g.keys)
    .filter(key => TEMPLATES[key] && !seen.has(key) && seen.add(key))
    .map(key => ({ key, rt: ensureTemplateRuntime(key) }))
    .filter(({ rt }) => rt.status === 'active' && (!mode || rt.mode === mode))
    .map(({ key, rt }) => ({ label: rt.name, value: key }))
})
const activeFormOptions = computed(() => RETRIEVAL_FORMS.filter(f => f.status === 'active').map(f => ({ label: f.name, value: f.id })))

const effectiveTemplateKey = computed(() => overrideTemplateKey.value ?? sendTemplateKey.value)
const effectiveTemplate = computed(() => effectiveTemplateKey.value ? templateForKey(effectiveTemplateKey.value) : null)

// --- Email content preview - reuses the same FullPreviewModal a template's
// own version history already previews with (real prose-styled rendering,
// not a cramped inline snippet), filled with this ticket's own real data
// instead of generic samples wherever a real value is on hand. Shared by
// every stage that sends a template (A6/B9/A8).
const ticketSampleValues = computed<Record<string, string>>(() => {
  if (!ticket.value) return SAMPLE_VALUES
  const t = ticket.value
  const asset = t.assets[0]
  const courier = courierProviderById(t.courierProviderId)
  return {
    ...SAMPLE_VALUES,
    TM_FULL_NAME: t.employee.name,
    TM_FIRST_NAME: t.employee.name.split(' ')[0] ?? t.employee.name,
    EMPLOYEE_ID: t.employee.id,
    TM_EMAIL: t.employee.email,
    TM_CONTACT_NUMBER: t.contact.number || SAMPLE_VALUES.TM_CONTACT_NUMBER!,
    TM_PRESENT_ADDRESS: t.employee.address,
    CLIENT_NAME: t.employee.client,
    LEADERSHIP_COACH: t.employee.leadershipCoach || SAMPLE_VALUES.LEADERSHIP_COACH!,
    ALTERNATE_CONTACT_NAME: t.contact.altName || SAMPLE_VALUES.ALTERNATE_CONTACT_NAME!,
    ALTERNATE_CONTACT_NUMBER: t.contact.altNumber || SAMPLE_VALUES.ALTERNATE_CONTACT_NUMBER!,
    APR_REF: t.reference,
    TICKET_CREATED_DATE: fmtDate(t.createdAt),
    RETRIEVAL_REASON: REASON_LABELS[t.reason],
    RETURN_MODE: t.mode === 'onsite' ? 'Onsite' : 'Remote',
    TARGET_RETURN_DATE: fmtDate(t.targetDateISO),
    TARGET_DISPATCH_DATE: fmtDate(t.targetDateISO),
    LAST_WORKING_DAY: fmtDate(t.lwd),
    SEPARATION_DATE: fmtDate(t.sep),
    ASSET_NAME: asset?.name ?? SAMPLE_VALUES.ASSET_NAME!,
    SERIAL_NUMBER: asset?.serial ?? SAMPLE_VALUES.SERIAL_NUMBER!,
    ASSET_QTY: String(t.assets.length),
    COURIER_NAME: courier?.name ?? SAMPLE_VALUES.COURIER_NAME!,
    ACCOUNT_MANAGER_NAME: courier?.accountManager ?? SAMPLE_VALUES.ACCOUNT_MANAGER_NAME!,
    ACCOUNT_MANAGER_EMAIL: courier?.accountManagerEmail ?? SAMPLE_VALUES.ACCOUNT_MANAGER_EMAIL!,
    BRANCH_NAME: t.courierBranchName || SAMPLE_VALUES.BRANCH_NAME!,
    BRANCH_ADDRESS: t.courierBranchAddress || SAMPLE_VALUES.BRANCH_ADDRESS!
  }
})
const previewOpen = ref(false)
const previewSubject = ref('')
const previewBody = ref('')
function openTemplatePreview(tpl: { subject: string, body: string } | null | undefined) {
  if (!tpl) return
  previewSubject.value = resolveTokensForPrint(tpl.subject, ticketSampleValues.value)
  previewBody.value = resolveTokensForPrint(tpl.body, ticketSampleValues.value)
  previewOpen.value = true
}

// --- B8 Branch confirmation capture (remote only) - browses the same
// Courier Providers list as Master Data, auto-selecting the recommended
// provider but letting the operator pick an alternate (FR-003.9). Branch
// name and branch address are two distinct fields per FR-003.9(a), not one
// freeform line. -----------------------------------------------------
const courierOptions = computed(() => COURIER_PROVIDERS.filter(p => p.status === 'active').map(p => ({ label: `${p.name} (${p.priority === 'recommended' ? 'Recommended' : 'Alternate'})`, value: p.id })))
const selectedCourierId = computed({
  get: () => ticket.value?.courierProviderId ?? null,
  set: (v: string | null) => { if (ticket.value && v) ticket.value.courierProviderId = v }
})
const selectedCourier = computed(() => courierProviderById(selectedCourierId.value))
const branchNameDraft = ref('')
const branchAddressDraft = ref('')
const branchSubstituted = ref(false)
// FR-003.9(b): the confirmation call is the primary capture mechanism, the
// email reply is the fallback - recorded explicitly, not assumed.
const branchCaptureMethod = ref<'call' | 'email'>('call')
// FR-003.9(e): flag once the LWD is close and the branch still isn't captured.
const branchUrgent = computed(() => !!ticket.value && branchCaptureUrgent(ticket.value))
// FR-003.9(f): on non-response, the operator may substitute the branch
// nearest the address on file and proceed, with the substitution recorded.
function useAddressOnFile() {
  if (!ticket.value) return
  branchAddressDraft.value = ticket.value.employee.address
  if (!branchNameDraft.value.trim()) branchNameDraft.value = `${selectedCourier.value?.name ?? 'Courier'} - nearest branch`
  branchSubstituted.value = true
}
function doConfirmBranch() {
  if (!ticket.value || !selectedCourierId.value || !branchNameDraft.value.trim() || !branchAddressDraft.value.trim()) return
  confirmCourierBranch(ticket.value, selectedCourierId.value, branchNameDraft.value.trim(), branchAddressDraft.value.trim(), branchCaptureMethod.value, branchSubstituted.value)
  branchNameDraft.value = ''
  branchAddressDraft.value = ''
  branchSubstituted.value = false
  branchCaptureMethod.value = 'call'
}

// --- B9 courier endorsement recipient - the courier's own corporate
// account manager, not the team member (the team member is the recipient at
// A6/A8, never at B9 - see FR-003.9). ------------------------------------
const courierRecipient = computed(() => ticket.value ? courierProviderById(ticket.value.courierProviderId) : null)
// The resolved "To" address for the Recipients summary - the courier's own
// account manager at B9, the team member (work or personal, per the toggle
// above) everywhere else.
const sendToEmail = computed(() => {
  if (!ticket.value) return ''
  if (stageKey.value === 'B9') return courierRecipient.value?.accountManagerEmail ?? 'Confirm the courier branch first'
  return useManualEmail.value ? (manualEmail.value || 'Enter personal email') : ticket.value.employee.email
})
const effectiveForm = computed(() => {
  if (overrideFormId.value) return RETRIEVAL_FORMS.find(f => f.id === overrideFormId.value) ?? null
  return attachedForm.value
})

function sendNotice() {
  if (!ticket.value || !meta.value) return
  const label = stageKey.value === 'B9' ? 'Courier endorsement sent' : 'Retrieval notice sent (email + SMS)'
  pushHistory(ticket.value, label)
  useManualEmail.value = false
  advanceStage(ticket.value)
}
function sendSafekeeping() {
  if (!ticket.value) return
  pushHistory(ticket.value, 'Equipment Safekeeping Request (T19) sent - no deadline, no consequence')
  toast.add({ title: 'T19 sent', description: 'Equipment Safekeeping Request logged.', icon: 'i-lucide-shield', color: 'info' })
}

// --- A7 Call Confirmation --------------------------------------------------
const callAtCap = computed(() => (ticket.value?.callAttempts.length ?? 0) >= 3)
const callAnsweredYet = computed(() => !!ticket.value?.callAttempts.some(a => a.outcome === 'Answered - confirmed'))
function logCall(outcome: 'No answer' | 'Answered - confirmed') {
  if (!ticket.value) return
  ticket.value.callAttempts.push({ when: 'Just now', outcome })
  if (outcome === 'Answered - confirmed') {
    ticket.value.contact.numberVerified = true
    pushHistory(ticket.value, 'Call attempt logged: answered - contact number confirmed active')
  } else {
    pushHistory(ticket.value, `Call attempt logged: no answer (${ticket.value.callAttempts.length} of 3) - SMS sent after unanswered attempt`)
  }
}
function continueFromCall() {
  if (!ticket.value) return
  if (callAtCap.value && !callAnsweredYet.value) pushHistory(ticket.value, 'Call confirmation attempts exhausted (3 of 3, unanswered) - proceeding')
  ticket.value.callAttempts = []
  advanceStage(ticket.value)
}

// --- A8 Reminders -----------------------------------------------------
const reminderTemplateKey = computed(() => {
  if (!ticket.value) return null
  const stage = ticket.value.reminderCount === 0 ? 'midpoint' : 'final'
  return REMINDER_TEMPLATES[stage][ticket.value.mode]
})
const effectiveReminderTemplateKey = computed(() => overrideTemplateKey.value ?? reminderTemplateKey.value)
const effectiveReminderTemplate = computed(() => effectiveReminderTemplateKey.value ? templateForKey(effectiveReminderTemplateKey.value) : null)
function sendReminder() {
  if (!ticket.value) return
  const label = ticket.value.reminderCount === 0 ? 'Midpoint reminder sent' : 'Final reminder sent'
  pushHistory(ticket.value, label)
  ticket.value.reminderCount = (ticket.value.reminderCount + 1) as 0 | 1 | 2
}
// Skip only the reminder currently in view (mirrors sendReminder's own
// one-step-at-a-time advance) so midpoint and final are each an independent
// send-or-skip decision - skipping midpoint no longer silently skips final
// too, and "Continue" only ever appears once both have actually been
// resolved one way or the other, so it's never ambiguous about whether it
// just sent or skipped something.
function skipReminder() {
  if (!ticket.value) return
  pushHistory(ticket.value, ticket.value.reminderCount === 0 ? 'Midpoint reminder skipped - not needed' : 'Final reminder skipped - not needed')
  ticket.value.reminderCount = (ticket.value.reminderCount + 1) as 0 | 1 | 2
}
function continueFromReminders() {
  if (!ticket.value) return
  ticket.value.reminderCount = 0
  advanceStage(ticket.value)
}

// --- B11 Confirm In Transit - captures the courier's own tracking or
// reference number, halting the Overdue Return countdown (FR-003.9's
// Remote table). Not a bare advance - there's a real field to fill. -------
const trackingRefDraft = ref('')
function doConfirmInTransit() {
  if (!ticket.value || !trackingRefDraft.value.trim()) return
  confirmInTransitStage(ticket.value, trackingRefDraft.value.trim())
  trackingRefDraft.value = ''
}
function confirmPhysicalReceipt() { simpleAdvance('Equipment marked received - proof and condition evidence recorded next') }
function sendOverdueReminder() {
  if (!ticket.value) return
  ticket.value.overdueForced = false
  pushHistory(ticket.value, 'Overdue reminder sent')
}

// --- A10 Evidence -----------------------------------------------------
const proofFile = ref<{ name: string, url: string } | null>(null)
const conditionFile = ref<{ name: string, url: string } | null>(null)
const evidenceError = ref('')

function pickFile(kind: 'proof' | 'condition', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  evidenceError.value = ''
  const maxBytes = 10 * 1024 * 1024
  if (file.size > maxBytes) { evidenceError.value = 'File exceeds 10MB.'; input.value = ''; return }
  const other = kind === 'proof' ? conditionFile.value : proofFile.value
  if (other && other.name === file.name) { evidenceError.value = 'Proof-of-Receipt and Condition Photos cannot share the same filename.'; input.value = ''; return }
  const url = URL.createObjectURL(file)
  if (kind === 'proof') proofFile.value = { name: file.name, url }
  else conditionFile.value = { name: file.name, url }
  input.value = ''
}
function openFile(f: { name: string, url: string } | null) {
  if (f) window.open(f.url, '_blank')
}
function confirmEvidence() {
  if (!ticket.value) return
  pushHistory(ticket.value, 'Proof-of-Receipt + condition photos uploaded - receipt record generated, status moves to Hold Off')
  advanceStage(ticket.value)
}

// --- A11 Deduction ------------------------------------------------------
const atdRef = ref('')
function markNotApplicable() {
  if (!ticket.value) return
  pushHistory(ticket.value, 'Deduction not applicable')
  ticket.value.deductionApplicable = null
  advanceStage(ticket.value)
}
function markDamaged() {
  if (!ticket.value) return
  ticket.value.deductionApplicable = true
  atdRef.value = `ATD-2026-${Math.floor(1000 + Math.random() * 8999)}`
}
function confirmDeduction() {
  if (!ticket.value) return
  pushHistory(ticket.value, `Deduction initiated - ${atdRef.value}`)
  ticket.value.deductionApplicable = null
  advanceStage(ticket.value)
}

// --- A12 -> A13 - a selectable-card choice inline in the flow, not a modal
// (a routing decision is important enough to require deliberately picking a
// destination first, but that's achieved by disabling Confirm until a card
// is chosen - it doesn't need a separate dialog on top of the page it's
// already on). --------------------------------------------------------
const inspectionRouting = ref<'stock' | 'servicing' | 'disposal' | ''>('')
const inspectionRoutingOptions = [
  { value: 'stock', label: 'Back to Stock', description: 'Good condition, returns to available inventory.', icon: 'i-lucide-package-check' },
  { value: 'servicing', label: 'Servicing', description: 'Needs repair or maintenance before reuse.', icon: 'i-lucide-wrench' },
  { value: 'disposal', label: 'Disposal', description: 'Beyond repair or no longer usable.', icon: 'i-lucide-trash-2' }
]
function confirmInspection() {
  if (!ticket.value || !inspectionRouting.value) return
  const routeLabel = { stock: 'Stock', servicing: 'Servicing', disposal: 'Disposal' }[inspectionRouting.value]
  pushHistory(ticket.value, `Inspection completed, routed to ${routeLabel} - inspection record generated`)
  inspectionRouting.value = ''
  advanceStage(ticket.value)
}

// --- A13 Closure ----------------------------------------------------------
const closureOpen = ref(false)
const closureDocumented = ref(false)
const assetResolutions = ref<Record<number, 'returned' | 'charge' | 'open'>>({})

function openClosure() {
  if (!ticket.value) return
  assetResolutions.value = Object.fromEntries(ticket.value.assets.map((a, i) => [i, a.checked ? 'returned' : 'open']))
  closureDocumented.value = false
  closureOpen.value = true
}
function confirmClosure() {
  if (!ticket.value) return
  ticket.value.status = 'closed'
  pushHistory(ticket.value, 'Ticket Closed')
  closureOpen.value = false
  toast.add({ title: 'Ticket closed', icon: 'i-lucide-check-circle', color: 'success' })
}

// --- Custodian card --------------------------------------------------
const showMoreDetails = ref(false)
function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
  toast.add({ title: 'Copied', icon: 'i-lucide-copy', color: 'neutral' })
}

// --- Activity log drawer ----------------------------------------------
const activityOpen = ref(false)

// --- Gate Pass - mirrors the real GoTeam AMS "Issue Gate Pass" form
// (movement, dates, purpose, team member, asset items). This is a
// deliberate operator action with real content to review, never an
// automatic side effect of opening the ticket. Team Member and Asset Items
// are pre-filled from the ticket itself (same person, same confirmed
// assets); Time and Purpose have no ticket-derived source, so those stay
// blank/suggested for the operator to fill in. ---------------------------
const gatePassOpen = ref(false)
const gatePassViewOpen = ref(false)
const gatePassMovement = ref<'checkout' | 'checkin'>('checkin')
const gatePassIssueDate = ref('')
const gatePassTime = ref('')
const gatePassValidUntil = ref('')
const gatePassPurpose = ref('')
const gatePassAssets = ref<GatePassAssetLine[]>([])

function openGatePassModal() {
  if (!ticket.value) return
  const today = new Date().toISOString().slice(0, 10)
  const until = new Date()
  until.setDate(until.getDate() + 7)
  gatePassMovement.value = 'checkin'
  gatePassIssueDate.value = today
  gatePassTime.value = ''
  gatePassValidUntil.value = until.toISOString().slice(0, 10)
  gatePassPurpose.value = `Asset Retrieval - ${REASON_LABELS[ticket.value.reason]}`
  gatePassAssets.value = ticket.value.assets.map(a => ({ assetTag: a.serial, type: a.name, serial: a.serial, remarks: '' }))
  gatePassOpen.value = true
}
function doIssueGatePass() {
  if (!ticket.value || !gatePassIssueDate.value || !gatePassValidUntil.value) return
  const pass = issueGatePass(ticket.value, {
    movement: gatePassMovement.value,
    issueDate: gatePassIssueDate.value,
    time: gatePassTime.value,
    validUntil: gatePassValidUntil.value,
    purpose: gatePassPurpose.value,
    requestedBy: 'D. Reyes',
    assets: gatePassAssets.value
  })
  gatePassOpen.value = false
  toast.add({ title: 'Gate Pass issued', description: pass.ref, icon: 'i-lucide-key-round', color: 'success' })
}
</script>

<template>
  <div v-if="!ticket" class="flex flex-col items-center justify-center gap-3 h-[calc(100vh-4rem)] text-muted">
    <UIcon name="i-lucide-ticket-x" class="size-8" />
    <p>Ticket not found.</p>
    <UButton to="/ticket-tracker" variant="outline">Back to Ticket Tracker</UButton>
  </div>

  <div v-else class="bg-gray-50 min-h-[calc(100vh-4rem)]">
    <!-- Header - sticky at top-16 (right below the app's own sticky top nav,
         see TopNavbar.vue), same technique as the Templates editor and the
         reference Asset Detail Page: the page scrolls normally, but the
         header (and the left rail below, via its own sticky offset) never
         moves once stuck - no scroll-driven layout recalculation needed. -->
    <div class="sticky top-16 z-10 bg-white border-b border-default px-6 pt-4 pb-3">
      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="flex items-start gap-1.5 min-w-0">
          <UTooltip text="Back to Ticket Tracker">
            <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-arrow-left" class="text-muted shrink-0 mt-0.5" aria-label="Back to Ticket Tracker" to="/ticket-tracker" />
          </UTooltip>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg font-semibold text-highlighted truncate">{{ ticket.employee.name }}</h1>
              <span class="font-medium inline-flex items-center text-xs px-1.5 py-0.5 gap-1 rounded-sm bg-primary/10 text-primary shrink-0">Retrieval</span>
            </div>
            <p class="text-sm text-dimmed mt-0.5">
              {{ ticket.ticketNumber }} · {{ REASON_LABELS[ticket.reason] }} · {{ ticket.mode === 'onsite' ? 'Onsite' : 'Remote' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <template v-if="ticket.gatePassRef">
            <UButton color="primary" variant="outline" size="sm" icon="i-lucide-key-round" class="font-mono" @click="gatePassViewOpen = true">
              {{ ticket.gatePassRef }}
            </UButton>
          </template>
          <UButton v-else color="neutral" variant="outline" size="sm" icon="i-lucide-key-round" @click="openGatePassModal">
            Create Gate Pass
          </UButton>
          <UButton
            color="primary"
            size="sm"
            :disabled="stageKey !== 'A13' || ticket.status === 'closed'"
            @click="openClosure"
          >
            Close Ticket
          </UButton>
          <UDropdownMenu :items="[[{ label: 'Copy Ticket Link', icon: 'i-lucide-link', onSelect: () => copyText(window.location.href) }, { label: 'Activity Log', icon: 'i-lucide-history', onSelect: () => { activityOpen = true } }]]">
            <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-ellipsis" />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Phase tracker - each node's info icon reveals its child steps on
           hover, purely as a colored-dot list (no "done"/"current" text
           labels - the dot color alone carries that). -->
      <div class="flex items-start pt-3">
        <div v-for="(node, i) in phaseNodes" :key="node.key" class="flex-1 flex flex-col items-center gap-1.5 relative min-w-0">
          <div v-if="i > 0" class="absolute top-[11px] left-[-50%] w-full h-0.5" :class="node.state === 'done' || phaseNodes[i - 1]?.state === 'done' ? 'bg-[rgb(0,127,69)]' : 'bg-gray-200'" />
          <div
            class="size-[22px] rounded-full flex items-center justify-center text-xs font-bold z-10 shrink-0 border-2"
            :class="{
              'bg-[rgb(0,127,69)] border-[rgb(0,127,69)] text-white': node.state === 'done',
              'bg-primary border-primary text-white ring-[3px] ring-primary/20': node.state === 'current',
              'bg-red-50 border-red-600 text-red-600': node.state === 'blocked',
              'bg-white border-gray-200 text-gray-400': node.state === 'future'
            }"
          >
            <UIcon v-if="node.state === 'done'" name="i-lucide-check" class="size-3.5" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <UPopover mode="hover" :content="{ side: 'bottom', sideOffset: 6 }">
            <button type="button" class="flex items-center gap-1 group/phaselabel">
              <span class="text-xs text-center font-medium leading-tight" :class="node.state === 'future' ? 'text-gray-400' : 'text-gray-700'">{{ node.label }}</span>
              <UIcon name="i-lucide-info" class="size-3 text-gray-300 group-hover/phaselabel:text-primary" />
            </button>
            <template #content>
              <div class="flex flex-col gap-1.5 p-3 min-w-44">
                <div v-for="child in childStepsFor(node.key)" :key="child.key" class="flex items-center gap-2">
                  <span
                    class="size-1.5 rounded-full shrink-0"
                    :class="{
                      'bg-[rgb(0,127,69)]': child.dotState === 'done',
                      'bg-primary ring-2 ring-primary/25': child.dotState === 'current',
                      'bg-gray-300': child.dotState === 'future'
                    }"
                  />
                  <span class="text-xs" :class="child.dotState === 'future' ? 'text-gray-400' : 'text-gray-700'">{{ child.label }}</span>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>

    <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
      <!-- Left rail -->
      <div class="flex flex-col gap-3 lg:sticky lg:top-52">
        <div class="rounded-lg border border-default bg-white p-4">
          <h2 class="text-xs font-semibold uppercase text-gray-500 mb-3">Custodian</h2>
          <div class="flex flex-col gap-2 text-sm">
            <div class="flex justify-between gap-2"><span class="text-gray-500 font-semibold uppercase text-xs">Name</span><span class="font-medium text-right">{{ ticket.employee.name }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-gray-500 font-semibold uppercase text-xs">LWD</span><span class="font-medium text-right">{{ fmtDate(ticket.lwd) }}</span></div>
            <div class="flex justify-between gap-2 items-center">
              <span class="text-gray-500 font-semibold uppercase text-xs">Email</span>
              <span class="font-medium text-right flex items-center gap-1">
                {{ ticket.employee.email }}
                <button type="button" class="text-primary" @click="copyText(ticket.employee.email)"><UIcon name="i-lucide-copy" class="size-3.5" /></button>
              </span>
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-dashed border-default flex flex-col gap-3">
            <div v-if="ticket.contact.number" class="flex flex-col gap-1">
              <span class="text-xs font-semibold uppercase text-gray-400">Contact Number</span>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">{{ ticket.contact.number }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium" :class="ticket.contact.numberVerified ? 'text-[rgb(0,127,69)]' : 'text-amber-700'">
                  {{ ticket.contact.numberVerified ? 'Confirmed active' : 'Not yet confirmed' }}
                </span>
                <UButton v-if="!ticket.contact.numberVerified" size="sm" color="primary" variant="soft" @click="onVerifyContact('number')">Verify</UButton>
              </div>
            </div>
            <div v-if="ticket.contact.email" class="flex flex-col gap-1">
              <span class="text-xs font-semibold uppercase text-gray-400">Personal Email</span>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium truncate">{{ ticket.contact.email }}</span>
                <button type="button" class="text-primary shrink-0" @click="copyText(ticket.contact.email)"><UIcon name="i-lucide-copy" class="size-3.5" /></button>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium" :class="ticket.contact.emailVerified ? 'text-[rgb(0,127,69)]' : 'text-amber-700'">
                  {{ ticket.contact.emailVerified ? 'Confirmed active' : 'Not yet confirmed' }}
                </span>
                <UButton v-if="!ticket.contact.emailVerified" size="sm" color="primary" variant="soft" @click="onVerifyContact('email')">Verify</UButton>
              </div>
            </div>
          </div>

          <button type="button" class="text-primary text-xs font-semibold mt-3" @click="showMoreDetails = !showMoreDetails">
            {{ showMoreDetails ? 'Less details' : 'More details' }}
          </button>
          <div v-if="showMoreDetails" class="mt-2 pt-2 border-t border-dashed border-default flex flex-col gap-1.5 text-sm">
            <div class="flex justify-between gap-2"><span class="text-gray-500">Client</span><span class="font-medium">{{ ticket.employee.client }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-gray-500">Department</span><span class="font-medium">{{ ticket.employee.dept }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-gray-500">Leadership Coach</span><span class="font-medium">{{ ticket.employee.leadershipCoach || 'Not on file' }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-gray-500">Alt. Contact</span><span class="font-medium text-right">{{ ticket.contact.altName ? `${ticket.contact.altName}, ${ticket.contact.altNumber}` : 'Not on file' }}</span></div>
          </div>
        </div>

        <!-- Assets Confirmed - stays visible in this fixed rail once locked, same as the Custodian card above, so both are always at hand no matter which stage the main column is showing. -->
        <div v-if="ticket.assetsLocked" class="rounded-lg border border-default bg-white p-4">
          <h2 class="text-xs font-semibold uppercase text-gray-500 mb-3">Assets Confirmed</h2>
          <div class="flex flex-col gap-1 text-sm">
            <div v-for="a in ticket.assets" :key="a.serial" class="flex justify-between py-1 border-b border-default last:border-0">
              <span class="text-gray-700">{{ a.name }}</span>
              <UIcon v-if="a.checked" name="i-lucide-check" class="size-4 text-[rgb(0,127,69)]" />
              <span v-else class="text-gray-400">Not returned</span>
            </div>
            <div class="flex justify-between pt-2 mt-1 border-t border-default font-semibold">
              <span>{{ ticket.assets.filter(a => a.checked).length }} of {{ ticket.assets.length }} confirmed</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main column -->
      <div class="flex flex-col gap-3 min-w-0">
        <!-- Gate banner - a compliance checkpoint (FR-003.5), so recording one
             always takes a documentation note (who/what authorized it), not
             just a confirm click. Applies to every gated reason (End of
             Contract, Recalled, Unexplained Absence), not only the one
             currently in view. -->
        <div v-if="ticket.gateCount === 0" class="rounded-lg bg-gray-100 text-gray-400 text-sm px-3.5 py-2.5 flex items-center gap-2">
          <UIcon name="i-lucide-unlock" class="size-3.5" /> No approval gate on this path.
        </div>
        <div v-else class="rounded-lg border p-3.5" :class="ticket.gatesReleased >= ticket.gateCount ? 'bg-[rgb(0,127,69)]/5 border-[rgb(0,127,69)]/30' : 'bg-red-50 border-red-200'">
          <div class="text-xs font-bold uppercase" :class="ticket.gatesReleased >= ticket.gateCount ? 'text-[rgb(0,127,69)]' : 'text-red-600'">
            Gate Status: {{ ticket.gatesReleased }} of {{ ticket.gateCount }} released
          </div>
          <div class="flex flex-col gap-1.5 mt-2">
            <div
              v-for="step in GATE_STEPS.slice(0, ticket.gateCount)"
              :key="step.n"
              class="rounded-md px-2.5 py-2 text-sm"
              :class="ticket.gatesReleased >= step.n ? 'bg-[rgb(0,127,69)]/10 text-[rgb(0,127,69)]' : 'bg-white text-gray-500 border border-default'"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="font-semibold">{{ step.label }}</div>
                  <div class="text-xs mt-0.5 opacity-80">Unlocks: {{ step.unlocks }}</div>
                </div>
                <UIcon v-if="ticket.gatesReleased >= step.n" name="i-lucide-check" class="size-4 shrink-0" />
              </div>
              <div v-if="ticket.gatesReleased < step.n && (step.n === 1 || ticket.gatesReleased === step.n - 1)" class="flex gap-2 mt-2">
                <UInput
                  v-model="gateNoteDrafts[step.n]"
                  size="sm"
                  placeholder="Reference this against (endorsement email, case number, etc.)"
                  class="flex-1"
                />
                <UButton size="sm" color="primary" :disabled="!gateNoteDrafts[step.n]?.trim()" @click="recordGate(step.n)">
                  Record
                </UButton>
              </div>
              <div v-if="ticket.gateNotes[step.n]" class="text-xs mt-1.5 opacity-80">Recorded against: {{ ticket.gateNotes[step.n] }}</div>
            </div>
          </div>
        </div>

        <!-- Overdue banner -->
        <div v-if="ticket.overdueForced" class="rounded-lg border border-red-200 bg-red-50 p-4">
          <div class="text-xs font-bold uppercase text-red-600 mb-1">Return and Evidence: Overdue</div>
          <h2 class="text-sm font-semibold text-red-700 mb-1">Send Overdue Reminder or Escalate</h2>
          <p class="text-sm text-red-700 mb-3">
            The Target Date (<strong>{{ fmtDate(ticket.targetDateISO) }}</strong>) passed with equipment still outstanding. This happened automatically, no operator missed a step: the system flips to Overdue Return on its own when the deadline passes with no return recorded.
          </p>
          <UButton color="error" size="sm" @click="sendOverdueReminder">Send Overdue Reminder</UButton>
        </div>

        <!-- What's Next card -->
        <div v-else-if="meta" class="rounded-lg border-2 p-4" :class="blocked ? 'border-default' : 'border-primary'">
          <div class="flex items-center gap-1.5 mb-1">
            <UTooltip v-if="canGoBack && !blocked" text="Back to previous step">
              <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-arrow-left" class="text-muted shrink-0" aria-label="Back to previous step" @click="goBack" />
            </UTooltip>
            <div class="text-xs font-bold uppercase" :class="blocked ? 'text-gray-400' : 'text-primary'">
              {{ PHASE_LABELS[STAGE_PHASE[stageKey!]] }}
            </div>
          </div>
          <h2 class="text-base font-semibold text-highlighted mb-1">{{ meta.title }}</h2>
          <p class="text-sm text-muted mb-3">{{ meta.desc }}</p>
          <p v-if="meta.systemNote" class="text-sm text-gray-500 bg-gray-50 border border-dashed border-default rounded-md px-3 py-2 mb-3">{{ meta.systemNote }}</p>

          <!-- Blocked (gate) -->
          <template v-if="blocked">
            <div v-if="t19Available" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
              The full retrieval instruction still needs Gate 3. Gate 2 has unlocked a limited alternative below.
            </div>
            <div v-else class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
              This is a hard lock, not a warning. Record the required approval gate above to unblock every send to the team member.
            </div>
            <div class="flex gap-2">
              <UButton disabled color="neutral" variant="outline" size="sm">{{ meta.actionLabel }}</UButton>
              <UButton v-if="t19Available" color="primary" size="sm" @click="sendSafekeeping">Send Equipment Safekeeping Request (T19)</UButton>
            </div>
          </template>

          <!-- A3 Offboarding Checklist - real items, not a bare button -->
          <template v-else-if="meta.kind === 'checklist' && stageKey === 'A3'">
            <div class="flex flex-col gap-2 mb-3">
              <label v-for="(item, i) in checklistItems" :key="i" class="flex items-start gap-2 text-sm">
                <UCheckbox :model-value="ticket.checklistDone[i]" class="mt-0.5" @update:model-value="(v) => toggleChecklistItem(i, !!v)" />
                <span>{{ item }}</span>
              </label>
            </div>
            <UButton color="primary" size="sm" :disabled="!checklistComplete" @click="simpleAdvance('Offboarding checklist completed')">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A4 IT lock scheduling - confirmed twice: on scheduling (opens
               the Lock record) and separately on execution (closes it),
               per FR-003.6, not one bare click. -->
          <template v-else-if="meta.kind === 'itlock'">
            <div class="rounded-md border border-default bg-gray-50 p-3 mb-3 flex flex-col gap-1.5 text-sm">
              <div class="flex justify-between"><span class="text-gray-500">Schedule deadline</span><span class="font-semibold text-right">Within 1 business day of the Notice Endorsement</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Executes</span><span class="font-semibold">End of last shift on {{ fmtDate(ticket.lwd) }}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Artifact</span><span class="font-semibold">Lock record</span></div>
            </div>
            <template v-if="!ticket.itLock.scheduledConfirmed">
              <UButton color="primary" size="sm" @click="doConfirmItLockScheduling">Confirm Scheduling</UButton>
            </template>
            <template v-else>
              <div class="rounded-md border border-[rgb(0,127,69)]/30 bg-[rgb(0,127,69)]/5 text-[rgb(0,127,69)] p-3 mb-3 text-sm">
                Lock record opened - scheduled for end of last shift on {{ fmtDate(ticket.itLock.scheduledFor) }}. Awaiting confirmation that it actually executed.
              </div>
              <UButton color="primary" size="sm" @click="doConfirmItLockExecution">Confirm Execution</UButton>
            </template>
          </template>
          <!-- B11 Confirm In Transit - captures the tracking/reference
               number, which is what actually halts the Overdue Return
               countdown, not the click alone. -->
          <template v-else-if="meta.kind === 'transit'">
            <div class="mb-3">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Tracking / Reference Number</label>
              <UInput v-model="trackingRefDraft" placeholder="e.g. JRS-2026-88213904" size="sm" class="w-full" />
            </div>
            <UButton color="primary" size="sm" :disabled="!trackingRefDraft.trim()" @click="doConfirmInTransit">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- B8 Branch confirmation capture - browses the same Courier
               Providers list as Master Data, recommended provider
               auto-selected, an alternate always pickable. -->
          <template v-else-if="meta.kind === 'branch'">
            <p v-if="branchUrgent" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
              The Last Working Day is approaching and the branch is still uncaptured - the courier arrangement must be completed before then.
            </p>
            <div class="mb-3">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Courier Provider</label>
              <USelectMenu
                v-model="selectedCourierId"
                :items="courierOptions"
                value-key="value"
                placeholder="Select a courier provider"
                size="sm"
                class="w-full"
              />
            </div>
            <RecipientChip
              v-if="selectedCourier"
              :name="selectedCourier.name"
              :detail="`${selectedCourier.priority === 'recommended' ? 'Recommended' : 'Alternate'} · Account Manager: ${selectedCourier.accountManager}`"
              :initials="selectedCourier.name.split(' ').map(w => w[0]).join('').slice(0, 2)"
              class="mb-3"
            />
            <div class="mb-3">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Captured via</label>
              <URadioGroup
                v-model="branchCaptureMethod"
                :items="[{ label: 'Confirmation call (primary)', value: 'call' }, { label: 'Email reply (fallback)', value: 'email' }]"
                orientation="horizontal"
                size="sm"
              />
            </div>
            <div class="grid grid-cols-2 gap-3 mb-1.5">
              <div>
                <label class="text-xs font-semibold text-gray-700 block mb-1">Branch Name</label>
                <UInput v-model="branchNameDraft" placeholder="e.g. JRS Express - Ortigas Branch" size="sm" class="w-full" />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-700 block mb-1">Branch Address</label>
                <UInput v-model="branchAddressDraft" placeholder="Full branch address" size="sm" class="w-full" />
              </div>
            </div>
            <button type="button" class="text-xs font-semibold text-primary mb-3" @click="useAddressOnFile">
              Use address on file (no response from team member yet)
            </button>
            <p v-if="branchSubstituted" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-3">
              This will be recorded as a substitution from the address on file, not the team member's own reply.
            </p>
            <UButton color="primary" size="sm" :disabled="!selectedCourierId || !branchNameDraft.trim() || !branchAddressDraft.trim()" @click="doConfirmBranch">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A12 Returned Item Check and routing - a selectable card group, not a modal. -->
          <template v-else-if="meta.kind === 'inspection'">
            <label class="text-xs font-semibold text-gray-700 block mb-2">Where is the equipment going next?</label>
            <URadioGroup
              v-model="inspectionRouting"
              :items="inspectionRoutingOptions"
              variant="card"
              orientation="horizontal"
              indicator="hidden"
              class="mb-3"
            />
            <UButton color="primary" size="sm" :disabled="!inspectionRouting" @click="confirmInspection">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A5 Assets -->
          <template v-else-if="meta.kind === 'assets'">
            <table class="w-full text-sm mb-3">
              <thead><tr class="text-left text-gray-500 text-xs"><th class="pb-1.5 w-8" /><th class="pb-1.5">Asset</th><th class="pb-1.5">Serial</th></tr></thead>
              <tbody>
                <tr v-for="(a, i) in ticket.assets" :key="a.serial" class="border-t border-default">
                  <td class="py-1.5"><UCheckbox :model-value="a.checked" @update:model-value="(v) => toggleAsset(i, !!v)" /></td>
                  <td class="py-1.5">{{ a.name }}</td>
                  <td class="py-1.5 text-gray-500">{{ a.serial }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-sm text-gray-500 mb-3">{{ ticket.assets.filter(a => a.checked).length }} of {{ ticket.assets.length }} confirmed</div>
            <UButton color="primary" size="sm" @click="doConfirmAssets">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A6/B9 template send -->
          <template v-else-if="meta.kind === 'template-send'">
            <EmailRecipientsSummary :to="sendToEmail" :cc="effectiveTemplate?.cc ?? []" :bcc="effectiveTemplate?.bcc ?? []" class="mb-3" />

            <!-- B9 sends to the courier's own account manager, never the team member. -->
            <RecipientChip
              v-if="stageKey === 'B9'"
              :name="courierRecipient ? `${courierRecipient.name} - Account Manager` : 'No courier selected yet'"
              :detail="courierRecipient ? `${courierRecipient.accountManager} · Corporate account` : 'Confirm the courier branch first'"
              :initials="(courierRecipient?.accountManager ?? '??').split(' ').map(w => w[0]).join('').slice(0, 2)"
              class="mb-3"
            />
            <RecipientChip
              v-else
              :name="ticket.employee.name"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
              class="mb-3"
            >
              <template v-if="useManualEmail" #detail>
                <div class="flex items-center gap-1.5">
                  <UInput v-model="manualEmail" type="email" placeholder="personal@email.com" size="xs" class="max-w-[200px]" />
                  <span class="shrink-0">· {{ ticket.employee.dept }}</span>
                </div>
              </template>
              <template v-else #detail>{{ ticket.employee.email }} · {{ ticket.employee.dept }}</template>
              <template #actions>
                <UButton color="neutral" variant="ghost" size="xs" @click="useManualEmail = !useManualEmail">
                  {{ useManualEmail ? 'Use work email' : 'Use personal email' }}
                </UButton>
              </template>
            </RecipientChip>

            <div class="mb-3">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Email Template</label>
              <EmailAttachSection
                v-if="effectiveTemplate"
                :name="effectiveTemplate.name"
                :subtitle="effectiveTemplate.description"
                icon="i-lucide-mail"
                replace-label="Replace email"
                preview-tooltip="Preview email"
                preview-icon="i-lucide-eye"
                :form-options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                :current-form-id="effectiveTemplateKey ?? undefined"
                @preview="() => openTemplatePreview(effectiveTemplate)"
                @edit="() => navigateTo(`/templates/email/${effectiveTemplateKey}/edit`, { open: { target: '_blank' } })"
                @replace="(key) => overrideTemplateKey = key"
                @remove="() => overrideTemplateKey = null"
              />
              <AttachPicker
                v-else
                label="Attach an email template"
                icon="i-lucide-mail"
                :options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                @select="(key) => overrideTemplateKey = key"
              />
            </div>

            <div class="mb-3">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Attached Form</label>
              <EmailAttachSection
                v-if="effectiveForm"
                :name="effectiveForm.name"
                :subtitle="effectiveForm.description"
                :form-options="activeFormOptions.map(o => ({ id: o.value, name: o.label }))"
                :current-form-id="effectiveForm.id"
                @preview="() => navigateTo(`/form-preview?id=${effectiveForm!.id}`, { open: { target: '_blank' } })"
                @edit="() => navigateTo(`/templates/forms/${effectiveForm!.id}/edit`, { open: { target: '_blank' } })"
                @replace="(id) => overrideFormId = id"
                @remove="() => overrideFormId = null"
              />
              <AttachPicker
                v-else
                label="Attach a form"
                :options="activeFormOptions.map(o => ({ id: o.value, name: o.label }))"
                @select="(id) => overrideFormId = id"
              />
            </div>

            <UButton color="primary" size="sm" @click="sendNotice">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A7 Call Confirmation -->
          <template v-else-if="meta.kind === 'calllog'">
            <div class="rounded-md border border-default bg-gray-50 p-3 mb-3">
              <div class="flex justify-between text-sm mb-1.5"><span>Attempts logged</span><strong>{{ ticket.callAttempts.length }} of 3</strong></div>
              <div v-for="(a, i) in ticket.callAttempts" :key="i" class="text-xs text-gray-500">{{ a.when }}, {{ a.outcome }}</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <UButton color="neutral" variant="outline" size="sm" :disabled="callAtCap" @click="logCall('No answer')">No Answer</UButton>
              <UButton color="primary" size="sm" :disabled="callAtCap" @click="logCall('Answered - confirmed')">Answered</UButton>
              <UButton :color="callAnsweredYet || callAtCap ? 'primary' : 'neutral'" :variant="callAnsweredYet || callAtCap ? 'solid' : 'outline'" size="sm" :disabled="!(callAnsweredYet || callAtCap)" @click="continueFromCall">Continue</UButton>
            </div>
          </template>

          <!-- A8 Reminders -->
          <template v-else-if="meta.kind === 'reminders'">
            <EmailRecipientsSummary :to="ticket.employee.email" :cc="effectiveReminderTemplate?.cc ?? []" :bcc="effectiveReminderTemplate?.bcc ?? []" class="mb-3" />
            <RecipientChip
              :name="ticket.employee.name"
              :detail="`${ticket.employee.email} · ${ticket.employee.dept}`"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
              class="mb-3"
            />
            <div class="rounded-md border border-default bg-gray-50 p-3 mb-3 flex justify-between text-sm">
              <span>Reminders sent</span><strong>{{ ticket.reminderCount }} of 2</strong>
            </div>
            <div v-if="ticket.reminderCount < 2" class="mb-3">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Email Template ({{ ticket.reminderCount === 0 ? 'Midpoint' : 'Final' }})</label>
              <EmailAttachSection
                v-if="effectiveReminderTemplate"
                :name="effectiveReminderTemplate.name"
                :subtitle="effectiveReminderTemplate.description"
                icon="i-lucide-mail"
                replace-label="Replace email"
                preview-tooltip="Preview email"
                preview-icon="i-lucide-eye"
                :form-options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                :current-form-id="effectiveReminderTemplateKey ?? undefined"
                @preview="() => openTemplatePreview(effectiveReminderTemplate)"
                @edit="() => navigateTo(`/templates/email/${effectiveReminderTemplateKey}/edit`, { open: { target: '_blank' } })"
                @replace="(key) => overrideTemplateKey = key"
                @remove="() => overrideTemplateKey = null"
              />
              <AttachPicker
                v-else
                label="Attach an email template"
                icon="i-lucide-mail"
                :options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                @select="(key) => overrideTemplateKey = key"
              />
            </div>
            <div v-if="ticket.reminderCount < 2" class="flex gap-2">
              <UButton color="primary" size="sm" @click="sendReminder">Send {{ ticket.reminderCount === 0 ? 'Midpoint' : 'Final' }} Reminder</UButton>
              <UButton color="neutral" variant="outline" size="sm" @click="skipReminder">Skip {{ ticket.reminderCount === 0 ? 'Midpoint' : 'Final' }} Reminder</UButton>
            </div>
            <UButton v-else color="primary" size="sm" @click="continueFromReminders">Continue</UButton>
          </template>

          <!-- A9 Awaiting Return -->
          <template v-else-if="meta.kind === 'awaiting-return'">
            <div class="rounded-md border border-default bg-gray-50 p-3 mb-3">
              <div class="flex justify-between text-sm"><span class="text-gray-500 font-semibold">Target Date</span><span class="font-bold">{{ fmtDate(ticket.targetDateISO) }}</span></div>
              <div class="text-xs text-gray-500 mt-1.5">If the equipment isn't confirmed received by this date, the ticket automatically becomes <strong>Overdue Return</strong>. No operator action triggers it.</div>
            </div>
            <p class="text-xs text-gray-500 mb-3">This is a preliminary confirmation. The actual proof and condition evidence are captured next, at Receipt &amp; Evidence.</p>
            <UButton color="primary" size="sm" @click="confirmPhysicalReceipt">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A10 Evidence -->
          <template v-else-if="meta.kind === 'evidence'">
            <div class="grid grid-cols-2 gap-3 mb-2">
              <label class="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer" :class="proofFile ? 'border-[rgb(0,127,69)] bg-[rgb(0,127,69)]/5' : 'border-default bg-gray-50'">
                <input type="file" class="hidden" accept="image/*,.pdf" @change="pickFile('proof', $event)" @click.stop="proofFile && ($event.preventDefault(), openFile(proofFile))">
                <div class="text-sm font-bold text-gray-700">Proof-of-Receipt</div>
                <div class="text-xs mt-1" :class="proofFile ? 'text-[rgb(0,127,69)] font-semibold' : 'text-gray-400'">{{ proofFile ? proofFile.name : 'Click to attach (image or PDF, max 10MB)' }}</div>
                <button v-if="proofFile" type="button" class="mt-1.5 text-xs border border-default rounded px-2 py-0.5 text-gray-500" @click.prevent="proofFile = null">Replace</button>
              </label>
              <label class="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer" :class="conditionFile ? 'border-[rgb(0,127,69)] bg-[rgb(0,127,69)]/5' : 'border-default bg-gray-50'">
                <input type="file" class="hidden" accept="image/*,.pdf" @change="pickFile('condition', $event)" @click.stop="conditionFile && ($event.preventDefault(), openFile(conditionFile))">
                <div class="text-sm font-bold text-gray-700">Condition Photos</div>
                <div class="text-xs mt-1" :class="conditionFile ? 'text-[rgb(0,127,69)] font-semibold' : 'text-gray-400'">{{ conditionFile ? conditionFile.name : 'Click to attach (image or PDF, max 10MB)' }}</div>
                <button v-if="conditionFile" type="button" class="mt-1.5 text-xs border border-default rounded px-2 py-0.5 text-gray-500" @click.prevent="conditionFile = null">Replace</button>
              </label>
            </div>
            <p v-if="evidenceError" class="text-xs text-red-600 mb-2">{{ evidenceError }}</p>
            <UButton color="primary" size="sm" :disabled="!proofFile || !conditionFile" @click="confirmEvidence">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A11 Deduction -->
          <template v-else-if="meta.kind === 'deduction'">
            <template v-if="ticket.deductionApplicable === null">
              <p class="text-sm text-gray-400 mb-3">Only applies if an item was confirmed damaged or not returned at Receipt &amp; Evidence.</p>
              <div class="flex gap-2">
                <UButton color="neutral" variant="outline" size="sm" @click="markNotApplicable">Not Applicable</UButton>
                <UButton color="primary" size="sm" @click="markDamaged">Item Damaged or Not Returned</UButton>
              </div>
            </template>
            <template v-else>
              <div class="rounded-md border border-default bg-gray-50 p-3 mb-3 flex flex-col gap-2.5">
                <span class="self-start text-xs font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Provisional layout, confirming exact ATD fields with the team</span>
                <div class="grid grid-cols-2 gap-2.5">
                  <div><label class="text-xs font-semibold text-gray-500 block mb-1">ATD Reference</label><UInput :model-value="atdRef" disabled size="sm" class="w-full" /></div>
                  <div><label class="text-xs font-semibold text-gray-500 block mb-1">Date Initiated</label><UInput type="date" size="sm" class="w-full" /></div>
                </div>
                <div><label class="text-xs font-semibold text-gray-500 block mb-1">Item</label><UInput placeholder="e.g. MacBook Pro 14&quot;, condition or non-return note" size="sm" class="w-full" /></div>
                <div class="grid grid-cols-2 gap-2.5">
                  <div><label class="text-xs font-semibold text-gray-500 block mb-1">Amount</label><UInput placeholder="PHP 0.00" size="sm" class="w-full" /></div>
                  <div><label class="text-xs font-semibold text-gray-500 block mb-1">Authorized By</label><UInput placeholder="Signatory name" size="sm" class="w-full" /></div>
                </div>
              </div>
              <UButton color="primary" size="sm" @click="confirmDeduction">Confirm Deduction Initiated</UButton>
            </template>
          </template>

          <!-- A13 Closure -->
          <template v-else-if="meta.kind === 'closure'">
            <div class="rounded-md border border-default bg-gray-50 p-3 mb-3 flex flex-col gap-1.5 text-sm">
              <div class="flex justify-between"><span class="text-gray-500">Assets</span><span class="font-semibold">{{ ticket.assets.filter(a => a.checked).length }} confirmed<template v-if="ticket.assets.some(a => !a.checked)">, <strong class="text-red-600">{{ ticket.assets.filter(a => !a.checked).length }} outstanding</strong></template></span></div>
              <div class="flex justify-between"><span class="text-gray-500">Gate</span><span class="font-semibold">{{ ticket.gateCount === 0 ? 'Not applicable (voluntary path)' : ticket.gatesReleased >= ticket.gateCount ? 'Fully released' : `${ticket.gatesReleased} of ${ticket.gateCount} gates released` }}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Communications sent</span><span class="font-semibold">{{ ticket.history.filter(h => /notice|endorsement|reminder/i.test(h.action)).length }}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Target Date</span><span class="font-semibold">{{ fmtDate(ticket.targetDateISO) }}</span></div>
            </div>
            <UButton color="primary" size="sm" @click="openClosure">{{ meta.actionLabel }}</UButton>
          </template>
        </div>

        <div v-else class="rounded-lg border border-default bg-white p-4 text-center text-sm text-muted">
          This ticket is closed. No further action is available.
        </div>
      </div>
    </div>

    <!-- Activity Log drawer -->
    <USlideover v-model:open="activityOpen" side="right">
      <template #header>
        <h2 class="text-sm font-semibold">Activity Log</h2>
      </template>
      <template #body>
        <div v-for="(h, i) in ticket.history" :key="i" class="py-2 border-b border-default last:border-0 text-sm">
          <span class="font-semibold text-highlighted">{{ h.action }}</span>
          <div class="text-gray-400 text-xs mt-0.5">{{ h.actor }}, {{ h.when }}</div>
        </div>
        <div v-if="!ticket.history.length" class="text-sm text-gray-400">No activity yet.</div>
      </template>
    </USlideover>

    <!-- Email content preview - the same FullPreviewModal a template's own
         version history previews with (real prose-styled rendering, tokens
         resolved to this ticket's actual data), shared by every
         template-sending stage (A6/B9/A8). -->
    <EmailFullPreviewModal v-model:open="previewOpen" title="Email Preview" :subject="previewSubject" :body="previewBody" />

    <!-- Issue Gate Pass - mirrors the real "Issue Gate Pass" form's own
         sections (Gate Pass Details, Team Member, Asset Items). Team Member
         and Asset Items are locked/pre-filled from this ticket; only
         Movement, dates, Time and Purpose are the operator's own entry. -->
    <UModal v-model:open="gatePassOpen" :ui="{ content: 'max-w-lg' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Issue Gate Pass</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" @click="close" />
      </template>
      <template #body>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-semibold text-gray-700 block mb-1.5">Movement</label>
            <div class="flex rounded-lg overflow-hidden border border-default w-fit">
              <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium" :class="gatePassMovement === 'checkout' ? 'bg-primary text-white' : 'bg-white text-gray-500'" @click="gatePassMovement = 'checkout'">
                <UIcon name="i-lucide-log-out" class="size-4" />Check Out
              </button>
              <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-l border-default" :class="gatePassMovement === 'checkin' ? 'bg-primary text-white' : 'bg-white text-gray-500'" @click="gatePassMovement = 'checkin'">
                <UIcon name="i-lucide-log-in" class="size-4" />Check In
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-xs font-semibold text-gray-700 block mb-1">Issue Date</label><UInput v-model="gatePassIssueDate" type="date" size="sm" class="w-full" /></div>
            <div><label class="text-xs font-semibold text-gray-700 block mb-1">Time</label><UInput v-model="gatePassTime" type="time" size="sm" class="w-full" /></div>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-700 block mb-1">Valid Until</label>
            <UInput v-model="gatePassValidUntil" type="date" size="sm" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-700 block mb-1">Purpose</label>
            <UInput v-model="gatePassPurpose" placeholder="e.g. Asset Retrieval" size="sm" class="w-full" />
          </div>

          <div class="rounded-md border border-default bg-gray-50 p-3 grid grid-cols-3 gap-2 text-sm">
            <div><span class="text-xs text-gray-500 block">Team Member</span><span class="font-medium">{{ ticket.employee.name }}</span></div>
            <div><span class="text-xs text-gray-500 block">Employee ID</span><span class="font-medium">{{ ticket.employee.id }}</span></div>
            <div><span class="text-xs text-gray-500 block">Dept. / Role</span><span class="font-medium">{{ ticket.employee.dept }}</span></div>
          </div>

          <div>
            <label class="text-xs font-semibold text-gray-700 block mb-1.5">Asset Items</label>
            <table class="w-full text-sm">
              <thead><tr class="text-left text-gray-500 text-xs"><th class="pb-1">Type</th><th class="pb-1">Serial No.</th><th class="pb-1">Remarks</th></tr></thead>
              <tbody>
                <tr v-for="(a, i) in gatePassAssets" :key="a.serial" class="border-t border-default">
                  <td class="py-1.5 pr-2">{{ a.type }}</td>
                  <td class="py-1.5 pr-2 text-gray-500">{{ a.serial }}</td>
                  <td class="py-1.5"><UInput v-model="a.remarks" placeholder="Optional" size="xs" class="w-full" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="gatePassOpen = false">Cancel</UButton>
          <UButton color="primary" icon="i-lucide-file-check" :disabled="!gatePassIssueDate || !gatePassValidUntil" @click="doIssueGatePass">Issue Gate Pass</UButton>
        </div>
      </template>
    </UModal>

    <!-- Gate Pass details - the drawer opened from the header's GP reference button. -->
    <USlideover v-model:open="gatePassViewOpen" side="right">
      <template #header>
        <h2 class="text-sm font-semibold">Gate Pass {{ ticket.gatePass?.ref }}</h2>
      </template>
      <template #body>
        <div v-if="ticket.gatePass" class="flex flex-col gap-4 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div><span class="text-xs text-gray-500 block">Gate Pass No.</span><span class="font-medium font-mono">{{ ticket.gatePass.ref }}</span></div>
            <div><span class="text-xs text-gray-500 block">Ticket Ref.</span><span class="font-medium font-mono">{{ ticket.reference }}</span></div>
            <div><span class="text-xs text-gray-500 block">Issue Date</span><span class="font-medium">{{ fmtDate(ticket.gatePass.issueDate) }}</span></div>
            <div><span class="text-xs text-gray-500 block">Valid Until</span><span class="font-medium">{{ fmtDate(ticket.gatePass.validUntil) }}</span></div>
            <div><span class="text-xs text-gray-500 block">Team Member</span><span class="font-medium">{{ ticket.employee.name }}</span></div>
            <div><span class="text-xs text-gray-500 block">Employee ID</span><span class="font-medium">{{ ticket.employee.id }}</span></div>
            <div><span class="text-xs text-gray-500 block">Dept. / Role</span><span class="font-medium">{{ ticket.employee.dept }}</span></div>
            <div><span class="text-xs text-gray-500 block">Requested By</span><span class="font-medium">{{ ticket.gatePass.requestedBy }}</span></div>
          </div>

          <div class="rounded-md border border-default bg-gray-50 p-3 flex items-center justify-between">
            <div><span class="text-xs text-gray-500 block">Movement</span><span class="font-semibold">{{ ticket.gatePass.movement === 'checkin' ? 'Check In' : 'Check Out' }}</span></div>
            <div v-if="ticket.gatePass.time"><span class="text-xs text-gray-500 block">Time</span><span class="font-semibold">{{ ticket.gatePass.time }}</span></div>
          </div>
          <div><span class="text-xs text-gray-500 block">Purpose</span><span class="font-medium">{{ ticket.gatePass.purpose || 'Not stated' }}</span></div>

          <div>
            <span class="text-xs font-semibold uppercase text-gray-500 block mb-1.5">Asset Items</span>
            <table class="w-full text-sm">
              <thead><tr class="text-left text-gray-500 text-xs"><th class="pb-1">Type</th><th class="pb-1">Tag / Serial</th><th class="pb-1">Remarks</th></tr></thead>
              <tbody>
                <tr v-for="a in ticket.gatePass.assets" :key="a.serial" class="border-t border-default">
                  <td class="py-1.5 pr-2">{{ a.type }}</td>
                  <td class="py-1.5 pr-2 text-gray-500 font-mono">{{ a.serial }}</td>
                  <td class="py-1.5">{{ a.remarks || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="grid grid-cols-3 gap-3 pt-3 border-t border-dashed border-default text-xs text-center">
            <div><div class="border-t border-gray-400 mt-6 pt-1">Team Member</div><div class="text-gray-400">Signature over Printed Name</div></div>
            <div><div class="border-t border-gray-400 mt-6 pt-1">Asset Team</div><div class="text-gray-400">Signature over Printed Name</div></div>
            <div><div class="border-t border-gray-400 mt-6 pt-1">Security</div><div class="text-gray-400">Signature over Printed Name</div></div>
          </div>
          <p class="text-center text-xs text-gray-400">System generated · GoTeam AMS</p>
        </div>
      </template>
    </USlideover>

    <!-- Closure confirmation modal -->
    <UModal v-model:open="closureOpen" :ui="{ content: 'max-w-lg' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Close Ticket</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" @click="close" />
      </template>
      <template #body>
        <div class="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
          <div v-for="(a, i) in ticket.assets" :key="a.serial" class="rounded-md border border-default p-2.5 flex items-center justify-between gap-3 text-sm">
            <span class="font-medium">{{ a.name }}</span>
            <USelect
              v-model="assetResolutions[i]"
              :items="[{ label: 'Returned', value: 'returned' }, { label: 'Path to Charge', value: 'charge' }, { label: 'Keep Open', value: 'open' }]"
              size="xs"
              class="w-40"
            />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm mt-3">
          <UCheckbox v-model="closureDocumented" />
          Two-way documentation confirmed: both parties have a copy of the closure record.
        </label>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="closureOpen = false">Cancel</UButton>
          <UButton color="primary" :disabled="!closureDocumented" @click="confirmClosure">Confirm &amp; Close</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
