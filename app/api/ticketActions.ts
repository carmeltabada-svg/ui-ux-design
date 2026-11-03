// PROTOTYPE ONLY: delete this file with `app/mocks/` and `api/mock.ts` when the real backend is
// connected (see docs/retrieval/BACKEND_SWAP.md). These are the rules the server owns for a ticket:
// each function takes a ticket, changes it, writes its history line, and may say no. In
// production they are the backend's. The browser only asks for them by name, through
// `api().tickets.act()`, and shows the answer. `ACTIONS` at the bottom is that list of
// names and the arguments each one takes: it is the specification for the endpoints.
import {
  CANCELLATION_REASON_LABELS, TICKETS, GATE_PASS_KIND_LABEL, GATE_STEPS, REASON_LABELS, SKIP_STAGES, STAGE_NAMES, addCalendarDays, assetTeamMemberByName, checklistProgress, computeTargetDateForPath, courierProviderById, currentUserName, doneByList, isOverdueReturn, localISO, optionalFlags, parseLocalDate, pathChangeLockReasons, pushHistory, raiseNotification, resolvedPathFor, stageListFor, type CancellationReason, type GatePass, type GatePassKind, type StageKey, type Ticket, type TicketMode, type TicketReason, currentStageKey, DEDUCTION_OUTCOME_META, INSPECTION_ROUTE_STATUS, type TicketFileRef, type DeductionOutcome, type InspectionRoute
} from '~/data/ticketTrackers'
import { type ChecklistTask } from '~/data/checklistTemplates'
import type { TicketActionName } from '~/api/types'

/** Ticks or unticks a task and remembers who did it. */
function setChecklistDone(ticket: Ticket, index: number, done: boolean, actor = currentUserName()) {
  if (index < 0 || index >= ticket.checklistItems.length) return
  ticket.checklistDone[index] = done
  doneByList(ticket)[index] = done ? actor : null
}

/** Adds a new item to this ticket's own checklist - appended, unchecked, required unless said otherwise. No-op on blank text. */
function addChecklistItem(ticket: Ticket, text: string, optional = false) {
  const trimmed = text.trim()
  if (!trimmed) return
  optionalFlags(ticket).push(optional)
  doneByList(ticket).push(null)
  ticket.checklistItems.push(trimmed)
  ticket.checklistDone.push(false)
  pushHistory(ticket, `Offboarding checklist item added: "${trimmed}"`, 'checklist')
}

/** Removes an item by index. The tasks, their done flags and their optional flags are kept 1:1, so all three are spliced together. */
function removeChecklistItem(ticket: Ticket, index: number) {
  if (index < 0 || index >= ticket.checklistItems.length) return
  const [removed] = ticket.checklistItems.splice(index, 1)
  ticket.checklistDone.splice(index, 1)
  optionalFlags(ticket).splice(index, 1)
  doneByList(ticket).splice(index, 1)
  pushHistory(ticket, `Offboarding checklist item removed: "${removed}"`, 'checklist')
}

/** Switches a task between required and optional. */
function toggleChecklistRequired(ticket: Ticket, index: number) {
  const flags = optionalFlags(ticket)
  if (index < 0 || index >= ticket.checklistItems.length) return
  flags[index] = !flags[index]
  pushHistory(ticket, `Offboarding checklist item set to ${flags[index] ? 'optional' : 'required'}: "${ticket.checklistItems[index]}"`, 'checklist')
}

/** Trims task text and drops blank tasks; shared with the checklist template rules in mock.ts. */
export const cleanTasks = (tasks: ChecklistTask[]) => tasks.map(t => ({ text: t.text.trim(), required: t.required })).filter(t => t.text)

/**
 * Replaces this ticket's checklist with the tasks of a saved template, as fresh unchecked items.
 * It is a copy, not a link: later edits to the template never reach this ticket, and any progress on
 * the list being replaced is dropped (the caller confirms that first when there is some).
 */
function applyChecklistTemplate(ticket: Ticket, templateName: string, tasks: ChecklistTask[]) {
  const clean = cleanTasks(tasks)
  ticket.checklistItems = clean.map(t => t.text)
  ticket.checklistDone = clean.map(() => false)
  ticket.checklistOptional = clean.map(t => !t.required)
  ticket.checklistDoneBy = clean.map(() => null)
  pushHistory(ticket, `Offboarding checklist loaded from template: "${templateName}" (${clean.length} items)`, 'checklist')
}

/** Moves a checklist item from one position to another (drag-to-reorder, or the Move up/down fallback). The three lists stay 1:1, so they move together. No-op for an out-of-range index. */
function reorderChecklistItem(ticket: Ticket, from: number, to: number) {
  const max = ticket.checklistItems.length - 1
  if (from < 0 || from > max || to < 0 || to > max || from === to) return
  const [item] = ticket.checklistItems.splice(from, 1)
  ticket.checklistItems.splice(to, 0, item!)
  const [done] = ticket.checklistDone.splice(from, 1)
  ticket.checklistDone.splice(to, 0, done!)
  const flags = optionalFlags(ticket)
  const [opt] = flags.splice(from, 1)
  flags.splice(to, 0, !!opt)
  const by = doneByList(ticket)
  const [who] = by.splice(from, 1)
  by.splice(to, 0, who ?? null)
}

/**
 * Signs off the final review (who, when, optional note) and moves the ticket
 * on. Only once every required task is done. A note is captured when the
 * reviewer wants to record context ("waiver on item 3 agreed with ops lead"),
 * kept with the sign-off record and shown with the signed-off banner.
 */
