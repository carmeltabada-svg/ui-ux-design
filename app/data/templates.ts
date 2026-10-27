import { reactive } from 'vue'
import { escapeText, escapeAttr } from '~/utils/escapeHtml'
// Real content sourced from the original prototype's TEMPLATES / TEMPLATE_GROUPS /
// TOKEN_GROUPS / VERSION_HISTORY JS objects (template_decoded.html, ~line 13871-14039).

export interface EmailTemplate {
  name: string
  mode: 'onsite' | 'remote'
  when: string
  attachment: string
  /**
   * Id into RETRIEVAL_FORMS (app/data/retrievalForms.ts). Every template with a
   * real attachment currently resolves to the one form sourced so far
   * ('aof-commitment') - more real forms are pending from the user.
   */
  attachmentFormId?: string
  subject: string
  body: string
}

/**
 * The base email templates the server ships (t1 to t25, with gaps), keyed by template key.
 * Filled at startup by setBaseTemplates() from the api layer, so this file holds no content.
 *
 * T22 to T25 are the four Post-Retrieval Charging outcomes (see DeductionOutcome in
 * ticketTrackers.ts). Unlike T1 to T18 they do not depend on the return mode, so their
 * `mode` is 'remote' only to keep TEMPLATE_GROUPS filtering consistent.
 */
export const TEMPLATES: Record<string, EmailTemplate> = reactive({})

/** Replaces the base templates with what the api layer returned. */
export function setBaseTemplates(rows: (EmailTemplate & { key: string })[]) {
  for (const key of Object.keys(TEMPLATES)) delete TEMPLATES[key]
  for (const { key, ...template } of rows) TEMPLATES[key] = template
}

export const TEMPLATE_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Return Notices - Resignation', keys: ['t1', 't2', 't3', 't4'] },
  { label: 'Return Notices - End of Contract', keys: ['t5', 't6'] },
  { label: 'Return Notices - Recalled', keys: ['t9', 't10'] },
  { label: 'Return Notices - Unexplained Absence', keys: ['t11'] },
  { label: 'Reminders and Overdue', keys: ['t12', 't13', 't14', 't15', 't16', 't17'] },
  { label: 'Courier', keys: ['t18'] },
  { label: 'Post-Retrieval Charging', keys: ['t22', 't23', 't24', 't25'] }
]

