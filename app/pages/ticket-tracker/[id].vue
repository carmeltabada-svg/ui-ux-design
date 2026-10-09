<script setup lang="ts">
// Retrieval Workspace - the main ticket surface. Ports the prototype's stage
// engine (renderStage()/STAGE_CONTENT) onto a real per-ticket record (see
// ~/data/ticketTrackers), rendering interactive panels per STAGE_META.kind
// instead of one giant innerHTML switch. Sends (A6/B9/A8) resolve to the
// REAL TEMPLATE_RUNTIME content and the real Equipment Return Acknowledgment
// form via EmailAttachSection, in place of the prototype's mocked arrays.
import {
  TICKETS, seedDemoTickets, GATE_STEPS, PHASE_LABELS, STAGE_PHASE, STAGE_NAMES, STAGE_META,
  STAGES_ONSITE, STAGES_REMOTE, SKIP_STAGES, addChecklistItem, removeChecklistItem, reorderChecklistItem, applyChecklistTemplate, toggleChecklistRequired, checklistProgress, checklistDueISO, finalizeChecklist, setChecklistDone, checklistDoneByCounts,
  REASON_LABELS, REMINDER_TEMPLATES, COURIER_ENDORSEMENT_TEMPLATE_KEY,
  COURIER_PROVIDERS, courierProviderById, confirmCourierBranch, confirmItLockScheduling, confirmItLockExecution,
  branchCaptureUrgent, confirmInTransit as confirmInTransitStage, saveShipmentDetails, shipmentStatus, isValidTrackingLink, GATE_PASS_KIND_LABEL,
  effectiveTeamMemberAddress, setTeamMemberAddressOverride, firstNameOf, derivedReturnRequestedDate, derivedReceivedDate, assetOwnerInfo,
  DEDUCTION_AMOUNT_BASIS_LABELS, DEDUCTION_BASES_BY_OUTCOME, DEDUCTION_DATES_BY_OUTCOME, DEDUCTION_OUTCOME_META,
  branchesForCourier, courierBranchById, nearestBranchFor, sendBranchRequest, markBranchReplyReceived,
  currentStageKey, stageListFor, advanceStage, confirmAssets, releaseGate, pushHistory, goBackStage, goForwardStage, jumpToStage, verifyContact,
  safekeepingAvailable, resolvedPathFor, templateForKey, attachedFormFor, phasesFor,
  isOverdueReturn, isTransitDelayed, hasReachedStage, rebaselineTargetDate, syncTicketAssetsFromRegister, acknowledgeHrisUpdate, daysLeftLabel,
  ticketStatusLabel, ticketStatusTone, INSPECTION_ROUTE_STATUS, assetCatalogEntry, assetTypeIcon,
  shiftFor, shiftLabel, lockRunsAt,
  pathChangeLockReasons, changeReasonAndMode, takeOverTicket, cancelRetrieval, openChargeCaseForItems, computeTargetDateForPath,
  confirmReferredToPayroll, saveQuotationDetails,
  currentUserName, confirmSmsSentFor, ACKNOWLEDGMENT_HOST, CANCELLATION_REASON_LABELS, type CancellationReason, type TicketReason, type TicketMode,
  type StageKey, type PhaseKey, type InspectionRoute, type HistoryCategory, type TicketHistoryEntry, type Ticket, type TicketAsset, type GatePassKind, type DeductionAmountBasis, type DeductionOutcome, type DeductionDateKey
} from '~/data/ticketTrackers'

import { RETRIEVAL_FORMS, RETRIEVAL_FORM_CONTENT, DEFAULT_PAGE_MARGINS } from '~/data/retrievalForms'
import { useChecklistTemplates, saveChecklistTemplate, checklistMatchesATemplate, type ChecklistTemplate, type ChecklistTask } from '~/data/checklistTemplates'
import { VueDraggable } from 'vue-draggable-plus'
import { smsTemplateByCode, smsCodesForStage } from '~/data/smsTemplates'
import { TEMPLATES, TEMPLATE_GROUPS, SAMPLE_VALUES, ORG_CONSTANT_TOKENS, expandCaseAssetRows, expandTicketAssets, omitReceivedDate, resolveTokensForPrint, checkPlaceholders, placeholderStatusFor, wrapTokens, type PlaceholderCheckEntry, CALL_ESCALATION_SMS_TEMPLATE } from '~/data/templates'
import { buildPrintCss } from '~/utils/formPrintStyles'
import { buildFormLetterhead } from '~/utils/formLetterhead'
import { ensureTemplateRuntime, CUSTOM_TEMPLATE_IDS, DELETED_TEMPLATE_KEYS } from '~/data/templateRuntime'

// A ticket link opened directly (a fresh browser, a shared link) must find its ticket: seed the demo tickets here too, exactly as the list page does. Safe to repeat.
seedDemoTickets()

definePageMeta({})

const route = useRoute()
// Communications "All steps" list stays collapsed until asked for, to keep the rail short.
const allStepsOpen = ref(false)
const toast = useToast()

// The route param is the real, user-facing Ticket # (matching the Overview
// list's own "Ticket #" column), not this ticket's internal `id` (a UUID for
// a real create, or the HRIS employee id for a seeded demo ticket) - so a
// shared/bookmarked/notification link reads as `/ticket-tracker/426`, never
// a random-looking internal string.
const ticket = computed(() => Object.values(TICKETS).find(t => t.ticketNumber === Number(route.params.id)))

useSeoMeta({ title: () => ticket.value ? `AMS · ${ticket.value.employee.name} (Retrieval)` : 'AMS · Ticket not found' })

const stageKey = computed<StageKey | null>(() => ticket.value ? currentStageKey(ticket.value) : null)
const meta = computed(() => stageKey.value ? STAGE_META[stageKey.value] : undefined)
const resolvedPath = computed(() => ticket.value ? resolvedPathFor(ticket.value.reason, ticket.value.mode) : null)

// FR-003.5 gates are advisory, not a hard lock (product decision,
// 2026-09-23 - P&C also operates this module and gates are not a hard
// requirement for them): recording a gate never blocks a stage or a send.
// The T19 Equipment Safekeeping Request is still surfaced as the
// recommended lighter-weight send during the Gate 2-3 window, but only as
// an option alongside the normal action, never in place of it.
const t19Available = computed(() => !!ticket.value && stageKey.value === 'A6' && safekeepingAvailable(ticket.value))

// FR-003.8(g): Overdue Return is computed live from the Target Date, never a
// flag an operator has to remember to set - see isOverdueReturn().
const ticketOverdue = computed(() => !!ticket.value && isOverdueReturn(ticket.value))
// FR-003.6 B11a: a separate, transit-specific delay flag - see isTransitDelayed().
const transitDelayed = computed(() => !!ticket.value && isTransitDelayed(ticket.value))
// The Overdue Return *status* applies purely off the Target Date, regardless
// of stage (FR-003.8g) - ticketStatusLabel/Tone already reflect that
// unconditionally. But the Overdue banner's own SEND action ("Send Overdue
// Reminder") is A9's own action - FR-003.6 names Overdue as its own stage,
// reached only after A7 (Call Confirmation) and A8 (Reminders) actually run
// their course. Gating this on merely having reached A6 was too early: a
// ticket can lapse its Target Date while genuinely still sitting at A6/A7/A8
// (their own panels are the real current step, still mid-notice or
// mid-reminder), and the banner rendered on top of that earlier stage's own
// action panel - two "current steps" on screen at once, one of them dead
// (its own action never advances anything). Requiring A9 itself keeps this
// banner paired only with A9's own "Mark Equipment Received" panel, which is
// the one stage this reminder genuinely belongs alongside.

// FR-003.8(a): keep the asset list reconciled against the register while it's
// still editable, so a late assignment shows up even on an already-open
// ticket instead of staying frozen at whatever existed when it was created.
watchEffect(() => {
  if (ticket.value && !ticket.value.assetsLocked) syncTicketAssetsFromRegister(ticket.value)
})

function fmtDate(iso: string | null) {
  if (!iso) return 'Not set'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Calendar-day arithmetic on YYYY-MM-DD strings. Local getters, not
// toISOString(), which shifts the date back a day ahead of UTC.
function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function nextWorkingDayISO(iso: string) {
  let out = addDaysISO(iso, 1)
  while ([0, 6].includes(new Date(`${out}T00:00:00`).getDay())) out = addDaysISO(out, 1)
  return out
}
function acknowledgmentDueISO(t: NonNullable<typeof ticket.value>): string {
  switch (t.reason) {
    case 'recalled': return t.recallEffectiveDate || t.targetDateISO || ''
    case 'immediate-resignation': return t.mode === 'onsite' ? nextWorkingDayISO(t.createdAt) : addDaysISO(t.createdAt, 3)
    case 'unexplained-absence': return t.targetDateISO || ''
    default: return t.lwd || t.targetDateISO || ''
  }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}


// --- Phase tracker -----------------------------------------------------
// Only the phases that actually exist on this ticket's mode - Branch &
// Endorsement and Transit are remote-only (B8/B9/B11/B11a), so an onsite
// ticket must not show a node for them at all (it previously did, with an
// empty hover popover behind it since no onsite stage lives in that phase).
const applicablePhases = computed(() => phasesFor(ticket.value?.mode ?? 'onsite'))
const currentPhase = computed<PhaseKey | null>(() => stageKey.value ? STAGE_PHASE[stageKey.value] : (ticket.value?.status === 'closed' ? 'closure' : null))
// The furthest phase this ticket has ever actually reached (furthestStageIdx-
// derived), separate from the CURRENT phase (stageIdx/stageKey-derived,
// "where the operator's cursor happens to be right now"). Done/future must
// be judged against the former, never the latter - otherwise jumping
// backward to review an earlier stage (via the popover, or Back) would
// demote every later, already-completed phase back to "future", and then
// immediately refuse to jump forward again ("not reached yet") even though
// nothing was actually undone - furthestStageIdx itself never moves
// backward, only stageIdx does.
const furthestPhaseIdx = computed(() => {
  if (!ticket.value) return -1
  const modeList = ticket.value.mode === 'remote' ? STAGES_REMOTE : STAGES_ONSITE
  const furthestKey = modeList[ticket.value.furthestStageIdx ?? 0]
  if (!furthestKey) return -1
  return applicablePhases.value.indexOf(STAGE_PHASE[furthestKey])
})
/** One themed icon per phase for the phase tracker's own circles - replaces the old plain step number entirely (done already used a check icon; current/future now get their phase's own icon instead of a number), per the requested wizard-stepper reference. */
const PHASE_ICONS: Record<PhaseKey, string> = {
  setup: 'i-lucide-list-checks',
  branch: 'i-lucide-route',
  notice: 'i-lucide-bell',
  transit: 'i-lucide-truck',
  return: 'i-lucide-package-check',
  closure: 'i-lucide-flag'
}
const phaseNodes = computed(() => {
  const order = applicablePhases.value
  const cur = currentPhase.value
  const curIdx = cur ? order.indexOf(cur) : order.length
  const furthestIdx = furthestPhaseIdx.value
  return order.map((p, i) => ({
    key: p,
    label: PHASE_LABELS[p],
    // Red only once the operator can actually open that stage (current, or
    // already reached). An unreached Return node stays neutral: a bright
    // red node invites a click that can't be honored ("not reached yet").
    state: ticketOverdue.value && p === 'return' && (i === curIdx || i <= furthestIdx) ? 'blocked'
      : ticket.value?.status === 'closed' ? 'done'
      : i === curIdx ? 'current'
      : i <= furthestIdx ? 'done'
      : 'future'
  }))
})

// Phone stepper: where the operator is right now (current stage, or Closure once closed).
const mobilePhaseIdx = computed(() => {
  const i = phaseNodes.value.findIndex(n => n.key === currentPhase.value)
  return i === -1 ? phaseNodes.value.length - 1 : i
})
const mobilePhasePosition = computed(() => mobilePhaseIdx.value + 1)
const mobilePhaseLabel = computed(() => phaseNodes.value[mobilePhaseIdx.value]?.label ?? '')

// Each phase node's own hover popover - the real child steps inside that
// phase, with a purely visual done/current/future cue (a dot, no text
// label) rather than restating "done"/"current" in words for every row.
// Same furthestStageIdx-vs-stageIdx distinction as phaseNodes above.
function childStepsFor(phaseKey: PhaseKey) {
  if (!ticket.value) return []
  const modeList = ticket.value.mode === 'remote' ? STAGES_REMOTE : STAGES_ONSITE
  const steps = modeList.filter(s => STAGE_PHASE[s] === phaseKey && !SKIP_STAGES.includes(s))
  const curKey = stageKey.value
  const curIdx = curKey ? modeList.indexOf(curKey) : modeList.length
  const furthestIdx = ticket.value.furthestStageIdx ?? 0
  return steps.map(s => ({
    key: s,
    label: STAGE_NAMES[s],
    dotState: ticket.value!.status === 'closed' ? 'done'
      : modeList.indexOf(s) === curIdx ? 'current'
      : modeList.indexOf(s) <= furthestIdx ? 'done'
      : 'future'
  }))
}

// Clicking a phase node (or a step inside its hover popover) jumps straight
// there via jumpToStage, instead of only ever being able to step one stage
// at a time with Back/Forward. A "future" phase/step has nothing to jump to
// yet, so it explains that instead of silently doing nothing.
function jumpToPhase(node: { key: PhaseKey, state: string }) {
  if (!ticket.value) return
  if (node.state === 'future') {
    toast.add({ title: 'Not reached yet', description: `${PHASE_LABELS[node.key]} hasn't been reached yet.`, icon: 'i-lucide-info', color: 'warning' })
    return
  }
  const firstStep = childStepsFor(node.key)[0]
  if (firstStep) jumpToStage(ticket.value, firstStep.key)
}
function jumpToChildStep(child: { key: StageKey, label: string, dotState: string }) {
  if (!ticket.value) return
  if (child.dotState === 'future') {
    toast.add({ title: 'Not reached yet', description: `${child.label} hasn't been reached yet.`, icon: 'i-lucide-info', color: 'warning' })
    return
  }
  jumpToStage(ticket.value, child.key)
}

// --- Stage card header's step count ("Step X of Y") - the same child-step
// list childStepsFor() already derives for the stepper's hover popover, but
// surfaced directly on the stage card itself so progress within a phase is
// visible without hovering. Falls back to 1 of 1 if the current stage
// somehow isn't in its own phase's step list.
const stepProgress = computed(() => {
  if (!ticket.value || !stageKey.value) return { index: 1, total: 1 }
  const steps = childStepsFor(STAGE_PHASE[stageKey.value])
  const idx = steps.findIndex(s => s.key === stageKey.value)
  return { index: idx === -1 ? 1 : idx + 1, total: steps.length || 1 }
})

// --- Back navigation - lets an operator undo an accidental or premature
// advance. Never shown on the very first actionable step (A3), since
// stepping back from there would just land on the already-logged A1/A2
// entries and resolve straight back to A3 anyway - a visible no-op.
const canGoBack = computed(() => !!stageKey.value && stageKey.value !== 'A3')
function goBack() {
  if (!ticket.value) return
  goBackStage(ticket.value)
}
// --- Forward navigation - the mirror of Back: only re-enabled once the
// operator has stepped back to recheck something. Can never go past the
// furthest stage this ticket has actually completed (furthestStageIdx),
// so it's never a way to skip a stage that hasn't been done.
const canGoForward = computed(() => !!ticket.value && ticket.value.stageIdx < (ticket.value.furthestStageIdx ?? 0))
function goForward() {
  if (!ticket.value) return
  goForwardStage(ticket.value)
}

// --- A3 Offboarding Checklist -------------------------------------------
// FR-003.6 doesn't enumerate actual checklist items (only a timing rule),
// so this is per-ticket and editable - see addChecklistItem/
// removeChecklistItem in ~/data/ticketTrackers, not a fixed global list.
const checklistStatus = computed(() => ticket.value ? checklistProgress(ticket.value) : null)
const checklistComplete = computed(() => !!checklistStatus.value?.ready)
/** The checklist is a record once the final review is signed off, or the ticket is closed. */
const checklistReadOnly = computed(() => !ticket.value || ticket.value.status !== 'open' || !!ticket.value.checklistReview)
const checklistDue = computed(() => ticket.value ? checklistDueISO(ticket.value) : null)
/** The due date as a short badge: how long is left, or how long overdue. Gone once the review is signed off. */
const checklistDueInfo = computed(() => {
  const due = checklistDue.value
  if (!due || ticket.value?.checklistReview) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(`${due}T00:00:00`).getTime() - today.getTime()) / 86400000)
  if (days < 0) return { tone: 'overdue' as const, label: `Overdue by ${-days}d` }
  if (days === 0) return { tone: 'soon' as const, label: 'Due today' }
  return { tone: days <= 2 ? 'soon' as const : 'ok' as const, label: `Due ${fmtDate(due)}` }
})
function toggleChecklistItem(i: number, checked: boolean) {
  if (!ticket.value || checklistReadOnly.value) return
  setChecklistDone(ticket.value, i, checked)
}
function toggleRequired(i: number) {
  if (!ticket.value || checklistReadOnly.value) return
  toggleChecklistRequired(ticket.value, i)
}
// Policy finalised 5 Oct 2026: anyone on the Asset Team can sign off; the
// reviewer may leave an optional note (kept with the signed-off record and in
// the Activity Log). Who did each task is always recorded and shown.
const checklistDoneBy = computed(() => ticket.value ? checklistDoneByCounts(ticket.value) : [])
const reviewerNoteDraft = ref('')
function finishChecklist() {
  if (!ticket.value) return
  const res = finalizeChecklist(ticket.value, currentUserName(), reviewerNoteDraft.value)
  if (!res.ok) toast.add({ title: 'Cannot sign off yet', description: res.error, icon: 'i-lucide-lock', color: 'warning' })
  else reviewerNoteDraft.value = ''
}
/** This ticket's tasks in the shape a template stores them. */
const currentChecklistTasks = (): ChecklistTask[] => (ticket.value?.checklistItems ?? []).map((text, i) => ({ text, required: !ticket.value?.checklistOptional?.[i] }))
// Saved checklists (templates): standing lists the Asset Team edits in Master
// Data. A new ticket is issued the one set for its path; using another here
// copies its tasks in fresh and unchecked, and saving copies this ticket's
// tasks out as a new template.
const checklistTemplates = useChecklistTemplates()
const saveTemplateOpen = ref(false)
const saveTemplateName = ref('')
const saveTemplateError = ref('')
function openSaveTemplate() {
  saveTemplateName.value = ''
  saveTemplateError.value = ''
  saveTemplateOpen.value = true
}
function doSaveTemplate() {
  if (!ticket.value) return
  const res = saveChecklistTemplate(saveTemplateName.value, currentChecklistTasks())
  if (!res.ok) { saveTemplateError.value = res.error; return }
  ticket.value.checklistNudgeDismissed = true
  saveTemplateOpen.value = false
  toast.add({ title: 'Template saved', description: `"${res.template.name}" is ready to reuse. Set which tickets start from it in Master Data.`, icon: 'i-lucide-bookmark-check', color: 'success' })
}
const useTemplateOpen = ref(false)
const templateToReplaceWith = ref<ChecklistTemplate | null>(null)
function chooseChecklistTemplate(t: ChecklistTemplate) {
  if (!ticket.value) return
  // Progress on the list being replaced is dropped, so ask first when there is some.
  if (ticket.value.checklistDone.some(Boolean)) { templateToReplaceWith.value = t; return }
  useChecklistTemplate(t)
}
function useChecklistTemplate(t: ChecklistTemplate) {
  if (!ticket.value) return
  applyChecklistTemplate(ticket.value, t.name, t.tasks)
  templateToReplaceWith.value = null
  useTemplateOpen.value = false
}
/** Reminder to save a list worth reusing: shown only while it matches no saved template and has not been dismissed. */
const showChecklistNudge = computed(() => {
  const t = ticket.value
  if (!t || t.status !== 'open' || t.checklistReview || t.checklistNudgeDismissed || !t.checklistItems.length) return false
  return !checklistMatchesATemplate(currentChecklistTasks())
})
const newChecklistItemText = ref('')
const newChecklistItemInputRef = ref<{ inputRef?: HTMLInputElement } | HTMLInputElement | null>(null)
function newChecklistItemInputFocus() {
  nextTick(() => {
    const r = newChecklistItemInputRef.value as any
    const el = (r?.inputRef as HTMLInputElement | undefined) ?? (r?.$el?.querySelector?.('input') as HTMLInputElement | undefined) ?? (r as HTMLInputElement | undefined)
    el?.focus?.()
  })
}
function addChecklistItemFromInput() {
  if (!ticket.value || !newChecklistItemText.value.trim()) return
  addChecklistItem(ticket.value, newChecklistItemText.value)
  newChecklistItemText.value = ''
}
function removeChecklistItemAt(i: number) {
  if (!ticket.value) return
  removeChecklistItem(ticket.value, i)
}
function moveChecklistItem(i: number, direction: -1 | 1) {
  if (!ticket.value) return
  reorderChecklistItem(ticket.value, i, i + direction)
}
// Called from VueDraggable's @update: swaps items via the ticket's own
// reorder helper so the parallel checklistDone/Optional/DoneBy arrays stay
// in lockstep with the visible items array (5 Oct 2026, 5th pass).
function reorderChecklistItemBetween(oldIndex: number, newIndex: number) {
  if (!ticket.value || typeof oldIndex !== 'number' || typeof newIndex !== 'number' || oldIndex === newIndex) return
  reorderChecklistItem(ticket.value, oldIndex, newIndex)
}

// --- A4 IT lock scheduling - two distinct confirmations (FR-003.6): the
// lock is scheduled first, then separately confirmed as actually executed -
// not one bare click. -------
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
// FR-003.8(b): Select All / Unselect All controls - the default state is
// already all-preselected (see createTicket), this just adds the bulk
// toggle so an operator isn't stuck unchecking items one at a time.
function setAllAssets(checked: boolean) {
  if (!ticket.value) return
  ticket.value.assets.forEach(a => { a.checked = checked })
}
function doConfirmAssets() {
  if (!ticket.value) return
  confirmAssets(ticket.value)
}

// --- Target Date edit / re-baseline (FR-003.8e/f, FR-003.8a) --------------
const editingTargetDate = ref(false)
const targetDateDraft = ref('')
const targetDateReasonDraft = ref('')
function startEditTargetDate() {
  if (!ticket.value) return
  targetDateDraft.value = ticket.value.targetDateISO ?? ''
  targetDateReasonDraft.value = ''
  editingTargetDate.value = true
}
function cancelTargetDateEdit() {
  editingTargetDate.value = false
}
/** Why Save is unavailable right now, or '' when it can go ahead. An unchanged date is blocked so the history never logs "Oct 6 to Oct 6". */
const targetDateSaveBlocker = computed(() => {
  if (!targetDateDraft.value) return 'Pick a date first.'
  if (targetDateDraft.value === (ticket.value?.targetDateISO ?? '')) return 'Pick a different date to save a change.'
  if (!targetDateReasonDraft.value.trim()) return 'Enter a reason for this change first.'
  return ''
})
function saveTargetDateEdit() {
  if (!ticket.value || targetDateSaveBlocker.value) return
  rebaselineTargetDate(ticket.value, targetDateDraft.value, targetDateReasonDraft.value.trim())
  editingTargetDate.value = false
}
// Only the 2 most recent re-baseline entries show inline - the full trail
// (every re-baseline already writes a matching one-line summary via
// pushHistory) is one click away in the Activity Log drawer rather than
// this card growing without bound on a ticket with a long correction trail.
const recentTargetDateHistory = computed(() => !ticket.value ? [] : [...ticket.value.targetDateHistory].reverse().slice(0, 2))

const itLockCardRef = ref<HTMLElement>()

// --- Auto-scroll to the What's Next card whenever the stage changes -
// otherwise, on a long stage (e.g. a full A5 asset table) the operator ends
// up scrolled toward the bottom of the page, and the next stage's shorter
// content renders above the fold with nothing visible where they're
// currently looking. Skipped on the very first render (immediate: false)
// so landing on the page doesn't itself trigger a jump.
//
// Only scrolls when the card actually needs it - a bare block:'start' scroll
// unconditionally re-aligns the card to the top of the viewport every single
// transition, which for a short stage near the bottom of a short page has
// nowhere further to align to and the browser just scrolls to its own
// document-height ceiling instead, reading as "always jumps to the bottom."
// Checking the card's current position first and only scrolling when it
// isn't already reasonably in view fixes that without losing the original
// long-stage case.
const whatsNextCardRef = ref<HTMLElement>()
// Anchored to the whole main column (gate tracker, banners, then the
// What's Next card), not just the What's Next card itself - reproduced
// live: anchoring to the card alone meant that whenever a banner above it
// (HRIS update, Overdue reminder, Transit delayed) was showing, the card's
// own top sat further down the page than the top of the actual stage
// section, so "scroll to the card" always scrolled further down than
// expected, cutting off the banners above and requiring a manual
// scroll-up to see the full context. Scrolling the section's own top
// (which never moves regardless of which banners are present for that
// stage) into view fixes that - it always lands at the top of the stage,
// which reads as "scrolls up" rather than "scrolls down" the way the
// card-only anchor did.
const stageSectionRef = ref<HTMLElement>()
const stickyPageHeaderRef = ref<HTMLElement>()
// A fixed `scroll-mt-*` guess (tried first: 64px for TopNavbar's own
// `sticky top-0 h-16`) still left this reported as "scrolls down too far, I
// have to scroll back up" - this page actually stacks a SECOND sticky
// header directly under the app-wide one (the ticket number/breadcrumb +
// phase stepper, `sticky top-16`, see its own ref below), and that one's
// height isn't a constant - it depends on how long the breadcrumb line is
// and whether it wraps. A static class can't account for that, so this
// computes the real combined covered height (both stickies) live off their
// actual rendered heights and scrolls by exactly that much, every time,
// instead of guessing a fixed offset.
function scrollToStageSection() {
  const el = stageSectionRef.value
  if (!el) return
  // The page header only sticks from the desktop breakpoint up, so below it only the 64px navbar covers content.
  const header = stickyPageHeaderRef.value
  const headerStuck = !!header && getComputedStyle(header).position === 'sticky'
  const coveredHeight = 64 + (headerStuck ? header.offsetHeight : 0)
  const targetTop = el.getBoundingClientRect().top + window.scrollY - coveredHeight
  window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
}
// Real bug, reproduced live: stepping from a long stage's panel to a
// shorter one left the page at whatever scroll position the long one was
// at - since the new, shorter panel doesn't reach that far down, the
// viewport showed blank space below it instead of the new stage's own
// content, which needed a manual scroll-up to even see. The previous
// "only scroll if not already roughly in view" check was trying to avoid
// jarring the operator on every stage change, but missed exactly this
// case; always scrolling the section's own top into view on a real stage
// change is standard wizard/stepper behavior and isn't jarring the way
// scrolling on every keystroke would be.
watch(stageKey, () => {
  nextTick(() => {
    if (stageKey.value === 'A11' && ticket.value?.deductionApplicable === true && caseDetailsCardRef.value) scrollToCaseDetails()
    else scrollToStageSection()
  })
})
function acknowledgeUpdate() {
  if (!ticket.value) return
  const needsReschedule = ticket.value.itLockNeedsReschedule
  acknowledgeHrisUpdate(ticket.value)
  // "Acknowledge" isn't just a dismissal when something's still unresolved -
  // it takes the operator straight to the IT Lock card so they can actually
  // confirm it, rather than clearing the banner and leaving the flag
  // sitting there with nothing pointing at it.
  if (needsReschedule) {
    nextTick(() => itLockCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
}
function doRescheduleItLock() {
  if (!ticket.value) return
  confirmItLockScheduling(ticket.value)
}
// FR-003.10: the Assets Confirmed card shows the ticket's real, live status
// (Pending Return, In Transit, Overdue Return, the post-receipt routing
// outcomes, Custodian Under Review, ...) via the same ticketStatusLabel/Tone
// the Overview list already uses - not a single hardcoded "Pending Return"
// that never changed once the ticket actually moved past A5. Only shown once
// assets are actually locked (FR-003.8c) - there's nothing to label before.
// The Assets Confirmed badge describes the ASSETS, not the ticket. FR-003.10's
// status model has no "Closed" asset status - once the ticket closes, the
// assets carry their post-receipt routing status (Returned Device Servicing /
// Returned Item Check / Forensic Review), or, if never routed, the last
// status they held before closure.
const assetsStatusLabel = computed(() => {
  const t = ticket.value
  if (!t) return ''
  if (t.status !== 'closed') return ticketStatusLabel(t)
  if (t.inspectionRoute) return INSPECTION_ROUTE_STATUS[t.inspectionRoute]
  return ticketStatusLabel({ ...t, status: 'open' })
})
const assetsStatusTone = computed(() => {
  const t = ticket.value
  if (!t) return 'open'
  if (t.status !== 'closed') return ticketStatusTone(t)
  if (t.inspectionRoute) return t.inspectionRoute === 'tampering' ? 'overdue' : 'routed'
  return ticketStatusTone({ ...t, status: 'open' })
})
const ASSET_STATUS_BADGE_CLASS: Record<string, string> = {
  routed: 'text-primary bg-primary/5 border-primary/25',
  open: 'text-amber-700 bg-amber-50 border-amber-200',
  holdoff: 'text-amber-700 bg-amber-50 border-amber-200',
  transit: 'text-blue-700 bg-blue-50 border-blue-200',
  overdue: 'text-red-700 bg-red-50 border-red-200',
  closed: 'text-dimmed bg-gray-100 border-default'
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
// undefined = use the one this stage maps to, a key/id = the one the operator
// swapped in, null = the operator removed it. The three states must stay
// apart: collapsing null into "use the default" made Remove do nothing.
const overrideTemplateKey = ref<string | null | undefined>(undefined)
const overrideFormId = ref<string | null | undefined>(undefined)
watch([stageKey, () => ticket.value?.reminderCount], () => { overrideTemplateKey.value = undefined; overrideFormId.value = undefined })

// B8's own Branch Confirmation Reminder - genuinely has no dedicated
// template (FR-003.12 defines no code for it), so this starts as a real
// empty state (AttachPicker) rather than a chip that only looks attached.
// Separate ref from overrideTemplateKey above since B8 can be on screen
// with no relation to whichever notice/reminder that one is tracking.
const overrideBranchTemplateKey = ref<string | null>(null)
const effectiveBranchTemplate = computed(() => overrideBranchTemplateKey.value ? templateForKey(overrideBranchTemplateKey.value) : null)
watch(stageKey, () => { overrideBranchTemplateKey.value = null })

// Every Active email template, the same set the Templates page lists: the
// ones created there too (CUSTOM_TEMPLATE_IDS), and not the deleted ones.
// The mode is in the label because a Resignation template exists once per
// mode, and only the operator knows which one this send needs.
const activeTemplateOptions = computed(() => {
  const seen = new Set<string>()
  return [...CUSTOM_TEMPLATE_IDS, ...TEMPLATE_GROUPS.flatMap(g => g.keys).filter(key => TEMPLATES[key])]
    .filter(key => !DELETED_TEMPLATE_KEYS.has(key) && !seen.has(key) && seen.add(key))
    .map(key => ({ key, rt: ensureTemplateRuntime(key) }))
    .filter(({ rt }) => rt.status === 'active')
    .map(({ key, rt }) => ({ label: `${rt.name || 'Untitled'} (${rt.mode === 'onsite' ? 'Onsite' : 'Remote'})`, value: key }))
})
const activeFormOptions = computed(() => RETRIEVAL_FORMS.filter(f => f.status === 'active').map(f => ({ label: f.name, value: f.id })))

const effectiveTemplateKey = computed(() => overrideTemplateKey.value === undefined ? sendTemplateKey.value : overrideTemplateKey.value)
const effectiveTemplate = computed(() => effectiveTemplateKey.value ? templateForKey(effectiveTemplateKey.value) : null)

// --- Email content preview - reuses the same FullPreviewModal a template's
// own version history already previews with (real prose-styled rendering,
// not a cramped inline snippet), filled with this ticket's own real data
// instead of generic samples wherever a real value is on hand. Shared by
// every stage that sends a template (A6/B9/A8).
// Real per-ticket values only - no generic-sample fallback baked in here, so
// this is the one place that can tell a code the ticket genuinely supplied a
// value apart from one that's merely being papered over for the preview (see
// ticketResolvedCodes/ticketSampleValues below, and the Placeholder Check
// feature that reads ticketResolvedCodes to draw that same distinction for
// the operator attaching a template).
const ticketRealValues = computed<Partial<Record<string, string>>>(() => {
  if (!ticket.value) return {}
  const t = ticket.value
  // Once Step 5 (Equipment) has a real per-case selection, ASSET_NAME/
  // ASSET_TAG/SERIAL_NUMBER prefer that pick (first selected item, same
  // single-row-per-token convention every template in this app already
  // uses) over the ticket's own first asset - T22-T25/F1-F3 are the real
  // consumers of this, since those are the only templates that print
  // per-case equipment rather than the whole retrieval's general asset.
  const asset = t.deductionCaseAssetSerials.length
    ? (t.assets.find(a => a.serial === t.deductionCaseAssetSerials[0]) ?? t.assets[0])
    : t.assets[0]
  const courier = courierProviderById(t.courierProviderId)
  const checkedAssets = t.assets.filter(a => a.checked)
  return {
    TM_FULL_NAME: t.employee.name,
    // Case Details' own first-name override (Step 1) reaches the emails too.
    TM_FIRST_NAME: deductionCaseFirstName.value || (t.employee.name.split(' ')[0] ?? t.employee.name),
    // Plain number, same as Case Details shows - the "EMP-" prefix is this
    // seed data's internal key, not what a real HRIS record prints.
    EMPLOYEE_ID: t.employee.id.replace(/^\D+/, ''),
    TM_EMAIL: t.employee.email,
    TM_CONTACT_NUMBER: t.contact.number,
    TM_PRESENT_ADDRESS: effectiveTeamMemberAddress(t),
    CLIENT_NAME: t.employee.client,
    LEADERSHIP_COACH: t.employee.leadershipCoach,
    ALTERNATE_CONTACT_NAME: t.contact.altName,
    ALTERNATE_CONTACT_NUMBER: t.contact.altNumber,
    APR_REF: t.reference,
    TICKET_CREATED_DATE: fmtDate(t.createdAt),
    // Notice dates: the ticket's creation date, today (the day a notice goes
    // out), the first send in the Activity Log, and the target date as it
    // stood before any re-baseline.
    NOTICE_DATE: fmtDate(t.createdAt),
    DATE_OF_THIS_NOTICE: fmtDate(new Date().toISOString()),
    DATE_OF_ORIGINAL_NOTICE: derivedReturnRequestedDate(t) ? fmtDate(derivedReturnRequestedDate(t)) : undefined,
    ORIGINAL_TARGET_DATE: (t.targetDateHistory[0]?.previousDateISO ?? t.targetDateISO) ? fmtDate(t.targetDateHistory[0]?.previousDateISO ?? t.targetDateISO) : undefined,
    // FR-003.2 path matrix. The acknowledgment is due by the path's Day-0
    // deadline: the Last Working Day for Resignation and End of Contract,
    // the Recall Effective Date for Recalled (it adopts the End of Contract
    // rule), the next working day for Immediate Resignation onsite, 3
    // calendar days from notice for Immediate Resignation remote, and the
    // target date (clock starts at Gate 3) for Unexplained Absence.
    ACKNOWLEDGMENT_DUE_DATE: (() => {
      const due = acknowledgmentDueISO(t)
      return due ? fmtDate(due) : undefined
    })(),
    // FR-004.2: a token-based public link, no login required. The token is a
    // random per-ticket value, never the internal ticket id (which is guessable).
    ACKNOWLEDGMENT_LINK: `${ACKNOWLEDGMENT_HOST}/${t.acknowledgmentToken || t.id}`,
    // FR-003.2: Day-0 anchor of the Recalled paths, entered at creation.
    RECALL_EFFECTIVE_DATE: t.recallEffectiveDate ? fmtDate(t.recallEffectiveDate) : undefined,
    // Immediate Resignation caps escalation at 3 calendar days from notice
    // (P03, P04); every other path's escalation clock hangs off the target
    // date (FR-003.8a).
    ESCALATION_DEADLINE: (() => {
      const due = t.reason === 'immediate-resignation' ? addDaysISO(t.createdAt, 3) : t.targetDateISO
      return due ? fmtDate(due) : undefined
    })(),
    // Entered on the Courier & Shipping card or at B11 Confirm In Transit.
    TRACKING_NUMBER: t.trackingNumber || undefined,
    TRACKING_LINK: t.trackingLink || undefined,
    DAYS_OVERDUE: isOverdueReturn(t) && t.targetDateISO
      ? String(Math.max(1, Math.round((Date.now() - new Date(`${t.targetDateISO}T00:00:00`).getTime()) / 86400000)))
      : undefined,
    RETRIEVAL_REASON: REASON_LABELS[t.reason],
    RETURN_MODE: t.mode === 'onsite' ? 'Onsite' : 'Remote',
    // An empty date stays undefined so the send guardrail flags it, instead of
    // the text "Not set" counting as a real value.
    TARGET_RETURN_DATE: t.targetDateISO ? fmtDate(t.targetDateISO) : undefined,
    TARGET_DISPATCH_DATE: t.targetDateISO ? fmtDate(t.targetDateISO) : undefined,
    LAST_WORKING_DAY: t.lwd ? fmtDate(t.lwd) : undefined,
    SEPARATION_DATE: t.sep ? fmtDate(t.sep) : undefined,
    // With several confirmed assets the retrieval emails and forms print one
    // row each (expandTicketAssets), every value in its own row. These stay
    // single values (never several joined into one token); they only mark
    // the codes as having ticket data. Charging keeps its picked item.
    ASSET_NAME: asset?.model,
    ASSET_TAG: asset?.assetTag,
    SERIAL_NUMBER: asset?.serial,
    ASSET_QTY: String(t.assets.length),
    ASSET_TABLE: checkedAssets.length ? `Table of ${checkedAssets.length} confirmed asset${checkedAssets.length === 1 ? '' : 's'}, one row each` : undefined,
    ASSET_TABLE_QTY: checkedAssets.length ? `Table of ${checkedAssets.length} confirmed asset${checkedAssets.length === 1 ? '' : 's'}, name and quantity only` : undefined,
    COURIER_NAME: courier?.name,
    COURIER_ACCOUNT_NUMBER: courier?.accountNumber,
    ACCOUNT_MANAGER_NAME: courier?.accountManager,
    ACCOUNT_MANAGER_EMAIL: courier?.accountManagerEmail,
    BRANCH_NAME: t.courierBranchName,
    BRANCH_ADDRESS: t.courierBranchAddress,
    // A11 Post-Retrieval Charging (T22-T25/F1-F3) - Case Details Steps 2-4's
    // own fields, read the same "derived unless overridden" way the Case
    // Details panel itself displays them (deductionCaseOfficer/
    // deductionCaseReturnRequested/deductionCaseReceived below are computed
    // fallbacks, not raw ticket fields - see their own comments above).
    CASE_OFFICER: deductionCaseOfficer.value,
    // Nothing in the current flow assigns an ATD number, so without this
    // the token was always unresolved and the send guardrail blocked every
    // Determination & Charge / Settlement send. Deterministic per ticket:
    // ATD-<created year>-<ticket no.>.
    ATD_REFERENCE: t.atdReference || `ATD-${new Date(t.createdAt).getFullYear()}-${String(t.ticketNumber).padStart(4, '0')}`,
    ASSET_OWNER: assetOwnerInfo(t).name,
    DATE_RETURN_REQUESTED: deductionCaseReturnRequested.value ? fmtDate(deductionCaseReturnRequested.value) : undefined,
    DATE_RECEIVED: deductionCaseReceived.value ? fmtDate(deductionCaseReceived.value) : undefined,
    DATE_ASSESSED: t.deductionCaseAssessedDate ? fmtDate(t.deductionCaseAssessedDate) : undefined,
    DATE_BUYOUT_ELECTION: t.deductionCaseBuyoutElectionDate ? fmtDate(t.deductionCaseBuyoutElectionDate) : undefined,
    QUOTATION_EXPECTED_BY: t.deductionCaseQuotationExpectedDate ? fmtDate(t.deductionCaseQuotationExpectedDate) : undefined,
    HEAR_BACK_BY: t.deductionCaseHearBackByDate ? fmtDate(t.deductionCaseHearBackByDate) : undefined,
    RESPONSE_DUE_TM: t.deductionCaseResponseDueDate ? fmtDate(t.deductionCaseResponseDueDate) : undefined,
    AMOUNT_BASIS: t.deductionCaseAmountBasis ? DEDUCTION_AMOUNT_BASIS_LABELS[t.deductionCaseAmountBasis] : undefined,
    // Prefer the tracked quotation reference (#30) if one was recorded; otherwise fall back to the free-text supporting doc ref the officer typed.
    SUPPORTING_DOC_REF: t.quotationReference?.trim() || t.deductionCaseSupportingDocRef,
    AMOUNT_FIGURES: t.deductionCaseAmountFigures,
    AMOUNT_WORDS: t.deductionCaseAmountWords
  }
})
// Codes this specific ticket actually supplied a real, non-empty value for -
// everything else in ticketSampleValues below is generic filler standing in
// for data this ticket doesn't have (or was never modeled as a ticket field
// at all, e.g. Asset Team contact info - see ORG_CONSTANT_TOKENS).
const ticketResolvedCodes = computed(() => new Set(
  Object.entries(ticketRealValues.value).filter(([, v]) => !!v).map(([k]) => k)
))
// Only org-wide constants (Asset Team contact details etc.) come from
// SAMPLE_VALUES now - a per-ticket code this ticket has no real value for is
// left unresolved and renders as its own {{CODE}} token, never as generic
// sample data that would read as if it were this ticket's.
const ticketSampleValues = computed<Record<string, string>>(() => ({
  ...Object.fromEntries(Object.entries(SAMPLE_VALUES).filter(([k]) => ORG_CONSTANT_TOKENS.has(k))),
  ...Object.fromEntries(Object.entries(ticketRealValues.value).filter((e): e is [string, string] => !!e[1]))
}))
/**
 * Opens a form preview in a new tab with this ticket's own values. The
 * preview page has no ticket context of its own, so the resolved values are
 * handed over through localStorage (keyed by ticket) before opening.
 */
/** One row per asset selected in Case Details > Equipment, for the charging emails' and forms' equipment tables. */
const caseAssetRows = computed<Record<string, string>[]>(() => {
  const t = ticket.value
  if (!t) return []
  return t.assets
    .filter(a => t.deductionCaseAssetSerials.includes(a.serial))
    .map(a => ({ ASSET_TAG: a.assetTag, SERIAL_NUMBER: a.serial, ASSET_NAME: a.model, ASSET_CONDITION: t.deductionCaseAssetNotes?.[a.serial]?.trim() ?? '' }))
})
/** Charging content with its equipment table expanded to the case's assets. */
const caseHtml = (html: string | null | undefined) => expandCaseAssetRows(ticket.value?.equipmentNotReturned ? omitReceivedDate(html ?? '') : (html ?? ''), caseAssetRows.value)
const withCaseRows = <T extends { subject: string, body: string }>(tpl: T | null | undefined) => tpl ? { ...tpl, body: caseHtml(tpl.body) } : tpl
function openFormPreview(formId: string, withCaseAssets = false) {
  if (!ticket.value) return
  try {
    const values: Record<string, string> = { ...ticketSampleValues.value, __TICKET_ASSET_ROWS: JSON.stringify(ticketAssetLines.value) }
    if (withCaseAssets) { values.__CASE_ASSET_ROWS = JSON.stringify(caseAssetRows.value); if (ticket.value.equipmentNotReturned) values.__CASE_NOT_RETURNED = '1' }
    localStorage.setItem(`ams:formPreviewValues:${ticket.value.id}`, JSON.stringify(values))
  } catch { /* storage unavailable: lasts for this session only */ }
  navigateTo(`/form-preview?formId=${encodeURIComponent(formId)}&ref=${encodeURIComponent(ticket.value.reference ?? '')}&mode=${ticket.value.mode}&ticket=${encodeURIComponent(ticket.value.id)}`, { open: { target: '_blank' } })
}
/** Every confirmed asset on the ticket, for the retrieval emails' and forms' asset tables (before confirmation, all listed assets). */
const ticketAssetLines = computed(() => (ticket.value?.assets ?? []).filter(a => a.checked).map(a => ({ name: a.model, tag: a.assetTag, serial: a.serial })))
const assetHtml = (html: string, wrap?: (code: string, value: string) => string) => expandTicketAssets(html, ticketAssetLines.value, wrap)
/** True when this code is filled once per asset row, so the Placeholder Check describes it per row instead of showing one value. */
const ASSET_ROW_CODES = new Set(['ASSET_NAME', 'ASSET_TAG', 'SERIAL_NUMBER', 'ASSET_QTY'])
const previewOpen = ref(false)
const previewSubject = ref('')
const previewBody = ref('')
// Same highlight/tooltip/click-to-sync mechanism the Templates > Email
// editor's own PreviewPane.vue already uses (wrapTokens, .tok-hl) - not a
// separate implementation, just applied here too, with an extra per-status
// color layered on (see placeholderStatusFor/tok-hl--* in main.css) since
// this preview, unlike the editor's, has a real ticket to check each
// placeholder's value against.
function highlightForTicket(html: string): string {
  const status = (code: string) => placeholderStatusFor(code, ticketResolvedCodes.value)
  // Asset rows are filled per asset, each value keeping its own highlight span
  // (same markup wrapTokens writes), so clicking a token in the Placeholder
  // Check lights up every row that prints it.
  // The span's tooltip attribute holds "{{CODE}}", so its braces are written as
  // entities (the browser reads them back as braces). Otherwise the later
  // token passes would match them again and expand or re-wrap the row.
  const wrapRow = (code: string, value: string) => wrapTokens(`{{${code}}}`, { [code]: value }, status)
    .replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;')
  return wrapTokens(assetHtml(html, wrapRow), ticketSampleValues.value, status)
}
// Real bug, reproduced live: the shared [data-tip-name]:hover::after CSS
// tooltip gets clipped the moment a hovered value sits near the edge of the
// preview modal's own scrollable body (overflow-y-auto always clips an
// absolutely-positioned descendant, no matter its z-index). This tooltip
// lives outside that scroll container entirely (appended to <body>,
// position: fixed, positioned via getBoundingClientRect) so it can never be
// clipped - see the .ticket-preview-tip / .ticket-email-preview override in
// main.css for the other half of this.
let previewTipEl: HTMLDivElement | null = null
function onPreviewTipOver(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest?.('.ticket-email-preview [data-tip-name]') as HTMLElement | null
  if (!target || !previewTipEl) return
  const name = target.dataset.tipName ?? ''
  const code = target.dataset.tipCode ?? ''
  previewTipEl.textContent = ''
  const l1 = document.createElement('div')
  l1.textContent = name
  const l2 = document.createElement('div')
  l2.textContent = code
  l2.style.opacity = '0.7'
  previewTipEl.append(l1, l2)
  const rect = target.getBoundingClientRect()
  previewTipEl.style.left = `${rect.left + rect.width / 2}px`
  previewTipEl.style.top = `${rect.top - 7}px`
  previewTipEl.style.display = 'block'
}
function onPreviewTipOut(e: MouseEvent) {
  if (!previewTipEl) return
  const related = (e.relatedTarget as HTMLElement | null)
  if (related?.closest?.('.ticket-email-preview [data-tip-name]')) return
  previewTipEl.style.display = 'none'
}
onMounted(() => {
  previewTipEl = document.createElement('div')
  previewTipEl.className = 'ticket-preview-tip'
  previewTipEl.style.display = 'none'
  document.body.appendChild(previewTipEl)
  document.addEventListener('mouseover', onPreviewTipOver)
  document.addEventListener('mouseout', onPreviewTipOut)
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseover', onPreviewTipOver)
  document.removeEventListener('mouseout', onPreviewTipOut)
  previewTipEl?.remove()
  previewTipEl = null
})
function openTemplatePreview(tpl: { subject: string, body: string } | null | undefined) {
  if (!tpl) return
  previewSubject.value = highlightForTicket(tpl.subject)
  previewBody.value = highlightForTicket(tpl.body)
  previewOpen.value = true
}
/**
 * What's still previewable on a closed ticket's current stage, rendered as
 * the exact same chip (EmailAttachSection, in its own `read-only` mode) as
 * the live/open state uses - not a separate plain-text-link row, which was
 * flagged live as an unwanted second UI for the same thing ("it should be
 * through the eye icon on the chip which already exists"). The chip itself
 * still has to sit outside the `inert` wrapper below (an ancestor's `inert`
 * can't be selectively bypassed for one descendant), so this is a second,
 * read-only instance of the same chip - not the live one relocated.
 */
const readOnlyAttachPreviews = computed(() => {
  if (!ticket.value) return []
  const chips: { key: string, kind: 'attach' | 'file', name: string, subtitle: string, icon: string, previewTooltip: string, previewIcon: string, action: () => void }[] = []
  if (meta.value?.kind === 'template-send') {
    if (effectiveTemplate.value) chips.push({ key: 'email', kind: 'attach', name: effectiveTemplate.value.name, subtitle: effectiveTemplate.value.description, icon: 'i-lucide-mail', previewTooltip: 'Preview email', previewIcon: 'i-lucide-eye', action: () => openTemplatePreview(effectiveTemplate.value) })
    if (stageKey.value !== 'B9' && effectiveForm.value) chips.push({ key: 'form', kind: 'attach', name: effectiveForm.value.name, subtitle: effectiveForm.value.description, icon: 'i-lucide-file-text', previewTooltip: 'Preview form in new tab', previewIcon: 'i-lucide-eye', action: () => openFormPreview(effectiveForm.value!.id) })
  } else if (meta.value?.kind === 'reminders' && effectiveReminderTemplate.value) {
    chips.push({ key: 'email', kind: 'attach', name: effectiveReminderTemplate.value.name, subtitle: effectiveReminderTemplate.value.description, icon: 'i-lucide-mail', previewTooltip: 'Preview email', previewIcon: 'i-lucide-eye', action: () => openTemplatePreview(effectiveReminderTemplate.value) })
  } else if (meta.value?.kind === 'evidence') {
    // A10 Proof-of-Receipt/Condition Photos - real uploaded files, not a
    // template/form reference, so these use FileAttachChip instead of
    // EmailAttachSection, but the same "still viewable read-only once
    // closed" reasoning applies (reported live: these were unviewable on a
    // closed ticket, same as the email/form chips above).
    if (proofFile.value) chips.push({ key: 'proof', kind: 'file', name: proofFile.value.name, subtitle: 'Proof-of-Receipt', icon: 'i-lucide-file-text', previewTooltip: 'Open file', previewIcon: 'i-lucide-eye', action: () => openFile(proofFile.value) })
    if (conditionFile.value) chips.push({ key: 'condition', kind: 'file', name: conditionFile.value.name, subtitle: 'Condition Photos', icon: 'i-lucide-file-text', previewTooltip: 'Open file', previewIcon: 'i-lucide-eye', action: () => openFile(conditionFile.value) })
  }
  return chips
})
// Persists (toggles) rather than auto-fading, same as the Templates
// editor's own useTokenHighlight - clicking the same token again (or
// closing the preview) clears it, but it otherwise stays highlighted
// indefinitely instead of flashing out after a fixed span of time.
const activePlaceholderToken = ref<string | null>(null)
watch(activePlaceholderToken, (code) => {
  nextTick(() => {
    document.querySelectorAll('.ticket-email-preview [data-token]').forEach((el) => {
      el.classList.toggle('tok-active', !!code && (el as HTMLElement).dataset.token === code)
    })
  })
})
watch(previewOpen, (open) => { if (!open) activePlaceholderToken.value = null })
/** Opens (or re-targets) the preview modal to a specific template, then scrolls the given {{CODE}}'s highlighted span into view - used by the Placeholder Check drawer's own entries (see placeholderCheckSourceEmail below) so "where does this actually print" is one click away instead of manual scanning. */
function locatePlaceholderInPreview(code: string) {
  const source = placeholderCheckSourceEmail.value
  if (!source) return
  openTemplatePreview(source)
  activePlaceholderToken.value = code
  nextTick(() => {
    document.querySelector<HTMLElement>(`.ticket-email-preview [data-token="${code}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// --- Placeholder Check - the operator's own way to catch a placeholder that
// can't actually be filled for THIS ticket before it goes out: either a real
// per-ticket field this ticket has no data for (falls back to generic sample
// text), or a placeholder that isn't a recognized field at all (a typo, or
// one invented directly in the template/form editor) - which prints as
// nothing in the real sent document (see resolveTokensForPrint). Shared by
// every email/form attachment chip across this workspace (A6/B9/A8/overdue).
const placeholderCheckOpen = ref(false)
const placeholderCheckTitle = ref('')
// Mirrors the icon+blue-text treatment DrawerContextBadge.vue already uses
// for a template's name in the Templates > Email editor's own Placeholder
// Library drawer - same idea here, just swapping to a form's own icon when
// this check is for a form attachment instead of an email.
const placeholderCheckIcon = ref('i-lucide-mail')
const placeholderCheckEntries = ref<PlaceholderCheckEntry[]>([])
// Set only when this check is for an email template (not a form - forms open
// their own /form-preview tab, there's no in-page modal to sync to) - lets a
// drawer entry jump straight to where it actually prints (see
// locatePlaceholderInPreview above).
const placeholderCheckSourceEmail = ref<{ subject: string, body: string } | null>(null)
function placeholderIssueCount(html: string): number {
  return checkPlaceholders(html, ticketResolvedCodes.value, ticketSampleValues.value)
    .filter(e => e.status === 'missing' || e.status === 'unrecognized').length
}
function openPlaceholderCheck(title: string, html: string, icon = 'i-lucide-mail', sourceEmail: { subject: string, body: string } | null = null) {
  placeholderCheckTitle.value = title
  placeholderCheckIcon.value = icon
  placeholderCheckEntries.value = checkPlaceholders(html, ticketResolvedCodes.value, ticketSampleValues.value).map(e =>
    ASSET_ROW_CODES.has(e.code) && e.status !== 'unrecognized' && ticketAssetLines.value.length > 0 && !html.includes('{{ASSET_CONDITION}}')
      ? { ...e, previewValue: ticketAssetLines.value.length === 1 ? e.previewValue : `Filled in each row, ${ticketAssetLines.value.length} assets` }
      : e)
  placeholderCheckSourceEmail.value = sourceEmail
  placeholderCheckOpen.value = true
}
// Builds the "{{CODE}}" display string in script rather than as template
// markup - literal, adjacent {{ }} pairs inside a .vue template's mustache
// expression confuse Vue's own delimiter parser (it matches the FIRST "}}"
// it finds, non-greedy), so this keeps that syntax out of the template text.
function curly(code: string) {
  return '{{' + code + '}}'
}
// `iconClass` is a literal Tailwind class (not built from `color` at
// render time) so the JIT compiler can actually see and generate it - a
// dynamic `text-${color}` string is invisible to it and would silently
// render with no color at all.
// `barClass` is a literal Tailwind class (not built from `color` at render
// time, same reasoning as `iconClass` below it) - the JIT compiler can't see
// a `bg-${color}-50`-style dynamic string, so that would silently render
// with no background at all.
const PLACEHOLDER_STATUS_META: Record<PlaceholderCheckEntry['status'], { label: string, color: 'success' | 'warning' | 'error' | 'neutral', icon: string, iconClass: string, barClass: string }> = {
  resolved: { label: 'Has ticket value', color: 'success', icon: 'i-lucide-circle-check', iconClass: 'text-success', barClass: 'bg-success/10' },
  'org-constant': { label: 'Fixed company detail', color: 'neutral', icon: 'i-lucide-building-2', iconClass: 'text-muted', barClass: 'bg-elevated' },
  missing: { label: 'No data on this ticket', color: 'warning', icon: 'i-lucide-triangle-alert', iconClass: 'text-warning', barClass: 'bg-warning/10' },
  unrecognized: { label: 'Unrecognized, prints blank', color: 'error', icon: 'i-lucide-circle-x', iconClass: 'text-error', barClass: 'bg-error/10' }
}
// Most-actionable-first, not extraction order (previously a "missing"/
// "unrecognized" entry needing attention could land anywhere in the list,
// interleaved with entries that need no action at all - grouped by status so
// like statuses sit together and the ones actually worth acting on surface
// first).
const PLACEHOLDER_STATUS_ORDER: PlaceholderCheckEntry['status'][] = ['unrecognized', 'missing', 'resolved', 'org-constant']
const placeholderCheckGroups = computed(() => PLACEHOLDER_STATUS_ORDER
  .map(status => ({ status, entries: placeholderCheckEntries.value.filter(e => e.status === status) }))
  .filter(g => g.entries.length))

// --- B8 Branch confirmation capture (remote only) - browses the same
// Courier Providers list as Master Data, auto-selecting the recommended
// provider but letting the operator pick an alternate (FR-003.9). Branch
// name and branch address are two distinct fields per FR-003.9(a), not one
// freeform line - and per that same ref, "the exact branch name NEAREST THE
// TEAM MEMBER", so branch is now a selection against a real branch
// directory (see COURIER_BRANCHES - as-is, see its own doc comment) rather
// than a manual text field, auto-suggested off the team member's own R24
// address rather than typed from memory. -----------------------------------
const courierOptions = computed(() => COURIER_PROVIDERS.filter(p => p.status === 'active').map(p => ({ label: p.name, value: p.id, priority: p.priority })))
const selectedCourierId = computed({
  get: () => ticket.value?.courierProviderId ?? undefined,
  set: (v: string | null | undefined) => { if (ticket.value && v) { ticket.value.courierProviderId = v; autoSelectNearestBranch() } }
})
const selectedCourier = computed(() => courierProviderById(selectedCourierId.value ?? null))

const branchOptions = computed(() => branchesForCourier(selectedCourierId.value ?? null).map(b => ({ label: b.name, value: b.id })))
const selectedBranchId = ref<string | null>(null)
const selectedBranch = computed(() => courierBranchById(selectedBranchId.value))
// True whenever the current pick is still the system's own nearest-branch
// suggestion (FR-003.9(a)'s "nearest the team member") rather than something
// the operator picked themselves - drives the "Auto-selected" cue so the
// operator knows *why* this branch is filled in, not just that it is.
const nearestBranch = computed(() => ticket.value ? nearestBranchFor(selectedCourierId.value ?? null, ticket.value.employee.address) : null)
const branchIsAutoSelected = computed(() => !!selectedBranchId.value && !!nearestBranch.value && selectedBranchId.value === nearestBranch.value.id)
function autoSelectNearestBranch() {
  selectedBranchId.value = nearestBranch.value?.id ?? null
}
watch(selectedCourierId, () => autoSelectNearestBranch(), { immediate: true })

const branchSubstituted = ref(false)
// FR-003.9(b): the confirmation call is the primary capture mechanism, the
// email reply is the fallback - recorded explicitly, not assumed.
const branchCaptureMethod = ref<'call' | 'email'>('call')
const useManualEmailBranch = ref(false)
const manualEmailBranch = ref('')
// FR-003.9(e): flag once the LWD is close and the branch still isn't captured.
const branchUrgent = computed(() => !!ticket.value && branchCaptureUrgent(ticket.value))
// The urgent banner's own wording has to match the real relationship between
// today and the LWD, not just assert "approaching" unconditionally - once the
// LWD has actually passed, saying it's still "approaching" is simply wrong,
// not just imprecise, and was reported as such against a real ticket.
const branchLwdPassed = computed(() => {
  if (!ticket.value?.lwd) return false
  return new Date(`${ticket.value.lwd}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0)
})
// FR-003.9(f): on non-response, the operator may substitute the branch
// nearest the address on file and proceed, with the substitution recorded -
// the branch is already that nearest-address suggestion by default, so this
// just flags the record rather than re-deriving anything.
function useAddressOnFile() {
  autoSelectNearestBranch()
  branchSubstituted.value = true
}
/**
 * Send guardrail: nothing goes out to a team member while an attached email
 * or form still has a placeholder this ticket can't fill (or one that isn't
 * a real field) - a raw {{TOKEN}} in a sent notice is never acceptable.
 * Returns true when it's safe to send; otherwise warns and returns false.
 */
function canSendResolved(...htmls: (string | null | undefined)[]): boolean {
  const n = htmls.reduce((sum, h) => sum + (h ? placeholderIssueCount(h) : 0), 0)
  if (!n) return true
  // Demo bypass (Simulation Control): let it through, but say so.
  if (allowUnresolvedSends.value) {
    toast.add({ title: 'Sent with unresolved placeholders', description: 'Demo bypass is on.', icon: 'i-lucide-flask-conical', color: 'info' })
    return true
  }
  toast.add({
    title: `Resolve ${n} placeholder${n === 1 ? '' : 's'} before sending`,
    description: 'Fill in the missing values first.',
    icon: 'i-lucide-shield-alert',
    color: 'warning'
  })
  return false
}
const tplHtml = (t: { subject: string, body: string } | null | undefined) => t ? t.subject + t.body : ''
const formHtml = (f: { id: string } | null | undefined) => f ? (RETRIEVAL_FORM_CONTENT[f.id] ?? '') : ''
function doSendBranchRequest() {
  if (!ticket.value) return
  if (!canSendResolved(tplHtml(effectiveBranchTemplate.value))) return
  sendBranchRequest(ticket.value, overrideBranchTemplateKey.value)
  revealSentBanner()
}
function doMarkBranchReplyReceived() {
  if (!ticket.value) return
  markBranchReplyReceived(ticket.value)
}
const branchConfirmDisabled = computed(() => {
  if (!selectedCourierId.value || !selectedBranchId.value) return true
  // The email fallback can't be confirmed as the team member's own word
  // until a reply is actually in - unless the operator is explicitly
  // recording a non-response substitution instead (FR-003.9(f)).
  if (branchCaptureMethod.value === 'email' && !branchSubstituted.value && !ticket.value?.branchRequestReplyReceived) return true
  return false
})
const branchConfirmDisabledReason = computed(() => {
  if (!selectedCourierId.value || !selectedBranchId.value) return 'Select a courier and branch first.'
  if (branchCaptureMethod.value === 'email' && !branchSubstituted.value && !ticket.value?.branchRequestReplyReceived) {
    return "Mark the team member's email reply as received, or use the nearest branch on file instead."
  }
  return ''
})
function doConfirmBranch() {
  if (!ticket.value || !selectedCourierId.value || !selectedBranch.value) return
  confirmCourierBranch(ticket.value, selectedCourierId.value, selectedBranch.value.name, selectedBranch.value.address, branchCaptureMethod.value, branchSubstituted.value)
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
  if (overrideFormId.value === null) return null
  if (overrideFormId.value) return RETRIEVAL_FORMS.find(f => f.id === overrideFormId.value) ?? null
  return attachedForm.value
})

/** After a send, bring the sent banner (the confirmation) into view: the Send button sits low in the panel, so the banner that replaces it can land above the visible area. */
function revealSentBanner() {
  nextTick(() => setTimeout(() => document.querySelector('[data-sent-banner]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80))
}
/** A send goes out with its email. If the operator removed it, say so instead of sending nothing. */
function requireAttachedEmail(attached: unknown): boolean {
  if (attached) return true
  toast.add({ title: 'Attach an email first', description: 'Pick the email template this send should use.', icon: 'i-lucide-mail', color: 'warning' })
  return false
}
function sendNotice() {
  if (!ticket.value || !meta.value) return
  if (!requireAttachedEmail(effectiveTemplate.value)) return
  if (!canSendResolved(tplHtml(effectiveTemplate.value), stageKey.value === 'B9' ? '' : formHtml(effectiveForm.value))) return
  const label = stageKey.value === 'B9' ? 'Courier endorsement sent' : 'Retrieval notice sent (email + SMS)'
  pushHistory(ticket.value, label, 'send')
  useManualEmail.value = false
  // No advanceStage here: the sent banner (templateSendRecord) takes over this
  // stage's panel, and the Continue button on it moves the ticket on.
  revealSentBanner()
}
// --- Gate banner - FR-003.5's own "recorded event" is deliberately light
// (a dated entry with the recording actor), never a reference number or an
// uploaded file - a required-file gate was a real, corrected misstep, not
// what the spec asks for. -----------------------------------------------
const gateNoteDrafts = reactive<Record<number, string>>({})
// Collapsed by default so this advisory tracker doesn't compete for space
// with the actual stage content below it.
const gateBannerOpen = ref(false)
function recordGate(n: number) {
  if (!ticket.value) return
  releaseGate(ticket.value, n, gateNoteDrafts[n])
  gateNoteDrafts[n] = ''
}
/** Drops the "Gate N - " prefix for display in the Approval Gates disclosure only - GATE_STEPS' own label (used verbatim elsewhere, e.g. the overflow menu) keeps it; this is purely a per-step-title cosmetic per explicit feedback. */
function stripGateLabel(label: string): string {
  return label.replace(/^Gate \d+\s*-\s*/, '')
}
/**
 * P&C Acknowledgement's header title, made dynamic per explicit feedback
 * (2026-09-30): a fixed generic title read fine for a single gate but was
 * ambiguous on a 3-gate Unexplained Absence ticket, where the meaningful
 * thing to show is *which* gate is currently outstanding - e.g. surfacing
 * "Return-to-Work Notice and Notice to Explain" once Gate 1 is released and
 * Gate 2 becomes the one P&C still needs to confirm. Falls back to the
 * generic umbrella title once every applicable gate has been released (there
 * is no longer a "current" one to name).
 */
const gateHeaderTitle = computed(() => {
  if (!ticket.value || ticket.value.gatesReleased >= ticket.value.gateCount) return 'P&C Acknowledgement'
  const current = GATE_STEPS.find(g => g.n === ticket.value!.gatesReleased + 1)
  return current ? stripGateLabel(current.label) : 'P&C Acknowledgement'
})
function sendSafekeeping() {
  if (!ticket.value) return
  pushHistory(ticket.value, 'Equipment Safekeeping Request sent - no deadline, no consequence', 'send')
  toast.add({ title: 'Safekeeping request sent', description: 'Equipment Safekeeping Request logged.', icon: 'i-lucide-shield', color: 'info' })
}

// --- A7 Call Confirmation --------------------------------------------------
const callAtCap = computed(() => (ticket.value?.callAttempts.length ?? 0) >= 3)
const callAnsweredYet = computed(() => !!ticket.value?.callAttempts.some(a => a.outcome === 'Answered - confirmed'))
function logCall(outcome: 'No answer' | 'Answered - confirmed') {
  if (!ticket.value) return
  ticket.value.callAttempts.push({ when: fmtDateTime(new Date().toISOString()), outcome })
  if (outcome === 'Answered - confirmed') {
    ticket.value.contact.numberVerified = true
    pushHistory(ticket.value, 'Call attempt logged: answered - contact number confirmed active', 'call')
  } else {
    pushHistory(ticket.value, `Call attempt logged: no answer (${ticket.value.callAttempts.length} of 3)`, 'call')
    // The third unanswered call is where the SMS follow-up starts. The ticket has not moved on yet.
    if (ticket.value.callAttempts.length >= 3 && !callAnsweredYet.value) pushHistory(ticket.value, 'Call confirmation attempts exhausted (3 of 3, unanswered), SMS follow-up next', 'call')
  }
}
function continueFromCall() {
  if (!ticket.value) return
  if (callAtCap.value && !callAnsweredYet.value) pushHistory(ticket.value, ticket.value.smsSentAt ? 'Continued without a call confirmation, after the SMS follow-up' : 'Continued without a call confirmation', 'call')
  // The actual, real, deterministic root cause of "call attempts don't show
  // in read-only/closed mode" - reported over and over, and not a storage
  // race at all: this used to wipe the just-logged attempts (and the SMS
  // sent flag) the instant the operator clicked Continue, every single
  // time, on every ticket. A7's whole point is a call log - clearing it the
  // moment the stage is left destroys the one thing worth keeping it for.
  // Back/Forward navigation and a closed ticket's own review both read
  // ticket.callAttempts directly (see the calllog template above), so
  // whatever was here the instant Continue was clicked is exactly what a
  // later reviewer needs to still see.
  advanceStage(ticket.value)
}
// FR-003.6 A7: "SMS after an unanswered attempt" - once every call attempt
// (3 of 3) has gone unanswered, not before. FR-003.12: copy-paste only, no
// gateway - so this is a message preview to copy out and send from the
// operator's own phone, confirmed the same manual way an email send is.
const smsMessage = computed(() => ticket.value ? resolveTokensForPrint(CALL_ESCALATION_SMS_TEMPLATE, ticketSampleValues.value, true) : '')
function confirmSmsSent() {
  if (!ticket.value) return
  ticket.value.smsSentAt = new Date().toISOString()
  pushHistory(ticket.value, 'SMS follow-up sent after 3 unanswered call attempts', 'call')
  toast.add({ title: 'SMS logged', description: 'Marked as sent - recorded on the Activity Log.', icon: 'i-lucide-message-square', color: 'success' })
}

// --- FR-003.12 Communications sidebar ------------------------------------
// The companion SMS (SMS-1A to SMS-11) are copy-paste only: this card stages the
// text beside the stage it belongs to and the operator confirms it once it has
// actually gone out. The same card lists every communication step on the ticket
// and whether it is done (emails read from the Activity Log, SMS from the
// operator's confirmations, call attempts from the call log).
interface CommSms {
  code: string
  label: string
  text: string
  note?: { type: 'info' | 'warning', text: string }
  sent: string | null
  /** Why it can't be marked sent yet, from the Asset Team's own guidance on when to send it. */
  blockedReason: string | null
  unresolved: boolean
}
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function smsEntry(code: string): CommSms | null {
  const t = ticket.value
  const tpl = smsTemplateByCode(code)
  if (!t || !tpl) return null
  const raw = tpl.texts[t.mode] ?? tpl.texts.remote ?? tpl.texts.onsite ?? ''
  const first = ticketRealValues.value.TM_FIRST_NAME ?? t.employee.name.split(' ')[0] ?? t.employee.name
  const date = tpl.dateKind === 'asof' ? fmtDate(localToday()) : tpl.dateKind === 'target' ? (t.targetDateISO ? fmtDate(t.targetDateISO) : '{DATE}') : ''
  const text = raw.replace(/\{NAME\}/g, first).replace(/\{REF\}/g, t.reference).replace(/\{DATE\}/g, date)
  let blockedReason: string | null = null
  if (code === 'SMS-10' && !isOverdueReturn(t)) blockedReason = 'Send it after the target date has passed with no action.'
  if (code === 'SMS-8' && !t.transitConfirmedAt) blockedReason = 'Send it once the tracking number has been logged (Confirm In Transit).'
  if (code === 'SMS-11' && !latestHistory(/^Courier endorsement sent$/)) blockedReason = 'Send it once the courier booking is confirmed (the endorsement is sent).'
  // Nothing to confirm if there is no number to text. Wins over the timing rules above so the operator fixes the contact first.
  if (!contactNumberOf(t)) blockedReason = 'No contact number on file. It comes from the employee record, so update it there first.'
  // A closed ticket takes everything off the table, so its reason wins over every rule above.
  if (t.status === 'closed') blockedReason = 'This ticket is closed.'
  return { code, label: tpl.label, text, note: tpl.note, sent: t.smsSent?.[code] ?? null, blockedReason, unresolved: /\{[A-Z_]+\}/.test(text) }
}
const stageSms = computed<CommSms[]>(() => {
  const t = ticket.value
  const sk = stageKey.value
  if (!t || !sk) return []
  // Midpoint and final reminders are two steps inside one stage: show the text for the one you are on.
  const wanted = (code: string) => sk !== 'A8' || code === (t.reminderCount === 0 ? 'SMS-6' : 'SMS-7')
  return smsCodesForStage(t.reason, sk).filter(wanted).map(smsEntry).filter((x): x is CommSms => !!x)
})
/** The A7 follow-up text: the call-confirmation step's own SMS, shown once all 3 attempts went unanswered. */
const callFollowUpVisible = computed(() => stageKey.value === 'A7' && callAtCap.value && !callAnsweredYet.value)
function markSmsSent(s: CommSms) {
  if (!ticket.value) return
  confirmSmsSentFor(ticket.value, s.code, s.label)
  toast.add({ title: 'SMS logged', description: 'Marked as sent, recorded on the Activity Log.', icon: 'i-lucide-message-square', color: 'success' })
}
interface CommStep { key: string, label: string, email: { when: string | null, skipped?: boolean } | null, sms: CommSms[], calls?: string }
const commSteps = computed<CommStep[]>(() => {
  const t = ticket.value
  if (!t) return []
  const codes = (stage: string) => smsCodesForStage(t.reason, stage).map(smsEntry).filter((x): x is CommSms => !!x)
  const one = (code: string) => [smsEntry(code)].filter((x): x is CommSms => !!x)
  const mid = reminderRecord('Midpoint')
  const fin = reminderRecord('Final')
  const attempts = t.callAttempts.length
  const steps: CommStep[] = [
    { key: 'notice', label: 'Retrieval notice', email: { when: latestHistory(/^Retrieval notice sent/)?.when ?? null }, sms: codes('A6') }
  ]
  if (t.mode === 'remote') steps.push({ key: 'endorsement', label: 'Courier endorsement', email: { when: latestHistory(/^Courier endorsement sent$/)?.when ?? null }, sms: codes('B9') })
  steps.push({ key: 'call', label: 'Call confirmation', email: null, sms: [], calls: attempts ? `${attempts} of 3 attempts${callAnsweredYet.value ? ', answered' : ', unanswered'}${t.smsSentAt ? ', follow-up text sent' : ''}` : 'No attempts yet' })
  steps.push({ key: 'mid', label: 'Midpoint reminder', email: { when: mid?.sent ? mid.when : null, skipped: !!mid && !mid.sent }, sms: one('SMS-6') })
  steps.push({ key: 'final', label: 'Final reminder', email: { when: fin?.sent ? fin.when : null, skipped: !!fin && !fin.sent }, sms: one('SMS-7') })
  if (t.mode === 'remote') steps.push({ key: 'transit', label: 'In transit', email: null, sms: one('SMS-8') })
  steps.push({ key: 'overdue', label: 'Overdue notice', email: { when: latestHistory(/^Overdue reminder sent/)?.when ?? null }, sms: codes('A9') })
  steps.push({ key: 'closure', label: 'Closure', email: null, sms: one('SMS-9') })
  return steps
})
// When you land on a stage that has a text to send, bring the Communications card
// to you: open it if it was collapsed, scroll the right panel so it is at the top,
// and give it a short ring so the eye finds it. Runs when the stage (or the call
// follow-up) changes, never while you scroll the panel yourself.
const commsCardRef = ref<HTMLElement | null>(null)
const commsFlash = ref(false)
let commsFlashTimer: ReturnType<typeof setTimeout> | undefined
function revealComms() {
  // The delay lets the saved open/closed state of the panel cards apply first, so this wins over it.
  setTimeout(() => {
    railOpen.comms = true
    nextTick(() => {
      const sc = railScrollRef.value
      const card = commsCardRef.value
      if (!sc || !card) return
      const top = card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
      sc.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
      commsFlash.value = true
      clearTimeout(commsFlashTimer)
      commsFlashTimer = setTimeout(() => { commsFlash.value = false }, 1600)
    })
  }, 300)
}
watch(
  () => [ticket.value?.id, stageKey.value, callFollowUpVisible.value, ticket.value?.reminderCount] as const,
  () => { if (stageSms.value.length || callFollowUpVisible.value) revealComms() },
  { flush: 'post' }
)
// Also when you arrive on the ticket already at such a stage (a watcher alone only sees changes).
onMounted(() => { if (stageSms.value.length || callFollowUpVisible.value) revealComms() })
onBeforeUnmount(() => clearTimeout(commsFlashTimer))
const smsTotals = computed(() => {
  const all = commSteps.value.flatMap(s => s.sms)
  return { sent: all.filter(s => s.sent).length, total: all.length }
})

// --- A8 Reminders -----------------------------------------------------
const reminderTemplateKey = computed(() => {
  if (!ticket.value) return null
  const stage = ticket.value.reminderCount === 0 ? 'midpoint' : 'final'
  return REMINDER_TEMPLATES[stage][ticket.value.mode]
})
const effectiveReminderTemplateKey = computed(() => overrideTemplateKey.value === undefined ? reminderTemplateKey.value : overrideTemplateKey.value)
const effectiveReminderTemplate = computed(() => effectiveReminderTemplateKey.value ? templateForKey(effectiveReminderTemplateKey.value) : null)

// FR-003.12: T16/T17 - the real Overdue Return Notice templates, one per
// mode, bound to A9/B12. `REMINDER_TEMPLATES.overdue` already resolved this
// correctly - it just had no reader anywhere in this file, so the Overdue
// banner below was rendering a hardcoded, no-template stub instead. Same
// override/preview/edit pattern as the A6/A8 sends above.
const overdueTemplateKey = computed(() => ticket.value ? REMINDER_TEMPLATES.overdue[ticket.value.mode] : null)
const effectiveOverdueTemplateKey = computed(() => overrideTemplateKey.value === undefined ? overdueTemplateKey.value : overrideTemplateKey.value)
const effectiveOverdueTemplate = computed(() => effectiveOverdueTemplateKey.value ? templateForKey(effectiveOverdueTemplateKey.value) : null)
function sendReminder() {
  if (!ticket.value) return
  if (!requireAttachedEmail(effectiveReminderTemplate.value)) return
  if (!canSendResolved(tplHtml(effectiveReminderTemplate.value))) return
  const label = ticket.value.reminderCount === 0 ? 'Midpoint reminder sent' : 'Final reminder sent'
  pushHistory(ticket.value, label, 'send')
  ticket.value.reminderCount = (ticket.value.reminderCount + 1) as 0 | 1 | 2
  revealSentBanner()
}
// Skip only the reminder currently in view (mirrors sendReminder's own
// one-step-at-a-time advance) so midpoint and final are each an independent
// send-or-skip decision - skipping midpoint no longer silently skips final
// too, and "Continue" only ever appears once both have actually been
// resolved one way or the other, so it's never ambiguous about whether it
// just sent or skipped something.
function skipReminder() {
  if (!ticket.value) return
  pushHistory(ticket.value, ticket.value.reminderCount === 0 ? 'Midpoint reminder skipped - not needed' : 'Final reminder skipped - not needed', 'send')
  ticket.value.reminderCount = (ticket.value.reminderCount + 1) as 0 | 1 | 2
}
function continueFromReminders() {
  if (!ticket.value) return
  // Same real bug, same fix, as continueFromCall() - this used to reset the
  // very thing (reminderCount) that records what actually happened here,
  // the instant the operator left the stage. Left as its final resolved
  // value so a later review (Back, or a closed ticket) can still tell
  // whether each reminder was sent or skipped - see reminderStatus below,
  // which reads the History log rather than this counter alone, since the
  // counter alone can't distinguish "sent" from "skipped".
  advanceStage(ticket.value)
}
/** Per-reminder actual outcome (sent vs skipped vs not yet reached) - read off the real History entries sendReminder()/skipReminder() already write, not just reminderCount, which only ever counts "decided", not "which way". */
function reminderStatus(kind: 'Midpoint' | 'Final'): 'Sent' | 'Skipped' | 'Not yet' {
  if (!ticket.value) return 'Not yet'
  if (ticket.value.history.some(h => h.action === `${kind} reminder sent`)) return 'Sent'
  if (ticket.value.history.some(h => h.action.startsWith(`${kind} reminder skipped`))) return 'Skipped'
  return 'Not yet'
}

// --- B11 Confirm In Transit - captures the courier's own tracking link,
// halting the Overdue Return countdown (FR-003.9's Remote table). A real
// courier tracking link is a URL, not a bare code - validating the format
// at least catches an obviously expired/malformed/copy-pasted-wrong link
// before it's recorded. This can't confirm the link actually resolves to a
// live shipment - that needs a real call to the courier, which this
// front-end-only app has no way to make.
const trackingRefDraft = ref('')
const trackingNumberDraft = ref('')
// A link is optional, but when one is given it has to be this courier's own.
const trackingLinkValid = computed(() => !trackingRefDraft.value.trim() || isValidTrackingLink(trackingRefDraft.value, ticket.value?.courierProviderId))
const trackingCanConfirm = computed(() => (!!trackingNumberDraft.value.trim() || !!trackingRefDraft.value.trim()) && trackingLinkValid.value)
function doConfirmInTransit() {
  if (!ticket.value || !trackingCanConfirm.value) return
  confirmInTransitStage(ticket.value, trackingNumberDraft.value.trim(), trackingRefDraft.value.trim())
  trackingRefDraft.value = ''
  trackingNumberDraft.value = ''
}

// --- Courier & Shipping card (right panel, remote tickets) ------------------
// The shipment does not arrive at once, so the tracking number and link are
// entered and edited here at any time after dispatch, and the courier,
// branch and status stay in one place instead of the Activity Log.
// Each field is edited in place (its own pencil opens a small inline input
// and a save/cancel pair); the old single Edit button that revealed both
// inputs at once is gone (open items #7 and #9).
type ShipField = 'number' | 'link'
const editingShipField = ref<ShipField | null>(null)
const shipNumberDraft = ref('')
const shipLinkDraft = ref('')
const shipLinkValid = computed(() => !shipLinkDraft.value.trim() || isValidTrackingLink(shipLinkDraft.value, ticket.value?.courierProviderId))
function startEditShipField(field: ShipField) {
  if (!ticket.value) return
  if (field === 'number') shipNumberDraft.value = ticket.value.trackingNumber ?? ''
  else shipLinkDraft.value = ticket.value.trackingLink ?? ''
  editingShipField.value = field
}
function cancelEditShipField() { editingShipField.value = null }
function saveShipField(field: ShipField) {
  if (!ticket.value) return
  const t = ticket.value
  if (field === 'number') {
    const num = shipNumberDraft.value.trim()
    saveShipmentDetails(t, num, t.trackingLink ?? '')
    trackingNumberDraft.value = num
  } else {
    const link = shipLinkDraft.value.trim()
    if (link && !shipLinkValid.value) {
      toast.add({ title: 'That link does not match the courier', description: `Enter the full URL from ${shipmentCourier.value?.name ?? 'the courier'}'s own tracking site.`, icon: 'i-lucide-link-2', color: 'warning' })
      return
    }
    saveShipmentDetails(t, t.trackingNumber ?? '', link)
    trackingRefDraft.value = link
  }
  editingShipField.value = null
}
// A single composable powers every Copied-flash in this page (open item #6).
const copyFlash = useCopyFlash()
function copyWithFlash(key: string, text: string) {
  if (!text) return
  // The button itself says "Copied", so no toast on top of it.
  copyFlash.copy(key, text)
}
const shipmentState = computed(() => ticket.value ? shipmentStatus(ticket.value) : 'not-shipped')
const shipmentBadge = computed(() => ({
  'not-shipped': { label: 'Not shipped yet', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  'in-transit': { label: 'In transit', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  delayed: { label: 'Delayed', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  received: { label: 'Received', cls: 'bg-green-50 text-green-700 border-green-200' }
}[shipmentState.value]))
const shipmentDaysSinceTurnover = computed(() => {
  const at = ticket.value?.transitConfirmedAt
  if (!at) return null
  const a = new Date(at); a.setHours(0, 0, 0, 0)
  const b = new Date(); b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
})
const shipmentCourier = computed(() => courierProviderById(ticket.value?.courierProviderId ?? null))
const shipmentLink = computed(() => ticket.value?.trackingLink || ticket.value?.transitTrackingRef || '')
/** The shipment is with the courier once the ticket has reached the Transit step. Before that there is nothing to track. */
const shipmentHandedOver = computed(() => !!ticket.value && hasReachedStage(ticket.value, 'B11'))
// Revisiting a stage that was already completed (via Back) should show what
// was recorded, not the original "still waiting" prompt. Both are read off
// the Activity Log record the original action wrote (newest first).
const equipmentReceivedAt = computed(() => ticket.value?.history.find(h => /^(Equipment marked received|Assets physically received)/.test(h.action))?.when ?? null)
/** Newest Activity Log entry matching `re` - the record a completed stage left behind. */
function latestHistory(re: RegExp) {
  return ticket.value?.history.find(h => re.test(h.action)) ?? null
}
/** A6 notice / B9 endorsement already sent - shown as done when the stage is revisited. */
const templateSendRecord = computed(() => stageKey.value === 'B9' ? latestHistory(/^Courier endorsement sent$/) : stageKey.value === 'A6' ? latestHistory(/^Retrieval notice sent/) : null)
/** The template the overdue reminder actually went out with, read from its Activity Log record ("Overdue reminder sent (T16)"). */
const overdueSentTemplate = computed(() => {
  const m = latestHistory(/^Overdue reminder sent \((\w+)\)$/)?.action.match(/\((\w+)\)$/)
  return m && m[1] !== 'NO' ? templateForKey(m[1]!.toLowerCase()) : null
})
const branchSentTemplate = computed(() => {
  const key = ticket.value?.branchRequestTemplateKey ?? null
  return key ? templateForKey(key) : null
})
const branchConfirmedRecord = computed(() => latestHistory(/^Courier branch (confirmed|substituted)/))
/** Display names without their internal code suffix, e.g. "... (F1)". */
function withoutCode(name: string | undefined | null): string {
  return (name ?? '').replace(/\s*\((?:F|T)\d+\)\s*$/, '')
}
/** "Oct 1, 2026, 8:40 AM" -> "Oct 1, 2026 · 8:40 AM" */
function whenDot(when: string | null | undefined): string {
  if (!when) return ''
  const w = splitWhen(when)
  return w.time ? `${w.date} · ${w.time}` : w.date
}
/** The sent/skipped record for one reminder, plus the template that reminder uses. */
function reminderRecord(kind: 'Midpoint' | 'Final') {
  const h = ticket.value?.history.find(e => e.action === `${kind} reminder sent` || e.action.startsWith(`${kind} reminder skipped`))
  if (!h || !ticket.value) return null
  const key = REMINDER_TEMPLATES[kind === 'Midpoint' ? 'midpoint' : 'final'][ticket.value.mode]
  return { sent: h.action === `${kind} reminder sent`, when: h.when, template: key ? templateForKey(key) : null }
}
const sentReminderKinds = computed(() => (['Midpoint', 'Final'] as const).filter(k => reminderRecord(k)?.sent && reminderRecord(k)?.template))
/** One banner's worth of copy for the reminders decided so far. */
const remindersSummary = computed(() => {
  const m = reminderRecord('Midpoint'), f = reminderRecord('Final')
  const sent = [m?.sent && 'Midpoint', f?.sent && 'Final'].filter(Boolean) as string[]
  const skipped = [m && !m.sent && 'midpoint', f && !f.sent && 'final'].filter(Boolean) as string[]
  const latest = f?.when ?? m?.when ?? null
  const name = ticket.value?.employee.name ?? 'the team member'
  let title = ''
  if (sent.length === 2) title = 'Both reminders sent'
  else if (sent.length === 1) title = `${sent[0]} reminder sent`
  else title = skipped.length === 2 ? 'Both reminders skipped' : `${skipped[0]![0]!.toUpperCase()}${skipped[0]!.slice(1)} reminder skipped`
  let description = sent.length ? `Sent to ${name}.` : 'Not needed, so nothing was sent.'
  if (sent.length && skipped.length) description += ` The ${skipped[0]} reminder was skipped.`
  return { title, description, when: latest, anySent: sent.length > 0 }
})
function reminderSentAt(kind: 'Midpoint' | 'Final'): string | null {
  return ticket.value?.history.find(h => h.action === `${kind} reminder sent`)?.when ?? null
}
const deductionOutcomeSentAt = computed(() => ticket.value?.history.find(h => /^Post-Retrieval Charging (resolved|outcome changed)/.test(h.action))?.when ?? null)
function continueFromStage() {
  if (ticket.value) advanceStage(ticket.value)
}
const notReturnedConfirmOpen = ref(false)
function markEquipmentNotReturned() {
  const t = ticket.value
  if (!t) return
  const list = stageListFor(t.mode)
  const target = list.indexOf('A11')
  if (target < 0) return
  t.equipmentNotReturned = true
  t.deductionApplicable = true
  pushHistory(t, 'Equipment not returned, moved to Post-Retrieval Charging', 'return')
  t.stageIdx = target
  t.furthestStageIdx = Math.max(t.furthestStageIdx ?? 0, target)
  notReturnedConfirmOpen.value = false
}
// Records the receipt but does NOT advance the stage (5 Oct 2026, 2nd pass):
// the awaiting-return template re-renders in its "equipmentReceivedAt" state
// with a SentBanner + Continue button, so the operator sees the confirmation
// before moving on. advanceStage runs from the Continue button via
// `continueFromStage`.
function confirmPhysicalReceipt() {
  if (!ticket.value) return
  pushHistory(ticket.value, 'Equipment marked received - proof and condition evidence recorded next', 'return')
}

// --- Saved checklists modal: template-path formatter (5 Oct 2026, 3rd pass) ---
// Turns a template's `defaultFor` into a one-line human label for the modal
// description, so it reads e.g. "Resignation (Remote)" or "Resignation,
// End of Contract" or "All retrievals". Keeps a trailing "+N more" when
// more than two paths are claimed.
function formatChecklistTemplatePath(defaultFor: string[]): string {
  if (!defaultFor.length) return 'No retrieval type set'
  if (defaultFor.includes('*')) return 'All retrievals'
  const labels = defaultFor.map((key) => {
    const [reason, mode] = key.split(':') as [TicketReason, TicketMode | undefined]
    const reasonLabel = REASON_LABELS[reason] ?? reason
    const modeLabel = mode === 'onsite' ? 'Onsite' : mode === 'remote' ? 'Remote' : ''
    return modeLabel ? `${reasonLabel} (${modeLabel})` : reasonLabel
  })
  const unique = [...new Set(labels)]
  if (unique.length <= 2) return unique.join(', ')
  return `${unique.slice(0, 2).join(', ')} +${unique.length - 2} more`
}

// A11 "Not Applicable" is a classification, not a send: resetting
// deductionApplicable to null re-shows the Not Applicable / Item Damaged
// picker so the operator can switch to Item Damaged if they picked wrong.
function undoNotApplicable() {
  if (!ticket.value) return
  ticket.value.deductionApplicable = null
  pushHistory(ticket.value, 'Post-Retrieval Charging classification cleared', 'return', currentUserName())
  toast.add({ title: 'Classification cleared', description: 'Pick Not Applicable or Item Damaged / Not Returned again.', icon: 'i-lucide-undo-2', color: 'warning' })
}

// --- #37 Referred to Payroll handler (5 Oct 2026) ----------------------
function doConfirmReferredToPayroll() {
  if (!ticket.value) return
  const ok = confirmReferredToPayroll(ticket.value)
  if (ok) toast.add({ title: 'Referred to Payroll', description: 'The Authority to Deduct is on record as handed off to HR and Payroll.', icon: 'i-lucide-check', color: 'success' })
}

// --- #30 Quotation tracking: inline form state ------------------------
const quotationReceivedDraft = ref('')
const quotationReferenceDraft = ref('')
const quotationFile = ref<{ name: string, url: string } | null>(null)
const quotationFileInputRef = ref<HTMLInputElement | null>(null)
watch(() => ticket.value?.id, () => {
  if (!ticket.value) return
  quotationReceivedDraft.value = ticket.value.quotationReceivedISO ?? ''
  quotationReferenceDraft.value = ticket.value.quotationReference ?? ''
  quotationFile.value = ticket.value.quotationFileName
    ? { name: ticket.value.quotationFileName, url: '' }
    : null
}, { immediate: true })
const quotationUnsaved = computed(() => {
  if (!ticket.value) return false
  return quotationReceivedDraft.value !== (ticket.value.quotationReceivedISO ?? '')
    || quotationReferenceDraft.value.trim() !== (ticket.value.quotationReference ?? '')
    || (quotationFile.value?.name ?? '') !== (ticket.value.quotationFileName ?? '')
})
function pickQuotationFile(e: Event) {
  const file = (e.target as HTMLInputElement)?.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  quotationFile.value = { name: file.name, url }
}
function clearQuotationFile() {
  quotationFile.value = null
  if (quotationFileInputRef.value) quotationFileInputRef.value.value = ''
}
function openQuotationFile() {
  if (quotationFile.value?.url) window.open(quotationFile.value.url, '_blank')
}
function saveQuotation() {
  if (!ticket.value) return
  saveQuotationDetails(ticket.value, {
    receivedISO: quotationReceivedDraft.value || null,
    reference: quotationReferenceDraft.value,
    fileName: quotationFile.value?.name ?? ''
  })
  toast.add({ title: 'Quotation details saved', icon: 'i-lucide-file-check', color: 'success' })
}
// This reminder is the only send A9 itself performs. FR-003.6's own Stage
// Sequence table (page 7) says the case "exits to the Overdue and
// Escalation Process" once lapsed - that's an explicit hand-off to a
// process outside this module (the doc never specifies it further, and
// FR-003.13 Item 3's own "Severity Model" is the same still-external,
// still-undefined reference), not a second in-app action this stage is
// missing. A paragraph explaining this used to sit inline here; removed
// per explicit feedback as redundant next to everything else this card
// already says, but the reasoning is worth keeping somewhere for whoever
// next wonders where "the escalation feature" is.
function sendOverdueReminder() {
  if (!ticket.value) return
  if (!requireAttachedEmail(effectiveOverdueTemplate.value)) return
  if (!canSendResolved(tplHtml(effectiveOverdueTemplate.value))) return
  // Sending a reminder is a communication action, not a resolution - Overdue
  // Return is computed live from the Target Date (isOverdueReturn), so it
  // only clears once the date is actually re-baselined forward or the
  // equipment is received, never as a side effect of this button.
  pushHistory(ticket.value, `Overdue reminder sent (${effectiveOverdueTemplateKey.value?.toUpperCase() ?? 'no template'})`, 'send')
  // Real bug, reported live: the toast below was the *only* feedback this
  // action ever gave - once it faded, there was no way to tell from the
  // page itself whether (or when) a reminder had actually been sent, so an
  // operator could keep pressing the button with no way to tell they
  // already had. Durable, same pattern as smsSentAt - a real ticket field,
  // not just a transient toast, so "Sent Xm ago" stays visible on the page
  // after the toast is gone, on a page refresh, and on a closed ticket's
  // own read-only review of this stage.
  ticket.value.overdueReminderSentAt = new Date().toISOString()
  ticket.value.overdueReminderCount += 1
  toast.add({ title: 'Overdue reminder sent', icon: 'i-lucide-mail-check', color: 'success' })
  revealSentBanner()
}

// --- A10 Evidence -----------------------------------------------------
const proofFile = ref<{ name: string, url: string } | null>(null)
const conditionFile = ref<{ name: string, url: string } | null>(null)
const evidenceError = ref('')
const proofInputRef = ref<HTMLInputElement>()
const conditionInputRef = ref<HTMLInputElement>()

const proofDragOver = ref(false)
const conditionDragOver = ref(false)

function applyEvidenceFile(kind: 'proof' | 'condition', file: File) {
  evidenceError.value = ''
  const maxBytes = 10 * 1024 * 1024
  if (file.size > maxBytes) { evidenceError.value = 'File exceeds 10MB.'; return }
  const other = kind === 'proof' ? conditionFile.value : proofFile.value
  if (other && other.name === file.name) { evidenceError.value = 'Proof-of-Receipt and Condition Photos cannot share the same filename.'; return }
  const url = URL.createObjectURL(file)
  if (kind === 'proof') proofFile.value = { name: file.name, url }
  else conditionFile.value = { name: file.name, url }
}
function pickFile(kind: 'proof' | 'condition', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  applyEvidenceFile(kind, file)
  input.value = ''
}
function dropEvidenceFile(kind: 'proof' | 'condition', e: DragEvent) {
  if (kind === 'proof') proofDragOver.value = false
  else conditionDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  applyEvidenceFile(kind, file)
}
function openFile(f: { name: string, url: string } | null) {
  if (f) window.open(f.url, '_blank')
}
function confirmEvidence() {
  if (!ticket.value) return
  // Promoted onto the ticket itself (not just held in these local refs) so
  // the Artifacts Summary can actually show what was uploaded here.
  ticket.value.evidenceProof = proofFile.value
  ticket.value.evidenceCondition = conditionFile.value
  pushHistory(ticket.value, 'Proof-of-Receipt + condition photos uploaded - receipt record generated, status moves to Hold Off', 'return')
  advanceStage(ticket.value)
}

// --- A11 Case Details (Steps 1-2 of 4; see
// the Post-Retrieval Charging alignment notes for the
// full reference-file breakdown this is built from). Not persisted (which
// step is showing) - this is a structured *read* of fields already on the
// ticket, not a multi-visit workflow of its own, so re-entering the stage
// always starting back at Step 1 costs nothing. -------------------------
const deductionCaseStepIdx = ref(0)
const DEDUCTION_CASE_STEPS = [
  { label: 'Team member' },
  { label: 'Case' },
  { label: 'Dates' },
  { label: 'Amount' },
  { label: 'Equipment' },
  { label: 'Outcome' }
]
// Same behavior as the main phase stepper: a step you've moved past stays
// green (done) even when you step back to review it - only the step you're
// on is blue. Furthest step reached is tracked separately from the current
// one so going Back never retracts progress; once an outcome is recorded
// every step counts as done.
const deductionCaseMaxStep = ref(0)
watch(deductionCaseStepIdx, (i) => { if (i > deductionCaseMaxStep.value) deductionCaseMaxStep.value = i })
watch(() => ticket.value?.id, () => { deductionCaseMaxStep.value = 0 })
function deductionCaseStepState(i: number): 'current' | 'done' | 'future' {
  if (i === deductionCaseStepIdx.value) return 'current'
  if (ticket.value?.deductionOutcome || i < deductionCaseMaxStep.value) return 'done'
  return 'future'
}

/** Step 5 (Equipment) - which confirmed asset(s) this specific case covers, by serial. A real per-case selection (deductionCaseAssetSerials), not "every confirmed asset on the ticket" - the old "Confirmed Assets" reference disclosure this replaces implied a 1:1 relationship that isn't real (not every case charges everything the custodian had). */
function toggleDeductionCaseAsset(serial: string) {
  if (!ticket.value) return
  const list = ticket.value.deductionCaseAssetSerials
  const i = list.indexOf(serial)
  if (i === -1) list.push(serial)
  else list.splice(i, 1)
}

/** Step 1 - computed default (this app's own convenience derivation, not R24 hard-truth like `employee.name` itself - see firstNameOf's own comment), overridable per case. */
const deductionCaseFirstName = computed(() => ticket.value?.deductionCaseFirstNameOverride ?? firstNameOf(ticket.value?.employee.name ?? ''))
const editingCaseFirstName = ref(false)
const caseFirstNameDraft = ref('')
function startEditCaseFirstName() {
  if (!ticket.value) return
  caseFirstNameDraft.value = deductionCaseFirstName.value
  editingCaseFirstName.value = true
}
function saveCaseFirstNameEdit() {
  if (!ticket.value) return
  const trimmed = caseFirstNameDraft.value.trim()
  ticket.value.deductionCaseFirstNameOverride = trimmed && trimmed !== firstNameOf(ticket.value.employee.name) ? trimmed : null
  editingCaseFirstName.value = false
}

/** Step 2 - "the name that signs the email" for this specific case - defaults to the ticket's overall assignee, overridable per case. */
const deductionCaseOfficer = computed(() => ticket.value?.deductionCaseOfficerOverride ?? ticket.value?.assignee.name ?? '')
const editingCaseOfficer = ref(false)
const caseOfficerDraft = ref('')
function startEditCaseOfficer() {
  if (!ticket.value) return
  caseOfficerDraft.value = deductionCaseOfficer.value
  editingCaseOfficer.value = true
}
function saveCaseOfficerEdit() {
  if (!ticket.value) return
  const trimmed = caseOfficerDraft.value.trim()
  ticket.value.deductionCaseOfficerOverride = trimmed && trimmed !== ticket.value.assignee.name ? trimmed : null
  editingCaseOfficer.value = false
}

/** Step 2 - "Date the return was requested," derived from A6's own send History entry (see derivedReturnRequestedDate's own comment on why there's no dedicated field to read instead) until the officer confirms/corrects it. */
const deductionCaseReturnRequestedDerived = computed(() => ticket.value ? derivedReturnRequestedDate(ticket.value) : null)
const deductionCaseReturnRequested = computed(() => ticket.value?.deductionCaseReturnRequestedDate || deductionCaseReturnRequestedDerived.value || '')
const editingCaseReturnRequested = ref(false)
const caseReturnRequestedDraft = ref('')
function startEditCaseReturnRequested() {
  if (!ticket.value) return
  caseReturnRequestedDraft.value = deductionCaseReturnRequested.value
  editingCaseReturnRequested.value = true
}
function saveCaseReturnRequestedEdit() {
  if (!ticket.value) return
  ticket.value.deductionCaseReturnRequestedDate = caseReturnRequestedDraft.value
  editingCaseReturnRequested.value = false
}

/** Step 3 (Dates) - "Date received" is the one field of the six with a real computed default (derivedReceivedDate, off A10's own confirmEvidence() history line) - same edit/override shape as Step 2's "Date the return was requested" above. */
const deductionCaseReceivedDerived = computed(() => ticket.value ? derivedReceivedDate(ticket.value) : null)
const deductionCaseReceived = computed(() => ticket.value?.deductionCaseReceivedDate || deductionCaseReceivedDerived.value || '')
const editingCaseReceived = ref(false)
const caseReceivedDraft = ref('')
function startEditCaseReceived() {
  if (!ticket.value) return
  caseReceivedDraft.value = deductionCaseReceived.value
  editingCaseReceived.value = true
}
function saveCaseReceivedEdit() {
  if (!ticket.value) return
  ticket.value.deductionCaseReceivedDate = caseReceivedDraft.value
  editingCaseReceived.value = false
}

/** Step 3 (Dates) - the remaining five fields have no structured signal anywhere else on the ticket (unlike Date Received above), so they're plain always-editable date inputs bound straight to the ticket - no separate draft/derived-default machinery needed since there's nothing to fall back to or preserve against. */
/** Dates step: once an outcome is chosen, only the dates its email and form print are shown. Before that, all of them. */
const deductionDatesOutcome = computed(() => deductionOutcomeSelection.value || ticket.value?.deductionOutcome || '')
function showDeductionDate(key: DeductionDateKey): boolean {
  if (key === 'received' && ticket.value?.equipmentNotReturned) return false
  const outcome = deductionDatesOutcome.value
  if (!outcome) return true
  return DEDUCTION_DATES_BY_OUTCOME[outcome].includes(key)
}
const CASE_PLAIN_DATE_FIELDS = [
  { key: 'deductionCaseAssessedDate', label: 'Date assessed' },
  { key: 'deductionCaseBuyoutElectionDate', label: 'Date of buy-out election' },
  { key: 'deductionCaseQuotationExpectedDate', label: 'Quotation expected by' },
  { key: 'deductionCaseHearBackByDate', label: 'You will hear from us by' },
  { key: 'deductionCaseResponseDueDate', label: 'Response due from team member' }
] as const

/** Step 4 (Amount) - Basis is a real 5-option dropdown (DEDUCTION_AMOUNT_BASIS_LABELS, verbatim from the reference console); the other three are plain free-text fields, all bound straight to the ticket like the plain date fields above. */
// Narrowed to the bases that apply once an outcome is known (see DEDUCTION_BASES_BY_OUTCOME); all five before that.
const deductionAmountBasisOptions = computed(() => {
  const outcome = deductionOutcomeSelection.value || ticket.value?.deductionOutcome || ''
  const allowed = outcome ? DEDUCTION_BASES_BY_OUTCOME[outcome] : undefined
  return (Object.entries(DEDUCTION_AMOUNT_BASIS_LABELS) as [DeductionAmountBasis, string][])
    .filter(([value]) => !allowed || allowed.includes(value))
    .map(([value, label]) => ({ value, label }))
})

// --- A11 Deduction ------------------------------------------------------
// The old provisional Item/Amount/Authorized By form and the Outcome
// picker + auto-attach scaffold (T22-T25/F1-F3, DeductionOutcome) were
// originally removed per explicit feedback: picking an outcome couldn't
// honestly happen before Steps 3 (Dates) and 4 (Amount) of Case Details
// existed, since it depended on data those steps collect (a quotation
// amount, whether a charge is even proposed). Both steps are built now (see
// their own comments above), and T22-T25/F1-F3 are real, authored templates/
// forms (templates.ts/retrievalForms.ts) - so the picker is rebuilt below,
// same card-select pattern as A12's Return Check routing (inspectionRouting
// further down), now wired to a real send instead of a scaffold.
function markNotApplicable() {
  if (!ticket.value) return
  pushHistory(ticket.value, 'Deduction not applicable', 'return')
  // Real bug, reproduced live: this used to reset back to `null` (the same
  // value as "not decided yet"), so reviewing this stage again later (via
  // Back, or a closed ticket) showed the original choice buttons again
  // instead of a clear record of what was actually decided - `false` is a
  // real, permanent third state distinct from "not decided yet".
  ticket.value.deductionApplicable = false
  advanceStage(ticket.value)
}
function markDamaged() {
  if (!ticket.value) return
  ticket.value.deductionApplicable = true
  nextTick(scrollToCaseDetails)
}
// Case Details sits below the stage header, so landing on this stage (or
// choosing "Item Damaged or Not Returned") centers that card in view
// rather than scrolling to the top of the stage section.
const caseDetailsCardRef = ref<HTMLElement | null>(null)
function scrollToCaseDetails() {
  caseDetailsCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const deductionOutcomeSelection = ref<DeductionOutcome | ''>('')
// While the ticket is open the outcome stays changeable: the recorded one is
// preselected whenever this stage is shown, so a mistaken pick can be
// corrected instead of being locked behind a read-only banner.
watch(() => [stageKey.value, ticket.value?.deductionOutcome] as const, ([stage, outcome]) => {
  deductionOutcomeSelection.value = outcome ?? ''
  // A case that already has an outcome opens on the Outcome step.
  if (stage === 'A11' && outcome) deductionCaseStepIdx.value = DEDUCTION_CASE_STEPS.length - 1
}, { immediate: true })
// A case parked at Quotation Pending can only resolve to No Charge or
// Determination & Charge once the quotation is back (alignment notes) - a
// settlement election isn't a quotation outcome, so it's disabled then.
// When the equipment was never returned, No Charge and Quotation Pending
// don't apply (both are assessments of returned equipment, per the
// reference console) - only Determination & Charge or Settlement.
const deductionOutcomeOptions = computed(() => (Object.entries(DEDUCTION_OUTCOME_META) as [DeductionOutcome, typeof DEDUCTION_OUTCOME_META[DeductionOutcome]][])
  .map(([value, meta]) => ({
    value,
    label: meta.label,
    description: `${meta.description} Sends the ${templateForKey(meta.templateKey)?.name ?? 'notice'} email${meta.formId ? ' with a form to sign' : ''}.`,
    disabled: (ticket.value?.deductionOutcome === 'quotation-pending' && value === 'settlement')
      || (!!ticket.value?.equipmentNotReturned && (value === 'no-charge' || value === 'quotation-pending'))
  })))
/** The last equipment column's name differs per outcome (reference console): condition, finding, or settlement amount. */
const deductionAssetNoteLabel = computed(() => ({ 'no-charge': 'Condition on receipt', 'quotation-pending': 'Condition found', charge: 'Finding', settlement: 'Settlement amount' } as Record<string, string>)[deductionOutcomeSelection.value || ticket.value?.deductionOutcome || ''] ?? 'Condition, finding or settlement amount')
const deductionAssetNotePlaceholder = computed(() => deductionAssetNoteLabel.value === 'Settlement amount' ? 'e.g. PHP 12,500.00' : 'e.g. Cracked display, lower left corner')
/** Every selected asset needs its note: it fills the last column of the equipment table, so a blank one would send a raw placeholder. */
const deductionAssetNoteMissing = (serial: string) => !ticket.value?.deductionCaseAssetNotes?.[serial]?.trim()
// Picking an outcome the saved basis doesn't apply to clears it, so a settlement can't carry a repair quotation (and a charge can't carry a program price).
watch(deductionOutcomeSelection, (outcome) => {
  const t = ticket.value
  const allowed = outcome ? DEDUCTION_BASES_BY_OUTCOME[outcome] : undefined
  if (!t || !allowed || outcome === t.deductionOutcome || !t.deductionCaseAmountBasis || allowed.includes(t.deductionCaseAmountBasis)) return
  t.deductionCaseAmountBasis = null
  toast.add({ title: 'Basis of the amount cleared', description: `That basis doesn't apply to ${DEDUCTION_OUTCOME_META[outcome as DeductionOutcome].label}. Pick one in Case Details, Amount.`, icon: 'i-lucide-info', color: 'warning' })
})
const deductionAssetNotesMissingCount = computed(() => ticket.value?.deductionCaseAssetSerials.filter(deductionAssetNoteMissing).length ?? 0)
// Errors show only after a blocked attempt, not while the officer is still typing.
const deductionAssetNotesAttempted = ref(false)
function ensureDeductionAssetNotes(): boolean {
  if (!deductionAssetNotesMissingCount.value) return true
  deductionAssetNotesAttempted.value = true
  deductionCaseStepIdx.value = 4
  const n = deductionAssetNotesMissingCount.value
  toast.add({ title: `Fill in ${n} item note${n === 1 ? '' : 's'}`, description: `Enter the ${deductionAssetNoteLabel.value.toLowerCase()} for each selected item.`, icon: 'i-lucide-info', color: 'warning' })
  scrollToCaseDetails()
  return false
}
const deductionSelectedMeta = computed(() => deductionOutcomeSelection.value ? DEDUCTION_OUTCOME_META[deductionOutcomeSelection.value] : null)
// Replace / Remove on the outcome's chips, same behavior as every other
// template-send stage: `undefined` = the outcome's own mapped template/form,
// a string = the officer swapped it, `null` = the officer removed it.
const deductionTemplateOverride = ref<string | null | undefined>(undefined)
const deductionFormOverride = ref<string | null | undefined>(undefined)
watch(deductionOutcomeSelection, () => { deductionTemplateOverride.value = undefined; deductionFormOverride.value = undefined })
const deductionEffectiveTemplateKey = computed(() => deductionTemplateOverride.value === undefined ? (deductionSelectedMeta.value?.templateKey ?? null) : deductionTemplateOverride.value)
const deductionEffectiveTemplate = computed(() => deductionEffectiveTemplateKey.value ? templateForKey(deductionEffectiveTemplateKey.value) : null)
const deductionEffectiveForm = computed(() => {
  const id = deductionFormOverride.value === undefined ? (deductionSelectedMeta.value?.formId ?? null) : deductionFormOverride.value
  return id ? (RETRIEVAL_FORMS.find(f => f.id === id) ?? null) : null
})
const deductionOutcomeUnchanged = computed(() => !!ticket.value?.deductionOutcome && deductionOutcomeSelection.value === ticket.value.deductionOutcome && deductionTemplateOverride.value === undefined && deductionFormOverride.value === undefined)
const deductionOutcomeScrollTarget = ref<HTMLElement | null>(null)
/** Moves to the next Case Details step. From Equipment it first needs at least one item and every note, so the Outcome step never opens half done. */
function continueCase() {
  const t = ticket.value
  if (!t) return
  if (deductionCaseStepIdx.value === 4) {
    if (!t.deductionCaseAssetSerials.length) {
      toast.add({ title: 'Select an item first', description: 'Pick at least one item this case covers.', icon: 'i-lucide-info', color: 'warning' })
      return
    }
    if (!ensureDeductionAssetNotes()) return
  }
  deductionCaseStepIdx.value++
  // Focus follows the person to the new step, and the screen reader hears its heading.
  if (deductionCaseStepIdx.value === DEDUCTION_CASE_STEPS.length - 1) nextTick(() => { deductionOutcomeScrollTarget.value?.focus({ preventScroll: true }); scrollToDeductionOutcome() })
}
/** Earlier answers in one place on the Outcome step, each with a way back to change it. */
const caseSummaryRows = computed(() => {
  const t = ticket.value
  if (!t) return []
  const items = t.assets.filter(a => t.deductionCaseAssetSerials.includes(a.serial))
  const dates = [
    t.deductionCaseAssessedDate && `Assessed ${fmtDate(t.deductionCaseAssessedDate)}`,
    t.deductionCaseResponseDueDate && `Response due ${fmtDate(t.deductionCaseResponseDueDate)}`
  ].filter(Boolean).join(' · ')
  return [
    { step: 0, label: 'Team member', value: `${t.employee.name} · ${t.employee.id.replace(/^\D+/, '')}` },
    { step: 1, label: 'Case', value: `Case officer ${deductionCaseOfficer.value}` },
    { step: 2, label: 'Dates', value: dates || 'No dates entered' },
    { step: 3, label: 'Amount', value: t.deductionCaseAmountBasis ? `${DEDUCTION_AMOUNT_BASIS_LABELS[t.deductionCaseAmountBasis]}${t.deductionCaseAmountFigures ? ` · ${t.deductionCaseAmountFigures}` : ''}` : 'No amount entered' },
    { step: 4, label: 'Equipment', value: `${items.length} item${items.length === 1 ? '' : 's'}: ${items.map(a => a.model).join(', ')}` }
  ]
})
/** The send button says what it will send, for example "Send No Charge notice". */
const deductionSendLabel = computed(() => {
  const label = deductionSelectedMeta.value?.label
  if (!label) return ticket.value?.deductionOutcome ? 'Update and send' : 'Send notice'
  return `${ticket.value?.deductionOutcome ? 'Update and send' : 'Send'} ${label} notice`
})
function scrollToDeductionOutcome() {
  deductionOutcomeScrollTarget.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
/**
 * Records the outcome, "sends" the mapped email/form (this app has no real
 * backend to send through - see the rest of the codebase's own established
 * pattern, e.g. sendSafekeeping/confirmInspection, for "recorded to history
 * counts as sent" in this prototype), and advances the stage - except for
 * 'quotation-pending', which is a real, revisitable waiting state (see
 * the Post-Retrieval Charging alignment notes's
 * "resolved this pass" #2: the case sits open pending the quotation, then
 * resolves later to either 'charge' or 'no-charge' - it never advances past
 * a decision that hasn't actually been made yet).
 */
function confirmDeductionOutcome() {
  if (!ticket.value || !deductionSelectedMeta.value) return
  if (!ensureDeductionAssetNotes()) return
  if (!canSendResolved(caseHtml(tplHtml(deductionEffectiveTemplate.value)), caseHtml(formHtml(deductionEffectiveForm.value)))) return
  const meta = deductionSelectedMeta.value
  const outcome = deductionOutcomeSelection.value as DeductionOutcome
  const previous = ticket.value.deductionOutcome
  ticket.value.deductionOutcome = outcome
  const formNote = deductionEffectiveForm.value ? ` with ${deductionEffectiveForm.value.name} attached` : ' (no attachment)'
  const sent = `${(deductionEffectiveTemplateKey.value ?? meta.templateKey).toUpperCase()} sent${formNote}`
  pushHistory(ticket.value, previous && previous !== outcome
    ? `Post-Retrieval Charging outcome changed: ${DEDUCTION_OUTCOME_META[previous].label} to ${meta.label}, ${sent}`
    : `Post-Retrieval Charging resolved: ${meta.label}, ${sent}`, 'return')
  // No advance here: the sent banner stays in view and its Continue button
  // (continueFromCharging) moves the ticket on.
  deductionTemplateOverride.value = undefined
  deductionFormOverride.value = undefined
  revealSentBanner()
}
/**
 * Continue from Post-Retrieval Charging, after the sent banner has been seen.
 * Nothing to inspect when the equipment never came back, or when the team
 * member keeps it under a settlement, so Returned Item Check is skipped.
 * Revisiting (the ticket is already further along) just steps forward and
 * never writes the skip entry twice.
 */
function continueFromCharging() {
  const t = ticket.value
  if (!t) return
  // Step forward within what is already reached, or advance when this is the live stage.
  const step = () => (t.stageIdx < (t.furthestStageIdx ?? 0) ? goForwardStage(t) : advanceStage(t))
  step()
  if (currentStageKey(t) === 'A12' && (t.equipmentNotReturned || t.deductionOutcome === 'settlement')) {
    if (!t.history.some(h => /^Returned item check skipped/.test(h.action))) {
      pushHistory(t, t.equipmentNotReturned ? 'Returned item check skipped, equipment was not returned' : 'Returned item check skipped, equipment kept under settlement', 'return')
    }
    step()
  }
}

// --- A12 -> A13 - a selectable-card choice inline in the flow, not a modal
// (a routing decision is important enough to require deliberately picking a
// destination first, but that's achieved by disabling Confirm until a card
// is chosen - it doesn't need a separate dialog on top of the page it's
// already on). --------------------------------------------------------
// FR-003.10's own status-model table, not the earlier placeholder
// (Back to Stock/Servicing/Disposal, which didn't match the spec at all):
// the real routing reasons and the status each one drives are "Post-receipt
// routing, standard" -> Returned Device Servicing, "...condition or
// completeness issue" -> Returned Item Check, "...suspected tampering or
// loss" -> Forensic Review.
const inspectionRouting = ref<InspectionRoute | ''>('')
const inspectionRoutingOptions = [
  { value: 'standard', label: 'Standard', description: 'No issue found - routes to IT for full servicing.', icon: 'i-lucide-wrench' },
  { value: 'condition', label: 'Condition or Completeness Issue', description: "Damaged, incomplete, or doesn't match what was declared.", icon: 'i-lucide-search' },
  { value: 'tampering', label: 'Suspected Tampering or Loss', description: 'Signs of tampering, or unaccounted-for contents.', icon: 'i-lucide-shield-alert' }
]
function confirmInspection() {
  if (!ticket.value || !inspectionRouting.value) return
  const statusLabel = INSPECTION_ROUTE_STATUS[inspectionRouting.value]
  // Persisted onto the ticket, not just the History line below, so
  // ticketStatusLabel/Tone (and the Assets Confirmed card) can show this as
  // the ticket's real status from here through closure.
  ticket.value.inspectionRoute = inspectionRouting.value
  pushHistory(ticket.value, `Inspection completed, routed to ${statusLabel} - inspection record generated`, 'return')
  inspectionRouting.value = ''
  advanceStage(ticket.value)
}

// --- Read-only / back-navigation display sync ------------------------------
// Several stage panels are built as live input forms (a select, a radio
// group, an upload dropzone) whose own local ref resets once the stage is
// confirmed and the ticket advances - so stepping back to review an
// already-completed stage (via Back/Forward, which this app already allows
// on an open ticket, or the closed-ticket read-only browse) showed a blank/
// default form instead of what was actually selected/uploaded. Whenever the
// ticket already has a recorded value for one of these, populate the local
// ref from it every time the visible stage changes, so the "selection" is
// genuinely displayed, not just visually froze on whatever the form
// happened to hold last.
watch(stageKey, () => {
  if (!ticket.value) return
  if (ticket.value.courierBranchName) {
    const match = branchesForCourier(ticket.value.courierProviderId).find(b => b.name === ticket.value!.courierBranchName)
    if (match) selectedBranchId.value = match.id
  }
  if (ticket.value.branchCaptureMethod) branchCaptureMethod.value = ticket.value.branchCaptureMethod
  branchSubstituted.value = ticket.value.courierBranchSubstituted
  if (ticket.value.evidenceProof) proofFile.value = ticket.value.evidenceProof
  if (ticket.value.evidenceCondition) conditionFile.value = ticket.value.evidenceCondition
  if (ticket.value.inspectionRoute) inspectionRouting.value = ticket.value.inspectionRoute
  // Same "re-sync a local draft ref from the ticket's own persisted field
  // when the visible stage changes" fix as the others above - B11's own
  // tracking-link input was missing from this list, so stepping back to it
  // (or just opening a closed ticket) showed a blank input instead of what
  // was actually confirmed.
  if (ticket.value.transitTrackingRef || ticket.value.trackingLink) trackingRefDraft.value = ticket.value.trackingLink ?? ticket.value.transitTrackingRef
  if (ticket.value.trackingNumber) trackingNumberDraft.value = ticket.value.trackingNumber
}, { immediate: true })

// --- A13 Closure ----------------------------------------------------------
const closureOpen = ref(false)
const closureDocumented = ref(false)
const sendPreviewOpen = ref(false)
/** Whether this (closed) ticket actually had its closure copy sent, from the same History line confirmClosure() writes - used to decide whether "View exact copy sent" belongs on the Closure step at all. */
const closureCopyWasSent = computed(() => !!ticket.value?.history.some(h => h.action.startsWith('Detailed closure copy sent to team member')))
const assetResolutions = ref<Record<number, 'returned' | 'charge' | 'open'>>({})
/** How many closure checks still need attention, so the closed banner can stay neutral instead of green over unresolved gaps. */
const closureOutstanding = computed(() => closureChecks.value.filter(c => !c.ok).length)
/** The things closing depends on, each marked ok or needing attention. */
const closureChecks = computed(() => {
  const t = ticket.value
  if (!t) return []
  const returned = t.assets.filter(a => a.checked).length
  const chargedItems = t.assets.filter(a => a.resolution === 'charge')
  const outstandingItems = t.assets.filter(a => a.resolution === 'open')
  const evidence = !!(t.evidenceProof && t.evidenceCondition) || !!latestHistory(/^Proof-of-Receipt \+ condition photos uploaded/)
  const skippedCheck = !!latestHistory(/^Returned item check skipped/)
  const charging = t.deductionApplicable === false
    ? { ok: true, detail: 'Not applicable. No item was damaged or missing.' }
    : t.deductionOutcome
      ? { ok: t.deductionOutcome !== 'quotation-pending', detail: t.deductionOutcome === 'quotation-pending' ? 'Quotation Pending. Still waiting on the repair quotation.' : `${DEDUCTION_OUTCOME_META[t.deductionOutcome].label}, notice sent.` }
      : { ok: false, detail: 'No outcome recorded yet.' }
  return [
    { label: 'Equipment returned', ok: returned === t.assets.length, detail: returned === t.assets.length ? `All ${t.assets.length} assets back.` : `${returned} of ${t.assets.length} back. Pick an outcome for each missing one when you close.` },
    { label: 'Receipt evidence', ok: evidence || !!t.equipmentNotReturned, detail: t.equipmentNotReturned ? 'Not applicable. The equipment was not returned.' : evidence ? 'Proof of receipt and condition photos on file.' : 'Not on file yet.' },
    { label: 'Post-Retrieval Charging', ...charging },
    ...(chargedItems.length ? [{
      label: 'Items sent to charging',
      ok: !!t.deductionOutcome && t.deductionOutcome !== 'quotation-pending',
      detail: `${chargedItems.map(a => a.model).join(', ')}. ${t.deductionOutcome ? (t.deductionOutcome === 'quotation-pending' ? 'The charging case is waiting on a repair quotation.' : `The charging case is recorded as ${DEDUCTION_OUTCOME_META[t.deductionOutcome].label}.`) : 'The charging case has no outcome yet.'}`
    }] : []),
    ...(outstandingItems.length ? [{
      label: 'Items left outstanding',
      ok: false,
      detail: `${outstandingItems.map(a => a.model).join(', ')}. ${t.status === 'closed' ? 'The ticket was closed with these still outstanding.' : 'They will stay listed as outstanding when the ticket closes.'}`
    }] : []),
    { label: 'Returned item check', ok: !!t.inspectionRoute || skippedCheck, detail: t.inspectionRoute ? `Routed to ${INSPECTION_ROUTE_STATUS[t.inspectionRoute]}.` : skippedCheck ? 'Not applicable. GoTeam does not have the equipment.' : 'Not routed yet.' },
    { label: 'IT lock', ok: t.itLock.executedConfirmed, detail: t.itLock.executedConfirmed ? 'Executed.' : t.itLock.scheduledConfirmed ? 'Scheduled, not confirmed as executed.' : 'Not scheduled.' }
  ].map(c => t.status === 'closed' ? { ...c, detail: c.detail.replace(/ yet\./, '.') } : c)
})

function openClosure() {
  if (!ticket.value) return
  assetResolutions.value = Object.fromEntries(ticket.value.assets.map((a, i) => [i, a.checked ? 'returned' : 'open']))
  closureDocumented.value = false
  closureOpen.value = true
}
const ASSET_RESOLUTION_LABELS: Record<'returned' | 'charge' | 'open', string> = {
  returned: 'Returned', charge: 'Send to charging', open: 'Keep Open'
}
/** True when confirming now would open a charging case instead of closing. */
/** Plain-language outcome of the closure choices, shown in the modal so nobody has to guess what happens next. */
const closureNextSteps = computed(() => {
  const t = ticket.value
  if (!t) return []
  const pick = (kind: 'returned' | 'charge' | 'open') => t.assets.filter((_, i) => assetResolutions.value[i] === kind)
  const charge = pick('charge')
  const open = pick('open')
  const out: { icon: string, text: string }[] = []
  if (charge.length) {
    out.push(t.deductionOutcome
      ? { icon: 'i-lucide-receipt-text', text: `${charge.length} item${charge.length === 1 ? ' is' : 's are'} covered by the charging case already recorded as ${DEDUCTION_OUTCOME_META[t.deductionOutcome].label}. The ticket closes and keeps that record.` }
      : { icon: 'i-lucide-receipt-text', text: `${charge.length} item${charge.length === 1 ? '' : 's'} go${charge.length === 1 ? 'es' : ''} to a Post-Retrieval Charging case. The ticket moves there instead of closing, and you close it once the case is settled.` })
  }
  if (open.length) out.push({ icon: 'i-lucide-package-open', text: `${open.length} item${open.length === 1 ? ' stays' : 's stay'} outstanding. The ticket closes and lists ${open.length === 1 ? 'it' : 'them'} as outstanding.` })
  if (!charge.length && !open.length) out.push({ icon: 'i-lucide-circle-check', text: 'Every item is back with the Asset Team. The ticket closes.' })
  return out
})
const closureOpensCharge = computed(() => !!ticket.value && !ticket.value.deductionOutcome && ticket.value.assets.some((_, i) => assetResolutions.value[i] === 'charge'))
function confirmClosure() {
  if (!ticket.value) return
  // Real, previously-shipped bug fixed: this selector never wrote back to
  // the ticket at all (see TicketAsset.resolution's own comment) - now it
  // does, before anything else about closure happens.
  ticket.value.assets.forEach((a, i) => { a.resolution = assetResolutions.value[i] ?? null })
  // FR-003.11: items pathed to charge open a Post-Retrieval Charging case for
  // exactly those items, instead of the ticket closing with them outstanding.
  // Once that case has an outcome the pathing is settled and closing goes on.
  const chargeSerials = ticket.value.assets.filter(a => a.resolution === 'charge').map(a => a.serial)
  if (chargeSerials.length && !ticket.value.deductionOutcome) {
    openChargeCaseForItems(ticket.value, chargeSerials)
    closureOpen.value = false
    toast.add({ title: 'Charging case opened', description: `${chargeSerials.length} item${chargeSerials.length === 1 ? '' : 's'} moved to Post-Retrieval Charging. Close the ticket once the case is settled.`, icon: 'i-lucide-receipt-text', color: 'info' })
    return
  }
  ticket.value.status = 'closed'
  pushHistory(ticket.value, 'Ticket Closed', 'closure')
  // Simulated, same as every other "send" in this app (no real backend) -
  // closing the ticket never itself opens a print dialog (that surprised
  // and was reported against a real close). The actual PDF is a separate,
  // explicit action from the Artifacts Summary drawer (exportTeamMemberCopy)
  // for whenever the operator actually wants to produce it.
  if (closureDocumented.value) {
    pushHistory(ticket.value, 'Detailed closure copy sent to team member (PDF)', 'closure')
  } else {
    pushHistory(ticket.value, 'Team member copy not sent - documentation unconfirmed', 'closure')
  }
  closureOpen.value = false
  toast.add({
    title: 'Ticket closed',
    description: closureDocumented.value ? 'Detailed closure copy sent to the team member.' : 'Closed without sending a copy to the team member.',
    icon: 'i-lucide-check-circle',
    color: 'success'
  })
}

// --- Custodian card --------------------------------------------------
const showMoreDetails = ref(false)
/**
 * Details panel (right rail) show/hide. One toggle button in the ticket
 * header, in the same place whether the panel is open or hidden (the common
 * pattern across Linear, Intercom, Fluent/Material/Apple guidance - an edge
 * strip with a floating handle was the outlier and hard to discover).
 * Shortcut: "]" (ignored while typing in a field). The choice is remembered
 * per browser, so the panel stays the way the officer left it.
 */
// Remembered per ticket (not globally), so any ticket the officer hasn't
// hidden it on - including every newly created one - opens with the panel
// shown.
const railStorageKey = (id: string) => `ams:ticketDetailsPanelHidden:${id}`
const railCollapsed = ref(false)
watch(() => ticket.value?.id, (id) => {
  if (!id) return
  try { railCollapsed.value = localStorage.getItem(railStorageKey(id)) === '1' } catch { railCollapsed.value = false }
}, { immediate: true })
watch(railCollapsed, (v) => {
  const id = ticket.value?.id
  if (!id) return
  try {
    if (v) localStorage.setItem(railStorageKey(id), '1')
    else localStorage.removeItem(railStorageKey(id))
  } catch { /* storage unavailable: lasts for this session only */ }
})
function toggleRail() {
  railCollapsed.value = !railCollapsed.value
}

// --- Stage-already-done helpers (5 Oct 2026 feedback) ----------------------
// Each of the "capture a value, press Confirm" stages (B11 transit, A10
// evidence, A12 inspection) now shows "Continue to <next stage>" when the
// stage has already been recorded and the live form matches what was
// saved; the label snaps back to the original action the moment the user
// changes anything. A11's Not Applicable branch gets the same Continue
// button, since there was no other way out of it.
const b11AlreadyDone = computed(() => !!ticket.value?.transitConfirmedAt)
const b11Pristine = computed(() => {
  if (!b11AlreadyDone.value || !ticket.value) return false
  return trackingNumberDraft.value.trim() === (ticket.value.trackingNumber ?? '')
    && trackingRefDraft.value.trim() === (ticket.value.trackingLink ?? '')
})
const a10AlreadyDone = computed(() => !!(ticket.value?.evidenceProof && ticket.value?.evidenceCondition))
const a10Pristine = computed(() => {
  if (!a10AlreadyDone.value) return false
  return proofFile.value === ticket.value?.evidenceProof && conditionFile.value === ticket.value?.evidenceCondition
})
const a12AlreadyDone = computed(() => !!ticket.value?.inspectionRoute)
const a12Pristine = computed(() => {
  if (!a12AlreadyDone.value) return false
  return inspectionRouting.value === ticket.value?.inspectionRoute
})
const nextStageName = computed(() => {
  const t = ticket.value
  if (!t) return ''
  const list = stageListFor(t.mode)
  const next = list[t.stageIdx + 1]
  return next ? STAGE_NAMES[next] : ''
})
const continueLabel = computed(() => nextStageName.value ? `Continue to ${nextStageName.value}` : 'Continue')
// `continueFromStage` already exists above (line ~1378) and advances the
// ticket to the next stage; it is reused for every "Continue" button added
// on 5 Oct 2026 (B11, A10, A12, A11 Not Applicable).

// --- One-shot "ready" pulse on each capture-and-confirm stage's primary
// button, scoped per (ticket, stage) so revisiting the same stage never
// re-pulses. Only pulses the FIRST time the stage becomes ready - i.e.,
// the live form has valid, non-saved values the primary action would
// commit. On a revisit where the stage is already saved and pristine, the
// `ready` ref stays false and no pulse fires.
const b11Pulse = useReadyPulse(
  computed(() => ticket.value ? `${ticket.value.id}:B11` : ''),
  computed(() => !!trackingCanConfirm.value && !b11Pristine.value)
)
const a10Pulse = useReadyPulse(
  computed(() => ticket.value ? `${ticket.value.id}:A10` : ''),
  computed(() => !!(proofFile.value && conditionFile.value) && !a10Pristine.value)
)
const a12Pulse = useReadyPulse(
  computed(() => ticket.value ? `${ticket.value.id}:A12` : ''),
  computed(() => !!inspectionRouting.value && !a12Pristine.value)
)

// --- Right-panel soft-scroll (open item #2, 5 Oct 2026, 3rd pass) --------
// The chevron buttons are now `position: fixed` to the viewport (so they
// stay on-screen regardless of page scroll). Horizontal position is
// tracked in JS from the panel's own rect, so the chevrons sit centered on
// the right panel's horizontal center. Clicking still scrolls the panel's
// own content; the panel's native vertical scrollbar is hidden in CSS and
// wheel/touch/keyboard scroll still work.
const railScrollRef = ref<HTMLElement | null>(null)
const railCanScrollUp = ref(false)
const railCanScrollDown = ref(false)
// The panel is pinned just below the sticky page header (app nav 64px + the
// header's own height + the 20px page gap), which is also exactly where it
// naturally starts, so it never moves relative to the viewport while the page
// scrolls. Its height is "viewport minus that top minus 16px", set in CSS from
// this one value. Nothing here runs on scroll, so the up/down chevrons (plain
// absolute children of the panel) stay perfectly still and always visible.
// Only the header's size changes it (e.g. the stepper collapsing).
const railTop = ref<number | null>(null)
function updateRailTop() {
  const header = stickyPageHeaderRef.value
  if (!header) return
  railTop.value = 64 + header.offsetHeight + 20
}
function updateRailScroll() {
  const el = railScrollRef.value
  if (!el) return
  railCanScrollUp.value = el.scrollTop > 4
  railCanScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 4
}
function scrollRail(delta: number) {
  const el = railScrollRef.value
  if (!el) return
  el.scrollBy({ top: delta, behavior: 'smooth' })
}
// The scroller only exists once the ticket has rendered (after seed data
// loads), so observers attach when the element appears, not at mount.
let railResizeObserver: ResizeObserver | undefined
watch(railScrollRef, (el) => {
  railResizeObserver?.disconnect()
  if (!el) return
  // No mount-time measure here: the observer below reports every observed
  // element once, right after its first layout, and measuring earlier forces
  // a layout in the middle of mounting. Without ResizeObserver, measure once.
  if (typeof ResizeObserver === 'undefined') {
    nextTick(() => { updateRailTop(); updateRailScroll() })
    return
  }
  railResizeObserver = new ResizeObserver(() => { updateRailTop(); updateRailScroll() })
  railResizeObserver.observe(el)
  if (stickyPageHeaderRef.value) railResizeObserver.observe(stickyPageHeaderRef.value)
  // Inner content grows/shrinks as rail cards collapse or expand.
  Array.from(el.children).forEach(c => railResizeObserver!.observe(c))
}, { flush: 'post' })
onBeforeUnmount(() => railResizeObserver?.disconnect())
watch(() => ticket.value?.id, () => nextTick(() => { updateRailTop(); updateRailScroll() }))
function onRailShortcut(e: KeyboardEvent) {
  if (e.key !== ']' || e.metaKey || e.ctrlKey || e.altKey || !isLgUp.value) return
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
  e.preventDefault()
  toggleRail()
}
/** Gates the rail's animated collapsed/expanded width to desktop only (matches the lg: breakpoint the layout itself switches on at) - mobile keeps its plain full-width stacked rail regardless of this toggle. */
const isLgUp = ref(false)
let lgMediaQuery: MediaQueryList | undefined
const onLgMediaChange = (e: MediaQueryListEvent) => { isLgUp.value = e.matches }
onMounted(() => {
  lgMediaQuery = window.matchMedia('(min-width: 1024px)')
  isLgUp.value = lgMediaQuery.matches
  lgMediaQuery.addEventListener('change', onLgMediaChange)
  window.addEventListener('keydown', onRailShortcut)
})
onUnmounted(() => {
  lgMediaQuery?.removeEventListener('change', onLgMediaChange)
  window.removeEventListener('keydown', onRailShortcut)
})
function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
  toast.add({ title: 'Copied', icon: 'i-lucide-copy', color: 'neutral' })
}

/** Icon for an asset item, keyed off its canonical catalog category - not a fixed icon for every asset regardless of what it actually is. */
function assetIcon(name: string): string {
  return assetCatalogEntry(name).icon
}
// This app has no real Asset Detail page/route to link to yet - a toast
// stands in for the navigation so the click affordance is real (matching the
// real Assets module's own asset list, where each row opens one) without
// faking a route that doesn't exist here.
function openAssetDetail(asset: TicketAsset) {
  toast.add({ title: asset.model || asset.name, description: `Would open the Asset Detail page for ${asset.assetTag}.`, icon: 'i-lucide-external-link', color: 'info' })
}
/** "P. Villanueva - Finance Manager" -> { name: 'P. Villanueva', role: 'Finance Manager' } - splits the leadership coach's name from their role so the two can get distinct visual weight instead of running together as one plain string. */
function splitCoachLabel(value: string): { name: string, role: string } {
  const idx = value.lastIndexOf(' - ')
  return idx === -1 ? { name: value, role: '' } : { name: value.slice(0, idx), role: value.slice(idx + 3) }
}

// B8 team member address - editable per-ticket correction (see
// teamMemberAddressOverride/effectiveTeamMemberAddress), never a mutation of
// the R24 employee.address field itself.
const editingAddress = ref(false)
const addressDraft = ref('')
function startEditAddress() {
  if (!ticket.value) return
  addressDraft.value = effectiveTeamMemberAddress(ticket.value)
  editingAddress.value = true
}
function saveAddressEdit() {
  if (!ticket.value) return
  setTeamMemberAddressOverride(ticket.value, addressDraft.value)
  editingAddress.value = false
}
function resetAddressToFile() {
  if (!ticket.value) return
  setTeamMemberAddressOverride(ticket.value, null)
  editingAddress.value = false
}

// A visually-disabled action button should still explain itself, not just
// silently do nothing - so these buttons are never passed the native
// `disabled` attribute (which blocks the click event outright). Instead they
// stay clickable, are styled to look disabled (disabledLook, below), carry a
// UTooltip explaining what's missing, and route through here: ready actions
// still fire normally, not-ready ones surface the same explanation as a
// toast instead of a silent no-op.
// The toast title names why the action is blocked: "Not ready yet" is only
// true when a step is still missing, so a closed ticket, an already sent
// message or a reached limit each get their own title.
function guardToast(reason: string) {
  if (ticket.value?.status === 'closed') return { title: 'Ticket is closed', icon: 'i-lucide-lock', color: 'neutral' as const }
  if (/^Already /.test(reason)) return { title: 'Already done', icon: 'i-lucide-check', color: 'neutral' as const }
  if (/^Maximum /.test(reason)) return { title: 'Limit reached', icon: 'i-lucide-info', color: 'neutral' as const }
  return { title: 'Not ready yet', icon: 'i-lucide-info', color: 'warning' as const }
}
function guardedClick(ready: boolean, reason: string, action: () => void) {
  if (!ready) {
    toast.add({ ...guardToast(reason), description: reason })
    return
  }
  action()
}
const disabledLook = 'opacity-50 cursor-not-allowed hover:opacity-50'
// Shared `ui` override for every icon-card URadioGroup in this workspace
// (Captured via, Return Check routing) - the theme's own "card" variant
// already turns the card's border/background primary-blue on selection
// (has-data-[state=checked]:...), but leaves the icon and label at their
// default neutral color, reported live as "only the stroke and fill
// updated." `group` on the item plus `group-has-data-[state=checked]:` on
// its icon/label descendants picks up that same selected state without
// touching the item's own background/border classes. The description
// keeps its own default (unset here) muted color on purpose, so it stays
// readable against the lighter selected background rather than also
// turning blue.
// Explicit label/description/icon sizes here (not left to inherit from
// size="sm"'s own item-level text-xs) - reported live as reading too large
// relative to the icon. Main label text at 12px (text-xs), description a
// notch smaller (11px) so it reads as secondary, icon proportioned to sit
// with 12px text rather than the theme's own default (sized for its usual
// larger card variant).
// Main label at 14px (text-sm) per explicit ask (was 12px, then bumped up
// again) - icon and description sized to sit proportionally with it rather
// than left at the theme's own defaults. The selected-state background is
// also toned down from the theme's default `bg-primary/10` to `bg-primary/5`
// - reported live as measuring too dark against the description's own muted
// text color to comfortably clear WCAG 2.2 (a saturated tint darkens the
// effective background just enough to eat into a muted-gray-on-white
// contrast ratio that was fine against plain white).
// Reverted back to 12px labels (text-xs) per explicit ask - the bump to
// 14px didn't stick as wanted for Captured via specifically. Still a real
// URadioGroup with the theme's own supported `ui` prop override (the
// documented way to customize Nuxt UI components), not a hand-rolled
// substitute.
// Padding: every selection card is 10px top/bottom, 16px left/right
// (py-2.5 px-4), except Captured via, which keeps the theme's own md
// padding. Selected-state description switches from muted to the default
// UI text color so it holds contrast against the tinted background.
const cardSelectPadding = 'py-2.5 px-4'
// Content is vertically centered in every card; icons 16px; title 14px,
// description 12px.
const cardSelectUi = {
  item: `group items-center ${cardSelectPadding} has-data-[state=checked]:bg-primary/5`,
  icon: 'transition-colors group-has-data-[state=checked]:text-primary size-4',
  label: 'transition-colors group-has-data-[state=checked]:text-primary text-sm',
  description: 'transition-colors text-xs group-has-data-[state=checked]:text-default'
}

// --- Activity log drawer ----------------------------------------------
// Real full names for the Asset Team's own actor strings (`D. Reyes` etc.,
// see ASSET_TEAM_MEMBERS/CURRENT_ASSIGNEE_NAME in ticketTrackers.ts) - that
// abbreviated form is a real, permanent key used throughout the codebase
// (assignee matching, "My Tickets" filtering, the officer-override default
// comparison), so it isn't renamed at the source; this is a display-only
// lookup, scoped to the Activity Log's own presentation, per explicit
// feedback that the log should read in full names, not initials-style
// abbreviations. Falls back to the actor string itself for anything not in
// this map (a team member's own name is already full; "R24 Sync" reads fine
// as-is either way).
const ACTOR_FULL_NAMES: Record<string, string> = {
  'R24 Sync': 'System',
  'D. Reyes': 'Diego Reyes',
  'J. Santos': 'Jasmine Santos',
  'M. Bautista': 'Miguel Bautista'
}
function actorFullName(actor: string): string {
  return ACTOR_FULL_NAMES[actor] ?? actor
}
/** Avatar initials off the real full name above, not the abbreviated actor string - "D. Reyes" would otherwise render "D." as one initial and "R" as the other, an odd-looking split of an already-abbreviated name. */
function actorInitials(actor: string): string {
  return actorFullName(actor).split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
}
/**
 * Splits a stored history action into a short title and a detail line, at
 * display time only - the stored `action` strings stay exactly as written by
 * pushHistory(). Splits at whichever of ": " / " - " comes first; failing
 * that, a trailing "(...)" becomes the detail. A parenthetical left in the
 * title half (e.g. "Asset list confirmed (2 of 3) - locked...") moves to the
 * front of the detail too.
 */
// Entries whose stored text has no useful detail of its own (or only a vague
// fragment like "Confirmed" / "Not needed") get a written title + detail
// here, so every log entry says what actually happened rather than
// repeating its title. Matched against the stored action text, so older
// entries already in localStorage read the same way.
/** Branch names often already start with the courier ("JRS Express - Iloilo Branch"): show it once, without the dash. */
function branchLabel(courier: string, branch: string): string {
  const b = branch.replace(/\s+-\s+/g, ' ')
  return b.startsWith(courier) ? b : `${courier} ${b}`
}
// A regex match with every capture turned into text (a group that did not take part is ''), as a fixed-length tuple.
type RuleMatch = [string, string, string, string, string, string]
const HISTORY_DETAIL_RULES: { match: RegExp, title?: string, detail: (m: RuleMatch) => string }[] = [
  { match: /^Reason and Mode changed: (.+) to (.+) \(reason: (.+)\)$/, title: 'Reason and mode changed', detail: m => `Changed from ${m[1]} to ${m[2]}. Reason: ${m[3]}.` },
  { match: /^Ticket taken over from (.+) by (.+) \(handover: (.+)\)$/, title: 'Ticket taken over', detail: m => `${m[2]} took this over from ${m[1]}. Handover: ${m[3]}.` },
  { match: /^Retrieval cancelled: (.+?) \((.+)\)\. No retrieval.*$/, title: 'Retrieval cancelled', detail: m => `${m[1]}. ${m[2]}. The case closed with no retrieval.` },
  { match: /^Sent to charging: (\d+) items? moved to Post-Retrieval Charging \((.+)\)$/, title: 'Sent to charging', detail: m => `${m[1]} item${m[1] === '1' ? '' : 's'} moved to Post-Retrieval Charging: ${m[2]}.` },
  { match: /^Offboarding checklist loaded from template: "(.+)" \((\d+) items\)$/, title: 'Checklist loaded', detail: m => `Started from the "${m[1]}" template with ${m[2]} tasks.` },
  { match: /^Marked In Transit - tracking number: (.+)$/, title: 'Marked in transit', detail: m => `The courier picked up the equipment. Tracking number: ${m[1]}.` },
  { match: /^Tracking details (added|updated): (.+)$/, title: 'Tracking details saved', detail: m => `Tracking details ${m[1]}. ${m[2]}.` },
  { match: /^Offboarding checklist completed$/, title: 'Final review done', detail: () => 'Every required task is done and the checklist was signed off. Next, schedule the IT lock.' },
  { match: /^Offboarding checklist item set to (optional|required): "(.+)"$/, title: 'Checklist task changed', detail: m => `"${m[2]}" is now ${m[1]}.` },
  { match: /^Offboarding checklist item added: "(.+)"$/, title: 'Checklist item added', detail: m => `Added "${m[1]}" to the offboarding checklist.` },
  { match: /^Offboarding checklist item removed: "(.+)"$/, title: 'Checklist item removed', detail: m => `Removed "${m[1]}" from the offboarding checklist.` },
  { match: /^Ticket Created - (.+)$/, title: 'Ticket created', detail: m => `Retrieval ticket opened with reference ${m[1]}.` },
  { match: /^Assets physically received$/, title: 'Equipment received', detail: () => 'The returned equipment arrived. Receipt and evidence come next.' },
  { match: /^Equipment marked received/, title: 'Equipment received', detail: () => 'The equipment is back with the Asset Team. Next, attach the signed proof of receipt and condition photos.' },
  { match: /^Marked In Transit$/, title: 'Marked in transit', detail: () => 'The courier picked up the equipment. It is on its way back.' },
  { match: /^Marked In Transit - tracking\/reference number: (.+)$/, title: 'Marked in transit', detail: m => `The courier picked up the equipment. Tracking reference: ${m[1]}.` },
  { match: /^Courier endorsement sent$/, title: 'Courier endorsement sent', detail: () => "Pickup endorsement emailed to the courier's account manager." },
  { match: /^Retrieval notice sent \(email \+ SMS\)$/, title: 'Retrieval notice sent', detail: () => 'Return instructions sent to the team member by email and SMS.' },
  { match: /^Retrieval notice sent$/, title: 'Retrieval notice sent', detail: () => 'Return instructions emailed to the team member.' },
  { match: /^Ticket Closed$/, title: 'Ticket closed', detail: () => 'Every stage is complete, so the case is closed.' },
  { match: /^Ticket Tracker reopened$/, title: 'Ticket reopened', detail: () => 'The ticket is open again and can be updated.' },
  { match: /^IT lock executed on schedule/, title: 'IT lock executed', detail: () => "IT confirmed the team member's access was locked on the scheduled date." },
  { match: /^IT lock scheduled for end of last shift on (.+?)( \(rescheduled.*\))? - awaiting execution confirmation$/, title: 'IT lock scheduled', detail: m => `Access lock booked for the end of the last shift on ${m[1]}${m[2] ? ', rescheduled against the updated Last Working Day' : ''}. Awaiting confirmation that it ran.` },
  { match: /^Team member email reply confirmed read$/, title: 'Branch reply reviewed', detail: () => "The team member's email reply naming their courier branch was read." },
  { match: /^Deduction not applicable$/, title: 'No charge needed', detail: () => 'Nothing was damaged or missing, so Post-Retrieval Charging was skipped.' },
  { match: /^Detailed closure copy sent to team member \(PDF\)$/, title: 'Closure copy sent', detail: () => 'A PDF summary of the closed case was emailed to the team member.' },
  { match: /^Team member copy not sent/, title: 'Closure copy held back', detail: () => "The documentation is not confirmed yet, so the team member's copy was not sent." },
  { match: /^(Contact number|Personal email) manually confirmed active$/, title: 'Contact verified', detail: m => `The ${m[1].toLowerCase()} was confirmed active.` },
  { match: /^Midpoint reminder skipped/, title: 'Midpoint reminder skipped', detail: () => 'No reminder was needed, so none was sent.' },
  { match: /^Final reminder skipped/, title: 'Final reminder skipped', detail: () => 'No reminder was needed, so none was sent.' },
  { match: /^SMS follow-up sent after 3 unanswered call attempts$/, title: 'SMS follow-up sent', detail: () => 'Texted the team member after three unanswered calls.' },
  { match: /^Call attempt logged: answered/, title: 'Call answered', detail: () => 'The team member picked up and their contact number is confirmed.' },
  { match: /^Call attempt logged: no answer \((\d) of 3\)$/, title: 'Call not answered', detail: m => `Attempt ${m[1]} of 3 went unanswered.` },
  { match: /^Call confirmation attempts exhausted/, title: 'Call attempts exhausted', detail: () => 'All three calls went unanswered. A text message follow-up is the next step.' },
  { match: /^Continued without a call confirmation(, after the SMS follow-up)?$/, title: 'Continued without a call', detail: m => m[1] ? 'No call was answered. The SMS follow-up went out first, then the ticket went on.' : 'No call was answered, so the ticket went on without a call confirmation.' },
  { match: /^Equipment Safekeeping Request sent/, title: 'Safekeeping request sent', detail: () => 'Asked the team member to keep the equipment safe. No deadline or penalty applies.' },
  { match: /^Jumped to (.+)$/, title: 'Stage changed', detail: m => `Moved straight to ${m[1]}.` },
  { match: /^Branch confirmation request sent to team member/, title: 'Branch confirmation requested', detail: () => 'Asked the team member to name their courier branch. A reply is due within 1 business day.' },
  { match: /^Proof-of-Receipt \+ condition photos uploaded/, title: 'Receipt evidence uploaded', detail: () => 'Proof of receipt and condition photos are on file, and a receipt record was created. The ticket is now on Hold Off.' },
  { match: /^Asset list confirmed \((\d+) of (\d+)\)/, title: 'Asset list confirmed', detail: m => `${m[1]} of ${m[2]} assets are confirmed and locked. The ticket is now Pending Return.` },
  { match: /^Gate (\d) recorded(?: \((.+?)\))? - (.+)$/, detail: m => `${m[3]}${m[2] ? ` Note: ${m[2]}` : ''}` },
  { match: /^Post-Retrieval Charging resolved: (.+?)(?:,| -) (T\d+) sent (?:with (.+) attached|\(no attachment\))$/, title: 'Charging outcome recorded', detail: m => `${m[1]}. ${templateForKey(m[2].toLowerCase())?.name ?? 'Outcome notice'} sent to the team member${m[3] ? `, with ${withoutCode(m[3])} attached` : ', no form attached'}.` },
  { match: /^Post-Retrieval Charging outcome changed: (.+?) to (.+?), (T\d+) sent (?:with (.+) attached|\(no attachment\))$/, title: 'Charging outcome changed', detail: m => `Changed from ${m[1]} to ${m[2]}. ${templateForKey(m[3].toLowerCase())?.name ?? 'Outcome notice'} sent${m[4] ? `, with ${withoutCode(m[4])} attached` : ', no form attached'}.` },
  { match: /^Entry recorded/, title: 'Ticket details recorded', detail: () => 'Recorded the authorizing endorsement and its date, the Last Working Day and the Separation Date.' },
  { match: /^Equipment not returned, moved to Post-Retrieval Charging$/, title: 'Equipment not returned', detail: () => 'The equipment is not coming back, so the ticket moved straight to Post-Retrieval Charging.' },
  { match: /^Returned item check skipped, (.+)$/, title: 'Returned item check skipped', detail: m => /settlement/.test(m[1]) ? 'Skipped because the team member is keeping the equipment under a settlement.' : 'Skipped because the equipment was not returned.' },
  { match: /^(?:HRIS\/R24|Employee record) update acknowledged( - IT lock still needs to be rescheduled)?$/, title: 'Record update acknowledged', detail: m => m[1] ? 'The Last Working Day change was reviewed. The IT lock still needs to be rescheduled.' : 'The Last Working Day change from HRIS was reviewed and accepted.' },
  { match: /^Overdue reminder sent \((.+)\)$/, title: 'Overdue reminder sent', detail: m => { const n = templateForKey(m[1].toLowerCase())?.name; return n ? `${n} emailed to the team member.` : 'Overdue notice emailed to the team member.' } },
  { match: /^(Midpoint|Final) reminder sent$/, detail: m => `${m[1]} reminder emailed to the team member.` },
  { match: /^(?:SMS(?:-\w+)?) sent to the team member \((.+)\)$/, title: 'SMS sent', detail: m => `${m[1]}, marked as sent by the operator.` },
  { match: /^Courier branch confirmed via (confirmation call|email reply): (.+?), (.+?), (.+)$/, title: 'Courier branch confirmed', detail: m => `Confirmed by ${m[1] === 'confirmation call' ? 'phone call' : 'email reply'}. ${branchLabel(m[2], m[3])}, ${m[4]}.` },
  { match: /^Courier branch substituted from address on file \(team member non-response\): (.+?), (.+?), (.+)$/, title: 'Branch set from address on file', detail: m => `The team member did not reply, so the branch nearest their address was used. ${branchLabel(m[1], m[2])}, ${m[3]}.` },
  { match: /^(.+) issued - (.+) \((Check In|Check Out)\)$/, title: 'Gate pass issued', detail: m => `${m[1]}, reference ${m[2]}, ${m[3]}.` },
  { match: /^Inspection completed, routed to (.+?) - inspection record generated$/, title: 'Inspection completed', detail: m => `Routed to ${m[1]}. An inspection record was created.` },
  { match: /^Last Working Day updated (?:by HRIS\/R24|in the employee record): (.+) -> (.+)$/, title: 'Last Working Day updated', detail: m => `It changed from ${m[1]} to ${m[2]} in the employee record.` },
  { match: /^Notification emailed to assignee: (.+?) <(.+)>$/, title: 'Assignee notified', detail: m => `Emailed ${m[1]} about the change, at ${m[2]}.` },
  { match: /^Mode overridden from the address-derived auto default: "(.*)"$/, title: 'Return mode changed', detail: m => `Changed from the suggested mode. Reason: ${m[1]}` },
  { match: /^Reason overridden from (?:HRIS's|the) suggested case type: "(.*)"$/, title: 'Retrieval reason changed', detail: m => `Changed from the suggested case type. Reason: ${m[1]}` },
  { match: /^Team member address corrected for this ticket: (.+)$/, title: 'Address corrected', detail: m => `Using ${m[1]} for this ticket only.` },
  { match: /^Team member address correction cleared/, title: 'Address correction removed', detail: () => 'Back to the address on file.' },
  { match: /^Target Date re-baselined: (.+?) -> (.+?) \(reason: (.+?)\)( - ticket was in Overdue Return.*)?$/, title: 'Target date changed', detail: m => `Moved from ${m[1]} to ${m[2]}. Reason: ${m[3]}.${m[4] ? ' The ticket was overdue at the time, and that lapse stays on record.' : ''}` }
]
function splitHistoryAction(action: string): { title: string, detail: string } {
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  // No dashes in log copy: join clauses with a comma instead.
  // No dashes, arrows or "+" in log copy.
  const undash = (s: string) => s.replace(/\s*->\s*/g, ' to ').replace(/\s+-\s+/g, ', ').replace(/\s*\(\+\s*([^)]*)\)/g, ' with $1').replace(/\s+\+\s+/g, ' and ')
  for (const rule of HISTORY_DETAIL_RULES) {
    const m = action.match(rule.match)
    if (m) return { title: rule.title ?? action.replace(/\s*[-:(].*$/, '').trim(), detail: undash(rule.detail(Array.from({ length: 6 }, (_, i) => m[i] ?? '') as RuleMatch)) }
  }
  const generic = splitHistoryActionGeneric(action)
  return { title: generic.title, detail: cap(undash(generic.detail)) }
}
function splitHistoryActionGeneric(action: string): { title: string, detail: string } {
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const candidates = [action.indexOf(': '), action.indexOf(' - ')].filter(n => n > 0)
  let title = action
  let detail = ''
  if (candidates.length) {
    const at = Math.min(...candidates)
    const sepLen = action.startsWith(': ', at) ? 2 : 3
    title = action.slice(0, at)
    detail = action.slice(at + sepLen)
  }
  const paren = title.match(/^(.*?)\s*\((.+)\)$/)
  if (paren) {
    title = paren[1]!
    detail = detail ? `${paren[2]} · ${detail}` : paren[2]!
  }
  return { title: title.trim(), detail: cap(detail.trim()) }
}
/** Splits fmtDateTime()'s "Sep 30, 2026, 2:15 PM" into date and time so each can sit on its own line. */
function splitWhen(when: string): { date: string, time: string } {
  const m = when.match(/^(.*?)(?:,| at)?\s+(\d{1,2}:\d{2}\s?[AP]M)$/i)
  return m ? { date: m[1]!, time: m[2]! } : { date: when, time: '' }
}
const activityOpen = ref(false)
const activityFilter = ref<HistoryCategory | 'all'>('all')
// A timeline log's whole point is its order - newest-first (the default,
// matching how the log is actually stored) reads like a live feed, but
// tracing how a ticket got somewhere is often easier oldest-first, in the
// order things actually happened. Real per-entry timestamps (see
// pushHistory's default `when`) are what make this worth having at all.
const activitySort = ref<'newest' | 'oldest'>('newest')
const activitySortItems = [
  { label: 'Newest first', value: 'newest' as const },
  { label: 'Oldest first', value: 'oldest' as const }
]
// Reset the filter/sort every time the drawer reopens - a filter or sort
// left over from a previous look shouldn't silently change what the next
// look shows.
watch(activityOpen, (open) => { if (open) { activityFilter.value = 'all'; activitySort.value = 'newest' } })
// One entry per real HistoryCategory (see its own doc comment in
// ~/data/ticketTrackers for what each one actually covers) - covering the
// real variety of things that happen on a ticket is the point of this map,
// not a vague one-size-fits-most "Stage" bucket.
const HISTORY_CATEGORY_META: Record<HistoryCategory, { label: string, icon: string, dot: string, dotColor: string }> = {
  entry: { label: 'Entry', icon: 'i-lucide-file-text', dot: 'bg-slate-100 text-slate-500', dotColor: 'bg-slate-500' },
  asset: { label: 'Assets', icon: 'i-lucide-laptop', dot: 'bg-cyan-100 text-cyan-700', dotColor: 'bg-cyan-600' },
  checklist: { label: 'Checklist', icon: 'i-lucide-list-checks', dot: 'bg-teal-100 text-teal-700', dotColor: 'bg-teal-600' },
  itlock: { label: 'IT Lock', icon: 'i-lucide-lock', dot: 'bg-slate-200 text-slate-600', dotColor: 'bg-slate-600' },
  branch: { label: 'Branch/Courier', icon: 'i-lucide-map-pin', dot: 'bg-indigo-100 text-indigo-700', dotColor: 'bg-indigo-600' },
  send: { label: 'Send', icon: 'i-lucide-mail', dot: 'bg-blue-100 text-blue-600', dotColor: 'bg-blue-600' },
  call: { label: 'Call', icon: 'i-lucide-phone', dot: 'bg-purple-100 text-purple-600', dotColor: 'bg-purple-600' },
  transit: { label: 'Transit', icon: 'i-lucide-truck', dot: 'bg-sky-100 text-sky-700', dotColor: 'bg-sky-600' },
  return: { label: 'Return & Evidence', icon: 'i-lucide-package-check', dot: 'bg-orange-100 text-orange-700', dotColor: 'bg-orange-600' },
  gate: { label: 'Approval Gate', icon: 'i-lucide-shield', dot: 'bg-[rgb(0,127,69)]/10 text-[rgb(0,127,69)]', dotColor: 'bg-[rgb(0,127,69)]' },
  gatepass: { label: 'Gate Pass', icon: 'i-lucide-key-round', dot: 'bg-yellow-100 text-yellow-700', dotColor: 'bg-yellow-600' },
  rebaseline: { label: 'Target Date', icon: 'i-lucide-calendar-clock', dot: 'bg-amber-100 text-amber-700', dotColor: 'bg-amber-600' },
  hris: { label: 'Record updates', icon: 'i-lucide-refresh-cw', dot: 'bg-primary/10 text-primary', dotColor: 'bg-primary' },
  contact: { label: 'Contact', icon: 'i-lucide-user-check', dot: 'bg-pink-100 text-pink-700', dotColor: 'bg-pink-600' },
  navigation: { label: 'Navigation', icon: 'i-lucide-move', dot: 'bg-gray-100 text-gray-500', dotColor: 'bg-gray-500' },
  closure: { label: 'Closure', icon: 'i-lucide-check-check', dot: 'bg-emerald-100 text-emerald-700', dotColor: 'bg-emerald-600' }
}
// Only offer a filter option for a category that actually has at least one
// entry on this ticket - an empty filter option is a dead end, not a
// useful control.
const activityFilterOptions = computed(() => {
  if (!ticket.value) return []
  const present = new Set(ticket.value.history.map(h => h.category))
  return (Object.keys(HISTORY_CATEGORY_META) as HistoryCategory[]).filter(c => present.has(c))
})
// A real ticket routinely touches most of the 16 categories, which turned a
// flat pill row into a wall of chips. Same threshold this app already uses
// elsewhere (Ticket Overview's status/type/mode filters): 3 or fewer total
// options (including "All") stays a quick-glance pill row; more than that
// collapses into a single dropdown, same as any other crowded filter here.
const activityFilterIsCompact = computed(() => activityFilterOptions.value.length <= 2)
const activityFilterSelectItems = computed(() => [
  { label: 'All Categories', value: 'all' as const },
  ...activityFilterOptions.value.map(cat => ({ label: HISTORY_CATEGORY_META[cat].label, value: cat }))
])
/**
 * The log grouped by recency. Today and Yesterday entries show the time
 * only (the section already says which day); everything older shows
 * "date · time" on one line. A "week" starts on Monday; "Last Month" is
 * anything else within the past 30 days.
 */
const historySections = computed(() => {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = startOfDay(now)
  const yesterday = today - 86400000
  const weekStart = today - ((now.getDay() + 6) % 7) * 86400000
  const monthStart = today - 30 * 86400000
  const order = ['Today', 'Yesterday', 'This Week', 'Last Month', 'Older'] as const
  const buckets = new Map<string, { h: TicketHistoryEntry, timeOnly: boolean }[]>()
  for (const h of filteredHistory.value) {
    const t = new Date(h.when.replace(' at ', ', ')).getTime()
    const day = Number.isNaN(t) ? null : startOfDay(new Date(t))
    const label = day === null ? 'Older' : day >= today ? 'Today' : day >= yesterday ? 'Yesterday' : day >= weekStart ? 'This Week' : day >= monthStart ? 'Last Month' : 'Older'
    if (!buckets.has(label)) buckets.set(label, [])
    buckets.get(label)!.push({ h, timeOnly: label === 'Today' || label === 'Yesterday' })
  }
  const labels = activitySort.value === 'newest' ? order : [...order].reverse()
  return labels.filter(l => buckets.has(l)).map(label => ({ label, entries: buckets.get(label)! }))
})
const filteredHistory = computed(() => {
  if (!ticket.value) return []
  const base = activityFilter.value === 'all' ? ticket.value.history : ticket.value.history.filter(h => h.category === activityFilter.value)
  // ticket.history is stored newest-first (pushHistory unshifts) - oldest
  // first is a real re-order, not a display trick, so a copy is reversed
  // rather than mutating the ticket's own stored order.
  return activitySort.value === 'newest' ? base : [...base].reverse()
})
// Real root cause, found testing further: selecting ANY item in the header's
// "..." menu froze the page the same way - including "Copy Ticket Link",
// which opens no overlay at all. So this was never really about opening a
// Slideover from onSelect specifically; it's that the dropdown's own
// `:items` was an inline array literal, recreated fresh (new objects, new
// onSelect closures) on every single re-render. That unstable prop identity
// is exactly what corrupts a Reka UI DropdownMenu's internal open/close
// state machine mid-transition, leaving the page's scroll-lock stuck
// (`body { pointer-events: none }`) with nothing clickable. Fixed by giving
// it a genuinely stable `items` reference instead (below) - Vue only
// re-evaluates a computed when a reactive dependency it actually reads
// changes, and this one reads none.
// --- Shift from HRIS (Custodian card and IT lock) ---------------------------
const custodianShift = computed(() => ticket.value ? shiftFor(ticket.value) : null)
const lockRun = computed(() => ticket.value ? lockRunsAt(ticket.value) : null)

// --- Right rail: collapsible cards ----------------------------------------
// The rail can grow much taller than the stage beside it, so every card
// collapses to its header plus a one-line summary. The choice is remembered
// per ticket (Jira, Zendesk and Linear all remember it the same way), and
// Expand all / Collapse all sit above the cards.
type RailKey = 'custodian' | 'assets' | 'target' | 'comms' | 'shipping' | 'itlock'
const RAIL_DEFAULTS: Record<RailKey, boolean> = { custodian: true, assets: true, target: true, comms: true, shipping: false, itlock: false }
const railOpen = reactive<Record<RailKey, boolean>>({ ...RAIL_DEFAULTS })
const railOpenKey = (id: string) => `ams:ticketRailOpen:${id}`
function applyRailState() {
  const t = ticket.value
  if (!t) return
  Object.assign(railOpen, RAIL_DEFAULTS)
  // A short asset list stays open by default.
  railOpen.assets = t.assets.length <= 3
  try {
    const saved = localStorage.getItem(railOpenKey(t.id))
    if (saved) Object.assign(railOpen, JSON.parse(saved))
  } catch { /* unreadable saved state: defaults */ }
}
onMounted(applyRailState)
watch(() => ticket.value?.id, applyRailState)
function persistRailOpen() {
  if (!ticket.value) return
  try { localStorage.setItem(railOpenKey(ticket.value.id), JSON.stringify(railOpen)) } catch { /* storage unavailable */ }
}
/** A lock that needs rescheduling stays open so it can't be missed while collapsed. */
const railIsOpen = (key: RailKey) => railOpen[key] || (key === 'itlock' && !!ticket.value?.itLockNeedsReschedule)
function toggleRailCard(key: RailKey) { railOpen[key] = !railIsOpen(key); persistRailOpen() }
function onRailHeader(key: RailKey, e: MouseEvent) {
  // The header's own controls (Edit, badges that are buttons) keep their job.
  if ((e.target as HTMLElement).closest('button, a, input')) return
  toggleRailCard(key)
}

const railSummary = computed<Record<RailKey, string>>(() => {
  const t = ticket.value
  if (!t) return { custodian: '', assets: '', target: '', comms: '', shipping: '', itlock: '' }
  const shipCourier = courierProviderById(t.courierProviderId)
  return {
    custodian: `${t.employee.name} · ${t.employee.client}`,
    assets: t.assetsLocked ? `${t.assets.filter(a => a.checked).length} assets · ${assetsStatusLabel.value}` : 'Not confirmed yet',
    target: t.targetDateISO ? fmtDate(t.targetDateISO) : 'Not set',
    comms: `${smsTotals.value.sent} of ${smsTotals.value.total} texts sent`,
    shipping: `${shipCourier?.name ?? 'No courier yet'} · ${shipmentBadge.value.label}`,
    itlock: t.itLock.executedConfirmed ? 'Executed' : t.itLock.scheduledConfirmed ? 'Scheduled' : 'Not scheduled'
  }
})

// --- FR-003.11: change Reason and Mode, take over, cancel ----------------
// Reason and Mode can change only until a notice is sent, a call is logged or
// an acknowledgment is captured; the path-derived values re-resolve on change.
const pathLocks = computed(() => ticket.value ? pathChangeLockReasons(ticket.value) : [])
const pathChangeOpen = ref(false)
const pathReason = ref<TicketReason>('resignation')
const pathMode = ref<TicketMode>('onsite')
const pathNote = ref('')
const pathRecallDate = ref('')
const pathError = ref('')
const reasonOptions = (Object.keys(REASON_LABELS) as TicketReason[]).map(r => ({ label: REASON_LABELS[r], value: r }))
function openPathChange() {
  if (!ticket.value) return
  if (pathLocks.value.length) {
    toast.add({ title: 'Reason and Mode are locked', description: `Locked because ${pathLocks.value.join(', ')}.`, icon: 'i-lucide-lock', color: 'warning' })
    return
  }
  pathReason.value = ticket.value.reason
  pathMode.value = ticket.value.mode
  pathNote.value = ''
  pathRecallDate.value = ticket.value.recallEffectiveDate ?? ''
  pathError.value = ''
  pathChangeOpen.value = true
}
// Unexplained Absence is Remote only (FR-003.5), same as the create form.
watch(pathReason, (r) => { if (r === 'unexplained-absence') pathMode.value = 'remote' })
const pathPreview = computed(() => {
  const t = ticket.value
  if (!t) return null
  const path = resolvedPathFor(pathReason.value, pathMode.value)
  if (!path) return null
  const target = computeTargetDateForPath({ reason: pathReason.value, mode: pathMode.value, lwd: t.lwd, createdAt: t.createdAt, recallEffectiveDate: pathReason.value === 'recalled' ? pathRecallDate.value : undefined })
  return { path, template: templateForKey(path.templateKey)?.name ?? path.templateKey, target }
})
function doChangePath() {
  if (!ticket.value) return
  const res = changeReasonAndMode(ticket.value, pathReason.value, pathMode.value, pathNote.value, pathRecallDate.value)
  if (!res.ok) { pathError.value = res.error; return }
  pathChangeOpen.value = false
  toast.add({ title: 'Reason and Mode updated', description: 'The notice, deadline and stages now follow the new path.', icon: 'i-lucide-route', color: 'success' })
}

const takeoverOpen = ref(false)
const takeoverNote = ref('')
const takeoverError = ref('')
function openTakeover() {
  takeoverNote.value = ''
  takeoverError.value = ''
  takeoverOpen.value = true
}
function doTakeover() {
  if (!ticket.value) return
  const res = takeOverTicket(ticket.value, takeoverNote.value)
  if (!res.ok) { takeoverError.value = res.error; return }
  takeoverOpen.value = false
  toast.add({ title: 'Ticket taken over', description: 'The handover is recorded in the Activity Log.', icon: 'i-lucide-user-round-check', color: 'success' })
}

const cancelOpen = ref(false)
const cancelReason = ref<CancellationReason>('resignation-retracted')
const cancelNote = ref('')
const cancelError = ref('')
const cancelReasonOptions = (Object.keys(CANCELLATION_REASON_LABELS) as CancellationReason[]).map(r => ({ label: CANCELLATION_REASON_LABELS[r], value: r }))
function openCancel() {
  cancelReason.value = ticket.value?.reason === 'recalled' ? 'recall-reversed' : 'resignation-retracted'
  cancelNote.value = ''
  cancelError.value = ''
  cancelOpen.value = true
}
function doCancel() {
  if (!ticket.value) return
  const res = cancelRetrieval(ticket.value, cancelReason.value, cancelNote.value)
  if (!res.ok) { cancelError.value = res.error; return }
  cancelOpen.value = false
  toast.add({ title: 'Retrieval cancelled', description: 'The case is closed with no retrieval and the assets are no longer pending return.', icon: 'i-lucide-ban', color: 'success' })
}

const ticketOverflowMenuItems = computed(() => [[
  { label: 'Copy Ticket Link', icon: 'i-lucide-link', onSelect: () => copyText(window.location.href) },
  { label: 'Artifacts Summary', icon: 'i-lucide-archive', onSelect: openArtifactsSummary },
  { label: 'Activity Log', icon: 'i-lucide-history', onSelect: openActivityLog }
], ...(ticket.value?.status === 'open' ? [[
  { label: 'Change reason or mode', icon: pathLocks.value.length ? 'i-lucide-lock' : 'i-lucide-route', onSelect: openPathChange },
  { label: 'Take over ticket', icon: 'i-lucide-user-round-check', onSelect: openTakeover },
  { label: 'Cancel retrieval', icon: 'i-lucide-ban', color: 'error' as const, onSelect: openCancel }
]] : [])])
// Opening a Slideover from inside a DropdownMenu item's onSelect can still
// race the dropdown's own close transition even with a stable items array,
// so this still waits past it - nextTick, not a guessed setTimeout duration,
// so a stray deferred open can never fire long after the operator has
// already navigated elsewhere. See onBeforeUnmount below for the other half
// of that: a route change mid-transition leaving the *next* page's body
// locked, independent of what caused it here.
function openActivityLog() {
  nextTick(() => { if (ticket.value) activityOpen.value = true })
}
function openArtifactsSummary() {
  nextTick(() => { if (ticket.value) artifactsOpen.value = true })
}
onBeforeUnmount(() => {
  activityOpen.value = false
  artifactsOpen.value = false
  // Defensive, root-cause-agnostic safety net: whatever leaves a Reka UI
  // overlay's scroll-lock stuck on `body` (its own close transition never
  // finishing because the route changed out from under it, reproduced
  // live as "URL updates, view doesn't"), leaving this page always clears
  // it on the way out, so the next page never inherits a frozen body.
  if (typeof document !== 'undefined') {
    document.body.style.removeProperty('pointer-events')
    document.body.style.removeProperty('overflow')
  }
})

// --- Artifacts Summary - the produced record/reference at each stage
// (authorizing endorsement, gate references, courier/branch, gate pass,
// tracking link) currently only exists scattered across whichever stage
// produced it, so answering "what's actually on file for this ticket" means
// scanning every stage by hand. This collects the structured fields that
// already exist on the ticket into one place, grouped the same way a
// closure review would want them - not a new data model, just a single
// view over what's already there.
const artifactsOpen = ref(false)
const artifactGroups = computed(() => {
  if (!ticket.value) return []
  const t = ticket.value
  // Most rows are a label and a value. Asset and event rows also carry their parts, so the drawer can show
  // them with a clear order (title, then the short summary, then the supporting points) instead of one sentence.
  interface ArtifactEvent { title: string, summary: string, points: string[], when: string, actor: string, icon: string }
  interface ArtifactAsset { name: string, tag: string, serial: string, status: string, tone: 'ok' | 'bad' | 'pending' }
  const groups: { title: string, icon: string, items: { label: string, value: string, url?: string, event?: ArtifactEvent, asset?: ArtifactAsset }[] }[] = []

  groups.push({
    title: 'Ticket',
    icon: 'i-lucide-clipboard-list',
    items: [
      { label: 'Ticket Reference', value: t.reference },
      { label: 'Reason', value: REASON_LABELS[t.reason] },
      { label: 'Mode', value: t.mode === 'onsite' ? 'Onsite' : 'Remote' },
      { label: 'Created', value: fmtDate(t.createdAt) },
      { label: 'Assignee', value: t.assignee.name },
      { label: 'Authorizing Endorsement', value: t.authorizingEndorsement || 'Not provided' },
      { label: 'Endorsement Recorded Date', value: t.authorizingEndorsementDate ? fmtDate(t.authorizingEndorsementDate) : 'Not provided' },
      { label: 'Created By', value: t.createdBy || t.assignee.name },
      { label: 'Last Updated', value: t.lastUpdatedAt ? fmtDateTime(t.lastUpdatedAt) : fmtDate(t.createdAt) },
      { label: 'Last Updated By', value: t.lastUpdatedBy || t.createdBy || t.assignee.name },
      { label: 'Audit Trail ID', value: t.auditTrailId || `AUD-${new Date(t.createdAt).getFullYear()}-${String(t.ticketNumber).padStart(5, '0')}` }
    ]
  })

  groups.push({
    title: 'Custodian',
    icon: 'i-lucide-user',
    items: [
      { label: 'Name', value: t.employee.name },
      { label: 'Employee ID', value: t.employee.id.replace(/^\D+/, '') },
      { label: 'Email', value: t.employee.email },
      { label: 'Client / Dept.', value: `${t.employee.client} / ${t.employee.dept}` },
      { label: 'Last Working Day', value: fmtDate(t.lwd) },
      { label: 'Separation Date', value: fmtDate(t.sep) },
      { label: 'Contact Number', value: t.contact.number ? `${t.contact.number}${t.contact.numberVerified ? ' (confirmed active)' : ' (not yet confirmed)'}` : 'Not on file' }
    ]
  })

  if (t.assets.length) {
    groups.push({
      title: 'Assets',
      icon: 'i-lucide-laptop',
      items: t.assets.map((a) => {
        const status = t.assetsLocked ? (a.checked ? 'Confirmed' : 'Not returned') : 'Not yet confirmed'
        return {
          label: a.name,
          value: `Tag ${a.assetTag} · Serial ${a.serial} · ${status}`,
          asset: { name: a.model, tag: a.assetTag, serial: a.serial, status, tone: !t.assetsLocked ? 'pending' : a.checked ? 'ok' : 'bad' }
        }
      })
    })
  }

  if (t.checklistItems.length) {
    const due = checklistDueISO(t)
    groups.push({
      title: 'Offboarding checklist',
      icon: 'i-lucide-list-checks',
      items: [
        ...t.checklistItems.map((text, i) => ({ label: text, value: `${t.checklistDone[i] ? `Done${t.checklistDoneBy?.[i] ? ` by ${t.checklistDoneBy[i]}` : ''}` : 'Not done'} · ${t.checklistOptional?.[i] ? 'Optional' : 'Required'}` })),
        ...(due ? [{ label: 'Final review due', value: fmtDate(due) }] : []),
        { label: 'Final review', value: t.checklistReview ? `Signed off by ${actorFullName(t.checklistReview.by)} on ${fmtDateTime(t.checklistReview.at)}` : 'Not done yet' },
        ...(t.checklistReview?.note ? [{ label: 'Reviewer note', value: t.checklistReview.note }] : [])
      ]
    })
  }

  if (t.gateCount > 0) {
    groups.push({
      title: 'Approval Gates',
      icon: 'i-lucide-shield-check',
      items: GATE_STEPS.slice(0, t.gateCount).map(step => ({
        label: stripGateLabel(step.label),
        value: t.gateNotes[step.n] ? `${t.gateNotes[step.n]} (${fmtDate(t.gateReleaseDates[step.n] ?? null)})` : 'Not yet recorded'
      }))
    })
  }

  if (t.itLock.scheduledConfirmed) {
    groups.push({
      title: 'IT Lock',
      icon: 'i-lucide-lock',
      items: [
        { label: 'Scheduled for', value: fmtDate(t.itLock.scheduledFor) },
        { label: 'Executed', value: t.itLock.executedConfirmed ? 'Yes' : 'Not yet' }
      ]
    })
  }

  if (t.mode === 'remote' && t.courierBranchName) {
    groups.push({
      title: 'Courier & Branch',
      icon: 'i-lucide-truck',
      items: [
        { label: 'Provider', value: courierProviderById(t.courierProviderId)?.name ?? 'Not set' },
        { label: 'Branch', value: t.courierBranchName },
        { label: 'Address', value: t.courierBranchAddress },
        { label: 'Captured via', value: t.branchCaptureMethod === 'call' ? 'Confirmation call' : t.branchCaptureMethod === 'email' ? 'Email reply' : 'Not set' }
      ]
    })
  }

  if (t.gatePassRef && t.gatePass) {
    groups.push({
      title: 'GoTeam Gate Pass',
      icon: 'i-lucide-key-round',
      items: [
        { label: 'Reference', value: t.gatePassRef },
        { label: 'Movement', value: t.gatePass.movement === 'checkin' ? 'Check In' : 'Check Out' },
        { label: 'Valid Until', value: fmtDate(t.gatePass.validUntil) }
      ]
    })
  }
  if (t.buildingGatePassRef && t.buildingGatePass) {
    groups.push({
      title: 'Building Gate Pass',
      icon: 'i-lucide-key-round',
      items: [
        { label: 'Reference', value: t.buildingGatePassRef },
        { label: 'Movement', value: t.buildingGatePass.movement === 'checkin' ? 'Check In' : 'Check Out' },
        { label: 'Valid Until', value: fmtDate(t.buildingGatePass.validUntil) }
      ]
    })
  }

  if (t.mode === 'remote' && (t.transitTrackingRef || t.trackingNumber || t.trackingLink)) {
    groups.push({
      title: 'Transit',
      icon: 'i-lucide-package-check',
      items: [
        ...(t.trackingNumber ? [{ label: 'Tracking Number', value: t.trackingNumber }] : []),
        ...((t.trackingLink || t.transitTrackingRef) ? [{ label: 'Tracking Link', value: t.trackingLink || t.transitTrackingRef }] : []),
        ...(t.transitConfirmedAt ? [{ label: 'Turned Over To Courier', value: fmtDate(t.transitConfirmedAt) }] : [])
      ]
    })
  }

  if (t.evidenceProof || t.evidenceCondition) {
    groups.push({
      title: 'Return Evidence',
      icon: 'i-lucide-file-check-2',
      items: [
        { label: 'Proof-of-Receipt', value: t.evidenceProof?.name ?? 'Not uploaded', url: t.evidenceProof?.url },
        { label: 'Condition Photos', value: t.evidenceCondition?.name ?? 'Not uploaded', url: t.evidenceCondition?.url }
      ]
    })
  }

  // Post-Retrieval Charging - the real outcome-driven flow (deductionOutcome
  // + Case Details Steps 1-5) superseded the old flat ATD Reference/Date/
  // Item/Amount/Authorized By fields below; that block only ever populated
  // from a provisional form this pass removed, so it stopped showing up
  // here once nothing wrote to atdReference anymore - a real, reported gap
  // ("Post-Retrieval Charging doesn't appear in the Artifacts Summary"), not
  // a deliberate omission. Both are kept, independently gated - a ticket
  // could in principle carry old-style deductionAuthorizedBy data from
  // before this pass with no real deductionOutcome, and shouldn't lose that
  // group just because the new one didn't fire.
  if (t.atdReference) {
    groups.push({
      title: 'Deduction (legacy)',
      icon: 'i-lucide-banknote',
      items: [
        { label: 'ATD Reference', value: t.atdReference },
        { label: 'Date Initiated', value: t.deductionDate ? fmtDate(t.deductionDate) : 'Not provided' },
        { label: 'Item', value: t.deductionItem || 'Not provided' },
        { label: 'Amount', value: t.deductionAmount || 'Not provided' },
        { label: 'Authorized By', value: t.deductionAuthorizedBy || 'Not provided' }
      ]
    })
  }
  if (t.deductionOutcome) {
    const outcomeMeta = DEDUCTION_OUTCOME_META[t.deductionOutcome]
    const selectedAssets = t.assets.filter(a => t.deductionCaseAssetSerials.includes(a.serial))
    groups.push({
      title: 'Post-Retrieval Charging',
      icon: 'i-lucide-banknote',
      items: [
        { label: 'Outcome', value: outcomeMeta.label },
        { label: 'Sent', value: `${templateForKey(outcomeMeta.templateKey)?.name ?? 'Outcome notice'}${outcomeMeta.formId ? `, with ${withoutCode(RETRIEVAL_FORMS.find(f => f.id === outcomeMeta.formId)?.name ?? '')} attached` : ''}` },
        { label: 'Asset Team Officer', value: deductionCaseOfficer.value || 'Not provided' },
        { label: 'Equipment', value: selectedAssets.length ? selectedAssets.map(a => `${a.model} (${a.assetTag})`).join(', ') : 'None selected' },
        ...(t.deductionCaseAmountFigures ? [{ label: 'Amount', value: `PHP ${t.deductionCaseAmountFigures}${t.deductionCaseAmountBasis ? `, ${DEDUCTION_AMOUNT_BASIS_LABELS[t.deductionCaseAmountBasis]}` : ''}` }] : []),
        // #30 Quotation + #37 Payroll handoff on the record.
        ...(t.quotationReceivedISO ? [{ label: 'Quotation received', value: fmtDate(t.quotationReceivedISO) }] : []),
        ...(t.quotationReference ? [{ label: 'Quotation reference', value: t.quotationReference }] : []),
        ...(t.referredToPayrollAt ? [{ label: 'Referred to Payroll', value: `${fmtDateTime(t.referredToPayrollAt)} by ${actorFullName(t.referredToPayrollBy || '')}` }] : [])
      ]
    })
  }

  const sendPattern = /sent|endorsement|reminder|acknowledg/i
  const sends = t.history.filter(h => sendPattern.test(h.action))
  if (sends.length) {
    groups.push({
      title: 'Communications Sent',
      icon: 'i-lucide-mail',
      items: sends.map((h) => {
        const { title, detail } = splitHistoryAction(h.action)
        // The detail is a few short sentences. The first is the point, the rest support it.
        const sentences = (detail || '').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean)
        return {
          label: h.when,
          value: detail ? `${title}. ${detail}` : title,
          event: {
            title,
            summary: sentences[0] ?? '',
            points: sentences.slice(1),
            when: whenDot(h.when),
            actor: actorFullName(h.actor),
            icon: HISTORY_CATEGORY_META[h.category]?.icon ?? 'i-lucide-mail'
          }
        }
      })
    })
  }

  return groups
})

// --- Artifacts Summary export - "Make it cohesive" with the real PDF/print
// pipeline already built for /form-preview: same Paged.js engine, the same
// buildPrintCss()/buildFormLetterhead() this app already uses for a real
// printable document (letterhead, @page rules, themed prose styling), not a
// second, differently-built export path.
//
// This export and the team member's own closure copy deliberately produce
// the exact same document body (buildTicketRecordHtml, below) - there is
// no second, briefer "internal" version any more. That used to be two
// different documents (a flat label/value table here vs. a fuller
// sentence-based one there), which was reported as confusing: "why would
// what I send the team member differ from what I export for our own
// records?" There's only one PDF now; this button and the one on the
// Closure modal (see readOnlySendPreviewOpen) both just show/export it.
const artifactsPrintRoot = ref<HTMLElement>()
const artifactsPrinting = ref(false)
const artifactsPrintError = ref('')

/** Shared by both PDF export entry points - only the document title differs, the Paged.js/letterhead/print-CSS pipeline is the same one already proven out for /form-preview. */
async function printDocument(docTitle: string, bodyHtml: string) {
  if (!ticket.value) return
  artifactsPrintError.value = ''
  try {
    const css = buildPrintCss('letter', DEFAULT_PAGE_MARGINS, '#386BE6', '.artifacts-print-root')
    const letterhead = buildFormLetterhead({ name: `${docTitle} - Ticket ${ticket.value.ticketNumber}`, themeColor: '#386BE6' }, ticket.value.mode)
    const printContent = `
      <div id="print-header-left">${letterhead.headerLeft}</div>
      <div id="print-header-right">${letterhead.headerRight}</div>
      <div id="print-footer-left">${letterhead.footerLeft}</div>
      ${bodyHtml}
    `
    const { Previewer } = await import('pagedjs')
    if (artifactsPrintRoot.value) artifactsPrintRoot.value.innerHTML = ''
    artifactsPrinting.value = true
    document.body.classList.add('artifacts-printing')
    await nextTick()
    const previewer = new Previewer()
    await previewer.preview(printContent, [{ _: css }], artifactsPrintRoot.value!)
    window.print()
  } catch (err) {
    artifactsPrinting.value = false
    document.body.classList.remove('artifacts-printing')
    artifactsPrintError.value = 'Could not prepare the printable copy. Please try again.'
    console.error(`[ticket-tracker] ${docTitle} print failed`, err)
  }
}
async function exportArtifactsSummary() {
  if (!ticket.value) return
  await printDocument('Artifacts Summary', buildTicketRecordHtml(ticket.value))
}

/**
 * The one detailed document this ticket ever produces - covers every group
 * artifactGroups collects, addressed to the team member, in full sentences
 * rather than a bare label/value table. Used identically by both "Export as
 * PDF" here and the team member's own closure copy - there is deliberately
 * no separate, briefer "internal" version any more (that used to be two
 * different documents, which was reported as confusing). No signature block
 * - this is a copy for reference, not a document either party signs.
 * Available on demand, never auto-triggered by closing a ticket - see
 * confirmClosure(), which only logs whether it was sent.
 */
function buildTicketRecordHtml(t: Ticket): string {
  // Inline styles throughout (not page CSS) so the in-app preview and the
  // Paged.js PDF render the exact same document: a title block with the
  // record's own meta, the letter, then each artifact group as a clean
  // label/value table, the assets as a proper table, and a boxed
  // certification - built from the same tools the email editor offers
  // (headings, tables, dividers), not loose bullet lists.
  const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const C = { ink: '#0f172a', text: '#334155', muted: '#64748b', dim: '#94a3b8', line: '#e2e8f0', soft: '#f8fafc', blue: '#386BE6', green: '#00A155', red: '#dc2626' }
  const label = (s: string) => `<div style="font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.dim};margin:0 0 2px">${s}</div>`
  const heading = (s: string) => `<h2 style="font-size:13px;font-weight:700;color:${C.ink};margin:22px 0 8px;padding:0 0 6px;border-bottom:2px solid ${C.blue};display:block">${esc(s)}</h2>`
  const kvTable = (items: { label: string, value: string }[]) => `
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin:0">
      <tbody>${items.map((it, i) => `
        <tr style="background:${i % 2 ? C.soft : '#ffffff'}">
          <td style="width:38%;padding:7px 10px;color:${C.muted};border:0;border-bottom:1px solid ${C.line};vertical-align:top">${esc(it.label)}</td>
          <td style="padding:7px 10px;color:${C.text};font-weight:500;border:0;border-bottom:1px solid ${C.line};vertical-align:top">${esc(it.value)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
  const sections = artifactGroups.value.map((group) => {
    if (group.title === 'Assets') {
      const rows = t.assets.map((a, i) => {
        const outcome = a.resolution ? ASSET_RESOLUTION_LABELS[a.resolution] : (a.checked ? 'Confirmed' : 'Not returned')
        const color = outcome === 'Returned' || outcome === 'Confirmed' ? C.green : outcome === 'Not returned' ? C.red : C.text
        return `
        <tr style="background:${i % 2 ? C.soft : '#ffffff'}">
          <td style="padding:7px 10px;border:0;border-bottom:1px solid ${C.line};color:${C.text}"><span style="font-weight:600;color:${C.ink}">${esc(a.model)}</span><br><span style="color:${C.muted};font-size:10.5px">${esc(a.name)}</span></td>
          <td style="padding:7px 10px;border:0;border-bottom:1px solid ${C.line};color:${C.text}">${esc(a.assetTag)}</td>
          <td style="padding:7px 10px;border:0;border-bottom:1px solid ${C.line};color:${C.text}">${esc(a.serial)}</td>
          <td style="padding:7px 10px;border:0;border-bottom:1px solid ${C.line};color:${color};font-weight:600">${esc(outcome)}</td>
        </tr>`
      }).join('')
      const th = (s: string) => `<th style="text-align:left;padding:7px 10px;font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};background:${C.soft};border:0;border-bottom:1px solid ${C.line}">${s}</th>`
      return `${heading(group.title)}
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;border:1px solid ${C.line}">
          <thead><tr>${th('Asset')}${th('Asset tag')}${th('Serial')}${th('Outcome')}</tr></thead>
          <tbody>${rows || `<tr><td colspan="4" style="padding:10px;border:0;color:${C.muted}"><em>No assets on record.</em></td></tr>`}</tbody>
        </table>`
    }
    return `${heading(group.title)}${kvTable(group.items)}`
  }).join('')
  const generatedISO = new Date().toISOString()
  const docRef = `GT-ERC-${esc(String(t.ticketNumber))}-${generatedISO.slice(0, 10).replace(/-/g, '')}`
  const meta = (l: string, v: string) => `<td style="width:25%;padding:10px 12px 10px 0;vertical-align:top;border:0">${label(l)}<div style="font-size:11.5px;font-weight:600;color:${C.ink}">${v}</div></td>`
  return `
    <div style="font-family:'Inter',sans-serif;color:${C.text};font-size:11.5px;line-height:1.6">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.blue};margin:0 0 4px">Official Record</div>
      <h1 style="font-size:20px;font-weight:700;color:${C.ink};margin:0 0 14px;line-height:1.25">Equipment Return &amp; Closure Record</h1>
      <table style="width:100%;border-collapse:collapse;margin:0 0 18px;padding:12px 0;border-top:1px solid ${C.line};border:0;border-bottom:1px solid ${C.line}">
        <tr>
          ${meta('Document reference', docRef)}
          ${meta('Ticket', `${esc(String(t.ticketNumber))} &middot; ${esc(t.reference)}`)}
          ${meta('Generated', esc(fmtDate(generatedISO)))}
          ${meta('Status', t.status === 'closed' ? 'Closed' : 'Open')}
        </tr>
      </table>
      <p style="margin:0 0 10px">Dear ${esc(t.employee.name.split(' ')[0] ?? t.employee.name)},</p>
      <p style="margin:0 0 6px">This document confirms that GoTeam's Asset Management Team has finished processing the return of the company equipment issued to you for your separation (${esc(REASON_LABELS[t.reason])}, ${t.mode === 'onsite' ? 'Onsite' : 'Remote'}), with a Last Working Day of ${esc(fmtDate(t.lwd))}. The full record kept against this ticket is set out below.</p>
      ${sections || `<p style="color:${C.muted}"><em>Nothing produced yet.</em></p>`}
      <div style="margin:24px 0 0;padding:12px 14px;border:1px solid ${C.line};border-left:3px solid ${C.blue};background:${C.soft}">
        <div style="font-size:11.5px;font-weight:700;color:${C.ink};margin:0 0 4px">Certification</div>
        <div style="font-size:11px;color:${C.text}">The information above reflects the official record kept by GoTeam's Asset Management Team for this ticket as of the generation date stated above. It is provided for your reference and retention, and a matching record is kept by GoTeam. Questions about this record can be sent to ${esc(SAMPLE_VALUES.ASSET_TEAM_EMAIL ?? '')} or ${esc(SAMPLE_VALUES.ASSET_TEAM_MOBILE ?? '')}.</div>
      </div>
      <p style="margin:14px 0 0;font-size:10px;color:${C.dim}">System-generated record from GoTeam's Asset Management System (Ticket ${esc(String(t.ticketNumber))}). No signature is required for it to be valid.</p>
    </div>
  `
}

/** Letterhead for the closure preview's page - same header the PDF prints on every page. */
const closureLetterhead = computed(() => buildFormLetterhead({ name: `Equipment Return & Closure Record - Ticket ${ticket.value?.ticketNumber ?? ''}`, themeColor: '#386BE6' }, ticket.value?.mode ?? 'onsite'))
/** When the closure copy was (or, before closing, would be) sent. */
const closureSentWhen = computed(() => latestHistory(/^Detailed closure copy sent to team member/)?.when ?? fmtDateTime(new Date().toISOString()))
async function exportTeamMemberCopy() {
  if (!ticket.value) return
  await printDocument('Equipment Return & Closure Record', buildTicketRecordHtml(ticket.value))
}
function handleArtifactsAfterPrint() {
  artifactsPrinting.value = false
  document.body.classList.remove('artifacts-printing')
}
onMounted(() => window.addEventListener('afterprint', handleArtifactsAfterPrint))
onBeforeUnmount(() => window.removeEventListener('afterprint', handleArtifactsAfterPrint))

// --- Gate Pass - mirrors the real GoTeam AMS "Issue Gate Pass" form
// (movement, dates, purpose, team member, asset items). This is a
// deliberate operator action with real content to review, never an
// automatic side effect of opening the ticket. Team Member and Asset Items
// are pre-filled from the ticket itself (same person, same confirmed
// assets); Time and Purpose have no ticket-derived source, so those stay
// blank/suggested for the operator to fill in. ---------------------------
const gatePassViewOpen = ref(false)
const gatePassMenuOpen = ref(false)
/** Which of the ticket's two independent gate passes (see GatePassKind) the view drawer is currently acting on - set by whichever row of the Gate Passes menu was clicked. */
const gatePassKind = ref<GatePassKind>('goteam')

/** Days remaining until a gate pass's own Valid Until date ("8d left" in the Gate Passes menu) - same idea as daysLeftLabel for the ticket's Target Date, just scoped to a plain date string instead of a whole ticket. Negative once the pass has lapsed, so callers can format "expired Nd ago". */
function gatePassDaysLeft(validUntil: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const until = new Date(`${validUntil}T00:00:00`)
  return Math.round((until.getTime() - today.getTime()) / 86400000)
}

/** "Create Now" no longer opens an in-app form - the real system's own gate pass creation lives entirely in Forms › Gate Pass, a separate app this prototype doesn't have a page for, so the honest action here is just telling the operator where it happens (a new tab), not faking a local creation flow. */
function requestGatePassCreate(kind: GatePassKind) {
  gatePassMenuOpen.value = false
  toast.add({
    title: 'Opens in a new tab',
    description: `${GATE_PASS_KIND_LABEL[kind]} is created in Forms › Gate Pass, not here. This opens that form in a new tab.`,
    icon: 'i-lucide-external-link',
    color: 'info'
  })
}
function openGatePassView(kind: GatePassKind) {
  gatePassKind.value = kind
  gatePassMenuOpen.value = false
  gatePassViewOpen.value = true
}
/** The gate pass currently shown in the view drawer - resolved by gatePassKind, since the ticket carries two entirely independent records. */
const activeGatePass = computed(() => !ticket.value ? null : (gatePassKind.value === 'building' ? ticket.value.buildingGatePass : ticket.value.gatePass))
/** One row per gate pass type for the Gate Passes menu - each shows its own issued state (ref/movement/countdown, or "expired Nd ago" once lapsed) or "Not yet issued" plus a Create Now action, never both at once. */
const gatePassRows = computed(() => {
  if (!ticket.value) return []
  const t = ticket.value
  return (['goteam', 'building'] as GatePassKind[]).map((kind) => {
    const ref = kind === 'building' ? t.buildingGatePassRef : t.gatePassRef
    const pass = kind === 'building' ? t.buildingGatePass : t.gatePass
    const daysLeft = pass ? gatePassDaysLeft(pass.validUntil) : null
    return {
      kind,
      label: GATE_PASS_KIND_LABEL[kind],
      icon: kind === 'building' ? 'i-lucide-building-2' : 'i-lucide-file-text',
      issued: !!ref,
      ref,
      movementLabel: pass ? (pass.movement === 'checkin' ? 'Check In' : 'Check Out') : '',
      daysLeft,
      expired: daysLeft !== null && daysLeft < 0
    }
  })
})
/** Drives the trigger button's own status dot (green = at least one active pass, orange = at least one issued pass has lapsed) - mirrors the real Gate Passes button, which never shows a plain issued-count badge. */
const gatePassIndicator = computed<'active' | 'expired' | null>(() => {
  const issuedRows = gatePassRows.value.filter(r => r.issued)
  if (!issuedRows.length) return null
  return issuedRows.some(r => r.expired) ? 'expired' : 'active'
})

/** The ticket's contact number, or empty when the simulator's "No contact number" situation is on. Display and send rules read this, never the raw field. */
function contactNumberOf(t: { contact: { number?: string | null } }): string {
  return simSituation.value === 'no-contact' ? '' : (t.contact.number ?? '')
}
const contactNumber = computed(() => ticket.value ? contactNumberOf(ticket.value) : '')

function reopenTicket() {
  if (!ticket.value) return
  ticket.value.status = 'open'
  // Reopening a cancelled retrieval lifts the cancellation. The record stays in the Activity Log.
  ticket.value.cancellation = null
  pushHistory(ticket.value, 'Ticket Tracker reopened', 'closure')
  toast.add({ title: 'Ticket reopened', icon: 'i-lucide-rotate-ccw', color: 'success' })
}
</script>

<template>
  <!-- Loading: saved tickets hydrate just after the page's first render, so a
       ticket that exists only in storage is not "missing" yet. A skeleton of the
       real layout (header, stepper, step card, rail) holds the space instead. -->
  <div v-if="(!ticket && !ticketsHydrated) || simState === 'loading'" class="bg-gray-50 min-h-[calc(100vh-4rem)]" role="status" aria-live="polite" aria-label="Loading ticket">
    <div class="bg-white border-b border-default px-4 sm:px-8 py-5 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <SharedSkeleton width="w-8" height="h-8" circle />
        <SharedSkeleton width="w-24" height="h-7" />
        <SharedSkeleton width="w-14" height="h-5" />
      </div>
      <SharedSkeleton width="w-2/3 max-w-md" height="h-4" />
      <SharedSkeleton height="h-6" />
    </div>
    <div class="px-4 sm:px-8 py-5 flex flex-col lg:flex-row gap-5 items-start">
      <div class="w-full flex-1 min-w-0 rounded-lg border border-default bg-white p-6 flex flex-col gap-4">
        <SharedSkeleton width="w-1/3" height="h-5" />
        <SharedSkeleton :lines="3" />
        <SharedSkeleton width="w-40" height="h-9" />
      </div>
      <div class="w-full lg:w-[300px] rounded-lg border border-default bg-white p-4 flex flex-col gap-3">
        <SharedSkeleton width="w-1/2" height="h-4" />
        <SharedSkeleton :lines="4" />
      </div>
    </div>
  </div>

  <!-- Not found: only after loading has finished. Says what to do next. -->
  <div v-else-if="!ticket || simState === 'notfound'" class="flex flex-col items-center justify-center gap-3 h-[calc(100vh-4rem)] px-6 text-center">
    <UIcon name="i-lucide-ticket-x" class="size-8 text-muted" />
    <h1 class="text-base font-semibold text-highlighted">We can't find this ticket</h1>
    <p class="text-sm text-muted max-w-sm">It may have been cleared, or the link may be wrong. Open the Ticket Tracker to find it or create a new one.</p>
    <UButton to="/ticket-tracker" color="primary" variant="outline">Back to Ticket Tracker</UButton>
  </div>

  <div v-else class="bg-gray-50 min-h-[calc(100vh-4rem)] stage-enter">
    <!-- Header - sticky at top-16 (right below the app's own sticky top nav,
         see TopNavbar.vue), same technique as the Templates editor and the
         reference Asset Detail Page: the page scrolls normally, but the
         header (and the left rail below, via its own sticky offset) never
         moves once stuck - no scroll-driven layout recalculation needed. -->
    <div ref="stickyPageHeaderRef" class="lg:sticky lg:top-16 z-10 bg-white border-b border-default px-4 sm:px-8 pt-5 pb-5">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-1">
        <div class="flex items-start gap-2 min-w-0 flex-1">
          <UTooltip text="Back to Ticket Tracker">
            <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-arrow-left" class="text-muted shrink-0 mt-0.5" aria-label="Back to Ticket Tracker" to="/ticket-tracker" />
          </UTooltip>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h1 class="text-2xl font-semibold text-highlighted truncate leading-none flex items-center gap-1.5">
                <UIcon name="i-lucide-clipboard-list" class="size-5 text-muted shrink-0" />
                {{ ticket.ticketNumber }}
              </h1>
              <span
                class="font-medium inline-flex items-center text-xs px-1.5 py-0.5 gap-1 rounded-sm shrink-0"
                :class="ticket.status === 'open' ? 'bg-success/10 text-[rgb(0,127,69)]' : 'bg-elevated text-slate-600'"
              >{{ ticket.status === 'open' ? 'Open' : 'Closed' }}</span>
            </div>
            <div class="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs text-muted pt-2.5">
              <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-package-check" class="size-3.5" />Retrieval</span>
              <span class="hidden sm:inline">&middot;</span>
              <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-file-text" class="size-3.5" />{{ REASON_LABELS[ticket.reason] }}</span>
              <span class="hidden sm:inline">&middot;</span>
              <span class="inline-flex items-center gap-1"><UIcon :name="ticket.mode === 'onsite' ? 'i-lucide-building-2' : 'i-lucide-home'" class="size-3.5" />{{ ticket.mode === 'onsite' ? 'Onsite' : 'Remote' }}</span>
              <span class="hidden sm:inline">&middot;</span>
              <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-user-round" class="size-3.5" />Assigned to {{ ticket.assignee.name }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap sm:shrink-0 sm:flex-nowrap">
          <!-- Gate Passes - a single trigger, always labeled the same way,
               opening a menu with one row per gate pass type (GoTeam,
               Building) - each row shows its own real state (issued ref +
               movement + a countdown, or "expired Nd ago" once lapsed) or a
               clear "Not yet issued" plus its own "Create Now" action, never
               a bare informational row with no visible affordance. The
               trigger's own status dot (green/orange), not a plain
               issued-count badge, matches the real Gate Passes button
               (source: "Ticket Tracker.html"/"Ticket Tracker 2.html") -
               green while every issued pass is still active, orange the
               moment any one of them has lapsed. -->
          <UPopover v-model:open="gatePassMenuOpen" :content="{ side: 'bottom', align: 'end' }">
            <UButton color="neutral" variant="outline" size="md" icon="i-lucide-key-round">
              Gate Passes
              <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform duration-200" :class="{ 'rotate-180': gatePassMenuOpen }" />
              <span v-if="gatePassIndicator" class="rounded-full w-1.5 h-1.5" :class="gatePassIndicator === 'expired' ? 'bg-orange-600' : 'bg-success'" />
            </UButton>
            <template #content>
              <div class="w-72 p-1.5">
                <div v-for="row in gatePassRows" :key="row.kind" class="flex items-center gap-1 rounded-md" :class="row.issued ? 'hover:bg-gray-50' : ''">
                  <button
                    type="button"
                    class="flex-1 min-w-0 flex items-start gap-3 rounded-md px-3 py-2 text-left"
                    :class="row.issued ? 'cursor-pointer' : 'cursor-default'"
                    @click="row.issued && openGatePassView(row.kind)"
                  >
                    <UIcon :name="row.icon" class="size-4 text-dimmed shrink-0 mt-0.5" />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-highlighted">{{ row.label }}</p>
                      <div v-if="row.issued" class="flex flex-wrap items-center gap-x-1 gap-y-0 mt-0.5">
                        <span class="text-xs text-muted">{{ row.ref }}</span>
                        <span class="text-xs text-muted">&middot;</span>
                        <span class="text-xs text-muted">{{ row.movementLabel }}</span>
                        <span class="text-xs text-muted">&middot;</span>
                        <span v-if="row.expired" class="text-xs font-medium text-amber-700">Expired {{ Math.abs(row.daysLeft!) }}d ago</span>
                        <span v-else class="text-xs font-medium" :class="row.daysLeft !== null && row.daysLeft <= 2 ? 'text-amber-700' : 'text-[rgb(0,127,69)]'">{{ row.daysLeft }}d left</span>
                      </div>
                      <p v-else class="text-xs text-muted mt-0.5">{{ ticket.status === 'closed' ? 'No gate pass issued' : 'Not yet issued' }}</p>
                    </div>
                  </button>
                  <UButton v-if="!row.issued && ticket.status !== 'closed'" size="xs" color="primary" variant="soft" class="mr-1.5 shrink-0" @click="requestGatePassCreate(row.kind)">Create Now</UButton>
                </div>
              </div>
            </template>
          </UPopover>
          <UButton v-if="ticket.status === 'closed'" color="primary" variant="outline" size="md" icon="i-lucide-rotate-ccw" @click="reopenTicket">
            Reopen Ticket
          </UButton>
          <UTooltip v-if="ticket.status !== 'closed'" :text="stageKey === 'A13' ? 'Close this ticket' : 'Available once every prior stage is complete (Closure)'">
            <UButton
              color="primary"
              size="md"
              :aria-disabled="(stageKey !== 'A13') || undefined" :class="{ [disabledLook]: stageKey !== 'A13' }"
              :aria-describedby="stageKey !== 'A13' ? 'close-ticket-reason' : undefined"
              @click="guardedClick(stageKey === 'A13', 'This ticket can only be closed once every prior stage is complete.', openClosure)"
            >
              Close Ticket
            </UButton>
            <span v-if="stageKey !== 'A13'" id="close-ticket-reason" class="sr-only">Available once every prior stage is complete.</span>
          </UTooltip>
          <!-- No UTooltip wrapping this trigger - nesting Tooltip inside a
               DropdownMenu's trigger slot conflicts with its own focus/portal
               handling and freezes the whole page's interaction once the menu
               opens (reproduced live). aria-label alone still gives it an
               accessible name. -->
          <!-- Details panel toggle - same place in both states. -->
          <UTooltip :text="railCollapsed ? 'Show details' : 'Hide details'" :kbds="[']']">
            <UButton
              color="neutral"
              variant="outline"
              size="md"
              square
              class="hidden lg:inline-flex"
              :icon="railCollapsed ? 'i-lucide-panel-right-open' : 'i-lucide-panel-right-close'"
              :aria-label="railCollapsed ? 'Show details panel' : 'Hide details panel'"
              :aria-expanded="!railCollapsed"
              aria-controls="ticket-details-panel"
              @click="toggleRail"
            />
          </UTooltip>
          <UDropdownMenu :items="ticketOverflowMenuItems">
            <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-ellipsis" aria-label="More options" />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Phase tracker - shape/proportions ported from the real IT
           Workspace's own "Workflow Progress" stepper (source: "IT
           Workspace - GoTeam Assets.html") for cohesion across the app,
           refined against a wizard-stepper reference the user supplied:
           40px icon circles (a themed icon per phase, never a step number -
           done gets a check), solid fill + white icon for both done (green)
           and current (blue) - the dashed ring for the current step lives
           on an outer padded wrapper, never directly on the circle itself,
           so the ring reads as a gap around the shape rather than a stroke
           on it. These are stages, not steps (the real "steps" are the
           per-phase items in the hover popover below), so the label is a
           single line, no "Step N" caption. The connecting line is rounded
           (not sharp-edged) and half-blue on the segment leading out of the
           current stage - solid green once that segment is actually done,
           plain gray ahead of it. Colors are this module's own palette, not
           the reference's blue-only scheme. The hover-for-child-steps
           popover is this page's own addition, kept since it's a real
           value-add the reference doesn't have. -->
      <!-- Phone (<640px): the six-node icon stepper cannot fit, so it becomes a
           segmented progress bar plus a "Stage N of M" menu that lists every
           phase and jumps to it. Same state colors and same jumpToPhase. -->
      <div class="sm:hidden pt-4 pb-1 flex flex-col gap-2.5">
        <div class="flex gap-1" aria-hidden="true">
          <span
            v-for="node in phaseNodes"
            :key="node.key"
            class="h-1.5 flex-1 rounded-full"
            :class="{ 'bg-[rgb(0,127,69)]': node.state === 'done', 'bg-primary': node.state === 'current', 'bg-red-600': node.state === 'blocked', 'bg-gray-200': node.state === 'future' }"
          />
        </div>
        <UPopover :content="{ side: 'bottom', align: 'start', sideOffset: 6 }">
          <UButton color="neutral" variant="ghost" size="sm" class="-mx-2.5 self-start" trailing-icon="i-lucide-chevron-down" :aria-label="`Stage ${mobilePhasePosition} of ${phaseNodes.length}: ${mobilePhaseLabel}. Open the stage list.`">
            <span class="text-xs font-semibold text-muted">Stage {{ mobilePhasePosition }} of {{ phaseNodes.length }}</span>
            <span class="text-sm font-semibold text-highlighted">{{ mobilePhaseLabel }}</span>
          </UButton>
          <template #content>
            <div class="flex flex-col p-1.5 min-w-56">
              <button
                v-for="node in phaseNodes"
                :key="node.key"
                type="button"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm min-h-10"
                :class="node.state === 'future' ? 'text-muted' : 'hover:bg-gray-100 text-default'"
                :aria-disabled="node.state === 'future' || undefined"
                @click="jumpToPhase(node)"
              >
                <span
                  class="size-5 rounded-full flex items-center justify-center shrink-0"
                  :class="{ 'bg-[rgb(0,127,69)] text-white': node.state === 'done', 'bg-primary text-white': node.state === 'current', 'bg-red-600 text-white': node.state === 'blocked', 'bg-gray-100 text-muted': node.state === 'future' }"
                >
                  <UIcon :name="node.state === 'done' ? 'i-lucide-check' : node.state === 'blocked' ? 'i-lucide-alert-triangle' : PHASE_ICONS[node.key]" class="size-3" />
                </span>
                <span class="font-medium">{{ node.label }}</span>
                <span v-if="node.state === 'future'" class="ml-auto text-xs text-muted">Not reached</span>
              </button>
            </div>
          </template>
        </UPopover>
      </div>
      <div class="hidden sm:flex items-start pt-6 pb-5">
        <template v-for="(node, i) in phaseNodes" :key="node.key">
          <UPopover mode="hover" :content="{ side: 'bottom', sideOffset: 6 }">
            <UButton
              color="neutral"
              variant="ghost"
              class="shrink-0 px-1.5 py-1 -mx-1.5 -my-1 hover:bg-gray-100"
              :ui="{ base: 'flex-col gap-1.5' }"
              @click="jumpToPhase(node)"
            >
              <div
                class="rounded-full p-1 border-2 transition-colors duration-500"
                :class="node.state === 'current' ? 'border-dashed border-primary' : 'border-transparent'"
              >
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500"
                  :class="{
                    'bg-[rgb(0,127,69)] text-white': node.state === 'done',
                    'bg-primary text-white': node.state === 'current',
                    'bg-red-600 text-white': node.state === 'blocked',
                    'bg-gray-100 text-muted': node.state === 'future'
                  }"
                >
                  <UIcon v-if="node.state === 'done'" name="i-lucide-check" class="size-4" />
                  <UIcon v-else-if="node.state === 'blocked'" name="i-lucide-alert-triangle" class="size-4" />
                  <UIcon v-else :name="PHASE_ICONS[node.key]" class="size-4" />
                </div>
              </div>
              <span
                class="w-20 flex items-center justify-center gap-0.5 text-xs text-center leading-tight transition-colors duration-500"
                :class="{
                  'text-[rgb(0,127,69)] font-medium': node.state === 'done',
                  'text-primary font-semibold': node.state === 'current',
                  'text-red-600 font-medium': node.state === 'blocked',
                  'text-muted font-medium': node.state === 'future'
                }"
              >
                {{ node.label }}
                <!-- A chevron, not an info mark: hovering opens this phase's list of steps below it. -->
                <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 opacity-70" />
              </span>
            </UButton>
            <template #content>
              <div class="flex flex-col gap-0.5 p-3 min-w-44">
                <button
                  v-for="child in childStepsFor(node.key)"
                  :key="child.key"
                  type="button"
                  class="flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 text-left transition-colors"
                  :class="child.dotState === 'future' ? 'cursor-default' : 'hover:bg-gray-100'"
                  @click="jumpToChildStep(child)"
                >
                  <span
                    class="size-1.5 rounded-full shrink-0"
                    :class="{
                      'bg-[rgb(0,127,69)]': child.dotState === 'done',
                      'bg-primary ring-2 ring-primary/25': child.dotState === 'current',
                      'bg-gray-300': child.dotState === 'future'
                    }"
                  />
                  <span class="text-xs" :class="child.dotState === 'future' ? 'text-dimmed' : 'text-default'">{{ child.label }}</span>
                </button>
              </div>
            </template>
          </UPopover>
          <!-- Gray track with a fill layered on top, so moving to another
               stage animates the fill growing (width + color transition)
               instead of the segment snapping to its new state. -->
          <div
            v-if="i < phaseNodes.length - 1"
            class="relative flex-1 mx-3 mt-[22px] h-1 rounded-full bg-gray-200 overflow-hidden"
          >
            <div
              class="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-700 ease-out"
              :class="node.state === 'done' ? 'bg-[rgb(0,127,69)]' : 'bg-primary'"
              :style="{ width: node.state === 'done' ? '100%' : node.state === 'current' ? '50%' : '0%' }"
            />
          </div>
        </template>
      </div>
    </div>

    <div class="px-4 sm:px-8 py-5 flex flex-col lg:flex-row gap-5 lg:gap-0 items-start">
      <!-- Info rail - ordered after the main column so it renders on the
           right on desktop, matching the requested layout; order-2 also
           applies at the stacked (mobile) breakpoint so main content still
           comes first there. Collapses to a thin sliver (Notion-style)
           instead of disappearing outright, via a toggle built as a real
           tab attached to the card - not a floating circular button - so
           its own border shares the card's border (rounded on the outer/
           left side only, flush and borderless on the side touching the
           card, per explicit feedback that a separate overlapping shape
           read as disconnected). Its height matches the Custodian header
           row exactly (measured live via ResizeObserver into tabHeight,
           not a guessed fixed value, since that header's own height isn't
           a static constant - font/zoom/locale could all change it).
           Hovering the rail tints BOTH the tab's and the card's own border
           together (railHover) light blue (border-primary/40, was a plain
           gray darken - per explicit feedback the hover cue should match the
           same light-blue stroke color already used on the main panel's own
           cards, not an unrelated gray), reads as one continuous stroke
           lighting up to cue "this is clickable" - a color change, not a
           shadow, per explicit feedback that a shadow didn't read as an
           affordance the way a border color shift does. Collapsing doesn't fade the card
           to invisible first - it shrinks the clipping width down to a
           deliberate sliver (16px) so a real edge of the card - its own
           rounded corner and border - stays genuinely visible ("a little
           part exposed"), not just an empty strip with a floating icon on
           top of it. The gap between main and rail is normally the
           container's own `gap-5`, overridden to `lg:gap-0` and replaced by
           the rail's own `margin-left` instead (36px expanded, 0 collapsed)
           specifically so that margin can animate down in step with the
           width - a plain container `gap` can't be zeroed per-item like
           that. Widened from an original 20px per explicit feedback: the
           hover-revealed tab is 20px wide and sits `-left-[19px]` (flush
           against the card's own edge, per the "attached to the card" intent
           above), which left only ~1px of real clearance from whatever main
           column content happened to sit at that same height - close enough
           to visually read as touching/crowding it (reported live against
           the P&C Acknowledgement card). 28px (was 36px, tightened per feedback) keeps the tab exactly as
           flush against the rail card as before, now with a real ~17px of
           breathing room on the main-column side instead of a hairline.
           Plain flexbox (main gets flex-1 min-w-0, rail gets
           shrink-0 + an animated inline `width`/`margin-left`) instead of
           CSS grid - confirmed live that Chromium does not reliably
           recompute a CSS Grid `auto` track's size while a sibling item's
           own `width` is mid-transition; flexbox recalculates the sibling's
           size every frame of the animation, which grid did not here.
           isLgUp gates the animated width/margin to desktop only, so
           mobile keeps its plain full-width stacked rail. The
           hover/mouseleave listener sits on THIS outer wrapper (not the
           inner overflow-hidden one) specifically because the tab overlaps
           this wrapper's own edge - putting the listener on a box the tab
           partially hangs outside of caused it to flicker on/off as the
           cursor crossed that boundary. -->
      <div
        class="relative order-2 shrink-0 transition-[margin-left] duration-300 ease-in-out lg:sticky lg:top-52 w-full lg:w-auto"
        :style="isLgUp ? { marginLeft: railCollapsed ? '0px' : '16px', ...(railTop ? { top: `${railTop}px` } : {}) } : {}"
      >
        <div
          id="ticket-details-panel"
          :inert="isLgUp && railCollapsed"
          class="overflow-hidden transition-[width] duration-300 ease-in-out"
          :style="isLgUp ? { width: railCollapsed ? '0px' : '300px' } : {}"
        >
        <!-- Right-panel scroll (open item #2 + 5 Oct 2026 revision):
             * Details label + Expand all stay fixed above the scroll area.
             * Native scrollbar is hidden; fade overlays appear only when
               there is actually content past the top / bottom edge.
             * Chevron scroll buttons are absolutely positioned at
               top-center / bottom-center of the panel, visible only when
               there is somewhere to scroll in that direction.
             * The old "sticky + float: right" chevron was the cause of the
               width-jump on scroll - absolute positioning fixes it.
             * `break-all` + `min-w-0` on every inner value kills horizontal
               overflow previously forced by a long tracking URL. -->
        <!-- Explicit `h-[calc(100vh-14.5rem)]` (not max-h) so the inner scroller
             is bounded by a fixed-height box and `overflow-y-auto` actually
             triggers for every row of content (user feedback 5 Oct 2026,
             6th pass: scroll stopped at the Target Date card and the page
             scroll had to take over for the rest). -->
        <div class="relative w-full lg:w-[300px] max-w-full min-w-0">
        <!-- Chevrons: plain absolute children of this box. The scroller's
             max-height (railMaxHeight) always ends at the viewport bottom, so
             this box is fully on screen and the buttons are always visible
             and always inside the panel. -->
        <button
          v-if="railCanScrollUp && isLgUp"
          type="button"
          class="hidden lg:flex absolute z-20 items-center justify-center size-8 rounded-full bg-white border border-default shadow-md text-muted hover:text-primary hover:border-primary/40 transition-colors top-3 left-1/2 -translate-x-1/2"
          aria-label="Scroll panel up"
          @click="scrollRail(-220)"
        >
          <UIcon name="i-lucide-chevron-up" class="size-4" />
        </button>
        <button
          v-if="railCanScrollDown && isLgUp"
          type="button"
          class="hidden lg:flex absolute z-20 items-center justify-center size-8 rounded-full bg-white border border-default shadow-md text-muted hover:text-primary hover:border-primary/40 transition-colors bottom-3 left-1/2 -translate-x-1/2"
          aria-label="Scroll panel down"
          @click="scrollRail(220)"
        >
          <UIcon name="i-lucide-chevron-down" class="size-4" />
        </button>
        <div
          ref="railScrollRef"
          class="relative overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          :style="isLgUp && railTop ? { maxHeight: `calc(100vh - ${railTop}px - 16px)` } : {}"
          @scroll="updateRailScroll"
        >
          <!-- Top fade, only when content is scrolled off above. -->
          <div v-show="railCanScrollUp" class="pointer-events-none sticky top-0 h-6 -mb-6 bg-gradient-to-b from-white to-transparent z-[2]" aria-hidden="true" />
          <!-- Up / Down chevrons now live outside the scroll flow (see bottom
               of panel) as position: fixed buttons so they stay on the
               viewport while the user scrolls the page. -->

        <!-- Unified rail card - Custodian/Assets Confirmed/Target Date/IT
             Lock used to be four separate bordered cards with a gap between
             them; per explicit feedback they read better as one card, with
             each section's own header label (border-b under it) acting as
             the divider - so a border-t sits above every section but the
             first instead of a gap between four outer cards. Section shape
             itself (14px/16px/12px header padding, 14px/16px/16px body
             padding) is unchanged, ported from the real Asset Detail Page
             reference ("GoTeam Asset Detail Page (standalone).html"). -->
        <!-- rounded-tl-none - the card's own rounded top-left corner used
             to curve away right where the tab's flat right edge meets it,
             a real visible gap at that exact junction (confirmed live,
             reported as "not continuous"). Squaring off just that one
             corner lets the tab's flat edge sit flush against a flat card
             edge for their entire shared height, with no mismatch. -->
        <!-- Rail redesign (reference: a node-inspector side panel). The whole
             card carries a fill; each section is a tile with a header strip
             and a white content card underneath it. The content card has no
             top radius (it sits flush under its header) and rounds only at
             the bottom. Type rules for this panel: field labels are 12px
             uppercase in text-dimmed, values are 14px medium in text-default,
             label always on its own line above the value, 24px between field
             groups. rounded-tl-none stays - the collapse tab's flat edge sits
             flush against this corner (see the tab's own comment above). -->
        <div class="flex flex-col gap-3 pt-1 pb-1">

        <!-- Custodian -->
        <section class="rounded-lg border border-default bg-slate-50 dark:bg-gray-800/60 overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-2 cursor-pointer select-none" role="button" tabindex="0" :aria-expanded="railIsOpen('custodian')" @click="onRailHeader('custodian', $event)" @keydown.enter.prevent="toggleRailCard('custodian')" @keydown.space.prevent="toggleRailCard('custodian')">
            <h2 class="mr-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-default">Custodian</h2>
            <span v-if="!railIsOpen('custodian')" class="text-xs text-muted truncate min-w-0">{{ railSummary.custodian }}</span>
            
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="{ '-rotate-90': !railIsOpen('custodian') }" />
          </div>
          <div v-show="railIsOpen('custodian')" class="rounded-b-lg bg-white dark:bg-gray-900">
            <div class="p-4 flex flex-col gap-6">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 size-10 text-sm font-bold">
                  {{ ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2) }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-default truncate">{{ ticket.employee.name }}</div>
                  <div class="flex items-center gap-1 min-w-0">
                    <span class="text-xs text-muted truncate">{{ ticket.employee.email }}</span>
                    <UTooltip text="Copy email address">
                      <UTooltip :text="copyFlash.isCopied('email-work') ? 'Copied' : 'Copy email address'"><UButton :class="['shrink-0 -my-1', { 'copy-flash': copyFlash.isCopied('email-work') }]" size="xs" :color="copyFlash.isCopied('email-work') ? 'success' : 'neutral'" variant="ghost" square :icon="copyFlash.icon('email-work')" :aria-label="copyFlash.label('email-work', 'Copy email address')" @click="copyWithFlash('email-work', ticket.employee.email)" /></UTooltip>
                    </UTooltip>
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-6">
                <div class="min-w-0">
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Last Working Day</div>
                  <div class="text-sm font-medium text-default mt-0.5">{{ fmtDate(ticket.lwd) }}</div>
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Shift</div>
                  <div v-if="custodianShift" class="text-sm font-medium text-default mt-0.5">{{ shiftLabel(custodianShift) }}</div>
                  <div v-else class="text-sm text-muted mt-0.5">Not on file</div>
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Client</div>
                  <div class="text-sm font-medium text-default mt-0.5 truncate">{{ assetOwnerInfo(ticket).name }}</div>
                </div>
              </div>
            </div>

            <div class="px-4 pb-4 pt-2 flex flex-col gap-6">
              <div v-if="!contactNumber" class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Contact Number</div>
                <div class="text-sm text-muted mt-0.5">Not on file. It comes from the employee record.</div>
              </div>
              <div v-if="contactNumber" class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Contact Number</div>
                <div class="text-sm font-medium text-default mt-0.5">{{ contactNumber }}</div>
                <div class="flex items-center gap-1.5 mt-2">
                  <span class="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border" :class="ticket.contact.numberVerified ? 'text-[rgb(0,127,69)] bg-success/5 border-success/25' : 'text-[#894b00] bg-warning/5 border-warning/40'">
                    <span class="size-1.5 rounded-full" :class="ticket.contact.numberVerified ? 'bg-success' : 'bg-warning'" />
                    {{ ticket.contact.numberVerified ? 'Confirmed active' : 'Not yet confirmed' }}
                  </span>
                  <UButton v-if="!ticket.contact.numberVerified && ticket.status === 'open'" size="xs" color="primary" variant="soft" @click="onVerifyContact('number')">Verify</UButton>
                </div>
              </div>
              <div v-if="ticket.contact.email" class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Personal Email</div>
                <div class="flex items-center gap-1 min-w-0 mt-0.5">
                  <span class="text-sm font-medium text-default truncate">{{ ticket.contact.email }}</span>
                  <UTooltip text="Copy personal email address">
                    <UTooltip :text="copyFlash.isCopied('email-personal') ? 'Copied' : 'Copy personal email address'"><UButton :class="['shrink-0 -my-1', { 'copy-flash': copyFlash.isCopied('email-personal') }]" size="xs" :color="copyFlash.isCopied('email-personal') ? 'success' : 'neutral'" variant="ghost" square :icon="copyFlash.icon('email-personal')" :aria-label="copyFlash.label('email-personal', 'Copy personal email address')" @click="copyWithFlash('email-personal', ticket.contact.email)" /></UTooltip>
                  </UTooltip>
                </div>
                <div class="flex items-center gap-1.5 mt-2">
                  <span class="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border" :class="ticket.contact.emailVerified ? 'text-[rgb(0,127,69)] bg-success/5 border-success/25' : 'text-[#894b00] bg-warning/5 border-warning/40'">
                    <span class="size-1.5 rounded-full" :class="ticket.contact.emailVerified ? 'bg-success' : 'bg-warning'" />
                    {{ ticket.contact.emailVerified ? 'Confirmed active' : 'Not yet confirmed' }}
                  </span>
                  <UButton v-if="!ticket.contact.emailVerified && ticket.status === 'open'" size="xs" color="primary" variant="soft" @click="onVerifyContact('email')">Verify</UButton>
                </div>
              </div>
            </div>

            <!-- Secondary facts - label on its own line above the value (a
                 badge beside a long name on one line read as cramped). The
                 "Internal" badge only shows for the GoTeam case; a "Client
                 Owned" badge beside a person read as the person being owned. -->
            <div v-if="showMoreDetails" class="border-t border-default p-4 flex flex-col gap-6">
              <div class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Client</div>
                <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span class="text-sm font-medium text-default">{{ assetOwnerInfo(ticket).name }}</span>
                  <UBadge v-if="ticket.employee.client === 'Internal'" color="primary" variant="subtle" size="sm">{{ assetOwnerInfo(ticket).badge }}</UBadge>
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Department</div>
                <div class="text-sm font-medium text-default mt-0.5">{{ ticket.employee.dept }}</div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Leadership Coach</div>
                <div v-if="ticket.employee.leadershipCoach" class="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span class="text-sm font-medium text-default">{{ splitCoachLabel(ticket.employee.leadershipCoach).name }}</span>
                  <UBadge v-if="splitCoachLabel(ticket.employee.leadershipCoach).role" color="primary" variant="subtle" size="sm">{{ splitCoachLabel(ticket.employee.leadershipCoach).role }}</UBadge>
                </div>
                <div v-else class="text-sm font-medium text-dimmed mt-0.5">Not on file</div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Alt. Contact</div>
                <div class="text-sm font-medium mt-0.5" :class="ticket.contact.altNumber ? 'text-default' : 'text-dimmed'">{{ ticket.contact.altNumber || 'Not on file' }}</div>
              </div>
            </div>
            <button type="button" class="w-full border-t border-default px-4 py-3 flex items-center justify-between text-xs font-semibold text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-b-lg transition-colors" @click="showMoreDetails = !showMoreDetails">
              {{ showMoreDetails ? 'Less details' : 'More details' }}
              <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform duration-200" :class="{ 'rotate-180': showMoreDetails }" />
            </button>
          </div>
        </section>

        <!-- Assets Confirmed - always present; empty state until confirmed. -->
        <section class="rounded-lg border border-default bg-slate-50 dark:bg-gray-800/60 overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-2 cursor-pointer select-none" role="button" tabindex="0" :aria-expanded="railIsOpen('assets')" @click="onRailHeader('assets', $event)" @keydown.enter.prevent="toggleRailCard('assets')" @keydown.space.prevent="toggleRailCard('assets')">
            <h2 class="mr-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-default">Assets Confirmed</h2>
            <span v-if="!railIsOpen('assets')" class="text-xs text-muted truncate min-w-0">{{ railSummary.assets }}</span>
            <span v-if="ticket.assetsLocked && railIsOpen('assets')" class="text-xs font-bold rounded border px-1.5 py-0.5 text-center leading-tight whitespace-nowrap shrink-0" :class="ASSET_STATUS_BADGE_CLASS[assetsStatusTone]">{{ assetsStatusLabel }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="{ '-rotate-90': !railIsOpen('assets') }" />
          </div>
          <div v-show="railIsOpen('assets')" class="rounded-b-lg bg-white dark:bg-gray-900">
            <template v-if="ticket.assetsLocked">
              <div class="divide-y divide-default">
                <button v-for="a in ticket.assets" :key="a.serial" type="button" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" @click="openAssetDetail(a)">
                  <UIcon :name="assetIcon(a.name)" class="size-4 text-muted shrink-0" />
                  <span class="min-w-0 flex-1">
                    <span class="text-sm font-medium text-default block truncate">{{ a.model }}</span>
                    <span class="text-xs text-muted block truncate mt-0.5">{{ a.assetTag }}</span>
                  </span>
                  <UIcon v-if="a.checked" name="i-lucide-circle-check" class="size-4 text-success shrink-0" />
                  <span v-else class="text-xs font-medium text-dimmed shrink-0">Not returned</span>
                  <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0" />
                </button>
              </div>
              <div class="border-t border-default p-4">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Confirmed</div>
                <div class="text-sm font-medium text-default mt-0.5">{{ ticket.assets.filter(a => a.checked).length }} of {{ ticket.assets.length }}</div>
                <div class="mt-2.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div class="h-full rounded-full bg-success transition-[width] duration-500 ease-out" :style="{ width: `${ticket.assets.length ? (ticket.assets.filter(a => a.checked).length / ticket.assets.length) * 100 : 0}%` }" />
                </div>
                <p v-if="ticket.status === 'open'" class="text-xs mt-3" :class="assetsStatusTone === 'overdue' ? 'text-red-700' : assetsStatusTone === 'transit' ? 'text-blue-700' : 'text-amber-700'">Currently <strong>{{ assetsStatusLabel }}</strong>. Updates automatically as this ticket moves forward.</p>
              </div>
            </template>
            <div v-else class="flex flex-col items-center text-center gap-1.5 py-6 px-4 text-dimmed">
              <UIcon name="i-lucide-package" class="size-5" />
              <p class="text-xs">Populates once assets are confirmed.</p>
            </div>
          </div>
        </section>

        <!-- Target Date - FR-003.8(e)/(f): editable at any point before
             closure, even before a value exists; an edit re-baselines. -->
        <section class="rounded-lg border border-default bg-slate-50 dark:bg-gray-800/60 overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-2 cursor-pointer select-none" role="button" tabindex="0" :aria-expanded="railIsOpen('target')" @click="onRailHeader('target', $event)" @keydown.enter.prevent="toggleRailCard('target')" @keydown.space.prevent="toggleRailCard('target')">
            <h2 class="mr-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-default">Target Date</h2>
            <span v-if="!railIsOpen('target')" class="text-xs text-muted truncate min-w-0">{{ railSummary.target }}</span>
            <button v-if="railIsOpen('target') && ticket.status === 'open' && ticket.targetDateISO && !editingTargetDate" type="button" class="inline-flex items-center gap-1 min-h-6 px-1.5 -mx-1.5 rounded-md text-primary text-xs font-semibold hover:bg-primary/10" @click="startEditTargetDate"><UIcon name="i-lucide-pencil" class="size-3" />Edit</button>
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="{ '-rotate-90': !railIsOpen('target') }" />
          </div>
          <div v-show="railIsOpen('target')" class="rounded-b-lg bg-white dark:bg-gray-900 p-4">
            <template v-if="ticket.targetDateISO || editingTargetDate">
              <div v-if="!editingTargetDate">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Return Deadline</div>
                <div class="text-sm font-medium text-default mt-0.5">{{ fmtDate(ticket.targetDateISO) }}</div>
              </div>
              <div v-else class="flex flex-col gap-3">
                <SharedDatePicker v-model="targetDateDraft" size="sm" />
                <p v-if="targetDateDraft && targetDateDraft === (ticket.targetDateISO ?? '')" class="text-xs text-muted -mt-1.5">Pick a different date to save a change.</p>
                <textarea v-model="targetDateReasonDraft" rows="2" placeholder="Reason for this change (required)" class="border border-default rounded-md px-2 py-1.5 text-sm" />
                <div class="flex gap-2">
                  <UTooltip :text="targetDateSaveBlocker || 'Save this Target Date'">
                    <UButton size="xs" color="primary" :aria-disabled="!!targetDateSaveBlocker || undefined" :class="{ [disabledLook]: !!targetDateSaveBlocker }" @click="guardedClick(!targetDateSaveBlocker, targetDateSaveBlocker, saveTargetDateEdit)">Save</UButton>
                  </UTooltip>
                  <UButton size="xs" color="neutral" variant="outline" @click="cancelTargetDateEdit">Cancel</UButton>
                </div>
              </div>
            </template>
            <div v-else class="flex flex-col items-center text-center gap-2 py-2 text-dimmed">
              <UIcon name="i-lucide-calendar-clock" class="size-5" />
              <p class="text-xs">Not set yet. This resolves automatically once the return deadline can be calculated for this path.</p>
              <UButton v-if="ticket.status === 'open'" size="xs" color="primary" variant="soft" class="mt-1" @click="startEditTargetDate">Set Target Date</UButton>
            </div>
            <div v-if="ticket.targetDateHistory.length" class="mt-6 pt-4 border-t border-default flex flex-col gap-3">
              <span class="text-xs font-semibold uppercase tracking-wide text-dimmed">Date change history</span>
              <div v-for="(h, i) in recentTargetDateHistory" :key="i" class="flex items-start gap-2">
                <div class="size-6 rounded-full flex items-center justify-center shrink-0 bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                  <UIcon name="i-lucide-calendar-clock" class="size-3" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-default flex items-center gap-1">
                    {{ fmtDate(h.previousDateISO) }} <UIcon name="i-lucide-arrow-right" class="size-3 text-dimmed shrink-0" /> {{ fmtDate(h.newDateISO) }}
                  </div>
                  <div class="text-xs text-muted mt-0.5">{{ h.reason }}</div>
                  <div class="text-xs text-dimmed mt-0.5">{{ actorFullName(h.actor) }} &middot; {{ fmtDateTime(h.when) }}</div>
                </div>
              </div>
              <UButton
                v-if="ticket.targetDateHistory.length > 2"
                size="xs"
                color="neutral"
                variant="link"
                class="self-start px-0"
                icon="i-lucide-history"
                @click="activityOpen = true"
              >
                View all {{ ticket.targetDateHistory.length }} date changes in the Activity Log
              </UButton>
            </div>
          </div>
        </section>

        <!-- Communications - FR-003.12: the companion SMS in a sidebar box,
             laid out for copying beside the stage they belong to, each with a
             manual sent-confirmation; plus every communication step on the
             ticket and whether it is done. Copy-paste only, no gateway. -->
        <section ref="commsCardRef" class="rounded-lg border bg-slate-50 dark:bg-gray-800/60 overflow-hidden transition-shadow duration-500" :class="commsFlash ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-default'">
          <div class="px-4 py-2.5 flex items-center gap-2 cursor-pointer select-none" role="button" tabindex="0" :aria-expanded="railIsOpen('comms')" @click="onRailHeader('comms', $event)" @keydown.enter.prevent="toggleRailCard('comms')" @keydown.space.prevent="toggleRailCard('comms')">
            <h2 class="mr-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-default">Communications</h2>
            <span v-if="!railIsOpen('comms')" class="text-xs text-muted truncate min-w-0">{{ railSummary.comms }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="{ '-rotate-90': !railIsOpen('comms') }" />
          </div>
          <div v-show="railIsOpen('comms')" class="rounded-b-lg bg-white dark:bg-gray-900 p-4 flex flex-col gap-6">
            <!-- The text for the stage you are on. -->
            <div v-if="stageSms.length || callFollowUpVisible" class="flex flex-col gap-4">
              <span class="text-xs font-semibold uppercase tracking-wide text-dimmed">Text for this stage</span>

              <div v-for="s in stageSms" :key="s.code" class="rounded-lg border border-indigo-200 bg-white overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2 border-b border-indigo-100 bg-indigo-50">
                  <UIcon name="i-lucide-message-square-text" class="size-4 text-indigo-700 shrink-0" aria-hidden="true" />
                  <div class="min-w-0 mr-auto">
                    <div class="text-xs font-semibold text-indigo-900 truncate">{{ s.label }}</div>
                    <div class="text-xs text-indigo-700">SMS</div>
                  </div>
                  <span v-if="s.sent" class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700"><UIcon name="i-lucide-check" class="size-3" />Sent</span>
                  <span v-else class="shrink-0 text-xs font-semibold text-amber-800">Not sent</span>
                </div>
                <div class="p-3 flex flex-col gap-2.5">
                  <div class="flex items-center gap-1.5 text-xs text-muted">
                    <UIcon name="i-lucide-phone" class="size-3.5 shrink-0" aria-hidden="true" />
                    <span class="shrink-0">To</span>
                    <span class="font-medium text-default truncate">{{ contactNumber || 'No contact number on file' }}</span>
                  </div>
                  <p v-if="s.note" class="text-xs flex items-start gap-1.5" :class="s.note.type === 'warning' ? 'text-orange-700' : 'text-muted'">
                    <UIcon :name="s.note.type === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-info'" class="size-3.5 shrink-0 mt-px" aria-hidden="true" />{{ s.note.text }}
                  </p>
                  <div class="rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-xs leading-relaxed px-3 py-2.5">{{ s.text }}</div>
                  <div class="text-xs text-dimmed text-right">{{ s.text.length }} characters<template v-if="s.sent"> &middot; sent {{ whenDot(ticket.smsSent?.[s.code] ? fmtDateTime(ticket.smsSent[s.code]!) : '') }}</template></div>
                  <p v-if="s.unresolved" class="text-xs text-orange-700 flex items-start gap-1.5"><UIcon name="i-lucide-circle-alert" class="size-3.5 shrink-0 mt-px" aria-hidden="true" />The Target Date isn't set yet, so the date is still a placeholder.</p>
                  <p v-if="s.blockedReason && !s.sent" class="text-xs text-muted">{{ s.blockedReason }}</p>
                  <div class="flex gap-2 justify-end">
                    <UTooltip :text="ticket.status === 'closed' ? 'This ticket is closed.' : 'Copy this text'">
                      <UButton :aria-disabled="ticket.status === 'closed' || undefined" :class="{ 'copy-flash': copyFlash.isCopied(`sms-${s.code}`), [disabledLook]: ticket.status === 'closed' }" size="xs" :color="copyFlash.isCopied(`sms-${s.code}`) ? 'success' : 'neutral'" variant="outline" :icon="copyFlash.icon(`sms-${s.code}`)" @click="guardedClick(ticket.status !== 'closed', 'This ticket is closed.', () => copyWithFlash(`sms-${s.code}`, s.text))">{{ copyFlash.label(`sms-${s.code}`) }}</UButton>
                    </UTooltip>
                    <UTooltip :text="s.sent ? 'Already confirmed sent' : s.blockedReason ?? 'Mark this SMS as sent once it has actually gone out'">
                      <UButton color="primary" size="xs" icon="i-lucide-check" :aria-disabled="(!!s.sent || !!s.blockedReason) || undefined" :class="{ [disabledLook]: !!s.sent || !!s.blockedReason }" @click="guardedClick(!s.sent && !s.blockedReason, s.sent ? 'Already confirmed sent.' : (s.blockedReason ?? ''), () => markSmsSent(s))">Mark SMS sent</UButton>
                    </UTooltip>
                  </div>
                </div>
              </div>

              <!-- A7: "SMS after an unanswered attempt". The spec supplies no text for it, so this is the call-follow-up message the module already carried. -->
              <div v-if="callFollowUpVisible" class="rounded-lg border border-indigo-200 bg-white overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2 border-b border-indigo-100 bg-indigo-50">
                  <UIcon name="i-lucide-message-square-text" class="size-4 text-indigo-700 shrink-0" aria-hidden="true" />
                  <div class="min-w-0 mr-auto">
                    <div class="text-xs font-semibold text-indigo-900">Call follow-up</div>
                    <div class="text-xs text-indigo-700 truncate">3 call attempts unanswered</div>
                  </div>
                  <span v-if="ticket.smsSentAt" class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700"><UIcon name="i-lucide-check" class="size-3" />Sent</span>
                  <span v-else class="shrink-0 text-xs font-semibold text-amber-800">Not sent</span>
                </div>
                <div class="p-3 flex flex-col gap-2.5">
                  <div class="flex items-center gap-1.5 text-xs text-muted">
                    <UIcon name="i-lucide-phone" class="size-3.5 shrink-0" aria-hidden="true" />
                    <span class="shrink-0">To</span>
                    <span class="font-medium text-default truncate">{{ contactNumber || 'No contact number on file' }}</span>
                  </div>
                  <div class="rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-xs leading-relaxed px-3 py-2.5">{{ smsMessage }}</div>
                  <div class="text-xs text-dimmed text-right">{{ smsMessage.length }} characters</div>
                  <div class="flex gap-2 justify-end">
                    <UTooltip :text="ticket.status === 'closed' ? 'This ticket is closed.' : 'Copy this text'">
                      <UButton :aria-disabled="ticket.status === 'closed' || undefined" :class="{ 'copy-flash': copyFlash.isCopied('sms-call-follow-up'), [disabledLook]: ticket.status === 'closed' }" size="xs" :color="copyFlash.isCopied('sms-call-follow-up') ? 'success' : 'neutral'" variant="outline" :icon="copyFlash.icon('sms-call-follow-up')" @click="guardedClick(ticket.status !== 'closed', 'This ticket is closed.', () => copyWithFlash('sms-call-follow-up', smsMessage))">{{ copyFlash.label('sms-call-follow-up') }}</UButton>
                    </UTooltip>
                    <UTooltip :text="ticket.status === 'closed' ? 'This ticket is closed.' : ticket.smsSentAt ? 'Already confirmed sent' : !contactNumber ? 'No contact number on file. It comes from the employee record, so update it there first.' : 'Mark this SMS as sent once it has actually gone out'">
                      <UButton color="primary" size="xs" icon="i-lucide-check" :aria-disabled="(ticket.status === 'closed' || !!ticket.smsSentAt || !contactNumber) || undefined" :class="{ [disabledLook]: ticket.status === 'closed' || !!ticket.smsSentAt || !contactNumber }" @click="guardedClick(ticket.status !== 'closed' && !ticket.smsSentAt && !!contactNumber, ticket.status === 'closed' ? 'This ticket is closed.' : ticket.smsSentAt ? 'Already confirmed sent.' : 'No contact number on file. It comes from the employee record, so update it there first.', confirmSmsSent)">Mark SMS sent</UButton>
                    </UTooltip>
                  </div>
                </div>
              </div>
            </div>

            <!-- Every communication step and whether it is done. -->
            <div class="flex flex-col gap-3">
              <button type="button" class="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wide text-dimmed hover:text-default" :aria-expanded="allStepsOpen" @click="allStepsOpen = !allStepsOpen">All steps ({{ commSteps.length }})<UIcon name="i-lucide-chevron-down" class="size-4 transition-transform" :class="{ '-rotate-90': !allStepsOpen }" /></button>
              <ul v-show="allStepsOpen" class="flex flex-col gap-3">
                <li v-for="step in commSteps" :key="step.key" class="flex flex-col gap-1">
                  <div class="text-sm font-medium text-default">{{ step.label }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-if="step.email" class="inline-flex items-center gap-1 text-xs font-medium rounded-sm px-1.5 py-0.5 ring-1 ring-inset" :class="step.email.when ? 'text-green-700 bg-green-50 ring-green-600/20' : step.email.skipped ? 'text-muted bg-gray-50 ring-gray-300' : 'text-muted bg-white ring-gray-300'">
                      <UIcon :name="step.email.when ? 'i-lucide-check' : 'i-lucide-mail'" class="size-3" aria-hidden="true" />Email{{ step.email.when ? ' sent' : step.email.skipped ? ' skipped' : ' not sent' }}
                    </span>
                    <span v-for="s in step.sms" :key="s.code" class="inline-flex items-center gap-1 text-xs font-medium rounded-sm px-1.5 py-0.5 ring-1 ring-inset" :class="s.sent ? 'text-green-700 bg-green-50 ring-green-600/20' : 'text-muted bg-white ring-gray-300'">
                      <UIcon :name="s.sent ? 'i-lucide-check' : 'i-lucide-message-square-text'" class="size-3" aria-hidden="true" />SMS{{ s.sent ? ' sent' : ' not sent' }}
                    </span>
                    <span v-if="step.calls" class="inline-flex items-center gap-1 text-xs font-medium rounded-sm px-1.5 py-0.5 ring-1 ring-inset text-muted bg-white ring-gray-300">
                      <UIcon name="i-lucide-phone" class="size-3" aria-hidden="true" />{{ step.calls }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Courier & Shipping - remote retrievals only. The shipment does
             not arrive at once, so the Asset Team adds the tracking number and
             link here as they come in and sees the courier, branch and status
             in one place, not scattered across the Activity Log. -->
        <section v-if="ticket.mode === 'remote'" class="rounded-lg border border-default bg-slate-50 dark:bg-gray-800/60 overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-2 cursor-pointer select-none" role="button" tabindex="0" :aria-expanded="railIsOpen('shipping')" @click="onRailHeader('shipping', $event)" @keydown.enter.prevent="toggleRailCard('shipping')" @keydown.space.prevent="toggleRailCard('shipping')">
            <h2 class="mr-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-default">Courier &amp; Shipping</h2>
            <span v-if="!railIsOpen('shipping')" class="text-xs text-muted truncate min-w-0">{{ railSummary.shipping }}</span>
            <span v-if="railIsOpen('shipping')" class="text-xs font-semibold border rounded px-1.5 py-0.5 whitespace-nowrap" :class="shipmentBadge.cls">{{ shipmentBadge.label }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="{ '-rotate-90': !railIsOpen('shipping') }" />
          </div>
          <div v-show="railIsOpen('shipping')" class="rounded-b-lg bg-white dark:bg-gray-900 p-4 flex flex-col gap-6">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Courier</div>
              <div v-if="shipmentCourier" class="mt-0.5">
                <div class="text-sm font-medium text-default">{{ shipmentCourier.name }}</div>
                <div class="text-xs text-muted">Account manager {{ shipmentCourier.accountManager }}</div>
              </div>
              <div v-else class="text-sm text-dimmed mt-0.5">Not selected yet</div>
            </div>
            <div v-if="ticket.courierBranchName">
              <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Drop-off Branch</div>
              <div class="text-sm font-medium text-default mt-0.5">{{ ticket.courierBranchName }}</div>
              <div v-if="ticket.courierBranchAddress" class="text-xs text-muted">{{ ticket.courierBranchAddress }}</div>
            </div>
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Turned Over To Courier</div>
              <div v-if="ticket.transitConfirmedAt" class="text-sm font-medium text-default mt-0.5">
                {{ fmtDate(ticket.transitConfirmedAt) }}
                <span v-if="shipmentState === 'in-transit' || shipmentState === 'delayed'" class="text-xs font-normal text-muted">&middot; day {{ shipmentDaysSinceTurnover }}</span>
              </div>
              <div v-else class="text-sm text-dimmed mt-0.5">Not yet</div>
            </div>
            <!-- Tracking Number: edited in place by its own pencil. -->
            <div>
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Tracking Number</div>
                <UTooltip v-if="editingShipField !== 'number' && shipmentHandedOver && ticket.status === 'open' && shipmentState !== 'received'" :text="ticket.trackingNumber ? 'Edit tracking number' : 'Add tracking number'">
                  <UButton size="xs" color="primary" variant="ghost" square :icon="ticket.trackingNumber ? 'i-lucide-pencil' : 'i-lucide-plus'" :aria-label="ticket.trackingNumber ? 'Edit tracking number' : 'Add tracking number'" @click="startEditShipField('number')" />
                </UTooltip>
              </div>
              <template v-if="editingShipField !== 'number'">
                <div v-if="ticket.trackingNumber" class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-sm font-medium text-default break-all">{{ ticket.trackingNumber }}</span>
                  <UTooltip :text="copyFlash.isCopied('tracking-number') ? 'Copied' : 'Copy tracking number'">
                    <UButton :class="{ 'copy-flash': copyFlash.isCopied('tracking-number') }" size="xs" :color="copyFlash.isCopied('tracking-number') ? 'success' : 'neutral'" variant="ghost" square :icon="copyFlash.icon('tracking-number')" :aria-label="copyFlash.label('tracking-number', 'Copy tracking number')" @click="copyWithFlash('tracking-number', ticket.trackingNumber!)" />
                  </UTooltip>
                </div>
                <div v-else class="text-sm text-dimmed mt-0.5">{{ shipmentHandedOver ? 'Not added yet' : 'Added at the Transit step' }}</div>
              </template>
              <div v-else class="mt-1.5 flex items-center gap-1.5">
                <UInput v-model="shipNumberDraft" placeholder="e.g. JRS-0048213377" size="sm" class="flex-1" autofocus @keyup.enter="saveShipField('number')" @keyup.esc="cancelEditShipField" />
                <UTooltip text="Save"><UButton size="xs" color="primary" square icon="i-lucide-check" aria-label="Save tracking number" @click="saveShipField('number')" /></UTooltip>
                <UTooltip text="Cancel"><UButton size="xs" color="neutral" variant="ghost" square icon="i-lucide-x" aria-label="Cancel" @click="cancelEditShipField" /></UTooltip>
              </div>
            </div>
            <!-- Tracking Link: edited in place by its own pencil. The Open and Copy actions stay as separate buttons below the value. -->
            <div>
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Tracking Link</div>
                <UTooltip v-if="editingShipField !== 'link' && shipmentHandedOver && ticket.status === 'open' && shipmentState !== 'received'" :text="shipmentLink ? 'Edit tracking link' : 'Add tracking link'">
                  <UButton size="xs" color="primary" variant="ghost" square :icon="shipmentLink ? 'i-lucide-pencil' : 'i-lucide-plus'" :aria-label="shipmentLink ? 'Edit tracking link' : 'Add tracking link'" @click="startEditShipField('link')" />
                </UTooltip>
              </div>
              <template v-if="editingShipField !== 'link'">
                <div v-if="shipmentLink" class="mt-0.5">
                  <div class="text-sm font-medium text-default break-all">{{ shipmentLink }}</div>
                  <div class="flex gap-2 mt-1.5">
                    <UButton size="xs" color="primary" variant="soft" icon="i-lucide-external-link" :to="shipmentLink" target="_blank">Open tracking</UButton>
                    <UButton :class="{ 'copy-flash': copyFlash.isCopied('tracking-link') }" size="xs" :color="copyFlash.isCopied('tracking-link') ? 'success' : 'neutral'" variant="outline" :icon="copyFlash.icon('tracking-link')" @click="copyWithFlash('tracking-link', shipmentLink)">{{ copyFlash.label('tracking-link', 'Copy link') }}</UButton>
                  </div>
                </div>
                <div v-else class="text-sm text-dimmed mt-0.5">{{ shipmentHandedOver ? 'Not added yet' : 'Added at the Transit step' }}</div>
              </template>
              <div v-else class="mt-1.5 flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <UInput v-model="shipLinkDraft" placeholder="https://jrs-express.com/track/..." size="sm" class="flex-1" autofocus @keyup.enter="saveShipField('link')" @keyup.esc="cancelEditShipField" />
                  <UTooltip text="Save"><UButton size="xs" color="primary" square icon="i-lucide-check" aria-label="Save tracking link" @click="saveShipField('link')" /></UTooltip>
                  <UTooltip text="Cancel"><UButton size="xs" color="neutral" variant="ghost" square icon="i-lucide-x" aria-label="Cancel" @click="cancelEditShipField" /></UTooltip>
                </div>
                <p v-if="shipLinkDraft.trim() && !shipLinkValid" class="text-xs text-red-600">Not a valid tracking link for {{ shipmentCourier?.name ?? 'this courier' }}.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- IT Lock - persistent regardless of stage, so the HRIS/R24
             banner's Acknowledge action always has somewhere to point. The
             two values share a row, split by a vertical divider. -->
        <section ref="itLockCardRef" class="rounded-lg border overflow-hidden" :class="ticket.itLockNeedsReschedule ? 'border-red-200 bg-red-50' : 'border-default bg-slate-50 dark:bg-gray-800/60'">
          <div class="px-4 py-2.5 flex items-center gap-2 cursor-pointer select-none" role="button" tabindex="0" :aria-expanded="railIsOpen('itlock')" @click="onRailHeader('itlock', $event)" @keydown.enter.prevent="toggleRailCard('itlock')" @keydown.space.prevent="toggleRailCard('itlock')">
            <h2 class="mr-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide" :class="ticket.itLockNeedsReschedule ? 'text-red-700' : 'text-default'">IT Lock</h2>
            <span v-if="!railIsOpen('itlock')" class="text-xs text-muted truncate min-w-0">{{ railSummary.itlock }}</span>
            <span v-if="ticket.itLockNeedsReschedule" class="text-xs font-bold text-red-700 bg-red-100 border border-red-200 rounded px-1.5 py-0.5">Needs reschedule</span>
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="{ '-rotate-90': !railIsOpen('itlock') }" />
          </div>
          <div v-show="railIsOpen('itlock')" class="rounded-b-lg bg-white dark:bg-gray-900 p-4">
            <template v-if="ticket.itLock.scheduledConfirmed">
              <div class="grid grid-cols-2 divide-x divide-default">
                <div class="min-w-0 pr-4">
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Scheduled For</div>
                  <div class="text-sm font-medium text-default mt-0.5">{{ lockRun ? fmtDate(lockRun.dateISO) : fmtDate(ticket.itLock.scheduledFor) }}</div>
                  <div v-if="lockRun" class="text-xs text-muted mt-0.5">{{ lockRun.clock }}</div>
                </div>
                <div class="min-w-0 pl-4">
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Executed</div>
                  <div class="text-sm font-medium mt-0.5" :class="ticket.itLock.executedConfirmed ? 'text-success' : 'text-default'">{{ ticket.itLock.executedConfirmed ? 'Yes' : 'Not yet' }}</div>
                </div>
              </div>
              <p v-if="ticket.itLockNeedsReschedule" class="text-xs text-red-700 mt-4">The Last Working Day changed after this lock was scheduled. Reschedule it against the current date to resolve.</p>
              <UButton v-if="ticket.itLockNeedsReschedule && ticket.status === 'open'" color="error" size="sm" class="mt-3" @click="doRescheduleItLock">Reschedule Now</UButton>
            </template>
            <div v-else class="flex flex-col items-center text-center gap-1.5 py-2 text-dimmed">
              <UIcon name="i-lucide-lock" class="size-5" />
              <p class="text-xs">Not yet scheduled. This populates once IT lock scheduling is confirmed.</p>
            </div>
          </div>
        </section>
        </div>
          <!-- Bottom fade, only when content runs past the bottom edge. -->
          <div v-show="railCanScrollDown" class="pointer-events-none sticky bottom-0 h-6 -mt-6 bg-gradient-to-t from-white to-transparent z-[2]" aria-hidden="true" />
        </div>
        </div>
        </div>
      </div>

      <!-- Main column -->
      <div ref="stageSectionRef" class="flex flex-col gap-4 flex-1 min-w-0 order-1 w-full lg:w-auto">
        <!-- Gate tracker - advisory only (see the comment on t19Available
             above): recording a gate is a P&C compliance record, never a
             requirement to move this ticket forward. Collapsed to a single
             quiet row by default so it doesn't compete with the stage
             content below; expands for the per-gate detail and recording
             UI. Applies to every gated reason (End of Contract, Recalled,
             Unexplained Absence), not only the one currently in view. -->
        <div v-if="ticket.gateCount === 0" class="rounded-lg bg-gray-100 text-slate-600 text-sm px-3.5 py-2 flex items-center gap-2">
          <UIcon name="i-lucide-unlock" class="size-3.5" /> No approval gate on this path.
        </div>
        <!-- P&C Acknowledgement - "Approval Gates" was dropped per explicit
             feedback: the word "gates" reads as something that blocks the
             ticket, when this is genuinely optional/advisory, so the header
             just names what it actually is instead of an umbrella term. The
             title itself is dynamic (gateHeaderTitle) - it names the current
             outstanding gate (e.g. "Return-to-Work Notice and Notice to
             Explain" once Gate 1 clears) and only falls back to the generic
             "P&C Acknowledgement" once every applicable gate is released.
             overflow-hidden matters here - without it, the header button's
             own flat bg-white rectangle doesn't follow the container's
             rounded top corners, a real rendered glitch (reported live as
             "the stroke looks disconnected at the top corners"). Header is
             always plain white (no gray/green fill at all); the only signal
             for "complete" is the icon switching to shield-check and the
             title switching to green. The expanded content below has no
             fill/padding/border of its own either - it's not a second card
             nested inside the first one, just plain content flowing under
             the header. -->
        <!-- has-[:focus-visible] on the outer rounded box (not a focus ring
             on the button itself) so the ring follows the CARD's own
             rounded shape, in both states - a plain focus-visible ring on
             the button was the browser's own default black rectangular
             outline, which ignored the card's border-radius entirely (a
             real confirmed bug: "disconnected corners" + "black" + "only
             outlines the header when collapsed"). This fixes all three at
             once, since the ring now belongs to the shape that's actually
             rounded and actually spans the whole card regardless of
             gateBannerOpen. Deliberately `has-[:focus-visible]`, not
             `focus-within` (real bug, reported live: `focus-within` fires
             on every mouse click too, since clicking a button/input also
             focuses it - the ring was appearing as a distracting click
             flash, not the keyboard-only affordance it's meant to be).
             `:focus-visible` is the browser's own (and Nuxt UI's own
             components') default rule for "only show a focus ring for
             keyboard/assistive-tech navigation, never for a mouse click" -
             this restores that default instead of overriding it. The ring's
             own color matches the card's current state - blue/primary while
             a gate is still pending, the same green as the satisfied
             border/icon/title once every applicable gate is released. -->
        <div
          v-else
          class="rounded-lg border overflow-hidden has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-0"
          :class="ticket.gatesReleased >= ticket.gateCount ? 'border-[rgb(0,127,69)]/25 has-[:focus-visible]:ring-[rgb(0,127,69)]/30' : 'border-default has-[:focus-visible]:ring-primary/40'"
        >
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left bg-white outline-none"
            :class="[gateBannerOpen ? 'border-b' : '', ticket.gatesReleased >= ticket.gateCount ? 'border-[rgb(0,127,69)]/25' : 'border-default']"
            @click="gateBannerOpen = !gateBannerOpen"
          >
            <div class="flex items-center gap-2 min-w-0">
              <UIcon
                :name="ticket.gatesReleased >= ticket.gateCount ? 'i-lucide-shield-check' : 'i-lucide-shield'"
                class="size-4 shrink-0"
                :class="ticket.gatesReleased >= ticket.gateCount ? 'text-[rgb(0,127,69)]' : 'text-muted'"
              />
              <span class="font-semibold" :class="ticket.gatesReleased >= ticket.gateCount ? 'text-[rgb(0,127,69)]' : 'text-default'">{{ gateHeaderTitle }}</span>
              <UBadge color="neutral" variant="outline" size="sm">Optional</UBadge>
            </div>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 shrink-0 transition-transform duration-200"
              :class="[gateBannerOpen ? 'rotate-180' : '', ticket.gatesReleased >= ticket.gateCount ? 'text-[rgb(0,127,69)]' : 'text-default']"
            />
          </button>
          <div v-if="gateBannerOpen" class="flex flex-col gap-1.5">
            <!-- No border on these anymore - a stroke per step, plus the
                 card's own outer stroke, plus the header's own divider
                 above, was three overlapping strokes competing in one small
                 area. The card's outer border is the only stroke this
                 content needs. Padding matches the header's own 16px sides
                 now too (was a much narrower 10px/8px), and neither line
                 below states or implies this blocks anything anymore -
                 "Once recorded" / "Not yet confirmed" read like a real gate
                 mechanism, which this deliberately isn't; step.unlocks is
                 now plain informational copy about what the acknowledgement
                 itself is, not what it unlocks. Text here stays neutral
                 (title/description) regardless of recorded state per
                 explicit feedback - green is reserved for the header only
                 plus, within this content, only the recorded note's own
                 value and the checkmark; a fully green title/description
                 read as overdone. The checkmark sits right beside the title
                 now, not pinned to the far right of the row where it read
                 as disconnected from what it was actually confirming. -->
            <div
              v-for="step in GATE_STEPS.slice(0, ticket.gateCount)"
              :key="step.n"
              class="rounded-md px-4 py-4 text-sm bg-white text-muted"
            >
              <!-- Title keeps its own text-highlighted color (per explicit
                   feedback - only the description was ever meant to change).
                   Description is now plain text-muted - it was text-muted
                   plus a manual opacity-80 stacked on top of it, double-
                   muting the same color instead of using Nuxt UI's own
                   semantic muted token directly. -->
              <div class="flex items-center gap-1.5">
                <div class="text-highlighted" :class="ticket.gatesReleased >= step.n ? 'font-semibold' : 'font-medium'">{{ stripGateLabel(step.label) }}</div>
                <UIcon v-if="ticket.gatesReleased >= step.n" name="i-lucide-check" class="size-4 shrink-0 text-[rgb(0,127,69)]" />
              </div>
              <div class="text-xs mt-0.5 text-muted">{{ step.unlocks }}</div>
              <div v-if="ticket.gatesReleased < step.n && (step.n === 1 || ticket.gatesReleased === step.n - 1)" class="flex items-center gap-2 mt-2">
                <UInput
                  v-model="gateNoteDrafts[step.n]"
                  size="sm"
                  placeholder="Who confirmed this, e.g. via call with P&C"
                  class="flex-1"
                />
                <UButton size="sm" color="primary" @click="recordGate(step.n)">Record</UButton>
              </div>
              <!-- Same label-caption-above/value-below shape used for every
                   other captured value in this app's read mode (Custodian,
                   Target Date, IT Lock, etc.) instead of a plain "Label:
                   value" line - only the value itself is green here, not
                   the caption, matching the "only the input is green" ask. -->
              <div v-if="ticket.gateNotes[step.n]" class="mt-2 flex flex-col gap-0.5">
                <span class="text-xs text-muted">Note</span>
                <span class="text-sm text-[rgb(0,127,69)]">{{ ticket.gateNotes[step.n] }}</span>
              </div>
            </div>
            <!-- T19 (Equipment Safekeeping Request) genuinely has no drafted
                 template yet - FR-003.13 Open Item #6 says so explicitly and
                 that it doesn't block the build. This button still logs the
                 send to history for the record, but is honest that there's
                 no real template content behind it (unlike a real
                 EmailAttachSection, which this deliberately isn't). -->
            <div v-if="t19Available" class="flex flex-col items-start gap-1 mt-1">
              <UButton color="primary" variant="soft" size="sm" icon="i-lucide-shield" @click="sendSafekeeping">
                Send Equipment Safekeeping Request instead
              </UButton>
              <span class="text-xs text-dimmed">T19 template not yet drafted (FR-003.13) - this records the send to history only.</span>
            </div>
          </div>
        </div>

        <!-- HRIS/R24 update banner - fires from the Simulation Control in the
             top navbar (this app has no live R24 connection). Restrained on
             purpose (a single dismissible banner, not a modal or repeated
             toast) per the explicit design intent: visible, not annoying. -->
        <SharedBanner v-if="ticket.hrisUpdatePending" tone="info" title="Last Working Day changed" role="status">
          <template v-if="ticket.hrisUpdateChangedAt" #aside>{{ fmtDateTime(ticket.hrisUpdateChangedAt) }}</template>
          The Last Working Day is now {{ fmtDate(ticket.lwd) }}. The Target Date was reviewed and updated, and the assignee has been emailed.
          <template v-if="ticket.itLockNeedsReschedule" #body>
            <p class="text-xs font-medium text-red-700 flex items-start gap-1.5"><UIcon name="i-lucide-circle-alert" class="size-3.5 shrink-0 mt-px" aria-hidden="true" />The IT lock was scheduled against the old date. Reschedule it below before this is considered resolved.</p>
          </template>
          <template #actions>
            <UButton size="sm" color="neutral" variant="outline" @click="acknowledgeUpdate">Acknowledge</UButton>
          </template>
        </SharedBanner>

        <!-- Cancelled retrieval (FR-003.11): closed with no retrieval. -->
        <SharedBanner v-if="ticket.cancellation" tone="danger" icon="i-lucide-ban" class="mb-6" :title="`Retrieval cancelled: ${CANCELLATION_REASON_LABELS[ticket.cancellation.reason]}`">
          <template #aside>{{ fmtDateTime(ticket.cancellation.at) }}</template>
          {{ ticket.cancellation.note }}
          <template #body>
            <p class="text-xs text-muted">{{ ticket.cancellation.by }}. No retrieval, and the assets are no longer pending return.</p>
          </template>
        </SharedBanner>

        <!-- Transit delayed - FR-003.6 B11a: a flag only, not one of
             FR-003.10's status-model values (see ticketStatusLabel's own
             comment on that) - the asset hasn't arrived within 14 calendar
             days of turnover to the provider. Distinct from Overdue Return,
             which B11 already halted the moment transit was confirmed - this
             doesn't reopen that clock, it's a separate signal. -->
        <SharedBanner v-if="transitDelayed" tone="warning" icon="i-lucide-truck" title="Shipment delayed" role="status">
          Turned over to the courier on {{ fmtDate(ticket.transitConfirmedAt) }} and still not confirmed received after 14 calendar days. Follow up with the courier.
        </SharedBanner>

        <!-- What's Next card - stays reachable after closure too (browsable
             via Back/Forward, see below), so a closed ticket's stage history
             can actually be reviewed one stage at a time instead of being
             stuck on a single closure recap. Read-only once closed: the
             body wrapper's own classes below strip out every interactive
             control rather than gating each one individually across a dozen
             different stage-kind branches. -->
        <div v-else-if="meta" ref="whatsNextCardRef" class="rounded-lg border border-primary/30 bg-white overflow-hidden">
          <!-- Header bar - ported off the reference Asset Detail Page's own
               "editing asset details" header shape: a soft-blue fill
               continuing all the way to the container edges. The stage name
               itself isn't repeated here (it's already on the stepper above)
               - instead Previous sits at the start followed by a step count
               ("Step X of Y" within this phase), so progress is visible
               without hovering the stepper, and Next is pinned to the far
               right so the two controls are never adjacent. Both are
               unfilled by default and only pick up the primary-blue fill
               (white icon) on hover, per the app's own hover convention. -->
          <div class="px-4 py-2.5 border-b flex items-center justify-between gap-3 bg-primary/10 border-primary/15">
            <div class="flex items-center gap-2 min-w-0">
              <UTooltip v-if="canGoBack" text="Back to previous step">
                <!-- blur() on click - Reka UI's Tooltip opens on focus as
                     well as hover (accessibility default), and a clicked
                     `<button>` keeps browser focus afterward in Chromium, so
                     without this the tooltip stayed open after the click
                     until something else took focus, reported live as
                     "appears even when not hovering." Same root cause
                     already documented elsewhere in this file for a
                     dialog's auto-focused close button. -->
                <button
                  type="button"
                  class="flex items-center justify-center rounded-md size-6 shrink-0 text-primary hover:bg-primary hover:text-white transition-colors"
                  aria-label="Back to previous step"
                  @click="(e) => { goBack(); (e.currentTarget as HTMLElement).blur() }"
                >
                  <UIcon name="i-lucide-arrow-left" class="size-4" />
                </button>
              </UTooltip>
              <span class="text-xs font-semibold uppercase tracking-wide truncate text-primary">Step {{ stepProgress.index }} of {{ stepProgress.total }}</span>
              <span v-if="ticket.status === 'closed'" class="text-xs font-bold text-muted bg-white border border-primary/15 rounded-full px-2 py-0.5 shrink-0">Read only</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UTooltip v-if="canGoForward" text="Forward to next step">
                <button
                  type="button"
                  class="flex items-center justify-center rounded-md size-6 shrink-0 text-primary hover:bg-primary hover:text-white transition-colors"
                  aria-label="Forward to next step"
                  @click="(e) => { goForward(); (e.currentTarget as HTMLElement).blur() }"
                >
                  <UIcon name="i-lucide-arrow-right" class="size-4" />
                </button>
              </UTooltip>
            </div>
          </div>

          <!-- Read-only once closed - the native `inert` attribute (not a
               pointer-events-none CSS hack) makes every stage-kind branch
               below genuinely non-interactive, non-focusable, and excluded
               from the accessibility tree in one place, instead of gating a
               dozen separate action buttons/inputs one by one across every
               branch. This matters beyond just blocking clicks: a
               pointer-events-none div still leaves every button/Tooltip
               trigger inside it fully mounted and focusable, which was
               confusing Reka UI's shared focus/tooltip bookkeeping the
               moment a dialog (the header's "..." menu, Activity Log,
               Artifacts Summary) opened elsewhere on the page and tried to
               auto-focus its own close button - reproduced live as a
               whole-page freeze that only ever happened on a closed
               (read-only) ticket. `inert` removes the hidden buttons from
               that bookkeeping entirely, not just from view. -->
          <!-- inert hides every button below (including this stage's own
               attach chips), which had the side effect of making a
               previously-sent email/form completely unviewable once a
               ticket closed - a real regression, reported live. These small
               links sit outside the inert subtree so Preview keeps working
               read-only, without un-inerting the Edit/Replace/Remove actions
               that shouldn't work on a closed ticket. -->
          <!-- Title/description sit outside the inert wrapper below (plain
               text, nothing interactive, so being technically "not inert"
               changes nothing about them) specifically so the read-only
               attach chips can render directly beneath the title - their
               natural in-flow position when the ticket is open - rather
               than being hoisted above the title entirely, which is where
               they'd have to sit if they stayed inside the same div as the
               inert content below (reported live as landing "above the step
               title", not wanted). -->
          <div :key="`head-${stageKey}`" class="px-6 pt-6 stage-enter">
          <h2 class="text-base font-semibold text-highlighted mb-0.5">{{ meta.title }}</h2>
          <p class="text-sm text-muted mb-6">{{ meta.kind === 'closure' && ticket.status === 'closed' ? 'This ticket is closed. Here is its final state.' : meta.desc }}</p>
          <p v-if="meta.systemNote" class="text-sm text-muted bg-gray-50 border border-dashed border-default rounded-md px-3 py-2 mb-6">{{ meta.systemNote }}</p>
          </div>
          <!-- Read-only recipient context - reproduces exactly what sat
               between the title and the attach chip when this ticket was
               still open (EmailRecipientsSummary/RecipientChip for
               template-send, plus the "Reminders sent N of 2" box for
               reminders) so the chip below lands in its real original
               position, not just "somewhere below the title" (reported live
               - the first fix moved the chip below the title, but not all
               the way down to where it actually used to sit). Duplicated
               here rather than reused in place because RecipientChip's own
               action slot (the manual-email toggle) is a real editing
               control that has to stay disabled-in-place inside the inert
               body below, not revived by being hoisted out with it. -->
          <div v-if="ticket.status === 'closed' && meta.kind === 'template-send'" class="px-6 pb-4">
            <EmailRecipientsSummary :to="sendToEmail" :cc="effectiveTemplate?.cc ?? []" :bcc="effectiveTemplate?.bcc ?? []" class="mb-6" />
            <RecipientChip label="Send To"
              v-if="stageKey === 'B9'"
              :name="courierRecipient ? `${courierRecipient.name} - Account Manager` : 'No courier selected yet'"
              :detail="courierRecipient ? `${courierRecipient.accountManager} · Corporate account` : 'Confirm the courier branch first'"
              :initials="(courierRecipient?.accountManager ?? '??').split(' ').map(w => w[0]).join('').slice(0, 2)"
            />
            <RecipientChip label="Send To"
              v-else
              :name="ticket.employee.name"
              :detail="useManualEmail ? `${manualEmail || 'Personal email not entered yet'} · ${ticket.employee.position}` : `${ticket.employee.email} · ${ticket.employee.position}`"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
            />
          </div>
          <div v-if="ticket.status === 'closed' && meta.kind === 'reminders'" class="px-6 pb-4">
            <EmailRecipientsSummary :to="ticket.employee.email" :cc="effectiveReminderTemplate?.cc ?? []" :bcc="effectiveReminderTemplate?.bcc ?? []" class="mb-6" />
            <RecipientChip label="Send To"
              :name="ticket.employee.name"
              :detail="`${ticket.employee.email} · ${ticket.employee.position}`"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
              class="mb-6"
            />
            <!-- Per-reminder outcome, not just a "N of 2" counter - reported
                 live as misleading, since that counter increments the same
                 way whether a reminder was actually sent or skipped, so "2
                 of 2" read as "both were sent" even when one had been
                 skipped instead. -->
            <div class="rounded-md border border-default bg-gray-50 p-3 flex flex-col gap-1.5 text-sm">
              <div class="flex justify-between"><span class="text-muted">Midpoint reminder</span><span :class="reminderStatus('Midpoint') === 'Sent' ? 'font-medium text-success' : reminderStatus('Midpoint') === 'Skipped' ? 'font-medium text-warning' : 'font-medium text-dimmed'">{{ reminderStatus('Midpoint') }}<span v-if="reminderStatus('Midpoint') === 'Sent' && reminderSentAt('Midpoint')" class="font-normal text-muted"> &middot; {{ whenDot(reminderSentAt('Midpoint')) }}</span></span></div>
              <div class="flex justify-between"><span class="text-muted">Final reminder</span><span :class="reminderStatus('Final') === 'Sent' ? 'font-medium text-success' : reminderStatus('Final') === 'Skipped' ? 'font-medium text-warning' : 'font-medium text-dimmed'">{{ reminderStatus('Final') }}<span v-if="reminderStatus('Final') === 'Sent' && reminderSentAt('Final')" class="font-normal text-muted"> &middot; {{ whenDot(reminderSentAt('Final')) }}</span></span></div>
            </div>
          </div>
          <div v-if="ticket.status === 'closed' && readOnlyAttachPreviews.length" class="px-6 pb-4 flex flex-col gap-2">
            <template v-for="chip in readOnlyAttachPreviews" :key="chip.key">
              <FileAttachChip
                v-if="chip.kind === 'file'"
                :name="chip.name"
                :subtitle="chip.subtitle"
                :icon="chip.icon"
                :preview-tooltip="chip.previewTooltip"
                read-only
                @preview="chip.action"
              />
              <EmailAttachSection
                v-else
                :name="chip.name"
                :subtitle="chip.subtitle"
                :icon="chip.icon"
                :preview-tooltip="chip.previewTooltip"
                :preview-icon="chip.previewIcon"
                read-only
                @preview="chip.action"
              />
            </template>
          </div>
          <div :key="`body-${stageKey}`" class="px-6 pb-6 stage-enter" :inert="ticket.status === 'closed'" :class="{ '[&_button:not([role=checkbox])]:hidden': ticket.status === 'closed' }">

          <!-- A3 Offboarding checklist. Issued at notice from the template set for
               this path, with a final review due 3 business days before the Last
               Working Day (FR-003.6). Each task is required or optional: the badge
               switches it. Required tasks gate the final review, optional ones never do. -->
          <template v-if="meta.kind === 'checklist' && stageKey === 'A3'">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-semibold uppercase tracking-wide text-muted">Checklist</span>
                <span v-if="checklistStatus" class="text-xs text-muted">{{ checklistStatus.requiredDone }} of {{ checklistStatus.requiredTotal }} required<template v-if="checklistStatus.optionalTotal"> &middot; {{ checklistStatus.optionalDone }} of {{ checklistStatus.optionalTotal }} optional</template></span>
              </div>
              <div class="flex items-center gap-2">
                <span
                  v-if="checklistDueInfo"
                  class="rounded border px-2 py-0.5 text-xs font-medium"
                  :class="checklistDueInfo.tone === 'overdue' ? 'border-red-200 bg-red-50 text-red-800' : checklistDueInfo.tone === 'soon' ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-default bg-gray-100 text-default'"
                >{{ checklistDueInfo.label }}</span>
                <UDropdownMenu
                  v-if="!checklistReadOnly"
                  :items="[[
                    { label: 'Use a saved checklist', icon: 'i-lucide-list-restart', onSelect: () => { useTemplateOpen = true } },
                    { label: 'Save as template', icon: 'i-lucide-bookmark-plus', disabled: !ticket.checklistItems.length, onSelect: openSaveTemplate },
                    { label: 'Manage templates', icon: 'i-lucide-settings-2', to: '/master-data/offboarding-checklists' }
                  ]]"
                  :content="{ align: 'end' }"
                  :ui="{ content: 'w-52' }"
                >
                  <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-ellipsis" aria-label="Checklist options" />
                </UDropdownMenu>
              </div>
            </div>
            <SharedBanner v-if="ticket.checklistReview" tone="success" icon="i-lucide-clipboard-check" class="mb-3" title="Final review done">
              <template #aside>{{ fmtDateTime(ticket.checklistReview.at) }}</template>
              Signed off by {{ actorFullName(ticket.checklistReview.by) }}.
              <template v-if="checklistDoneBy.length || ticket.checklistReview.note" #body>
                <p v-if="checklistDoneBy.length" class="text-xs text-muted">Tasks done by {{ checklistDoneBy.map(d => `${d.name} (${d.count})`).join(', ') }}.</p>
                <p v-if="ticket.checklistReview.note" class="text-xs text-muted mt-1"><span class="font-medium text-default">Reviewer note:</span> {{ ticket.checklistReview.note }}</p>
              </template>
            </SharedBanner>
            <SharedBanner v-else-if="checklistDueInfo?.tone === 'overdue'" tone="danger" class="mb-3" title="The final review is overdue" role="status">
              It was due {{ fmtDate(checklistDue) }}, three business days before the Last Working Day.
            </SharedBanner>
            <!-- Nudge toward reuse, only for a list that matches no saved template and only until saved or dismissed. -->
            <SharedBanner v-if="showChecklistNudge" tone="info" icon="i-lucide-bookmark-plus" class="mb-3" title="Do this for every ticket?">
              Save this checklist as a template and reuse it in one click.
              <template #actions>
                <UButton size="xs" color="primary" @click="openSaveTemplate">Save as template</UButton>
                <UButton size="xs" color="neutral" variant="ghost" @click="ticket.checklistNudgeDismissed = true">Not now</UButton>
              </template>
            </SharedBanner>
            <!-- Empty state (open item #23, 5 Oct 2026, 5th pass): no checklist on
                 the ticket. Covers both the "no saved template matches this
                 path" case and the ordinary "cleared out" case. Prompts the
                 user to add tasks or pick a saved checklist. -->
            <div v-if="!checklistReadOnly && !ticket.checklistItems.length" class="mb-3 rounded-lg border border-dashed border-default bg-gray-50/60 p-5 flex flex-col items-center text-center gap-3">
              <div class="rounded-full bg-white border border-default p-2.5">
                <UIcon name="i-lucide-list-plus" class="size-5 text-muted" />
              </div>
              <div>
                <p class="text-sm font-semibold text-default">No checklist on this ticket</p>
                <p class="text-xs text-muted mt-0.5 max-w-xs">No saved checklist is set up for {{ REASON_LABELS[ticket.reason] }} ({{ ticket.mode === 'remote' ? 'Remote' : 'Onsite' }}). Add tasks below or start from one of your saved checklists.</p>
              </div>
              <div class="flex items-center gap-2 pt-1">
                <UButton size="sm" color="primary" icon="i-lucide-plus" @click="newChecklistItemInputFocus()">Add a task</UButton>
                <UButton v-if="checklistTemplates.length" size="sm" color="neutral" variant="outline" icon="i-lucide-library" @click="useTemplateOpen = true">Browse saved checklists</UButton>
              </div>
            </div>
            <!-- Quickpick row of the first three saved templates: still useful on an empty list when templates exist. -->
            <div v-if="!checklistReadOnly && !ticket.checklistItems.length && checklistTemplates.length" class="mb-3 flex flex-col gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted">Quick picks</span>
              <button
                v-for="t in checklistTemplates.slice(0, 3)"
                :key="t.id"
                type="button"
                class="text-left rounded-lg border border-default bg-white px-3.5 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                @click="chooseChecklistTemplate(t)"
              >
                <div class="text-sm font-medium text-default">{{ t.name }}</div>
                <div class="text-xs text-muted">{{ t.tasks.length }} task{{ t.tasks.length === 1 ? '' : 's' }} &middot; {{ formatChecklistTemplatePath(t.defaultFor) }}</div>
              </button>
            </div>
            <!-- Drag reorder (open item #35, 5 Oct 2026, 5th pass): now powered
                 by vue-draggable-plus so items animate smoothly WHILE being
                 dragged, not only after drop. The grip icon is the drag
                 handle; the dropdown's Move up/down options stay as a tap
                 fallback. `onUpdate` passes the final (from, to) to the
                 ticket's own reorder helper so the parallel done/optional/
                 doneBy arrays stay in sync. -->
            <VueDraggable
              :model-value="ticket.checklistItems"
              handle=".checklist-drag-handle"
              :animation="180"
              ghost-class="checklist-ghost"
              drag-class="checklist-drag"
              :disabled="checklistReadOnly"
              class="relative flex flex-col gap-1 mb-3"
              @update="(e: any) => reorderChecklistItemBetween(e.oldIndex, e.newIndex)"
            >
              <div
                v-for="(item, i) in ticket.checklistItems"
                :key="`${item}:${i}`"
                class="group flex items-start gap-1.5 text-sm rounded-md px-1.5 py-1 -mx-1.5 hover:bg-gray-50 transition-colors"
              >
                <UDropdownMenu
                  v-if="!checklistReadOnly"
                  :items="[[
                    { label: 'Move up', icon: 'i-lucide-arrow-up', disabled: i === 0, onSelect: () => moveChecklistItem(i, -1) },
                    { label: 'Move down', icon: 'i-lucide-arrow-down', disabled: i === ticket.checklistItems.length - 1, onSelect: () => moveChecklistItem(i, 1) }
                  ]]"
                  :content="{ align: 'start' }"
                  :ui="{ content: 'w-40' }"
                >
                  <UTooltip text="Drag to reorder, or tap for move up/down">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      square
                      icon="i-lucide-grip-vertical"
                      aria-label="Reorder item"
                      class="checklist-drag-handle shrink-0 self-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
                    />
                  </UTooltip>
                </UDropdownMenu>
                <UCheckbox :model-value="ticket.checklistDone[i]" :disabled="!!ticket.checklistReview" class="mt-0.5" @update:model-value="(v) => toggleChecklistItem(i, !!v)" />
                <span class="flex-1" :class="{ 'text-muted line-through': ticket.checklistDone[i] }">{{ item }}<span v-if="ticket.checklistDone[i] && ticket.checklistDoneBy?.[i]" class="ml-2 text-xs font-normal text-muted no-underline">Done by {{ ticket.checklistDoneBy[i] }}</span></span>
                <!-- Required or Optional: one tap switches it. -->
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:cursor-default"
                  :class="ticket.checklistOptional?.[i] ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-orange-700 text-white hover:bg-orange-800'"
                  :disabled="checklistReadOnly"
                  :aria-label="`${ticket.checklistOptional?.[i] ? 'Optional' : 'Required'}. ${checklistReadOnly ? '' : ticket.checklistOptional?.[i] ? 'Switch to required' : 'Switch to optional'}`"
                  @click="toggleRequired(i)"
                >
                  <UIcon name="i-lucide-repeat" class="size-3" aria-hidden="true" />
                  {{ ticket.checklistOptional?.[i] ? 'Optional' : 'Required' }}
                </button>
                <UTooltip v-if="!checklistReadOnly" text="Remove item">
                  <UButton
                    color="error"
                    variant="ghost"
                    size="xs"
                    square
                    icon="i-lucide-trash-2"
                    aria-label="Remove item"
                    class="shrink-0 self-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    @click="removeChecklistItemAt(i)"
                  />
                </UTooltip>
              </div>
            </VueDraggable>
            <p v-if="!ticket.checklistItems.length && !checklistReadOnly && checklistTemplates.length === 0" class="text-xs text-muted py-1">No tasks yet. Add at least one below.</p>
            <div v-if="!checklistReadOnly" class="flex items-center gap-2 mb-2">
              <UInput
                ref="newChecklistItemInputRef"
                v-model="newChecklistItemText"
                size="sm"
                placeholder="Add a checklist item..."
                class="flex-1"
                @keyup.enter="addChecklistItemFromInput"
              />
              <UTooltip :text="newChecklistItemText.trim() ? 'Add this item' : 'Type an item to add first'">
                <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" :aria-disabled="(!newChecklistItemText.trim()) || undefined" :class="{ [disabledLook]: !newChecklistItemText.trim() }" @click="guardedClick(!!newChecklistItemText.trim(), 'Type an item to add first.', addChecklistItemFromInput)">Add</UButton>
              </UTooltip>
            </div>
            <p v-if="!ticket.checklistReview" class="text-xs text-muted mb-4">Required tasks must be done before the final review. Optional tasks never block it. Tap a badge to switch a task.</p>
            <!-- Final review: anyone on the Asset Team can sign off. The signer
                 is recorded; "Done by" is shown per task; an optional note is
                 kept with the sign-off (open items #11, #34). -->
            <template v-if="!ticket.checklistReview && ticket.status === 'open' && checklistComplete">
              <div class="mb-3">
                <label class="text-xs font-semibold uppercase tracking-wide text-muted block mb-1.5" for="reviewer-note">Reviewer note <span class="font-normal normal-case text-dimmed">(optional)</span></label>
                <UTextarea
                  id="reviewer-note"
                  v-model="reviewerNoteDraft"
                  size="sm"
                  :rows="2"
                  placeholder="Anything to leave on the record (a waiver, a reference, context for the sign-off)."
                  class="w-full"
                  :maxlength="400"
                />
                <p class="text-xs text-muted mt-1 flex items-start gap-1.5"><UIcon name="i-lucide-user-check" class="size-3.5 shrink-0 mt-px text-muted" aria-hidden="true" />Signing as {{ actorFullName(currentUserName()) }}.</p>
              </div>
            </template>
            <UTooltip v-if="!ticket.checklistReview && ticket.status === 'open'" :text="!checklistComplete ? 'Do every required task first' : 'Sign off the final review'">
              <UButton color="primary" size="sm" :aria-disabled="(!checklistComplete) || undefined" :class="{ [disabledLook]: !checklistComplete }" @click="guardedClick(checklistComplete, 'Do every required task first.', finishChecklist)">Complete final review</UButton>
            </UTooltip>
            <!-- Revisit: the sign-off is on record, so the stage ends with the same Continue button every other finished stage has. -->
            <UButton v-else-if="ticket.checklistReview && ticket.status === 'open'" color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromStage">{{ continueLabel }}</UButton>
            <!-- v-if above uses `checklistComplete` as both a reactive gate and as the first arg to guardedClick (which expects a boolean). The ref is unwrapped here already. -->

          </template>

          <!-- A4 IT lock scheduling - confirmed twice: on scheduling and
               separately on execution, per FR-003.6, not one bare click. -->
          <template v-else-if="meta.kind === 'itlock'">
            <div class="rounded-md border border-default bg-gray-50 p-3 mb-4 flex flex-col gap-1.5 text-sm">
              <div class="flex justify-between"><span class="text-muted">Schedule deadline</span><span class="font-medium text-default text-right">Within 1 business day of the Notice Endorsement</span></div>
              <div class="flex justify-between gap-4"><span class="text-muted">Last working day</span><span class="font-medium text-default text-right">{{ fmtDate(ticket.lwd) }}</span></div>
              <div class="flex justify-between gap-4"><span class="text-muted">Their shift</span><span class="font-medium text-default text-right">{{ custodianShift ? shiftLabel(custodianShift) : 'Not on file' }}</span></div>
              <div class="flex justify-between gap-4"><span class="text-muted">The lock runs</span><span class="font-medium text-default text-right">{{ lockRun ? `${fmtDate(lockRun.dateISO)} at ${lockRun.clock}` : 'When their last shift ends' }}</span></div>
              <div class="flex justify-between"><span class="text-muted">Confirmation</span><span class="font-medium text-default">Scheduled, then Executed</span></div>
            </div>
            <template v-if="!ticket.itLock.scheduledConfirmed">
              <p v-if="lockRun?.overnight" class="text-sm text-muted mb-4 flex items-start gap-2"><UIcon name="i-lucide-moon" class="size-4 shrink-0 mt-0.5" aria-hidden="true" /><span>Their last shift starts on {{ fmtDate(ticket.lwd) }} and ends the next morning, so the lock runs on {{ fmtDate(lockRun.dateISO) }}.</span></p>
              <p v-else-if="!custodianShift" class="text-sm text-default mb-4 flex items-start gap-2"><UIcon name="i-lucide-circle-alert" class="size-4 shrink-0 mt-0.5 text-orange-700" aria-hidden="true" /><span>No shift is on file for this team member. Confirm when their last shift ends before scheduling.</span></p>
              <UButton color="primary" size="sm" @click="doConfirmItLockScheduling">Confirm Scheduling</UButton>
            </template>
            <template v-else>
              <!-- Scheduled - awaiting execution. SharedBanner (success tone) so
                   it gets the standard banner-enter + light fill. -->
              <SharedBanner v-if="!ticket.itLock.executedConfirmed" tone="warning" icon="i-lucide-lock" title="IT lock scheduled" role="status" class="mb-4">
                {{ lockRun ? `Set to run on ${fmtDate(lockRun.dateISO)} at ${lockRun.clock}, when their last shift ends.` : `Set to run at the end of their last shift on ${fmtDate(ticket.itLock.scheduledFor)}.` }} Awaiting confirmation that it actually ran.
              </SharedBanner>
              <!-- Executed - success record. Matches every other completed stage's SentBanner. -->
              <SentBanner v-else title="IT lock executed" icon="i-lucide-shield-check" :when="latestHistory(/^IT lock executed on schedule/)?.when" class="mb-4">
                IT confirmed the team member's access was locked on the scheduled date.
              </SentBanner>
              <UButton v-if="ticket.status === 'open' && !ticket.itLock.executedConfirmed" color="primary" size="sm" @click="doConfirmItLockExecution">Confirm Execution</UButton>
              <UButton v-else-if="ticket.status === 'open'" color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromStage">{{ continueLabel }}</UButton>
            </template>
          </template>
          <!-- B11 Confirm In Transit - captures the tracking/reference
               number, which is what actually halts the Overdue Return
               countdown, not the click alone.
               On revisit (b11Pristine): the tracking shows as read-only
               text and the primary button says "Continue to <next>". The
               Courier & Shipping card's inline pencils remain the way to
               edit either value while the ticket is open; changing one
               there also writes `transitConfirmedAt` to now so the stage
               stays done but the fields read fresh. -->
          <template v-else-if="meta.kind === 'transit'">
            <template v-if="b11Pristine">
              <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-0.5">Tracking Number</div>
                  <div class="text-sm font-medium text-default break-all">{{ ticket.trackingNumber || 'Not added' }}</div>
                </div>
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-0.5">Tracking Link</div>
                  <div v-if="ticket.trackingLink" class="text-sm font-medium text-default break-all">{{ ticket.trackingLink }}</div>
                  <div v-else class="text-sm text-dimmed">Not added</div>
                </div>
              </div>
              <p class="text-xs text-muted mb-6 flex items-start gap-1.5"><UIcon name="i-lucide-info" class="size-3.5 mt-px text-muted shrink-0" aria-hidden="true" />Tracking details can still be edited from the Courier &amp; Shipping card while the ticket is open.</p>
              <UButton color="primary" size="sm" @click="continueFromStage">{{ continueLabel }}</UButton>
            </template>
            <template v-else>
              <div class="grid grid-cols-2 gap-3 mb-1">
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Tracking Number</label>
                  <UInput v-model="trackingNumberDraft" placeholder="e.g. JRS-0048213377" size="md" class="w-full" />
                </div>
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Tracking Link <span class="normal-case font-normal">(optional)</span></label>
                  <UInput v-model="trackingRefDraft" placeholder="https://jrs-express.com/track/..." size="md" class="w-full" />
                </div>
              </div>
              <p v-if="trackingRefDraft.trim() && !trackingLinkValid" class="text-xs text-red-600 mb-6">Not a valid tracking link for {{ selectedCourier?.name ?? 'this courier' }}. Enter the full URL from {{ selectedCourier?.name ?? 'the courier' }}'s own tracking site.</p>
              <p v-else class="text-xs text-muted mb-6">Enter the tracking number, the tracking link, or both. They can be added or edited later from the Courier &amp; Shipping card.</p>
              <UTooltip :text="trackingCanConfirm ? meta.actionLabel : 'Enter a tracking number or a valid tracking link first'">
                <UButton color="primary" size="sm" :aria-disabled="(!trackingCanConfirm) || undefined" :class="{ [disabledLook]: !trackingCanConfirm, 'btn-ready-pulse': b11Pulse.active.value }" @click="guardedClick(trackingCanConfirm, 'Enter a tracking number or a valid tracking link first.', doConfirmInTransit)">{{ meta.actionLabel }}</UButton>
              </UTooltip>
            </template>
          </template>

          <!-- B8 Branch confirmation capture - browses the same Courier
               Providers list as Master Data, recommended provider
               auto-selected, an alternate always pickable. -->
          <template v-else-if="meta.kind === 'branch' && branchConfirmedRecord && ticket.status === 'open'">
            <!-- One banner for the whole outcome: how it was confirmed (title),
                 which branch (description), when (right). -->
            <SentBanner
              :title="ticket.courierBranchSubstituted ? 'Branch set from address on file' : ticket.branchCaptureMethod === 'email' ? 'Branch confirmed by email' : 'Branch confirmed by call'"
              :icon="ticket.branchCaptureMethod === 'email' && !ticket.courierBranchSubstituted ? 'i-lucide-mail-check' : ticket.courierBranchSubstituted ? 'i-lucide-map-pin-check' : 'i-lucide-phone'"
              :when="branchConfirmedRecord.when"
              class="rounded-b-none"
            >
              {{ ticket.courierBranchSubstituted ? 'Used because the team member did not reply.' : ticket.branchCaptureMethod === 'email' ? "Taken from the team member's email reply." : 'Confirmed with the team member on a call.' }}
            </SentBanner>
            <!-- The branch itself, attached directly under the banner (shared
                 border, no gap) so it reads as part of the same record. -->
            <div class="mb-6 -mt-px rounded-b-lg border border-success/25 bg-white px-4 py-3 flex items-start gap-2.5">
              <UIcon name="i-lucide-map-pin" class="size-4.5 mt-0.5 shrink-0 text-muted" />
              <div class="min-w-0">
                <div class="text-sm font-medium text-default">{{ ticket.courierBranchName.startsWith(courierProviderById(ticket.courierProviderId)?.name ?? '@@') ? ticket.courierBranchName.replace(/\s+-\s+/, ', ') : `${courierProviderById(ticket.courierProviderId)?.name ?? 'Courier'}, ${ticket.courierBranchName}` }}</div>
                <div class="text-xs text-muted mt-0.5">{{ ticket.courierBranchAddress }}</div>
              </div>
            </div>
            <!-- Captured via email: the branch reminder that went out, with
                 the same recipient detail the send step showed. -->
            <template v-if="ticket.branchCaptureMethod === 'email' && ticket.branchRequestSentAt">
              <EmailRecipientsSummary :to="ticket.employee.email" :cc="[]" :bcc="[]" class="mb-6" />
              <RecipientChip
                label="Sent To"
                :name="ticket.employee.name"
                :detail="`${ticket.employee.email} · ${ticket.employee.position}`"
                :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
                class="mb-6"
              />
              <div class="mb-6">
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
                <EmailAttachSection
                  v-if="branchSentTemplate"
                  :name="branchSentTemplate.name"
                  :subtitle="branchSentTemplate.description"
                  icon="i-lucide-mail"
                  preview-tooltip="Preview email"
                  preview-icon="i-lucide-eye"
                  read-only
                  @preview="() => openTemplatePreview(branchSentTemplate)"
                />
                <p v-else class="text-sm text-muted">No template was attached to this reminder.</p>
              </div>
            </template>
            <UButton color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromStage">Continue to Courier Endorsement</UButton>
          </template>
          <template v-else-if="meta.kind === 'branch'">
            <div class="flex flex-col gap-6">
              <!-- Same title/description banner shape as A9's own Overdue
                   card - a single dash-joined sentence read as unclear, same
                   feedback that shaped that one. Same red-usage convention
                   too (title + border + background only, icon neutral). -->
              <SharedBanner v-if="branchUrgent" tone="danger" icon="i-lucide-alarm-clock" :title="branchLwdPassed ? 'The last working day has passed' : 'The last working day is close'" role="alert">
                {{ branchLwdPassed ? 'The branch is still not captured, so the courier arrangement is now overdue.' : 'The branch is still not captured. Complete the courier arrangement before then.' }}
              </SharedBanner>

              <!-- Team member's on-file address - the source R24 data the nearest-branch suggestion below is actually derived from (FR-003.7: R24 is the source of truth, AMS surfaces it rather than re-keying it). Editable as a per-ticket correction only (teamMemberAddressOverride) - never mutates employee.address itself. -->
              <div class="rounded-md border border-default bg-gray-50 p-3 flex items-start gap-2 text-sm">
                <UIcon name="i-lucide-map-pin" class="size-4 text-dimmed shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <span class="text-xs text-muted block">Team member address</span>
                  <template v-if="editingAddress">
                    <UTextarea v-model="addressDraft" :rows="2" class="w-full mt-1" autofocus />
                    <div class="flex items-center gap-2 mt-2">
                      <UButton size="xs" color="primary" @click="saveAddressEdit">Save</UButton>
                      <UButton size="xs" color="neutral" variant="ghost" @click="editingAddress = false">Cancel</UButton>
                      <UButton v-if="ticket.teamMemberAddressOverride" size="xs" color="neutral" variant="ghost" @click="resetAddressToFile">Revert to address on file</UButton>
                    </div>
                  </template>
                  <template v-else>
                    <span class="inline-flex items-start gap-1.5">
                      <span class="font-medium">{{ effectiveTeamMemberAddress(ticket) }}</span>
                      <UTooltip text="Edit this ticket's address">
                        <UButton size="xs" color="primary" variant="ghost" square icon="i-lucide-pencil" aria-label="Edit this ticket's address" @click="startEditAddress" />
                      </UTooltip>
                    </span>
                    <span v-if="ticket.teamMemberAddressOverride" class="text-xs text-amber-700 block mt-0.5">Corrected for this ticket</span>
                  </template>
                </div>
              </div>

              <!-- Courier Provider field - the selected courier's own recipient chip is content that belongs to this field (who the dropdown resolved to), not a separate field of its own, so it stays tightly grouped under it rather than getting its own 16px gap. -->
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Courier Provider</label>
                <USelectMenu
                  v-model="selectedCourierId"
                  :items="courierOptions"
                  value-key="value"
                  placeholder="Select a courier provider"
                  size="md"
                  class="w-full"
                >
                  <template #item-trailing="{ item }">
                    <UBadge :color="item.priority === 'recommended' ? 'primary' : 'neutral'" variant="subtle" size="sm">
                      {{ item.priority === 'recommended' ? 'Recommended' : 'Alternate' }}
                    </UBadge>
                  </template>
                </USelectMenu>
                <RecipientChip
                  v-if="selectedCourier"
                  :name="selectedCourier.name"
                  :detail="`Account Manager: ${selectedCourier.accountManager}`"
                  :initials="selectedCourier.name.split(' ').map(w => w[0]).join('').slice(0, 2)"
                  class="mt-2"
                >
                  <template #actions>
                    <UBadge :color="selectedCourier.priority === 'recommended' ? 'primary' : 'neutral'" variant="subtle" size="sm">
                      {{ selectedCourier.priority === 'recommended' ? 'Recommended' : 'Alternate' }}
                    </UBadge>
                  </template>
                </RecipientChip>
              </div>

              <!-- Branch Name field - selected from the branch directory (as-is, see COURIER_BRANCHES), not typed freehand. The auto-selected cue/reset link describes this same field's own state, so it stays grouped with it. -->
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Branch Name</label>
                <UTooltip :text="selectedCourierId ? 'Choose the branch' : 'Select a courier provider first'">
                  <USelectMenu
                    :model-value="selectedBranchId ?? undefined"
                    @update:model-value="(v: string | undefined) => selectedBranchId = v ?? null"
                    :items="branchOptions"
                    value-key="value"
                    :disabled="!selectedCourierId"
                    placeholder="No branch selected yet"
                    size="md"
                    class="w-full"
                  />
                </UTooltip>
                <p v-if="branchIsAutoSelected" class="text-xs text-primary font-medium mt-1.5 flex items-center gap-1">
                  <UIcon name="i-lucide-sparkles" class="size-3.5" />Auto-selected as the nearest branch to the team member's address on file.
                </p>
                <button v-else type="button" class="text-xs font-semibold text-primary mt-1.5" @click="autoSelectNearestBranch">
                  Reset to nearest branch
                </button>
              </div>

              <!-- Branch Address field - auto-populates from the branch selected above, a distinct field in its own right (a different piece of data than the branch name), so it gets its own gap rather than folding into the field above. -->
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Branch Address</label>
                <div v-if="selectedBranch" class="text-sm text-default bg-gray-50 border border-default rounded-md px-2.5 py-1.5">{{ selectedBranch.address }}</div>
                <div v-else class="text-sm text-dimmed bg-gray-50 border border-dashed border-default rounded-md px-2.5 py-1.5">Not set yet - select a branch above.</div>
              </div>

              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Captured via</label>
                <!-- One Nuxt UI card size step up from Inspection Routing
                     below (size="md" instead of "sm") - reported live as
                     "too small" - using the theme's own size-driven padding
                     this time (no `p-2` override) rather than the shared
                     cardSelectUi's compact padding, while still keeping the
                     smaller label/icon/description text from cardSelectUi
                     (that size stays as explicitly asked for separately). -->
                <URadioGroup
                  v-model="branchCaptureMethod"
                  :items="[{ label: 'Confirmation call', value: 'call', icon: 'i-lucide-phone' }, { label: 'Email reply', value: 'email', icon: 'i-lucide-mail' }]"
                  orientation="horizontal"
                  variant="card"
                  indicator="hidden"
                  size="md"
                  :ui="{ ...cardSelectUi, item: cardSelectUi.item.replace(`${cardSelectPadding} `, ''), label: 'transition-colors group-has-data-[state=checked]:text-primary text-xs' }"
                />
              </div>

              <!-- Email reply path only - the confirmation call resolves live on the line, so it never needs a pending state. This app has no inbox integration, so "did they reply" can only ever be a manual confirmation, same limitation this module already accepts for SMS (FR-003.12). Recipient chip + template chip match the same cohesive send pattern as the retrieval notice/courier endorsement sends. There is no real "Branch Confirmation Reminder" template in FR-003.12 - a genuine empty state (AttachPicker) by default, so it's honest about that, and the operator can attach any active template from Templates if they want to send one. This whole block is one cohesive send workflow, not a set of independent fields, so its own internal pieces stay tightly spaced rather than each getting a 16px gap. -->
              <!-- Email-reply path, one state at a time with a single primary
                   action each: (1) not sent - compose and send the reminder;
                   (2) sent - wait, then mark the reply received; (3) reply in,
                   or (4) falling back to the address on file - confirm. The
                   fallback is a quiet link next to the primary action, and
                   Confirm Branch only appears once it can actually be used. -->
              <div v-if="branchCaptureMethod === 'email'" class="flex flex-col gap-6">
                <!-- (4) substitution chosen -->
                <SharedBanner v-if="branchSubstituted" tone="neutral" icon="i-lucide-map-pin" title="Using the branch on file">
                  <template #aside><button type="button" class="text-xs font-semibold text-primary" @click="branchSubstituted = false">Undo</button></template>
                  Recorded as a substitution, not the team member's reply.
                </SharedBanner>

                <!-- (3) reply received -->
                <SentBanner v-else-if="ticket.branchRequestSentAt && ticket.branchRequestReplyReceived" title="Reply received" icon="i-lucide-mail-check" :when="fmtDateTime(ticket.branchRequestSentAt)">
                  The team member replied. Confirm the branch to continue.
                </SentBanner>

                <!-- (2) sent, waiting -->
                <template v-else-if="ticket.branchRequestSentAt">
                  <SharedBanner v-if="ticket.branchReplyDetectedAt" tone="info" icon="i-lucide-mail" title="A reply has arrived" role="status">
                    <template #aside>{{ fmtDateTime(ticket.branchReplyDetectedAt) }}</template>
                    {{ ticket.employee.name }} replied in Outlook. Read it, then mark it as received.
                  </SharedBanner>
                  <SentBanner v-else title="Reminder sent" :when="fmtDateTime(ticket.branchRequestSentAt)">
                    Waiting for {{ ticket.employee.name }} to reply.
                  </SentBanner>
                  <div class="flex items-center gap-4 flex-wrap">
                    <UButton size="sm" color="primary" @click="doMarkBranchReplyReceived">Mark Reply as Received</UButton>
                    <button type="button" class="text-xs font-semibold text-muted hover:text-default" @click="useAddressOnFile">No reply? Use the branch on file</button>
                  </div>
                </template>

                <!-- (1) not sent yet -->
                <template v-else>
                  <EmailRecipientsSummary :to="ticket.employee.email" :cc="[]" :bcc="[]" />
                  <RecipientChip label="Send To"
                    :name="ticket.employee.name"
                    :detail="useManualEmailBranch ? `${manualEmailBranch || 'Personal email not entered yet'} · ${ticket.employee.position}` : `${ticket.employee.email} · ${ticket.employee.position}`"
                    :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
                  >
                    <template #actions>
                      <UInput v-if="useManualEmailBranch" v-model="manualEmailBranch" type="email" placeholder="personal@email.com" size="xs" class="w-40" />
                      <UButton color="neutral" variant="ghost" size="xs" @click="useManualEmailBranch = !useManualEmailBranch">
                        {{ useManualEmailBranch ? 'Use work email' : 'Use personal email' }}
                      </UButton>
                    </template>
                  </RecipientChip>
                  <div>
                    <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
                    <EmailAttachSection
                      v-if="effectiveBranchTemplate"
                      :name="effectiveBranchTemplate.name"
                      :subtitle="effectiveBranchTemplate.description"
                      icon="i-lucide-mail"
                      replace-label="Replace email"
                      preview-tooltip="Preview email"
                      preview-icon="i-lucide-eye"
                      :form-options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                      :current-form-id="overrideBranchTemplateKey ?? undefined"
                      @preview="() => openTemplatePreview(effectiveBranchTemplate)"
                      @edit="() => navigateTo(`/templates/email/${overrideBranchTemplateKey}/edit`, { open: { target: '_blank' } })"
                      @replace="(key) => overrideBranchTemplateKey = key"
                      @remove="() => overrideBranchTemplateKey = null"
                    />
                    <AttachPicker
                      v-else
                      label="Attach an email template"
                      icon="i-lucide-mail"
                      :options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                      @select="(key) => overrideBranchTemplateKey = key"
                    />
                    <p class="text-xs text-muted mt-1.5">Send only if they haven't replied to the original notice.</p>
                  </div>
                  <div>
                    <div class="flex items-center gap-4 flex-wrap">
                      <UTooltip :text="effectiveBranchTemplate ? 'Send the reminder email' : 'Attach an email template first'">
                        <UButton size="sm" color="primary" icon="i-lucide-send" :aria-disabled="(!effectiveBranchTemplate) || undefined" :class="{ [disabledLook]: !effectiveBranchTemplate }" @click="guardedClick(!!effectiveBranchTemplate, 'Attach an email template first.', doSendBranchRequest)">Send Reminder</UButton>
                      </UTooltip>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Confirm Branch: always on the call path (with its own
                   disabled reason); on the email path only once there's a
                   reply or a substitution to confirm. -->
              <UTooltip v-if="branchCaptureMethod !== 'email' || branchSubstituted || ticket.branchRequestReplyReceived" :text="branchConfirmDisabled ? branchConfirmDisabledReason : meta.actionLabel">
                <UButton color="primary" size="sm" class="self-start" :aria-disabled="(branchConfirmDisabled) || undefined" :class="{ [disabledLook]: branchConfirmDisabled }" @click="guardedClick(!branchConfirmDisabled, branchConfirmDisabledReason, doConfirmBranch)">{{ meta.actionLabel }}</UButton>
              </UTooltip>
            </div>
          </template>

          <!-- A12 Returned Item Check and routing - a selectable card group, not a modal. -->
          <template v-else-if="meta.kind === 'inspection'">
            <!-- Closed ticket: show the chosen route as read-only text instead of the picker + Confirm button. -->
            <template v-if="ticket.status !== 'open'">
              <div class="rounded-lg border border-default bg-gray-50/60 p-4">
                <div class="text-xs font-semibold uppercase tracking-wide text-dimmed">Routed to</div>
                <div class="text-sm font-medium text-default mt-1">{{ ticket.inspectionRoute ? INSPECTION_ROUTE_STATUS[ticket.inspectionRoute] : 'Not routed' }}</div>
                <div v-if="latestHistory(/^Inspection routed/)?.when" class="text-xs text-muted mt-1">{{ fmtDateTime(latestHistory(/^Inspection routed/)!.when) }}</div>
              </div>
            </template>
            <template v-else>
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-2">Where is the equipment going next?</label>
              <URadioGroup
                v-model="inspectionRouting"
                :items="inspectionRoutingOptions"
                variant="card"
                orientation="horizontal"
                indicator="hidden"
                size="sm"
                class="mb-6"
                :ui="{ ...cardSelectUi, fieldset: 'grid grid-cols-3 gap-2 w-full', item: `${cardSelectUi.item} w-full min-w-0` }"
              />
              <UTooltip :text="inspectionRouting ? (a12Pristine ? continueLabel : meta.actionLabel) : 'Select a routing option first'">
                <UButton color="primary" size="sm" :aria-disabled="(!inspectionRouting) || undefined" :class="{ [disabledLook]: !inspectionRouting, 'btn-ready-pulse': a12Pulse.active.value }" @click="guardedClick(!!inspectionRouting, 'Select a routing option first.', a12Pristine ? continueFromStage : confirmInspection)">{{ a12Pristine ? continueLabel : meta.actionLabel }}</UButton>
              </UTooltip>
            </template>
          </template>

          <!-- A5 Assets - one bordered card per asset (Name header,
               Asset Tag / Serial No. in a divided 2-column grid) rather than
               a plain table row - the same "asset items card" pattern as the
               real IT Workspace's own Asset card (and this workspace's own
               Gate Pass drawer Custodian card), so an asset's identity reads
               as a real record, not a table row with two of its three real
               identifiers (Asset Tag wasn't shown at all here before). -->
          <template v-else-if="meta.kind === 'assets'">
            <!-- Same "Asset Items" card shape as the real Gate Pass create
                 form (icon-badge header + count chip + subtitle, a column
                 header row, then one dense row per asset) - kept cohesive
                 with that reference rather than a separate bordered-card-per-
                 asset variant. -->
            <div class="rounded-lg overflow-hidden bg-default ring ring-default divide-y divide-default mb-6">
              <div class="p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3">
                  <div class="flex items-center justify-center size-9 rounded-full bg-primary/10 shrink-0">
                    <UIcon name="i-lucide-box" class="size-4 text-primary" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-sm font-semibold text-highlighted">Asset Items</h3>
                      <span class="text-xs font-medium px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">{{ ticket.assets.length }}</span>
                    </div>
                    <p class="text-xs text-muted">Confirm assets to include</p>
                  </div>
                </div>
                <span class="text-xs text-dimmed">Tag &amp; serial from asset record</span>
              </div>
              <div class="hidden md:grid md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-4 pt-2 pb-1 text-xs font-medium text-muted">
                <span />
                <span>Asset Tag</span>
                <span>Serial No.</span>
                <span>Model</span>
                <span>Type</span>
                <span>Remarks</span>
              </div>
              <div
                v-for="(a, i) in ticket.assets" :key="a.serial" role="button" tabindex="0"
                class="grid grid-cols-[2rem_1fr_1fr] md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-x-2 gap-y-1 items-center px-4 py-2.5 cursor-pointer hover:bg-gray-50 focus-visible:outline focus-visible:outline-primary"
                @click="openAssetDetail(a)" @keydown.enter="openAssetDetail(a)" @keydown.space.prevent="openAssetDetail(a)"
              >
                <span @click.stop><UCheckbox :model-value="a.checked" @update:model-value="(v) => toggleAsset(i, !!v)" /></span>
                <span class="text-sm text-primary">{{ a.assetTag }}</span>
                <span class="text-sm text-muted">{{ a.serial }}</span>
                <span class="flex items-center gap-1.5 min-w-0 col-span-2 md:col-span-1">
                  <UIcon :name="assetIcon(a.name)" class="size-3.5 text-dimmed shrink-0" />
                  <span class="min-w-0">
                    <span class="text-sm font-medium text-highlighted block truncate">{{ a.model }}</span>
                    <span class="text-xs text-dimmed block truncate">{{ a.name }}</span>
                  </span>
                </span>
                <span class="text-xs text-muted md:order-none order-last col-span-3 md:col-span-1 inline-flex items-center gap-1"><UIcon :name="assetTypeIcon(a.type)" class="size-3.5 shrink-0" />{{ a.type }}</span>
                <!-- Editable only up to A5's own confirmation - once assets
                     are locked (confirmed, or the ticket is simply closed,
                     which is always locked too), remarks becomes wrapped
                     read-only text instead of a fixed-width input, so a long
                     note can't get silently clipped with no way to read the
                     rest of it (reported live). -->
                <span v-if="!ticket.assetsLocked" @click.stop class="col-span-2 md:col-span-1">
                  <UInput v-model="a.remarks" size="xs" placeholder="Add remarks..." class="w-full" />
                </span>
                <span v-else class="text-xs col-span-2 md:col-span-1 break-words whitespace-pre-wrap" :class="a.remarks ? 'text-muted' : 'text-dimmed'">{{ a.remarks || 'No remarks provided' }}</span>
              </div>
              <div class="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                <span class="text-sm text-muted">{{ ticket.assets.filter(a => a.checked).length }} of {{ ticket.assets.length }} confirmed</span>
                <div class="flex items-center gap-2">
                  <UButton size="xs" color="neutral" variant="outline" @click="setAllAssets(true)">Select All</UButton>
                  <UButton size="xs" color="neutral" variant="outline" @click="setAllAssets(false)">Unselect All</UButton>
                </div>
              </div>
            </div>
            <UButton color="primary" size="sm" @click="doConfirmAssets">{{ meta.actionLabel }}</UButton>
          </template>

          <!-- A6/B9 already sent: revisiting shows the record and a way on,
               never the send action a second time. -->
          <template v-else-if="meta.kind === 'template-send' && templateSendRecord && ticket.status === 'open'">
            <SentBanner
              :title="effectiveForm && stageKey !== 'B9' ? 'Email and form sent' : 'Email sent'"
              :when="templateSendRecord.when"
              class="mb-4"
            >
              <template v-if="stageKey === 'B9'">Pickup endorsement sent to {{ courierRecipient ? `${courierRecipient.accountManager} at ${courierRecipient.name}` : "the courier's account manager" }}.</template>
              <template v-else>Retrieval notice sent to {{ ticket.employee.name }}.</template>
            </SentBanner>
            <!-- What was sent, read-only: the same recipients and chips the
                 send step showed, with Preview still live so the exact email
                 and form contents can be reviewed after the fact. -->
            <EmailRecipientsSummary :to="sendToEmail" :cc="effectiveTemplate?.cc ?? []" :bcc="effectiveTemplate?.bcc ?? []" class="mb-6" />
            <RecipientChip
              v-if="stageKey === 'B9'"
              label="Sent To"
              :name="courierRecipient ? `${courierRecipient.name} - Account Manager` : 'Courier account manager'"
              :detail="courierRecipient ? `${courierRecipient.accountManager} · Corporate account` : ''"
              :initials="(courierRecipient?.accountManager ?? '??').split(' ').map(w => w[0]).join('').slice(0, 2)"
              class="mb-6"
            />
            <RecipientChip
              v-else
              label="Sent To"
              :name="ticket.employee.name"
              :detail="`${sendToEmail} · ${ticket.employee.position}`"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
              class="mb-6"
            />
            <div v-if="effectiveTemplate" class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
              <EmailAttachSection
                :name="effectiveTemplate.name"
                :subtitle="effectiveTemplate.description"
                icon="i-lucide-mail"
                preview-tooltip="Preview email"
                preview-icon="i-lucide-eye"
                read-only
                @preview="() => openTemplatePreview(effectiveTemplate)"
              />
            </div>
            <div v-if="stageKey !== 'B9' && effectiveForm" class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Attached Form</label>
              <EmailAttachSection
                :name="effectiveForm.name"
                :subtitle="effectiveForm.description"
                read-only
                @preview="() => openFormPreview(effectiveForm!.id)"
              />
            </div>
            <!-- Undo deliberately NOT offered on A6/B9 template-send: the
                 email/form has already been sent to the team member via
                 Outlook, so an in-app undo would mislead the operator about
                 what the recipient sees (user feedback 5 Oct 2026, 6th
                 pass). -->
            <UButton color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromStage">Continue</UButton>
          </template>

          <!-- A6/B9 template send -->
          <template v-else-if="meta.kind === 'template-send'">
            <!-- Read-only equivalent of this same recipient context now
                 sits above, outside the inert wrapper (see its own comment)
                 - not shown twice at once on a closed ticket. -->
            <template v-if="ticket.status === 'open'">
            <EmailRecipientsSummary :to="sendToEmail" :cc="effectiveTemplate?.cc ?? []" :bcc="effectiveTemplate?.bcc ?? []" class="mb-6" />

            <!-- B9 sends to the courier's own account manager, never the team member. -->
            <RecipientChip label="Send To"
              v-if="stageKey === 'B9'"
              :name="courierRecipient ? `${courierRecipient.name} - Account Manager` : 'No courier selected yet'"
              :detail="courierRecipient ? `${courierRecipient.accountManager} · Corporate account` : 'Confirm the courier branch first'"
              :initials="(courierRecipient?.accountManager ?? '??').split(' ').map(w => w[0]).join('').slice(0, 2)"
              class="mb-6"
            />
            <RecipientChip label="Send To"
              v-else
              :name="ticket.employee.name"
              :detail="useManualEmail ? `${manualEmail || 'Personal email not entered yet'} · ${ticket.employee.position}` : `${ticket.employee.email} · ${ticket.employee.position}`"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
              class="mb-6"
            >
              <template #actions>
                <UInput v-if="useManualEmail" v-model="manualEmail" type="email" placeholder="personal@email.com" size="xs" class="w-40" />
                <UButton color="neutral" variant="ghost" size="xs" @click="useManualEmail = !useManualEmail">
                  {{ useManualEmail ? 'Use work email' : 'Use personal email' }}
                </UButton>
              </template>
            </RecipientChip>
            </template>

            <!-- Read-only chips for this same kind of content are rendered
                 once, outside the inert wrapper below (see
                 readOnlyAttachPreviews) - the whole "Email Template" section
                 (label included, not just the chip) is hidden here on a
                 closed ticket rather than shown twice at once, which is what
                 happened when only the chip itself was skipped (reported
                 live as "duplicated"). inert already makes this one's own
                 buttons non-functional once closed anyway, so hiding it
                 entirely then is no loss. -->
            <div v-if="ticket.status === 'open'" class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
              <SharedBanner v-if="effectiveTemplate && effectiveTemplate.status !== 'active'" tone="warning" compact class="mb-2" :title="`This template is marked ${effectiveTemplate.status}`">Review or reactivate it in Templates before sending.</SharedBanner>
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
                :placeholder-issue-count="placeholderIssueCount(effectiveTemplate.subject + effectiveTemplate.body)"
                @preview="() => openTemplatePreview(effectiveTemplate)"
                @edit="() => navigateTo(`/templates/email/${effectiveTemplateKey}/edit`, { open: { target: '_blank' } })"
                @replace="(key) => overrideTemplateKey = key"
                @remove="() => overrideTemplateKey = null"
                @check-placeholders="openPlaceholderCheck(effectiveTemplate.name, effectiveTemplate.subject + effectiveTemplate.body, 'i-lucide-mail', effectiveTemplate)"
              />
              <AttachPicker
                v-else
                label="Attach an email template"
                icon="i-lucide-mail"
                :options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                @select="(key) => overrideTemplateKey = key"
              />
            </div>

            <!-- T18 (B9's courier endorsement) carries no attachment at all
                 (templates.ts: attachment: 'none') - the Equipment Return
                 Acknowledgment Form is the team member's own signed form at
                 A6, not something that belongs on the account-manager email.
                 attachedForm/effectiveForm are keyed only on ticket.mode, so
                 without this guard B9 would manufacture a form attachment
                 that has no reason to be there. -->
            <div v-if="stageKey !== 'B9' && ticket.status === 'open'" class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Attached Form</label>
              <EmailAttachSection
                v-if="effectiveForm"
                :name="effectiveForm.name"
                :subtitle="effectiveForm.description"
                :form-options="activeFormOptions.map(o => ({ id: o.value, name: o.label }))"
                :current-form-id="effectiveForm.id"
                :placeholder-issue-count="placeholderIssueCount(RETRIEVAL_FORM_CONTENT[effectiveForm.id] ?? '')"
                @preview="() => openFormPreview(effectiveForm!.id)"
                @edit="() => navigateTo(`/templates/forms/${effectiveForm!.id}/edit`, { open: { target: '_blank' } })"
                @replace="(id) => overrideFormId = id"
                @remove="() => overrideFormId = null"
                @check-placeholders="openPlaceholderCheck(effectiveForm!.name, RETRIEVAL_FORM_CONTENT[effectiveForm!.id] ?? '', 'i-lucide-file-text')"
              />
              <AttachPicker
                v-else
                label="Attach a form"
                :options="activeFormOptions.map(o => ({ id: o.value, name: o.label }))"
                @select="(id) => overrideFormId = id"
              />
            </div>

            <UTooltip :text="useManualEmail && !manualEmail.trim() ? 'Enter the manual email address first' : meta.actionLabel">
              <UButton color="primary" size="sm" :aria-disabled="(useManualEmail && !manualEmail.trim()) || undefined" :class="{ [disabledLook]: useManualEmail && !manualEmail.trim() }" @click="guardedClick(!(useManualEmail && !manualEmail.trim()), 'Enter the manual email address first.', sendNotice)">{{ meta.actionLabel }}</UButton>
            </UTooltip>
          </template>

          <!-- A7 Call Confirmation -->
          <template v-else-if="meta.kind === 'calllog'">
            <!-- A real call-log look (recent-calls list: outcome icon,
                 outcome as the primary line, timestamp trailing) instead of
                 a plain "date, time, outcome" text dump - same design effort
                 as the SMS Follow-up card below. -->
            <div class="rounded-lg overflow-hidden bg-default ring ring-default divide-y divide-default mb-6">
              <div class="px-3 py-2 flex items-center justify-between">
                <span class="text-sm font-medium text-highlighted">Call attempts</span>
                <span class="text-sm font-semibold" :class="callAtCap ? 'text-red-600' : 'text-muted'">{{ ticket.callAttempts.length }} of 3</span>
              </div>
              <div v-if="!ticket.callAttempts.length" class="px-3 py-4 text-xs text-dimmed text-center">No attempts logged yet.</div>
              <div v-for="(a, i) in ticket.callAttempts" :key="i" class="flex items-center gap-2.5 px-3 py-2">
                <div
                  class="flex items-center justify-center size-7 rounded-full shrink-0"
                  :class="a.outcome === 'Answered - confirmed' ? 'bg-[rgb(0,127,69)]/10 text-[rgb(0,127,69)]' : 'bg-red-100 text-red-600'"
                >
                  <UIcon :name="a.outcome === 'Answered - confirmed' ? 'i-lucide-phone-incoming' : 'i-lucide-phone-missed'" class="size-3.5" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-default">{{ a.outcome === 'Answered - confirmed' ? 'Answered' : 'No answer' }}</div>
                  <div class="text-xs text-dimmed">Attempt {{ i + 1 }} of 3</div>
                </div>
                <span class="text-xs text-muted shrink-0">{{ a.when }}</span>
              </div>
            </div>
            <!-- Once one call is actually answered, the goal this stage
                 exists for is already met - logging further attempts would
                 be pointless, so these two buttons give way to just
                 Continue below rather than still implying up to 3 are
                 expected. -->
            <div v-if="!callAnsweredYet" class="flex gap-2 flex-wrap mb-6">
              <UTooltip :text="callAtCap ? 'Maximum of 3 call attempts already logged' : 'Log a no-answer attempt'">
                <UButton color="neutral" variant="outline" size="sm" :aria-disabled="(callAtCap) || undefined" :class="{ [disabledLook]: callAtCap }" @click="guardedClick(!callAtCap, 'Maximum of 3 call attempts already logged.', () => logCall('No answer'))">No Answer</UButton>
              </UTooltip>
              <UTooltip :text="callAtCap ? 'Maximum of 3 call attempts already logged' : 'Log this call as answered and confirmed'">
                <UButton color="primary" size="sm" :aria-disabled="(callAtCap) || undefined" :class="{ [disabledLook]: callAtCap }" @click="guardedClick(!callAtCap, 'Maximum of 3 call attempts already logged.', () => logCall('Answered - confirmed'))">Answered</UButton>
              </UTooltip>
            </div>

            <!-- FR-003.12: the SMS follow-up lives in the Communications box on the right, beside this stage, not in the stage itself. -->
            <p v-if="callAtCap && !callAnsweredYet" class="text-sm text-muted mb-6 flex items-start gap-2">
              <UIcon name="i-lucide-message-square-text" class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>All 3 attempts went unanswered. The follow-up text is in the Communications box on the right.<template v-if="ticket.smsSentAt"> It has been sent.</template></span>
            </p>

            <!-- Hidden (not just disabled-look) until this stage is
                 actually satisfied - explicit correction from this app's
                 usual "stays visible, explains itself" disabled-button
                 convention specifically for this button. -->
            <UButton v-if="callAnsweredYet || callAtCap" color="primary" size="sm" @click="continueFromCall">Continue</UButton>
          </template>

          <!-- A8 Reminders -->
          <template v-else-if="meta.kind === 'reminders'">
            <!-- Read-only equivalent (recipient context + the reminders-sent
                 count) sits above, outside the inert wrapper - not shown
                 twice at once on a closed ticket. -->
            <template v-if="ticket.status === 'open'">
            <!-- One banner for whatever has been decided so far (sent and/or
                 skipped), right under the stage description like every other
                 stage. Time on the right is the latest decision. -->
            <SentBanner
              v-if="reminderRecord('Midpoint') || reminderRecord('Final')"
              :key="`reminders-${remindersSummary.title}`"
              :title="remindersSummary.title"
              :when="remindersSummary.when"
              :icon="remindersSummary.anySent ? 'i-lucide-mail-check' : 'i-lucide-circle-slash'"
              class="mb-6"
            >
              {{ remindersSummary.description }}
            </SentBanner>
            <EmailRecipientsSummary :to="ticket.employee.email" :cc="effectiveReminderTemplate?.cc ?? []" :bcc="effectiveReminderTemplate?.bcc ?? []" class="mb-6" />
            <RecipientChip label="Send To"
              :name="ticket.employee.name"
              :detail="`${ticket.employee.email} · ${ticket.employee.position}`"
              :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
              class="mb-6"
            />
            <!-- The templates of the reminders already sent, read-only and
                 previewable, under one label like the other stages. -->
            <div v-if="sentReminderKinds.length" class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">{{ sentReminderKinds.length > 1 ? 'Email Templates' : 'Email Template' }}</label>
              <div class="flex flex-col gap-2">
              <template v-for="kind in sentReminderKinds" :key="kind">
                  <EmailAttachSection
                    v-if="reminderRecord(kind)!.template"
                    :name="reminderRecord(kind)!.template!.name"
                    :subtitle="reminderRecord(kind)!.template!.description"
                    icon="i-lucide-mail"
                    preview-tooltip="Preview email"
                    preview-icon="i-lucide-eye"
                    read-only
                    @preview="() => openTemplatePreview(reminderRecord(kind)!.template)"
                  />
              </template>
              </div>
            </div>
            </template>
            <div v-if="ticket.reminderCount < 2 && ticket.status === 'open'" class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template ({{ ticket.reminderCount === 0 ? 'Midpoint' : 'Final' }})</label>
              <SharedBanner v-if="effectiveReminderTemplate && effectiveReminderTemplate.status !== 'active'" tone="warning" compact class="mb-2" :title="`This template is marked ${effectiveReminderTemplate.status}`">Review or reactivate it in Templates before sending.</SharedBanner>
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
                :placeholder-issue-count="placeholderIssueCount(effectiveReminderTemplate.subject + effectiveReminderTemplate.body)"
                @preview="() => openTemplatePreview(effectiveReminderTemplate)"
                @edit="() => navigateTo(`/templates/email/${effectiveReminderTemplateKey}/edit`, { open: { target: '_blank' } })"
                @replace="(key) => overrideTemplateKey = key"
                @remove="() => overrideTemplateKey = null"
                @check-placeholders="openPlaceholderCheck(effectiveReminderTemplate.name, effectiveReminderTemplate.subject + effectiveReminderTemplate.body, 'i-lucide-mail', effectiveReminderTemplate)"
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

          <!-- A9 Awaiting Return - redesigned against Nielsen's usability
               heuristics after the old flat gray box was flagged as
               under-designed: visibility of system status (the state - on
               track vs. overdue, and how many days - is the first thing on
               the card, not buried in a text line), recognition rather than
               recall (Target Date and the overdue count sit together, not
               split across a separate floating banner), consistency (reuses
               this app's own established red-overdue/gray-neutral
               conventions instead of inventing new ones), and help users
               recognize/diagnose/recover from the situation (plain-language
               explanation of what happened and why, right next to the
               action that resolves it). The overdue reminder send action
               used to live in its own separate outer card floating above
               this one, so both were visible at once ("two steps at a time"
               - reported live); it's now inline inside this same A9 card,
               so exactly one card/step ever shows regardless of overdue
               status. -->
          <!-- Equipment Won't Be Returned: the operator decided at A9 that the
               equipment is not coming back, so the ticket skipped Receipt &
               Evidence and went straight to Post-Retrieval Charging. On a
               revisit (back-nav) or a closed ticket, this read-only banner
               replaces the "Waiting for the equipment" card entirely so the
               state is not misread as still awaiting. -->
          <template v-else-if="meta.kind === 'awaiting-return' && ticket.equipmentNotReturned">
            <SentBanner title="Equipment not returned" icon="i-lucide-package-x" :when="latestHistory(/^Equipment not returned/)?.when" class="mb-4">
              Moved straight to Post-Retrieval Charging. No receipt or condition evidence was captured here.
            </SentBanner>
            <UButton v-if="ticket.status === 'open'" color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromStage">Continue to Post-Retrieval Charging</UButton>
          </template>
          <template v-else-if="meta.kind === 'awaiting-return' && equipmentReceivedAt">
            <SentBanner title="Equipment received" icon="i-lucide-package-check" :when="equipmentReceivedAt" class="mb-4">
              The equipment is back with the Asset Team. Next, attach the signed proof of receipt and condition photos.
            </SentBanner>
            <UButton v-if="ticket.status === 'open'" color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromStage">Continue to Receipt and Evidence</UButton>
          </template>
          <template v-else-if="meta.kind === 'awaiting-return'">
            <!-- Red kept to exactly three places once overdue - the title
                 text, the border, and the background fill - everything else
                 (icon, days-left badge, Target Date value) reverts to this
                 app's plain neutral styling. Reported live as "too much red"
                 and as a contrast clash between the fill and this same
                 card's own text-muted label; the fill itself is also a
                 lighter tint now (bg-red-50/60, not full bg-red-50). The
                 overdue-only paragraph explaining "this happens
                 automatically" was removed entirely - once the ticket
                 already IS overdue, that explanation restates what the
                 banner's own title just said. It's kept for the *not yet*
                 overdue case, where it's still useful (a real "here's what
                 will happen" notice, not a redundant one). -->
            <div class="banner-enter rounded-lg rounded-l-none border border-l-4 p-4 mb-4" :class="ticketOverdue ? 'border-red-300 border-l-red-600 bg-red-50/70' : 'border-gray-300 border-l-gray-500 bg-gray-50/60'">
              <div class="flex items-start gap-2.5">
                <UIcon :name="ticketOverdue ? 'i-lucide-alarm-clock' : 'i-lucide-clock'" class="size-5 mt-0.5 shrink-0" :class="ticketOverdue ? 'text-red-700' : 'text-gray-600'" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-semibold text-default">
                      {{ ticketOverdue ? 'Overdue, Target Date has passed' : 'Waiting for the equipment to come back' }}
                    </span>
                    <span v-if="ticketOverdue" class="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">{{ daysLeftLabel(ticket) }}</span>
                  </div>
                  <div class="mt-2">
                    <div class="text-xs font-semibold uppercase tracking-wide text-muted">Target Date</div>
                    <div class="text-sm font-medium text-default mt-0.5">{{ fmtDate(ticket.targetDateISO) }}</div>
                  </div>
                  <p v-if="!ticketOverdue" class="text-xs text-muted mt-3">
                    If the equipment isn't confirmed received by this date, the ticket automatically becomes Overdue Return. No operator action triggers it.
                  </p>
                </div>
              </div>
            </div>

            <!-- Overdue reminder already sent: the same sent record every other
                 send stage uses, with what went out and to whom - no repeat
                 send button, so the team member can't be spammed. -->
            <template v-if="ticketOverdue && ticket.overdueReminderSentAt">
              <SentBanner title="Overdue reminder sent" :when="fmtDateTime(ticket.overdueReminderSentAt)" class="mb-6">
                Overdue notice sent to {{ ticket.employee.name }}.
              </SentBanner>
              <EmailRecipientsSummary :to="ticket.employee.email" :cc="overdueSentTemplate?.cc ?? []" :bcc="overdueSentTemplate?.bcc ?? []" class="mb-6" />
              <RecipientChip
                label="Sent To"
                :name="ticket.employee.name"
                :detail="`${ticket.employee.email} · ${ticket.employee.position}`"
                :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
                class="mb-6"
              />
              <div v-if="overdueSentTemplate" class="mb-6">
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
                <EmailAttachSection
                  :name="overdueSentTemplate.name"
                  :subtitle="overdueSentTemplate.description"
                  icon="i-lucide-mail"
                  preview-tooltip="Preview email"
                  preview-icon="i-lucide-eye"
                  read-only
                  @preview="() => openTemplatePreview(overdueSentTemplate)"
                />
              </div>
            </template>
            <div v-else-if="ticketOverdue" class="banner-enter rounded-lg rounded-l-none border border-l-4 border-red-200 border-l-red-600 bg-white p-4 mb-6">
              <h3 class="text-sm font-semibold text-default mb-3">Send Overdue Reminder</h3>
              <EmailRecipientsSummary :to="ticket.employee.email" :cc="[]" :bcc="[]" class="mb-6" />
              <RecipientChip label="Send To"
                :name="ticket.employee.name"
                :detail="`${ticket.employee.email} · ${ticket.employee.position}`"
                :initials="ticket.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)"
                class="mb-6"
              />
              <div class="mb-6">
                <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
                <SharedBanner v-if="effectiveOverdueTemplate && effectiveOverdueTemplate.status !== 'active'" tone="warning" compact class="mb-2" :title="`This template is marked ${effectiveOverdueTemplate.status}`">Review or reactivate it in Templates before sending.</SharedBanner>
                <EmailAttachSection
                  v-if="effectiveOverdueTemplate"
                  :name="effectiveOverdueTemplate.name"
                  :subtitle="effectiveOverdueTemplate.description"
                  icon="i-lucide-mail"
                  replace-label="Replace email"
                  preview-tooltip="Preview email"
                  preview-icon="i-lucide-eye"
                  :form-options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                  :current-form-id="effectiveOverdueTemplateKey ?? undefined"
                  :placeholder-issue-count="placeholderIssueCount(effectiveOverdueTemplate.subject + effectiveOverdueTemplate.body)"
                  @preview="() => openTemplatePreview(effectiveOverdueTemplate)"
                  @edit="() => navigateTo(`/templates/email/${effectiveOverdueTemplateKey}/edit`, { open: { target: '_blank' } })"
                  @replace="(key) => overrideTemplateKey = key"
                  @remove="() => overrideTemplateKey = null"
                  @check-placeholders="openPlaceholderCheck(effectiveOverdueTemplate.name, effectiveOverdueTemplate.subject + effectiveOverdueTemplate.body, 'i-lucide-mail', effectiveOverdueTemplate)"
                />
                <AttachPicker
                  v-else
                  label="Attach an email template"
                  icon="i-lucide-mail"
                  :options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                  @select="(key) => overrideTemplateKey = key"
                />
              </div>
              <UButton color="error" size="sm" @click="sendOverdueReminder">Send Overdue Reminder</UButton>
            </div>

            <template v-if="ticket.status === 'open'">
              <p class="text-xs text-dimmed mb-2">This is a preliminary confirmation. The actual proof and condition evidence are captured next, at Receipt &amp; Evidence.</p>
              <div class="flex items-center gap-4 flex-wrap">
                <UButton color="primary" size="sm" @click="confirmPhysicalReceipt">{{ meta.actionLabel }}</UButton>
                <!-- The team member says the equipment won't come back (lost, or
                     electing to settle) - straight to Post-Retrieval Charging,
                     with no receipt or evidence step to fill. -->
                <button type="button" class="text-xs font-semibold text-muted hover:text-default" @click="notReturnedConfirmOpen = true">Equipment won't be returned?</button>
              </div>
            </template>
            <UModal v-model:open="notReturnedConfirmOpen" :ui="{ content: 'max-w-md' }">
              <template #header="{ close }">
                <h2 class="text-base font-semibold text-highlighted flex-1">Equipment not returned</h2>
                <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
              </template>
              <template #body>
                <p class="text-sm text-default">The equipment isn't coming back. The ticket skips Receipt and Evidence and moves to Post-Retrieval Charging.</p>
              </template>
              <template #footer>
                <div class="flex justify-end gap-2 w-full">
                  <UButton color="neutral" variant="outline" @click="notReturnedConfirmOpen = false">Not yet</UButton>
                  <UButton color="primary" @click="markEquipmentNotReturned">Open charging case</UButton>
                </div>
              </template>
            </UModal>
          </template>

          <!-- A10 Evidence - the attached-file chip matches the same
               cohesive UI as everywhere else a file/form is attached in this
               app (email/AttachSection.vue's pill shape), rather than a
               dashed dropzone that also has to double as the "already
               attached" state - that's what buried the old inline Replace
               button (nested inside the same <label> as the hidden input,
               fighting the label's own click-opens-file-dialog behavior). -->
          <template v-else-if="meta.kind === 'evidence'">
            <!-- Closed ticket: show the uploaded evidence files as read-only
                 chips (or a "not uploaded" state) so a scanner can see what
                 landed here. The upload area + Confirm button only render
                 while the ticket is open. -->
            <div v-if="ticket.status !== 'open'" class="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div class="text-xs text-muted mb-1.5">Proof-of-Receipt</div>
                <FileAttachChip v-if="ticket.evidenceProof" :name="ticket.evidenceProof.name" subtitle="Proof-of-Receipt" read-only @preview="openFile(ticket.evidenceProof!)" />
                <p v-else class="text-sm text-dimmed">Not uploaded</p>
              </div>
              <div>
                <div class="text-xs text-muted mb-1.5">Condition Photos</div>
                <FileAttachChip v-if="ticket.evidenceCondition" :name="ticket.evidenceCondition.name" subtitle="Condition Photos" read-only @preview="openFile(ticket.evidenceCondition!)" />
                <p v-else class="text-sm text-dimmed">Not uploaded</p>
              </div>
            </div>
            <div v-if="ticket.status === 'open'" class="grid grid-cols-2 gap-3 mb-6">
              <div>
                <div class="text-xs text-muted mb-1.5">Proof-of-Receipt</div>
                <FileAttachChip v-if="proofFile" :name="proofFile.name" subtitle="Proof-of-Receipt" @preview="openFile(proofFile)" @replace="proofInputRef?.click()" @remove="proofFile = null" />
                <label
                  v-else
                  class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors"
                  :class="proofDragOver ? 'border-primary bg-primary/5' : 'border-default bg-gray-50 hover:border-primary/50'"
                  @click="proofInputRef?.click()"
                  @dragover.prevent="proofDragOver = true"
                  @dragleave.prevent="proofDragOver = false"
                  @drop.prevent="dropEvidenceFile('proof', $event)"
                >
                  <UIcon name="i-lucide-upload" class="size-4 text-dimmed" />
                  <span class="text-xs text-dimmed">Drag a file here, or click to attach (image or PDF, max 10MB)</span>
                </label>
                <input ref="proofInputRef" type="file" class="hidden" accept="image/*,.pdf" @change="pickFile('proof', $event)">
              </div>
              <div>
                <div class="text-xs text-muted mb-1.5">Condition Photos</div>
                <FileAttachChip v-if="conditionFile" :name="conditionFile.name" subtitle="Condition Photos" @preview="openFile(conditionFile)" @replace="conditionInputRef?.click()" @remove="conditionFile = null" />
                <label
                  v-else
                  class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors"
                  :class="conditionDragOver ? 'border-primary bg-primary/5' : 'border-default bg-gray-50 hover:border-primary/50'"
                  @click="conditionInputRef?.click()"
                  @dragover.prevent="conditionDragOver = true"
                  @dragleave.prevent="conditionDragOver = false"
                  @drop.prevent="dropEvidenceFile('condition', $event)"
                >
                  <UIcon name="i-lucide-upload" class="size-4 text-dimmed" />
                  <span class="text-xs text-dimmed">Drag a file here, or click to attach (image or PDF, max 10MB)</span>
                </label>
                <input ref="conditionInputRef" type="file" class="hidden" accept="image/*,.pdf" @change="pickFile('condition', $event)">
              </div>
            </div>
            <p v-if="evidenceError && ticket.status === 'open'" class="text-xs text-red-600 mb-2">{{ evidenceError }}</p>
            <UTooltip v-if="ticket.status === 'open'" :text="(proofFile && conditionFile) ? (a10Pristine ? continueLabel : meta.actionLabel) : 'Upload both the Proof-of-Receipt and Condition Photos first'">
              <UButton color="primary" size="sm" :aria-disabled="(!proofFile || !conditionFile) || undefined" :class="{ [disabledLook]: !proofFile || !conditionFile, 'btn-ready-pulse': a10Pulse.active.value }" @click="guardedClick(!!proofFile && !!conditionFile, 'Upload both the Proof-of-Receipt and Condition Photos first.', a10Pristine ? continueFromStage : confirmEvidence)">{{ a10Pristine ? continueLabel : meta.actionLabel }}</UButton>
            </UTooltip>
          </template>

          <!-- A11 Deduction -->
          <template v-else-if="meta.kind === 'deduction'">
            <template v-if="ticket.deductionApplicable === null">
              <p class="text-sm text-dimmed mb-3">Only applies if an item was confirmed damaged or not returned at Receipt &amp; Evidence.</p>
              <div class="flex gap-2">
                <UButton color="neutral" variant="outline" size="sm" @click="markNotApplicable">Not Applicable</UButton>
                <UButton color="primary" size="sm" @click="markDamaged">Item Damaged or Not Returned</UButton>
              </div>
            </template>
            <!-- Real bug, reproduced live: this used to have no branch of
                 its own at all - `deductionApplicable` reset to `null`
                 after either choice, so "Not Applicable" and "not decided
                 yet" were visually identical, and reviewing this stage
                 later (Back, or a closed ticket) never showed which one had
                 actually happened. Now a real, permanent state. -->
            <template v-else-if="ticket.deductionApplicable === false">
              <!-- Same title/description banner shape as A9's own Overdue
                   card. Followed by a Continue button so the stage has an
                   exit, matching every other stage's shape (user feedback
                   5 Oct 2026). -->
              <div class="rounded-lg border border-default bg-gray-50 p-4 mb-4">
                <div class="flex items-start gap-2.5">
                  <UIcon name="i-lucide-circle-slash" class="size-4.5 mt-0.5 shrink-0 text-dimmed" />
                  <div class="min-w-0 flex-1">
                    <span class="text-sm font-semibold text-default">Not Applicable</span>
                    <p class="text-xs text-muted mt-1">No item was confirmed damaged or unreturned at Receipt &amp; Evidence.</p>
                  </div>
                </div>
              </div>
              <!-- Classification only (no email/form sent): Undo is safe here
                   and re-opens the Not Applicable / Item Damaged picker.
                   (user feedback 5 Oct 2026, 6th pass: undo is kept only for
                   steps that don't send anything to the team member.) -->
              <div class="flex items-center gap-3">
                <UButton v-if="ticket.status === 'open'" color="primary" size="sm" @click="continueFromStage">{{ continueLabel }}</UButton>
                <UButton v-if="ticket.status === 'open'" color="neutral" variant="link" size="sm" icon="i-lucide-undo-2" @click="undoNotApplicable">Undo this decision</UButton>
              </div>
            </template>
            <template v-else>
              <!-- The old "Confirmed Assets" reference disclosure (a plain
                   read-only list of every asset already confirmed at A5) was
                   removed per explicit feedback - it's redundant AND
                   misleading: not every confirmed asset on the ticket is
                   necessarily part of THIS deduction case, so showing "here
                   are all 5 confirmed assets" next to Case Details implied a
                   1:1 relationship that isn't real. Step 5 (Equipment) below
                   replaces it with the reference console's own real
                   Equipment step - an explicit per-case selection of which
                   confirmed asset(s) this specific case actually covers. -->

              <!-- A11 Case Details, Steps 1-2 of 4 (Post-Retrieval Charging
                   Console v1.0 alignment - see this project's own
                   POST_RETRIEVAL_CHARGING_ALIGNMENT_NOTES.md). Fill once,
                   every form/email for this case reads from it - never the
                   reverse. Steps 3 (Dates) and 4 (Amount) aren't built yet,
                   so they show as disabled tabs rather than being left out
                   of the shape entirely. Every field here turned out to be
                   genuinely derivable from this ticket's own record (none
                   needed a true external-system fetch) - so every field
                   below reads "From ticket". A "From system" badge is still
                   the right call once Step 3/4's Asset Owner field (a real
                   Asset Register lookup, not a ticket field) is built - just
                   not invented here for a field that doesn't need it. -->
              <div ref="caseDetailsCardRef" class="rounded-lg border border-default bg-default mb-6 overflow-hidden">
                <div class="px-5 pt-4 pb-3 border-b border-default flex items-start justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-semibold text-highlighted">Case Details</h3>
                    <p class="text-xs text-muted mt-0.5">Fill this once. Every form and email for this case reads from it.</p>
                  </div>
                  <!-- One legend, not a repeated badge on every field below -
                       reported live as "from ticket, from ticket, from
                       ticket" reading as rampant/repetitive once every field
                       carried its own full pill. Each field now carries only
                       a small colored dot; this is the one place its meaning
                       is spelled out. -->
                </div>
                <!-- A segmented progress track, not a second stepper -
                     this page already has a real stepper (the phase tracker
                     at the top, numbered circles + connecting line), and
                     putting another one here read as confusing next to it.
                     This is view-only on purpose: no click handlers at all,
                     not even on a reached step - order is enforced (Team
                     Member always before Case, before Dates, before Amount)
                     by only ever exposing Back/Next, never a way to jump
                     directly to an arbitrary step. All four steps are real
                     now (Dates/Amount were shown disabled with a "(soon)"
                     suffix and a flat gray track until this pass - see
                     the retrieval session handoff notes, item 3). -->
                <div class="px-5 pt-4">
                  <div class="flex items-center gap-1">
                    <div
                      v-for="(step, i) in DEDUCTION_CASE_STEPS" :key="step.label"
                      class="relative h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden"
                    >
                      <div
                        class="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out"
                        :class="deductionCaseStepState(i) === 'done' ? 'bg-success' : 'bg-primary'"
                        :style="{ width: deductionCaseStepState(i) === 'future' ? '0%' : '100%' }"
                      />
                    </div>
                  </div>
                  <div class="flex items-center mt-1.5">
                    <div v-for="(step, i) in DEDUCTION_CASE_STEPS" :key="step.label" class="flex-1 min-w-0 text-center">
                      <span class="text-xs transition-colors duration-500" :class="deductionCaseStepState(i) === 'current' ? 'text-primary font-semibold' : deductionCaseStepState(i) === 'done' ? 'text-success font-medium' : 'text-muted font-medium'">
                        {{ step.label }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="px-5 pt-6 pb-5">
                  <!-- Step 1: Team member -->
                  <div v-if="deductionCaseStepIdx === 0" class="grid grid-cols-2 gap-6 stage-enter">
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Full name</span>
                      <p class="text-sm font-medium text-default">{{ ticket.employee.name }}</p>
                    </div>
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Employee ID</span>
                      <!-- The real value is a plain number, no "EMP-" prefix
                           - that prefix is this seed data's own internal id
                           format (also used as a lookup key elsewhere in the
                           app), not what an officer would actually see on a
                           real HRIS record. Stripped for display only here;
                           the underlying id is left alone since other code
                           keys off it as-is. -->
                      <p class="text-sm font-medium text-default">{{ ticket.employee.id.replace(/^\D+/, '') }}</p>
                    </div>
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">First name</span>
                      <template v-if="editingCaseFirstName">
                        <UInput v-model="caseFirstNameDraft" size="md" class="w-full mt-1" autofocus @keyup.enter="saveCaseFirstNameEdit" />
                        <div class="flex items-center gap-2 mt-1.5">
                          <UButton size="xs" color="primary" @click="saveCaseFirstNameEdit">Save</UButton>
                          <UButton size="xs" color="neutral" variant="ghost" @click="editingCaseFirstName = false">Cancel</UButton>
                        </div>
                      </template>
                      <template v-else>
                        <span class="inline-flex items-start gap-1.5">
                          <span class="text-sm font-medium text-default">{{ deductionCaseFirstName }}</span>
                          <UTooltip text="Edit for this case">
                            <UButton size="xs" color="primary" variant="ghost" square icon="i-lucide-pencil" aria-label="Edit for this case" @click="startEditCaseFirstName" />
                          </UTooltip>
                        </span>
                        <span class="text-xs text-dimmed block mt-0.5">{{ ticket.deductionCaseFirstNameOverride ? 'Corrected for this case' : 'Taken from the full name unless you type over it' }}</span>
                      </template>
                    </div>
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Client or account</span>
                      <p class="text-sm font-medium text-default">{{ ticket.employee.client || 'Not set' }}</p>
                    </div>
                    <div class="col-span-2">
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Leadership Coach or HRBP</span>
                      <p class="text-sm font-medium text-default">{{ ticket.employee.leadershipCoach || 'Not set' }}</p>
                    </div>
                  </div>

                  <!-- Step 2: Case -->
                  <div v-else-if="deductionCaseStepIdx === 1" class="grid grid-cols-2 gap-6 stage-enter">
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Asset Team officer <span class="text-red-600">*</span></span>
                      <template v-if="editingCaseOfficer">
                        <UInput v-model="caseOfficerDraft" size="md" class="w-full mt-1" autofocus @keyup.enter="saveCaseOfficerEdit" />
                        <div class="flex items-center gap-2 mt-1.5">
                          <UButton size="xs" color="primary" @click="saveCaseOfficerEdit">Save</UButton>
                          <UButton size="xs" color="neutral" variant="ghost" @click="editingCaseOfficer = false">Cancel</UButton>
                        </div>
                      </template>
                      <template v-else>
                        <span class="inline-flex items-start gap-1.5">
                          <span class="text-sm font-medium text-default">{{ deductionCaseOfficer }}</span>
                          <UTooltip text="Edit for this case">
                            <UButton size="xs" color="primary" variant="ghost" square icon="i-lucide-pencil" aria-label="Edit for this case" @click="startEditCaseOfficer" />
                          </UTooltip>
                        </span>
                        <span class="text-xs text-dimmed block mt-0.5">{{ ticket.deductionCaseOfficerOverride ? 'Corrected for this case' : "Defaults to this ticket's assignee" }}</span>
                      </template>
                    </div>
                    <!-- APR reference removed per explicit feedback - the
                         reference doc's own Case Details carries it because
                         its forms/emails print it in the header next to the
                         logo, but this app's real email templates don't
                         actually have that header slot built (it was
                         removed from them in an earlier pass), so showing a
                         reference here that never appears anywhere the
                         officer would actually look would be its own kind of
                         confusing. `ticket.reference` (APR-YY-NNNNN) still
                         exists on the ticket - re-add this field once the
                         email template header is actually built to carry
                         it, not before. -->
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Date the return was requested</span>
                      <template v-if="editingCaseReturnRequested">
                        <SharedDatePicker v-model="caseReturnRequestedDraft" size="md" @enter="saveCaseReturnRequestedEdit" />
                        <div class="flex items-center gap-2 mt-1.5">
                          <UButton size="xs" color="primary" @click="saveCaseReturnRequestedEdit">Save</UButton>
                          <UButton size="xs" color="neutral" variant="ghost" @click="editingCaseReturnRequested = false">Cancel</UButton>
                        </div>
                      </template>
                      <template v-else>
                        <span class="inline-flex items-start gap-1.5">
                          <span class="text-sm" :class="deductionCaseReturnRequested ? 'text-highlighted' : 'text-dimmed'">{{ deductionCaseReturnRequested ? fmtDate(deductionCaseReturnRequested) : 'Not yet known' }}</span>
                          <UTooltip text="Edit for this case">
                            <UButton size="xs" color="primary" variant="ghost" square icon="i-lucide-pencil" aria-label="Edit for this case" @click="startEditCaseReturnRequested" />
                          </UTooltip>
                        </span>
                        <span class="text-xs text-dimmed block mt-0.5">
                          {{ ticket.deductionCaseReturnRequestedDate ? 'Corrected for this case' : (deductionCaseReturnRequestedDerived ? "Derived from this ticket's own Activity Log (earliest notice sent)" : 'No notice sent yet to derive this from') }}
                        </span>
                      </template>
                    </div>
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Return date that was set</span>
                      <p class="text-sm font-medium text-default">{{ ticket.targetDateISO ? fmtDate(ticket.targetDateISO) : 'Not set' }}</p>
                    </div>
                  </div>

                  <!-- Step 3: Dates. Date Received is the only field of the
                       six with a real computed default (see
                       deductionCaseReceivedDerived's own comment) - same
                       edit-pencil shape as Step 2's fields above. The
                       remaining five have no structured signal anywhere else
                       on the ticket, so they're plain always-editable date
                       inputs, bound straight to the ticket (CASE_PLAIN_DATE_FIELDS) -
                       there's no default to preserve or override, so the
                       heavier draft/save/cancel machinery the derived fields
                       need would just be extra clicks for nothing here. -->
                  <div v-else-if="deductionCaseStepIdx === 2" class="grid grid-cols-2 gap-6 stage-enter">
                    <p class="col-span-2 text-xs text-dimmed -mb-2">{{ deductionDatesOutcome ? `Showing the dates used for ${DEDUCTION_OUTCOME_META[deductionDatesOutcome].label}.` : 'Once you pick an outcome in the last step, this list narrows to the dates it uses.' }}</p>
                    <div v-if="showDeductionDate('received')">
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-0.5">Date received</span>
                      <template v-if="editingCaseReceived">
                        <SharedDatePicker v-model="caseReceivedDraft" size="md" @enter="saveCaseReceivedEdit" />
                        <div class="flex items-center gap-2 mt-1.5">
                          <UButton size="xs" color="primary" @click="saveCaseReceivedEdit">Save</UButton>
                          <UButton size="xs" color="neutral" variant="ghost" @click="editingCaseReceived = false">Cancel</UButton>
                        </div>
                      </template>
                      <template v-else>
                        <span class="inline-flex items-start gap-1.5">
                          <span class="text-sm" :class="deductionCaseReceived ? 'text-highlighted' : 'text-dimmed'">{{ deductionCaseReceived ? fmtDate(deductionCaseReceived) : 'Not yet known' }}</span>
                          <UTooltip text="Edit for this case">
                            <UButton size="xs" color="primary" variant="ghost" square icon="i-lucide-pencil" aria-label="Edit for this case" @click="startEditCaseReceived" />
                          </UTooltip>
                        </span>
                        <span class="text-xs text-dimmed block mt-0.5">
                          {{ ticket.deductionCaseReceivedDate ? 'Corrected for this case' : (deductionCaseReceivedDerived ? "Derived from this ticket's own Activity Log (Proof-of-Receipt uploaded)" : 'Evidence not confirmed yet to derive this from') }}
                        </span>
                      </template>
                    </div>
                    <div v-for="f in CASE_PLAIN_DATE_FIELDS.filter(f => showDeductionDate(f.key))" :key="f.key">
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">{{ f.label }}</span>
                      <SharedDatePicker v-model="ticket[f.key]" size="md" />
                    </div>
                  </div>

                  <!-- Step 4: Amount. Basis is a real 5-option dropdown
                       (deductionAmountBasisOptions, verbatim from the
                       reference console); the other three are plain
                       free-text fields, same "bound straight to the ticket"
                       shape as the Step 3 fields above - none of them have a
                       computed default either. Per-row valuation on the
                       equipment table (the reference console's own per-asset
                       "Condition"/"Finding" column) is deliberately not
                       built here - it's the outcome-selector/attach flow's
                       job once that's rebuilt on top of these two steps, not
                       Case Details' own concern. -->
                  <div v-else-if="deductionCaseStepIdx === 3" class="grid grid-cols-2 gap-6 stage-enter">
                    <div class="col-span-2">
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Basis of the amount</span>
                      <USelect :model-value="ticket.deductionCaseAmountBasis ?? undefined" :items="deductionAmountBasisOptions" @update:model-value="(v: unknown) => { if (ticket) ticket.deductionCaseAmountBasis = (v as DeductionAmountBasis | undefined) ?? null }" value-key="value" placeholder="Select a basis" size="md" class="w-full" />
                      <p v-if="deductionOutcomeSelection && DEDUCTION_BASES_BY_OUTCOME[deductionOutcomeSelection]" class="text-xs text-dimmed mt-2">Showing the bases that apply to {{ DEDUCTION_OUTCOME_META[deductionOutcomeSelection].label }}.</p>
                    </div>
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Supporting document reference</span>
                      <UInput v-model="ticket.deductionCaseSupportingDocRef" size="md" class="w-full" placeholder="e.g. quotation or invoice reference" />
                      <p v-if="ticket.quotationReference" class="text-xs text-muted mt-1 flex items-start gap-1.5"><UIcon name="i-lucide-info" class="size-3 mt-px text-muted shrink-0" />Overridden by the tracked quotation reference {{ ticket.quotationReference }} below. Clear it in Quotation to use this field.</p>
                    </div>
                    <div>
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Amount in figures</span>
                      <UInput v-model="ticket.deductionCaseAmountFigures" size="md" class="w-full" placeholder="e.g. 5,000.00" />
                    </div>
                    <div class="col-span-2">
                      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Amount in words</span>
                      <UInput v-model="ticket.deductionCaseAmountWords" size="md" class="w-full" placeholder="e.g. Five Thousand Pesos Only" />
                    </div>
                    <!-- #30 Quotation tracking (added 5 Oct 2026). Shown
                         for every outcome; the fields are optional but the
                         received date, once set, logs a "Quotation received"
                         Activity Log line. The reference, if set, is what
                         SUPPORTING_DOC_REF prints in F1/F3. -->
                    <div class="col-span-2 rounded-lg border border-default bg-gray-50/60 p-4 flex flex-col gap-3">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-file-text" class="size-4 text-muted" />
                        <span class="text-sm font-semibold text-default">Quotation</span>
                        <span class="text-xs text-muted">The repair quotation from the service provider.</span>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Received on</span>
                          <SharedDatePicker v-model="quotationReceivedDraft" size="md" />
                        </div>
                        <div>
                          <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Reference</span>
                          <UInput v-model="quotationReferenceDraft" size="md" class="w-full" placeholder="e.g. QT-2026-00412" />
                        </div>
                      </div>
                      <div>
                        <span class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Quotation file</span>
                        <FileAttachChip v-if="quotationFile" :name="quotationFile.name" subtitle="Repair quotation" :read-only="ticket.status !== 'open'" @preview="openQuotationFile" @replace="quotationFileInputRef?.click()" @remove="clearQuotationFile" />
                        <label
                          v-else-if="ticket.status === 'open'"
                          class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-default bg-white p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          @click="quotationFileInputRef?.click()"
                        >
                          <UIcon name="i-lucide-upload" class="size-4 text-dimmed" />
                          <span class="text-xs text-dimmed">Drag or click to attach the quotation (image or PDF)</span>
                        </label>
                        <p v-else class="text-sm text-dimmed">No file uploaded</p>
                        <input ref="quotationFileInputRef" type="file" class="hidden" accept="image/*,.pdf" @change="pickQuotationFile" />
                      </div>
                      <div v-if="ticket.status === 'open'" class="flex items-center justify-end">
                        <UButton v-if="quotationUnsaved" size="sm" color="primary" icon="i-lucide-check" @click="saveQuotation">Save quotation details</UButton>
                        <span v-else-if="ticket.quotationReceivedISO || ticket.quotationFileName" class="inline-flex items-center gap-1.5 text-xs font-medium text-green-700"><UIcon name="i-lucide-circle-check" class="size-3.5" />Saved</span>
                      </div>
                    </div>
                  </div>

                  <!-- Step 5: Equipment - the reference console's own
                       repeatable Equipment step (Asset tag/Serial/Name),
                       rebuilt here as a real per-case selection instead of
                       the old "Confirmed Assets" reference disclosure it
                       replaces (see that block's own removal comment above).
                       Checking an asset is the only way it counts toward
                       this case - a blank list here is a real, meaningful
                       state (case details filled in but nothing selected
                       yet), not an oversight to paper over with a default of
                       "everything". -->
                  <div v-else-if="deductionCaseStepIdx === 4" class="flex flex-col gap-3 stage-enter">
                    <p class="text-sm text-muted">Select the items this case covers. Not every confirmed item has to be part of it.</p>
                    <!-- One white card per item: the selection shows as a primary border (3:1 against white)
                         plus the ticked box, and the note field sits inside the same card. Every line of text
                         is on white in text-default or text-muted, which meet AA contrast. -->
                    <div
                      v-for="a in ticket.assets"
                      :key="a.serial"
                      class="rounded-lg border bg-white"
                      :class="ticket.deductionCaseAssetSerials.includes(a.serial) ? 'border-primary' : 'border-default'"
                    >
                      <label class="flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg hover:bg-gray-50">
                        <UCheckbox :model-value="ticket.deductionCaseAssetSerials.includes(a.serial)" @update:model-value="toggleDeductionCaseAsset(a.serial)" />
                        <UIcon :name="assetIcon(a.name)" class="size-4 text-muted shrink-0" aria-hidden="true" />
                        <span class="min-w-0 flex-1">
                          <span class="text-sm font-medium text-highlighted block truncate">{{ a.model }}</span>
                          <span class="text-xs text-muted block truncate">{{ a.assetTag }} &middot; {{ a.serial }}</span>
                        </span>
                        <span v-if="!a.checked" class="text-xs font-medium text-default bg-gray-100 rounded px-2 py-0.5 shrink-0">Not returned</span>
                      </label>
                      <!-- The last column of the email's equipment table, for this item. -->
                      <div v-if="ticket.deductionCaseAssetSerials.includes(a.serial)" class="border-t border-default px-4 py-3">
                        <label :for="`case-note-${a.serial}`" class="text-sm font-medium text-default block mb-1.5">
                          {{ deductionAssetNoteLabel }} <span class="text-red-700 font-normal">(required)</span>
                        </label>
                        <UInput
                          :id="`case-note-${a.serial}`"
                          :model-value="ticket.deductionCaseAssetNotes?.[a.serial] ?? ''"
                          size="md"
                          class="w-full"
                          :color="deductionAssetNotesAttempted && deductionAssetNoteMissing(a.serial) ? 'error' : 'primary'"
                          :highlight="deductionAssetNotesAttempted && deductionAssetNoteMissing(a.serial)"
                          :aria-invalid="deductionAssetNotesAttempted && deductionAssetNoteMissing(a.serial)"
                          :aria-describedby="`case-note-help-${a.serial}`"
                          :placeholder="deductionAssetNotePlaceholder"
                          @update:model-value="(v) => { if (ticket) ticket.deductionCaseAssetNotes = { ...(ticket.deductionCaseAssetNotes ?? {}), [a.serial]: String(v) } }"
                        />
                        <p :id="`case-note-help-${a.serial}`" class="text-sm mt-1.5 flex items-start gap-1.5" :class="deductionAssetNotesAttempted && deductionAssetNoteMissing(a.serial) ? 'text-red-700' : 'text-muted'">
                          <UIcon :name="deductionAssetNotesAttempted && deductionAssetNoteMissing(a.serial) ? 'i-lucide-circle-alert' : 'i-lucide-info'" class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{{ deductionAssetNotesAttempted && deductionAssetNoteMissing(a.serial) ? 'Required. It prints in the equipment table of the email and form.' : 'Prints in the equipment table of the email and form.' }}</span>
                        </p>
                      </div>
                    </div>
                    <!-- One status line for the step. Announced politely, and never carried by colour alone. -->
                    <p role="status" aria-live="polite" class="flex items-start gap-2 text-sm text-default">
                      <template v-if="!ticket.deductionCaseAssetSerials.length">
                        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0 mt-0.5 text-orange-700" aria-hidden="true" />
                        <span>Select at least one item to continue.</span>
                      </template>
                      <template v-else-if="deductionAssetNotesMissingCount">
                        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0 mt-0.5 text-orange-700" aria-hidden="true" />
                        <span>{{ deductionAssetNotesMissingCount }} item{{ deductionAssetNotesMissingCount === 1 ? '' : 's' }} still need{{ deductionAssetNotesMissingCount === 1 ? 's' : '' }} the {{ deductionAssetNoteLabel.toLowerCase() }}.</span>
                      </template>
                      <template v-else>
                        <UIcon name="i-lucide-circle-check" class="size-4 shrink-0 mt-0.5 text-green-700" aria-hidden="true" />
                        <span>Ready. Continue to choose the outcome.</span>
                      </template>
                    </p>
                  </div>

                  <!-- Outcome step: the answers so far, each with a way back to change it. -->
                  <div v-else-if="deductionCaseStepIdx === DEDUCTION_CASE_STEPS.length - 1" class="stage-enter">
                    <h4 class="text-sm font-semibold text-default mb-2">Case Details summary</h4>
                    <dl class="rounded-lg border border-default divide-y divide-default">
                      <div v-for="row in caseSummaryRows" :key="row.step" class="flex items-center gap-3 px-4 py-2.5">
                        <dt class="w-28 shrink-0 text-xs text-muted">{{ row.label }}</dt>
                        <dd class="min-w-0 flex-1 truncate text-sm text-default">{{ row.value }}</dd>
                        <UButton size="xs" color="neutral" variant="ghost" :aria-label="`Change ${row.label}`" @click="deductionCaseStepIdx = row.step">Change</UButton>
                      </div>
                    </dl>
                  </div>

                  <div class="flex items-center justify-between mt-4 pt-3 border-t border-default">
                    <UButton v-if="deductionCaseStepIdx > 0" size="sm" color="neutral" variant="outline" icon="i-lucide-chevron-left" @click="deductionCaseStepIdx--">Back to {{ DEDUCTION_CASE_STEPS[deductionCaseStepIdx - 1]?.label }}</UButton>
                    <span v-else />
                    <UButton v-if="deductionCaseStepIdx < DEDUCTION_CASE_STEPS.length - 1" size="sm" color="primary" trailing-icon="i-lucide-chevron-right" :aria-disabled="(deductionCaseStepIdx === 4 && !ticket.deductionCaseAssetSerials.length) || undefined" :class="{ [disabledLook]: deductionCaseStepIdx === 4 && !ticket.deductionCaseAssetSerials.length }" @click="continueCase">Continue to {{ DEDUCTION_CASE_STEPS[deductionCaseStepIdx + 1]?.label }}</UButton>
                  </div>
                </div>
              </div>
              <!-- Outcome - rebuilt now that Case Details Steps 3/4 and the
                   real T22-T25/F1-F3 templates/forms exist (see the script's
                   own comment on confirmDeductionOutcome above for why the
                   original scaffold was pulled and what unblocked rebuilding
                   it). Same 4-card selectable-card pattern as A12's Return
                   Check routing further down (inspectionRoutingOptions) -
                   deliberately not a second, differently-shaped picker.
                   Real bug, reproduced live: this used to show unconditionally
                   the moment "Item Damaged or Not Returned" was picked, so it
                   sat there the whole time the officer was still on Step 1
                   (Team Member) - premature, since nothing about the outcome
                   is actually decidable before Case Details (specifically
                   Equipment) is filled in. Gated now to its one recommended
                   trigger/stage: only once the officer has reached the last
                   step (Equipment) AND has actually selected at least one
                   asset there - never earlier, and never while the officer
                   is still stepping back through 1-4 to review something. -->
              <div v-if="ticket.status === 'open' && ticket.deductionCaseAssetSerials.length > 0 && deductionCaseStepIdx === DEDUCTION_CASE_STEPS.length - 1" ref="deductionOutcomeScrollTarget" tabindex="-1" aria-labelledby="case-outcome-heading" class="stage-enter rounded-lg border border-default bg-default p-4 scroll-mt-24 focus:outline-none">
                <h3 id="case-outcome-heading" class="text-sm font-semibold text-default mb-2">What is the outcome of this case?</h3>
                <p v-if="ticket.deductionOutcome" class="text-xs text-muted mb-3">Recorded as <span class="font-medium text-default">{{ DEDUCTION_OUTCOME_META[ticket.deductionOutcome].label }}</span>. You can still change it while this ticket is open.</p>
                <URadioGroup
                  :model-value="deductionOutcomeSelection || undefined"
                  @update:model-value="(v: unknown) => deductionOutcomeSelection = (v as DeductionOutcome | undefined) ?? ''"
                  :items="deductionOutcomeOptions"
                  legend="What is the outcome of this case?"
                  variant="card"
                  orientation="horizontal"
                  indicator="hidden"
                  size="sm"
                  class="mb-3"
                  :ui="{ ...cardSelectUi, legend: 'sr-only', label: 'transition-colors group-has-data-[state=checked]:text-primary text-sm', description: 'transition-colors text-xs group-has-data-[state=checked]:text-default', fieldset: 'grid grid-cols-2 gap-2 w-full', item: `${cardSelectUi.item} w-full min-w-0` }"
                />
                <!-- Once an outcome is picked, the send review below is the
                     exact same cohesive shape every other template-send
                     stage in this workspace already uses (A6/B9's own
                     RecipientChip + "Email Template"/"Attached Form"
                     EmailAttachSection pair, see meta.kind === 'template-send'
                     above) - not a bespoke smaller preview box. `readOnly`
                     on both chips since Replace/Remove don't apply here (the
                     outcome itself is the choice; there's exactly one
                     template/form per outcome, never several to switch
                     between) - Preview and Check Placeholders stay live. -->
                <template v-if="deductionOutcomeSelection">
                  <!-- Same layout as every other template-send stage:
                       Recipients (To/CC/BCC) -> Send To -> Email Template ->
                       Attached Form. Removed the earlier "Sending to … Show
                       recipients" card wrapper (user feedback 5 Oct 2026,
                       3rd pass) so the recipient section renders in-line like
                       every other send stage. -->
                  <EmailRecipientsSummary :to="ticket.employee.email" :cc="deductionEffectiveTemplate?.cc ?? []" :bcc="deductionEffectiveTemplate?.bcc ?? []" class="mb-6" />
                  <div class="mb-6">
                    <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Email Template</label>
                    <EmailAttachSection
                      v-if="deductionEffectiveTemplate"
                      :name="deductionEffectiveTemplate.name"
                      :subtitle="deductionEffectiveTemplate.description"
                      icon="i-lucide-mail"
                      replace-label="Replace email"
                      preview-tooltip="Preview email"
                      preview-icon="i-lucide-eye"
                      :form-options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                      :current-form-id="deductionEffectiveTemplateKey ?? undefined"
                      :placeholder-issue-count="placeholderIssueCount(deductionEffectiveTemplate.subject + caseHtml(deductionEffectiveTemplate.body))"
                      @preview="() => openTemplatePreview(withCaseRows(deductionEffectiveTemplate))"
                      @edit="() => navigateTo(`/templates/email/${deductionEffectiveTemplateKey}/edit`, { open: { target: '_blank' } })"
                      @replace="(key) => deductionTemplateOverride = key"
                      @remove="() => deductionTemplateOverride = null"
                      @check-placeholders="openPlaceholderCheck(deductionEffectiveTemplate.name, deductionEffectiveTemplate.subject + caseHtml(deductionEffectiveTemplate.body), 'i-lucide-mail', withCaseRows(deductionEffectiveTemplate))"
                    />
                    <AttachPicker
                      v-else
                      label="Attach an email template"
                      icon="i-lucide-mail"
                      :options="activeTemplateOptions.map(o => ({ id: o.value, name: o.label }))"
                      @select="(key) => deductionTemplateOverride = key"
                    />
                  </div>
                  <div class="mb-6">
                    <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Attached Form</label>
                    <EmailAttachSection
                      v-if="deductionEffectiveForm"
                      :name="deductionEffectiveForm.name"
                      :subtitle="deductionEffectiveForm.description"
                      :form-options="activeFormOptions.map(o => ({ id: o.value, name: o.label }))"
                      :current-form-id="deductionEffectiveForm.id"
                      :placeholder-issue-count="placeholderIssueCount(caseHtml(RETRIEVAL_FORM_CONTENT[deductionEffectiveForm.id]))"
                      @preview="() => openFormPreview(deductionEffectiveForm!.id, true)"
                      @edit="() => navigateTo(`/templates/forms/${deductionEffectiveForm!.id}/edit`, { open: { target: '_blank' } })"
                      @replace="(id) => deductionFormOverride = id"
                      @remove="() => deductionFormOverride = null"
                      @check-placeholders="openPlaceholderCheck(deductionEffectiveForm!.name, caseHtml(RETRIEVAL_FORM_CONTENT[deductionEffectiveForm!.id]), 'i-lucide-file-text')"
                    />
                    <AttachPicker
                      v-else
                      label="Attach a form"
                      :options="activeFormOptions.map(o => ({ id: o.value, name: o.label }))"
                      @select="(id) => deductionFormOverride = id"
                    />
                  </div>
                </template>
                <!-- Already sent and unchanged: say so plainly and let the officer
                     move on, rather than leaving a disabled "Update" button as
                     the only thing to click. Picking a different outcome (or
                     swapping the template/form) brings the Update button back. -->
                <template v-if="deductionOutcomeUnchanged">
                  <SentBanner :title="deductionEffectiveForm ? 'Email and form sent' : 'Email sent'" :when="deductionOutcomeSentAt" class="mb-4">
                    {{ ticket.deductionOutcome ? DEDUCTION_OUTCOME_META[ticket.deductionOutcome].label : 'Outcome' }} notice sent to {{ ticket.employee.name }}{{ deductionEffectiveForm ? ', with the form attached for signature' : '' }}.
                  </SentBanner>
                  <!-- #37 Referred to Payroll (added 5 Oct 2026): a formal
                       handoff record for chargeable outcomes. AMS has no
                       payroll integration, so this is an explicit manual
                       acknowledgement that the ATD has reached HR / Payroll.
                       Shown only for Charge or Settlement outcomes (the two
                       outcomes that produce an authority to deduct). -->
                  <template v-if="ticket.deductionOutcome === 'charge' || ticket.deductionOutcome === 'settlement'">
                    <SentBanner v-if="ticket.referredToPayrollAt" title="Referred to HR and Payroll" icon="i-lucide-building-2" :when="fmtDateTime(ticket.referredToPayrollAt)" class="mb-4">
                      Authority to Deduct handed off by {{ actorFullName(ticket.referredToPayrollBy || currentUserName()) }}.
                    </SentBanner>
                    <SharedBanner v-else tone="warning" icon="i-lucide-building-2" title="Hand off to HR and Payroll" class="mb-4">
                      AMS does not post deductions directly. Record the handoff once the signed Authority to Deduct has been forwarded to HR and Payroll.
                      <template #actions>
                        <UButton color="primary" size="sm" icon="i-lucide-check" @click="doConfirmReferredToPayroll">Mark as referred to Payroll</UButton>
                      </template>
                    </SharedBanner>
                  </template>
                  <!-- No "Undo this outcome" here: the determination/quotation/no-charge/settlement notice has already been sent via Outlook to the team member. In-app undo would mislead the operator (user feedback 5 Oct 2026, 6th pass). -->
                  <UButton v-if="ticket.deductionOutcome !== 'quotation-pending'" color="primary" size="sm" trailing-icon="i-lucide-chevron-right" @click="continueFromCharging">{{ ticket.equipmentNotReturned || ticket.deductionOutcome === 'settlement' ? 'Continue to Closure' : 'Continue to Returned Item Check' }}</UButton>
                  <p v-else class="text-xs text-muted">Waiting on the repair quotation. Change the outcome to No Charge or Determination &amp; Charge once it is back.</p>
                </template>
                <UTooltip v-else :text="!deductionOutcomeSelection ? 'Select an outcome first' : !deductionEffectiveTemplate ? 'Attach an email template first' : deductionOutcomeUnchanged ? 'This outcome is already recorded' : deductionSendLabel">
                  <UButton color="primary" size="sm" :aria-disabled="(!deductionOutcomeSelection || !deductionEffectiveTemplate || deductionOutcomeUnchanged) || undefined" :class="{ [disabledLook]: !deductionOutcomeSelection || !deductionEffectiveTemplate || deductionOutcomeUnchanged }" @click="guardedClick(!!deductionOutcomeSelection && !!deductionEffectiveTemplate && !deductionOutcomeUnchanged, !deductionOutcomeSelection ? 'Select an outcome first.' : !deductionEffectiveTemplate ? 'Attach an email template first.' : 'This outcome is already recorded. Pick a different one to change it.', confirmDeductionOutcome)">{{ deductionSendLabel }}</UButton>
                </UTooltip>
              </div>
              <!-- Already resolved - a plain read-only summary, same shape
                   as every other already-completed stage in this workspace
                   (e.g. the Gate banner's recorded note), not the picker
                   again. 'quotation-pending' stays revisitable (see
                   confirmDeductionOutcome's own comment) - its summary says
                   so plainly instead of implying the case is closed.
                   `v-else-if` (not `v-else`) deliberately - unlike the
                   picker above, this one isn't tied to which Case Details
                   step is showing: once an outcome is recorded, the summary
                   stays visible regardless of whether the officer steps back
                   through 1-4 to review something, rather than disappearing
                   the moment they leave the Equipment step. -->
              <SharedBanner v-else-if="ticket.deductionOutcome" tone="neutral" icon="i-lucide-check-check" :title="DEDUCTION_OUTCOME_META[ticket.deductionOutcome].label">
                {{ DEDUCTION_OUTCOME_META[ticket.deductionOutcome].description }}
                <template v-if="ticket.deductionOutcome === 'quotation-pending'" #body>
                  <p class="text-xs font-medium text-orange-700">Still open. Come back when the quotation arrives to resolve this to No Charge or Determination &amp; Charge.</p>
                </template>
              </SharedBanner>
            </template>
          </template>

          <!-- A13 Closure -->
          <template v-else-if="meta.kind === 'closure'">
            <!-- What closing actually depends on, each with a pass/attention
                 state, so the officer can see at a glance whether anything is
                 still open before closing (or, once closed, what it closed
                 with). -->
            <SentBanner v-if="ticket.status === 'closed'" title="Ticket closed" :icon="closureOutstanding ? 'i-lucide-lock' : 'i-lucide-circle-check'" :tone="closureOutstanding ? 'neutral' : 'success'" :when="latestHistory(/^Ticket Closed$/)?.when" variant="closed" class="mb-6">
              {{ closureCopyWasSent ? 'Closure record sent to the team member.' : 'Closed without sending a closure record.' }}<template v-if="closureOutstanding">{{ ' ' }}{{ closureOutstanding }} {{ closureOutstanding === 1 ? 'item was' : 'items were' }} still outstanding at closing, listed below.</template>
            </SentBanner>
            <div class="mb-6">
              <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">{{ ticket.status === 'closed' ? 'Final state' : 'Before you close' }}</label>
              <div class="rounded-lg border border-default divide-y divide-default">
                <div v-for="c in closureChecks" :key="c.label" class="flex items-start gap-3 px-4 py-3">
                  <UIcon :name="c.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-4.5 mt-0.5 shrink-0" :class="c.ok ? 'text-success' : 'text-warning'" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-default">{{ c.label }}</div>
                    <div class="text-xs text-muted mt-0.5">{{ c.detail }}</div>
                  </div>
                </div>
              </div>
            </div>
            <UButton v-if="ticket.status === 'open'" color="primary" size="sm" @click="openClosure">{{ meta.actionLabel }}</UButton>
          </template>
          </div>
          <!-- Closure's own "view the exact copy sent" - the Artifacts
               Summary drawer already has this as a helper note under Export
               as PDF, but that drawer isn't an obvious place to look for it
               (reported live) - this is an additional way to reach the same
               preview modal from the Closure step itself, not a replacement
               for the drawer's own note, which stays as-is. Sits below the
               closure recap (not above it, over the step title) per explicit
               correction - these outside-`inert` actions read as a
               continuation of the card's own content, not a separate banner
               competing with the title for attention. -->
          <!-- `-mt-6` cancels the inert div's own trailing `pb-6` right
               above (24px) - without it, the gap down to this row (24px
               inert padding + the recap card's own mb-4) read as much
               wider than the 16px gaps used everywhere else on this card,
               reported live as "too far from the card above". -->
          <div v-if="ticket.status === 'closed' && meta?.kind === 'closure' && closureCopyWasSent" class="px-6 pb-4 -mt-6 flex flex-wrap items-center gap-2">
            <!-- Same secondary-button convention as the rest of this
                 workspace (e.g. A5's Select All/Unselect All) - plain link
                 buttons read as a visually different family, reported live
                 as "not cohesive with the other buttons". -->
            <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-eye" @click="sendPreviewOpen = true">View sent copy</UButton>
            <!-- Distinct from the button above - that opens a quick in-page
                 HTML look at the content; this actually produces the real
                 PDF (same pipeline/content as the Artifacts Summary
                 drawer's own Export as PDF), for when the operator wants
                 the document itself, not just to eyeball it. -->
            <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-printer" :loading="artifactsPrinting" @click="exportTeamMemberCopy">Export as PDF</UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Log drawer - every action recorded on this ticket, newest
         first. Header/empty-state shape matches the Artifacts Summary drawer
         below (icon+title+subtitle, same floating/inset panel) so the two
         feel like one family rather than two differently-built drawers. -->
    <USlideover v-model:open="activityOpen" side="right" inset :ui="{ content: 'w-[calc(100%-1.5rem)] inset-y-3 right-3', body: 'p-0 sm:p-0 flex flex-col overflow-hidden' }">
      <template #header="{ close }">
        <div class="flex items-start gap-3">
          <!-- No UTooltip here - a dialog auto-focuses its close button on
               open (a11y), and a Tooltip attached to that same element then
               shows immediately on that programmatic focus, not on a real
               hover (reproduced live: "the tooltip appears the instant the
               drawer opens"). aria-label alone still gives it an accessible
               name without that side effect. items-start (not items-center)
               so the close button stays pinned to the top of the header
               regardless of how many lines the title/subtitle block wraps
               to, rather than sliding to the vertical center of that block. -->
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-x" class="rounded-full shrink-0 mt-0.5" aria-label="Close" @click="close" />
          <div>
            <h3 class="text-base font-semibold text-highlighted">Activity Log</h3>
            <div class="text-xs text-muted mt-0.5">Every action recorded on this ticket, newest first.</div>
          </div>
        </div>
      </template>
      <template #body>
        <!-- Pinned above the scrolling list (same technique
             PlaceholderDrawer.vue already uses for its own search/filter
             row) - a timeline's filter/sort is context the operator needs
             to keep seeing while scanning a long list, not something that
             should scroll out of view with it. -->
        <div class="shrink-0 px-4 sm:px-6 pt-4 pb-4 border-b border-default flex items-center gap-2">
          <!-- Sort is a quick filter too - always 2 options, so it's always
               a pill pair, on the left. -->
          <div class="flex gap-1.5 shrink-0">
            <UButton
              v-for="opt in activitySortItems"
              :key="opt.value"
              :color="activitySort === opt.value ? 'primary' : 'neutral'"
              :variant="activitySort === opt.value ? 'solid' : 'outline'"
              size="xs"
              class="rounded-full"
              @click="activitySort = opt.value"
            >
              {{ opt.label }}
            </UButton>
          </div>
          <!-- Category filter, right-aligned - 3 or fewer total options
               (incl. "All") stays a quick pill row; a real ticket usually
               touches far more of the 16 categories than that, so the
               common case collapses into one dropdown instead of a wall of
               chips, same rule this app already applies to Ticket
               Overview's own filters. -->
          <div v-if="activityFilterOptions.length" class="flex-1 min-w-0 flex justify-end">
            <div v-if="activityFilterIsCompact" class="flex flex-wrap justify-end gap-1.5">
              <UButton
                :color="activityFilter === 'all' ? 'primary' : 'neutral'"
                :variant="activityFilter === 'all' ? 'solid' : 'outline'"
                size="xs"
                class="rounded-full"
                @click="activityFilter = 'all'"
              >
                All
              </UButton>
              <UButton
                v-for="cat in activityFilterOptions"
                :key="cat"
                :color="activityFilter === cat ? 'primary' : 'neutral'"
                :variant="activityFilter === cat ? 'solid' : 'outline'"
                size="xs"
                class="rounded-full"
                @click="activityFilter = cat"
              >
                {{ HISTORY_CATEGORY_META[cat].label }}
              </UButton>
            </div>
            <SharedSelect v-else v-model="activityFilter" :items="activityFilterSelectItems" size="sm" class="w-48" />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-4 pt-4 pb-4 sm:px-6 sm:pb-6 fade-scroll-y">
        <div class="flex flex-col">
          <!-- Real avatar per entry (actor initials off the real full name,
               see ACTOR_FULL_NAMES above) instead of the timeline's old bare
               category dot - "who did this" reads at a glance now instead
               of only being findable in the small muted line below. The
               category's own color is kept, not dropped - it moved to a
               small corner badge on the avatar (a real, separate signal for
               *what kind* of event this is, distinct from *who* did it,
               rather than the two being conflated into one plain dot).
               Actor and timestamp are now one line, center-dot-separated
               (matching this same drawer's own Target Date re-baseline list
               further up, and per explicit feedback that anything sharing a
               line should be dot-separated) instead of two stacked lines of
               equal visual weight fighting the action line above them for
               attention - a real hierarchy fix: one bold "what happened"
               line, one small muted "who, when" line under it. -->
          <!-- Revised per feedback: the event itself is an icon (the
               category's own Lucide icon, one uniform blue for every event -
               no per-category colors), not an avatar - nearly every entry is
               the same one officer, so an avatar per row carried no
               information. The avatar moved to the actor's name instead.
               Title is short (see splitHistoryAction); everything else sits
               in a bordered detail box with a rounded blue bar on its left.
               Actor / date / time each get their own line, with generous
               spacing between entries. -->
          <template v-for="section in historySections" :key="section.label">
          <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-4 first:mt-0 mt-2">{{ section.label }}</div>
          <div v-for="({ h, timeOnly }, i) in section.entries" :key="section.label + i" class="flex gap-3.5">
            <div class="flex flex-col items-center shrink-0">
              <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 size-8" :title="HISTORY_CATEGORY_META[h.category].label">
                <UIcon :name="HISTORY_CATEGORY_META[h.category].icon" class="size-4" />
              </span>
              <div v-if="i < section.entries.length - 1" class="w-px flex-1 my-2 bg-gray-200 dark:bg-gray-700" />
            </div>
            <div class="flex-1 min-w-0 pb-8">
              <!-- Title left, timestamp right, with a fixed gap between them;
                   a long title wraps to a second line rather than running up
                   against the timestamp. -->
              <div class="flex items-start justify-between gap-6 pt-1.5">
                <p class="flex-1 min-w-0 text-sm font-semibold text-highlighted leading-snug break-words">{{ splitHistoryAction(h.action).title }}</p>
                <div class="shrink-0 text-right text-xs leading-snug whitespace-nowrap">
                  <span v-if="timeOnly" class="text-muted">{{ splitWhen(h.when).time || splitWhen(h.when).date }}</span>
                  <template v-else>
                    <span class="text-muted">{{ splitWhen(h.when).date }}</span>
                    <template v-if="splitWhen(h.when).time"><span class="text-muted"> &middot; {{ splitWhen(h.when).time }}</span></template>
                  </template>
                </div>
              </div>
              <div v-if="splitHistoryAction(h.action).detail" class="relative mt-2.5 rounded-lg border border-default bg-default py-2.5 pr-3 pl-5">
                <span class="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 rounded-full bg-primary/50" />
                <p class="text-xs text-muted leading-relaxed break-words">{{ splitHistoryAction(h.action).detail }}</p>
              </div>
              <div class="flex items-center gap-2 mt-3">
                <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-primary/10 text-primary text-[9px] font-bold size-5">{{ actorInitials(h.actor) }}</span>
                <span class="text-sm font-normal text-muted">{{ actorFullName(h.actor) }}</span>
              </div>
            </div>
          </div>
          </template>
        </div>
        <div v-if="ticket.history.length && !filteredHistory.length" class="text-sm text-dimmed text-center py-8">No {{ HISTORY_CATEGORY_META[activityFilter as HistoryCategory]?.label.toLowerCase() }} activity yet.</div>
        <div v-if="!ticket.history.length" class="text-sm text-dimmed text-center py-8">Nothing recorded yet - this fills in as the ticket moves through its stages.</div>
        </div>
      </template>
    </USlideover>

    <!-- Placeholder Check drawer - every {{TOKEN}} actually used in an
         attached email/form, compared against this specific ticket's real
         data, so an out-of-context placeholder (no ticket data for it, or
         not a recognized field at all) is caught before send instead of
         silently going out blank or filled with generic sample text. -->
    <USlideover v-model:open="placeholderCheckOpen" side="right" inset :ui="{ content: 'w-[calc(100%-1.5rem)] inset-y-3 right-3' }">
      <template #header="{ close }">
        <div class="flex items-start gap-3">
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-x" class="rounded-full shrink-0 mt-0.5" aria-label="Close" @click="close" />
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-highlighted">Placeholder Check</h3>
            <div class="text-xs text-muted mt-0.5">Comparing each placeholder's value against this ticket's own data.</div>
            <!-- Same icon+blue-text treatment as DrawerContextBadge.vue (the
                 Templates > Email editor's own Placeholder Library drawer),
                 so a name shown under a drawer's title reads the same way
                 in both places. -->
            <div class="flex items-center gap-1.5 text-xs font-medium text-primary mt-1 min-w-0">
              <UIcon :name="placeholderCheckIcon" class="size-3.5 shrink-0" />
              <span class="truncate">{{ placeholderCheckTitle }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #body>
        <div v-if="!placeholderCheckEntries.length" class="text-sm text-dimmed text-center py-8">This content has no placeholder tokens to check.</div>
        <div v-else class="flex flex-col">
          <!-- Same sectioning shape as the Templates > Email editor's own
               Placeholder Library drawer (PlaceholderDrawer.vue): a colored
               bar (this group's own status color, not always primary) with
               an uppercase label + solid count badge, then its rows below. -->
          <template v-for="group in placeholderCheckGroups" :key="group.status">
            <div class="flex items-center gap-2 rounded-lg px-3 py-2 mt-4 mb-1.5 first:mt-0" :class="PLACEHOLDER_STATUS_META[group.status].barClass">
              <span class="text-xs font-semibold uppercase tracking-wide" :class="PLACEHOLDER_STATUS_META[group.status].iconClass">{{ PLACEHOLDER_STATUS_META[group.status].label }}</span>
              <UBadge :color="PLACEHOLDER_STATUS_META[group.status].color" variant="solid" size="xs" class="rounded-full">{{ group.entries.length }}</UBadge>
            </div>
            <component
              :is="placeholderCheckSourceEmail ? 'button' : 'div'"
              v-for="entry in group.entries"
              :key="entry.code"
              type="button"
              class="flex items-start gap-2.5 rounded-lg px-2.5 py-2 mb-0.5 text-left w-full"
              :class="placeholderCheckSourceEmail ? 'hover:bg-elevated cursor-pointer' : ''"
              @click="placeholderCheckSourceEmail && locatePlaceholderInPreview(entry.code)"
            >
              <UIcon :name="PLACEHOLDER_STATUS_META[entry.status].icon" class="size-4 shrink-0 mt-0.5" :class="PLACEHOLDER_STATUS_META[entry.status].iconClass" />
              <div class="flex-1 min-w-0">
                <span class="text-xs font-medium text-highlighted">{{ curly(entry.code) }}</span>
                <div class="text-xs text-muted mt-0.5">{{ entry.name }}</div>
                <div v-if="entry.status === 'missing'" class="text-xs text-dimmed mt-1">This ticket has no value for it yet, so the placeholder stays as is.</div>
                <div v-else-if="entry.status === 'unrecognized'" class="text-xs text-dimmed mt-1">Not a recognized placeholder, so it prints blank in the sent document.</div>
                <div v-else-if="entry.status === 'org-constant'" class="text-xs text-dimmed mt-1">Same Asset Team detail on every ticket. Appears as <span class="text-default font-medium">{{ entry.previewValue }}</span></div>
                <div v-else class="text-xs text-dimmed mt-1">Appears in this template as <span class="text-default font-medium">{{ entry.previewValue }}</span></div>
              </div>
              <UTooltip v-if="placeholderCheckSourceEmail" text="Show where this prints in the preview">
                <UIcon name="i-lucide-eye" class="size-3.5 text-dimmed shrink-0 mt-0.5" />
              </UTooltip>
            </component>
          </template>
        </div>
      </template>
    </USlideover>

    <!-- Artifacts Summary drawer - every structured reference/record produced
         on this ticket so far, in one place, instead of having to scan every
         stage by hand to find what's already on file. Same floating/inset
         panel as the Activity Log drawer above. -->
    <USlideover v-model:open="artifactsOpen" side="right" inset :ui="{ content: 'w-[calc(100%-1.5rem)] inset-y-3 right-3' }">
      <template #header="{ close }">
        <div class="flex items-start gap-3">
          <!-- No UTooltip here - a dialog auto-focuses its close button on
               open (a11y), and a Tooltip attached to that same element then
               shows immediately on that programmatic focus, not on a real
               hover (reproduced live: "the tooltip appears the instant the
               drawer opens"). aria-label alone still gives it an accessible
               name without that side effect. items-start pins the close
               button to the top of the header regardless of wrap. -->
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-x" class="rounded-full shrink-0 mt-0.5" aria-label="Close" @click="close" />
          <div>
            <h3 class="text-base font-semibold text-highlighted">Ticket {{ ticket.ticketNumber }} &middot; Artifacts Summary</h3>
            <div class="text-xs text-muted mt-0.5">Everything produced so far - references, endorsements, gate records, sends.</div>
          </div>
        </div>
      </template>
      <template #body>
        <div class="flex flex-col gap-6">
          <!-- Section header matches the Placeholder Library drawer's own
               plain per-group label (Templates > Email editor) - not its
               separate "Used/Not used" banner-with-badge treatment, which
               is a different kind of header for a different purpose there.
               Explicit correction after an earlier pass matched the wrong
               one of the two. -->
          <div v-for="group in artifactGroups" :key="group.title">
            <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-1.5">{{ group.title }}</div>
            <div class="rounded-lg border border-default overflow-hidden">
              <div v-for="(item, i) in group.items" :key="i" :class="{ 'border-t border-default': i > 0 }">
                <!-- A sent message or event: title first, the one-sentence point under it, supporting points
                     as a short list, and who and when on the last line. -->
                <div v-if="item.event" class="p-3.5 flex items-start gap-3">
                  <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UIcon :name="item.event.icon" class="size-4" aria-hidden="true" /></span>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-highlighted">{{ item.event.title }}</div>
                    <p v-if="item.event.summary" class="text-sm text-default mt-0.5">{{ item.event.summary }}</p>
                    <ul v-if="item.event.points.length" class="mt-1.5 flex flex-col gap-1">
                      <li v-for="(pt, pi) in item.event.points" :key="pi" class="flex gap-2 text-sm text-muted"><span class="mt-2 size-1 shrink-0 rounded-full bg-gray-400" aria-hidden="true" /><span>{{ pt }}</span></li>
                    </ul>
                    <div class="text-xs text-muted mt-2">{{ item.event.actor }} &middot; {{ item.event.when }}</div>
                  </div>
                </div>
                <!-- An asset: its name and status together, its tag and serial as short labelled facts. -->
                <div v-else-if="item.asset" class="p-3.5">
                  <div class="flex items-start justify-between gap-3">
                    <span class="text-sm font-semibold text-highlighted">{{ item.asset.name }}</span>
                    <span
                      class="shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium"
                      :class="item.asset.tone === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : item.asset.tone === 'bad' ? 'border-red-200 bg-red-50 text-red-800' : 'border-default bg-gray-100 text-default'"
                    >{{ item.asset.status }}</span>
                  </div>
                  <dl class="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-muted">
                    <div class="flex gap-1.5"><dt>Tag</dt><dd class="font-medium text-default">{{ item.asset.tag }}</dd></div>
                    <div class="flex gap-1.5"><dt>Serial</dt><dd class="font-medium text-default">{{ item.asset.serial }}</dd></div>
                  </dl>
                </div>
                <div v-else class="p-3 flex flex-col gap-0.5">
                  <span class="text-xs text-muted">{{ item.label }}</span>
                  <a v-if="item.url" :href="item.url" target="_blank" class="text-sm text-primary hover:underline flex items-center gap-1"><UIcon name="i-lucide-external-link" class="size-3.5 shrink-0" />{{ item.value }}</a>
                  <span v-else class="text-sm text-highlighted">{{ item.value }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!artifactGroups.length" class="text-sm text-dimmed text-center py-8">Nothing produced yet - this fills in as the ticket moves through its stages.</div>
        </div>
      </template>
      <template #footer>
        <!-- Side by side, equal width - was flex-col + `block` (each
             button full-width, stacked), reported live as wanting these
             two side by side, filling the row evenly rather than sized to
             their own label length. -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center gap-2 w-full">
            <!-- The "this is the exact copy sent" note used to sit as its own
                 always-visible line below the button - moved into an info
                 icon inside the button itself (hover-only tooltip), per
                 explicit ask, since the button's own label already says what
                 it does and this note is supporting detail, not something
                 that needs to stay visible at all times. -->
            <UButton color="primary" variant="outline" icon="i-lucide-printer" class="flex-1 justify-center" :loading="artifactsPrinting" @click="exportArtifactsSummary">
              Export as PDF
              <template #trailing>
                <UTooltip text="This is the exact copy sent to the team member on closure.">
                  <UIcon name="i-lucide-info" class="size-3.5" />
                </UTooltip>
              </template>
            </UButton>
            <UButton color="neutral" variant="outline" icon="i-lucide-history" class="flex-1 justify-center" @click="artifactsOpen = false; openActivityLog()">View Full Activity Log</UButton>
          </div>
          <p v-if="artifactsPrintError" class="text-xs text-error text-center">{{ artifactsPrintError }}</p>
        </div>
      </template>
    </USlideover>

    <!-- Email content preview - the same FullPreviewModal a template's own
         version history previews with (real prose-styled rendering, tokens
         resolved to this ticket's actual data), shared by every
         template-sending stage (A6/B9/A8). -->
    <EmailFullPreviewModal v-model:open="previewOpen" title="Email Preview" :subject="previewSubject" :body="previewBody" />

    <!-- Gate Pass details - the drawer opened from the header's GP reference button. -->
    <!-- Gate Pass details - floating/padded the same way as Artifacts
         Summary/Activity Log (inset + the same content sizing), not a
         flush full-height drawer, per explicit feedback that this one
         wasn't cohesive with those two. Header now carries a real
         title + description (the gate pass type name, then its own
         reference/validity below it, dot-separated) instead of a single
         bare "Gate Pass {ref}" line - same two-line shape as every other
         drawer's own header, so the close button's alignment (already
         correct here) reads as consistent instead of looking mismatched
         against a single-line title. -->
    <USlideover v-model:open="gatePassViewOpen" side="right" inset :ui="{ content: 'w-[calc(100%-1.5rem)] inset-y-3 right-3' }">
      <template #header="{ close }">
        <div class="flex items-start gap-3">
          <!-- No UTooltip here - a dialog auto-focuses its close button on
               open (a11y), and a Tooltip attached to that same element then
               shows immediately on that programmatic focus, not on a real
               hover (reproduced live: "the tooltip appears the instant the
               drawer opens"). aria-label alone still gives it an accessible
               name without that side effect. -->
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-x" class="rounded-full shrink-0 mt-0.5" aria-label="Close" @click="close" />
          <div v-if="activeGatePass">
            <h3 class="text-base font-semibold text-highlighted">{{ GATE_PASS_KIND_LABEL[gatePassKind] }}</h3>
            <div class="text-xs text-muted mt-0.5">{{ activeGatePass.ref }} &middot; Valid until {{ fmtDate(activeGatePass.validUntil) }}</div>
          </div>
        </div>
      </template>
      <template #body>
        <div v-if="activeGatePass" class="flex flex-col gap-6 text-sm">
          <!-- Gate Pass Information - a real bordered table shape (not a
               loose 2-col grid), ported verbatim from the real drawer
               reference ("Ticket Tracker Drawer.html"): Requested By and
               Movement share a row, Movement rendered as a colored pill
               (not a separate banner card), and Purpose is the table's own
               last row rather than a field floating below it. -->
          <div>
            <h4 class="text-sm font-semibold mb-3 text-highlighted">Gate Pass Information</h4>
            <div class="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
              <div class="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
                <div class="p-3 border-r border-gray-200 dark:border-gray-700"><p class="text-xs text-muted">Gate Pass No.</p><p class="text-sm font-medium text-highlighted">{{ activeGatePass.ref }}</p></div>
                <div class="p-3"><p class="text-xs text-muted">Ticket Ref.</p><p class="text-sm font-medium text-highlighted">{{ ticket.reference }}</p></div>
              </div>
              <div class="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
                <div class="p-3 border-r border-gray-200 dark:border-gray-700"><p class="text-xs text-muted">Issued Date</p><p class="text-sm text-highlighted">{{ fmtDate(activeGatePass.issueDate) }}</p></div>
                <div class="p-3"><p class="text-xs text-muted">Valid Until</p><p class="text-sm text-highlighted">{{ fmtDate(activeGatePass.validUntil) }}</p></div>
              </div>
              <div class="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
                <div class="p-3 border-r border-gray-200 dark:border-gray-700"><p class="text-xs text-muted">Team Member</p><p class="text-sm text-highlighted">{{ ticket.employee.name }}</p></div>
                <div class="p-3"><p class="text-xs text-muted">Employee ID</p><p class="text-sm text-highlighted">{{ ticket.employee.id }}</p></div>
              </div>
              <div class="border-b border-gray-200 p-3 dark:border-gray-700"><p class="text-xs text-muted">Dept. / Role</p><p class="text-sm text-highlighted">{{ ticket.employee.dept }}</p></div>
              <div class="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
                <div class="p-3 border-r border-gray-200 dark:border-gray-700"><p class="text-xs text-muted">Requested By</p><p class="text-sm text-highlighted">{{ activeGatePass.requestedBy }}</p></div>
                <div class="p-3">
                  <p class="text-xs text-muted">Movement</p>
                  <div class="mt-1 flex items-center gap-1.5">
                    <span class="font-medium inline-flex items-center text-xs/3 px-1.5 py-1 gap-1 rounded-sm bg-primary/10 text-primary">
                      <span class="truncate">{{ activeGatePass.movement === 'checkin' ? 'Check In' : 'Check Out' }}</span>
                    </span>
                    <span v-if="activeGatePass.time" class="text-xs text-muted">{{ activeGatePass.time }}</span>
                  </div>
                </div>
              </div>
              <div class="p-3"><p class="text-xs text-muted">Purpose</p><p class="text-sm text-highlighted">{{ activeGatePass.purpose || 'Not stated' }}</p></div>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold text-highlighted">Asset Items</h4>
              <span class="text-xs text-muted">{{ activeGatePass.assets.length }} item(s)</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr class="bg-gray-50 dark:bg-gray-800">
                    <th class="px-2 py-1 text-left font-semibold text-muted border border-gray-200 dark:border-gray-700">#</th>
                    <th class="px-2 py-1 text-left font-semibold text-muted border border-gray-200 dark:border-gray-700">Asset Type</th>
                    <th class="px-2 py-1 text-left font-semibold text-muted border border-gray-200 dark:border-gray-700">Asset Tag</th>
                    <th class="px-2 py-1 text-left font-semibold text-muted border border-gray-200 dark:border-gray-700">Serial No.</th>
                    <th class="px-2 py-1 text-left font-semibold text-muted border border-gray-200 dark:border-gray-700">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(a, i) in activeGatePass.assets" :key="a.serial">
                    <td class="px-2 py-1 text-highlighted border border-gray-200 dark:border-gray-700">{{ i + 1 }}</td>
                    <td class="px-2 py-1 text-highlighted border border-gray-200 dark:border-gray-700">{{ a.type }}</td>
                    <td class="px-2 py-1 text-highlighted border border-gray-200 dark:border-gray-700">{{ a.assetTag }}</td>
                    <td class="px-2 py-1 text-highlighted border border-gray-200 dark:border-gray-700">{{ a.serial }}</td>
                    <td class="px-2 py-1 text-muted border border-gray-200 dark:border-gray-700">{{ a.remarks || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Replaces the old on-screen signature-lines block - the real
               drawer never shows signature lines here at all; it points to
               Forms instead, since capturing a wet signature only makes
               sense once the pass is actually printed there. -->
          <div class="rounded-lg p-4 flex gap-2.5 items-start bg-info/10 text-info">
            <UIcon name="i-lucide-info" class="size-5 shrink-0" />
            <div class="text-xs opacity-90">
              To print, capture signatures, or verify via QR, open the gate pass in <span class="font-medium">Forms &rsaquo; Gate Pass.</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <!-- Side by side, equal width (flex-1 on both, not `block`/stacked)
             per explicit feedback on this app's drawer footers generally -
             the two buttons should split the row evenly, not size to their
             own label length. Both open /gate-pass-preview in a new tab
             (target="_blank") rather than navigating this same tab away
             from the ticket - the exact problem raised about the real
             system's own same-tab reload losing the ticket context. -->
        <div class="flex items-center gap-2 w-full">
          <UButton
            :to="`/gate-pass-preview?t=${ticket.ticketNumber}&kind=${gatePassKind}&autoprint=1`" target="_blank"
            color="neutral" variant="outline" icon="i-lucide-printer" class="flex-1 justify-center"
          >
            View / Print
          </UButton>
          <UButton
            :to="`/gate-pass-preview?t=${ticket.ticketNumber}&kind=${gatePassKind}`" target="_blank"
            color="primary" variant="outline" icon="i-lucide-external-link" class="flex-1 justify-center"
          >
            Open in Forms
          </UButton>
        </div>
      </template>
    </USlideover>

    <!-- Closure confirmation modal -->
    <UModal v-model:open="closureOpen" :ui="{ content: 'max-w-lg' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Close Ticket</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <div class="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1 fade-scroll-y">
          <div v-for="(a, i) in ticket.assets" :key="a.serial" class="rounded-md border border-default p-2.5 flex items-center justify-between gap-3 text-sm">
            <span class="font-medium">{{ a.name }}</span>
            <USelect
              v-model="assetResolutions[i]"
              :items="[{ label: 'Returned', value: 'returned' }, { label: 'Send to charging', value: 'charge' }, { label: 'Keep Open', value: 'open' }]"
              size="md"
              class="w-40"
            />
          </div>
        </div>
        <div class="mt-3 rounded-lg border border-default bg-white p-3.5" role="status" aria-live="polite">
          <div class="text-sm font-semibold text-default mb-1.5">What happens next</div>
          <ul class="flex flex-col gap-1.5">
            <li v-for="(n, i) in closureNextSteps" :key="i" class="flex items-start gap-2 text-sm text-default">
              <UIcon :name="n.icon" class="size-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
              <span>{{ n.text }}</span>
            </li>
          </ul>
        </div>
        <label class="flex items-start gap-2 text-sm mt-3">
          <UCheckbox v-model="closureDocumented" class="mt-0.5" />
          <span>Send the team member a detailed closure copy (PDF)<span class="text-xs text-muted block mt-0.5">{{ closureDocumented ? 'Will be sent on close.' : "Leave unchecked and it won't be sent." }}</span></span>
        </label>
        <!-- So confirming closure never means "trust it went out" with no
             way to check - the operator can see exactly what's about to be
             sent right here, instead of having to dig it out of Outlook
             afterward. -->
        <UButton v-if="closureDocumented" color="primary" variant="link" size="xs" class="p-0 mt-1 ml-7" icon="i-lucide-eye" @click="sendPreviewOpen = true">View contents to be sent</UButton>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="closureOpen = false">Not yet</UButton>
          <UButton color="primary" @click="confirmClosure">{{ closureOpensCharge ? 'Open charging case' : 'Close ticket' }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- FR-003.11: change Reason and Mode before the path locks. -->
    <UModal v-model:open="pathChangeOpen" :ui="{ content: 'max-w-lg' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Change reason or mode</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <div class="flex flex-col gap-5">
          <p class="text-sm text-muted">Allowed until a notice is sent, a call is logged or an acknowledgment is captured. The notice email, deadline and steps follow the new reason and mode.</p>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Reason</label>
            <USelect v-model="pathReason" :items="reasonOptions" size="md" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Mode</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors" :class="pathMode === 'onsite' ? 'border-primary bg-primary/5 text-primary' : 'border-default text-default hover:bg-gray-50'" @click="pathMode = 'onsite'">Onsite</button>
              <button type="button" class="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors" :class="pathMode === 'remote' ? 'border-primary bg-primary/5 text-primary' : 'border-default text-default hover:bg-gray-50'" @click="pathMode = 'remote'">Remote</button>
            </div>
            <p v-if="pathReason === 'unexplained-absence'" class="text-xs text-muted mt-1.5">Unexplained Absence is Remote only.</p>
          </div>
          <div v-if="pathReason === 'recalled'">
            <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Recall Effective Date <span class="text-red-600">*</span></label>
            <SharedDatePicker v-model="pathRecallDate" size="md" />
          </div>
          <div v-if="pathPreview" class="rounded-lg border border-default bg-gray-50 px-4 py-3 flex flex-col gap-1 text-sm">
            <div class="flex justify-between gap-4"><span class="text-muted">Deadline counted from</span><span class="font-medium text-default text-right">{{ pathPreview.path.anchor }}</span></div>
            <div class="flex justify-between gap-4"><span class="text-muted">Notice email</span><span class="font-medium text-default text-right">{{ pathPreview.template }}</span></div>
            <div class="flex justify-between gap-4"><span class="text-muted">Target date</span><span class="font-medium text-default text-right">{{ pathPreview.target ? fmtDate(pathPreview.target) : 'Set once assets are confirmed' }}</span></div>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Reason for this change <span class="text-red-600">*</span></label>
            <UTextarea v-model="pathNote" :rows="2" class="w-full" placeholder="Why is the path changing?" @update:model-value="pathError = ''" />
            <p v-if="pathError" class="text-xs text-red-600 mt-1.5">{{ pathError }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="pathChangeOpen = false">Keep current</UButton>
          <UButton color="primary" @click="doChangePath">Apply change</UButton>
        </div>
      </template>
    </UModal>

    <!-- FR-003.11: any Asset Team user may take a ticket over, with the handover recorded. -->
    <UModal v-model:open="takeoverOpen" :ui="{ content: 'max-w-md' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Take over this ticket</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <p class="text-sm text-default mb-4">This ticket moves from <strong>{{ ticket?.assignee.name }}</strong> to <strong>{{ currentUserName() }}</strong>. The handover goes on record.</p>
        <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Handover note <span class="text-red-600">*</span></label>
        <UTextarea v-model="takeoverNote" :rows="3" class="w-full" placeholder="Where things stand and what needs doing next" @update:model-value="takeoverError = ''" />
        <p v-if="takeoverError" class="text-xs text-red-600 mt-1.5">{{ takeoverError }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="takeoverOpen = false">Not now</UButton>
          <UButton color="primary" @click="doTakeover">Take over ticket</UButton>
        </div>
      </template>
    </UModal>

    <!-- FR-003.11: a retracted resignation or reversed recall closes the case with no retrieval. -->
    <UModal v-model:open="cancelOpen" :ui="{ content: 'max-w-md' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Cancel retrieval</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <p class="text-sm text-default mb-4">The case closes with no retrieval and the assets are no longer pending return. This is recorded, not deleted.</p>
        <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Why is it cancelled?</label>
        <USelect v-model="cancelReason" :items="cancelReasonOptions" size="md" class="w-full mb-4" />
        <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Note <span class="text-red-600">*</span></label>
        <UTextarea v-model="cancelNote" :rows="3" class="w-full" placeholder="What confirmed it, and who confirmed it" @update:model-value="cancelError = ''" />
        <p v-if="cancelError" class="text-xs text-red-600 mt-1.5">{{ cancelError }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="cancelOpen = false">Keep ticket</UButton>
          <UButton color="error" @click="doCancel">Cancel retrieval</UButton>
        </div>
      </template>
    </UModal>

    <!-- Saved checklists: name and save the ticket's list as a template. -->
    <UModal v-model:open="saveTemplateOpen" :ui="{ content: 'max-w-md' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Save as template</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <!-- Matched to the other ticket modals (takeover, cancel, path change):
             the same uppercase/tracking label style and body spacing. -->
        <label for="save-template-name" class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-1.5">Template name <span class="text-red-600">*</span></label>
        <UInput id="save-template-name" v-model="saveTemplateName" placeholder="e.g. Remote resignation checklist" size="md" class="w-full" autofocus @keyup.enter="doSaveTemplate" @update:model-value="saveTemplateError = ''" />
        <p v-if="saveTemplateError" class="text-xs text-red-600 mt-1.5">{{ saveTemplateError }}</p>
        <p v-else class="text-xs text-muted mt-1.5">{{ ticket?.checklistItems.length ?? 0 }} task{{ (ticket?.checklistItems.length ?? 0) === 1 ? '' : 's' }}<template v-if="ticket"> &middot; {{ REASON_LABELS[ticket.reason] }}<template v-if="ticket.mode"> ({{ ticket.mode === 'onsite' ? 'Onsite' : 'Remote' }})</template></template></p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="saveTemplateOpen = false">Not now</UButton>
          <UButton color="primary" @click="doSaveTemplate">Save checklist</UButton>
        </div>
      </template>
    </UModal>

    <!-- Saved checklists: pick one to start from. Editing them lives in Master Data. -->
    <UModal v-model:open="useTemplateOpen" :ui="{ content: 'max-w-lg' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Saved checklists</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <SharedBanner v-if="templateToReplaceWith" tone="warning" class="mb-3" title="Replace the current checklist?">
          "{{ templateToReplaceWith.name }}" starts fresh, so the items already checked off on this ticket are cleared.
          <template #actions>
            <UButton size="xs" color="primary" @click="useChecklistTemplate(templateToReplaceWith)">Replace checklist</UButton>
            <UButton size="xs" color="neutral" variant="outline" @click="templateToReplaceWith = null">Keep current</UButton>
          </template>
        </SharedBanner>
        <div class="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1 fade-scroll-y">
          <div v-for="t in checklistTemplates" :key="t.id" class="rounded-lg border border-default px-3.5 py-2.5 flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-default truncate">{{ t.name }}</div>
              <!-- Description is now the task count and the path the template covers, nothing else (user feedback 5 Oct 2026, 3rd pass). -->
              <div class="text-xs text-muted truncate">{{ t.tasks.length }} task{{ t.tasks.length === 1 ? '' : 's' }} &middot; {{ formatChecklistTemplatePath(t.defaultFor) }}</div>
            </div>
            <UButton size="xs" color="primary" variant="soft" @click="chooseChecklistTemplate(t)">Use</UButton>
          </div>
        </div>
        <NuxtLink to="/master-data/offboarding-checklists" class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Manage templates in Master Data <UIcon name="i-lucide-arrow-up-right" class="size-3.5" aria-hidden="true" /></NuxtLink>
      </template>
    </UModal>

    <!-- Read-only preview of exactly what "Send the team member a detailed
         closure copy" above will produce - same content buildTicketRecordHtml
         renders for the real PDF export, just shown inline instead of
         triggering a print. -->
    <!-- Read as the team member will receive it: an Outlook-style message
         (sender, recipients, subject, date, the PDF attachment, a short
         note) with the attached record previewed underneath on a letterhead
         page - the same HTML the PDF export prints. -->
    <UModal v-model:open="sendPreviewOpen" :ui="{ content: 'max-w-3xl max-h-[88vh] flex flex-col', body: 'p-0 sm:p-0 flex flex-col min-h-0' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 flex-1 min-w-0">
          <UIcon name="i-lucide-mail" class="text-primary size-5" />
          {{ ticket?.status === 'closed' ? 'Sent copy' : 'Contents to be sent' }}
        </h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <div v-if="ticket" class="flex-1 min-h-0 overflow-y-auto fade-scroll-y">
          <div class="px-6 pt-5 pb-4 border-b border-default">
            <h3 class="text-lg font-semibold text-highlighted">Your equipment return is complete, Ticket {{ ticket.ticketNumber }}</h3>
            <div class="flex items-start gap-3 mt-4">
              <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-primary text-white size-10 text-sm font-bold">AM</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-highlighted">Asset Management Team <span class="font-normal text-muted">&lt;{{ SAMPLE_VALUES.ASSET_TEAM_EMAIL }}&gt;</span></div>
                    <div class="text-xs text-muted mt-1"><span class="text-dimmed">To:</span> {{ ticket.employee.name }} &lt;{{ ticket.employee.email }}&gt;</div>
                    <div class="text-xs text-muted mt-0.5"><span class="text-dimmed">Cc:</span> {{ SAMPLE_VALUES.ASSET_TEAM_EMAIL }}</div>
                  </div>
                  <span class="shrink-0 text-xs text-muted whitespace-nowrap">{{ whenDot(closureSentWhen) }}</span>
                </div>
              </div>
            </div>
            <!-- attachment -->
            <button type="button" class="mt-4 inline-flex items-center gap-3 rounded-lg border border-default bg-white px-3 py-2 text-left hover:bg-gray-50 transition-colors" @click="exportTeamMemberCopy">
              <span class="inline-flex items-center justify-center size-8 rounded-md bg-red-50 text-red-600 shrink-0"><UIcon name="i-lucide-file-text" class="size-4.5" /></span>
              <span class="min-w-0">
                <span class="block text-sm font-medium text-default truncate">Equipment-Return-Closure-Record-{{ ticket.ticketNumber }}.pdf</span>
                <span class="block text-xs text-muted">PDF &middot; Click to download</span>
              </span>
              <UIcon name="i-lucide-download" class="size-4 text-muted shrink-0" />
            </button>
          </div>
          <div class="px-6 py-5 text-sm text-default leading-relaxed">
            <p>Hi {{ ticket.employee.name.split(' ')[0] }},</p>
            <p class="mt-3">Your equipment return is complete and this ticket is now closed. Your closure record is attached for your reference. Please keep a copy for your files.</p>
            <p class="mt-3">If anything in the record looks wrong, reply to this email or contact us at {{ SAMPLE_VALUES.ASSET_TEAM_EMAIL }}.</p>
            <p class="mt-3">Thank you,<br>Asset Management Team</p>
          </div>
          <!-- attachment preview -->
          <div class="px-6 pb-6">
            <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-2">Attachment preview</div>
            <div class="rounded-lg bg-gray-100 p-4 sm:p-6">
              <div class="mx-auto max-w-[640px] bg-white shadow-sm ring-1 ring-black/5 rounded-sm px-8 py-7">
                <div class="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-default">
                  <div class="text-xs leading-snug text-muted" v-html="closureLetterhead.headerLeft" />
                  <div class="text-xs leading-snug text-muted text-right" v-html="closureLetterhead.headerRight" />
                </div>
                <div class="closure-record" v-html="buildTicketRecordHtml(ticket)" />
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end w-full">
          <UButton color="neutral" variant="outline" @click="sendPreviewOpen = false">Close</UButton>
        </div>
      </template>
    </UModal>
  </div>

  <!-- Artifacts Summary print target - see exportArtifactsSummary() above.
       Teleported straight to <body> (same portal layer USlideover/UModal
       already use) so it sits outside this page's own root entirely - the
       print-only CSS below only needs to hide "everything that isn't this"
       via a body-level class toggle, not thread a print-area wrapper through
       this page's own large, pre-existing template. -->
  <Teleport to="body">
    <div v-show="artifactsPrinting" ref="artifactsPrintRoot" class="artifacts-print-root" />
  </Teleport>
</template>

<style>
/* Only this page needs print rules - see exportArtifactsSummary() above.
   Scoped via the .artifacts-printing body class (toggled only while an
   export is in flight) rather than always-on print rules, so this page's
   own print CSS can never leak into some other page's print output. */
@media print {
  body.artifacts-printing > *:not(.artifacts-print-root) {
    display: none !important;
  }
  /* The gray backdrop below is only for the on-screen page preview; on the
     printed/PDF sheet everything is plain white. */
  html, body.artifacts-printing,
  body.artifacts-printing .artifacts-print-root,
  body.artifacts-printing .pagedjs_page,
  body.artifacts-printing .pagedjs_sheet {
    background: #ffffff !important;
  }
  body.artifacts-printing .artifacts-print-root { gap: 0 !important; min-height: 0 !important; }
}
.artifacts-print-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  background: #E5E7EB;
  min-height: 100vh;
}
</style>