function finalizeChecklist(ticket: Ticket, actor = currentUserName(), noteText?: string): { ok: true } | { ok: false, error: string } {
  if (ticket.checklistReview) return { ok: false, error: 'The final review is already signed off.' }
  if (!checklistProgress(ticket).ready) return { ok: false, error: 'Do every required task first.' }
  const note = noteText?.trim() || undefined
  ticket.checklistReview = { by: actor, at: new Date().toISOString(), note }
  pushHistory(
    ticket,
    note ? `Offboarding checklist completed, with reviewer note: ${note}` : 'Offboarding checklist completed',
    'checklist',
    actor
  )
  advanceStage(ticket)
  return { ok: true }
}

function advanceStage(ticket: Ticket) {
  ticket.overdueForced = false
  const list = stageListFor(ticket.mode)
  ticket.stageIdx = Math.min(ticket.stageIdx + 1, list.length - 1)
  ticket.furthestStageIdx = Math.max(ticket.furthestStageIdx ?? 0, ticket.stageIdx)
}

/** Confirms the asset list at A5 - locks it read-only and derives the Target Date from the resolved path's matrix deadline rule (FR-003.8d). */
function confirmAssets(ticket: Ticket) {
  ticket.assetsLocked = true
  const resolved = computeTargetDateForPath(ticket)
  if (resolved) {
    ticket.targetDateISO = resolved
  } else if (!resolvedPathFor(ticket.reason, ticket.mode) && ticket.lwd) {
    // Defensive fallback for a reason/mode combo with no rule at all - not
    // currently reachable by any modeled path (Unexplained Absence's null
    // path is P12's Onsite, which is never offered, not created), kept as a
    // backstop rather than leaving targetDateISO unset with no explanation.
    ticket.targetDateISO = addCalendarDays(ticket.lwd, 7)
  }
  const confirmedCount = ticket.assets.filter(a => a.checked).length
  pushHistory(ticket, `Asset list confirmed (${confirmedCount} of ${ticket.assets.length}) - locked, status moves to Pending Return`, 'asset')
  advanceStage(ticket)
}

/**
 * FR-003.8a - the Target Date re-baseline engine. Editing the Target Date is
 * not a field update: every scheduled item on the ticket hangs off it, so
 * this recalculates rather than leaving the ticket inconsistent. Concretely:
 * daysLeftLabel/isOverdueReturn below both read targetDateISO live, so once
 * it changes here, the countdown, the Overdue Return status, and the
 * Overview's Return Deadline column all recompute automatically on their own
 * next render - nothing else needs a manual sync for those. What genuinely
 * needs an explicit write is the audit trail (ref c: actor/timestamp/reason
 * required, previous value preserved) and clearing the legacy manual
 * overdueForced flag so a demo/seeded ticket doesn't keep forcing Overdue
 * Return after a correction (ref b: a re-baseline is a correction, not a
 * waiver - the original lapse still gets recorded below, just not left
 * forcing the status forward).
 *
 * FR-003.8a(f)'s downstream-dependency flag (e.g. a scheduled IT lock that
 * no longer matches the new date) is intentionally not wired here: in this
 * app's data model, IT lock scheduling (A4) keys off the Last Working Day,
 * not the Target Date, so a Target-Date-only edit has no downstream
 * schedule to desync today. That hook belongs on a future Last Working Day
 * amendment flow (ref d), not this one.
 */
function rebaselineTargetDate(ticket: Ticket, newDateISO: string, reason: string, actor = currentUserName()) {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('A reason is required to change the Target Date.')
  if (!newDateISO) throw new Error('A new Target Date is required.')
  // Nothing to re-baseline: never write an "Oct 6 to Oct 6" entry into the history.
  if (newDateISO === ticket.targetDateISO) return

  const wasOverdue = isOverdueReturn(ticket)
  const previousDateISO = ticket.targetDateISO

  ticket.targetDateHistory.push({ previousDateISO, newDateISO, reason: trimmedReason, actor, when: new Date().toISOString(), wasOverdue })
  ticket.targetDateISO = newDateISO
  ticket.overdueForced = false

  const fmt = (iso: string | null) => iso ? parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'not set'
  pushHistory(
    ticket,
    `Target Date re-baselined: ${fmt(previousDateISO)} -> ${fmt(newDateISO)} (reason: ${trimmedReason})${wasOverdue ? ' - ticket was in Overdue Return at the time of this change; that lapse remains on record' : ''}`,
    'rebaseline',
    actor
  )
}

/**
 * Clears the ticket-level "needs attention" flag (Overview badge, sidebar
 * count) and records a real acknowledged-at timestamp - the Activity Log
 * entry for the original change stays regardless, this only records that
 * it's been seen and, where applicable, that the resulting IT lock flag
 * still needs the operator's own follow-up action (see itLockNeedsReschedule
 * - acknowledging the notice and resolving the lock are two separate
 * confirmations, not one bare dismissal).
 */
function acknowledgeHrisUpdate(ticket: Ticket) {
  const acknowledgedAt = new Date().toISOString()
  ticket.hrisUpdatePending = false
  ticket.hrisUpdateAcknowledgedAt = acknowledgedAt
  pushHistory(
    ticket,
    `Employee record update acknowledged${ticket.itLockNeedsReschedule ? ' - IT still needs the new date for the access lock' : ''}`,
    'hris',
    currentUserName(),
    acknowledgedAt
  )
}

/**
 * Records a gate release - FR-003.5's own definition of the "recorded event"
 * element is deliberately light: "a dated entry with the recording actor.
 * Until it exists, the gate is closed." It does not require a reference
 * number or an uploaded document - an earlier pass over-built this into a
 * required-file gate, which was a real, corrected misstep, not the spec.
 * `note` is optional context (what P&C actually said/via what channel), never
 * a precondition for the button being enabled.
 */
