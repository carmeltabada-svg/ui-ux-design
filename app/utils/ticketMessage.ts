// What a ticket's email or form looks like once its placeholders are filled in.
//
// This is the one place that decides which ticket field fills which placeholder.
// The ticket workspace uses it for its previews and the Placeholder Check, and the
// mock server (api/mock.ts) uses it to render the message it "sends". A real
// backend must reproduce these rules: they are covered by docs/TEMPLATES_SPEC.md
// section 6.
//
// Pure: it reads the ticket it is given and nothing else, so it can be ported and
// checked in isolation.
import {
  ACKNOWLEDGMENT_HOST, DEDUCTION_AMOUNT_BASIS_LABELS, REASON_LABELS, assetOwnerInfo, courierProviderById,
  derivedReceivedDate, derivedReturnRequestedDate, effectiveTeamMemberAddress, firstNameOf, isOverdueReturn, localISO,
  type Ticket
} from '~/data/ticketTrackers'
import {
  ORG_CONSTANT_TOKENS, SAMPLE_VALUES, checkPlaceholders, expandCaseAssetRows, expandTicketAssets, omitReceivedDate,
  resolveTokensForPrint, type PlaceholderCheckEntry
} from '~/data/templates'

// --- Calendar dates ('YYYY-MM-DD', no time zone) -------------------------------

