// Retrieval Ticket Module (FR-003) domain layer - ported from the standalone
// prototype (ticket-tracker-retrieval-integration.html, MATRIX/GATE_STEPS/
// STAGE_CONTENT/HRIS_DB) into this app's real data-store pattern (see
// templateRuntime.ts/retrievalForms.ts for the shape this follows: static
// seed config + a reactive runtime store + plain mutator functions, no
// component owns the domain logic directly).
//
// The one substantive change from the prototype: every "which template/form
// gets used" reference now points at a REAL key in TEMPLATES (templates.ts)
// or RETRIEVAL_FORMS (retrievalForms.ts) instead of the prototype's mocked
// EMAIL_TEMPLATES/FORM_TEMPLATES arrays - t1..t18 and return-ack-onsite/
// return-ack-remote already exist with real subject/body/attachment content,
// so the workspace can render/send the actual template instead of a stand-in.
import { reactive } from 'vue'
import { TEMPLATES } from './templates'
import { ensureTemplateRuntime } from './templateRuntime'
import { RETRIEVAL_FORMS } from './retrievalForms'

export type TicketReason = 'resignation' | 'immediate-resignation' | 'end-of-contract' | 'sabbatical' | 'recalled' | 'unexplained-absence'
export type TicketMode = 'onsite' | 'remote'

export const REASON_LABELS: Record<TicketReason, string> = {
  resignation: 'Resignation',
  'immediate-resignation': 'Immediate Resignation',
  'end-of-contract': 'End of Contract',
  sabbatical: 'Sabbatical',
  recalled: 'Recalled',
  'unexplained-absence': 'Unexplained Absence'
}

interface ModePath {
  anchor: string
  deadline: string
  sender: string
  /** key into TEMPLATES - the actual outbound retrieval notice template used at A6/B9 */
  templateKey: string
}

interface MatrixEntry {
  gateCount: 0 | 1 | 3
  gateName?: string
  onsite: ModePath | null
  remote: ModePath | null
}

/**
 * Reason x Mode resolution matrix - deadlines/senders/gate model per
 * FR-003.4/.5. Gate model: voluntary paths (Resignation, Immediate
 * Resignation, Sabbatical) carry NO gate; involuntary single-gate paths (End
 * of Contract, Recalled) carry ONE gate on the P&C notification; Unexplained
 * Absence carries THREE sequential gates (see GATE_STEPS) - not two, an
 * earlier misreading corrected against the source PDF (FR-003.5).
 * P12: Unexplained Absence has no onsite path at all (`onsite: null`) - it is
 * not offered, never just disabled.
 */
export const MATRIX: Record<TicketReason, MatrixEntry> = {
  resignation: {
    gateCount: 0,
    onsite: { anchor: 'Resignation Acceptance', deadline: '3 business days from LWD', sender: 'Asset Team', templateKey: 't1' },
    remote: { anchor: 'Resignation Acceptance', deadline: '5 business days from LWD', sender: 'Asset Team', templateKey: 't2' }
  },
  'immediate-resignation': {
    gateCount: 0,
    onsite: { anchor: 'Resignation Received', deadline: '2 calendar days from LWD', sender: 'Asset Team', templateKey: 't3' },
    remote: { anchor: 'Resignation Received', deadline: '3 calendar days from LWD', sender: 'Asset Team', templateKey: 't4' }
  },
  'end-of-contract': {
    gateCount: 1,
    gateName: 'Contract Closure Acknowledgment',
    onsite: { anchor: 'P&C Acknowledgment', deadline: '3 business days from LWD', sender: 'People & Culture', templateKey: 't5' },
    remote: { anchor: 'P&C Acknowledgment', deadline: '5 business days from LWD', sender: 'People & Culture', templateKey: 't6' }
  },
  sabbatical: {
    // Pending a separate flow definition - see FR-003.13 Open Question #2. Not modeled beyond a placeholder.
    gateCount: 0,
    onsite: null,
    remote: null
  },
  recalled: {
    gateCount: 1,
    gateName: 'Recall Determination',
    onsite: { anchor: 'Recall Determination', deadline: '3 business days from LWD', sender: 'People & Culture', templateKey: 't9' },
    remote: { anchor: 'Recall Determination', deadline: '5 business days from LWD', sender: 'People & Culture', templateKey: 't10' }
  },
  'unexplained-absence': {
    gateCount: 3,
    gateName: 'Gate 1 -> Gate 2 -> Gate 3 (P&C, in sequence)',
    onsite: null, // P12 - not offered
    remote: { anchor: 'Gate 3 release', deadline: '3 calendar days from determination', sender: 'People & Culture', templateKey: 't11' }
  }
}

/** Midpoint/Final reminder and Overdue notice templates, by mode - reused across every reason (FR-003.12's reminder/overdue rows aren't reason-specific). */
export const REMINDER_TEMPLATES = {
  midpoint: { onsite: 't12', remote: 't13' },
  final: { onsite: 't14', remote: 't15' },
  overdue: { onsite: 't16', remote: 't17' }
} as const

/** Courier endorsement template, sent at B9 (remote only). */
export const COURIER_ENDORSEMENT_TEMPLATE_KEY = 't18'

// ---------------------------------------------------------------------------
// Courier Providers - mirrors the app's own Master Data > Courier Providers
// list (FR-003.9: GoTeam endorses to the courier's corporate account
// manager). B8 (Branch confirmation capture) browses this same list rather
// than holding its own separate copy - one provider is flagged `recommended`
// and auto-selected, the rest are `alternate` and only picked when the
// recommended provider can't be used for a given ticket.
export interface CourierProvider {
  id: string
  name: string
  priority: 'recommended' | 'alternate'
  accountManager: string
  accountManagerEmail: string
  corporateAccount: boolean
  status: 'active' | 'inactive'
}

