import { inject, provide, type InjectionKey, type Ref } from 'vue'

// Whether the document's own structure can be changed right now - the
// toolbar, typing into headings/paragraphs, inserting a new field, and each
// field's own settings gear (label/type/required). Provided by
// FormDocumentEditor.vue itself (see its `editable` prop, the single source
// of truth this mirrors) so FormFieldNodeView.vue can gate its settings gear
// the same way the toolbar is hidden - without this, a field's gear icon
// kept working (and opening its type/label/required editor) even on the
// standalone /form-preview link and the builder's own read-only view, which
// is exactly the "editing leaked into preview" bug this fixes.
const KEY = Symbol('form-structure-editable') as InjectionKey<Ref<boolean>>

export function provideFormStructureEditable(value: Ref<boolean>) {
  provide(KEY, value)
}

export function useFormStructureEditable() {
  return inject(KEY, null)
}