export const TOKEN_GROUPS: { label: string; tokens: { code: string; name: string }[] }[] = [
  { label: 'Custodian', tokens: [
    { code: 'TM_FULL_NAME', name: 'Team member full name' },
    { code: 'TM_FIRST_NAME', name: 'Team member first name' },
    { code: 'EMPLOYEE_ID', name: 'Employee ID' },
    { code: 'TM_EMAIL', name: 'GoTeam email' },
    { code: 'TM_CONTACT_NUMBER', name: 'Contact number' },
    { code: 'TM_PRESENT_ADDRESS', name: 'Present address' },
    { code: 'CLIENT_NAME', name: 'Client name' },
    { code: 'LEADERSHIP_COACH', name: 'Leadership Coach' },
    { code: 'ALTERNATE_CONTACT_NAME', name: 'Alternate contact name' },
    { code: 'ALTERNATE_CONTACT_NUMBER', name: 'Alternate contact number' }
  ] },
  { label: 'Ticket', tokens: [
    { code: 'APR_REF', name: 'Ticket reference number' },
    { code: 'TICKET_CREATED_DATE', name: 'Ticket created date' },
    { code: 'RETRIEVAL_REASON', name: 'Retrieval reason' },
    { code: 'RETURN_MODE', name: 'Return mode' }
  ] },
  { label: 'Dates', tokens: [
    { code: 'TARGET_RETURN_DATE', name: 'Target return date' },
    { code: 'TARGET_DISPATCH_DATE', name: 'Target dispatch date' },
    { code: 'LAST_WORKING_DAY', name: 'Last working day' },
    { code: 'SEPARATION_DATE', name: 'Separation date' },
    { code: 'NOTICE_DATE', name: 'Notice date' },
    { code: 'DATE_OF_THIS_NOTICE', name: 'Date this notice was sent' },
    { code: 'LEAVE_START_DATE', name: 'Leave start date' },
    { code: 'RECALL_EFFECTIVE_DATE', name: 'Recall effective date' },
    { code: 'DATE_OF_ORIGINAL_NOTICE', name: 'Date the original return/dispatch notice was sent' },
    { code: 'DAYS_OVERDUE', name: 'Days overdue' },
    { code: 'ORIGINAL_TARGET_DATE', name: 'Original return or dispatch deadline' },
    { code: 'ACKNOWLEDGMENT_DUE_DATE', name: 'Acknowledgment form due date' },
    { code: 'ESCALATION_DEADLINE', name: 'Escalation deadline' }
  ] },
  { label: 'Assets', tokens: [
    { code: 'ASSET_NAME', name: 'Asset name' },
    { code: 'ASSET_TAG', name: 'Asset tag' },
    { code: 'SERIAL_NUMBER', name: 'Serial number' },
    { code: 'ASSET_QTY', name: 'Quantity' },
    { code: 'ASSET_TABLE', name: 'Asset table, one row per confirmed asset (name, tag, serial)' },
    { code: 'ASSET_TABLE_QTY', name: 'Asset table with name and quantity only (courier endorsement, no serial numbers)' }
  ] },
  { label: 'Courier', tokens: [
    { code: 'COURIER_NAME', name: 'Courier name' },
    { code: 'COURIER_ACCOUNT_NAME', name: 'Corporate account name' },
    { code: 'COURIER_ACCOUNT_NUMBER', name: 'Corporate account number' },
    { code: 'ACCOUNT_MANAGER_NAME', name: 'Account manager name' },
    { code: 'ACCOUNT_MANAGER_EMAIL', name: 'Account manager email' },
    { code: 'BRANCH_NAME', name: 'Confirmed branch name' },
    { code: 'BRANCH_ADDRESS', name: 'Confirmed branch address' },
    { code: 'DECLARED_VALUE', name: 'Declared value - fixed system constant, PHP 5,000.00 for all shipments' },
    { code: 'TRACKING_NUMBER', name: 'Tracking or reference number' }
  ] },
  { label: 'Asset Team', tokens: [
    { code: 'ASSET_TEAM_NAME', name: 'Asset Team name' },
    { code: 'ASSET_TEAM_ADDRESS', name: 'Asset Team address' },
    { code: 'ASSET_TEAM_MOBILE', name: 'Asset Team mobile' },
    { code: 'ASSET_TEAM_LANDLINE', name: 'Asset Team landline' },
    { code: 'ASSET_TEAM_EMAIL', name: 'Asset Team email' },
    { code: 'ASSET_TEAM_SCHEDULE', name: 'Asset Team schedule' },
    { code: 'ASSET_TEAM_OFFICER', name: 'Signing officer name and title' }
  ] },
  { label: 'Links', tokens: [
    { code: 'ACKNOWLEDGMENT_LINK', name: 'Acknowledgment form link' },
    { code: 'TRACKING_LINK', name: 'Shipment tracking link' }
  ] },
  /** A11 Post-Retrieval Charging (T22-T25/F1-F3) - sourced from Case Details Steps 2-4 (see ticketTrackers.ts's own Ticket.deductionCase* fields and DEDUCTION_AMOUNT_BASIS_LABELS) plus the ticket-wide atdReference/assetOwnerInfo. See the Post-Retrieval Charging alignment notes for the reference console this group is built from. */
  { label: 'Post-Retrieval Charging', tokens: [
    { code: 'CASE_OFFICER', name: 'Asset Team officer for this case' },
    { code: 'ATD_REFERENCE', name: 'ATD reference number' },
    { code: 'ASSET_OWNER', name: 'Asset owner - GoTeam or the client' },
    { code: 'DATE_RETURN_REQUESTED', name: 'Date the return was requested' },
    { code: 'DATE_RECEIVED', name: 'Date the equipment was received' },
    { code: 'DATE_ASSESSED', name: 'Date the equipment was assessed' },
    { code: 'DATE_BUYOUT_ELECTION', name: 'Date of buy-out election' },
    { code: 'QUOTATION_EXPECTED_BY', name: 'Date the repair quotation is expected' },
    { code: 'HEAR_BACK_BY', name: 'Date the team member will hear back by' },
    { code: 'RESPONSE_DUE_TM', name: 'Date a response is due from the team member' },
    { code: 'AMOUNT_BASIS', name: 'Basis of the charged/settlement amount' },
    { code: 'SUPPORTING_DOC_REF', name: 'Supporting document reference' },
    { code: 'AMOUNT_FIGURES', name: 'Amount in figures' },
    { code: 'AMOUNT_WORDS', name: 'Amount in words' },
    { code: 'ASSET_CONDITION', name: 'Condition, finding or settlement amount per item' }
  ] }
]