export const COURIER_PROVIDERS: CourierProvider[] = [
  { id: 'jrs-express', name: 'JRS Express', priority: 'recommended', accountManager: 'Nico Dalisay', accountManagerEmail: 'nico.dalisay@jrs-express.com.ph', corporateAccount: true, status: 'active' },
  { id: 'jt-express', name: 'J&T Express', priority: 'alternate', accountManager: 'Mia Santos', accountManagerEmail: 'mia.santos@jtexpress.ph', corporateAccount: true, status: 'active' },
  { id: 'lbc-express', name: 'LBC Express', priority: 'alternate', accountManager: 'Carlo Reyes', accountManagerEmail: 'carlo.reyes@lbcexpress.com', corporateAccount: true, status: 'active' }
]

export function recommendedCourierProvider(): CourierProvider | null {
  return COURIER_PROVIDERS.find(p => p.status === 'active' && p.priority === 'recommended') ?? COURIER_PROVIDERS.find(p => p.status === 'active') ?? null
}

export function courierProviderById(id: string | null): CourierProvider | null {
  if (!id) return null
  return COURIER_PROVIDERS.find(p => p.id === id) ?? null
}

/** The Equipment Return Acknowledgment attached at the notice/reminder stages, by mode. */
export const RETURN_ACK_FORM_ID = {
  onsite: 'return-ack-onsite',
  remote: 'return-ack-remote'
} as const

export interface GateStep {
  n: 1 | 2 | 3
  label: string
  unlocks: string
  stillBlocked: string
}

/** Unexplained Absence's 3 sequential gates - each releases something different. Only ever used when gateCount === 3. */
export const GATE_STEPS: GateStep[] = [
  { n: 1, label: 'Gate 1 - P&C acknowledgment of the absence endorsement', unlocks: 'Asset status to Custodian Under Review, IT preventive lock', stillBlocked: 'All team-member-facing sends' },
  { n: 2, label: 'Gate 2 - P&C advice that Return-to-Work notice + first Notice to Explain have been issued', unlocks: 'Equipment Safekeeping Request (T19) - no deadline, no consequence', stillBlocked: 'The full retrieval instruction' },
  { n: 3, label: 'Gate 3 - P&C termination and retrieval endorsement', unlocks: 'The full retrieval instruction, deadlines and consequence register - standard return clock starts here', stillBlocked: 'Nothing further' }
]

export type StageKey = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'B8' | 'B9' | 'A6' | 'A7' | 'A8' | 'B11' | 'B11a' | 'A9' | 'A10' | 'A11' | 'A12' | 'A13'
export type PhaseKey = 'setup' | 'branch' | 'notice' | 'transit' | 'return' | 'closure'

