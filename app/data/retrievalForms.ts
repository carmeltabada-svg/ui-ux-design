// Real form content ported verbatim from the source ticket page
// (assets-test.go.team/public/tickets/v2/aof-commitment/...). This is the single
// source of truth for the Retrieval Forms directory - the list page, the
// drag-and-drop builder, and the standalone /form-preview page all render off
// these records instead of holding their own copies.
import { reactive } from 'vue'
export type FormFieldType =
  | 'short_text'
  | 'paragraph'
  | 'number'
  | 'checkbox'
  | 'file_upload'
  | 'signature'
  | 'static_text'
  | 'button_link'

export interface FormField {
  id: string
  type: FormFieldType
  label: string
  /** always true for `signature` fields - a signature box is always required */
  required?: boolean
  hint?: string
  /** static_text only - pre-authored HTML, rendered via v-html */
  content?: string
  /** button_link only - the URL the button opens in a new tab */
  buttonUrl?: string
  /** button_link only - an optional leading Lucide icon, e.g. i-lucide-external-link */
  buttonIcon?: string
  /** button_link only - defaults to 'primary' */
  buttonColor?: string
  /** Only meaningful for a field living in a `headless` section (one with no
   * section grouping at all) - each such field picks its own boxed/plain
   * look independently, since there's no shared section layout to inherit
   * from. Ignored for a field inside a normal, titled section (it always
   * follows that section's own `layout` instead). */
  layout?: 'boxed' | 'plain'
}

export interface FormSection {
  id: string
  title: string
  fields: FormField[]
  /** overrides the form's themeColor for just this section's header bar - falls back to it when unset */
  color?: string
  /** 'boxed' (default) - the classic bordered two-column table with a
   * colored header bar, everything treated as one grouped question set.
   * 'plain' - no header bar, no table borders, no section grouping visually -
   * each field just stacks full-width (label above, input below) like a
   * standalone form field, not a row in a shared box. Ignored (no header
   * rendered either way) when `headless` is set. */
  layout?: 'boxed' | 'plain'
  /** true for the one implicit "fields with no section" container a form
   * can have - never gets a title, header bar, or section-level move/color/
   * duplicate/remove controls, since there's no section identity to manage.
   * Fields can be dragged into or out of it like any other section. */
  headless?: boolean
}

export interface FormBackground {
  type: 'solid' | 'gradient' | 'image'
  /** solid: hex color. gradient: a full CSS `linear-gradient(...)` string. image: a URL/data URL */
  value: string
}

export type PageSize = 'letter' | 'legal' | 'a4' | 'tabloid'

export interface PageMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/** Microsoft Word's own "Normal" template default - 1 inch (96px at 96dpi,
 * matching the PAGE_SIZES table's own dpi assumption) on every side - not a
 * custom or mockup-derived value, so a form opened in Word after export (or
 * measured against a real printed page) lines up with what this app shows,
 * rather than an app-specific approximation. The default every form starts
 * with until someone picks their own via the Margins control. See
 * FormDocumentEditor.vue's pageSizeConfig for where this actually gets
 * applied (both the builder canvas and /form-preview's print output go
 * through that same component, so there's one source of truth for "what
 * margins does this page have" instead of print silently drifting from what
 * the canvas shows). */
export const DEFAULT_PAGE_MARGINS: PageMargins = { top: 96, right: 96, bottom: 96, left: 96 }

export type MarginPresetName = 'normal' | 'narrow' | 'moderate' | 'wide' | 'custom'

/** Microsoft Word's own Layout > Margins gallery (and Google Docs' equivalent
 * named presets) - four fixed, named options, identical in every one of them
 * regardless of paper size. Real Word/Google Docs never scale a margin by
 * page size (a Letter, A4, or Tabloid page all get the same "Normal" 1" on
 * every side) - only the page dimensions themselves change per PAGE_SIZES
 * above. `custom` isn't a real preset (it has no fixed values here) - it's
 * the fallback label shown once the user's own numbers stop matching any of
 * the four below, exactly like Word's gallery deselects every option and
 * just shows the dialog's own numbers once you've hand-edited them. */
export const MARGIN_PRESETS: Record<Exclude<MarginPresetName, 'custom'>, { label: string, margins: PageMargins }> = {
  normal: { label: 'Normal', margins: { top: 96, right: 96, bottom: 96, left: 96 } },
  narrow: { label: 'Narrow', margins: { top: 48, right: 48, bottom: 48, left: 48 } },
  moderate: { label: 'Moderate', margins: { top: 96, right: 72, bottom: 96, left: 72 } },
  wide: { label: 'Wide', margins: { top: 96, right: 192, bottom: 96, left: 192 } }
}

/** Which named preset (if any) a given margins value matches - drives the
 * Margins popover's own select so it reflects "Normal"/"Narrow"/etc. instead
 * of always showing raw numbers, the same way Word's Margins button shows a
 * checkmark next to the matching gallery tile. Falls back to 'custom' once
 * any one side has been hand-edited away from every preset's exact values. */
export function matchMarginPreset(margins: PageMargins): MarginPresetName {
  const entry = (Object.entries(MARGIN_PRESETS) as [Exclude<MarginPresetName, 'custom'>, { margins: PageMargins }][])
    .find(([, preset]) => preset.margins.top === margins.top && preset.margins.right === margins.right &&
      preset.margins.bottom === margins.bottom && preset.margins.left === margins.left)
  return entry?.[0] ?? 'custom'
}

/** Standard paper dimensions at 96dpi (CSS px), so the builder canvas and
 * /form-preview's print output share one source of truth for "what size is
 * this document" - matters for the asset team laying pages out accurately,
 * not just eyeballing an arbitrary on-screen width. */