function releaseGate(ticket: Ticket, gateN: number, note?: string) {
  ticket.gatesReleased = gateN
  ticket.gateNotes[gateN] = note?.trim() || 'Recorded'
  ticket.gateReleaseDates[gateN] = localISO(new Date())
  const step = GATE_STEPS.find(g => g.n === gateN)
  pushHistory(ticket, `Gate ${gateN} recorded${note?.trim() ? ` (${note.trim()})` : ''} - ${step?.unlocks ?? ''}`, 'gate')
  // Unexplained Absence's Target Date anchors on Gate 3 release
  // (determination), not LWD - only resolvable once this actually fires,
  // and only if assets were already confirmed by then (see confirmAssets).
  if (gateN === 3 && ticket.assetsLocked && !ticket.targetDateISO) {
    const resolved = computeTargetDateForPath(ticket)
    if (resolved) ticket.targetDateISO = resolved
  }
}

/**
 * Moves the ticket's stage pointer back one real step, e.g. after an
 * operator realizes they advanced too soon. Floors naturally at A3:
 * stepping back into A1/A2 just gets resolved forward again by
 * currentStageKey() since those are marked skip (already-logged entry steps,
 * never re-clickable).
 *
 * Walks past any skip-stage it lands on, same as currentStageKey() does
 * going forward - a naive single decrement is not enough wherever a skip
 * stage sits immediately before the current one (B11a, between B11 and A9,
 * is exactly this case): landing on B11a's index, currentStageKey()'s own
 * forward-skip resolution would immediately walk it right back to A9,
 * making Back a complete no-op from A9 - reproduced exactly this way.
 */
function goBackStage(ticket: Ticket) {
  const list = stageListFor(ticket.mode)
  let idx = Math.max(0, ticket.stageIdx - 1)
  while (idx > 0 && SKIP_STAGES.includes(list[idx]!)) idx--
  ticket.stageIdx = idx
}

/** Steps forward again after a goBackStage, up to the furthest stage this ticket has actually completed - never further, so this can't be used to skip a stage that hasn't been done. */
function goForwardStage(ticket: Ticket) {
  if (ticket.stageIdx >= (ticket.furthestStageIdx ?? 0)) return
  ticket.stageIdx += 1
}

/**
 * Direct jump to a specific stage - the phase tracker's clickable phase
 * nodes and its hover popover's own step rows use this instead of stepping
 * one at a time via goBackStage/goForwardStage. Bounded the exact same way
 * goForwardStage already is - never past furthestStageIdx, so this can't be
 * used to skip ahead of a stage that hasn't actually been completed yet. A
 * no-op if the target is already the current stage.
 */
function jumpToStage(ticket: Ticket, target: StageKey) {
  const list = stageListFor(ticket.mode)
  const idx = list.indexOf(target)
  if (idx === -1) return
  const bounded = Math.min(idx, ticket.furthestStageIdx ?? 0)
  if (bounded === ticket.stageIdx) return
  ticket.stageIdx = bounded
  pushHistory(ticket, `Jumped to ${STAGE_NAMES[list[bounded]!]}`, 'navigation')
}

/** Marks a custodian contact field as verified directly (an explicit operator action - e.g. they reached the team member through some other channel), independent of the A7 call-confirmation auto-verify path. */
function verifyContact(ticket: Ticket, field: 'number' | 'email') {
  if (field === 'number') ticket.contact.numberVerified = true
  else ticket.contact.emailVerified = true
  pushHistory(ticket, `${field === 'number' ? 'Contact number' : 'Personal email'} manually confirmed active`, 'contact')
}

/** Records a correction to the team member's contact number for this ticket. The number comes from the employee record; a correction here is no longer "confirmed active" until re-verified. Pass null/empty to clear it. */
function setContactNumber(ticket: Ticket, number: string | null) {
  const trimmed = number && number.trim() ? number.trim() : null
  const had = !!ticket.contact.number
  ticket.contact.number = trimmed ?? ''
  // A corrected or newly-entered number has not been confirmed reachable yet.
  ticket.contact.numberVerified = false
  pushHistory(ticket, trimmed
    ? `Contact number ${had ? 'corrected' : 'added'} for this ticket: ${trimmed}`
    : 'Contact number cleared for this ticket', 'contact')
}

/** Records a correction to the team member's on-file address for this ticket only - never mutates employee.address (R24 hard-truth, see HrisRecord). Pass null to clear the override and fall back to the R24 address again. */
function setTeamMemberAddressOverride(ticket: Ticket, address: string | null) {
  ticket.teamMemberAddressOverride = address && address.trim() ? address.trim() : null
  pushHistory(ticket, ticket.teamMemberAddressOverride
    ? `Team member address corrected for this ticket: ${ticket.teamMemberAddressOverride}`
    : 'Team member address correction cleared - reverted to the address on file', 'contact')
}

function confirmCourierBranch(ticket: Ticket, providerId: string, branchName: string, branchAddress: string, captureMethod: 'call' | 'email', substituted = false) {
  ticket.courierProviderId = providerId
  ticket.courierBranchName = branchName
  ticket.courierBranchAddress = branchAddress
  ticket.courierBranchSubstituted = substituted
  ticket.branchCaptureMethod = captureMethod
  const provider = courierProviderById(providerId)
  const via = captureMethod === 'call' ? 'via confirmation call' : 'via email reply'
  pushHistory(ticket, substituted
    ? `Courier branch substituted from address on file (team member non-response): ${provider?.name ?? providerId}, ${branchName}, ${branchAddress}`
    : `Courier branch confirmed ${via}: ${provider?.name ?? providerId}, ${branchName}, ${branchAddress}`, 'branch')
  advanceStage(ticket)
}