export const STAGES_ONSITE: StageKey[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13']
export const STAGES_REMOTE: StageKey[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'B8', 'B9', 'A6', 'A7', 'A8', 'B11', 'B11a', 'A9', 'A10', 'A11', 'A12', 'A13']

export function stageListFor(mode: TicketMode): StageKey[] {
  return mode === 'remote' ? STAGES_REMOTE : STAGES_ONSITE
}

/**
 * Exact stage names from the FR-003 PDF's own Stage Sequence tables
 * (pages 7-8, FR-003.6) - these are the process/legal terms referenced
 * throughout the documentation, so they must match verbatim. Do not rename
 * these for "friendlier" wording - only STAGE_META.desc (the guidance copy
 * shown under each name) is a UX-copy surface. Internal stage codes
 * (A1, B9, ...) are never shown to the user.
 */
export const STAGE_NAMES: Record<StageKey, string> = {
  A1: 'Entry',
  A2: 'Create',
  A3: 'Offboarding checklist',
  A4: 'IT lock scheduling',
  A5: 'Custodian Card and asset confirmation',
  B8: 'Branch confirmation capture',
  B9: 'Courier endorsement',
  A6: 'Generate and send notice',
  A7: 'Call confirmation',
  A8: 'Reminders',
  B11: 'Confirm In Transit',
  B11a: 'Transit monitoring',
  A9: 'Overdue',
  A10: 'Receipt and evidence',
  A11: 'Deduction, where applicable',
  A12: 'Returned Item Check and routing',
  A13: 'Closure'
}

/** Coarse phases - like a shipment tracker's Placed -> Packed -> Shipped -> Delivered, not one node per micro-step. */
export const STAGE_PHASE: Record<StageKey, PhaseKey> = {
  A1: 'setup', A2: 'setup', A3: 'setup', A4: 'setup', A5: 'setup',
  B8: 'branch', B9: 'branch',
  A6: 'notice', A7: 'notice', A8: 'notice',
  B11: 'transit', B11a: 'transit',
  A9: 'return', A10: 'return', A11: 'return', A12: 'return',
  A13: 'closure'
}

export const PHASE_ORDER: PhaseKey[] = ['setup', 'branch', 'notice', 'transit', 'return', 'closure']
export const PHASE_LABELS: Record<PhaseKey, string> = {
  setup: 'Setup',
  branch: 'Branch & Endorsement',
  notice: 'Notice & Confirmation',
  transit: 'Transit',
  return: 'Return & Evidence',
  closure: 'Closure'
}

/** Phases that actually apply to a mode - Branch & Endorsement and Transit only exist on the remote spine (B8/B9/B11/B11a), so an onsite ticket's phase tracker must skip them rather than show a node with no child steps behind it. */
export function phasesFor(mode: TicketMode): PhaseKey[] {
  const stages = stageListFor(mode)
  return PHASE_ORDER.filter(p => stages.some(s => STAGE_PHASE[s] === p))
}

/** A1/A2 already happened at ticket creation - logged into History directly, never re-clicked as a stage. B11a (Transit Monitoring) has no separate operator action either - it's folded into the B11 -> A9 handoff. */
export const SKIP_STAGES: StageKey[] = ['A1', 'A2', 'B11a']

/** Stages with a real team-member-facing send - the gate (FR-003.5) blocks these specifically, never A5 (Asset Confirmation), which is an internal action. */
export const SEND_STAGES: StageKey[] = ['A6', 'B9', 'A8', 'A9']

export function sendsBlocked(ticket: Pick<Ticket, 'gateCount' | 'gatesReleased'>): boolean {
  return ticket.gateCount > 0 && ticket.gatesReleased < ticket.gateCount
}

/** True only for Unexplained Absence between Gate 2 and Gate 3 - the one window where a limited alternative (T19 Equipment Safekeeping Request) is available despite sends still being blocked. */
export function safekeepingAvailable(ticket: Pick<Ticket, 'gateCount' | 'gatesReleased'>): boolean {
  return ticket.gateCount === 3 && ticket.gatesReleased >= 2 && ticket.gatesReleased < 3
}

export function resolvedPathFor(reason: TicketReason, mode: TicketMode): ModePath | null {
  return MATRIX[reason]?.[mode] ?? null
}

/** Looks up a resolved template's real subject/body/attachment via the live TEMPLATE_RUNTIME store (so an edit made in Templates shows up here too, not a frozen copy). */
export function templateForKey(key: string) {
  if (!TEMPLATES[key]) return null
  return ensureTemplateRuntime(key)
}

export function attachedFormFor(mode: TicketMode) {
  const id = RETURN_ACK_FORM_ID[mode]
  return RETRIEVAL_FORMS.find(f => f.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Mock HRIS directory - stands in for the real HRIS integration (FR-003.2/.7:
// R24 fields fetched at ticket creation). Employee identity/client/coach
// fields are R24 hard-truth (never editable in AMS); contact fields below are
// R24-sourced but editable/addable/verifiable in AMS (see Ticket.contact).
export interface HrisRecord {
  id: string
  name: string
  dept: string
  client: string
  email: string
  contactNumber: string
  personalEmail: string
  altContactName: string
  altContactNumber: string
  leadershipCoach: string
  address: string
  addressMode: TicketMode
  caseType: string
  suggestedReason: TicketReason
  lwd: string
  sep: string
  assets: string[]
}

export const HRIS_DIRECTORY: HrisRecord[] = [
  { id: 'EMP-04821', name: 'Marisol Ferrer', dept: 'Client Success', client: 'Northwind Retail', email: 'm.ferrer@goteam.io', contactNumber: '+63 917 555 0142', personalEmail: 'marisol.ferrer88@gmail.com', altContactName: 'Liza Ferrer (sister)', altContactNumber: '+63 917 555 0199', leadershipCoach: 'J. Cruz - Team Lead', address: 'Remote - Cebu City', addressMode: 'remote', caseType: 'Voluntary Resignation', suggestedReason: 'resignation', lwd: '2026-09-25', sep: '2026-09-30', assets: ['MacBook Pro 14"', 'Magic Mouse', 'USB-C Dock', 'Company Badge', 'Headset', 'Power Adapter', 'Laptop Bag'] },
  { id: 'EMP-03310', name: 'Kevin Ong', dept: 'Engineering', client: 'Internal', email: 'k.ong@goteam.io', contactNumber: '+63 917 555 0210', personalEmail: '', altContactName: '', altContactNumber: '', leadershipCoach: 'M. Ramos - Engineering Manager', address: 'Onsite - Manila HQ', addressMode: 'onsite', caseType: 'Contract End', suggestedReason: 'end-of-contract', lwd: '2026-10-01', sep: '2026-10-05', assets: ['ThinkPad X1', 'Dell Monitor 27"', 'Docking Station', 'Company Badge'] },
  { id: 'EMP-05102', name: 'Andrea Villar', dept: 'People & Culture', client: 'Internal', email: 'a.villar@goteam.io', contactNumber: '', personalEmail: 'andrea.v.villar@yahoo.com', altContactName: 'Ramon Villar (spouse)', altContactNumber: '+63 917 555 0341', leadershipCoach: 'S. Reyes - HRBP', address: 'Remote - Davao', addressMode: 'remote', caseType: 'Unexplained Absence Case', suggestedReason: 'unexplained-absence', lwd: '', sep: '', assets: ['MacBook Air 13"', 'Company Badge', 'Webcam', 'Headset'] },
  { id: 'EMP-02214', name: 'Rafael Tan', dept: 'Finance', client: 'Meridian Logistics', email: 'r.tan@goteam.io', contactNumber: '+63 917 555 0455', personalEmail: 'rtan.finance@gmail.com', altContactName: 'Grace Tan (mother)', altContactNumber: '+63 917 555 0460', leadershipCoach: 'P. Villanueva - Finance Manager', address: 'Onsite - Manila HQ', addressMode: 'onsite', caseType: 'Immediate Resignation', suggestedReason: 'immediate-resignation', lwd: '2026-09-16', sep: '2026-09-16', assets: ['MacBook Pro 13"', 'Company Badge', 'External SSD'] },
  { id: 'EMP-06044', name: 'Priya Nair', dept: 'Marketing', client: 'Northwind Retail', email: 'p.nair@goteam.io', contactNumber: '+63 917 555 0578', personalEmail: 'priya.nair.mkt@gmail.com', altContactName: '', altContactNumber: '', leadershipCoach: 'D. Santos - Marketing Lead', address: 'Remote - Baguio', addressMode: 'remote', caseType: 'Sabbatical Request', suggestedReason: 'sabbatical', lwd: '2026-11-01', sep: '', assets: ['MacBook Air 13"', 'iPad', 'Company Badge'] },
  { id: 'EMP-01187', name: 'Josef Cruz', dept: 'Operations', client: 'Meridian Logistics', email: 'j.cruz@goteam.io', contactNumber: '+63 917 555 0623', personalEmail: '', altContactName: 'Elena Cruz (wife)', altContactNumber: '+63 917 555 0630', leadershipCoach: 'A. Fernandez - Operations Manager', address: 'Remote - Iloilo', addressMode: 'remote', caseType: 'Recall from Leave', suggestedReason: 'recalled', lwd: '2026-09-20', sep: '2026-09-22', assets: ['ThinkPad T14', 'Monitor', 'Docking Station', 'Company Badge', 'Headset'] }
]

// ---------------------------------------------------------------------------
// Runtime ticket store - one reactive record per created ticket, replacing
// the prototype's single set of module-level `let`s (stageIdx, gatesReleased,
// history, ...) with a real per-ticket record so multiple tickets (one per
// Overview row) can each hold their own independent state.

export interface TicketAsset {
  name: string
  serial: string
  /** editable only while `assetsLocked` is false (Setup/A5); read-only after */
  checked: boolean
}

export interface TicketHistoryEntry {
  action: string
  actor: string
  when: string
}

export interface TicketCallAttempt {
  when: string
  outcome: 'No answer' | 'Answered - confirmed'
}

export interface TicketContact {
  number: string
  numberVerified: boolean
  email: string
  emailVerified: boolean
  altName: string
  altNumber: string
}

/** A4 IT lock scheduling - FR-003.6 requires confirmation at two distinct points: on scheduling (the lock is booked) and on execution (it actually ran), not one bare click. `scheduledFor` is the Lock record's own field, anchored after the last shift on the LWD per the doc. */
export interface TicketItLock {
  scheduledConfirmed: boolean
  scheduledFor: string | null
  executedConfirmed: boolean
}

export interface Ticket {
  id: string
  /** Plain numeric ticket id, e.g. 422 - the ticket's sole user-facing identifier, shown identically (no "#", no prefix) in both the Overview's Ticket # column and the workspace header. Matches the real Ticket Tracker product's own ticket numbering (see the extracted reference: "#710", not an APR-code). Distinct from `reference` below. */
  ticketNumber: number
  /** The FR-003 "APR-YY-NNNNN" retrieval reference (see FR-003.13 Open Item #5) - an internal tracking code carried on notices/forms, not a second user-facing ticket ID (there's no established APR-code convention elsewhere in the product, so it never appears as if it were an identifier alongside the ticket number). */
  reference: string
  employee: HrisRecord
  reason: TicketReason
  mode: TicketMode
  lwd: string
  sep: string
  authorizingEndorsement: string
  gateCount: 0 | 1 | 3
  gatesReleased: number
  /** Free-text documentation note recorded with each gate release (who/what authorized it) - see FR-003.5's gate model. Required before a gate can be recorded; not just a bare confirm click. */
  gateNotes: Record<number, string>
  stageIdx: number
  overdueForced: boolean
  /** Offboarding Checklist (A3) item completion, indexed against OFFBOARDING_CHECKLIST_ITEMS. */
  checklistDone: boolean[]
  assetsLocked: boolean
  assets: TicketAsset[]
  targetDateISO: string | null
  callAttempts: TicketCallAttempt[]
  reminderCount: 0 | 1 | 2
  deductionApplicable: boolean | null
  contact: TicketContact
  itLock: TicketItLock
  /** B8 (remote only) - the courier provider and exact branch name/address captured before the courier endorsement (B9) can send. See FR-003.9(a): the retrieval instructions request "the exact branch name nearest the team member, and the branch address" - two distinct fields, not one freeform line. */
  courierProviderId: string | null
  courierBranchName: string
  courierBranchAddress: string
  /** True when the branch was filled from the address on file rather than the team member's own reply - FR-003.9(f): "On non-response, the operator may substitute the branch nearest the address on file and proceed, with the substitution recorded." */
  courierBranchSubstituted: boolean
  /** How the branch was actually captured - FR-003.9(b): "The confirmation call is the primary capture mechanism. The email reply is the fallback." Null until B8 is confirmed. */
  branchCaptureMethod: 'call' | 'email' | null
  /** B11 Confirm In Transit - the courier/tracking reference captured at handoff (FR-003.9's Remote table: "Captures courier and tracking or reference number"). */
  transitTrackingRef: string
  history: TicketHistoryEntry[]
  gatePassRef: string | null
  /** The full Gate Pass record, once issued - see FR-003.11's "Gate pass" requirement (must mirror the real GoTeam AMS Gate Pass form, GP-OUT/GP-IN, raised from the ticket and carrying its reference). Null until an operator actually fills and issues one - it is never auto-created. */
  gatePass: GatePass | null
  status: 'open' | 'closed'
  createdAt: string
}

/** One asset line on a Gate Pass, mirroring the real form's Asset Items table (Asset Tag / Type / Serial No. / Remarks). */
export interface GatePassAssetLine {
  assetTag: string
  type: string
  serial: string
  remarks: string
}

/**
 * Mirrors the real GoTeam AMS "Issue Gate Pass" form exactly: Movement
 * (Check Out/Check In), Issue Date, Time, Valid Until, Purpose, plus the
 * Team Member/Employee ID/Dept-Role block and the Asset Items table. Team
 * Member and Asset Items are pre-filled from the ticket (same person,
 * same confirmed assets) rather than re-entered - Time and Purpose are the
 * only fields the real form has no ticket-derived source for, so those
 * stay operator-entered (Purpose is pre-suggested from the retrieval
 * reason, not truly auto-filled the way the form's own note implies).
 */
export interface GatePass {
  ref: string
  movement: 'checkout' | 'checkin'
  issueDate: string
  time: string
  validUntil: string
  purpose: string
  requestedBy: string
  assets: GatePassAssetLine[]
}

/** A3 Offboarding Checklist - concrete, plain-language items an operator actually reviews, not just a description with nothing to check. */
export const OFFBOARDING_CHECKLIST_ITEMS = [
  'Offboarding notice reviewed and confirmed with People & Culture',
  'Any pending approvals or requests from this team member checked',
  'Handover of ongoing tasks coordinated with their manager',
  'Return instructions explained to the team member'
]

export const TICKETS = reactive<Record<string, Ticket>>({})

let ticketSeq = 417
let ticketNumberSeq = 421

function nextReference(): string {
  ticketSeq += 1
  return `APR-26-${String(ticketSeq).padStart(5, '0')}`
}

function nextTicketNumber(): number {
  ticketNumberSeq += 1
  return ticketNumberSeq
}

function serialFor(empId: string, i: number): string {
  const digits = empId.replace(/\D/g, '').slice(-3) || '000'
  return `SN-${String(10000 + i * 37 + Number(digits)).padStart(5, '0')}`
}

/**
 * Creates and starts a new ticket - the equivalent of the prototype's
 * startWorkflow(), but returning a real per-ticket record instead of
 * mutating shared module state. Logs A1/A2 as already-happened history
 * immediately, per FR-003.6 (they're recorded, not re-clicked as stages).
 *
 * `idOverride` exists only for seedDemoTickets() below: a real create (from
 * the Create Ticket Tracker page) always gets a fresh crypto.randomUUID(),
 * but a *demo* ticket needs the same id on the server-rendered HTML and the
 * client's post-hydration re-run of the same seeding call (this module is a
 * fresh instance in each) - a random id there produced two different
 * `/ticket-tracker/<id>` hrefs for the same row and Vue flagged it as a
 * hydration mismatch. Seeding instead passes the employee's own (fixed) id.
 */
export function createTicket(employee: HrisRecord, reason: TicketReason, mode: TicketMode, lwd: string, sep: string, authorizingEndorsement: string, idOverride?: string): Ticket {
  const entry = MATRIX[reason]
  const id = idOverride ?? crypto.randomUUID()
  const reference = nextReference()
  const ticketNumber = nextTicketNumber()
  const ticket: Ticket = {
    id,
    ticketNumber,
    reference,
    employee,
    reason,
    mode,
    lwd,
    sep,
    authorizingEndorsement,
    gateCount: entry.gateCount,
    gatesReleased: 0,
    gateNotes: {},
    stageIdx: 0,
    overdueForced: false,
    checklistDone: OFFBOARDING_CHECKLIST_ITEMS.map(() => false),
    assetsLocked: false,
    assets: employee.assets.map((name, i) => ({ name, serial: serialFor(employee.id, i), checked: true })),
    targetDateISO: null,
    callAttempts: [],
    reminderCount: 0,
    deductionApplicable: null,
    contact: {
      number: employee.contactNumber,
      numberVerified: false,
      email: employee.personalEmail,
      emailVerified: false,
      altName: employee.altContactName,
      altNumber: employee.altContactNumber
    },
    itLock: { scheduledConfirmed: false, scheduledFor: null, executedConfirmed: false },
    courierProviderId: mode === 'remote' ? (recommendedCourierProvider()?.id ?? null) : null,
    courierBranchName: '',
    courierBranchAddress: '',
    courierBranchSubstituted: false,
    branchCaptureMethod: null,
    transitTrackingRef: '',
    history: [],
    gatePassRef: null,
    gatePass: null,
    status: 'open',
    createdAt: new Date().toISOString().slice(0, 10)
  }
  TICKETS[id] = ticket
  pushHistory(ticket, 'Entry recorded: authorizing endorsement + Last Working Day + Separation Date captured')
  pushHistory(ticket, `Ticket Created - ${reference}`)
  return ticket
}

export function pushHistory(ticket: Ticket, action: string, actor = 'D. Reyes') {
  ticket.history.unshift({ action, actor, when: 'Just now' })
}

export function currentStageKey(ticket: Ticket): StageKey | null {
  const list = stageListFor(ticket.mode)
  let idx = ticket.stageIdx
  // Resolve past skip-stages first, so the phase tracker and stage content always agree on the true current step.
  while (idx < list.length && SKIP_STAGES.includes(list[idx]!)) idx++
  if (idx >= list.length) return null
  if (idx !== ticket.stageIdx) ticket.stageIdx = idx
  return list[idx]!
}

export function advanceStage(ticket: Ticket) {
  ticket.overdueForced = false
  const list = stageListFor(ticket.mode)
  ticket.stageIdx = Math.min(ticket.stageIdx + 1, list.length - 1)
}

/** Confirms the asset list at A5 - locks it read-only and derives the Target Date (LWD/determination + 7 days, matching the prototype's placeholder rule pending the real FR-003.8 return-window table per Reason x Mode). */
export function confirmAssets(ticket: Ticket) {
  ticket.assetsLocked = true
  if (ticket.lwd) {
    const d = new Date(ticket.lwd)
    d.setDate(d.getDate() + 7)
    ticket.targetDateISO = d.toISOString().slice(0, 10)
  }
  const confirmedCount = ticket.assets.filter(a => a.checked).length
  pushHistory(ticket, `Asset list confirmed (${confirmedCount} of ${ticket.assets.length}) - locked, status moves to Pending Return`)
  advanceStage(ticket)
}

/**
 * Records a gate release - this is a compliance checkpoint (FR-003.5), so it
 * always requires a documentation note (who/what authorized it - an
 * endorsement reference, an email subject line, a case number), never just a
 * bare confirm click. The note is kept on the ticket (`gateNotes`) and
 * written into history so it's part of the permanent audit trail.
 */
export function releaseGate(ticket: Ticket, gateN: number, note: string) {
  ticket.gatesReleased = gateN
  ticket.gateNotes[gateN] = note
  const step = GATE_STEPS.find(g => g.n === gateN)
  pushHistory(ticket, `Gate ${gateN} recorded (${note}) - ${step?.unlocks ?? ''}`)
}

export function isP12(reason: TicketReason, mode: TicketMode): boolean {
  return reason === 'unexplained-absence' && mode === 'onsite'
}

/** Moves the ticket's stage pointer back one step, e.g. after an operator realizes they advanced too soon. Floors naturally at A3: stepping back into A1/A2 just gets resolved forward again by currentStageKey() since those are marked skip (already-logged entry steps, never re-clickable). */
export function goBackStage(ticket: Ticket) {
  ticket.stageIdx = Math.max(0, ticket.stageIdx - 1)
  pushHistory(ticket, 'Moved back to the previous step')
}

/** Marks a custodian contact field as verified directly (an explicit operator action - e.g. they reached the team member through some other channel), independent of the A7 call-confirmation auto-verify path. */
export function verifyContact(ticket: Ticket, field: 'number' | 'email') {
  if (field === 'number') ticket.contact.numberVerified = true
  else ticket.contact.emailVerified = true
  pushHistory(ticket, `${field === 'number' ? 'Contact number' : 'Personal email'} manually confirmed active`)
}

/**
 * Records the B8 Branch confirmation capture - the courier + exact branch
 * name/address is a required field before the courier endorsement (B9) can
 * send (FR-003.9). `captureMethod` records FR-003.9(b) (call is the primary
 * mechanism, email reply the fallback) and `substituted` records
 * FR-003.9(f)'s non-response path (branch filled from the address on file,
 * not the team member's own reply) distinctly in history.
 */
export function confirmCourierBranch(ticket: Ticket, providerId: string, branchName: string, branchAddress: string, captureMethod: 'call' | 'email', substituted = false) {
  ticket.courierProviderId = providerId
  ticket.courierBranchName = branchName
  ticket.courierBranchAddress = branchAddress
  ticket.courierBranchSubstituted = substituted
  ticket.branchCaptureMethod = captureMethod
  const provider = courierProviderById(providerId)
  const via = captureMethod === 'call' ? 'via confirmation call' : 'via email reply'
  pushHistory(ticket, substituted
    ? `Courier branch substituted from address on file (team member non-response): ${provider?.name ?? providerId}, ${branchName}, ${branchAddress}`
    : `Courier branch confirmed ${via}: ${provider?.name ?? providerId}, ${branchName}, ${branchAddress}`)
  advanceStage(ticket)
}

/**
 * FR-003.9(e): "The courier arrangement must be completed before the Last
 * Working Day. The system flags a ticket where the LWD is approaching and
 * the branch is uncaptured." True once 2 or fewer days remain (or the LWD
 * has already passed) with the branch still not confirmed.
 */
export function branchCaptureUrgent(ticket: Pick<Ticket, 'mode' | 'lwd' | 'courierBranchName'>): boolean {
  if (ticket.mode !== 'remote' || ticket.courierBranchName || !ticket.lwd) return false
  const days = Math.round((new Date(ticket.lwd).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  return days <= 2
}

/** Records the B11 Confirm In Transit handoff, capturing the courier/tracking reference per FR-003.9's Remote table ("Captures courier and tracking or reference number"). */
export function confirmInTransit(ticket: Ticket, trackingRef: string) {
  ticket.transitTrackingRef = trackingRef
  pushHistory(ticket, `Marked In Transit - tracking/reference number: ${trackingRef}`)
  advanceStage(ticket)
}

/** A4 step 1 of 2 - schedules the lock and opens its Lock record. FR-003.6: "Scheduled within 1 business day of the Notice Endorsement, anchored after the last shift on the Last Working Day." */
export function confirmItLockScheduling(ticket: Ticket) {
  ticket.itLock.scheduledConfirmed = true
  ticket.itLock.scheduledFor = ticket.lwd
  pushHistory(ticket, `IT lock scheduled for end of last shift on ${ticket.lwd || 'the Last Working Day'} - Lock record opened`)
}

/** A4 step 2 of 2 - confirms the lock actually executed on schedule, closing the Lock record and only then advancing. FR-003.6: "Confirmed on scheduling and on execution." */
export function confirmItLockExecution(ticket: Ticket) {
  ticket.itLock.executedConfirmed = true
  pushHistory(ticket, 'IT lock executed on schedule - Lock record closed')
  advanceStage(ticket)
}

/** An existing OPEN ticket for the same team member, if any - the guardrail a Create flow checks before allowing a second ticket for someone who already has one in flight. */
export function findOpenDuplicate(employeeId: string): Ticket | undefined {
  return Object.values(TICKETS).find(t => t.employee.id === employeeId && t.status === 'open')
}

let gatePassSeq = 100000

/**
 * Issues a Gate Pass against this ticket - a deliberate operator action
 * with real form content (FR-003.11), never an automatic side effect of
 * viewing the ticket. `assets` and the team-member fields are expected to
 * already be pre-filled from the ticket by the caller; this just stamps a
 * reference, records it, and writes the audit-trail entry.
 */
export function issueGatePass(ticket: Ticket, input: Omit<GatePass, 'ref'>): GatePass {
  gatePassSeq += 1
  const pass: GatePass = { ref: `GP-2026-${gatePassSeq}`, ...input }
  ticket.gatePass = pass
  ticket.gatePassRef = pass.ref
  pushHistory(ticket, `Gate Pass issued - ${pass.ref} (${pass.movement === 'checkin' ? 'Check In' : 'Check Out'})`, input.requestedBy)
  return pass
}

export type StageKind =
  | 'checklist' | 'itlock' | 'assets' | 'branch' | 'template-send' | 'calllog'
  | 'reminders' | 'transit' | 'awaiting-return' | 'evidence' | 'deduction'
  | 'inspection' | 'closure'

export interface StageMeta {
  title: string
  desc: string
  kind: StageKind
  actionLabel?: string
  systemNote?: string
}

/** Per-stage title/description/behavior-kind - the workspace page switches on `kind` to render the right interactive panel. A1/A2/B11a never appear here (see SKIP_STAGES). */
export const STAGE_META: Partial<Record<StageKey, StageMeta>> = {
  A3: { title: STAGE_NAMES.A3, desc: 'Review the items below before moving on. Due no later than 3 business days before the Last Working Day.', kind: 'checklist', actionLabel: 'Complete Checklist' },
  A4: { title: STAGE_NAMES.A4, desc: 'Cuts off this team member\'s access to company systems and accounts once their last shift ends, so nothing stays reachable after they\'ve left. Confirming schedules IT to execute it right on time, not early and not late.', kind: 'itlock', actionLabel: 'Schedule Access Lock' },
  A5: { title: STAGE_NAMES.A5, desc: 'Check off the equipment this team member actually has before proceeding. Once confirmed, the list locks and stays visible in the panel on the left for the rest of the ticket.', kind: 'assets', actionLabel: 'Confirm Assets' },
  B8: { title: STAGE_NAMES.B8, desc: 'Capture the custodian\'s preferred courier and their exact branch before the endorsement can send - a reply is requested within 1 business day, and this is required before the courier endorsement can go out.', kind: 'branch', actionLabel: 'Confirm Branch' },
  B9: { title: STAGE_NAMES.B9, desc: 'Sent to the courier\'s corporate account manager, choose the email to send, then confirm.', kind: 'template-send', actionLabel: 'Send Courier Endorsement' },
  A6: { title: STAGE_NAMES.A6, desc: 'Due within 1 business day of the verified asset list, no later than the Last Working Day.', kind: 'template-send', actionLabel: 'Send Retrieval Notice' },
  A7: { title: STAGE_NAMES.A7, desc: 'Call the same day the notice goes out. Up to 3 attempts, each logged. A text follows any attempt that goes unanswered.', kind: 'calllog' },
  A8: { title: STAGE_NAMES.A8, desc: 'A midpoint and a final reminder as the Target Date approaches, each independently optional if not needed.', kind: 'reminders' },
  B11: { title: STAGE_NAMES.B11, desc: 'Custodian has handed off the equipment to the courier. Capturing the tracking or reference number below halts the Overdue Return countdown.', kind: 'transit', actionLabel: 'Confirm In Transit' },
  A9: { title: STAGE_NAMES.A9, desc: 'Waiting for the equipment to come back by the Target Date below.', kind: 'awaiting-return', actionLabel: 'Mark Equipment Received', systemNote: 'If the Target Date passes with nothing recorded, the ticket automatically moves to Overdue Return - no operator action triggers it.' },
  A10: { title: STAGE_NAMES.A10, desc: 'Closure is blocked until both a signed Proof-of-Receipt and condition photos are on file. Once both are in, the ticket moves to Hold Off.', kind: 'evidence', actionLabel: 'Confirm Evidence Complete' },
  A11: { title: STAGE_NAMES.A11, desc: 'Only relevant if an item came back damaged or didn\'t come back at all. Started within 1-2 business days of that being confirmed, on a signed Authority to Deduct.', kind: 'deduction' },
  A12: { title: STAGE_NAMES.A12, desc: 'Check condition and send each returned item to its next stop: stock, servicing, or disposal.', kind: 'inspection', actionLabel: 'Confirm Inspection & Routing' },
  A13: { title: STAGE_NAMES.A13, desc: 'Everything above is complete. Review the final state of this ticket before closing - this is the last checkpoint, not just a formality.', kind: 'closure', actionLabel: 'Review & Close Ticket' }
}

// ---------------------------------------------------------------------------
// Demo seed data - gives the Overview list something real to show (one
// ticket per interesting state) without requiring a live backend. Each seed
// ticket is created through the same createTicket() every real ticket goes
// through, then fast-forwarded directly to its target state (rather than
// replaying every stage click) purely for demo purposes.
let seeded = false

function byEmpId(id: string): HrisRecord {
  return HRIS_DIRECTORY.find(e => e.id === id) ?? HRIS_DIRECTORY[0]!
}

/** Every seed ticket below is fast-forwarded past A4, so its Lock record is already fully confirmed - scheduled and executed - rather than left half-done. */
function finalizeItLock(t: Ticket) {
  t.itLock = { scheduledConfirmed: true, scheduledFor: t.lwd, executedConfirmed: true }
}

export function seedDemoTickets() {
  if (seeded) return
  seeded = true

  // In Transit (remote) - Marisol Ferrer
  {
    const emp = byEmpId('EMP-04821')
    const t = createTicket(emp, emp.suggestedReason, 'remote', emp.lwd, emp.sep, 'PC-END-2026-0417', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    confirmCourierBranch(t, recommendedCourierProvider()!.id, 'JRS Express - Cebu IT Park Branch', emp.address, 'call')
    t.gatesReleased = t.gateCount
    pushHistory(t, 'Courier endorsement sent')
    t.stageIdx = stageListFor(t.mode).indexOf('B11')
    pushHistory(t, 'Retrieval notice sent (email + SMS)')
    pushHistory(t, 'Marked In Transit')
  }

  // Overdue Return (onsite) - Rafael Tan
  {
    const emp = byEmpId('EMP-02214')
    const t = createTicket(emp, emp.suggestedReason, 'onsite', emp.lwd, emp.sep, 'PC-END-2026-0301', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    t.gatesReleased = t.gateCount
    t.overdueForced = true
    pushHistory(t, 'Retrieval notice sent')
  }

  // Blocked - Gate (remote, Unexplained Absence, 3 gates, none released yet) - Andrea Villar.
  // Branch confirmation (B8) is an internal capture, not a team-member-facing
  // send, so it isn't held up by the gate the way B9's actual endorsement
  // send is - the ticket's true current stage is B9 itself (blocked), not A6.
  {
    const emp = byEmpId('EMP-05102')
    const t = createTicket(emp, emp.suggestedReason, 'remote', emp.lwd || new Date().toISOString().slice(0, 10), emp.sep || '', '', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    confirmCourierBranch(t, recommendedCourierProvider()!.id, 'JRS Express - Davao Branch', emp.address, 'call')
    t.stageIdx = stageListFor(t.mode).indexOf('B9')
  }

  // Hold Off (onsite, evidence pending) - Kevin Ong... reassigned to Josef Cruz's Hold Off slot per Overview demo row
  {
    const emp = byEmpId('EMP-01187')
    const t = createTicket(emp, emp.suggestedReason, 'remote', emp.lwd, emp.sep, 'PC-END-2026-0290', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    confirmCourierBranch(t, recommendedCourierProvider()!.id, 'JRS Express - Iloilo Branch', emp.address, 'call')
    t.gatesReleased = t.gateCount
    pushHistory(t, 'Courier endorsement sent')
    t.stageIdx = stageListFor(t.mode).indexOf('A10')
    pushHistory(t, 'Marked In Transit')
    pushHistory(t, 'Assets physically received')
  }

  // Closed (onsite) - Kevin Ong
  {
    const emp = byEmpId('EMP-03310')
    const t = createTicket(emp, emp.suggestedReason, 'onsite', emp.lwd, emp.sep, 'PC-END-2026-0155', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    t.gatesReleased = t.gateCount
    t.stageIdx = stageListFor(t.mode).length - 1
    t.status = 'closed'
    pushHistory(t, 'Ticket Closed')
  }
}

/** Overview status pill label for a ticket, mirroring the prototype's status-pill logic. */
export function ticketStatusLabel(ticket: Ticket): string {
  if (ticket.status === 'closed') return 'Closed'
  if (ticket.overdueForced) return 'Overdue Return'
  const key = currentStageKey(ticket)
  if (!key) return 'Ready to Close'
  if (key === 'B11' || key === 'B11a') return 'In Transit'
  if (key === 'A10' || key === 'A11' || key === 'A12') return 'Hold Off'
  if (SEND_STAGES.includes(key) && sendsBlocked(ticket)) return 'Blocked - Gate'
  return STAGE_NAMES[key]
}

export function ticketStatusTone(ticket: Ticket): 'open' | 'closed' | 'overdue' | 'holdoff' | 'transit' | 'blocked' {
  if (ticket.status === 'closed') return 'closed'
  if (ticket.overdueForced) return 'overdue'
  const key = currentStageKey(ticket)
  if (!key) return 'open'
  if (key === 'B11' || key === 'B11a') return 'transit'
  if (key === 'A10' || key === 'A11' || key === 'A12') return 'holdoff'
  if (SEND_STAGES.includes(key) && sendsBlocked(ticket)) return 'blocked'
  return 'open'
}

/** True once a ticket has reached or passed a given stage (by raw list position, ignoring the skip-resolution `currentStageKey` does) - used to derive "has the notice gone out yet" style Overview columns without re-deriving the whole stage engine there. */
export function hasReachedStage(ticket: Ticket, stage: StageKey): boolean {
  const list = stageListFor(ticket.mode)
  const target = list.indexOf(stage)
  if (target === -1) return false
  return ticket.stageIdx >= target || ticket.status === 'closed'
}

export interface FormBadge { label: string, tone: 'warning' | 'success' }

/**
 * Overview "Forms" column - every form artifact this ticket has touched so
 * far (Equipment Return Acknowledgment, Courier Authorization, Proof-of-
 * Receipt, Authority to Deduct), each an unfilled-form acronym in warning
 * color that gains a trailing checkmark in success color once actually
 * produced - an empty array (no badges at all) before the notice has gone
 * out, matching the real table's empty form slots for a ticket that hasn't
 * reached that point. A ticket further along its lifecycle can accumulate
 * several of these at once - the Overview renders only the first couple
 * inline plus a "+N" overflow, so this list can grow without blowing up the
 * row height (see index.vue).
 */
export function formsColumnsFor(ticket: Ticket): FormBadge[] {
  const badges: FormBadge[] = []
  if (hasReachedStage(ticket, 'A6') || hasReachedStage(ticket, 'B9')) {
    badges.push(hasReachedStage(ticket, 'A10') ? { label: 'ERAF ✓', tone: 'success' } : { label: 'ERAF', tone: 'warning' })
  }
  if (ticket.mode === 'remote' && hasReachedStage(ticket, 'B9')) {
    badges.push({ label: 'CA ✓', tone: 'success' })
  }
  if (hasReachedStage(ticket, 'A10')) {
    badges.push({ label: 'POR ✓', tone: 'success' })
  }
  if (ticket.history.some(h => h.action.includes('Deduction initiated'))) {
    badges.push({ label: 'ATD ✓', tone: 'success' })
  }
  return badges
}

/** "Nd left" / "Overdue by Nd" countdown text for the Return Deadline column. */
export function daysLeftLabel(ticket: Ticket): string | null {
  if (!ticket.targetDateISO) return null
  const target = new Date(ticket.targetDateISO)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (ticket.status === 'closed') return null
  if (days < 0 || ticket.overdueForced) return `Overdue by ${Math.abs(days)}d`
  return `${days}d left`
}
