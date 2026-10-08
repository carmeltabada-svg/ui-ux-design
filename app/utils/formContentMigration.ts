// One-time converter from the old sections/fields data model to the form
// document canvas's own HTML format (see FormDocumentEditor.vue / the
// `formField` Tiptap node in ~/utils/formFieldNode.ts) - run once per form
// (see edit.vue), the moment a form is opened in the document canvas and no
// `RETRIEVAL_FORM_CONTENT` entry exists for it yet. Not a live two-way sync -
// once a form has real document content, this never runs again for it; the
// old `sections`/`fields` records stay untouched (recoverable) but are no
// longer read from.
import { RETRIEVAL_FORM_CONTENT, RETRIEVAL_FORM_SECTIONS, type FormSection } from '~/data/retrievalForms'
import { escapeAttr as esc } from '~/utils/escapeHtml'

function fieldToHtml(field: FormSection['fields'][number]): string {
  if (field.type === 'static_text') {
    // Already rich HTML (from the old Tiptap-based Text Block editor) -
    // pasted straight in as regular document content, not a formField node -
    // free-form rich text is no longer a distinct field type once the whole
    // form is one document canvas (see HANDOFF_SUMMARY.md).
    return field.content || ''
  }
  const attrs = [
    `id="${esc(field.id)}"`,
    `field-type="${esc(field.type)}"`,
    `label="${esc(field.label)}"`,
    `hint="${esc(field.hint || '')}"`,
    `required="${!!field.required}"`
  ]
  if (field.type === 'button_link') {
    attrs.push(`button-url="${esc(field.buttonUrl || '')}"`)
    attrs.push(`button-color="${esc(field.buttonColor || 'primary')}"`)
  }
  return `<div data-form-field ${attrs.join(' ')}></div>`
}

export function sectionsToDocumentHtml(sections: FormSection[]): string {
  const parts: string[] = []
  for (const section of sections) {
    if (!section.headless && section.title) {
      parts.push(`<h2>${esc(section.title)}</h2>`)
    }
    for (const field of section.fields) {
      parts.push(fieldToHtml(field))
    }
  }
  return parts.join('\n') || '<p></p>'
}

/**
 * Returns a form's real document content, running the one-time
 * sections->document migration first if this form has never been opened in
 * the document canvas yet (in this browser session). Previously only
 * edit.vue ran that migration, on its own setup - which meant any *other*
 * entry point reading `RETRIEVAL_FORM_CONTENT` directly (duplicating a form
 * straight from the templates list, say, without ever having opened that
 * form's own editor first) saw an empty/missing entry and copied nothing,
 * even though the form clearly has real seeded content once you do open it.
 * Every read of a form's content should go through this, not
 * `RETRIEVAL_FORM_CONTENT[id]` directly, so "have I opened this form's
 * editor before" can never change what a duplicate (or anything else) sees.
 */
export function ensureFormContent(formId: string): string {
  if (!RETRIEVAL_FORM_CONTENT[formId]) {
    RETRIEVAL_FORM_CONTENT[formId] = sectionsToDocumentHtml(RETRIEVAL_FORM_SECTIONS[formId] ?? [])
  }
  return RETRIEVAL_FORM_CONTENT[formId]
}
