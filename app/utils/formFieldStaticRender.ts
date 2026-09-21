import type { FieldRegistryEntry } from '~/utils/formFieldRegistry'

// Turns a document's real `div[data-form-field ...]` markers - the only
// thing `FormFieldNode.renderHTML` ever emits (see ~/utils/formFieldNode.ts;
// the actual visible label/input markup only ever exists in the live Vue
// NodeView, FormFieldNodeView.vue, which nothing else in this codebase
// serializes to plain HTML) - into real static HTML showing each field's
// actual, live-captured answer (see ~/utils/formFieldRegistry.ts's `value`).
// This is what the print/PDF path (/form-preview.vue) feeds to Paged.js -
// Paged.js only ever runs over finalized, read-only HTML, never the live
// interactive ProseMirror document, so this is the one real translation
// point between "what the team member is looking at and typing into" and
// "what gets printed."
export function renderFormFieldsAsStaticHtml(html: string, values: Record<string, FieldRegistryEntry>): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.querySelectorAll('div[data-form-field]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    const label = el.getAttribute('label') || ''
    const hint = el.getAttribute('hint') || ''
    const required = el.getAttribute('required') === 'true'
    const type = el.getAttribute('field-type') || 'short_text'
    const buttonUrl = el.getAttribute('button-url') || ''
    const buttonColor = el.getAttribute('button-color') || 'primary'
    const hideLabel = el.getAttribute('hide-label') === 'true'
    const entry = values[id]
    const value = entry?.value ?? ''

    const star = required ? '<span class="pf-required">*</span>' : ''
    const hintHtml = hint ? `<p class="pf-hint">${esc(hint)}</p>` : ''
    let inner = ''

    switch (type) {
      case 'checkbox': {
        const box = value === 'true'
          ? '<span class="pf-checkbox pf-checkbox-checked">&#10003;</span>'
          : '<span class="pf-checkbox"></span>'
        const labelHtml = hideLabel ? '' : `<span class="pf-label">${esc(label)}${star}</span>`
        inner = `<label class="pf-checkbox-row">${box}${labelHtml}</label>${hintHtml}`
        break
      }
      case 'file_upload': {
        const labelHtml = hideLabel ? '' : `<p class="pf-label">${esc(label)}${star}</p>`
        const body = value
          ? `<img src="${value}" alt="${esc(label)}" class="pf-image">`
          : '<p class="pf-empty">No file attached.</p>'
        inner = `${labelHtml}${body}${hintHtml}`
        break
      }
      case 'signature': {
        const body = value
          ? `<img src="${value}" alt="Signature" class="pf-signature-image">`
          : '<div class="pf-signature-line"></div>'
        const labelHtml = hideLabel ? '' : `<p class="pf-signature-label">${esc(label)}${star}</p>`
        inner = `${body}${labelHtml}${hintHtml}`
        break
      }
      case 'button_link': {
        inner = buttonUrl
          ? `<a href="${esc(buttonUrl)}" class="pf-button pf-button-${esc(buttonColor)}">${esc(label || 'Open link')}</a>`
          : `<span class="pf-button pf-button-${esc(buttonColor)}">${esc(label || 'Open link')}</span>`
        inner += hintHtml
        break
      }
      default: {
        // short_text / paragraph / number
        const shown = value ? esc(value) : '&nbsp;'
        const labelHtml = hideLabel ? '' : `<p class="pf-label">${esc(label)}${star}</p>`
        inner = `${labelHtml}<div class="pf-answer-line">${shown}</div>${hintHtml}`
      }
    }

    // Always plain now (see formFieldNode.ts - the boxed card look was
    // removed everywhere, live editor and print alike).
    const card = doc.createElement('div')
    card.className = 'pf-field'
    card.innerHTML = inner
    el.replaceWith(card)
  })

  return doc.body.innerHTML
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
