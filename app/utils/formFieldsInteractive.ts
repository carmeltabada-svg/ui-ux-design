import { inject, provide, type InjectionKey, type Ref } from 'vue'

// Whether a field's own *value* controls (checkbox, text input, file picker,
// signature pad, button link) respond to clicks/typing right now - separate
// from ~/utils/formStructureEditable.ts, which gates changing a field's
// definition (its type/label/required), not filling it in. The two states
// this app actually needs are asymmetric, which is why they're two flags, not
// one: the standalone /form-preview link is fillable but never lets you
// change a field's definition (interactive = true, structureEditable =
// false), while the builder's own read view is the opposite of *that* - a
// pure structural preview a team member never actually fills out (both
// false) - and the builder's edit view allows both (so a field can be test-
// filled while designing it, matching the old sections/fields builder's own
// behavior). Provided by whichever page hosts the document canvas (edit.vue /
// form-preview.vue), not by FormDocumentEditor.vue itself - unlike
// structureEditable, this has no single existing prop it can just mirror.
const KEY = Symbol('form-fields-interactive') as InjectionKey<Ref<boolean>>

export function provideFormFieldsInteractive(value: Ref<boolean>) {
  provide(KEY, value)
}

export function useFormFieldsInteractive() {
  return inject(KEY, null)
}