/**
 * FR-003.6 A7 ("Call confirmation ... SMS after an unanswered attempt") and
 * FR-003.12 ("SMS-1A to SMS-11 ... Copy-paste only. No gateway integration
 * required. Presented in a sidebar box ... a manual sent-confirmation
 * control"). The real submission ships 11 numbered SMS templates (one per
 * retrieval path) alongside their email counterparts - not included in this
 * codebase - so this is the one generic follow-up text A7's own escalation
 * step needs: a short, copy-paste SMS sent once 3 call attempts have gone
 * unanswered, using the same {{TOKEN}} placeholders as every email template.
 */
export const CALL_ESCALATION_SMS_TEMPLATE = "GoTeam Asset Mgmt: Hi {{TM_FIRST_NAME}}, we've tried calling you 3 times re: your equipment return (Ref {{APR_REF}}) with no answer. Please check your email for the retrieval notice and call us back at {{ASSET_TEAM_MOBILE}} at your earliest convenience."

// Real version history recorded against t16 (Overdue Return Notice · Onsite) in the source.
export const VERSION_HISTORY_T16 = [
  { id: 'v2', label: 'Wording corrected', actor: 'Geraldene de la Torre', date: '2026-08-18T06:41:00.000Z' },
  { id: 'v1', label: 'Created from spec', actor: 'System', date: 'Aug 7, 2026, 4:15 PM' }
]

// code -> name lookup, mirrors the source's TOKEN_INFO built from TOKEN_GROUPS.forEach(...)
export const TOKEN_INFO: Record<string, string> = Object.fromEntries(
  TOKEN_GROUPS.flatMap(g => g.tokens.map(t => [t.code, t.name]))
)

// The legal-entity address line printed under the logo in a retrieval
// form's header - copied verbatim from the reference mockup
// (GoTeam_Asset_Receiving_Commitment_Form_Mockup_v1.html's `ADDR` constant),
// not derived from SAMPLE_VALUES.ASSET_TEAM_ADDRESS (that one's the shorter
// "where to return equipment" line used inside email bodies, missing the
// entity name, the "Apas" barangay, and the zip code this one has).
export const GOTEAM_ENTITY_ADDRESS = 'Go Virtual Assistants Inc.  |  9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000'