/** FR-003.9(a): the retrieval instructions request the preferred courier, exact branch name and branch address, with a reply requested within 1 business day - this records when that request actually went out, so "within 1 business day" has a real anchor instead of being an unenforced sentence in the notice copy. */
function sendBranchRequest(ticket: Ticket, templateKey: string | null = null) {
  ticket.branchRequestSentAt = new Date().toISOString()
  ticket.branchRequestTemplateKey = templateKey
  ticket.branchRequestReplyReceived = false
  ticket.branchReplyDetectedAt = null
  pushHistory(ticket, 'Branch confirmation request sent to team member - reply requested within 1 business day', 'send')
}

/** FR-003.12: the operator's own sent-confirmation for a companion SMS, clicked once the text has actually gone out from their phone. Recorded on the Activity Log with actor and time. */
function confirmSmsSentFor(ticket: Ticket, code: string, label: string) {
  if (ticket.smsSent?.[code]) return
  ticket.smsSent = { ...(ticket.smsSent ?? {}), [code]: new Date().toISOString() }
  pushHistory(ticket, `SMS sent to the team member (${label})`, 'send')
}

/**
 * Manually confirms the team member's email reply has been read. This app
 * has no live inbox integration (Outlook/Graph API or similar), so there is
 * no automatic way to detect a reply landed - the same limitation this
 * module already accepts for SMS (FR-003.12: "manual sent-confirmation
 * control, clicked by the operator once the message has actually gone").
 * A confirmation call doesn't need this at all since the operator is on the
 * line when it happens; only the email fallback path is ever actually
 * pending.
 */
function markBranchReplyReceived(ticket: Ticket) {
  ticket.branchRequestReplyReceived = true
  pushHistory(ticket, 'Team member email reply confirmed read', 'branch')
}

/** Records the B11 Confirm In Transit handoff, capturing the courier/tracking reference per FR-003.9's Remote table ("Captures courier and tracking or reference number"). Also anchors B11a's 14-day delay flag and halts the Overdue Return countdown (FR-003.6: "Halts the Overdue Return countdown") - see isTransitDelayed/isOverdueReturn, both of which key off hasReachedStage(ticket, 'B11'). */
function confirmInTransit(ticket: Ticket, trackingNumber: string, trackingLink = '') {
  ticket.trackingNumber = trackingNumber
  ticket.trackingLink = trackingLink
  ticket.transitTrackingRef = trackingLink || trackingNumber
  ticket.transitConfirmedAt = localISO(new Date())
  pushHistory(ticket, `Marked In Transit - tracking number: ${trackingNumber || 'not provided'}${trackingLink ? ', tracking link added' : ''}`, 'transit')
  advanceStage(ticket)
}

/** Saves or edits the tracking number and link from the Courier & Shipping card without moving the stage: the shipment is filled in as details arrive, and only B11's own button confirms the handoff. */
function saveShipmentDetails(ticket: Ticket, trackingNumber: string, trackingLink: string) {
  const had = !!(ticket.trackingNumber || ticket.trackingLink || ticket.transitTrackingRef)
  ticket.trackingNumber = trackingNumber
  ticket.trackingLink = trackingLink
  ticket.transitTrackingRef = trackingLink || trackingNumber
  pushHistory(ticket, `Tracking details ${had ? 'updated' : 'added'}: ${trackingNumber ? `number ${trackingNumber}` : 'no number'}${trackingLink ? ', link saved' : ''}`, 'transit')
}

/**
 * A4: tells IT that this team member's access must be locked when their last shift ends. Locking access is IT's job, not the
 * Asset Team's, so this is a notice and never a gate: nothing waits on IT, and there is no "executed" confirmation here.
 * `scheduledConfirmed` now means "IT was notified". It moves the ticket on only when the ticket is still at A4, so
 * telling IT about a changed Last Working Day later does not skip a stage.
 */
function notifyItLock(ticket: Ticket) {
  const again = ticket.itLock.scheduledConfirmed
  ticket.itLock.scheduledConfirmed = true
  ticket.itLock.scheduledFor = ticket.lwd
  ticket.itLockNeedsReschedule = false
  pushHistory(ticket, `IT notified to lock access at the end of the last shift on ${ticket.lwd || 'the Last Working Day'}${again ? ' (sent again for the updated Last Working Day)' : ''}. The lock is IT's responsibility`, 'itlock')
  if (currentStageKey(ticket) === 'A4') advanceStage(ticket)
}

/** A4: moves on without telling IT. Allowed because the lock is IT's responsibility and never blocks the retrieval. */
function skipItNotice(ticket: Ticket) {
  pushHistory(ticket, "Continued without notifying IT. The access lock is IT's responsibility", 'itlock')
  if (currentStageKey(ticket) === 'A4') advanceStage(ticket)
}

/**
 * Issues a Gate Pass against this ticket - a deliberate operator action
 * with real form content (FR-003.11), never an automatic side effect of
 * viewing the ticket. `assets` and the team-member fields are expected to
 * already be pre-filled from the ticket by the caller; this just stamps a
 * reference, records it, and writes the audit-trail entry. `kind` picks
 * which of the ticket's two independent gate pass records this writes to
 * (see buildingGatePassRef/buildingGatePass's own comment on Ticket).
 */
function issueGatePass(ticket: Ticket, input: Omit<GatePass, 'ref'>, kind: GatePassKind = 'goteam'): GatePass {
  // The next number comes from the passes that exist, so one is never reused.
  const refs = Object.values(TICKETS).flatMap(t => [t.gatePass?.ref, t.buildingGatePass?.ref]).filter((r): r is string => !!r)
  const seq = Math.max(100000, ...refs.map(r => Number(r.slice(r.lastIndexOf('-') + 1)) || 0)) + 1
  const pass: GatePass = { ref: `GP-2026-${seq}`, ...input }
  if (kind === 'building') {
    ticket.buildingGatePass = pass
    ticket.buildingGatePassRef = pass.ref
  } else {
    ticket.gatePass = pass
    ticket.gatePassRef = pass.ref
  }
  pushHistory(ticket, `${GATE_PASS_KIND_LABEL[kind]} issued - ${pass.ref} (${pass.movement === 'checkin' ? 'Check In' : 'Check Out'})`, 'gatepass', input.requestedBy)
  return pass
}