export const PAGE_SIZES: Record<PageSize, { label: string, widthPx: number, heightPx: number }> = {
  letter: { label: 'Letter (8.5" x 11")', widthPx: 816, heightPx: 1056 },
  legal: { label: 'Legal (8.5" x 14")', widthPx: 816, heightPx: 1344 },
  a4: { label: 'A4 (210mm x 297mm)', widthPx: 794, heightPx: 1123 },
  tabloid: { label: 'Tabloid (11" x 17")', widthPx: 1056, heightPx: 1632 }
}

export interface RetrievalForm {
  id: string
  name: string
  description: string
  mode: 'onsite' | 'remote'
  status: 'active' | 'draft' | 'retired'
  updatedAt: string
  /** accent color applied to headers, required marks, and the signature box */
  themeColor: string
  background?: FormBackground
  /** standard paper size the canvas/preview/print are dimensioned to. Defaults to 'letter' when absent (forms created before this field existed). */
  pageSize?: PageSize
  /** Page padding (px, 96dpi) - falls back to DEFAULT_PAGE_MARGINS when absent (forms created before this field existed). */
  margins?: PageMargins
  /** The asset-lifecycle event this form belongs to (e.g. 'Resignation', 'Immediate Resignation',
   * 'End of Contract', 'Recalled', 'Deployment') - printed in the document header's ref stamp
   * (see /form-preview.vue), matching the reference mockup's per-transaction-type stamp. Falls
   * back to the mode ("Onsite"/"Remote") when absent, for forms created before this field existed. */
  category?: string
  /** true once the name has been typed directly (not just auto-derived from the first section title) */
  nameManuallySet?: boolean
  /** off by default - most forms in this app are acknowledgements with no
   * submission step; a form only gets a Submit button when this is turned on */
  showSubmitButton?: boolean
}