// Realistic sample values used to preview what a filled-in email looks like,
// standing in for the source's SAMPLE_SETS/COURIER_PROVIDERS (extracted but not wired).
export const SAMPLE_VALUES: Record<string, string> = {
  TM_FULL_NAME: 'Juan Miguel Dela Cruz',
  TM_FIRST_NAME: 'Juan',
  EMPLOYEE_ID: 'GT-00482',
  TM_EMAIL: 'juan.delacruz@go.team',
  TM_CONTACT_NUMBER: '+63 917 123 4567',
  TM_PRESENT_ADDRESS: '145 Salinas Drive, Lahug, Cebu City',
  CLIENT_NAME: 'Wave Contact Center',
  LEADERSHIP_COACH: 'Ana Reyes',
  ALTERNATE_CONTACT_NAME: 'Maria Dela Cruz',
  ALTERNATE_CONTACT_NUMBER: '+63 917 765 4321',
  APR_REF: 'APR-2026-04821',
  TICKET_CREATED_DATE: 'Aug 4, 2026',
  RETRIEVAL_REASON: 'Resignation',
  RETURN_MODE: 'Onsite',
  TARGET_RETURN_DATE: 'Aug 20, 2026',
  TARGET_DISPATCH_DATE: 'Aug 20, 2026',
  LAST_WORKING_DAY: 'Aug 19, 2026',
  SEPARATION_DATE: 'Aug 19, 2026',
  NOTICE_DATE: 'Aug 5, 2026',
  DATE_OF_THIS_NOTICE: 'Aug 27, 2026',
  DATE_OF_ORIGINAL_NOTICE: 'Aug 13, 2026',
  LEAVE_START_DATE: 'Aug 6, 2026',
  RECALL_EFFECTIVE_DATE: 'Aug 12, 2026',
  DAYS_OVERDUE: '7',
  ORIGINAL_TARGET_DATE: 'Aug 20, 2026',
  ACKNOWLEDGMENT_DUE_DATE: 'Aug 22, 2026',
  ESCALATION_DEADLINE: 'Aug 29, 2026',
  ASSET_NAME: 'Lenovo ThinkPad T14',
  ASSET_TAG: 'GT-LTP-1116',
  SERIAL_NUMBER: 'PF3KX9J2',
  ASSET_QTY: '1',
  ASSET_TABLE: '1x Lenovo ThinkPad T14 (Tag: GT-LTP-1116, Serial: PF3KX9J2)',
  ASSET_TABLE_QTY: '1x Lenovo ThinkPad T14',
  COURIER_NAME: 'LBC Express',
  COURIER_ACCOUNT_NAME: 'Go Virtual Assistants Inc.',
  COURIER_ACCOUNT_NUMBER: '0192-8834-01',
  ACCOUNT_MANAGER_NAME: 'Realyn Buot',
  ACCOUNT_MANAGER_EMAIL: 'realyn.buot@lbcexpress.com',
  BRANCH_NAME: 'LBC IT Park Branch',
  BRANCH_ADDRESS: 'Rockwell Business Center, IT Park, Cebu City',
  DECLARED_VALUE: 'PHP 5,000.00',
  TRACKING_NUMBER: 'LBC-88213904',
  ASSET_TEAM_NAME: 'Asset Management Team',
  ASSET_TEAM_ADDRESS: '9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Cebu City',
  ASSET_TEAM_MOBILE: '+63 917 000 1234',
  ASSET_TEAM_LANDLINE: '(032) 000 1234',
  ASSET_TEAM_EMAIL: 'itasset@go.team',
  ASSET_TEAM_SCHEDULE: 'Mon to Fri, 9 AM to 6 PM',
  ASSET_TEAM_OFFICER: 'Geraldene de la Torre, Asset Management Lead',
  ACKNOWLEDGMENT_LINK: 'https://forms.go.team/acknowledgment/APR-2026-04821',
  TRACKING_LINK: 'https://lbcexpress.com/track/LBC-88213904',
  CASE_OFFICER: 'Geraldene de la Torre',
  ATD_REFERENCE: 'ATD-2026-0142',
  ASSET_OWNER: 'GoTeam',
  DATE_RETURN_REQUESTED: 'Aug 13, 2026',
  DATE_RECEIVED: 'Aug 22, 2026',
  DATE_ASSESSED: 'Aug 25, 2026',
  DATE_BUYOUT_ELECTION: 'Aug 26, 2026',
  QUOTATION_EXPECTED_BY: 'Sep 1, 2026',
  HEAR_BACK_BY: 'Sep 3, 2026',
  RESPONSE_DUE_TM: 'Sep 8, 2026',
  AMOUNT_BASIS: 'Documented repair quotation',
  SUPPORTING_DOC_REF: 'QUO-2026-0819',
  AMOUNT_FIGURES: 'PHP 5,400.00',
  AMOUNT_WORDS: 'Five Thousand Four Hundred Pesos Only',
  ASSET_CONDITION: 'Cracked display, lower left corner'
}

/**
 * Wraps every {{TOKEN}} occurrence in `html` with a highlightable span carrying
 * the token code (for click-to-sync highlighting) and data attributes driving a
 * custom two-line tooltip (name above, {{CODE}} below - see .tok-hl in main.css).
 * Pass `samples` (e.g. SAMPLE_VALUES) to render a realistic filled-in value
 * instead of the raw {{CODE}} text.
 */
