// The custom Tiptap node representing one typed, validated form field inside
// the form document canvas (see FormDocumentEditor.vue) - the replacement
// for a `FormField` record rendered as a `<tr>` in the old sections/fields
// builder. Confirmed custom-node interop with a real Tiptap document,
// FormKit's incompatibility with a Tiptap NodeView, and a focus-routing
// false alarm during that original build-out - see HANDOFF_SUMMARY.md for
// the full story before changing this.
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import FormFieldNodeView from '~/components/masterData/FormFieldNodeView.vue'

export type DocumentFieldType =
  | 'short_text'
  | 'paragraph'
  | 'number'
  | 'checkbox'
  | 'file_upload'
  | 'signature'
  | 'button_link'

export interface DocumentFieldAttrs {
  id: string
  fieldType: DocumentFieldType
  label: string
  hint: string
  required: boolean
  buttonUrl: string
  buttonColor: string
  /** Every field renders "plain" now - no card border/background at all,
   * in or out of a table cell (a real card-box look was tried and
   * explicitly rejected - see the removed `layout` attribute's history in
   * git if reviving it). This just toggles the field's own label line on/
   * off (short_text/paragraph/number/checkbox/file_upload/signature - see
   * FormFieldNodeView.vue) - defaults on for a standalone field, defaults
   * off when inserted into a table cell (see FormDocumentToolbar.vue's
   * insertField()), where the cell's own left-hand label already names it -
   * either way, always user-togglable via the field's own settings. */
  hideLabel: boolean
}

export const FormFieldNode = Node.create({
  name: 'formField',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    // Explicit parseHTML/renderHTML per attribute, reading/writing the
    // idiomatic kebab-case HTML attribute name (field-type, button-url,
    // ...) - Tiptap's *default* attribute handling (when you don't specify
    // parseHTML) calls `element.getAttribute(name)` with the attrs key
    // exactly as written (camelCase, e.g. "fieldType"), which never matches
    // a kebab-case HTML attribute - confirmed the hard way: an earlier
    // version of this file used bare `{ default: '...' }` entries, and content
    // markup written as `field-type="checkbox"` silently parsed as the
    // *default* value every time (invisible for the one test case that used
    // 'short_text', since default and intended value happened to be the same
    // string, masking the bug until other field types were tried).
    return {
      id: { default: null, parseHTML: el => el.getAttribute('id'), renderHTML: attrs => ({ id: attrs.id }) },
      fieldType: {
        default: 'short_text',
        parseHTML: el => el.getAttribute('field-type'),
        renderHTML: attrs => ({ 'field-type': attrs.fieldType })
      },
      label: {
        default: 'Untitled field',
        parseHTML: el => el.getAttribute('label'),
        renderHTML: attrs => ({ label: attrs.label })
      },
      hint: {
        default: '',
        parseHTML: el => el.getAttribute('hint') || '',
        renderHTML: attrs => ({ hint: attrs.hint })
      },
      required: {
        default: false,
        parseHTML: el => el.getAttribute('required') === 'true',
        renderHTML: attrs => ({ required: String(!!attrs.required) })
      },
      buttonUrl: {
        default: '',
        parseHTML: el => el.getAttribute('button-url') || '',
        renderHTML: attrs => ({ 'button-url': attrs.buttonUrl })
      },
      buttonColor: {
        default: 'primary',
        parseHTML: el => el.getAttribute('button-color') || 'primary',
        renderHTML: attrs => ({ 'button-color': attrs.buttonColor })
      },
      hideLabel: {
        default: false,
        parseHTML: el => el.getAttribute('hide-label') === 'true',
        renderHTML: attrs => ({ 'hide-label': String(!!attrs.hideLabel) })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-form-field]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-form-field': '' })]
  },

  addNodeView(): ReturnType<typeof VueNodeViewRenderer> {
    // Without this, every event inside the NodeView (typing in the input,
    // clicking the settings button) also reaches ProseMirror's own event
    // handling - since this is an atom node, ProseMirror treats a click
    // inside it as "select this whole node" and routes subsequent keystrokes
    // to the surrounding document instead of the input. Returning true here
    // tells ProseMirror this node's own DOM already handled the event -
    // normal, documented Tiptap NodeView behavior for any interactive atom
    // node.
    return VueNodeViewRenderer(FormFieldNodeView, {
      stopEvent: () => true
    })
  }
})