/**
 * Changes Reason and Mode before the path is locked, and re-resolves everything
 * the path derives: the notice template (always read live from the matrix), the
 * Day-0 anchor and the Target Date (re-baselined, with the reason on record),
 * and the courier branch capture, which only exists on a remote path.
 */
function changeReasonAndMode(
  ticket: Ticket, reason: TicketReason, mode: TicketMode, note: string, recallDate?: string, actor = currentUserName()
): { ok: true } | { ok: false, error: string } {
  const locks = pathChangeLockReasons(ticket)
  if (locks.length) return { ok: false, error: `Reason and Mode are locked: ${locks.join(', ')}.` }
  const trimmed = note.trim()
  if (!trimmed) return { ok: false, error: 'Enter a reason for this change.' }
  if (!resolvedPathFor(reason, mode)) return { ok: false, error: `${REASON_LABELS[reason]} is not offered for ${mode === 'onsite' ? 'Onsite' : 'Remote'} returns.` }
  const recall = reason === 'recalled' ? (recallDate || ticket.recallEffectiveDate || '') : ''
  if (reason === 'recalled' && !recall) return { ok: false, error: 'Enter the Recall Effective Date.' }
  if (reason === ticket.reason && mode === ticket.mode && recall === (ticket.recallEffectiveDate ?? '')) return { ok: false, error: 'Nothing changed.' }

  const label = (r: TicketReason, m: TicketMode) => `${REASON_LABELS[r]}, ${m === 'onsite' ? 'Onsite' : 'Remote'}`
  const before = label(ticket.reason, ticket.mode)
  const modeChanged = mode !== ticket.mode
  ticket.reason = reason
  ticket.mode = mode
  ticket.recallEffectiveDate = reason === 'recalled' ? recall : undefined
  if (modeChanged && mode === 'onsite') {
    // The courier branch capture only exists on a remote path.
    ticket.courierBranchName = ''
    ticket.courierBranchAddress = ''
    ticket.branchCaptureMethod = null
    ticket.branchRequestSentAt = null
    ticket.branchRequestReplyReceived = false
    ticket.courierBranchSubstituted = false
  }
  const list = stageListFor(mode)
  ticket.stageIdx = Math.min(ticket.stageIdx, list.length - 1)
  ticket.furthestStageIdx = Math.min(ticket.furthestStageIdx ?? 0, list.length - 1)
  pushHistory(ticket, `Reason and Mode changed: ${before} to ${label(reason, mode)} (reason: ${trimmed})`, 'entry', actor)
  // Path-derived values re-resolve: the Target Date follows the new rule once assets are confirmed.
  if (ticket.assetsLocked) {
    const recomputed = computeTargetDateForPath(ticket)
    if (recomputed && recomputed !== ticket.targetDateISO) {
      if (ticket.targetDateISO) rebaselineTargetDate(ticket, recomputed, `Path changed to ${label(reason, mode)}`, actor)
      else ticket.targetDateISO = recomputed
    }
  }
  return { ok: true }
}

/** FR-003.11: any Asset Team user may take a ticket over from another, with the handover recorded. */
function takeOverTicket(ticket: Ticket, note: string, newAssigneeName = currentUserName()): { ok: true } | { ok: false, error: string } {
  const trimmed = note.trim()
  if (ticket.status !== 'open') return { ok: false, error: 'A closed ticket cannot be taken over.' }
  if (ticket.assignee.name === newAssigneeName) return { ok: false, error: 'You already own this ticket.' }
  if (!trimmed) return { ok: false, error: 'Enter a handover note.' }
  const from = ticket.assignee.name
  ticket.handovers = [...(ticket.handovers ?? []), { from, to: newAssigneeName, note: trimmed, at: new Date().toISOString() }]
  const previous = ticket.assignee
  ticket.assignee = assetTeamMemberByName(newAssigneeName)
  pushHistory(ticket, `Ticket taken over from ${from} by ${newAssigneeName} (handover: ${trimmed})`, 'entry', newAssigneeName)
  raiseNotification(ticket, {
    kind: 'takeover',
    title: `Ticket taken over · ${ticket.employee.name}`,
    description: `${newAssigneeName} took over ${ticket.employee.name}'s ticket`,
    to: previous
  })
  return { ok: true }
}

/**
 * FR-003.11 cancellation: a retracted resignation or reversed recall closes the
 * case with no retrieval, and the assets' Pending Return status reverts. It is
 * a recorded outcome, never a deletion.
 */
function cancelRetrieval(ticket: Ticket, reason: CancellationReason, note: string, actor = currentUserName()): { ok: true } | { ok: false, error: string } {
  const trimmed = note.trim()
  if (ticket.status !== 'open') return { ok: false, error: 'This ticket is already closed.' }
  if (!trimmed) return { ok: false, error: 'Enter a note for the cancellation.' }
  ticket.cancellation = { reason, note: trimmed, at: new Date().toISOString(), by: actor }
  ticket.status = 'closed'
  ticket.overdueForced = false
  ticket.assets.forEach((a) => { a.resolution = null })
  pushHistory(ticket, `Retrieval cancelled: ${CANCELLATION_REASON_LABELS[reason]} (${trimmed}). No retrieval, assets are no longer pending return`, 'closure', actor)
  return { ok: true }
}