export function wrapTokens(html: string, samples?: Record<string, string>, statusFor?: (code: string) => PlaceholderStatus): string {
  // Tags are matched whole, before text tokens, so a placeholder inside an
  // attribute (a plain link's href, or a button link's data-href) is filled
  // in right there. The tag itself carries the highlight, since a span can
  // not live inside an attribute.
  return html.replace(/(<[a-zA-Z][^<>]*>)|\{\{(\w+)\}\}/g, (match, tag: string | undefined, code: string) => {
    if (tag) return wrapAttributeTokens(tag, samples, statusFor)
    const name = TOKEN_INFO[code] || code
    // A substituted value is plain text, so it is escaped here: this string is rendered with v-html, and a team member name or a typed reference must never be able to inject markup.
    const display = samples && samples[code] !== undefined ? escapeText(samples[code]) : match
    const tip = samples ? ` data-tip-name="${escapeAttr(name)}" data-tip-code="${match}"` : ''
    // Optional per-ticket status modifier (retrieval workspace only - the
    // Templates/Master Data editors that also call wrapTokens() have no
    // ticket to check a code's real data against, so they never pass this
    // and every token there stays the plain default-blue .tok-hl).
    const statusClass = statusFor ? ` tok-hl--${statusFor(code)}` : ''
    return `<span class="tok-hl${statusClass}" data-token="${code}"${tip}>${display}</span>`
  })
}


/**
 * The tag-level half of wrapTokens: fills any {{TOKEN}} found in this tag's
 * attributes with its value (attribute-escaped) and marks the tag itself with
 * the same highlight class, data-token and tooltip a text token's span gets.
 */
function wrapAttributeTokens(tag: string, samples?: Record<string, string>, statusFor?: (code: string) => PlaceholderStatus): string {
  const codes = [...tag.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1] as string)
  if (!codes.length || !samples) return tag
  const first = codes[0]!
  let out = tag.replace(/\{\{(\w+)\}\}/g, (m, code: string) => escapeAttr(samples[code] ?? m))
  const cls = `tok-hl${statusFor ? ` tok-hl--${statusFor(first)}` : ''}`
  const extra = ` data-token="${first}" data-tip-name="${TOKEN_INFO[first] || first}" data-tip-code="&#123;&#123;${first}&#125;&#125;"`
  out = /\sclass="/.test(out)
    ? out.replace(/\sclass="([^"]*)"/, (_m, c: string) => ` class="${c} ${cls}"`)
    : out.replace(/\s*\/?>$/, m => ` class="${cls}"${m}`)
  return out.replace(/\s*\/?>$/, m => `${extra}${m}`)
}

/**
 * A genuinely final rendering of `{{TOKEN}}` occurrences - no highlight span,
 * no tooltip, just the resolved value (or, for a code with no sample value,
 * nothing at all). Unlike wrapTokens (which always keeps the raw `{{CODE}}`
 * text visible so an editor can spot/click it), this is for a document a
 * recipient actually reads or prints - the whole point is that they should
 * never see raw `{{CODE}}` placeholder syntax that never got filled in.
 */
export function resolveTokensForPrint(html: string, samples: Record<string, string>, keepUnresolved = false, escapeValues = false): string {
  // keepUnresolved: a ticket-scoped render leaves a code it has no real value
  // for as its raw {{CODE}} token, rather than blanking it or filling it with
  // generic sample data.
  // Inside a tag (a link or button href) the value is attribute-escaped. Pass escapeValues when the result is rendered as HTML (forms and printouts); leave it off for plain text such as an SMS.
  return html.replace(/(<[a-zA-Z][^<>]*>)|\{\{(\w+)\}\}/g, (match, tag: string | undefined, code: string) => {
    if (tag) return tag.replace(/\{\{(\w+)\}\}/g, (m, c: string) => (samples[c] !== undefined ? escapeAttr(samples[c]) : (keepUnresolved ? m : '')))
    const value = samples[code]
    if (value === undefined) return keepUnresolved ? match : ''
    return escapeValues ? escapeText(value) : value
  })
}

/**
 * Codes that are genuinely organization-wide constants (the Asset Team's own
 * contact details, the fixed declared shipping value) rather than anything
 * that varies by ticket - these never have a per-ticket source and were never
 * meant to, so the Placeholder Check below doesn't flag them as "missing
 * ticket data" the way it flags a real per-ticket field (courier, dates,
 * asset info) that this ticket happens not to have.
 */