/** "Oct 13, 2026", or "Not set". A calendar date reads the same for everyone. */
export function formatCalendarDate(iso: string | null): string {
  if (!iso) return 'Not set'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Calendar-day arithmetic on YYYY-MM-DD strings. Local getters, not toISOString(), which shifts the date back a day ahead of UTC.
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function nextWorkingDayISO(iso: string): string {
  let out = addDaysISO(iso, 1)
  while ([0, 6].includes(new Date(`${out}T00:00:00`).getDay())) out = addDaysISO(out, 1)
  return out
}

/**
 * The acknowledgment is due by the path's Day-0 deadline: the Last Working Day for Resignation and End of Contract,
 * the Recall Effective Date for Recalled, the next working day for Immediate Resignation onsite, 3 calendar days from
 * notice for Immediate Resignation remote, and the Target Date for Unexplained Absence.
 */
export function acknowledgmentDueISO(t: Ticket): string {
  switch (t.reason) {
    case 'recalled': return t.recallEffectiveDate || t.targetDateISO || ''
    case 'immediate-resignation': return t.mode === 'onsite' ? nextWorkingDayISO(t.createdAt) : addDaysISO(t.createdAt, 3)
    case 'unexplained-absence': return t.targetDateISO || ''
    default: return t.lwd || t.targetDateISO || ''
  }
}

// --- Case Details: the charging fields, as the emails and forms read them -------

/** The numeric part of an employee id ("EMP-00142" becomes "00142"). */
export const employeeIdNumber = (id: string): string => id.replace(/^\D+/, '')
/** First name as Case Details shows it: the case's own override, else the first word of the full name. */
export const caseFirstName = (t: Ticket): string => t.deductionCaseFirstNameOverride ?? firstNameOf(t.employee.name)
/** The Asset Team officer on the case: the override, else the ticket's assignee. */
export const caseOfficer = (t: Ticket): string => t.deductionCaseOfficerOverride ?? t.assignee.name
/** The date the return was requested: the override, else the earliest send in the Activity Log. */
export const caseReturnRequested = (t: Ticket): string => t.deductionCaseReturnRequestedDate || derivedReturnRequestedDate(t) || ''
/** The date the equipment was received: the override, else the evidence record. */
export const caseReceived = (t: Ticket): string => t.deductionCaseReceivedDate || derivedReceivedDate(t) || ''

/** Every confirmed asset on the ticket, for the retrieval emails' and forms' asset tables. */
export const ticketAssetLinesFor = (t: Ticket) => t.assets.filter(a => a.checked).map(a => ({ name: a.model, tag: a.assetTag, serial: a.serial }))

/** One row per asset selected in Case Details > Equipment, for the charging emails' and forms' equipment tables. */
export function caseAssetRowsFor(t: Ticket): Record<string, string>[] {
  return t.assets
    .filter(a => t.deductionCaseAssetSerials.includes(a.serial))
    .map(a => ({ ASSET_TAG: a.assetTag, SERIAL_NUMBER: a.serial, ASSET_NAME: a.model, ASSET_CONDITION: t.deductionCaseAssetNotes?.[a.serial]?.trim() ?? '' }))
}

/** Charging content with its equipment table expanded to the case's assets. */
export const caseHtmlFor = (t: Ticket, html: string | null | undefined): string =>
  expandCaseAssetRows(t.equipmentNotReturned ? omitReceivedDate(html ?? '') : (html ?? ''), caseAssetRowsFor(t))

// --- Placeholder values --------------------------------------------------------

/**
 * Real per-ticket values only, no generic sample baked in. An empty value stays undefined, so the send guard can tell a
 * code the ticket genuinely supplied apart from one that is only being papered over for a preview.
 */
export function ticketTokenValues(t: Ticket): Partial<Record<string, string>> {
  // Once Case Details Step 5 has a selection, ASSET_NAME/ASSET_TAG/SERIAL_NUMBER prefer the first selected item over the
  // ticket's own first asset: only the charging templates print per-case equipment.
  const asset = t.deductionCaseAssetSerials.length
    ? (t.assets.find(a => a.serial === t.deductionCaseAssetSerials[0]) ?? t.assets[0])
    : t.assets[0]
  const courier = courierProviderById(t.courierProviderId)
  const checkedAssets = t.assets.filter(a => a.checked)
  const date = (iso: string | null | undefined) => iso ? formatCalendarDate(iso) : undefined
  const originalTarget = t.targetDateHistory[0]?.previousDateISO ?? t.targetDateISO
  const escalation = t.reason === 'immediate-resignation' ? addDaysISO(t.createdAt, 3) : t.targetDateISO
  return {
    TM_FULL_NAME: t.employee.name,
    TM_FIRST_NAME: caseFirstName(t) || (t.employee.name.split(' ')[0] ?? t.employee.name),
    // A plain number, as Case Details shows it. The "EMP-" prefix is this seed data's own key.
    EMPLOYEE_ID: employeeIdNumber(t.employee.id),
    TM_EMAIL: t.employee.email,
    TM_CONTACT_NUMBER: t.contact.number,
    TM_PRESENT_ADDRESS: effectiveTeamMemberAddress(t),
    CLIENT_NAME: t.employee.client,
    LEADERSHIP_COACH: t.employee.leadershipCoach,
    ALTERNATE_CONTACT_NAME: t.contact.altName,
    ALTERNATE_CONTACT_NUMBER: t.contact.altNumber,
    APR_REF: t.reference,
    TICKET_CREATED_DATE: formatCalendarDate(t.createdAt),
    // Notice dates: the ticket's creation date, today (the day a notice goes out), the first send in the Activity Log, and
    // the Target Date as it stood before any re-baseline.
    NOTICE_DATE: formatCalendarDate(t.createdAt),
    DATE_OF_THIS_NOTICE: formatCalendarDate(localISO(new Date())),
    DATE_OF_ORIGINAL_NOTICE: date(derivedReturnRequestedDate(t)),
    ORIGINAL_TARGET_DATE: date(originalTarget),
    ACKNOWLEDGMENT_DUE_DATE: date(acknowledgmentDueISO(t)),
    // A token-based public link, no login. The token is a random per-ticket value, never the guessable internal id.
    ACKNOWLEDGMENT_LINK: `${ACKNOWLEDGMENT_HOST}/${t.acknowledgmentToken || t.id}`,
    RECALL_EFFECTIVE_DATE: date(t.recallEffectiveDate),
    // Immediate Resignation caps escalation at 3 calendar days from notice; every other path's clock hangs off the Target Date.
    ESCALATION_DEADLINE: date(escalation),
    TRACKING_NUMBER: t.trackingNumber || undefined,
    TRACKING_LINK: t.trackingLink || undefined,
    DAYS_OVERDUE: isOverdueReturn(t) && t.targetDateISO
      ? String(Math.max(1, Math.round((Date.now() - new Date(`${t.targetDateISO}T00:00:00`).getTime()) / 86400000)))
      : undefined,
    RETRIEVAL_REASON: REASON_LABELS[t.reason],
    RETURN_MODE: t.mode === 'onsite' ? 'Onsite' : 'Remote',
    TARGET_RETURN_DATE: date(t.targetDateISO),
    TARGET_DISPATCH_DATE: date(t.targetDateISO),
    LAST_WORKING_DAY: date(t.lwd),
    SEPARATION_DATE: date(t.sep),
    // With several confirmed assets the retrieval emails and forms print one row each (expandTicketAssets). These stay
    // single values; they only mark the codes as having ticket data. Charging keeps its picked item.
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
    // Post-Retrieval Charging: Case Details Steps 2 to 4, read the same "derived unless overridden" way the panel shows them.
    CASE_OFFICER: caseOfficer(t),
    // Nothing assigns an ATD number, so it is deterministic per ticket: ATD-<created year>-<ticket number>.
    ATD_REFERENCE: t.atdReference || `ATD-${new Date(`${t.createdAt}T00:00:00`).getFullYear()}-${String(t.ticketNumber).padStart(4, '0')}`,
    ASSET_OWNER: assetOwnerInfo(t).name,
    DATE_RETURN_REQUESTED: date(caseReturnRequested(t)),
    DATE_RECEIVED: date(caseReceived(t)),
    DATE_ASSESSED: date(t.deductionCaseAssessedDate),
    DATE_BUYOUT_ELECTION: date(t.deductionCaseBuyoutElectionDate),
    QUOTATION_EXPECTED_BY: date(t.deductionCaseQuotationExpectedDate),
    HEAR_BACK_BY: date(t.deductionCaseHearBackByDate),
    RESPONSE_DUE_TM: date(t.deductionCaseResponseDueDate),
    AMOUNT_BASIS: t.deductionCaseAmountBasis ? DEDUCTION_AMOUNT_BASIS_LABELS[t.deductionCaseAmountBasis] : undefined,
    // The tracked quotation reference wins over the free-text supporting document reference.
    SUPPORTING_DOC_REF: t.quotationReference?.trim() || t.deductionCaseSupportingDocRef,
    AMOUNT_FIGURES: t.deductionCaseAmountFigures,
    AMOUNT_WORDS: t.deductionCaseAmountWords
  }
}

/** The codes this ticket supplied a real, non-empty value for. */
export const ticketResolvedCodeSet = (t: Ticket): Set<string> =>
  new Set(Object.entries(ticketTokenValues(t)).filter(([, v]) => !!v).map(([k]) => k))

/**
 * What goes into a render: the Asset Team's fixed company details, plus this ticket's own values. A per-ticket code with no
 * value is left out, so it stays as its own {{CODE}} and the send guard counts it, never filled with generic sample data.
 */
export function ticketSampleValuesFor(t: Ticket): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(SAMPLE_VALUES).filter(([k]) => ORG_CONSTANT_TOKENS.has(k))),
    ...Object.fromEntries(Object.entries(ticketTokenValues(t)).filter((e): e is [string, string] => !!e[1]))
  }
}