/**
 * FR-003.11 partial returns: items the operator pathed to charge open a
 * Post-Retrieval Charging case for exactly those items, and the ticket moves to
 * that stage instead of closing with them outstanding. Returns false when there
 * is nothing to charge.
 */
/** #37 Referred to Payroll (added 5 Oct 2026): records that the Authority to
 * Deduct outcome has been handed off to HR and Payroll. AMS has no payroll
 * integration, so this is a formal manual acknowledgement so the handoff
 * exists on the ticket's record even without a system call. Idempotent;
 * reruns do not stack. */
function confirmReferredToPayroll(ticket: Ticket, actor = currentUserName()): boolean {
  if (ticket.referredToPayrollAt) return false
  ticket.referredToPayrollAt = new Date().toISOString()
  ticket.referredToPayrollBy = actor
  pushHistory(ticket, 'Authority to Deduct referred to HR and Payroll', 'return', actor)
  return true
}

/** #30 Quotation tracking (added 5 Oct 2026): records the quotation
 * received date, reference and file. Partial updates are allowed; the
 * caller passes only the fields it is changing. Appends a history line
 * only when a received date is being set (the real "quotation came in"
 * moment), not on subsequent corrections. */
function saveQuotationDetails(
  ticket: Ticket,
  details: { receivedISO?: string | null, reference?: string, fileName?: string },
  actor = currentUserName()
): void {
  const first = !ticket.quotationReceivedISO && !!details.receivedISO
  if (details.receivedISO !== undefined) ticket.quotationReceivedISO = details.receivedISO
  if (details.reference !== undefined) ticket.quotationReference = details.reference.trim()
  if (details.fileName !== undefined) ticket.quotationFileName = details.fileName
  if (first) {
    pushHistory(ticket, `Quotation received${ticket.quotationReference ? ` (ref ${ticket.quotationReference})` : ''}`, 'return', actor)
  }
}

function openChargeCaseForItems(ticket: Ticket, serials: string[], actor = currentUserName()): boolean {
  const items = ticket.assets.filter(a => serials.includes(a.serial))
  if (!items.length) return false
  const target = stageListFor(ticket.mode).indexOf('A11')
  if (target < 0) return false
  ticket.deductionApplicable = true
  ticket.deductionCaseAssetSerials = items.map(a => a.serial)
  ticket.equipmentNotReturned = items.length === ticket.assets.length
  ticket.stageIdx = target
  ticket.furthestStageIdx = Math.max(ticket.furthestStageIdx ?? 0, target)
  pushHistory(ticket, `Sent to charging: ${items.length} item${items.length === 1 ? '' : 's'} moved to Post-Retrieval Charging (${items.map(a => a.model).join(', ')})`, 'return', actor)
  return true
}

// ---------------------------------------------------------------------------
// Actions that used to be written inline by the ticket page. Each one is the same change
// the page made (the field writes and the history line), now made here.

/** A notice or the courier endorsement went out. Which one depends on the stage the ticket is at. */
function recordNoticeSent(ticket: Ticket) {
  const label = currentStageKey(ticket) === 'B9' ? 'Courier endorsement sent' : 'Retrieval notice sent (email + SMS)'
  pushHistory(ticket, label, 'send')
}

function recordSafekeepingSent(ticket: Ticket) {
  pushHistory(ticket, 'Equipment Safekeeping Request sent - no deadline, no consequence', 'send')
}

/** One call to the team member, and what came of it. The third unanswered call is where the SMS follow-up starts. */
function recordCallAttempt(ticket: Ticket, outcome: 'No answer' | 'Answered - confirmed') {
  ticket.callAttempts.push({ when: nowISO(), outcome })
  const answeredYet = ticket.callAttempts.some(a => a.outcome === 'Answered - confirmed')
  if (outcome === 'Answered - confirmed') {
    ticket.contact.numberVerified = true
    pushHistory(ticket, 'Call attempt logged: answered - contact number confirmed active', 'call')
  } else {
    pushHistory(ticket, `Call attempt logged: no answer (${ticket.callAttempts.length} of 3)`, 'call')
    if (ticket.callAttempts.length >= 3 && !answeredYet) pushHistory(ticket, 'Call confirmation attempts exhausted (3 of 3, unanswered), SMS follow-up next', 'call')
  }
}

/** Moves on from the call stage. Attempts and the SMS flag are kept: the call log is the point of the stage. */
function continueAfterCalls(ticket: Ticket) {
  const atCap = ticket.callAttempts.length >= 3
  const answeredYet = ticket.callAttempts.some(a => a.outcome === 'Answered - confirmed')
  if (atCap && !answeredYet) pushHistory(ticket, ticket.smsSentAt ? 'Continued without a call confirmation, after the SMS follow-up' : 'Continued without a call confirmation', 'call')
  advanceStage(ticket)
}

function recordSmsFollowUpSent(ticket: Ticket) {
  ticket.smsSentAt = new Date().toISOString()
  pushHistory(ticket, 'SMS follow-up sent after 3 unanswered call attempts', 'call')
}

/** The midpoint reminder, then the final one: each send or skip moves the count on by one. */
function recordReminderSent(ticket: Ticket) {
  pushHistory(ticket, ticket.reminderCount === 0 ? 'Midpoint reminder sent' : 'Final reminder sent', 'send')
  ticket.reminderCount = (ticket.reminderCount + 1) as 0 | 1 | 2
}

function recordReminderSkipped(ticket: Ticket) {
  pushHistory(ticket, ticket.reminderCount === 0 ? 'Midpoint reminder skipped - not needed' : 'Final reminder skipped - not needed', 'send')
  ticket.reminderCount = (ticket.reminderCount + 1) as 0 | 1 | 2
}