export const ORG_CONSTANT_TOKENS = new Set([
  'ASSET_TEAM_NAME', 'ASSET_TEAM_ADDRESS', 'ASSET_TEAM_MOBILE', 'ASSET_TEAM_LANDLINE',
  'ASSET_TEAM_EMAIL', 'ASSET_TEAM_SCHEDULE', 'ASSET_TEAM_OFFICER', 'DECLARED_VALUE',
  // The corporate account is held in the company's own name.
  'COURIER_ACCOUNT_NAME'
])

/** Every distinct {{CODE}} appearing in `html`, in first-seen order. */
export function extractTokenCodes(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of html.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(m[1]!)) { seen.add(m[1]!); out.push(m[1]!) }
  }
  return out
}

export type PlaceholderStatus = 'resolved' | 'org-constant' | 'missing' | 'unrecognized'

export interface PlaceholderCheckEntry {
  code: string
  name: string
  status: PlaceholderStatus
  /** what would actually print in the real, sent document right now */
  previewValue: string
}

/**
 * The comparison behind the Placeholder Check feature: for every {{CODE}}
 * actually used in a piece of attached content, says whether this ticket has
 * a real value for it or whether it's "out of context" - either falling back
 * to generic sample text because the ticket has no data for it, or not a
 * recognized placeholder at all (a typo, or a token invented in the editor
 * that no real ticket field will ever fill), in which case it prints as
 * nothing in the actual sent document (see resolveTokensForPrint above).
 * `ticketResolvedCodes` are the codes this specific ticket supplied a real,
 * non-empty value for - see ticketSampleValues/ticketResolvedCodes in
 * ticket-tracker/[id].vue for how that set is built.
 */
/** The single source of truth behind both checkPlaceholders (the drawer) and the highlighted-preview coloring (wrapTokens' statusFor) - kept as one function so the two can never quietly disagree about what counts as resolved/missing/unrecognized for a given code. */
export function placeholderStatusFor(code: string, ticketResolvedCodes: Set<string>): PlaceholderStatus {
  if (!TOKEN_INFO[code]) return 'unrecognized'
  if (ORG_CONSTANT_TOKENS.has(code)) return 'org-constant'
  if (ticketResolvedCodes.has(code)) return 'resolved'
  return 'missing'
}

export function checkPlaceholders(
  html: string,
  ticketResolvedCodes: Set<string>,
  samples: Record<string, string>
): PlaceholderCheckEntry[] {
  return extractTokenCodes(html).map((code) => {
    const status = placeholderStatusFor(code, ticketResolvedCodes)
    const name = TOKEN_INFO[code] ?? code
    return { code, name, status, previewValue: status === 'unrecognized' ? '' : (samples[code] ?? `{{${code}}}`) }
  })
}


/**
 * A case where the equipment never came back has no receipt, so a "Date
 * received" line has nothing to say (and nothing to fill it from). Charging
 * content drops that line for such cases.
 */
export function omitReceivedDate(html: string): string {
  return html.replace(/Date received: \{\{DATE_RECEIVED\}\}(<br>|<\/p>)/g, (_m, tail) => tail === '</p>' ? '</p>' : '')
}

/** One asset on a ticket, as the retrieval emails and forms print it. */
export interface TicketAssetLine { name: string, tag: string, serial: string }

/**
 * Prints every confirmed asset of a ticket, one row per asset.
 *
 * Integrity rules, so a row can never show a tag that belongs to another
 * asset's name:
 * - A row is built from ONE asset record: name, tag and serial are read from
 *   the same object in the same pass. Separate lists are never zipped.
 * - A token never holds several values. Each row's token holds that row's
 *   own value, so the placeholder can still be located and highlighted.
 * - A row that carries {{ASSET_TAG}} or {{SERIAL_NUMBER}} is a per-asset row,
 *   and its {{ASSET_QTY}} is 1. A row with only {{ASSET_NAME}} and
 *   {{ASSET_QTY}} is the aggregated courier table: one row per distinct
 *   model, quantity counted from the very same list.
 * - {{ASSET_TABLE}} and {{ASSET_TABLE_QTY}} expand to those same two tables.
 * Charging content (its last column is {{ASSET_CONDITION}}) is left alone,
 * because that table lists the case's own items, see expandCaseAssetRows.
 *
 * \`wrap\` lets the on-screen preview emit its highlight span around each
 * filled value (the markup wrapTokens writes). Without it the value is plain
 * escaped text, which is what gets sent and printed.
 */