/** The placeholders in `html` that this ticket cannot fill, or that are not real placeholders. */
export function placeholderIssues(t: Ticket, html: string): PlaceholderCheckEntry[] {
  return checkPlaceholders(html, ticketResolvedCodeSet(t), ticketSampleValuesFor(t))
    .filter(e => e.status === 'missing' || e.status === 'unrecognized')
}

// --- Rendering ------------------------------------------------------------------

export interface RenderedTicketMessage {
  /** The subject with its placeholders filled. Values are HTML-escaped, as in the body. */
  subject: string
  html: string
  formHtml: string | null
  /** Placeholders the ticket cannot fill. Empty when the message is ready to send. */
  issues: PlaceholderCheckEntry[]
}

/**
 * Fills an email (and the form attached to it) with a ticket's own data. Retrieval content prints one row per confirmed
 * asset; charging content prints the case's chosen items with their notes.
 */
export function renderTicketMessage(
  t: Ticket,
  content: { subject: string, body: string, formHtml?: string | null },
  options: { charging?: boolean } = {}
): RenderedTicketMessage {
  const samples = ticketSampleValuesFor(t)
  const expand = (html: string) => options.charging ? caseHtmlFor(t, html) : expandTicketAssets(html, ticketAssetLinesFor(t))
  const fill = (html: string) => resolveTokensForPrint(expand(html), samples, true, true)
  const issues = placeholderIssues(t, content.subject + content.body + (content.formHtml ?? ''))
  return {
    subject: fill(content.subject),
    html: fill(content.body),
    formHtml: content.formHtml ? fill(content.formHtml) : null,
    issues
  }
}