/** The equipment is not coming back: the whole retrieval goes straight to Post-Retrieval Charging. */
function recordEquipmentNotReturned(ticket: Ticket) {
  const target = stageListFor(ticket.mode).indexOf('A11')
  if (target < 0) return
  ticket.equipmentNotReturned = true
  ticket.deductionApplicable = true
  pushHistory(ticket, 'Equipment not returned, moved to Post-Retrieval Charging', 'return')
  ticket.stageIdx = target
  ticket.furthestStageIdx = Math.max(ticket.furthestStageIdx ?? 0, target)
}

/** Records the receipt without moving the stage: the operator sees the confirmation first and then continues. */
function recordEquipmentReceived(ticket: Ticket) {
  pushHistory(ticket, 'Equipment marked received - proof and condition evidence recorded next', 'return')
}

/** Back to "not decided yet", so the operator can switch from Not Applicable to Item Damaged. */
function clearChargingClassification(ticket: Ticket) {
  ticket.deductionApplicable = null
  pushHistory(ticket, 'Post-Retrieval Charging classification cleared', 'return', currentUserName())
}

/** An overdue reminder went out. The time and count are kept on the ticket so "sent 3 times, last just now" can be shown. */
function recordOverdueReminderSent(ticket: Ticket, templateKey: string | null) {
  pushHistory(ticket, `Overdue reminder sent (${templateKey?.toUpperCase() ?? 'no template'})`, 'send')
  ticket.overdueReminderSentAt = new Date().toISOString()
  ticket.overdueReminderCount += 1
}

/** Proof of receipt and condition photos are on file. The ticket moves on to Hold Off. */
function recordEvidence(ticket: Ticket, proof: TicketFileRef | null, condition: TicketFileRef | null) {
  ticket.evidenceProof = proof
  ticket.evidenceCondition = condition
  pushHistory(ticket, 'Proof-of-Receipt + condition photos uploaded - receipt record generated, status moves to Hold Off', 'return')
  advanceStage(ticket)
}

/** Nothing was damaged or missing. "false" is a decision on record, not "not decided yet" (that is null). */
function recordDeductionNotApplicable(ticket: Ticket) {
  pushHistory(ticket, 'Deduction not applicable', 'return')
  ticket.deductionApplicable = false
  advanceStage(ticket)
}

/** The charging outcome, with the email and form that went with it. The stage does not advance: the sent banner's Continue does. */
function recordDeductionOutcome(ticket: Ticket, outcome: DeductionOutcome, templateKey: string, formName: string | null) {
  const meta = DEDUCTION_OUTCOME_META[outcome]
  const previous = ticket.deductionOutcome
  ticket.deductionOutcome = outcome
  const sent = `${templateKey.toUpperCase()} sent${formName ? ` with ${formName} attached` : ' (no attachment)'}`
  pushHistory(ticket, previous && previous !== outcome
    ? `Post-Retrieval Charging outcome changed: ${DEDUCTION_OUTCOME_META[previous].label} to ${meta.label}, ${sent}`
    : `Post-Retrieval Charging resolved: ${meta.label}, ${sent}`, 'return')
}

/**
 * Continues from Post-Retrieval Charging. When the equipment never came back, or the team member keeps
 * it under a settlement, there is nothing to inspect, so Returned Item Check is skipped (once on record).
 */
function continueAfterCharging(ticket: Ticket) {
  const step = () => (ticket.stageIdx < (ticket.furthestStageIdx ?? 0) ? goForwardStage(ticket) : advanceStage(ticket))
  step()
  if (currentStageKey(ticket) === 'A12' && (ticket.equipmentNotReturned || ticket.deductionOutcome === 'settlement')) {
    if (!ticket.history.some(h => /^Returned item check skipped/.test(h.action))) {
      pushHistory(ticket, ticket.equipmentNotReturned ? 'Returned item check skipped, equipment was not returned' : 'Returned item check skipped, equipment kept under settlement', 'return')
    }
    step()
  }
}

/** Where each returned item goes next. Kept on the ticket so its status shows through closure. */
function recordInspection(ticket: Ticket, route: InspectionRoute) {
  ticket.inspectionRoute = route
  pushHistory(ticket, `Inspection completed, routed to ${INSPECTION_ROUTE_STATUS[route]} - inspection record generated`, 'return')
  advanceStage(ticket)
}

/**
 * Closes the ticket, or, when items were sent to charging and no case has an outcome yet,
 * opens the charging case for exactly those items instead. The resolutions line up with the assets.
 */
function closeTicket(ticket: Ticket, resolutions: ('returned' | 'charge' | 'open' | null)[], documented: boolean): { closed: boolean, chargeCount: number } {
  ticket.assets.forEach((a, i) => { a.resolution = resolutions[i] ?? null })
  const chargeSerials = ticket.assets.filter(a => a.resolution === 'charge').map(a => a.serial)
  if (chargeSerials.length && !ticket.deductionOutcome) {
    openChargeCaseForItems(ticket, chargeSerials)
    return { closed: false, chargeCount: chargeSerials.length }
  }
  ticket.status = 'closed'
  pushHistory(ticket, 'Ticket Closed', 'closure')
  pushHistory(ticket, documented ? 'Detailed closure copy sent to team member (PDF)' : 'Team member copy not sent - documentation unconfirmed', 'closure')
  return { closed: true, chargeCount: chargeSerials.length }
}

/** Reopening a cancelled retrieval lifts the cancellation. The record stays in the activity log. */
function reopenClosedTicket(ticket: Ticket) {
  ticket.status = 'open'
  ticket.cancellation = null
  pushHistory(ticket, 'Ticket Tracker reopened', 'closure')
}