export function expandTicketAssets(
  html: string,
  assets: TicketAssetLine[],
  wrap?: (code: string, value: string) => string
): string {
  if (!assets.length || !html || html.includes('{{ASSET_CONDITION}}')) return html
  const put = (code: string, value: string) => wrap ? wrap(code, value) : escapeText(value)
  const grouped: { name: string, qty: number }[] = []
  for (const a of assets) {
    const g = grouped.find(x => x.name === a.name)
    if (g) g.qty++
    else grouped.push({ name: a.name, qty: 1 })
  }
  const fullTable = '<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr>'
    + assets.map(a => `<tr><td>${put('ASSET_NAME', a.name)}</td><td>${put('ASSET_TAG', a.tag)}</td><td>${put('SERIAL_NUMBER', a.serial)}</td></tr>`).join('') + '</table>'
  const qtyTable = '<table><tr><th>Asset Name</th><th>Qty</th></tr>'
    + grouped.map(g => `<tr><td>${put('ASSET_NAME', g.name)}</td><td>${put('ASSET_QTY', String(g.qty))}</td></tr>`).join('') + '</table>'
  const row = (tokens: string) => new RegExp(String.raw`<tr>(?:(?!</tr>)[\s\S])*?\{\{(?:${tokens})\}\}(?:(?!</tr>)[\s\S])*</tr>`, 'g')
  const fill = (rowHtml: string, values: Record<string, string>) =>
    rowHtml.replace(/\{\{(ASSET_NAME|ASSET_TAG|SERIAL_NUMBER|ASSET_QTY)\}\}/g, (m, code: string) => code in values ? put(code, values[code]!) : m)
  return html
    .replace(/\{\{ASSET_TABLE_QTY\}\}/g, qtyTable)
    .replace(/\{\{ASSET_TABLE\}\}/g, fullTable)
    // Per-asset rows: any row with a tag or serial. Its quantity is 1.
    .replace(row('ASSET_TAG|SERIAL_NUMBER'), rowHtml => assets.map(a =>
      fill(rowHtml, { ASSET_NAME: a.name, ASSET_TAG: a.tag, SERIAL_NUMBER: a.serial, ASSET_QTY: '1' })).join(''))
    // Aggregated rows: name and quantity only, one row per distinct model.
    .replace(row('ASSET_QTY|ASSET_NAME'), rowHtml => grouped.map(g =>
      fill(rowHtml, { ASSET_NAME: g.name, ASSET_QTY: String(g.qty) })).join(''))
}

/**
 * Post-Retrieval Charging prints one table row per asset in the case. Any
 * <tr> that carries an asset placeholder ({{ASSET_TAG}}, {{SERIAL_NUMBER}},
 * {{ASSET_NAME}}, {{ASSET_CONDITION}}) is repeated once per row in `rows`,
 * each copy filled with that asset's values. A value missing for a row
 * leaves its token in place, so the placeholder check still catches it.
 * Works on saved template/form content too - nothing in the stored HTML
 * has to change.
 */
export function expandCaseAssetRows(html: string, rows: Record<string, string>[]): string {
  if (!rows.length || !html) return html
  return html.replace(/<tr>(?:(?!<\/tr>)[\s\S])*?\{\{(?:ASSET_TAG|SERIAL_NUMBER|ASSET_NAME|ASSET_CONDITION)\}\}(?:(?!<\/tr>)[\s\S])*<\/tr>/g, rowHtml =>
    rows.map(r => rowHtml.replace(/\{\{(ASSET_TAG|SERIAL_NUMBER|ASSET_NAME|ASSET_CONDITION)\}\}/g, (tok, code) => r[code] ? escapeText(r[code]) : tok)).join(''))
}
