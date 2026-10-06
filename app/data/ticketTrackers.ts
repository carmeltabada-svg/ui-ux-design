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
import { reactive, ref } from 'vue'
import { DEFAULT_CHECKLIST_TASKS, checklistTemplateFor, type ChecklistTask } from './checklistTemplates'
import { TEMPLATES } from './templates'
import { ensureTemplateRuntime, TEMPLATE_RUNTIME } from './templateRuntime'
import { RETRIEVAL_FORMS } from './retrievalForms'

export type TicketReason = 'resignation' | 'immediate-resignation' | 'end-of-contract' | 'recalled' | 'unexplained-absence'

/** Post-Retrieval Charging Console v1.0's 4-way branch (see retrieval-ticket-module/POST_RETRIEVAL_CHARGING_ALIGNMENT_NOTES.md) - what A11 resolves to once "Item Damaged or Not Returned" is picked. Each maps to exactly one email (T22-T25) and, except 'no-charge', one form (F1-F3) - see DEDUCTION_OUTCOME_META in [id].vue for the actual copy/mapping. The templates themselves aren't authored in Templates yet (flagged as an open item), so this only drives the outcome-selector UI for now, not a real attachment. */
export type DeductionOutcome = 'no-charge' | 'quotation-pending' | 'charge' | 'settlement'
/**
 * The real mapping T22-T25/F1-F3 now that both exist (see templates.ts and
 * retrievalForms.ts) - Case Details Steps 3/4 landing first is what unblocked
 * this; before that, picking an outcome couldn't honestly happen since it
 * depends on data those steps collect (a quotation amount, whether a charge
 * is even proposed - see this file's earlier "removed as premature" note,
 * still visible in [id].vue's git history/comments). `templateKey` is a real
 * TEMPLATES key (templates.ts); `formId` is a real RETRIEVAL_FORMS id
 * (retrievalForms.ts), null for 'no-charge' since T22 carries no attachment.
 */
export const DEDUCTION_OUTCOME_META: Record<DeductionOutcome, { label: string, description: string, templateKey: string, formId: string | null }> = {
  'no-charge': { label: 'No Charge', description: 'Fair wear and tear, nothing chargeable. Closes the matter outright.', templateKey: 't22', formId: null },
  'quotation-pending': { label: 'Quotation Pending', description: 'Damage found, repair quotation not back yet. An interim state, not an authority to deduct.', templateKey: 't23', formId: 'notice-assessment-quotation-pending' },
  charge: { label: 'Determination & Charge', description: 'Quotation back, amount determined, a charge is proposed.', templateKey: 't24', formId: 'atd-loss-damage-non-return' },
  settlement: { label: 'Settlement Election', description: "The team member elects to keep the equipment and pay for it instead of returning it.", templateKey: 't25', formId: 'atd-settlement-transfer' }
}
/** Case Details Step 4's own "Basis of the amount" dropdown, verbatim from the reference console (see retrieval-ticket-module/POST_RETRIEVAL_CHARGING_ALIGNMENT_NOTES.md, Case Details > Amount). */
export type DeductionAmountBasis = 'quotation' | 'replacement-cost' | 'net-book-value' | 'component-cost' | 'program-price'
export const DEDUCTION_AMOUNT_BASIS_LABELS: Record<DeductionAmountBasis, string> = {
  quotation: 'Documented repair quotation',
  'replacement-cost': 'Replacement cost per the Asset Register',
  'net-book-value': 'Net book value per the Asset Register',
  'component-cost': 'Component or accessory cost only',
  'program-price': 'Program price, buyout or decommissioned unit'
}
/** Which bases of the amount apply to which outcome (reference console): a charge has no program price, a settlement has no repair quotation or component cost. No Charge and Quotation Pending carry no amount. */
export const DEDUCTION_BASES_BY_OUTCOME: Partial<Record<DeductionOutcome, DeductionAmountBasis[]>> = {
  charge: ['quotation', 'replacement-cost', 'net-book-value', 'component-cost'],
  settlement: ['net-book-value', 'replacement-cost', 'program-price']
}
/** Case Details, Dates: the date fields each outcome's email and form actually print. "received" is dropped for a case whose equipment was never returned. */
export type DeductionDateKey = 'received' | 'deductionCaseAssessedDate' | 'deductionCaseBuyoutElectionDate' | 'deductionCaseQuotationExpectedDate' | 'deductionCaseHearBackByDate' | 'deductionCaseResponseDueDate'
export const DEDUCTION_DATES_BY_OUTCOME: Record<DeductionOutcome, DeductionDateKey[]> = {
  'no-charge': ['received', 'deductionCaseAssessedDate'],
  'quotation-pending': ['received', 'deductionCaseAssessedDate', 'deductionCaseQuotationExpectedDate', 'deductionCaseHearBackByDate', 'deductionCaseResponseDueDate'],
  charge: ['received', 'deductionCaseAssessedDate', 'deductionCaseResponseDueDate'],
  settlement: ['deductionCaseBuyoutElectionDate', 'deductionCaseResponseDueDate']
}
export type TicketMode = 'onsite' | 'remote'

/** Asset Team members a ticket can be assigned to. `D. Reyes` is treated as the current logged-in operator for this module (Ticket Tracker's own persona - distinct from CURRENT_USER_NAME in templateRuntime.ts, which is the app-wide signed-in designer account shown in the sidebar footer), so "My Tickets" and assignee-notification routing both resolve against it. */
export interface AssetTeamMember {
  name: string
  email: string
}

export const ASSET_TEAM_MEMBERS: AssetTeamMember[] = [
  { name: 'D. Reyes', email: 'd.reyes@goteam.io' },
  { name: 'J. Santos', email: 'j.santos@goteam.io' },
  { name: 'M. Bautista', email: 'm.bautista@goteam.io' }
]

/** The Asset Team member the app acts as when nobody has switched. */
export const CURRENT_ASSIGNEE_NAME = 'D. Reyes'

// Simulation Control can switch who the app acts as, so assignments, "My
// Tickets", takeover and every Activity Log actor can be tried as different
// people. Remembered in this browser; a real app would read it from sign-in.
const CURRENT_USER_KEY = 'ams:demo:currentUser'
function readCurrentUser(): string {
  if (typeof window === 'undefined') return CURRENT_ASSIGNEE_NAME
  try {
    const saved = localStorage.getItem(CURRENT_USER_KEY)
    return ASSET_TEAM_MEMBERS.some(m => m.name === saved) ? saved! : CURRENT_ASSIGNEE_NAME
  } catch { return CURRENT_ASSIGNEE_NAME }
}
const currentUser = ref(readCurrentUser())
/** Who is using the app right now. Reactive, so anything reading it updates when the user is switched. */
export function currentUserName(): string { return currentUser.value }
export function setCurrentUser(name: string) {
  if (!ASSET_TEAM_MEMBERS.some(m => m.name === name)) return
  currentUser.value = name
  try { localStorage.setItem(CURRENT_USER_KEY, name) } catch { /* storage unavailable: lasts for this session */ }
}

export function assetTeamMemberByName(name: string): AssetTeamMember {
  return ASSET_TEAM_MEMBERS.find(m => m.name === name) ?? ASSET_TEAM_MEMBERS[0]!
}

export const REASON_LABELS: Record<TicketReason, string> = {
  resignation: 'Resignation',
  'immediate-resignation': 'Immediate Resignation',
  'end-of-contract': 'End of Contract',
  recalled: 'Recalled',
  'unexplained-absence': 'Unexplained Absence'
}

/** The machine-readable form of a path's deadline (FR-003.2): the Target Date defaults to `days` after the date the deadline is counted from. */
interface DeadlineRule {
  from: 'lwd' | 'notice' | 'recall'
  days: number
  unit: 'calendar' | 'business'
}

interface ModePath {
  anchor: string
  deadline: string
  rule: DeadlineRule
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
 * Resignation) carry NO gate; involuntary single-gate paths (End
 * of Contract, Recalled) carry ONE gate on the P&C notification; Unexplained
 * Absence carries THREE sequential gates (see GATE_STEPS) - not two, an
 * earlier misreading corrected against the source PDF (FR-003.5).
 * P12: Unexplained Absence has no onsite path at all (`onsite: null`) - it is
 * not offered, never just disabled.
 */