export const BACKGROUND_SWATCHES = [
  { type: 'solid' as const, value: '#FFFFFF' },
  { type: 'solid' as const, value: '#F8FAFC' },
  { type: 'solid' as const, value: '#FEF9C3' },
  { type: 'solid' as const, value: '#DBEAFE' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #E0E7FF 0%, #FFFFFF 100%)' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #FCE7F3 0%, #FFFFFF 100%)' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #D1FAE5 0%, #FFFFFF 100%)' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #386BE6 0%, #082F9C 100%)' }
]

export const FIELD_TYPE_INFO: Record<FormFieldType, { label: string, icon: string }> = {
  short_text: { label: 'Short text', icon: 'i-lucide-type' },
  paragraph: { label: 'Paragraph', icon: 'i-lucide-align-left' },
  number: { label: 'Number', icon: 'i-lucide-hash' },
  checkbox: { label: 'Checkbox', icon: 'i-lucide-square-check' },
  file_upload: { label: 'File upload', icon: 'i-lucide-upload' },
  signature: { label: 'Required signature box', icon: 'i-lucide-pen-line' },
  static_text: { label: 'Text Block', icon: 'i-lucide-file-text' },
  button_link: { label: 'Button link', icon: 'i-lucide-external-link' }
}

export const THEME_COLOR_SWATCHES = [
  '#386BE6', // app primary blue
  '#082F9C',
  '#0E7C4A',
  '#B45309',
  '#BE123C',
  '#7C3AED',
  '#0F766E',
  '#334155'
]

// The old sections/fields model (see FormSection/FormField above) is kept as
// a type/store shape for backward compatibility with formContentMigration.ts,
// but no seeded form still uses it - 'aof-commitment' (the one form that did)
// was removed entirely in favor of the two Equipment Return Acknowledgment
// forms below, which are real Tiptap-document forms from the start (see
// RETRIEVAL_FORM_CONTENT).
export const RETRIEVAL_FORM_SECTIONS: Record<string, FormSection[]> = reactive({})

/** Document canvas HTML per form (see FormDocumentEditor.vue), keyed by form
 * id - the replacement for `RETRIEVAL_FORM_SECTIONS` (the old typed
 * sections/fields model, now legacy but kept on disk, not deleted, in case
 * anything still needs it). Starts empty; the form editor lazily converts a
 * form's `sections` into this the first time it's opened after the
 * sections->document migration (see `app/utils/formContentMigration.ts`),
 * then never touches `sections` for that form again. A form created fresh
 * after the migration just starts with an empty document - there's nothing
 * to convert. */
const onsiteReturnCommitmentHtml = `
<h2>Team Member Information</h2>
<div data-form-field id="onsite-full-name" field-type="short_text" label="Full Name" hint="" required="true"></div>
<div data-form-field id="onsite-employee-id" field-type="short_text" label="Employee ID" hint="" required="true"></div>
<div data-form-field id="onsite-effective-date" field-type="short_text" label="Last Working Day / Effective Date" hint="Enter the last working day, resignation notice date, or recall effective date stated in your notice." required="true"></div>
<p>Return Mode: Onsite.</p>
<h2>Equipment Assigned</h2>
<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial No.</th><th>Condition</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td><div data-form-field id="onsite-condition" field-type="short_text" label="Condition" hint="" required="false" hide-label="true"></div></td></tr></table>
<h2>Contact Details Confirmation</h2>
<div data-form-field id="onsite-address" field-type="paragraph" label="Current Address" hint="" required="true"></div>
<div data-form-field id="onsite-mobile" field-type="short_text" label="Mobile Number" hint="" required="true"></div>
<div data-form-field id="onsite-landmark" field-type="short_text" label="Landmark" hint="" required="false"></div>
<h2>Return Commitment</h2>
<p>Return Location: Asset Team Room, {{ASSET_TEAM_ADDRESS}}. Turnover Hours: {{ASSET_TEAM_SCHEDULE}}.</p>
<div data-form-field id="onsite-target-date" field-type="short_text" label="Target Date of Turnover" hint="Select a date on or before the turnover deadline stated in your notice." required="true"></div>
<div data-callout>
<ol>
<li>Select a target date on or before the turnover deadline stated in your notice. A later date cannot be submitted.</li>
<li>Turn the equipment over at the Asset Team Room during Asset Management Team operating hours on that date. There is no time slot to arrange.</li>
<li>Equipment is handed over in person. Leaving it at a workstation, with a colleague, or at reception is not an accepted turnover.</li>
<li>Ensure the turnover is completed successfully. If anything prevents you from completing it on your committed date, contact the Asset Management Team the same day at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}} so we can support you.</li>
</ol>
</div>
<h2>Equipment Notes</h2>
<div data-form-field id="onsite-condition-notes" field-type="paragraph" label="Discrepancies / Condition Notes" hint="Enter any missing items, accessory discrepancies, or condition observations here." required="false"></div>
<h2>Declaration</h2>
<p>I, {{TM_FULL_NAME}}, Employee ID {{EMPLOYEE_ID}}, declare and confirm the following:</p>
<ol>
<li>The equipment listed in this acknowledgment is, or was, issued to me by GoTeam and held under my custody and accountability as its assigned custodian.</li>
<li>I acknowledge receipt of the Equipment Return Notice issued to me, and I understand that I am required to return all of the listed equipment to GoTeam's custody.</li>
<li>I agree to return the listed equipment in person at the Asset Team Room by the deadline stated.</li>
<li>The equipment I am returning is complete, including all accompanying accessories. Where any listed item is not in my possession, or is not in serviceable condition, I have declared this in the Equipment Notes together with the reason.</li>
<li>I understand that failure to comply may result in the consequences detailed in this notice, including the withholding of the Asset Management Team's clearance sign-off.</li>
<li>The information I have given in this acknowledgment is true and correct to the best of my knowledge. I understand that this acknowledgment forms part of GoTeam's asset records and may be relied upon as evidence of the matters declared here.</li>
</ol>
<div data-form-field id="onsite-signature" field-type="signature" label="Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="onsite-date-signed" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<div data-message-banner>
<p><strong>Independent Obligation Notice</strong></p>
<p>The obligation to return all company and client-issued equipment is an independent contractual obligation under GoTeam's Asset Management Policy and your employment agreement. This obligation exists regardless of whether this acknowledgment form is signed or returned. GoTeam will rely on the issuance of this notice as formal evidence that the return obligation has been communicated to you.</p>
</div>
`.trim()

const remoteReturnCommitmentHtml = `
<h2>Team Member Information</h2>
<div data-form-field id="remote-full-name" field-type="short_text" label="Full Name" hint="" required="true"></div>
<div data-form-field id="remote-employee-id" field-type="short_text" label="Employee ID" hint="" required="true"></div>
<div data-form-field id="remote-effective-date" field-type="short_text" label="Last Working Day / Effective Date" hint="Enter the last working day, resignation notice date, or recall/absence date stated in your notice." required="true"></div>
<p>Return Mode: Remote.</p>
<h2>Equipment Assigned</h2>
<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial No.</th><th>Condition</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td><div data-form-field id="remote-condition" field-type="short_text" label="Condition" hint="" required="false" hide-label="true"></div></td></tr></table>
<h2>Contact Details Confirmation</h2>
<div data-form-field id="remote-address" field-type="paragraph" label="Current Address" hint="" required="true"></div>
<div data-form-field id="remote-mobile" field-type="short_text" label="Mobile Number" hint="" required="true"></div>
<div data-form-field id="remote-landmark" field-type="short_text" label="Landmark" hint="" required="false"></div>
<h2>Return Commitment</h2>
<p>GoTeam maintains active corporate accounts with the following couriers:</p>
<ul>
<li><strong>JRS Express (Recommended)</strong> — Credit Account: Go Virtual Assistants Inc., Account No. 110604. Crating available.</li>
<li><strong>LBC</strong> — Account: Go Virtual Assistants, Inc., Account No. 10809702 (National Standard).</li>
</ul>
<div data-form-field id="remote-courier" field-type="short_text" label="Preferred Courier (JRS Express or LBC)" hint="" required="true"></div>
<div data-form-field id="remote-branch-name" field-type="short_text" label="Exact Branch Name" hint="Enter it exactly as it appears on the courier's official branch locator or storefront." required="true"></div>
<div data-form-field id="remote-lodging-date" field-type="short_text" label="Target Date of Lodging" hint="" required="true"></div>
<div data-form-field id="remote-branch-address" field-type="paragraph" label="Complete Branch Address" hint="" required="true"></div>
<p>Freight Account: GoTeam corporate account. Declared Value: {{DECLARED_VALUE}}.</p>
<div data-callout>
<p><strong>What happens after you submit:</strong> submission of this section is your branch confirmation, so the branch you name must be accurate. Choose the branch of your selected courier that is nearest and most convenient to you, and enter its name exactly as it appears on the courier's official branch locator or on the branch storefront. The authorization we issue names that branch and no other.</p>
<ol>
<li>Upon submission, the Asset Management Team coordinates with the courier's corporate account management team and issues a formal shipment authorization naming your confirmed branch.</li>
<li>You are copied on that communication.</li>
<li>Do not proceed to the branch until you have received your copy of the authorization, as the branch must first acknowledge the arrangement on their end.</li>
<li>If you need to change the branch after submitting, tell the Asset Management Team before you travel. A new authorization must be issued naming the new branch. A branch that is not named on the authorization cannot accept the shipment under GoTeam's corporate account.</li>
<li>Freight is charged to GoTeam's corporate account at the counter. You will not be asked to pay.</li>
<li>Lodge the shipment during your chosen branch's operating hours on your committed date. Operating hours vary by branch, so confirm them with the branch beforehand.</li>
<li>Ensure the lodgement is completed successfully. If the branch declines the shipment, cannot locate the authorization, or you encounter any other difficulty, contact the Asset Management Team the same day at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</li>
</ol>
</div>
<h2>Equipment Notes</h2>
<div data-form-field id="remote-condition-notes" field-type="paragraph" label="Discrepancies / Condition Notes" hint="Enter any missing items, accessory discrepancies, or condition observations here." required="false"></div>
<h2>Shipping Cost Authorization</h2>
<p>I, {{TM_FULL_NAME}}, acknowledge that my equipment return will be shipped using GoTeam's prescribed corporate courier account, and that the freight cost will be billed directly to GoTeam at the point of shipment. I authorize GoTeam to recover the actual cost of this shipment through payroll processing, where the cost is chargeable to me under GoTeam policy. I acknowledge that the amount recovered is the actual cost of the shipment as confirmed by the courier, and that a copy of the supporting record will be made available to me on request.</p>
<div data-form-field id="remote-shipment-cost" field-type="number" label="Actual Shipment Cost (PHP)" hint="" required="false"></div>
<div data-form-field id="remote-receipt-no" field-type="short_text" label="Courier Receipt No." hint="" required="false"></div>
<div data-form-field id="remote-shipping-signature" field-type="signature" label="Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="remote-shipping-date-signed" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<h2>Declaration</h2>
<p>I, {{TM_FULL_NAME}}, Employee ID {{EMPLOYEE_ID}}, declare and confirm the following:</p>
<ol>
<li>The equipment listed in this acknowledgment is, or was, issued to me by GoTeam and held under my custody and accountability as its assigned custodian.</li>
<li>I acknowledge receipt of the Equipment Return Notice issued to me, and I understand that I am required to return all of the listed equipment to GoTeam's custody.</li>
<li>I agree to ship the listed equipment from the courier branch I have named by the deadline stated.</li>
<li>The equipment I am returning is complete, including all accompanying accessories. Where any listed item is not in my possession, or is not in serviceable condition, I have declared this in the Equipment Notes together with the reason.</li>
<li>I understand that failure to comply may result in the consequences detailed in this notice, including the withholding of the Asset Management Team's clearance sign-off.</li>
<li>The information I have given in this acknowledgment is true and correct to the best of my knowledge. I understand that this acknowledgment forms part of GoTeam's asset records and may be relied upon as evidence of the matters declared here.</li>
</ol>
<div data-form-field id="remote-signature" field-type="signature" label="Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="remote-date-signed" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<div data-message-banner>
<p><strong>Independent Obligation Notice</strong></p>
<p>The obligation to return all company and client-issued equipment is an independent contractual obligation under GoTeam's Asset Management Policy and your employment agreement. This obligation exists regardless of whether this acknowledgment form is signed or returned. GoTeam will rely on the issuance of this notice as formal evidence that the return obligation has been communicated to you.</p>
</div>
`.trim()

// A11 Post-Retrieval Charging's three forms (F1-F3, see
// retrieval-ticket-module/POST_RETRIEVAL_CHARGING_ALIGNMENT_NOTES.md - the
// reference console this whole group is built from). Unlike the two
// return-ack forms above (team-member-completed, hence heavy on
// data-form-field inputs), every field across all three of these is
// Asset Team/officer-entered - the team member's only action anywhere is
// signing at Section 8/7's acknowledgment (confirmed by re-checking every
// "Completed by:" tag in the reference file - see the alignment notes'
// "resolved this pass" #4). So these lean on {{TOKEN}}s for the Case
// Details data already captured at A11 (read-only, filled from the ticket)
// and use data-form-field only where the reference calls for a genuine
// officer judgment call not already modeled as a ticket field (which basis/
// finding letter was picked, the evidence checklist, the recovery schedule
// numbers, the three signatures). The reference's own equipment tables are
// pre-numbered blank rows (10 for F1/F2, 6 for F3) meant for a print-blank
// template; this app's forms are already ticket-bound documents, so - same
// as the two return-ack forms above - the table renders this ticket's own
// real asset row via {{ASSET_NAME}}/{{ASSET_TAG}}/{{SERIAL_NUMBER}} instead
// of literal blank rows.
const atdLossDamageNonReturnHtml = `
<h2>Section 1 - Case Information</h2>
<p>Team Member: {{TM_FULL_NAME}} (Employee ID: {{EMPLOYEE_ID}})<br>Client or Account: {{CLIENT_NAME}}<br>Leadership Coach: {{LEADERSHIP_COACH}}<br>Asset Owner: {{ASSET_OWNER}}<br>Asset Team Officer: {{CASE_OFFICER}}<br>ATD Reference: {{ATD_REFERENCE}}</p>
<p>Date the return was requested: {{DATE_RETURN_REQUESTED}}<br>Return date that was set: {{TARGET_RETURN_DATE}}<br>Date received: {{DATE_RECEIVED}}<br>Date assessed: {{DATE_ASSESSED}}</p>
<h2>Section 2 - Basis</h2>
<p>The equipment was not returned, or was returned in a condition requiring this authority, on one of the following bases:</p>
<ol type="a">
<li>Not returned</li>
<li>Lost or damaged in custody</li>
<li>Returned needing repair</li>
<li>Not returned after international travel</li>
<li>Component not returned</li>
<li>Lost or damaged in transit outside the prescribed courier</li>
</ol>
<div data-form-field id="f1-basis-letter" field-type="short_text" label="Basis selected (letter)" hint="" required="true"></div>
<p>Evidence of issuance and custody on file (at least one required):</p>
<div data-form-field id="f1-evidence-custody" field-type="checkbox" label="Accountability and Custody Agreement" hint="" required="false"></div>
<div data-form-field id="f1-evidence-receiving" field-type="checkbox" label="Receiving Acknowledgment" hint="" required="false"></div>
<div data-form-field id="f1-evidence-amscheckout" field-type="checkbox" label="AMS check-out record" hint="" required="false"></div>
<div data-form-field id="f1-evidence-gatepass" field-type="checkbox" label="Gate pass" hint="" required="false"></div>
<div data-form-field id="f1-evidence-waybill" field-type="checkbox" label="Courier waybill" hint="" required="false"></div>
<div data-form-field id="f1-evidence-written" field-type="checkbox" label="Other written acknowledgment" hint="" required="false"></div>
<h2>Section 3 - Equipment</h2>
<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial No.</th><th>Finding</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_CONDITION}}</td></tr></table>
<h2>Section 4 - Finding</h2>
<p>Select one:</p>
<ol>
<li>Negligence established</li>
<li>Unauthorized modification</li>
<li>Accidental, no negligence</li>
<li>Fair wear and tear, no amount charged</li>
</ol>
<div data-form-field id="f1-finding" field-type="short_text" label="Finding selected" hint="If 'Fair wear and tear, no amount charged' is selected, Sections 5-6 below stay blank and the Team Member does not sign - use T22 instead of this form." required="true"></div>
<h2>Section 5 - Amount</h2>
<p>Basis of the amount: {{AMOUNT_BASIS}}<br>Supporting document reference: {{SUPPORTING_DOC_REF}}<br>Amount in figures: {{AMOUNT_FIGURES}}<br>Amount in words: {{AMOUNT_WORDS}}</p>
<p>This amount is transcribed from the determination recorded at Case Details - it is not negotiated at signing.</p>
<h2>Section 6 - Method of Recovery</h2>
<p>Select one:</p>
<ol>
<li>Single deduction from final pay. No installment schedule applies.</li>
<li>Installment schedule.</li>
</ol>
<div data-form-field id="f1-recovery-method" field-type="short_text" label="Method selected" hint="" required="true"></div>
<div data-form-field id="f1-pay-periods" field-type="number" label="Number of pay periods" hint="Installment schedule only" required="false"></div>
<div data-form-field id="f1-amount-per-period" field-type="short_text" label="Amount per pay period" hint="Installment schedule only" required="false"></div>
<div data-form-field id="f1-first-deduction-date" field-type="short_text" label="First deduction date" hint="Installment schedule only" required="false"></div>
<p>Capped at [CAP]% of net pay per period. Deductions never bring net pay below the statutory minimum wage.</p>
<h2>Section 7 - Statutory Terms</h2>
<div data-callout>
<p>This deduction is made pursuant to Article 113 of the Labor Code of the Philippines and GoTeam's Asset Management Policy. The amount deducted is a fixed, documented amount determined under Section 5 above - it carries no penalty element, no uplift, and no handling charge, and reflects the actual documented cost only. This is not a penalty. The Team Member's right to dispute this determination is preserved and is not waived by signing this authority. Deductions stop once the amount in Section 5 is fully recovered, or earlier if the matter is otherwise resolved or reversed.</p>
</div>
<h2>Section 8 - Signatures</h2>
<p><strong>Team Member</strong> - authorizes the deduction described above.</p>
<div data-form-field id="f1-signature-tm" field-type="signature" label="Team Member Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="f1-date-signed-tm" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<p><strong>Asset Management Team</strong> - issuing officer.</p>
<div data-form-field id="f1-signature-amt" field-type="signature" label="Asset Management Team Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="f1-date-signed-amt" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<p><strong>People and Culture / Payroll</strong> - received for processing.</p>
<div data-form-field id="f1-signature-pc" field-type="signature" label="People and Culture / Payroll Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="f1-date-signed-pc" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<h2>For Office Use Only (Payroll)</h2>
<div data-form-field id="f1-office-received-date" field-type="short_text" label="Received Date" hint="" required="false"></div>
<div data-form-field id="f1-office-payroll-ref" field-type="short_text" label="Payroll Instruction Reference" hint="" required="false"></div>
<div data-form-field id="f1-office-first-deduction" field-type="short_text" label="First Deduction Date" hint="" required="false"></div>
<div data-form-field id="f1-office-fully-recovered" field-type="short_text" label="Fully Recovered Date" hint="" required="false"></div>
<div data-form-field id="f1-office-later-returned" field-type="checkbox" label="Later Returned / Refunded" hint="" required="false"></div>
<div data-form-field id="f1-office-closed-date" field-type="short_text" label="Matter Closed Date" hint="" required="false"></div>
`.trim()

const atdSettlementTransferHtml = `
<h2>Section 1 - Case Information</h2>
<p>Team Member: {{TM_FULL_NAME}} (Employee ID: {{EMPLOYEE_ID}})<br>Client or Account: {{CLIENT_NAME}}<br>Leadership Coach: {{LEADERSHIP_COACH}}<br>Asset Owner: {{ASSET_OWNER}}<br>Asset Team Officer: {{CASE_OFFICER}}<br>ATD Reference: {{ATD_REFERENCE}}</p>
<p>Date the return was requested: {{DATE_RETURN_REQUESTED}}<br>Return date that was set: {{TARGET_RETURN_DATE}}<br>Date of buy-out election: {{DATE_BUYOUT_ELECTION}}</p>
<h2>Section 2 - Election</h2>
<div data-callout>
<p>This is the Team Member's own election, not something GoTeam requires. The Team Member has chosen to keep the equipment in use and settle its value instead of returning it.</p>
</div>
<p>Reason for election - select one:</p>
<ol>
<li>Lost / can't locate</li>
<li>Damaged beyond useful return</li>
<li>Held by a third party</li>
<li>Wishes to retain the asset in use</li>
<li>Other</li>
</ol>
<div data-form-field id="f2-election-reason" field-type="short_text" label="Reason selected" hint="" required="true"></div>
<div data-form-field id="f2-election-channel" field-type="short_text" label="Election recorded via" hint="e.g. email, call with the Asset Team" required="true"></div>
<h2>Section 3 - Equipment</h2>
<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial No.</th><th>Settlement Amount</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_CONDITION}}</td></tr></table>
<h2>Section 4 - Settlement Amount</h2>
<p>Basis of the amount: {{AMOUNT_BASIS}}<br>Supporting document reference: {{SUPPORTING_DOC_REF}}<br>Amount in figures: {{AMOUNT_FIGURES}}<br>Amount in words: {{AMOUNT_WORDS}}</p>
<p>Note: no "repair quotation" option applies to a settlement - the basis above is limited to net book value, replacement cost, or program price.</p>
<h2>Section 5 - Method of Recovery</h2>
<p>Select one:</p>
<ol>
<li>Single deduction from final pay. No installment schedule applies.</li>
<li>Installment schedule.</li>
</ol>
<div data-form-field id="f2-recovery-method" field-type="short_text" label="Method selected" hint="" required="true"></div>
<div data-form-field id="f2-pay-periods" field-type="number" label="Number of pay periods" hint="Installment schedule only" required="false"></div>
<div data-form-field id="f2-amount-per-period" field-type="short_text" label="Amount per pay period" hint="Installment schedule only" required="false"></div>
<div data-form-field id="f2-first-deduction-date" field-type="short_text" label="First deduction date" hint="Installment schedule only" required="false"></div>
<p>Capped at [CAP]% of net pay per period. Deductions never bring net pay below the statutory minimum wage.</p>
<h2>Section 6 - Transfer of Ownership</h2>
<div data-callout>
<p>Title to the equipment passes to the Team Member only on full payment. The equipment is taken as-is, with no warranty from GoTeam. Company and client system access is removed on settlement, and the return obligation is discharged on settlement. If the Team Member later locates the equipment and wishes to return it before the amount above is fully recovered, they may do so - the deduction stops and anything already deducted is refunded.</p>
</div>
<h2>Section 7 - Signatures</h2>
<p><strong>Team Member</strong> - authorizes the deduction and elects settlement as described above.</p>
<div data-form-field id="f2-signature-tm" field-type="signature" label="Team Member Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="f2-date-signed-tm" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<p><strong>Asset Management Team</strong> - issuing officer.</p>
<div data-form-field id="f2-signature-amt" field-type="signature" label="Asset Management Team Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="f2-date-signed-amt" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<p><strong>People and Culture / Payroll</strong> - received for processing.</p>
<div data-form-field id="f2-signature-pc" field-type="signature" label="People and Culture / Payroll Signature" hint="Draw or upload a signature image" required="true"></div>
<div data-form-field id="f2-date-signed-pc" field-type="short_text" label="Date Signed" hint="" required="true"></div>
<h2>For Office Use Only (Payroll)</h2>
<div data-form-field id="f2-office-received-date" field-type="short_text" label="Received Date" hint="" required="false"></div>
<div data-form-field id="f2-office-payroll-ref" field-type="short_text" label="Payroll Instruction Reference" hint="" required="false"></div>
<div data-form-field id="f2-office-first-deduction" field-type="short_text" label="First Deduction Date" hint="" required="false"></div>
<div data-form-field id="f2-office-fully-recovered" field-type="short_text" label="Fully Recovered Date" hint="" required="false"></div>
<div data-form-field id="f2-office-closed-date" field-type="short_text" label="Matter Closed Date" hint="" required="false"></div>
`.trim()

const noticeAssessmentQuotationPendingHtml = `
<h2>Section 1 - Case Information</h2>
<p>Team Member: {{TM_FULL_NAME}} (Employee ID: {{EMPLOYEE_ID}})<br>Client or Account: {{CLIENT_NAME}}<br>Leadership Coach: {{LEADERSHIP_COACH}}<br>Asset Owner: {{ASSET_OWNER}}<br>Asset Team Officer: {{CASE_OFFICER}}</p>
<p>Return date that was set: {{TARGET_RETURN_DATE}}<br>Date received: {{DATE_RECEIVED}}<br>Date assessed: {{DATE_ASSESSED}}</p>
<div data-callout>
<p><strong>This is not an authority to deduct.</strong> This notice is issued the moment damage is found but before a repair quotation exists, so no amount can be stated yet.</p>
</div>
<h2>Section 2 - Equipment</h2>
<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial No.</th><th>Condition Found</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_CONDITION}}</td></tr></table>
<h2>Section 3 - Amount</h2>
<p>Basis of the amount: <em>to be completed on the Authority to Deduct that follows, and only if a charge is proposed.</em></p>
<h2>Section 4 - Observation</h2>
<p>This is a preliminary observation, not a finding. Select one:</p>
<ol>
<li>Impact / liquid / external force - cause to be determined</li>
<li>Component failure in ordinary use - no cost expected</li>
<li>Opening, alteration, or repair outside GoTeam</li>
<li>Fair wear and tear - no cost expected</li>
<li>Cause undetermined</li>
</ol>
<div data-form-field id="f3-observation" field-type="short_text" label="Observation selected" hint="" required="true"></div>
<h2>Section 5 - What Happens Next</h2>
<p>A repair quotation is being obtained. Quotation expected by: {{QUOTATION_EXPECTED_BY}}. You will hear from us by: {{HEAR_BACK_BY}}. Once the quotation is back and a determination is made, a separate Authority to Deduct will follow if a charge is proposed - this notice does not create a charge.</p>
<h2>Section 6 - Acknowledgment of Receipt</h2>
<p>Signing below acknowledges receipt of this notice only. It is not an admission of liability and not an agreement to any amount. If this notice is emailed rather than printed and signed, the sent email itself is the record of issue and no signature is required.</p>
<div data-form-field id="f3-signature" field-type="signature" label="Team Member Signature (receipt acknowledgment only)" hint="Draw or upload a signature image - not required if this notice was sent by email" required="false"></div>
<div data-form-field id="f3-date-signed" field-type="short_text" label="Date Signed" hint="" required="false"></div>
<h2>For Office Use Only (Follow-up Tracking)</h2>
<div data-form-field id="f3-office-quotation-requested-from" field-type="short_text" label="Quotation Requested From" hint="" required="false"></div>
<div data-form-field id="f3-office-date-requested" field-type="short_text" label="Date Requested" hint="" required="false"></div>
<div data-form-field id="f3-office-date-received" field-type="short_text" label="Quotation Received On" hint="" required="false"></div>
<div data-form-field id="f3-office-quotation-ref" field-type="short_text" label="Quotation Reference" hint="" required="false"></div>
<div data-form-field id="f3-office-outcome" field-type="short_text" label="Outcome - No Charge or Charge Proposed" hint="" required="false"></div>
<div data-form-field id="f3-office-determination-date" field-type="short_text" label="Determination Issued On" hint="" required="false"></div>
<div data-form-field id="f3-office-atd-ref" field-type="short_text" label="Authority to Deduct Reference" hint="" required="false"></div>
<div data-form-field id="f3-office-closed-date" field-type="short_text" label="Matter Closed On" hint="" required="false"></div>
`.trim()

/**
 * Brings a form copy saved in localStorage up to the current charging-form
 * wording. Saved copies shadow the seed above, so the edits are applied as
 * targeted, repeatable replacements (never an overwrite) and any other change
 * made in the editor is kept. Safe to run on every load.
 */
export function migrateChargingFormContent(id: string, html: string): string {
  if (!html || !(id in CHARGING_FORM_PATCHES)) return html
  let out = html
  const swap = (from: string | RegExp, to: string) => { out = out.replace(from, to) }
  if (!out.includes('{{LEADERSHIP_COACH}}')) swap('Client or Account: {{CLIENT_NAME}}<br>', 'Client or Account: {{CLIENT_NAME}}<br>Leadership Coach: {{LEADERSHIP_COACH}}<br>')
  if (!out.includes('{{TARGET_RETURN_DATE}}')) {
    if (id === 'notice-assessment-quotation-pending') swap('<p>Date received: {{DATE_RECEIVED}}', '<p>Return date that was set: {{TARGET_RETURN_DATE}}<br>Date received: {{DATE_RECEIVED}}')
    else swap('Date the return was requested: {{DATE_RETURN_REQUESTED}}<br>', 'Date the return was requested: {{DATE_RETURN_REQUESTED}}<br>Return date that was set: {{TARGET_RETURN_DATE}}<br>')
  }
  swap(/<td><div data-form-field id="f1-condition"[^>]*><\/div><\/td>/, '<td>{{ASSET_CONDITION}}</td>')
  swap('<th>Condition on Receipt</th></tr><tr><td>{{ASSET_NAME}}', '<th>Finding</th></tr><tr><td>{{ASSET_NAME}}')
  swap(/<td><div data-form-field id="f3-condition-found"[^>]*><\/div><\/td>/, '<td>{{ASSET_CONDITION}}</td>')
  if (id === 'atd-settlement-transfer') {
    swap('<td>{{SERIAL_NUMBER}}</td><td>{{AMOUNT_FIGURES}}</td>', '<td>{{SERIAL_NUMBER}}</td><td>{{ASSET_CONDITION}}</td>')
    if (!out.includes('{{SUPPORTING_DOC_REF}}')) swap('Basis of the amount: {{AMOUNT_BASIS}}<br>Amount in figures', 'Basis of the amount: {{AMOUNT_BASIS}}<br>Supporting document reference: {{SUPPORTING_DOC_REF}}<br>Amount in figures')
  }
  swap('the moment damage or non-return is found but', 'the moment damage is found but')
  return out
}
const CHARGING_FORM_PATCHES: Record<string, true> = {
  'atd-loss-damage-non-return': true,
  'atd-settlement-transfer': true,
  'notice-assessment-quotation-pending': true
}

export const RETRIEVAL_FORM_CONTENT: Record<string, string> = reactive({
  'return-ack-onsite': onsiteReturnCommitmentHtml,
  'return-ack-remote': remoteReturnCommitmentHtml,
  'atd-loss-damage-non-return': atdLossDamageNonReturnHtml,
  'atd-settlement-transfer': atdSettlementTransferHtml,
  'notice-assessment-quotation-pending': noticeAssessmentQuotationPendingHtml
})

/** A plain (non-reactive) snapshot of the real seeded content above, kept so
 * formStorage.ts can fall back to it if a saved localStorage snapshot ever
 * holds an empty/blank string for one of these two ids - which is exactly
 * what an editor session that got wiped out mid-edit (or a stale snapshot
 * saved before this content existed) would persist, permanently shadowing
 * the real content on every later load even though nothing is actually
 * wrong with the source data. */
export const DEFAULT_RETRIEVAL_FORM_CONTENT: Record<string, string> = {
  'return-ack-onsite': onsiteReturnCommitmentHtml,
  'return-ack-remote': remoteReturnCommitmentHtml,
  'atd-loss-damage-non-return': atdLossDamageNonReturnHtml,
  'atd-settlement-transfer': atdSettlementTransferHtml,
  'notice-assessment-quotation-pending': noticeAssessmentQuotationPendingHtml
}

const SEED_FORMS: RetrievalForm[] = [
  {
    id: 'return-ack-onsite',
    name: 'Equipment Return Acknowledgment (Onsite)',
    description: 'Signed by the team member returning equipment in person, team member and equipment details, an onsite turnover commitment, declaration, and signature.',
    mode: 'onsite',
    status: 'active',
    updatedAt: 'Aug 24, 2026',
    themeColor: '#386BE6',
    pageSize: 'letter',
    category: 'Equipment Return',
    nameManuallySet: true
  },
  {
    id: 'return-ack-remote',
    name: 'Equipment Return Acknowledgment (Remote / Courier)',
    description: 'Signed by the team member shipping equipment back, team member and equipment details, a courier/branch return commitment, shipping cost authorization, declaration, and signature.',
    mode: 'remote',
    status: 'active',
    updatedAt: 'Aug 24, 2026',
    themeColor: '#386BE6',
    pageSize: 'letter',
    category: 'Equipment Return',
    nameManuallySet: true
  },
  // A11 Post-Retrieval Charging's three forms (F1-F3). `mode` has no real
  // meaning for these (they're driven by the deduction outcome, not the
  // ticket's return mode) - set to 'remote' only for the same list-filtering
  // consistency reason noted on T22-T25 in templates.ts, not because they're
  // remote-only.
  {
    id: 'atd-loss-damage-non-return',
    name: 'Authority to Deduct, Asset Loss/Damage/Non-Return',
    description: 'The charge path, basis, evidence, finding, amount, method of recovery, statutory terms, and a three-party signature block (Team Member, Asset Management Team, People & Culture/Payroll).',
    mode: 'remote',
    status: 'active',
    updatedAt: 'Sep 30, 2026',
    themeColor: '#386BE6',
    pageSize: 'letter',
    category: 'Post-Retrieval Charging',
    nameManuallySet: true
  },
  {
    id: 'atd-settlement-transfer',
    name: 'Authority to Deduct, Asset Settlement and Transfer',
    description: "The team member's own election to keep the equipment and pay for it instead of returning it, election, settlement amount, method of recovery, transfer of ownership, and the same three-party signature block.",
    mode: 'remote',
    status: 'active',
    updatedAt: 'Sep 30, 2026',
    themeColor: '#386BE6',
    pageSize: 'letter',
    category: 'Post-Retrieval Charging',
    nameManuallySet: true
  },
  {
    id: 'notice-assessment-quotation-pending',
    name: 'Notice of Assessment, Repair Quotation Pending',
    description: 'An interim notice issued the moment damage is found but before a repair quotation exists, explicitly not an authority to deduct. Receipt-acknowledgment signature only.',
    mode: 'remote',
    status: 'active',
    updatedAt: 'Sep 30, 2026',
    themeColor: '#386BE6',
    pageSize: 'letter',
    category: 'Post-Retrieval Charging',
    nameManuallySet: true
  }
]

export const RETRIEVAL_FORMS: RetrievalForm[] = reactive(SEED_FORMS.map(f => ({ ...f })))

/** ids present at load - shipped-with-production forms, as opposed to ones
 * created or duplicated in the app. Captured before any create/duplicate
 * call can push onto RETRIEVAL_FORMS, so it stays a stable snapshot of just
 * the seed data - used to attribute a form's first version to "System"
 * (seeded) vs. the signed-in user (created in-app), same as email templates. */
export const SEEDED_FORM_IDS = RETRIEVAL_FORMS.map(f => f.id)

/** A plain (non-reactive) snapshot of the real seed records above, by id -
 * lets formStorage.ts restore a seeded form's full record (not just its
 * content, see DEFAULT_RETRIEVAL_FORM_CONTENT below) if a saved localStorage
 * snapshot's `forms` array is ever missing one entirely. This is what a
 * form "disappearing" on reload actually looks like: nothing deletes a form
 * outright in this app, but a saved snapshot captured mid-corruption (e.g.
 * while a broken editor session held stale/partial state) can simply never
 * have included it, and every reload after that replays the same gap. */
export const DEFAULT_RETRIEVAL_FORMS: Record<string, RetrievalForm> = Object.fromEntries(SEED_FORMS.map(f => [f.id, f]))

export function createDraftForm(): RetrievalForm {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled form',
    description: '',
    mode: 'onsite',
    status: 'draft',
    updatedAt: 'Just now',
    themeColor: '#386BE6',
    pageSize: 'letter',
    nameManuallySet: false
  }
}

