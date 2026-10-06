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

export const RETRIEVAL_FORM_CONTENT: Record<string, string> = reactive({
  'return-ack-onsite': onsiteReturnCommitmentHtml,
  'return-ack-remote': remoteReturnCommitmentHtml
})

export const RETRIEVAL_FORMS: RetrievalForm[] = reactive([
  {
    id: 'return-ack-onsite',
    name: 'Equipment Return Acknowledgment (Onsite)',
    description: 'Signed by the team member returning equipment in person - team member and equipment details, an onsite turnover commitment, declaration, and signature.',
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
    description: 'Signed by the team member shipping equipment back - team member and equipment details, a courier/branch return commitment, shipping cost authorization, declaration, and signature.',
    mode: 'remote',
    status: 'active',
    updatedAt: 'Aug 24, 2026',
    themeColor: '#386BE6',
    pageSize: 'letter',
    category: 'Equipment Return',
    nameManuallySet: true
  }
])

/** ids present at load - shipped-with-production forms, as opposed to ones
 * created or duplicated in the app. Captured before any create/duplicate
 * call can push onto RETRIEVAL_FORMS, so it stays a stable snapshot of just
 * the seed data - used to attribute a form's first version to "System"
 * (seeded) vs. the signed-in user (created in-app), same as email templates. */
export const SEEDED_FORM_IDS = RETRIEVAL_FORMS.map(f => f.id)

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