export const MATRIX: Record<TicketReason, MatrixEntry> = {
  // Anchors, deadlines and senders follow the FR-003.2 path table (P01 to P12).
  // `rule` is the Target Date default: the last working day for a "within the
  // last 2 days of work" path, 3 calendar days after it for a remote drop-off.
  resignation: {
    gateCount: 0,
    onsite: { anchor: 'Last Working Day', deadline: 'Within the last 2 days of work', rule: { from: 'lwd', days: 0, unit: 'calendar' }, sender: 'Asset Team', templateKey: 't1' },
    remote: { anchor: 'Last Working Day', deadline: 'Drop off within 3 calendar days after the last working day, with the courier arranged before it', rule: { from: 'lwd', days: 3, unit: 'calendar' }, sender: 'Asset Team', templateKey: 't2' }
  },
  'immediate-resignation': {
    gateCount: 0,
    onsite: { anchor: 'Notice date', deadline: 'Before the end of shift on the notice date, or the next working day if not on site. Escalates after 3 calendar days', rule: { from: 'notice', days: 0, unit: 'calendar' }, sender: 'Asset Team', templateKey: 't3' },
    remote: { anchor: 'Notice date', deadline: 'Ship as soon as possible. Escalates after 3 calendar days from the notice', rule: { from: 'notice', days: 3, unit: 'calendar' }, sender: 'Asset Team', templateKey: 't4' }
  },
  'end-of-contract': {
    gateCount: 1,
    onsite: { anchor: 'Last Working Day', deadline: 'Within the last 2 days of work', rule: { from: 'lwd', days: 0, unit: 'calendar' }, sender: 'People & Culture and Asset Team', templateKey: 't5' },
    remote: { anchor: 'Last Working Day', deadline: 'Drop off within 3 calendar days after the last working day, with the courier arranged before it', rule: { from: 'lwd', days: 3, unit: 'calendar' }, sender: 'People & Culture and Asset Team', templateKey: 't6' }
  },
  recalled: {
    gateCount: 1,
    onsite: { anchor: 'Recall Effective Date', deadline: 'Same as End of Contract, counted from the recall date', rule: { from: 'recall', days: 0, unit: 'calendar' }, sender: 'Asset Team', templateKey: 't9' },
    remote: { anchor: 'Recall Effective Date', deadline: 'Same as End of Contract, counted from the recall date', rule: { from: 'recall', days: 3, unit: 'calendar' }, sender: 'Asset Team', templateKey: 't10' }
  },
  'unexplained-absence': {
    gateCount: 3,
    onsite: null, // P12 - not offered
    // The spec anchors this path on the Gate 3 release date. Kept on Last
    // Working Day (product decision, 2026-09-23): gates are advisory only, so
    // the Target Date can't depend on one ever being recorded.
    remote: { anchor: 'Last Working Day', deadline: '3 calendar days after the last working day', rule: { from: 'lwd', days: 3, unit: 'calendar' }, sender: 'People & Culture and Asset Team', templateKey: 't11' }
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
/** Public acknowledgment form host. A placeholder: no page serves it yet, swap this one constant when the real public form is deployed. */
export const ACKNOWLEDGMENT_HOST = 'https://forms.go.team/acknowledgment'

export interface CourierProvider {
  id: string
  name: string
  priority: 'recommended' | 'alternate'
  accountManager: string
  accountManagerEmail: string
  corporateAccount: boolean
  /** GoTeam's corporate account number with this courier, printed on the courier authorization (COURIER_ACCOUNT_NUMBER). */
  accountNumber: string
  status: 'active' | 'inactive'
  /** The courier's own tracking website, held once here rather than typed into a template - lets a B11 tracking link be checked against this provider's real domain instead of a hardcoded list. */
  trackingWebsiteUrl: string
}

export const COURIER_PROVIDERS: CourierProvider[] = [
  { id: 'jrs-express', name: 'JRS Express', priority: 'recommended', accountManager: 'Nico Dalisay', accountManagerEmail: 'nico.dalisay@jrs-express.com.ph', corporateAccount: true, accountNumber: '4471-2209-13', status: 'active', trackingWebsiteUrl: 'https://www.jrs-express.com' },
  { id: 'jt-express', name: 'J&T Express', priority: 'alternate', accountManager: 'Mia Santos', accountManagerEmail: 'mia.santos@jtexpress.ph', corporateAccount: true, accountNumber: '8802-5517-40', status: 'active', trackingWebsiteUrl: 'https://www.jtexpress.ph' },
  { id: 'lbc-express', name: 'LBC Express', priority: 'alternate', accountManager: 'Carlo Reyes', accountManagerEmail: 'carlo.reyes@lbcexpress.com', corporateAccount: true, accountNumber: '0192-8834-01', status: 'active', trackingWebsiteUrl: 'https://www.lbcexpress.com' }
]

export function recommendedCourierProvider(): CourierProvider | null {
  return COURIER_PROVIDERS.find(p => p.status === 'active' && p.priority === 'recommended') ?? COURIER_PROVIDERS.find(p => p.status === 'active') ?? null
}

export function courierProviderById(id: string | null): CourierProvider | null {
  if (!id) return null
  return COURIER_PROVIDERS.find(p => p.id === id) ?? null
}

/**
 * Branch directory, as-is. FR-003.9 requires branch-level specificity for
 * JRS Express (GoTeam endorses to a NAMED branch, not just the carrier), but
 * this app has no live courier API and no Master Data feature yet for the
 * Asset Team to maintain a real branch list - keying in JRS's 450+
 * nationwide branches by hand isn't practical, so in production this needs
 * either a courier API integration or a Master Data upload (CSV/JSON) that
 * this front-end can read, not a manually-typed free-text field.
 *
 * This session checked jrs-express.com/branches directly - only the Head
 * Office (Pasig) address below is a real, verified address from that page;
 * the branch locator's full nationwide list is behind an interactive
 * search widget this session couldn't script through. The remaining
 * entries follow this codebase's existing seed-data convention of named
 * but illustrative branches (the seed tickets already used placeholder
 * names like "JRS Express - Cebu IT Park Branch" before this change) -
 * they stand in for what a real directory would return, not a claim that
 * these are verified live addresses.
 */
export interface CourierBranch {
  id: string
  courierId: string
  name: string
  address: string
  /** Matched against the team member's on-file address (a plain substring check, not real geocoding - this app has no geolocation service) to auto-suggest the nearest branch. */
  city: string
}

export const COURIER_BRANCHES: CourierBranch[] = [
  { id: 'jrs-pasig-ho', courierId: 'jrs-express', name: 'JRS Express - Head Office (Pasig)', address: 'No. 19 Brixton Street, Barangay Kapitolyo, Pasig City, Metro Manila', city: 'Manila' },
  { id: 'jrs-cebu-itpark', courierId: 'jrs-express', name: 'JRS Express - Cebu IT Park Branch', address: 'Cebu IT Park, Lahug, Cebu City, Cebu', city: 'Cebu' },
  { id: 'jrs-davao', courierId: 'jrs-express', name: 'JRS Express - Davao Branch', address: 'Quimpo Blvd, Talomo, Davao City, Davao del Sur', city: 'Davao' },
  { id: 'jrs-iloilo', courierId: 'jrs-express', name: 'JRS Express - Iloilo Branch', address: 'Diversion Road, Mandurriao, Iloilo City, Iloilo', city: 'Iloilo' },
  { id: 'jrs-baguio', courierId: 'jrs-express', name: 'JRS Express - Baguio Branch', address: 'Session Road, Baguio City, Benguet', city: 'Baguio' },
  { id: 'jt-manila', courierId: 'jt-express', name: 'J&T Express - Manila Hub', address: 'Barangay San Antonio, Pasig City, Metro Manila', city: 'Manila' },
  { id: 'jt-cebu', courierId: 'jt-express', name: 'J&T Express - Cebu Branch', address: 'Mandaue City, Cebu', city: 'Cebu' },
  { id: 'jt-davao', courierId: 'jt-express', name: 'J&T Express - Davao Branch', address: 'Buhangin, Davao City, Davao del Sur', city: 'Davao' },
  { id: 'lbc-manila', courierId: 'lbc-express', name: 'LBC Express - Manila Branch', address: 'United Nations Avenue, Manila, Metro Manila', city: 'Manila' },
  { id: 'lbc-cebu', courierId: 'lbc-express', name: 'LBC Express - Cebu Branch', address: 'Osmena Blvd, Cebu City, Cebu', city: 'Cebu' },
  { id: 'lbc-iloilo', courierId: 'lbc-express', name: 'LBC Express - Iloilo Branch', address: 'Diversion Road, Iloilo City, Iloilo', city: 'Iloilo' }
]

export function branchesForCourier(courierId: string | null): CourierBranch[] {
  if (!courierId) return []
  return COURIER_BRANCHES.filter(b => b.courierId === courierId)
}

export function courierBranchById(id: string | null): CourierBranch | null {
  if (!id) return null
  return COURIER_BRANCHES.find(b => b.id === id) ?? null
}

/** Best-effort nearest-branch match against the team member's on-file address (see CourierBranch.city's own note) - falls back to that courier's first branch if nothing matches. */
export function nearestBranchFor(courierId: string | null, employeeAddress: string): CourierBranch | null {
  const branches = branchesForCourier(courierId)
  if (!branches.length) return null
  const addr = employeeAddress.toLowerCase()
  return branches.find(b => addr.includes(b.city.toLowerCase())) ?? branches[0]!
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
  notYetConfirmed: string
}

/**
 * Unexplained Absence's 3 sequential gates - each releases something
 * different. Only ever used when gateCount === 3.
 *
 * Advisory only (product decision, 2026-09-23): gates are recorded for
 * P&C's own compliance record and to mark when the formal deadline/
 * consequence clock starts, but they never block a stage or a send in
 * this module - P&C users work this system too, and an unrecorded gate is
 * not a reason a ticket can't move. See `notYetConfirmed` as "what P&C
 * hasn't formally confirmed yet", not "what's locked".
 */
export const GATE_STEPS: GateStep[] = [
  { n: 1, label: 'Gate 1 - Absence of Endorsement', unlocks: 'Confirms the absence has been formally endorsed by P&C.', notYetConfirmed: 'All team-member-facing sends' },
  { n: 2, label: 'Gate 2 - Return-to-Work Notice and Notice to Explain', unlocks: 'Confirms P&C has issued the Return-to-Work notice and the first Notice to Explain.', notYetConfirmed: 'The full retrieval instruction' },
  { n: 3, label: 'Gate 3 - Termination and Retrieval Endorsement', unlocks: 'Confirms P&C has endorsed the termination and the retrieval.', notYetConfirmed: 'Nothing further' }
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
 *
 * A11 is the one deliberate, explicitly-approved exception. The literal PDF
 * text ("Deduction, where applicable") was flagged live twice as reading
 * poorly on screen - "where applicable" is redundant once the operator has
 * already picked "Item Damaged or Not Returned" over "Not Applicable" (the
 * choice that gates entry to this stage in the first place), and "where
 * applicable" trimmed away leaves bare "Deduction," too vague on its own.
 * Renamed to "Post-Retrieval Charging" - the reference console this stage's
 * real fields/forms/emails are being built from (Post-Retrieval Charging
 * Console v1.0, see retrieval-ticket-module/POST_RETRIEVAL_CHARGING_ALIGNMENT_NOTES.md)
 * carries that exact name, so this isn't an invented label - it's this
 * stage's own real, externally-sourced name, just not the FR-003 PDF's.
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
  A11: 'Post-Retrieval Charging',
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

/** True only for Unexplained Absence between Gate 2 and Gate 3 - the one window where the lighter-weight T19 Equipment Safekeeping Request (no deadline, no consequence) is the recommended send, ahead of the full retrieval instruction which only formally starts its clock once Gate 3 is recorded. Advisory, same as the gates themselves - not an exclusive/blocking alternative. */
export function safekeepingAvailable(ticket: Pick<Ticket, 'gateCount' | 'gatesReleased'>): boolean {
  return ticket.gateCount === 3 && ticket.gatesReleased >= 2 && ticket.gatesReleased < 3
}

export function resolvedPathFor(reason: TicketReason, mode: TicketMode): ModePath | null {
  return MATRIX[reason]?.[mode] ?? null
}

/** Looks up a resolved template's real subject/body/attachment via the live TEMPLATE_RUNTIME store (so an edit made in Templates shows up here too, not a frozen copy). */
export function templateForKey(key: string) {
  // A template created in the Templates page has no seed entry, only a runtime one.
  if (!TEMPLATES[key] && !TEMPLATE_RUNTIME[key]) return null
  return ensureTemplateRuntime(key)
}

export function attachedFormFor(mode: TicketMode) {
  const id = RETURN_ACK_FORM_ID[mode]
  return RETRIEVAL_FORMS.find(f => f.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Real asset catalog - the canonical set of asset-name categories GoTeam's
// own inventory uses (distinct from an asset's specific product/model, e.g.
// "Laptop" the category vs. "MacBook Pro 14\" M3" the model). Drives both the
// per-item icon (previously every asset rendered the same hardcoded laptop
// icon regardless of what it actually was) and the 3-value Asset Type
// classification (Computer Equipment / Furniture and Fixtures / Office
// Equipment) used across the real system. `assetCatalogEntry()` falls back
// to a generic type/icon for a name outside this catalog (e.g. a pre-existing
// localStorage snapshot's old free-text asset name) rather than throwing.
export type AssetType = 'Computer Equipment' | 'Furniture and Fixtures' | 'Office Equipment'
interface AssetCatalogEntry { type: AssetType, icon: string }
export const ASSET_CATALOG: Record<string, AssetCatalogEntry> = {
  'Desktop': { type: 'Computer Equipment', icon: 'i-lucide-computer' },
  'Display Adapter': { type: 'Computer Equipment', icon: 'i-lucide-arrow-left-right' },
  'Display Cable': { type: 'Computer Equipment', icon: 'i-lucide-cable' },
  'Docking Station': { type: 'Computer Equipment', icon: 'i-lucide-server' },
  'Headset': { type: 'Computer Equipment', icon: 'i-lucide-headphones' },
  'Keyboard': { type: 'Computer Equipment', icon: 'i-lucide-keyboard' },
  'Keyboard & Mouse': { type: 'Computer Equipment', icon: 'i-lucide-keyboard' },
  'Laptop': { type: 'Computer Equipment', icon: 'i-lucide-laptop' },
  'Laptop Charger': { type: 'Computer Equipment', icon: 'i-lucide-zap' },
  'Monitor': { type: 'Computer Equipment', icon: 'i-lucide-monitor' },
  'Mouse': { type: 'Computer Equipment', icon: 'i-lucide-mouse' },
  'Other Peripherals': { type: 'Office Equipment', icon: 'i-lucide-circle-help' },
  'USB Hub': { type: 'Computer Equipment', icon: 'i-lucide-usb' },
  'Webcam': { type: 'Computer Equipment', icon: 'i-lucide-webcam' },
  'Company Badge': { type: 'Office Equipment', icon: 'i-lucide-id-card' },
  'External SSD': { type: 'Computer Equipment', icon: 'i-lucide-hard-drive' }
}
export function assetCatalogEntry(name: string): AssetCatalogEntry {
  return ASSET_CATALOG[name] ?? { type: 'Office Equipment', icon: 'i-lucide-package' }
}

// Per-category icon for the Type column itself (distinct from
// assetCatalogEntry's per-item icon above, which is specific to the exact
// asset name) - the Type column previously rendered as plain text with no
// icon at all anywhere it was shown.
export const ASSET_TYPE_ICON: Record<AssetType, string> = {
  'Computer Equipment': 'i-lucide-monitor-speaker',
  'Furniture and Fixtures': 'i-lucide-sofa',
  'Office Equipment': 'i-lucide-warehouse'
}
export function assetTypeIcon(type: AssetType): string {
  return ASSET_TYPE_ICON[type]
}

/** One real, physical asset unit on an employee's HRIS record - `name` is the canonical catalog category (drives the icon/type), `model` the specific product string (e.g. what the `{{ASSET_NAME}}` template token actually prints). */
export interface HrisAsset {
  name: string
  model: string
}

// ---------------------------------------------------------------------------
// Mock HRIS directory - stands in for the real HRIS integration (FR-003.2/.7:
// R24 fields fetched at ticket creation). Employee identity/client/coach
// fields are R24 hard-truth (never editable in AMS); contact fields below are
// R24-sourced but editable/addable/verifiable in AMS (see Ticket.contact).
/**
 * A team member's regular shift. AMS does not store this: it is read from HRIS,
 * which owns scheduling. Times are 24-hour 'HH:MM' in the team member's local
 * time. A shift whose end is at or before its start runs overnight.
 */
export interface HrisShift {
  /** For example 'Mon to Fri'. */
  days: string
  start: string
  end: string
}

export interface HrisRecord {
  id: string
  /** From HRIS. Missing when HRIS has no schedule on file for this person. */
  shift?: HrisShift
  name: string
  /** The team member's own job title, e.g. "Software Engineer" - shown on send-recipient chips (RecipientChip) so a send target is identified by role, not by department (dept is a different, coarser grouping used elsewhere, e.g. the Overview table). */
  position: string
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
  assets: HrisAsset[]
}

// Andrea Villar (EMP-05102) below carries a real `lwd` even for Unexplained
// Absence - R24 tracks this the same as any other case (the last day she
// was actually at work, before the absence began), it's just in the past by
// the nature of an absence rather than a forward-scheduled date. `sep` stays
// blank: no separation has been decided for an ongoing absence case.
export const HRIS_DIRECTORY: HrisRecord[] = [
  { id: 'EMP-04821', shift: { days: 'Mon to Fri', start: '09:00', end: '18:00' }, name: 'Marisol Ferrer', position: 'Client Success Manager', dept: 'Client Success', client: 'Northwind Retail', email: 'm.ferrer@goteam.io', contactNumber: '+63 917 555 0142', personalEmail: 'marisol.ferrer88@gmail.com', altContactName: 'Liza Ferrer', altContactNumber: '+63 917 555 0199', leadershipCoach: 'Jerome Cruz - Team Lead', address: '142 Salinas Drive, Barangay Lahug, Cebu City, 6000 Cebu', addressMode: 'remote', caseType: 'Voluntary Resignation', suggestedReason: 'resignation', lwd: '2026-09-25', sep: '2026-09-30', assets: [{ name: 'Laptop', model: 'MacBook Pro 14" M3' }, { name: 'Mouse', model: 'Apple Magic Mouse' }, { name: 'Docking Station', model: 'CalDigit TS4' }, { name: 'Headset', model: 'Jabra Evolve2 65' }, { name: 'Laptop Charger', model: 'Apple 96W USB-C' }] },
  { id: 'EMP-03310', shift: { days: 'Mon to Fri', start: '10:00', end: '19:00' }, name: 'Kevin Ong', position: 'Software Engineer', dept: 'Engineering', client: 'Internal', email: 'k.ong@goteam.io', contactNumber: '+63 917 555 0210', personalEmail: '', altContactName: '', altContactNumber: '', leadershipCoach: 'Miguel Ramos - Engineering Manager', address: '88 Jose Abad Santos Ave, Barangay Tondo, Manila, 1012 Metro Manila', addressMode: 'onsite', caseType: 'Contract End', suggestedReason: 'end-of-contract', lwd: '2026-10-01', sep: '2026-10-05', assets: [{ name: 'Laptop', model: 'Lenovo ThinkPad X1 Carbon Gen 11' }, { name: 'Monitor', model: 'Dell UltraSharp 27" U2723QE' }, { name: 'Docking Station', model: 'Lenovo ThinkPad USB-C Dock Gen 2' }, { name: 'Keyboard & Mouse', model: 'Logitech MK540' }] },
  { id: 'EMP-05102', shift: { days: 'Mon to Fri', start: '08:00', end: '17:00' }, name: 'Andrea Villar', position: 'People & Culture Associate', dept: 'People & Culture', client: 'Internal', email: 'a.villar@goteam.io', contactNumber: '', personalEmail: 'andrea.v.villar@yahoo.com', altContactName: 'Ramon Villar', altContactNumber: '+63 917 555 0341', leadershipCoach: 'Sophia Reyes - HRBP', address: '27 Quimpo Blvd, Barangay Talomo, Davao City, 8000 Davao del Sur', addressMode: 'remote', caseType: 'Unexplained Absence Case', suggestedReason: 'unexplained-absence', lwd: '2026-09-21', sep: '2026-09-28', assets: [{ name: 'Laptop', model: 'MacBook Air 13" M2' }, { name: 'Webcam', model: 'Logitech Brio 505' }, { name: 'Headset', model: 'Jabra Evolve2 40' }] },
  { id: 'EMP-02214', shift: { days: 'Mon to Fri', start: '07:00', end: '16:00' }, name: 'Rafael Tan', position: 'Financial Analyst', dept: 'Finance', client: 'Meridian Logistics', email: 'r.tan@goteam.io', contactNumber: '+63 917 555 0455', personalEmail: 'rtan.finance@gmail.com', altContactName: 'Grace Tan', altContactNumber: '+63 917 555 0460', leadershipCoach: 'Patricia Villanueva - Finance Manager', address: '212 United Nations Ave, Barangay Malate, Manila, 1004 Metro Manila', addressMode: 'onsite', caseType: 'Immediate Resignation', suggestedReason: 'immediate-resignation', lwd: '2026-09-16', sep: '2026-09-16', assets: [{ name: 'Laptop', model: 'MacBook Pro 13" M2' }, { name: 'External SSD', model: 'Samsung T7 1TB' }, { name: 'Laptop Charger', model: 'Apple 67W USB-C' }] },
  { id: 'EMP-01187', shift: { days: 'Mon to Fri', start: '22:00', end: '07:00' }, name: 'Josef Cruz', position: 'Operations Supervisor', dept: 'Operations', client: 'Meridian Logistics', email: 'j.cruz@goteam.io', contactNumber: '+63 917 555 0623', personalEmail: '', altContactName: 'Elena Cruz', altContactNumber: '+63 917 555 0630', leadershipCoach: 'Andres Fernandez - Operations Manager', address: '56 Diversion Road, Barangay Mandurriao, Iloilo City, 5000 Iloilo', addressMode: 'remote', caseType: 'Recall from Leave', suggestedReason: 'recalled', lwd: '2026-09-20', sep: '2026-09-22', assets: [{ name: 'Laptop', model: 'Lenovo ThinkPad T14 Gen 4' }, { name: 'Monitor', model: 'LG 24MK430H 24"' }, { name: 'Docking Station', model: 'Dell WD19S' }, { name: 'Headset', model: 'Plantronics Blackwire 3220' }, { name: 'USB Hub', model: 'Anker 7-in-1 USB-C Hub' }] }
]

// ---------------------------------------------------------------------------
// Runtime ticket store - one reactive record per created ticket, replacing
// the prototype's single set of module-level `let`s (stageIdx, gatesReleased,
// history, ...) with a real per-ticket record so multiple tickets (one per
// Overview row) can each hold their own independent state.

export interface TicketAsset {
  /** canonical catalog category (e.g. "Laptop") - drives the per-item icon/type via assetCatalogEntry(), not the specific product */
  name: string
  /** specific product/model (e.g. "MacBook Pro 14\" M3") - what the {{ASSET_NAME}} template token actually prints */
  model: string
  type: AssetType
  serial: string
  /** deterministic per (employee, position) - see assetTagFor(), same idiom as serialFor() below */
  assetTag: string
  /** editable only while `assetsLocked` is false (Setup/A5); read-only after */
  checked: boolean
  /** Free-text operator note on this specific asset (condition, a substitution, anything worth flagging) - matches the real Asset Items reference's own Remarks column. Editable any time, not locked with the rest of the row once assets are confirmed. */
  remarks: string
  /**
   * The closure-time outcome for this asset (Returned / Path to Charge / Keep
   * Open), set by confirmClosure() from the Closure modal's own per-asset
   * selector. Real, previously-shipped bug: that selector had no binding back
   * to the ticket at all - every choice was made, shown, then silently
   * discarded the moment the ticket closed, the same "looks functional but
   * the wiring was never finished" failure mode as A11 Deduction's unbound
   * inputs and Mode's discarded override reason. Null until closure.
   */
  resolution: 'returned' | 'charge' | 'open' | null
}

/**
 * Every real, distinct type of event that can land in the Activity Log -
 * this is what the drawer's own filter pills are built from, so it needs to
 * actually cover the real variety of things that happen on a ticket, not
 * lump most of them into one generic catch-all. `entry` is the closest
 * thing to a default (ticket creation/entry capture), but every
 * `pushHistory()` call site should pass the category that actually
 * describes it - see each call site's own comment for which one and why.
 */
export type HistoryCategory =
  | 'entry' // ticket creation, authorizing endorsement/LWD/Separation Date captured
  | 'asset' // asset list confirmed (FR-003.8c)
  | 'checklist' // A3 offboarding checklist items added/removed
  | 'itlock' // A4 IT lock scheduled/executed
  | 'branch' // B8 branch/courier capture, reply confirmation
  | 'send' // every outbound notice/reminder/endorsement/safekeeping request
  | 'call' // A7 call attempts
  | 'transit' // B11 confirmed in transit
  | 'return' // A10 evidence, A11 deduction, A12 inspection routing
  | 'gate' // FR-003.5 approval gate records
  | 'gatepass' // FR-003.11 Gate Pass issuance
  | 'rebaseline' // FR-003.8a Target Date changes
  | 'hris' // simulated HRIS/R24 sync
  | 'contact' // manual contact-number/personal-email verification
  | 'navigation' // Back/Forward/direct stage jumps - not a business event, but real log noise worth being able to filter out
  | 'closure' // ticket closed

export interface TicketHistoryEntry {
  action: string
  actor: string
  when: string
  category: HistoryCategory
}

export interface TicketCallAttempt {
  when: string
  outcome: 'No answer' | 'Answered - confirmed'
}

/** FR-003.8a - one recorded Target Date change. `wasOverdue` captures ref (b): a re-baseline is a correction, not a waiver, so the fact the ticket was already lapsed at the time of the edit is preserved even once the new date resolves it. `when` is a real ISO timestamp (FR-003.8a ref c explicitly names "timestamp"). */
export interface TargetDateRebaselineEntry {
  previousDateISO: string | null
  newDateISO: string
  reason: string
  actor: string
  when: string
  wasOverdue: boolean
}

export interface TicketContact {
  number: string
  numberVerified: boolean
  email: string
  emailVerified: boolean
  altName: string
  altNumber: string
}

/** A4 IT lock scheduling - FR-003.6 requires confirmation at two distinct points: on scheduling (the lock is booked) and on execution (it actually ran), not one bare click. `scheduledFor` is anchored after the last shift on the LWD per the doc. */
export interface TicketItLock {
  scheduledConfirmed: boolean
  scheduledFor: string | null
  executedConfirmed: boolean
}

/** A real uploaded file's name plus a local object URL - the shape every file-upload field on the ticket (gate evidence, A10 proof/condition) stores. */
export interface TicketFileRef {
  name: string
  url: string
}

export interface Ticket {
  id: string
  /** Plain numeric ticket id, e.g. 422 - the ticket's sole user-facing identifier, shown identically (no "#", no prefix) in both the Overview's Ticket # column and the workspace header. Matches the real Ticket Tracker product's own ticket numbering (see the extracted reference: "#710", not an APR-code). Distinct from `reference` below. */
  ticketNumber: number
  /** The FR-003 "APR-YY-NNNNN" retrieval reference (see FR-003.13 Open Item #5) - an internal tracking code carried on notices/forms, not a second user-facing ticket ID (there's no established APR-code convention elsewhere in the product, so it never appears as if it were an identifier alongside the ticket number). */
  reference: string
  employee: HrisRecord
  assignee: AssetTeamMember
  reason: TicketReason
  mode: TicketMode
  lwd: string
  sep: string
  authorizingEndorsement: string
  /** FR-003.4: "the date the Asset Team received it" - distinct from LWD/Separation Date and from the endorsement artifact itself (`authorizingEndorsement` above). The endorsement's issuing function (Asset Team vs. People & Culture) is not a separate operator-entered field - it's already resolved from the path configuration, see MATRIX[reason][mode].sender. */
  authorizingEndorsementDate: string
  gateCount: 0 | 1 | 3
  gatesReleased: number
  /** Free-text documentation note recorded with each gate release (who/what authorized it) - see FR-003.5's gate model. Required before a gate can be recorded; not just a bare confirm click. */
  gateNotes: Record<number, string>
  stageIdx: number
  /** High-water mark of `stageIdx`, never decremented by goBackStage - lets the operator step back to recheck something and then step forward again (goForwardStage) without redoing that stage's own action, while still never allowing a jump past a stage that hasn't actually been completed. */
  furthestStageIdx: number
  overdueForced: boolean
  /** Offboarding Checklist (A3) - FR-003.6 only names a timing rule for this stage ("Issued at notice. Final review no later than 3 business days before LWD"), it doesn't enumerate actual items, so this is per-ticket and editable (addChecklistItem/removeChecklistItem), seeded from OFFBOARDING_CHECKLIST_ITEMS as a starting point rather than fixed globally across every ticket. */
  checklistItems: string[]
  /** Completion, indexed 1:1 against checklistItems above (not the global OFFBOARDING_CHECKLIST_ITEMS default, since a ticket's own items can diverge from it once edited). */
  checklistDone: boolean[]
  /** Which tasks are optional, indexed 1:1 against checklistItems. An optional task never blocks the final review. Missing on older saved tickets, where every task is required. */
  checklistOptional?: boolean[]
  /** Who ticked each task, indexed 1:1 against checklistItems. Null when unticked or when it was ticked before this was recorded. */
  checklistDoneBy?: (string | null)[]
  /** The final review of the offboarding checklist (FR-003.6): who signed it off, when, and an optional note the reviewer may leave. Null until it is done. */
  checklistReview?: { by: string, at: string, note?: string } | null
  assetsLocked: boolean
  assets: TicketAsset[]
  targetDateISO: string | null
  callAttempts: TicketCallAttempt[]
  /** FR-003.6 A7: "SMS after an unanswered attempt" - copy-paste only (FR-003.12), no gateway, so this is the operator's own manual sent-confirmation, same pattern as every email send. Null until the 3-attempt cap is reached without an answer and the SMS is confirmed sent. */
  smsSentAt: string | null
  /** FR-003.12 companion SMS (SMS-1A to SMS-11): when the operator confirmed each was sent, keyed by code. Optional so older saved tickets still load. */
  smsSent?: Record<string, string>
  reminderCount: 0 | 1 | 2
  /** A9 Overdue - a real, durable sent-confirmation (same reasoning as smsSentAt above), not just a toast. Overdue reminders are legitimately repeatable (a ticket can sit overdue for a long stretch), so this doesn't gate the button shut the way smsSentAt does - it's the timestamp of the *last* send, kept visible so the operator can tell "already sent, X ago" from "never sent" without the toast's own message having to still be on screen. */
  overdueReminderSentAt: string | null
  /** How many times an overdue reminder has actually been sent on this ticket - shown alongside overdueReminderSentAt so "sent 3 times, last just now" reads differently from "sent once, an hour ago". */
  overdueReminderCount: number
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
  /** FR-003.9(a): the retrieval instructions request the preferred courier/branch/address from the team member with a reply requested within 1 business day - this is when that request was actually sent, so the 1-business-day clock has a real anchor. Null until sent. */
  branchRequestSentAt: string | null
  /** Template key the B8 branch reminder email was sent with (null = sent with no template attached), so the confirmed stage can show what actually went out. */
  branchRequestTemplateKey?: string | null
  /** A per-ticket correction to the team member's on-file address (B8), never a mutation of employee.address itself - that field is R24 hard-truth and never editable in AMS (see HrisRecord above). Null until the operator overrides it; effectiveTeamMemberAddress() below is what every read site should use instead of employee.address directly. */
  teamMemberAddressOverride: string | null
  /** True once the team member's email reply has been manually confirmed - this app has no live inbox integration, so there is no way to detect a reply automatically (see confirmCourierBranch's own note); an operator marks it once they've actually read it, same pattern as acknowledgeHrisUpdate. */
  branchRequestReplyReceived: boolean
  /** When a reply to the branch request was noticed in Outlook (simulated here, an Outlook connector in production). Only tells the assignee a reply is waiting; marking it read stays manual. */
  branchReplyDetectedAt?: string | null
  /** B11 Confirm In Transit - the courier/tracking reference captured at handoff (FR-003.9's Remote table: "Captures courier and tracking or reference number"). */
  transitTrackingRef: string
  /** ISO date B11 was confirmed (turnover to the provider) - the anchor for B11a's own, separate 14-calendar-day delay flag (see isTransitDelayed). Null until B11 is confirmed. */
  transitConfirmedAt: string | null
  /** Courier & Shipping card: the courier's tracking number and tracking link, entered by the Asset Team any time after dispatch (the shipment does not arrive at once, so they are filled in and edited as details come in). Optional so older saved tickets still load. */
  trackingNumber?: string
  trackingLink?: string
  /** ISO date each gate was actually recorded, by gate number - kept for the P&C compliance record and the gate banner's own history, not as a Target Date calculation input (every path, including Unexplained Absence, anchors its Target Date on LWD - see computeTargetDateForPath). */
  gateReleaseDates: Record<number, string>
  /** FR-003.8a audit trail - every Target Date change, whatever edited it, with the previous value, actor, reason, and whether the ticket was already in Overdue Return at the time (so that lapse stays on record even after the correction). Distinct from the free-text `history` log below, which also gets a one-line summary of the same event. */
  targetDateHistory: TargetDateRebaselineEntry[]
  /** True once an HRIS/R24-originated change has touched this ticket and hasn't been acknowledged yet - drives the Overview row badge and the sidebar count. Cleared by acknowledgeHrisUpdate(), never by the change itself; the Activity Log entry it's paired with is permanent either way. */
  hrisUpdatePending: boolean
  /** Real ISO timestamp of the most recent HRIS/R24-originated change - null until one occurs. */
  hrisUpdateChangedAt: string | null
  /** Real ISO timestamp of when hrisUpdatePending was last acknowledged - null until it is. */
  hrisUpdateAcknowledgedAt: string | null
  /** True when IT lock was already scheduled against a Last Working Day that HRIS/R24 has since changed - a real downstream-dependency flag (FR-003.8a ref f), only ever set by simulateHrisLwdUpdate() when there's an actual schedule to desync. Cleared when the operator re-confirms IT lock scheduling (confirmItLockScheduling), never automatically. */
  itLockNeedsReschedule: boolean
  history: TicketHistoryEntry[]
  /** This is specifically the GoTeam Gate Pass - see buildingGatePassRef/buildingGatePass below for the second, independent gate pass type this ticket can also carry (matching the real system's own two gate pass types). */
  gatePassRef: string | null
  /** The full Gate Pass record, once issued - see FR-003.11's "Gate pass" requirement (must mirror the real GoTeam AMS Gate Pass form, GP-OUT/GP-IN, raised from the ticket and carrying its reference). Null until an operator actually fills and issues one - it is never auto-created. */
  gatePass: GatePass | null
  /** Building Gate Pass - a second, entirely independent gate pass type alongside the GoTeam one above, matching the real system's own two-gate-pass-type distinction (raised live: the ticket workspace only ever modeled one). Same shape and issuance flow (issueGatePass takes a `kind` to pick which pair of fields it writes), just a separate record - a ticket can carry either, both, or neither. */
  buildingGatePassRef: string | null
  buildingGatePass: GatePass | null
  /** A10 evidence - Proof-of-Receipt and Condition Photos, promoted onto the ticket itself (previously only held in local component refs, so they couldn't appear in the Artifacts Summary). Null until confirmEvidence() records them. */
  evidenceProof: TicketFileRef | null
  evidenceCondition: TicketFileRef | null
  /** A11 Deduction - the ATD (Asset Transfer/Deduction) reference generated once damage is marked, promoted onto the ticket for the same reason as the evidence fields above. Null unless a deduction was actually initiated. */
  atdReference: string | null
  /** A11 Deduction's own recorded fields (Item is which confirmed asset/accessory this deduction covers, in the operator's own words - the asset list itself is only shown as reference, not a substitute for it). All blank until confirmDeduction() runs; kept as separate per-ticket fields, not folded into atdReference, so each ticket's own values are genuinely distinct rather than every deduction sharing one static, unbound form. */
  deductionDate: string
  deductionItem: string
  deductionAmount: string
  deductionAuthorizedBy: string
  /** Post-Retrieval Charging Console v1.0 alignment (see retrieval-ticket-module/POST_RETRIEVAL_CHARGING_ALIGNMENT_NOTES.md) - A11's own Case Details, Step 1 (Team Member) and Step 2 (Case). Steps 3 (Dates) and 4 (Amount) aren't built yet - this file's own "Nothing below is typed twice" rule means Case Details is the single source of truth every form/email reads from, never the reverse. Full name/Employee ID/Client/Leadership Coach aren't repeated here - they're R24 hard-truth already on `employee` (see the top-of-file note on that), read directly, never duplicated onto a second field that could drift from it. */
  /** Step 1 - First Name is a real, separate field on the reference form (not just "first word of the full name" shown inline), but it's this app's own convenience derivation, not R24 hard-truth like the fields above - so unlike those, a per-case override is legitimate. Null until the officer types over the computed default (see firstNameOf()). */
  deductionCaseFirstNameOverride: string | null
  /** Step 2 - "the name that signs the email" for this specific case. Defaults to the ticket's own `assignee`, but the reference form treats this as its own per-case field (a different Asset Team member can process one specific case than the one generally assigned to the ticket) - null until the officer types over the default. */
  deductionCaseOfficerOverride: string | null
  /** Step 2 - "Date the return was requested." No structured field anywhere else on the ticket records this (only a free-text History line from A6's send) - derivedReturnRequestedDate() below reads the earliest 'send'-category History entry as a real, computed default; this stays blank until the officer confirms/corrects it. */
  deductionCaseReturnRequestedDate: string
  /** Step 3 (Dates) - "Date received" is the one field of the six with a real computed default (see derivedReceivedDate() below, mirroring derivedReturnRequestedDate's own pattern against confirmEvidence()'s history line); the other five have no structured signal anywhere else on the ticket, so they're plain editable fields with no derived fallback, blank until the officer fills them. */
  deductionCaseReceivedDate: string
  deductionCaseAssessedDate: string
  deductionCaseBuyoutElectionDate: string
  deductionCaseQuotationExpectedDate: string
  deductionCaseHearBackByDate: string
  deductionCaseResponseDueDate: string
  /** Step 4 (Amount) - basis is null until picked (no sensible default among 5 mutually-exclusive options); the other three are plain free text, blank until entered. Amount in figures is kept as a string (not a number) to allow the officer to type it exactly as it should print (e.g. with thousands separators), matching how deductionAmount already works. */
  deductionCaseAmountBasis: DeductionAmountBasis | null
  deductionCaseSupportingDocRef: string
  deductionCaseAmountFigures: string
  deductionCaseAmountWords: string
  /** Step 5 (Equipment) - which of this ticket's confirmed assets this specific deduction case actually covers, by serial. Deliberately its own selection, never just "every confirmed asset" - a case is not automatically the whole owned equipment list (the console's own Equipment step is a repeatable table naming only the items in question). Empty until the officer picks at least one. */
  deductionCaseAssetSerials: string[]
  /** Which of the 4 outcomes this case resolves to - null until the officer picks one. See DeductionOutcome's own comment: the form/email it implies isn't authored yet, so this is a real, permanent per-ticket record, but not yet wired to a real attachment. */
  deductionOutcome: DeductionOutcome | null
  /** A12's routing decision (FR-003.10's three post-receipt outcomes), promoted onto the ticket itself rather than living only as a free-text History line - lets ticketStatusLabel/Tone (and anything else that reads live ticket state, e.g. the Assets Confirmed card) show the real status ("Returned Device Servicing" etc.) for the real window it applies to: from A12 confirmation through closure. Null until confirmInspection() records a choice. */
  inspectionRoute: InspectionRoute | null
  status: 'open' | 'closed'
  createdAt: string
  /** FR-003.11 audit trail. Optional so tickets saved before these fields existed still load; the display falls back to the assignee and createdAt. */
  createdBy?: string
  /** Moves forward on every logged action (pushHistory), so it always matches the newest Activity Log entry. */
  lastUpdatedBy?: string
  lastUpdatedAt?: string
  auditTrailId?: string
  /** FR-003.2: the Day-0 anchor of the Recalled paths (P09/P10), entered at ticket creation. Optional so older saved tickets still load. */
  recallEffectiveDate?: string
  /** Random, unguessable token for the public acknowledgment link (FR-004.2). Optional so older saved tickets still load (the link falls back to the ticket id). */
  acknowledgmentToken?: string
  /** The user dismissed the 'save this checklist as a template' reminder on this ticket. */
  checklistNudgeDismissed?: boolean
  /** A9 'Equipment won't be returned': the whole retrieval goes straight to Post-Retrieval Charging. Set by the workspace, optional so older saved tickets still load. */
  equipmentNotReturned?: boolean
  /** A11 Case Details, Equipment: each selected item's own condition / finding / settlement note, keyed by serial. */
  deductionCaseAssetNotes?: Record<string, string>
  /** #30 Quotation tracking (added 5 Oct 2026): the service provider's repair quotation received date, its reference, and the uploaded file's name. Null/empty until the Asset Team logs the received quotation. SUPPORTING_DOC_REF prefers quotationReference when set. */
  quotationReceivedISO?: string | null
  quotationReference?: string
  quotationFileName?: string
  /** #37 Referred to Payroll (added 5 Oct 2026): formal handoff record for a chargeable outcome. Set when the Asset Team confirms the authority to deduct has been sent to HR/Payroll. */
  referredToPayrollAt?: string | null
  referredToPayrollBy?: string
  /** FR-003.11 permissions: every takeover, oldest first, with the handover note. */
  handovers?: TicketHandover[]
  /** FR-003.11 cancellation: set when the retrieval was cancelled (retracted resignation, reversed recall). The ticket is closed with no retrieval. */
  cancellation?: TicketCancellation | null
}

export interface TicketHandover { from: string, to: string, note: string, at: string }
export type CancellationReason = 'resignation-retracted' | 'recall-reversed' | 'other'
export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  'resignation-retracted': 'Resignation retracted',
  'recall-reversed': 'Recall reversed',
  other: 'Another reason'
}
export interface TicketCancellation { reason: CancellationReason, note: string, at: string, by: string }

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

/**
 * A3 Offboarding Checklist - concrete, plain-language items an operator
 * actually reviews, not just a description with nothing to check. FR-003.6
 * itself doesn't provide these items (only a timing rule) - this list is
 * this app's own reasonable starting point, seeded onto each new ticket's
 * own `checklistItems`, and fully editable per ticket from there
 * (addChecklistItem/removeChecklistItem below) - editing one ticket's list
 * never touches this default or any other ticket's already-created list.
 */
export const OFFBOARDING_CHECKLIST_ITEMS = DEFAULT_CHECKLIST_TASKS

const optionalFlags = (ticket: Ticket): boolean[] => {
  // Keeps the optional flags the same length as the tasks, for tickets saved before the flags existed.
  if (!Array.isArray(ticket.checklistOptional)) ticket.checklistOptional = ticket.checklistItems.map(() => false)
  while (ticket.checklistOptional.length < ticket.checklistItems.length) ticket.checklistOptional.push(false)
  return ticket.checklistOptional
}

const doneByList = (ticket: Ticket): (string | null)[] => {
  if (!Array.isArray(ticket.checklistDoneBy)) ticket.checklistDoneBy = ticket.checklistItems.map(() => null)
  while (ticket.checklistDoneBy.length < ticket.checklistItems.length) ticket.checklistDoneBy.push(null)
  return ticket.checklistDoneBy
}

/** Ticks or unticks a task and remembers who did it. */
export function setChecklistDone(ticket: Ticket, index: number, done: boolean, actor = currentUserName()) {
  if (index < 0 || index >= ticket.checklistItems.length) return
  ticket.checklistDone[index] = done
  doneByList(ticket)[index] = done ? actor : null
}

/** Adds a new item to this ticket's own checklist - appended, unchecked, required unless said otherwise. No-op on blank text. */
export function addChecklistItem(ticket: Ticket, text: string, optional = false) {
  const trimmed = text.trim()
  if (!trimmed) return
  optionalFlags(ticket).push(optional)
  doneByList(ticket).push(null)
  ticket.checklistItems.push(trimmed)
  ticket.checklistDone.push(false)
  pushHistory(ticket, `Offboarding checklist item added: "${trimmed}"`, 'checklist')
}

/** Removes an item by index. The tasks, their done flags and their optional flags are kept 1:1, so all three are spliced together. */
export function removeChecklistItem(ticket: Ticket, index: number) {
  if (index < 0 || index >= ticket.checklistItems.length) return
  const [removed] = ticket.checklistItems.splice(index, 1)
  ticket.checklistDone.splice(index, 1)
  optionalFlags(ticket).splice(index, 1)
  doneByList(ticket).splice(index, 1)
  pushHistory(ticket, `Offboarding checklist item removed: "${removed}"`, 'checklist')
}

/** Switches a task between required and optional. */
export function toggleChecklistRequired(ticket: Ticket, index: number) {
  const flags = optionalFlags(ticket)
  if (index < 0 || index >= ticket.checklistItems.length) return
  flags[index] = !flags[index]
  pushHistory(ticket, `Offboarding checklist item set to ${flags[index] ? 'optional' : 'required'}: "${ticket.checklistItems[index]}"`, 'checklist')
}

/**
 * Replaces this ticket's checklist with the tasks of a saved template, as fresh unchecked items.
 * It is a copy, not a link: later edits to the template never reach this ticket, and any progress on
 * the list being replaced is dropped (the caller confirms that first when there is some).
 */
export function applyChecklistTemplate(ticket: Ticket, templateName: string, tasks: ChecklistTask[]) {
  const clean = tasks.map(t => ({ text: t.text.trim(), required: t.required })).filter(t => t.text)
  ticket.checklistItems = clean.map(t => t.text)
  ticket.checklistDone = clean.map(() => false)
  ticket.checklistOptional = clean.map(t => !t.required)
  ticket.checklistDoneBy = clean.map(() => null)
  pushHistory(ticket, `Offboarding checklist loaded from template: "${templateName}" (${clean.length} items)`, 'checklist')
}

/** Moves a checklist item from one position to another (drag-to-reorder, or the Move up/down fallback). The three lists stay 1:1, so they move together. No-op for an out-of-range index. */
export function reorderChecklistItem(ticket: Ticket, from: number, to: number) {
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

/** Required and optional counts, and whether the final review can be done (every required task is ticked). */
export function checklistProgress(ticket: Ticket) {
  const flags = optionalFlags(ticket)
  let requiredTotal = 0, requiredDone = 0, optionalTotal = 0, optionalDone = 0
  ticket.checklistItems.forEach((_, i) => {
    const done = !!ticket.checklistDone[i]
    if (flags[i]) { optionalTotal++; if (done) optionalDone++ } else { requiredTotal++; if (done) requiredDone++ }
  })
  return { requiredTotal, requiredDone, optionalTotal, optionalDone, ready: ticket.checklistItems.length > 0 && requiredDone === requiredTotal }
}

function subtractBusinessDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  let left = days
  while (left > 0) {
    d.setDate(d.getDate() - 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) left--
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** FR-003.6: the final review is due no later than 3 business days before the Last Working Day. Null when there is no Last Working Day. */
export function checklistDueISO(ticket: Pick<Ticket, 'lwd'>): string | null {
  return ticket.lwd ? subtractBusinessDays(ticket.lwd, 3) : null
}

// Finalised 5 Oct 2026 (open items #11, #34): the policy is "anyone on the
// Asset Team can sign off" (FR-003.11 applies no segregation of duties).
// Accountability is carried by always recording "Done by" per task plus the
// signer. Older call-sites still pass a rule arg; it is accepted and ignored.
export type ChecklistReviewerRule = 'anyone'

/** Who ticked the tasks, as counts, for the sign-off to show. */
export function checklistDoneByCounts(ticket: Ticket): { name: string, count: number }[] {
  const out = new Map<string, number>()
  doneByList(ticket).forEach((who, i) => { if (who && ticket.checklistDone[i]) out.set(who, (out.get(who) ?? 0) + 1) })
  return [...out].map(([name, count]) => ({ name, count }))
}

/**
 * Whether this person may sign off the final review. FR-003.11 applies no
 * segregation of duties, so the answer is always yes. Kept as a function so
 * the old call-shape still works; the `rule` and `reviewers` args are ignored.
 */
export function checklistReviewCheck(_ticket: Ticket, _actor: string, _rule?: ChecklistReviewerRule, _reviewers?: string[]): { allowed: boolean, reason: string } {
  return { allowed: true, reason: '' }
}

/**
 * Signs off the final review (who, when, optional note) and moves the ticket
 * on. Only once every required task is done. A note is captured when the
 * reviewer wants to record context ("waiver on item 3 agreed with ops lead"),
 * kept with the sign-off record and shown with the signed-off banner.
 */
export function finalizeChecklist(ticket: Ticket, actor = currentUserName(), noteOrRule?: string | ChecklistReviewerRule, _reviewers: string[] = []): { ok: true } | { ok: false, error: string } {
  if (ticket.checklistReview) return { ok: false, error: 'The final review is already signed off.' }
  if (!checklistProgress(ticket).ready) return { ok: false, error: 'Do every required task first.' }
  // Backward-compat: older callers passed a rule string ('anyone', etc.) as
  // the third arg. Anything that isn't a free-form note (longer than the
  // longest known rule name) is treated as a rule and ignored; a real note
  // is captured.
  const note = typeof noteOrRule === 'string' && !['anyone', 'inform', 'different-person', 'designated'].includes(noteOrRule)
    ? noteOrRule.trim() || undefined
    : undefined
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

export const TICKETS = reactive<Record<string, Ticket>>({})

/**
 * In-app notification, generated only by HRIS/R24-originated ticket changes
 * today (see simulateHrisLwdUpdate). A shared, app-wide store - not
 * retrieval-specific - so it lives here alongside TICKETS rather than in a
 * separate module, since the only producer of notifications right now is
 * this file's own simulation function.
 */
export type NotificationKind =
  | 'record-update' | 'reply' | 'form-signed' | 'acknowledgment' | 'courier-reply'
  | 'overdue' | 'due-soon' | 'branch-overdue' | 'it-lock' | 'checklist' | 'shipment-delayed' | 'quotation'
  | 'takeover' | 'assigned'

export interface AppNotification {
  id: string
  ticketId: string
  title: string
  description: string
  when: string
  /** 'digest' alerts are emailed in the morning digest, everything else is emailed straight away. */
  delivery?: 'now' | 'digest'
  /** When the morning digest carrying it went out. */
  digestedAt?: string
  /** ISO time it was raised. Absent on older ones, which fall back to parsing `when`. */
  at?: string
  read: boolean
  /** What raised it. Absent on notifications saved before this existed. */
  kind?: NotificationKind
  /** True when the assignee has something to do (shown as "Action needed"); false when it is awareness only. */
  action?: boolean
  /** De-duplication key: an alert with the same key is never raised twice. */
  key?: string
  /** Asset Team member it is addressed to (the ticket's assignee). Absent on older ones, which show to everyone. */
  recipient?: string
  /** The address a copy was emailed to (simulated, this app has no mail server). */
  emailedTo?: string
}

export const NOTIFICATIONS = reactive<AppNotification[]>([])

/**
 * Raises an in-app notification for a ticket's assignee and records the copy
 * emailed to them (simulated). Every attention-needed event goes through here,
 * so the bell and the assignee's inbox always say the same thing.
 */
export function raiseNotification(
  ticket: Ticket,
  n: { kind: NotificationKind, title: string, description: string, action?: boolean, key?: string, to?: AssetTeamMember, at?: Date, read?: boolean }
): boolean {
  return addNotification({ ...n, ticketId: ticket.id, to: n.to ?? ticket.assignee })
}

/** The one place a notification is created. Needs no ticket, so demo notifications can be pushed whatever state the app is in ('' links to the list). */
function addNotification(
  n: { ticketId: string, to: AssetTeamMember, kind: NotificationKind, title: string, description: string, action?: boolean, key?: string, at?: Date, read?: boolean }
): boolean {
  if (n.key && NOTIFICATIONS.some(x => x.key === n.key)) return false
  const to = n.to
  NOTIFICATIONS.unshift({
    id: crypto.randomUUID(),
    ticketId: n.ticketId,
    title: n.title,
    description: n.description,
    when: fmtDateTime((n.at ?? new Date()).toISOString()),
    at: (n.at ?? new Date()).toISOString(),
    read: n.read ?? false,
    delivery: DIGEST_KINDS.has(n.kind) ? 'digest' : 'now',
    kind: n.kind,
    action: n.action ?? false,
    key: n.key,
    recipient: to.name,
    emailedTo: to.email
  })
  return true
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Looks at every open ticket and raises a notification for each situation that
 * needs the assignee's action or awareness. Every alert carries a key built from
 * the ticket and the date it is about, so a running check never repeats itself,
 * while a changed date (a re-baselined deadline, say) raises a fresh one.
 * Returns how many were raised.
 */
export function scanTicketAlerts(): number {
  const today = localISO(new Date())
  let raised = 0
  for (const t of Object.values(TICKETS)) {
    if (t.status !== 'open') continue
    const who = t.employee.name
    const go = (n: Parameters<typeof raiseNotification>[1]) => { if (raiseNotification(t, n)) raised++ }

    const target = t.targetDateISO
    if (target && isOverdueReturn(t)) {
      go({ kind: 'overdue', action: true, key: `${t.id}:overdue:${target}`, title: `Return overdue · ${who}`, description: `${who} · Deadline was ${shortDate(target)}` })
    } else if (target && !hasReachedStage(t, 'A10') && !hasReachedStage(t, 'B11')) {
      const days = Math.round((new Date(`${target}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
      if (days >= 0 && days <= 3) {
        go({ kind: 'due-soon', action: true, key: `${t.id}:due-soon:${target}`, title: `Return due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} · ${who}`, description: `${who} · Deadline ${shortDate(target)}` })
      }
    }

    if (t.branchRequestSentAt && !t.branchRequestReplyReceived && !t.branchReplyDetectedAt) {
      const due = addBusinessDays(localISO(new Date(t.branchRequestSentAt)), 1)
      if (today > due) {
        go({ kind: 'branch-overdue', action: true, key: `${t.id}:branch-overdue:${t.branchRequestSentAt}`, title: `Branch reply overdue · ${who}`, description: `${who} · Was due in 1 business day` })
      }
    }

    if (t.itLock.scheduledConfirmed && !t.itLock.executedConfirmed) {
      const run = lockRunsAt(t)?.dateISO ?? t.itLock.scheduledFor
      if (run && run <= today) {
        go({ kind: 'it-lock', action: true, key: `${t.id}:it-lock:${run}`, title: `IT lock not confirmed · ${who}`, description: `${who} · Set for ${shortDate(run)}` })
      }
    }

    if (!t.checklistReview && !hasReachedStage(t, 'A4')) {
      const due = checklistDueISO(t)
      if (due && due <= today) {
        go({ kind: 'checklist', action: true, key: `${t.id}:checklist:${due}`, title: `Checklist ${due === today ? 'due today' : 'overdue'} · ${who}`, description: `${who} · Final review was due ${shortDate(due)}` })
      }
    }

    if (shipmentStatus(t) === 'delayed') {
      go({ kind: 'shipment-delayed', action: true, key: `${t.id}:shipment:${t.transitConfirmedAt}`, title: `Shipment delayed · ${who}`, description: `${who} · Over 14 days with the courier` })
    }

    if (t.deductionOutcome === 'quotation-pending' && t.deductionCaseHearBackByDate && t.deductionCaseHearBackByDate <= today) {
      go({ kind: 'quotation', action: true, key: `${t.id}:hear-back:${t.deductionCaseHearBackByDate}`, title: `Quotation update due · ${who}`, description: `${who} · Hear-back date was ${shortDate(t.deductionCaseHearBackByDate)}` })
    }
    if (t.deductionOutcome && t.deductionOutcome !== 'no-charge' && t.deductionCaseResponseDueDate && t.deductionCaseResponseDueDate <= today) {
      go({ kind: 'quotation', action: true, key: `${t.id}:response-due:${t.deductionCaseResponseDueDate}`, title: `Signed form overdue · ${who}`, description: `${who} · Was due ${shortDate(t.deductionCaseResponseDueDate)}` })
    }
  }
  sendDueDigests()
  return raised
}

/**
 * Slow-building alerts (overdue, due soon, checklist, shipment, quotation) wait
 * for the 8:00 AM morning digest email instead of each sending its own. The bell
 * still shows them straight away, and time-critical ones (a reply, a signed form,
 * a takeover, the IT lock) still email at once.
 */
const DIGEST_KINDS = new Set<NotificationKind>(['overdue', 'due-soon', 'checklist', 'shipment-delayed', 'quotation'])

export interface MorningDigest {
  id: string
  to: AssetTeamMember
  at: string
  items: { kind: NotificationKind | undefined, title: string, description: string }[]
}
/** Digests sent this session (the email itself is simulated). */
export const DIGESTS = reactive<MorningDigest[]>([])

export function pendingDigestItems(name: string): AppNotification[] {
  return NOTIFICATIONS.filter(n => n.delivery === 'digest' && !n.digestedAt && n.recipient === name)
}

/** Bundles everything waiting for this person into one digest and marks it sent. Null when nothing is waiting. */
export function sendMorningDigest(name: string, onlyBefore?: Date): MorningDigest | null {
  const items = pendingDigestItems(name).filter(n => !onlyBefore || Date.parse(n.at ?? n.when) < onlyBefore.getTime())
  if (!items.length) return null
  const to = assetTeamMemberByName(name)
  const sentAt = new Date().toISOString()
  items.forEach((n) => { n.digestedAt = sentAt })
  const digest: MorningDigest = { id: crypto.randomUUID(), to, at: sentAt, items: items.map(n => ({ kind: n.kind, title: n.title, description: n.description })) }
  DIGESTS.unshift(digest)
  return digest
}

/**
 * The scheduled send: from 8:00 AM, once a day per person, with what was raised
 * before 8:00 that morning. Anything raised later waits for tomorrow's digest.
 */
export function sendDueDigests(now = new Date()): number {
  if (typeof window === 'undefined' || now.getHours() < 8) return 0
  const today = localISO(now)
  const eight = new Date(now)
  eight.setHours(8, 0, 0, 0)
  let sent = 0
  for (const m of ASSET_TEAM_MEMBERS) {
    const k = `ams:digest:lastDay:${m.name}`
    let last: string | null = null
    try { last = localStorage.getItem(k) } catch { /* private mode */ }
    if (last === today) continue
    if (sendMorningDigest(m.name, eight)) sent++
    try { localStorage.setItem(k, today) } catch { /* private mode */ }
  }
  return sent
}

export const NOTIFICATION_KINDS: { value: NotificationKind, label: string }[] = [
  { value: 'overdue', label: 'Return overdue' },
  { value: 'due-soon', label: 'Return due soon' },
  { value: 'branch-overdue', label: 'Branch reply overdue' },
  { value: 'reply', label: 'Branch reply received' },
  { value: 'courier-reply', label: 'Courier replied' },
  { value: 'form-signed', label: 'Signed form returned' },
  { value: 'acknowledgment', label: 'Acknowledgment submitted' },
  { value: 'record-update', label: 'Last Working Day changed' },
  { value: 'it-lock', label: 'IT lock not confirmed' },
  { value: 'checklist', label: 'Checklist due' },
  { value: 'shipment-delayed', label: 'Shipment delayed' },
  { value: 'quotation', label: 'Quotation update due' },
  { value: 'takeover', label: 'Ticket taken over' },
  { value: 'assigned', label: 'Ticket assigned to you' }
]

/** Who a demo notification is about. Built from the employee records, so it never depends on a ticket existing or on its state. */
interface DemoSubject { who: string, lwd: string, target: string, reason: string, ticketId: string }
function demoSubjects(): DemoSubject[] {
  return HRIS_DIRECTORY.map((e) => {
    const t = Object.values(TICKETS).find(x => x.employee.id === e.id)
    return { who: e.name, lwd: e.lwd, target: addCalendarDays(e.lwd, 3), reason: REASON_LABELS[e.suggestedReason], ticketId: t?.id ?? '' }
  })
}
let demoCursor = 0

function demoContent(kind: NotificationKind, d: DemoSubject): { title: string, description: string, action: boolean } {
  const { who, lwd, target } = d
  switch (kind) {
    case 'overdue': return { title: `Return overdue · ${who}`, description: `${who} · Deadline was ${shortDate(target)}`, action: true }
    case 'due-soon': return { title: `Return due in 2 days · ${who}`, description: `${who} · Deadline ${shortDate(target)}`, action: true }
    case 'branch-overdue': return { title: `Branch reply overdue · ${who}`, description: `${who} · Was due in 1 business day`, action: true }
    case 'reply': return { title: `Branch reply received · ${who}`, description: `${who} · Read it and confirm the branch`, action: true }
    case 'courier-reply': return { title: `Courier replied · ${who}`, description: `${who} · Courier answered the pickup endorsement`, action: true }
    case 'form-signed': return { title: `Signed form returned · ${who}`, description: `${who} · Check it and record the outcome`, action: true }
    case 'acknowledgment': return { title: `Acknowledgment submitted · ${who}`, description: `${who} · Saved to the ticket`, action: false }
    case 'record-update': return { title: `Last Working Day changed · ${who}`, description: `${who} · ${shortDate(lwd)} to ${shortDate(addCalendarDays(lwd, 7))}`, action: true }
    case 'it-lock': return { title: `IT lock not confirmed · ${who}`, description: `${who} · Set for ${shortDate(lwd)}`, action: true }
    case 'checklist': return { title: `Checklist overdue · ${who}`, description: `${who} · Final review was due ${shortDate(lwd)}`, action: true }
    case 'shipment-delayed': return { title: `Shipment delayed · ${who}`, description: `${who} · Over 14 days with the courier`, action: true }
    case 'quotation': return { title: `Quotation update due · ${who}`, description: `${who} · Hear-back date was ${shortDate(target)}`, action: true }
    case 'takeover': return { title: `Ticket taken over · ${who}`, description: `A colleague took over ${who}'s ticket`, action: false }
    case 'assigned': return { title: `Ticket assigned to you · ${who}`, description: `${who} · ${d.reason}`, action: true }
  }
}

function pushDemo(kind: NotificationKind, d: DemoSubject, opts: { at?: Date, read?: boolean } = {}): boolean {
  const c = demoContent(kind, d)
  return addNotification({ ticketId: d.ticketId, to: assetTeamMemberByName(currentUserName()), kind, title: c.title, description: c.description, action: c.action, at: opts.at, read: opts.read })
}

/** Demo: one notification of a given type for whoever you are acting as. Always possible, touches no ticket. */
export function pushDemoNotification(kind: NotificationKind, opts: { at?: Date, read?: boolean } = {}): boolean {
  const subjects = demoSubjects()
  return pushDemo(kind, subjects[demoCursor++ % subjects.length]!, opts)
}

/**
 * Demo: one of every type, spread over the last few days with some already read,
 * so the panel, its tabs, the Unread split and the digest can all be seen full.
 */
export function pushDemoNotificationSet(): number {
  const subjects = demoSubjects()
  const now = Date.now()
  let n = 0
  NOTIFICATION_KINDS.forEach((k, i) => {
    const at = new Date(now - i * 9 * 3600 * 1000)
    if (pushDemo(k.value, subjects[(demoCursor++) % subjects.length]!, { at, read: i % 4 === 3 })) n++
  })
  return n
}

/** Things the team member (or the courier) does outside AMS that the assignee must hear about. */
export type TeamMemberEvent = 'form-signed' | 'acknowledgment' | 'courier-reply'
export const TEAM_MEMBER_EVENTS: { value: TeamMemberEvent, label: string }[] = [
  { value: 'form-signed', label: 'Signed form returned' },
  { value: 'acknowledgment', label: 'Acknowledgment form submitted' },
  { value: 'courier-reply', label: 'Courier replied to the endorsement' }
]

/**
 * Demo stand-in for the real triggers: a form coming back through the public
 * link, or a reply landing in Outlook. Each writes the Activity Log entry and
 * notifies the assignee (bell and email), exactly as the real connector would.
 */
export function simulateTeamMemberEvent(ticket: Ticket, ev: TeamMemberEvent): boolean {
  const who = ticket.employee.name
  if (ev === 'form-signed') {
    pushHistory(ticket, `Signed form returned by ${who}`, 'return', 'System')
    return raiseNotification(ticket, { kind: 'form-signed', action: true, title: `Signed form returned · ${who}`, description: `${who} · Check it and record the outcome` })
  }
  if (ev === 'acknowledgment') {
    pushHistory(ticket, `Acknowledgment form submitted by ${who}`, 'gate', 'System')
    return raiseNotification(ticket, { kind: 'acknowledgment', title: `Acknowledgment submitted · ${who}`, description: `${who} · Saved to the ticket` })
  }
  const am = courierProviderById(ticket.courierProviderId)
  pushHistory(ticket, `Courier reply received${am ? ` from ${am.accountManager}` : ''} (pickup endorsement)`, 'send', 'System')
  return raiseNotification(ticket, { kind: 'courier-reply', action: true, title: `Courier replied · ${who}`, description: `${who} · ${am?.name ?? 'Courier'} answered the pickup endorsement` })
}

/** Tickets with an unacknowledged HRIS-driven change - drives the sidebar count and the Overview row badge. */
export function ticketsNeedingAttention(): Ticket[] {
  return Object.values(TICKETS).filter(t => t.hrisUpdatePending)
}

// FR-003.11: APR-YY-NNNNN, year-scoped so the running sequence resets every
// January. The seed data lives in 2026, hence 26 starts at 417.
const referenceSeqByYear: Record<string, number> = { '26': 417 }
let ticketNumberSeq = 421

function nextReference(yearOverride?: string): string {
  const yy = yearOverride ?? String(new Date().getFullYear()).slice(-2)
  const next = (referenceSeqByYear[yy] ?? 0) + 1
  referenceSeqByYear[yy] = next
  return `APR-${yy}-${String(next).padStart(5, '0')}`
}

function nextTicketNumber(): number {
  ticketNumberSeq += 1
  return ticketNumberSeq
}

/**
 * Re-derives the ticketNumber/reference/gate-pass sequence counters from
 * whatever's actually in TICKETS right now - call this after TICKETS gets
 * replaced wholesale (see ticketStorage.ts's hydrateTicketsFromStorage).
 * These counters are plain module-level state, not part of what gets
 * persisted/restored, so without this a fresh page load's counters start
 * back at their hardcoded defaults regardless of what ticket numbers
 * already exist in the restored data - the real bug this fixes: creating a
 * ticket right after a fresh load could mint a ticketNumber that collides
 * with an existing one (e.g. a new ticket landing on #422, the same number
 * an already-restored seed ticket has).
 */
export function syncSequencesToTickets() {
  const tickets = Object.values(TICKETS)
  for (const t of tickets) {
    ticketNumberSeq = Math.max(ticketNumberSeq, t.ticketNumber)
    const refMatch = t.reference.match(/^APR-(\d{2})-(\d+)$/)
    if (refMatch) referenceSeqByYear[refMatch[1]!] = Math.max(referenceSeqByYear[refMatch[1]!] ?? 0, Number(refMatch[2]))
    const gpMatch = t.gatePass?.ref.match(/-(\d+)$/)
    if (gpMatch) gatePassSeq = Math.max(gatePassSeq, Number(gpMatch[1]))
  }
}

/**
 * Self-heals a ticket restored from a localStorage snapshot saved before a
 * field existed on the `Ticket` type - same pattern as formStorage.ts's own
 * self-heal for a corrupted saved snapshot. `Object.assign` in
 * ticketStorage.ts's applyStored() overwrites a freshly-seeded ticket
 * wholesale with whatever shape was saved, so an old snapshot genuinely
 * lacks fields this session added (checklistItems, authorizingEndorsementDate,
 * transitConfirmedAt, inspectionRoute) - without this, the first read of one
 * of those (e.g. `ticket.checklistItems.push(...)`) throws on `undefined`.
 * Called once per restored ticket, right after applyStored() merges them in.
 */
export function repairRestoredTicket(t: Ticket) {
  if (!Array.isArray(t.checklistItems)) {
    t.checklistItems = OFFBOARDING_CHECKLIST_ITEMS.slice(0, t.checklistDone?.length ?? OFFBOARDING_CHECKLIST_ITEMS.length)
  }
  if (!Array.isArray(t.checklistDone)) {
    t.checklistDone = t.checklistItems.map(() => false)
  }
  if (!Array.isArray(t.checklistOptional)) t.checklistOptional = t.checklistItems.map(() => false)
  if (!Array.isArray(t.checklistDoneBy)) t.checklistDoneBy = t.checklistItems.map(() => null)
  if (typeof t.authorizingEndorsementDate !== 'string') t.authorizingEndorsementDate = ''
  if (t.transitConfirmedAt === undefined) t.transitConfirmedAt = null
  if (t.inspectionRoute === undefined) t.inspectionRoute = null
  if (t.smsSentAt === undefined) t.smsSentAt = null
  if (t.overdueReminderSentAt === undefined) t.overdueReminderSentAt = null
  if (typeof t.overdueReminderCount !== 'number') t.overdueReminderCount = 0
  if (t.teamMemberAddressOverride === undefined) t.teamMemberAddressOverride = null
  t.assets.forEach((a, i) => {
    if (!a.assetTag) a.assetTag = assetTagFor(t.employee.id, i)
    if (!a.model) a.model = a.name
    if (!a.type) a.type = assetCatalogEntry(a.name).type
    if (a.resolution === undefined) a.resolution = null
    if (typeof a.remarks !== 'string') a.remarks = ''
  })
  if (typeof t.deductionDate !== 'string') t.deductionDate = ''
  if (typeof t.deductionItem !== 'string') t.deductionItem = ''
  if (typeof t.deductionAmount !== 'string') t.deductionAmount = ''
  if (typeof t.deductionAuthorizedBy !== 'string') t.deductionAuthorizedBy = ''
  if (t.deductionCaseFirstNameOverride === undefined) t.deductionCaseFirstNameOverride = null
  if (t.deductionCaseOfficerOverride === undefined) t.deductionCaseOfficerOverride = null
  if (typeof t.deductionCaseReturnRequestedDate !== 'string') t.deductionCaseReturnRequestedDate = ''
  if (typeof t.deductionCaseReceivedDate !== 'string') t.deductionCaseReceivedDate = ''
  if (typeof t.deductionCaseAssessedDate !== 'string') t.deductionCaseAssessedDate = ''
  if (typeof t.deductionCaseBuyoutElectionDate !== 'string') t.deductionCaseBuyoutElectionDate = ''
  if (typeof t.deductionCaseQuotationExpectedDate !== 'string') t.deductionCaseQuotationExpectedDate = ''
  if (typeof t.deductionCaseHearBackByDate !== 'string') t.deductionCaseHearBackByDate = ''
  if (typeof t.deductionCaseResponseDueDate !== 'string') t.deductionCaseResponseDueDate = ''
  if (t.deductionCaseAmountBasis === undefined) t.deductionCaseAmountBasis = null
  if (typeof t.deductionCaseSupportingDocRef !== 'string') t.deductionCaseSupportingDocRef = ''
  if (typeof t.deductionCaseAmountFigures !== 'string') t.deductionCaseAmountFigures = ''
  if (typeof t.deductionCaseAmountWords !== 'string') t.deductionCaseAmountWords = ''
  if (!Array.isArray(t.deductionCaseAssetSerials)) t.deductionCaseAssetSerials = []
  if (t.deductionOutcome === undefined) t.deductionOutcome = null
  if (t.quotationReceivedISO === undefined) t.quotationReceivedISO = null
  if (t.quotationReference === undefined) t.quotationReference = ''
  if (t.quotationFileName === undefined) t.quotationFileName = ''
  if (t.referredToPayrollAt === undefined) t.referredToPayrollAt = null
  if (t.referredToPayrollBy === undefined) t.referredToPayrollBy = ''
  if (t.buildingGatePassRef === undefined) t.buildingGatePassRef = null
  if (t.buildingGatePass === undefined) t.buildingGatePass = null
}

/**
 * Dev/demo-only reset - this app has no backend, so the duplicate-open-ticket
 * guardrail (findOpenDuplicate) otherwise makes it impossible to re-test
 * ticket creation for the same HRIS record without first closing or
 * fabricating an unrelated one. Wipes every ticket and notification and
 * resets the sequence counters back to their original defaults, so the next
 * created ticket starts clean rather than picking up wherever the last
 * session left off. Caller is responsible for flushing the cleared state to
 * storage (see flushTicketsToStorage) - kept out of this module the same way
 * every other ticket-store mutation here leaves persistence to the pages/
 * components that call it.
 */
export function clearAllTickets() {
  for (const key of Object.keys(TICKETS)) delete TICKETS[key]
  NOTIFICATIONS.splice(0, NOTIFICATIONS.length)
  for (const k of Object.keys(referenceSeqByYear)) delete referenceSeqByYear[k]
  referenceSeqByYear['26'] = 417
  ticketNumberSeq = 421
  gatePassSeq = 100000
}

function serialFor(empId: string, i: number): string {
  const digits = empId.replace(/\D/g, '').slice(-3) || '000'
  return `SN-${String(10000 + i * 37 + Number(digits)).padStart(5, '0')}`
}

/** Same deterministic idiom as serialFor() above, for the asset tag field (GT-AST-#### - matches the SAMPLE_VALUES.ASSET_TAG format used in email/form templates). */
function assetTagFor(empId: string, i: number): string {
  const digits = empId.replace(/\D/g, '').slice(-4) || '0000'
  return `GT-AST-${String(1000 + i * 53 + Number(digits)).padStart(4, '0')}`
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
export function createTicket(
  employee: HrisRecord, reason: TicketReason, mode: TicketMode, lwd: string, sep: string,
  authorizingEndorsement: string, authorizingEndorsementDate = '', idOverride?: string,
  assignee: AssetTeamMember = assetTeamMemberByName(currentUserName()),
  /** Present only when the operator changed Reason away from HRIS's own suggestedReason - the create form requires and captures this justification, this is where it actually lands on the ticket's own record. */
  reasonOverrideNote?: string,
  /** Present only when the operator changed Mode away from the address-derived auto default - same override/justification pattern as reasonOverrideNote above. */
  modeOverrideNote?: string,
  /** Required by the Recalled paths only (FR-003.2: their Day-0 anchor is the Recall Effective Date). */
  recallEffectiveDate?: string
): Ticket {
  const entry = MATRIX[reason]
  const issuedChecklist = checklistTemplateFor(reason, mode)
  const id = idOverride ?? crypto.randomUUID()
  // Seed tickets are 2026 demo data whatever today's date is.
  const reference = nextReference(idOverride ? '26' : undefined)
  const ticketNumber = nextTicketNumber()
  const ticket: Ticket = {
    id,
    ticketNumber,
    reference,
    employee,
    assignee,
    reason,
    mode,
    lwd,
    sep,
    authorizingEndorsement,
    authorizingEndorsementDate,
    gateCount: entry.gateCount,
    gatesReleased: 0,
    gateNotes: {},
    stageIdx: 0,
    furthestStageIdx: 0,
    overdueForced: false,
    // FR-003.6: the checklist is issued at notice, from the template set for this path.
    checklistItems: issuedChecklist.tasks.map(t => t.text),
    checklistDone: issuedChecklist.tasks.map(() => false),
    checklistOptional: issuedChecklist.tasks.map(t => !t.required),
    checklistReview: null,
    assetsLocked: false,
    assets: employee.assets.map((a, i) => ({ name: a.name, model: a.model, type: assetCatalogEntry(a.name).type, serial: serialFor(employee.id, i), assetTag: assetTagFor(employee.id, i), checked: true, remarks: '', resolution: null })),
    targetDateISO: null,
    callAttempts: [],
    smsSentAt: null,
    overdueReminderSentAt: null,
    overdueReminderCount: 0,
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
    teamMemberAddressOverride: null,
    branchRequestSentAt: null,
    branchRequestTemplateKey: null,
    branchRequestReplyReceived: false,
    transitTrackingRef: '',
    transitConfirmedAt: null,
    gateReleaseDates: {},
    targetDateHistory: [],
    hrisUpdatePending: false,
    hrisUpdateChangedAt: null,
    hrisUpdateAcknowledgedAt: null,
    itLockNeedsReschedule: false,
    history: [],
    gatePassRef: null,
    gatePass: null,
    buildingGatePassRef: null,
    buildingGatePass: null,
    evidenceProof: null,
    evidenceCondition: null,
    atdReference: null,
    deductionDate: '',
    deductionItem: '',
    deductionAmount: '',
    deductionAuthorizedBy: '',
    deductionCaseFirstNameOverride: null,
    deductionCaseOfficerOverride: null,
    deductionCaseReturnRequestedDate: '',
    deductionCaseReceivedDate: '',
    deductionCaseAssessedDate: '',
    deductionCaseBuyoutElectionDate: '',
    deductionCaseQuotationExpectedDate: '',
    deductionCaseHearBackByDate: '',
    deductionCaseResponseDueDate: '',
    deductionCaseAmountBasis: null,
    deductionCaseSupportingDocRef: '',
    deductionCaseAmountFigures: '',
    deductionCaseAmountWords: '',
    deductionCaseAssetSerials: [],
    deductionOutcome: null,
    quotationReceivedISO: null,
    quotationReference: '',
    quotationFileName: '',
    referredToPayrollAt: null,
    referredToPayrollBy: '',
    inspectionRoute: null,
    status: 'open',
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: currentUserName(),
    // A Recalled seed has no operator to type it, so it takes its Separation Date.
    recallEffectiveDate: reason === 'recalled' ? (recallEffectiveDate || (idOverride ? sep : '')) : undefined,
    // Seeds use a fixed token so server and client renders agree (see idOverride note above).
    acknowledgmentToken: idOverride ? `seed-${idOverride}` : crypto.randomUUID().replace(/-/g, ''),
    auditTrailId: `AUD-${new Date().getFullYear()}-${String(ticketNumber).padStart(5, '0')}`
  }
  TICKETS[id] = ticket
  pushHistory(ticket, 'Entry recorded: authorizing endorsement (+ recorded date) + Last Working Day + Separation Date captured', 'entry')
  if (reasonOverrideNote) pushHistory(ticket, `Reason overridden from the suggested case type: "${reasonOverrideNote}"`, 'entry')
  if (modeOverrideNote) pushHistory(ticket, `Mode overridden from the address-derived auto default: "${modeOverrideNote}"`, 'entry')
  pushHistory(ticket, `Ticket Created - ${reference}`, 'entry')
  // A ticket created for someone else is news to that person (seeds are not).
  if (!idOverride && assignee.name !== currentUserName()) {
    raiseNotification(ticket, {
      kind: 'assigned',
      action: true,
      title: `Ticket assigned to you · ${employee.name}`,
      description: `${employee.name} · ${REASON_LABELS[reason]}`
    })
  }
  return ticket
}

// `when` defaults to the real current date/time rather than a "Just now"
// placeholder - every call site records the moment the action actually
// happened, so the Activity Log can show a genuine timestamp instead of
// freezing every entry at whatever text a demo session hardcoded.
export function pushHistory(ticket: Ticket, action: string, category: HistoryCategory, actor = currentUserName(), when = fmtDateTime(new Date().toISOString())) {
  ticket.history.unshift({ action, actor, when, category })
  ticket.lastUpdatedBy = actor
  ticket.lastUpdatedAt = new Date().toISOString()
}

/** Real date+time formatting, e.g. "Sep 24, 2026, 2:41 PM". */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
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
  ticket.furthestStageIdx = Math.max(ticket.furthestStageIdx ?? 0, ticket.stageIdx)
}

/** Undo the most recent confirmation on a given stage (5 Oct 2026, 5th pass
 * feedback). Clears the per-stage state the confirmation wrote, pops the
 * most recent matching history entry, and if the ticket had advanced past
 * this stage, steps it back so the editable form shows again. Each case is
 * narrowly tied to the state the matching confirm function wrote, so
 * nothing else gets reset by accident. */
export function undoStageConfirmation(ticket: Ticket, stageKey: StageKey, actor = currentUserName()): boolean {
  if (ticket.status !== 'open') return false
  const list = stageListFor(ticket.mode)
  const idx = list.indexOf(stageKey)
  let historyMatcher: RegExp | null = null
  switch (stageKey) {
    case 'A5':
      if (!ticket.assetsLocked) return false
      ticket.assetsLocked = false
      historyMatcher = /^Assets confirmed/
      break
    case 'A6':
      historyMatcher = /^Retrieval notice sent/
      break
    case 'A10':
      ticket.evidenceProof = null
      ticket.evidenceCondition = null
      historyMatcher = /^Proof-of-Receipt \+ condition photos uploaded/
      break
    case 'A11':
      ticket.deductionOutcome = null
      historyMatcher = /^Post-Retrieval Charging (resolved|outcome changed)/
      break
    case 'A12':
      ticket.inspectionRoute = null
      historyMatcher = /^Inspection routed/
      break
    case 'B9':
      historyMatcher = /^Courier endorsement sent$/
      break
    case 'B11':
      ticket.transitConfirmedAt = ''
      ticket.trackingNumber = ''
      ticket.trackingLink = ''
      historyMatcher = /^In transit confirmed/
      break
    default:
      return false
  }
  if (historyMatcher) {
    const i = ticket.history.findIndex(h => historyMatcher!.test(h.action))
    if (i >= 0) ticket.history.splice(i, 1)
  }
  if (idx >= 0 && ticket.stageIdx > idx) {
    ticket.stageIdx = idx
    ticket.furthestStageIdx = Math.max(idx, ticket.furthestStageIdx ?? 0)
  }
  pushHistory(ticket, `${STAGE_NAMES[stageKey] ?? stageKey} undone`, 'return', actor)
  return true
}

function addCalendarDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** No public-holiday calendar is available to this app today, so business-day arithmetic only skips weekends - a known, intentional scope limit, not an oversight. */
function addBusinessDays(iso: string, days: number): string {
  const d = new Date(iso)
  let remaining = days
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) remaining--
  }
  return d.toISOString().slice(0, 10)
}

/**
 * FR-003.8(d): Target Date defaults from the matrix deadline rule for the
 * resolved path. Parses MATRIX[reason][mode].deadline ("N business|calendar
 * days from LWD") rather than re-deriving fresh rules from the source PDF -
 * that matrix is this app's already-reviewed source of truth for these
 * deadlines (see MATRIX's own doc comment above), and every currently-modeled
 * path's deadline string already follows this exact pattern.
 *
 * Every path, including Unexplained Absence, anchors on Last Working Day
 * (product decision, 2026-09-23 - gates are advisory only, never a hard
 * requirement, so the Target Date can't depend on one ever being recorded;
 * see MATRIX's own comment on the unexplained-absence entry). LWD is always
 * captured at ticket creation, so this only ever returns null for a
 * reason/mode combo with no resolved path at all (P12 Unexplained Absence
 * Onsite is not offered) - never because of anything still pending later in
 * the ticket's life.
 */
export function computeTargetDateForPath(ticket: Pick<Ticket, 'reason' | 'mode' | 'lwd' | 'createdAt' | 'recallEffectiveDate'>): string | null {
  const path = resolvedPathFor(ticket.reason, ticket.mode)
  if (!path) return null
  const { from, days, unit } = path.rule
  const base = from === 'lwd' ? ticket.lwd : from === 'notice' ? ticket.createdAt : ticket.recallEffectiveDate
  if (!base) return null
  return unit === 'business' ? addBusinessDays(base, days) : addCalendarDays(base, days)
}

/**
 * FR-003.8(a): the asset list renders live against the register - a late
 * assignment recorded after ticket creation still has to appear on an
 * already-open ticket, so the list never goes stale from creation timing.
 * Reconciles ticket.assets against the employee's current HRIS asset list,
 * appending anything new as checked (matching FR-003.8(b)'s "default state
 * is all preselected"). Only runs pre-confirmation (assetsLocked === false)
 * - once confirmed, the list is a frozen record (FR-003.8(c)), matching the
 * rest of the asset-confirmation lifecycle.
 */
export function syncTicketAssetsFromRegister(ticket: Ticket) {
  if (ticket.assetsLocked) return
  const existingNames = new Set(ticket.assets.map(a => a.name))
  const newAssets = ticket.employee.assets.filter(a => !existingNames.has(a.name))
  newAssets.forEach((a) => {
    ticket.assets.push({ name: a.name, model: a.model, type: assetCatalogEntry(a.name).type, serial: serialFor(ticket.employee.id, ticket.assets.length), assetTag: assetTagFor(ticket.employee.id, ticket.assets.length), checked: true, remarks: '', resolution: null })
  })
}

/** Confirms the asset list at A5 - locks it read-only and derives the Target Date from the resolved path's matrix deadline rule (FR-003.8d). */
export function confirmAssets(ticket: Ticket) {
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
export function rebaselineTargetDate(ticket: Ticket, newDateISO: string, reason: string, actor = currentUserName()) {
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

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'not set'
  pushHistory(
    ticket,
    `Target Date re-baselined: ${fmt(previousDateISO)} -> ${fmt(newDateISO)} (reason: ${trimmedReason})${wasOverdue ? ' - ticket was in Overdue Return at the time of this change; that lapse remains on record' : ''}`,
    'rebaseline',
    actor
  )
}

/**
 * Simulates R24/HRIS pushing a Last Working Day correction for this
 * ticket's employee. This app has no backend and no real R24 integration to
 * receive a live push from (see the dev-facing note this function's own
 * Simulation Control triggers from), so this stands in for that event -
 * everything downstream of "a change arrived" is real: it recomputes the
 * Target Date (LWD is its anchor for every path except Unexplained
 * Absence), flags IT lock for rescheduling only if it was genuinely
 * scheduled against the value that just changed, writes a permanent
 * Activity Log entry, and raises an in-app notification emailed (simulated)
 * to the ticket's assignee - never the departing team member, this is an
 * internal Asset Team notice, not an FR-003.12 retrieval template.
 */
export function simulateHrisLwdUpdate(ticket: Ticket, newLwd: string) {
  const oldLwd = ticket.lwd
  if (!newLwd || newLwd === oldLwd) return

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const changedAt = new Date().toISOString()
  // FR-003.8a ref d - "the ticket records the amending artifact so the new
  // clock is traceable to its authority." This app has no real R24 backend
  // to source an artifact id from, so this stands in for one - a real
  // integration would carry R24's own change/event id here instead.
  const amendingArtifact = `R24-LWD-${changedAt.slice(0, 10)}`
  ticket.lwd = newLwd

  // Target Date recompute - only where it's already resolvable (assets
  // confirmed) and the rule actually moves it. A manually re-baselined
  // Target Date can differ from what the matrix rule would now produce;
  // this still recomputes it, same as HRIS being treated as authoritative
  // over the ticket's own Asset Team-entered correction (see the LWD
  // real-time sync design discussion this function implements).
  const wasOverdue = isOverdueReturn(ticket)
  const previousDateISO = ticket.targetDateISO
  const recomputed = ticket.assetsLocked ? computeTargetDateForPath(ticket) : null
  if (recomputed && recomputed !== previousDateISO) {
    ticket.targetDateHistory.push({
      previousDateISO,
      newDateISO: recomputed,
      reason: `Last Working Day updated in the employee record: ${fmt(oldLwd)} -> ${fmt(newLwd)} (amending artifact: ${amendingArtifact})`,
      actor: 'System',
      when: changedAt,
      wasOverdue
    })
    ticket.targetDateISO = recomputed
    ticket.overdueForced = false
  }

  // Real downstream-dependency flag (FR-003.8a ref f) - only set when IT
  // lock was actually scheduled against the value that just changed.
  if (ticket.itLock.scheduledConfirmed && ticket.itLock.scheduledFor === oldLwd) {
    ticket.itLockNeedsReschedule = true
  }

  ticket.hrisUpdatePending = true
  ticket.hrisUpdateChangedAt = changedAt
  ticket.hrisUpdateAcknowledgedAt = null
  pushHistory(ticket, `Last Working Day updated in the employee record: ${fmt(oldLwd)} -> ${fmt(newLwd)}`, 'hris', 'System', fmtDateTime(changedAt))
  pushHistory(ticket, `Notification emailed to assignee: ${ticket.assignee.name} <${ticket.assignee.email}>`, 'hris', 'System', fmtDateTime(changedAt))

  raiseNotification(ticket, {
    kind: 'record-update',
    action: true,
    title: `Last Working Day changed · ${ticket.employee.name}`,
    description: `${ticket.employee.name} · ${fmt(oldLwd)} to ${fmt(newLwd)}`
  })
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
export function acknowledgeHrisUpdate(ticket: Ticket) {
  const acknowledgedAt = new Date().toISOString()
  ticket.hrisUpdatePending = false
  ticket.hrisUpdateAcknowledgedAt = acknowledgedAt
  pushHistory(
    ticket,
    `Employee record update acknowledged${ticket.itLockNeedsReschedule ? ' - IT lock still needs to be rescheduled' : ''}`,
    'hris',
    currentUserName(),
    fmtDateTime(acknowledgedAt)
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
export function releaseGate(ticket: Ticket, gateN: number, note?: string) {
  ticket.gatesReleased = gateN
  ticket.gateNotes[gateN] = note?.trim() || 'Recorded'
  ticket.gateReleaseDates[gateN] = new Date().toISOString().slice(0, 10)
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

export function isP12(reason: TicketReason, mode: TicketMode): boolean {
  return reason === 'unexplained-absence' && mode === 'onsite'
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
export function goBackStage(ticket: Ticket) {
  const list = stageListFor(ticket.mode)
  let idx = Math.max(0, ticket.stageIdx - 1)
  while (idx > 0 && SKIP_STAGES.includes(list[idx]!)) idx--
  ticket.stageIdx = idx
}

/** Steps forward again after a goBackStage, up to the furthest stage this ticket has actually completed - never further, so this can't be used to skip a stage that hasn't been done. */
export function goForwardStage(ticket: Ticket) {
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
export function jumpToStage(ticket: Ticket, target: StageKey) {
  const list = stageListFor(ticket.mode)
  const idx = list.indexOf(target)
  if (idx === -1) return
  const bounded = Math.min(idx, ticket.furthestStageIdx ?? 0)
  if (bounded === ticket.stageIdx) return
  ticket.stageIdx = bounded
  pushHistory(ticket, `Jumped to ${STAGE_NAMES[list[bounded]!]}`, 'navigation')
}

/** Marks a custodian contact field as verified directly (an explicit operator action - e.g. they reached the team member through some other channel), independent of the A7 call-confirmation auto-verify path. */
export function verifyContact(ticket: Ticket, field: 'number' | 'email') {
  if (field === 'number') ticket.contact.numberVerified = true
  else ticket.contact.emailVerified = true
  pushHistory(ticket, `${field === 'number' ? 'Contact number' : 'Personal email'} manually confirmed active`, 'contact')
}

/**
 * Records the B8 Branch confirmation capture - the courier + exact branch
 * name/address is a required field before the courier endorsement (B9) can
 * send (FR-003.9). `captureMethod` records FR-003.9(b) (call is the primary
 * mechanism, email reply the fallback) and `substituted` records
 * FR-003.9(f)'s non-response path (branch filled from the address on file,
 * not the team member's own reply) distinctly in history.
 */
/** employee.address is R24 hard-truth and never mutated directly - every read site should call this instead of reading ticket.employee.address itself, so a per-ticket correction (see teamMemberAddressOverride on Ticket) is never silently ignored. */
export function effectiveTeamMemberAddress(ticket: Ticket): string {
  return ticket.teamMemberAddressOverride ?? ticket.employee.address
}

/** Records a correction to the team member's on-file address for this ticket only - never mutates employee.address (R24 hard-truth, see HrisRecord). Pass null to clear the override and fall back to the R24 address again. */
export function setTeamMemberAddressOverride(ticket: Ticket, address: string | null) {
  ticket.teamMemberAddressOverride = address && address.trim() ? address.trim() : null
  pushHistory(ticket, ticket.teamMemberAddressOverride
    ? `Team member address corrected for this ticket: ${ticket.teamMemberAddressOverride}`
    : 'Team member address correction cleared - reverted to the address on file', 'contact')
}

/**
 * Asset ownership (GoTeam vs. client) - the Post-Retrieval Charging
 * Console's own Section 1 "Asset owner: GoTeam / Client, recovery owed
 * onward" turned out to already exist in this app's data model, just
 * unlabeled: `employee.client` is `'Internal'` for a GoTeam employee with no
 * client engagement (see the seed data's own use of that literal string),
 * and any other value is a real client name - there is no separate,
 * per-asset owner field anywhere, and this app has no data suggesting one
 * ticket's assets could have mixed ownership, so this is a single,
 * ticket-wide derivation off one existing field, not new data entry.
 * Surfaced with the same "name + role badge" shape the Custodian card
 * already uses for Leadership Coach (see splitCoachLabel in [id].vue).
 */
export function assetOwnerInfo(ticket: Ticket): { name: string, badge: string } {
  return ticket.employee.client === 'Internal'
    ? { name: 'GoTeam', badge: 'Internal' }
    : { name: ticket.employee.client, badge: 'Client Owned' }
}

/** A11 Case Details Step 1 - "First name" is a real, separate field on the reference form's Case Details, not just the full name's first word rendered inline: it's this app's own computed convenience (there's no dedicated first-name field on HrisRecord/R24), so `deductionCaseFirstNameOverride` is a legitimate per-case correction rather than a violation of the "R24 hard-truth, never editable" rule that governs `employee.name` itself. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

// Formatted from the Date object's own local getters, not toISOString() -
// that converts to UTC, which silently shifts the calendar date back a day
// for any timestamp between midnight and its UTC offset (e.g. before 8am in
// GMT+8) - the same real bug caught and fixed in create.vue's
// separationMinDate. Shared by every derivedXDate() helper below so that
// fix lives in one place instead of being re-typed at each call site.
function isoDateOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Earliest history timestamp matching a category/text filter, as a local-calendar ISO date - the shared engine behind derivedReturnRequestedDate/derivedReceivedDate below. `when` is already human-formatted ("Sep 24, 2026, 2:41 PM" via fmtDateTime), not a raw ISO string - a plain slice(0, 10) or localeCompare sort on it (both tried and wrong here first) reads garbage: the first 10 characters of that string aren't a date at all, and string comparison doesn't sort chronologically across months. Parsing back through Date and comparing real timestamps is the only correct way to find the earliest one. */
function earliestHistoryDate(ticket: Ticket, category: HistoryCategory, textIncludes?: string): string | null {
  const times = ticket.history
    .filter(h => h.category === category && (!textIncludes || h.action.includes(textIncludes)))
    .map(h => new Date(h.when).getTime())
    .filter(t => !Number.isNaN(t))
  if (!times.length) return null
  return isoDateOf(new Date(Math.min(...times)))
}

/** A11 Case Details Step 2 - "Date the return was requested" has no dedicated structured field anywhere else on the ticket (A6's send is only ever recorded as a free-text History line, category 'send') - this reads the earliest such entry as a real, computed default. Returns null (not today's date or empty string) when no send has happened yet, so the caller can tell "not yet known" apart from "typed as blank on purpose". */
export function derivedReturnRequestedDate(ticket: Ticket): string | null {
  return earliestHistoryDate(ticket, 'send')
}

/** A11 Case Details Step 3 - "Date received," the one Dates-step field with a real computed default: confirmEvidence() (A10) always pushes a 'return'-category history line reading "Proof-of-Receipt + condition photos uploaded...", so the moment evidence is confirmed IS the received date, same derivation pattern as derivedReturnRequestedDate above. Returns null (not blank) when evidence hasn't been confirmed yet. */
export function derivedReceivedDate(ticket: Ticket): string | null {
  return earliestHistoryDate(ticket, 'return', 'Proof-of-Receipt')
}

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
    : `Courier branch confirmed ${via}: ${provider?.name ?? providerId}, ${branchName}, ${branchAddress}`, 'branch')
  advanceStage(ticket)
}

/** FR-003.9(a): the retrieval instructions request the preferred courier, exact branch name and branch address, with a reply requested within 1 business day - this records when that request actually went out, so "within 1 business day" has a real anchor instead of being an unenforced sentence in the notice copy. */
export function sendBranchRequest(ticket: Ticket, templateKey: string | null = null) {
  ticket.branchRequestSentAt = new Date().toISOString()
  ticket.branchRequestTemplateKey = templateKey
  ticket.branchRequestReplyReceived = false
  ticket.branchReplyDetectedAt = null
  pushHistory(ticket, 'Branch confirmation request sent to team member - reply requested within 1 business day', 'send')
}

/** FR-003.12: the operator's own sent-confirmation for a companion SMS, clicked once the text has actually gone out from their phone. Recorded on the Activity Log with actor and time. */
export function confirmSmsSentFor(ticket: Ticket, code: string, label: string) {
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
export function markBranchReplyReceived(ticket: Ticket) {
  ticket.branchRequestReplyReceived = true
  pushHistory(ticket, 'Team member email reply confirmed read', 'branch')
}

/**
 * Demo stand-in for an Outlook connector noticing the team member's reply to
 * the branch request. It does not mark the reply as read (the operator still
 * does that after reading it); it records that a reply arrived and tells the
 * assignee right away, in the bell and by email, so they don't have to dig
 * through their inbox. Only meaningful while a request is out and unanswered.
 */
export function simulateBranchReply(ticket: Ticket): boolean {
  if (!ticket.branchRequestSentAt || ticket.branchRequestReplyReceived || ticket.branchReplyDetectedAt) return false
  ticket.branchReplyDetectedAt = new Date().toISOString()
  pushHistory(ticket, `Reply from ${ticket.employee.name} arrived in Outlook (branch confirmation request)`, 'branch', 'System')
  raiseNotification(ticket, {
    kind: 'reply',
    action: true,
    title: `Branch reply received · ${ticket.employee.name}`,
    description: `${ticket.employee.name} · Read it and confirm the branch`
  })
  return true
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

/**
 * A real, well-formed tracking URL for the given courier - http/https, a
 * host, and (when the courier is known) that host actually belongs to that
 * courier's own domain, per its Master Data > Courier Providers record
 * (`trackingWebsiteUrl`) rather than a separately-hardcoded domain list.
 * Catches both an expired/placeholder/garbage entry and an unrelated link
 * that happens to be well-formed. Cannot confirm the link actually resolves
 * to a live shipment without calling out to the courier, which this
 * front-end-only app has no way to do.
 */
export function isValidTrackingLink(value: string, courierId?: string | null): boolean {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const provider = courierId ? courierProviderById(courierId) : null
  if (!provider) return true
  let providerHost: string
  try {
    providerHost = new URL(provider.trackingWebsiteUrl).hostname.replace(/^www\./, '')
  } catch {
    return true
  }
  return url.hostname === providerHost || url.hostname.endsWith(`.${providerHost}`) || url.hostname === `www.${providerHost}`
}

/** Records the B11 Confirm In Transit handoff, capturing the courier/tracking reference per FR-003.9's Remote table ("Captures courier and tracking or reference number"). Also anchors B11a's 14-day delay flag and halts the Overdue Return countdown (FR-003.6: "Halts the Overdue Return countdown") - see isTransitDelayed/isOverdueReturn, both of which key off hasReachedStage(ticket, 'B11'). */
export function confirmInTransit(ticket: Ticket, trackingNumber: string, trackingLink = '') {
  ticket.trackingNumber = trackingNumber
  ticket.trackingLink = trackingLink
  ticket.transitTrackingRef = trackingLink || trackingNumber
  ticket.transitConfirmedAt = new Date().toISOString().slice(0, 10)
  pushHistory(ticket, `Marked In Transit - tracking number: ${trackingNumber || 'not provided'}${trackingLink ? ', tracking link added' : ''}`, 'transit')
  advanceStage(ticket)
}

/** Saves or edits the tracking number and link from the Courier & Shipping card without moving the stage: the shipment is filled in as details arrive, and only B11's own button confirms the handoff. */
export function saveShipmentDetails(ticket: Ticket, trackingNumber: string, trackingLink: string) {
  const had = !!(ticket.trackingNumber || ticket.trackingLink || ticket.transitTrackingRef)
  ticket.trackingNumber = trackingNumber
  ticket.trackingLink = trackingLink
  ticket.transitTrackingRef = trackingLink || trackingNumber
  pushHistory(ticket, `Tracking details ${had ? 'updated' : 'added'}: ${trackingNumber ? `number ${trackingNumber}` : 'no number'}${trackingLink ? ', link saved' : ''}`, 'transit')
}

/** Where the shipment is, for the Courier & Shipping card. */
export type ShipmentStatus = 'not-shipped' | 'in-transit' | 'delayed' | 'received'
export function shipmentStatus(ticket: Ticket): ShipmentStatus {
  if (hasReachedStage(ticket, 'A10')) return 'received'
  if (!ticket.transitConfirmedAt) return 'not-shipped'
  return isTransitDelayed(ticket) ? 'delayed' : 'in-transit'
}

/** The team member's shift as HRIS reports it. Tickets saved before shifts existed read it live from the HRIS record, as the real integration would. */
export function shiftFor(ticket: Pick<Ticket, 'employee'>): HrisShift | null {
  return ticket.employee.shift ?? HRIS_DIRECTORY.find(e => e.id === ticket.employee.id)?.shift ?? null
}
/** '22:00' to '10:00 PM'. */
export function formatClock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
/** 'Mon to Fri, 10:00 PM to 7:00 AM'. */
export function shiftLabel(shift: HrisShift): string {
  return `${shift.days}, ${formatClock(shift.start)} to ${formatClock(shift.end)}`
}
/**
 * When the IT lock should run: the end of the shift that starts on the Last
 * Working Day (FR-003.6). An overnight shift ends the next calendar day, so the
 * lock runs then, not on the Last Working Day itself. Null when HRIS has no
 * shift or the ticket has no Last Working Day.
 */
export function lockRunsAt(ticket: Pick<Ticket, 'employee' | 'lwd'>): { dateISO: string, clock: string, overnight: boolean } | null {
  const shift = shiftFor(ticket)
  if (!shift || !ticket.lwd) return null
  const overnight = shift.end <= shift.start
  const d = new Date(`${ticket.lwd}T00:00:00`)
  if (overnight) d.setDate(d.getDate() + 1)
  const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { dateISO, clock: formatClock(shift.end), overnight }
}

/** A4 step 1 of 2 - marks the lock as scheduled. FR-003.6: "Scheduled within 1 business day of the Notice Endorsement, anchored after the last shift on the Last Working Day." */
export function confirmItLockScheduling(ticket: Ticket) {
  const wasStale = ticket.itLockNeedsReschedule
  ticket.itLock.scheduledConfirmed = true
  ticket.itLock.scheduledFor = ticket.lwd
  ticket.itLockNeedsReschedule = false
  pushHistory(ticket, `IT lock scheduled for end of last shift on ${ticket.lwd || 'the Last Working Day'}${wasStale ? ' (rescheduled against the updated Last Working Day)' : ''} - awaiting execution confirmation`, 'itlock')
}

/** A4 step 2 of 2 - confirms the lock actually executed on schedule. Does
 * NOT auto-advance: a success banner replaces the warning and the user
 * clicks Continue to proceed (user feedback 5 Oct 2026, 5th pass).
 * FR-003.6: "Confirmed on scheduling and on execution." */
export function confirmItLockExecution(ticket: Ticket) {
  ticket.itLock.executedConfirmed = true
  pushHistory(ticket, 'IT lock executed on schedule - confirmed', 'itlock')
}

/** An existing OPEN ticket for the same team member, if any - the guardrail a Create flow checks before allowing a second ticket for someone who already has one in flight. */
export function findOpenDuplicate(employeeId: string): Ticket | undefined {
  return Object.values(TICKETS).find(t => t.employee.id === employeeId && t.status === 'open')
}

let gatePassSeq = 100000

export type GatePassKind = 'goteam' | 'building'
export const GATE_PASS_KIND_LABEL: Record<GatePassKind, string> = { goteam: 'GoTeam Gate Pass', building: 'Building Gate Pass' }

/**
 * Issues a Gate Pass against this ticket - a deliberate operator action
 * with real form content (FR-003.11), never an automatic side effect of
 * viewing the ticket. `assets` and the team-member fields are expected to
 * already be pre-filled from the ticket by the caller; this just stamps a
 * reference, records it, and writes the audit-trail entry. `kind` picks
 * which of the ticket's two independent gate pass records this writes to
 * (see buildingGatePassRef/buildingGatePass's own comment on Ticket).
 */
export function issueGatePass(ticket: Ticket, input: Omit<GatePass, 'ref'>, kind: GatePassKind = 'goteam'): GatePass {
  gatePassSeq += 1
  const pass: GatePass = { ref: `GP-2026-${gatePassSeq}`, ...input }
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
  B8: { title: STAGE_NAMES.B8, desc: 'Capture the custodian\'s preferred courier and their exact branch before the courier endorsement goes out. A reply is requested within 1 business day.', kind: 'branch', actionLabel: 'Confirm Branch' },
  B9: { title: STAGE_NAMES.B9, desc: 'Sent to the courier\'s corporate account manager, choose the email to send, then confirm.', kind: 'template-send', actionLabel: 'Send Courier Endorsement' },
  A6: { title: STAGE_NAMES.A6, desc: 'Due within 1 business day of the verified asset list, no later than the Last Working Day.', kind: 'template-send', actionLabel: 'Send Retrieval Notice' },
  A7: { title: STAGE_NAMES.A7, desc: 'Call the same day the notice goes out. Up to 3 attempts, each logged. A text follows any attempt that goes unanswered.', kind: 'calllog' },
  A8: { title: STAGE_NAMES.A8, desc: 'A midpoint and a final reminder as the Target Date approaches, each independently optional if not needed.', kind: 'reminders' },
  B11: { title: STAGE_NAMES.B11, desc: 'Custodian has handed off the equipment to the courier. Capturing the tracking or reference number below halts the Overdue Return countdown.', kind: 'transit', actionLabel: 'Confirm In Transit' },
  // The systemNote this used to carry ("If the Target Date passes with
  // nothing recorded...") was removed per explicit feedback - once the
  // ticket is actually overdue, the in-card red banner already says so
  // (title, border, background), and restating "if it passes" after it
  // already has read as redundant, not helpful.
  A9: { title: STAGE_NAMES.A9, desc: 'Waiting for the equipment to come back by the Target Date below.', kind: 'awaiting-return', actionLabel: 'Mark Equipment Received' },
  A10: { title: STAGE_NAMES.A10, desc: 'Closure is blocked until both a signed Proof-of-Receipt and condition photos are on file. Once both are in, the ticket moves to Hold Off.', kind: 'evidence', actionLabel: 'Confirm Evidence Complete' },
  A11: { title: STAGE_NAMES.A11, desc: 'Only if an item came back damaged or wasn\'t returned.', kind: 'deduction' },
  A12: { title: STAGE_NAMES.A12, desc: 'Check condition and send each returned item to its next stop: stock, servicing, or disposal.', kind: 'inspection', actionLabel: 'Confirm Inspection & Routing' },
  A13: { title: STAGE_NAMES.A13, desc: 'Check that nothing is still open below, then close the ticket.', kind: 'closure', actionLabel: 'Review & Close Ticket' }
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

/** Every seed ticket below is fast-forwarded past A4, so its IT lock is already fully confirmed - scheduled and executed - rather than left half-done. */
function finalizeItLock(t: Ticket) {
  t.itLock = { scheduledConfirmed: true, scheduledFor: t.lwd, executedConfirmed: true }
}

export function seedDemoTickets() {
  if (seeded) return
  seeded = true

  // In Transit (remote) - Marisol Ferrer
  {
    const emp = byEmpId('EMP-04821')
    const t = createTicket(emp, emp.suggestedReason, 'remote', emp.lwd, emp.sep, 'PC-END-2026-0417', '2026-09-15', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    confirmCourierBranch(t, recommendedCourierProvider()!.id, 'JRS Express - Cebu IT Park Branch', emp.address, 'call')
    t.gatesReleased = t.gateCount
    pushHistory(t, 'Courier endorsement sent', 'send')
    t.stageIdx = stageListFor(t.mode).indexOf('B11')
    t.furthestStageIdx = t.stageIdx
    pushHistory(t, 'Retrieval notice sent (email + SMS)', 'send')
    pushHistory(t, 'Marked In Transit', 'transit')
  }

  // Overdue Return (onsite) - Rafael Tan. Genuinely stage-advanced to A9
  // rather than faked via the legacy overdueForced flag - Target Date
  // resolves to 2 calendar days after the Sep 16 LWD (Sep 18), already past
  // relative to today, so Overdue Return is live-computed, matching real
  // ticket behavior instead of a seed-only shortcut.
  {
    const emp = byEmpId('EMP-02214')
    const t = createTicket(emp, emp.suggestedReason, 'onsite', emp.lwd, emp.sep, 'PC-END-2026-0301', '2026-09-14', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    t.gatesReleased = t.gateCount
    pushHistory(t, 'Retrieval notice sent', 'send')
    t.stageIdx = stageListFor(t.mode).indexOf('A9')
    t.furthestStageIdx = t.stageIdx
  }

  // Gate Not Yet Recorded (remote, Unexplained Absence, 3 gates, none
  // recorded yet) - Andrea Villar. Sitting at B9 (courier endorsement) with
  // no gate recorded - advisory only, doesn't stop the ticket working.
  {
    const emp = byEmpId('EMP-05102')
    const t = createTicket(emp, emp.suggestedReason, 'remote', emp.lwd, emp.sep, '', '', emp.id)
    finalizeItLock(t)
    confirmAssets(t)
    confirmCourierBranch(t, recommendedCourierProvider()!.id, 'JRS Express - Davao Branch', emp.address, 'call')
    t.stageIdx = stageListFor(t.mode).indexOf('B9')
    t.furthestStageIdx = t.stageIdx
  }

  // Hold Off (onsite, evidence pending) - Kevin Ong... reassigned to Josef Cruz's Hold Off slot per Overview demo row
  {
    const emp = byEmpId('EMP-01187')
    const t = createTicket(emp, emp.suggestedReason, 'remote', emp.lwd, emp.sep, 'PC-END-2026-0290', '2026-09-13', emp.id, assetTeamMemberByName('J. Santos'))
    finalizeItLock(t)
    confirmAssets(t)
    confirmCourierBranch(t, recommendedCourierProvider()!.id, 'JRS Express - Iloilo Branch', emp.address, 'call')
    t.gatesReleased = t.gateCount
    pushHistory(t, 'Courier endorsement sent', 'send')
    t.stageIdx = stageListFor(t.mode).indexOf('A10')
    t.furthestStageIdx = t.stageIdx
    pushHistory(t, 'Marked In Transit', 'transit')
    pushHistory(t, 'Assets physically received', 'return')
  }

  // Closed (onsite) - Kevin Ong
  {
    const emp = byEmpId('EMP-03310')
    const t = createTicket(emp, emp.suggestedReason, 'onsite', emp.lwd, emp.sep, 'PC-END-2026-0155', '2026-09-10', emp.id, assetTeamMemberByName('M. Bautista'))
    finalizeItLock(t)
    confirmAssets(t)
    t.gatesReleased = t.gateCount
    t.stageIdx = stageListFor(t.mode).length - 1
    t.furthestStageIdx = t.stageIdx
    t.status = 'closed'
    pushHistory(t, 'Ticket Closed', 'closure')
  }
}

/**
 * FR-003.8(g)/FR-003.10 "Return not completed within standard": if the
 * Target Date lapses, status changes automatically and immediately to
 * Overdue Return - no operator action triggers it, and it applies regardless
 * of which stage the ticket is actually sitting at (this is computed purely
 * from the date, never from stageIdx). Computed live from targetDateISO
 * every time it's read (by ticketStatusLabel/Tone, daysLeftLabel, the
 * workspace's overdue banner) rather than stored as a flag an operator has
 * to remember to flip - that's what makes it automatic. `overdueForced` is
 * kept only as a legacy manual override for seeded demo data; a real
 * ticket's overdue state should always come from this function.
 *
 * Two, and only two, real stopping points (FR-003.6's own stage-sequence
 * table names both explicitly - this is not a third, invented condition):
 * - A10 (Receipt and evidence) - by then the equipment has actually been
 *   received, so "awaiting return" no longer describes the ticket.
 * - B11 (Confirm In Transit, remote only) - FR-003.6 says B11 itself "halts
 *   the Overdue Return countdown." Once the shipment is confirmed with the
 *   courier, further delay is tracked as transit delay instead (see
 *   isTransitDelayed, B11a's own separate 14-day flag), not as the ticket
 *   having failed to return by its Target Date.
 */
export function isOverdueReturn(ticket: Ticket): boolean {
  if (ticket.overdueForced) return true
  if (ticket.status !== 'open' || !ticket.targetDateISO) return false
  if (hasReachedStage(ticket, 'A10') || hasReachedStage(ticket, 'B11')) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(ticket.targetDateISO)
  target.setHours(0, 0, 0, 0)
  return target.getTime() < today.getTime()
}

/**
 * FR-003.6 B11a Transit monitoring: "Flag as delayed where the asset has not
 * arrived within 14 calendar days of turnover to the provider." A distinct
 * clock from isOverdueReturn above - this measures time in the courier's
 * hands since B11 was confirmed, not time since the Target Date, and B11
 * having halted the Overdue Return countdown is exactly why this separate
 * flag exists (there needs to be *some* signal that a transit is taking too
 * long). This is a flag, not one of FR-003.10's status-model values - it
 * never changes ticketStatusLabel/Tone, only surfaces as its own advisory.
 */
export function isTransitDelayed(ticket: Ticket): boolean {
  if (ticket.mode !== 'remote' || ticket.status !== 'open' || !ticket.transitConfirmedAt) return false
  if (hasReachedStage(ticket, 'A10')) return false
  const turnover = new Date(ticket.transitConfirmedAt)
  turnover.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - turnover.getTime()) / 86400000)
  return days > 14
}

/**
 * FR-003.10's three post-receipt routing outcomes (A12), keyed the same way
 * as the inline routing choice on the A12 stage panel. Recorded onto
 * `Ticket.inspectionRoute` by confirmInspection() so ticketStatusLabel/Tone
 * (and the Assets Confirmed card, which reads the same functions) can show
 * the real status for the real window it applies to - A12 confirmation
 * through closure - instead of it only ever existing as a History log line.
 */
export type InspectionRoute = 'standard' | 'condition' | 'tampering'
export const INSPECTION_ROUTE_STATUS: Record<InspectionRoute, string> = {
  standard: 'Returned Device Servicing',
  condition: 'Returned Item Check',
  tampering: 'Forensic Review'
}

/**
 * Overview status pill label for a ticket - and, per direct instruction,
 * the ONLY set of values this may ever return is FR-003.10's own status
 * model table: Pending Return, In Transit, Hold Off, Returned Device
 * Servicing, Returned Item Check, Forensic Review, Overdue Return, Custodian
 * Under Review (plus Closed, for a closed ticket - the model's table is
 * silent on closure since that's a ticket-level state, not a return-status
 * trigger). It must never surface an internal stage name (e.g. "Courier
 * endorsement", "Generate and send notice") as if it were a status - those
 * are progress/stage labels, a different concept, shown elsewhere (the
 * stepper, the stage-content header). Every stage that isn't one of the
 * specific triggers below (B8, B9, A6, A7, A8, and A9 when not actually
 * lapsed) falls through to the baseline trigger that already applies to all
 * of them: "notice issued, assets confirmed" -> Pending Return.
 */
// ---------------------------------------------------------------------------
// FR-003.11 operational requirements: Reason and Mode change, takeover,
// cancellation and Path to Charge.
// ---------------------------------------------------------------------------

/**
 * Why Reason and Mode can no longer be changed, empty when they still can.
 * FR-003.11: permitted only until a notice has been sent, a call has been
 * logged or an acknowledgment captured; after that the ticket is locked to
 * its path.
 */
export function pathChangeLockReasons(ticket: Ticket): string[] {
  const out: string[] = []
  if (ticket.status !== 'open') out.push('the ticket is closed')
  if (ticket.history.some(h => h.category === 'send')) out.push('a notice or reminder has been sent')
  if (ticket.callAttempts.length) out.push('a call has been logged')
  if (Object.keys(ticket.gateReleaseDates ?? {}).length || Object.keys(ticket.gateNotes ?? {}).length) out.push('an acknowledgment has been captured')
  return out
}

/**
 * Changes Reason and Mode before the path is locked, and re-resolves everything
 * the path derives: the notice template (always read live from the matrix), the
 * Day-0 anchor and the Target Date (re-baselined, with the reason on record),
 * and the courier branch capture, which only exists on a remote path.
 */
export function changeReasonAndMode(
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
export function takeOverTicket(ticket: Ticket, note: string, newAssigneeName = currentUserName()): { ok: true } | { ok: false, error: string } {
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
export function cancelRetrieval(ticket: Ticket, reason: CancellationReason, note: string, actor = currentUserName()): { ok: true } | { ok: false, error: string } {
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
export function confirmReferredToPayroll(ticket: Ticket, actor = currentUserName()): boolean {
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
export function saveQuotationDetails(
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

export function openChargeCaseForItems(ticket: Ticket, serials: string[], actor = currentUserName()): boolean {
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

export function ticketStatusLabel(ticket: Ticket): string {
  if (ticket.cancellation) return 'Cancelled'
  if (ticket.status === 'closed') return 'Closed'
  // FR-003.10: "Unexplained absence in progress" -> Custodian Under Review.
  // Applies specifically to the window before assets are confirmed (A5) -
  // once confirmed, the normal Pending Return/In Transit/etc. statuses below
  // take over, same as every other reason. Independent of gate state - gates
  // are advisory only and never gate this status.
  if (ticket.reason === 'unexplained-absence' && !ticket.assetsLocked) return 'Custodian Under Review'
  if (isOverdueReturn(ticket)) return 'Overdue Return'
  const key = currentStageKey(ticket)
  if (key === 'B11' || key === 'B11a') return 'In Transit'
  if (key === 'A10' || key === 'A11' || key === 'A12') return 'Hold Off'
  if (ticket.inspectionRoute) return INSPECTION_ROUTE_STATUS[ticket.inspectionRoute]
  return 'Pending Return'
}

export function ticketStatusTone(ticket: Ticket): 'open' | 'closed' | 'overdue' | 'holdoff' | 'transit' {
  if (ticket.status === 'closed' || ticket.cancellation) return 'closed'
  if (ticket.reason === 'unexplained-absence' && !ticket.assetsLocked) return 'holdoff'
  if (isOverdueReturn(ticket)) return 'overdue'
  const key = currentStageKey(ticket)
  if (key === 'B11' || key === 'B11a') return 'transit'
  if (key === 'A10' || key === 'A11' || key === 'A12') return 'holdoff'
  if (ticket.inspectionRoute) return 'holdoff'
  return 'open'
}

/** True once a ticket has reached or passed a given stage (by raw list position, ignoring the skip-resolution `currentStageKey` does) - used to derive "has the notice gone out yet" style Overview columns without re-deriving the whole stage engine there. */
export function hasReachedStage(ticket: Ticket, stage: StageKey): boolean {
  const list = stageListFor(ticket.mode)
  const target = list.indexOf(stage)
  if (target === -1) return false
  return (ticket.furthestStageIdx ?? ticket.stageIdx) >= target || ticket.status === 'closed'
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
  if (days < 0 || isOverdueReturn(ticket)) return `Overdue by ${Math.abs(days)}d`
  return `${days}d left`
}