/**
 * Permanently removes a form - unlike Retire (a status, still in the list,
 * still reachable), this actually drops it from `RETRIEVAL_FORMS` plus its
 * `RETRIEVAL_FORM_SECTIONS`/`RETRIEVAL_FORM_CONTENT` entries. Real deletion
 * (not just editing the seed data here in source) matters for a form that's
 * already reactive/localStorage-backed - a stray draft created in the app,
 * or a seed form removed from source in a later update, otherwise keeps
 * reappearing from whatever snapshot `formStorage.client.ts` already wrote
 * to this browser's localStorage, since that snapshot is applied wholesale
 * on every load and always wins over the current source data. Going through
 * this (a real mutation of the same reactive store everything else already
 * watches) is what lets the deletion itself get picked up and persisted,
 * instead of only ever living in this session's memory.
 */
export function deleteForm(id: string) {
  const index = RETRIEVAL_FORMS.findIndex(f => f.id === id)
  if (index !== -1) RETRIEVAL_FORMS.splice(index, 1)
  delete RETRIEVAL_FORM_SECTIONS[id]
  delete RETRIEVAL_FORM_CONTENT[id]
}

/**
 * Duplicates a form - its metadata, its (legacy) sections/fields, and its
 * real document canvas content - into a brand-new record. Guardrails:
 * - always gets a fresh id, and every section/field gets a fresh id too, so
 *   editing the copy can never bleed back into the original (or vice versa)
 * - always starts as `draft` regardless of the source's status - a duplicate
 *   should never silently go live as `active` (or stay `retired`) without a
 *   deliberate review/publish step
 * - name gets a "(copy)" suffix so it's never confused with the original in a list
 *
 * `sourceContent` is the source form's current `RETRIEVAL_FORM_CONTENT`
 * entry - every form still active in this app has already been through the
 * one-time sections->document migration (see formContentMigration.ts), so
 * that document HTML, not `sourceSections`, is the form's actual current
 * content. Duplicating only `sourceSections` (as this used to) copied stale,
 * pre-migration content - any edit made since then in the document canvas
 * was silently dropped, and a form that migrated to an empty document
 * produced a duplicate whose canvas was empty on open, not a copy of what
 * was actually on screen.
 */
export function duplicateForm(
  source: RetrievalForm,
  sourceSections: FormSection[],
  sourceContent: string
): { form: RetrievalForm, sections: FormSection[], content: string } {
  const form: RetrievalForm = {
    ...JSON.parse(JSON.stringify(source)),
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    status: 'draft',
    updatedAt: 'Just now',
    nameManuallySet: true
  }
  const sections: FormSection[] = JSON.parse(JSON.stringify(sourceSections)).map((section: FormSection) => ({
    ...section,
    id: crypto.randomUUID(),
    fields: section.fields.map(field => ({ ...field, id: crypto.randomUUID() }))
  }))
  return { form, sections, content: sourceContent }
}
