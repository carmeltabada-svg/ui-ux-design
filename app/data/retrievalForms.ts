import { deepClone } from '~/utils/deepClone'
// Real form content ported verbatim from the source ticket page
// (assets-test.go.team/public/tickets/v2/aof-commitment/...). This is the single
// source of truth for the Retrieval Forms directory - the list page, the
// drag-and-drop builder, and the standalone /form-preview page all render off
// these records instead of holding their own copies.
import { reactive } from 'vue'
import type { RetrievalFormRecord } from '~/api/types'
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

// The old sections/fields model (see FormSection/FormField above) is kept as
// a type/store shape for backward compatibility with formContentMigration.ts,
// but no seeded form still uses it - 'aof-commitment' (the one form that did)
// was removed entirely in favor of the two Equipment Return Acknowledgment
// forms below, which are real Tiptap-document forms from the start (see
// RETRIEVAL_FORM_CONTENT).
export const RETRIEVAL_FORM_SECTIONS: Record<string, FormSection[]> = reactive({})

/** Saved versions per form id (the editor's version history). Kept here, not in the page, so it survives leaving the editor. Saved with its form (see syncedStores.ts). */
export const FORM_VERSIONS: Record<string, unknown[]> = reactive({})

/** Document canvas HTML per form (see FormDocumentEditor.vue), keyed by form
 * id - the replacement for `RETRIEVAL_FORM_SECTIONS` (the old typed
 * sections/fields model, now legacy but kept on disk, not deleted, in case
 * anything still needs it). Starts empty; the form editor lazily converts a
 * form's `sections` into this the first time it's opened after the
 * sections->document migration (see `app/utils/formContentMigration.ts`),
 * then never touches `sections` for that form again. A form created fresh
 * after the migration just starts with an empty document - there's nothing
 * to convert. */
export const RETRIEVAL_FORM_CONTENT: Record<string, string> = reactive({})

export const RETRIEVAL_FORMS: RetrievalForm[] = reactive([])

/** ids of the forms the server ships, as opposed to ones created or duplicated in the app. Used to
 * attribute a form's first version to "System" (shipped) or the signed-in user (created in-app). */
export const SEEDED_FORM_IDS: string[] = []

/** Replaces the forms with what the api layer returned: each record, its document content, its legacy sections and its saved versions. */
export function applyFormRecords(records: RetrievalFormRecord[]) {
  RETRIEVAL_FORMS.splice(0, RETRIEVAL_FORMS.length)
  SEEDED_FORM_IDS.splice(0, SEEDED_FORM_IDS.length)
  for (const store of [RETRIEVAL_FORM_CONTENT, RETRIEVAL_FORM_SECTIONS, FORM_VERSIONS] as Record<string, unknown>[]) {
    for (const key of Object.keys(store)) delete store[key]
  }
  for (const { content, sections, versions, system, ...form } of records) {
    RETRIEVAL_FORMS.push(form)
    if (system) SEEDED_FORM_IDS.push(form.id)
    RETRIEVAL_FORM_CONTENT[form.id] = content
    if (sections.length) RETRIEVAL_FORM_SECTIONS[form.id] = sections
    if (versions.length) FORM_VERSIONS[form.id] = versions
  }
}

export function createDraftForm(): RetrievalForm {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled form',
    description: '',
    mode: 'onsite',
    status: 'draft',
    updatedAt: nowISO(),
    themeColor: '#386BE6',
    pageSize: 'letter',
    nameManuallySet: false
  }
}

/**
 * Permanently removes a form - unlike Retire (a status, still in the list,
 * still reachable), this actually drops it from `RETRIEVAL_FORMS` plus its
 * `RETRIEVAL_FORM_SECTIONS`/`RETRIEVAL_FORM_CONTENT` entries. The removal is
 * noticed and sent to the server as a delete (see syncedStores.ts).
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
    ...deepClone(source),
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    status: 'draft',
    updatedAt: nowISO(),
    nameManuallySet: true
  }
  const sections: FormSection[] = deepClone(sourceSections).map((section: FormSection) => ({
    ...section,
    id: crypto.randomUUID(),
    fields: section.fields.map(field => ({ ...field, id: crypto.randomUUID() }))
  }))
  return { form, sections, content: sourceContent }
}