/** The fields an operator edits directly while working on a ticket (the charging case's details, a dismissed reminder). Anything else is refused. */
const EDITABLE_FIELDS = [
  'deductionCaseFirstNameOverride', 'deductionCaseOfficerOverride', 'deductionCaseReturnRequestedDate', 'deductionCaseReceivedDate',
  'deductionCaseAssessedDate', 'deductionCaseBuyoutElectionDate', 'deductionCaseQuotationExpectedDate', 'deductionCaseHearBackByDate',
  'deductionCaseResponseDueDate', 'deductionCaseAmountBasis', 'deductionCaseSupportingDocRef', 'deductionCaseAmountFigures',
  'deductionCaseAmountWords', 'deductionCaseAssetSerials', 'deductionCaseAssetNotes', 'deductionApplicable', 'checklistNudgeDismissed'
]

function updateTicketFields(ticket: Ticket, fields: Record<string, unknown>) {
  for (const key of Object.keys(fields)) {
    if (!EDITABLE_FIELDS.includes(key)) throw new Error(`The field "${key}" cannot be edited this way.`)
  }
  Object.assign(ticket, fields)
  ticket.lastUpdatedBy = currentUserName()
  ticket.lastUpdatedAt = new Date().toISOString()
}

/** Every action the browser can ask for, by name, with the arguments it sends. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any
export const ACTIONS: Record<TicketActionName, (t: Ticket, a: Args) => unknown> = {
  setChecklistDone: (t, a) => setChecklistDone(t, a.index, a.done, undefined),
  addChecklistItem: (t, a) => addChecklistItem(t, a.text, a.optional),
  removeChecklistItem: (t, a) => removeChecklistItem(t, a.index),
  toggleChecklistRequired: (t, a) => toggleChecklistRequired(t, a.index),
  applyChecklistTemplate: (t, a) => applyChecklistTemplate(t, a.templateName, a.tasks),
  reorderChecklistItem: (t, a) => reorderChecklistItem(t, a.from, a.to),
  finalizeChecklist: (t, a) => finalizeChecklist(t, undefined, a.noteText),
  advanceStage: (t, a) => advanceStage(t),
  confirmAssets: (t, a) => confirmAssets(t),
  rebaselineTargetDate: (t, a) => rebaselineTargetDate(t, a.newDateISO, a.reason, undefined),
  acknowledgeHrisUpdate: (t, a) => acknowledgeHrisUpdate(t),
  releaseGate: (t, a) => releaseGate(t, a.gateN, a.note),
  goBackStage: (t, a) => goBackStage(t),
  goForwardStage: (t, a) => goForwardStage(t),
  jumpToStage: (t, a) => jumpToStage(t, a.target),
  verifyContact: (t, a) => verifyContact(t, a.field),
  setContactNumber: (t, a) => setContactNumber(t, a.number),
  setTeamMemberAddressOverride: (t, a) => setTeamMemberAddressOverride(t, a.address),
  confirmCourierBranch: (t, a) => confirmCourierBranch(t, a.providerId, a.branchName, a.branchAddress, a.captureMethod, a.substituted),
  sendBranchRequest: (t, a) => sendBranchRequest(t, a.templateKey),
  confirmSmsSentFor: (t, a) => confirmSmsSentFor(t, a.code, a.label),
  markBranchReplyReceived: (t, a) => markBranchReplyReceived(t),
  confirmInTransit: (t, a) => confirmInTransit(t, a.trackingNumber, a.trackingLink),
  saveShipmentDetails: (t, a) => saveShipmentDetails(t, a.trackingNumber, a.trackingLink),
  notifyItLock: (t, a) => notifyItLock(t),
  skipItNotice: (t, a) => skipItNotice(t),
  issueGatePass: (t, a) => issueGatePass(t, a.input, a.kind),
  changeReasonAndMode: (t, a) => changeReasonAndMode(t, a.reason, a.mode, a.note, a.recallDate, undefined),
  takeOverTicket: (t, a) => takeOverTicket(t, a.note, a.newAssigneeName),
  cancelRetrieval: (t, a) => cancelRetrieval(t, a.reason, a.note, undefined),
  confirmReferredToPayroll: (t, a) => confirmReferredToPayroll(t, undefined),
  saveQuotationDetails: (t, a) => saveQuotationDetails(t, a.details, undefined),
  openChargeCaseForItems: (t, a) => openChargeCaseForItems(t, a.serials, undefined),
  recordNoticeSent: (t, a) => recordNoticeSent(t),
  recordSafekeepingSent: (t, a) => recordSafekeepingSent(t),
  recordCallAttempt: (t, a) => recordCallAttempt(t, a.outcome),
  continueAfterCalls: (t, a) => continueAfterCalls(t),
  recordSmsFollowUpSent: (t, a) => recordSmsFollowUpSent(t),
  recordReminderSent: (t, a) => recordReminderSent(t),
  recordReminderSkipped: (t, a) => recordReminderSkipped(t),
  recordEquipmentNotReturned: (t, a) => recordEquipmentNotReturned(t),
  recordEquipmentReceived: (t, a) => recordEquipmentReceived(t),
  clearChargingClassification: (t, a) => clearChargingClassification(t),
  recordOverdueReminderSent: (t, a) => recordOverdueReminderSent(t, a.templateKey),
  recordEvidence: (t, a) => recordEvidence(t, a.proof, a.condition),
  recordDeductionNotApplicable: (t, a) => recordDeductionNotApplicable(t),
  recordDeductionOutcome: (t, a) => recordDeductionOutcome(t, a.outcome, a.templateKey, a.formName),
  continueAfterCharging: (t, a) => continueAfterCharging(t),
  recordInspection: (t, a) => recordInspection(t, a.route),
  closeTicket: (t, a) => closeTicket(t, a.resolutions, a.documented),
  reopenClosedTicket: (t, a) => reopenClosedTicket(t),
  updateTicketFields: (t, a) => updateTicketFields(t, a.fields)
}
