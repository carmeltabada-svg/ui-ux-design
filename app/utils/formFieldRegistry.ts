import { inject, provide, reactive, type InjectionKey } from 'vue'

// Document-canvas equivalent of the old builder's `formFieldValues.ts` -
// NodeViews are genuine descendants of whatever page renders
// <MasterDataFormDocumentEditor> (confirmed during the original Umo-era
// spike this replaced: FormKit/UInput both worked with normal Vue
// reactivity inside a NodeView), so provide/inject still works exactly the
// same way it did for the old sections/fields builder. Extended with
// `label`/`required`/`type` (not just a filled boolean) because the
// signature field's lock/veil needs to name what's still missing, not just
// know a yes/no - see `FormFieldNodeView.vue`'s signature branch.
export interface FieldRegistryEntry {
  label: string
  required: boolean
  filled: boolean
  type: string
  /** The field's real, live answer - typed text/number as-is, checkbox as
   * 'true'/'false', signature/uploaded-file as a data URL, '' if empty. Read
   * by the print/PDF path (see ~/utils/formFieldStaticRender.ts) so a printed
   * copy shows what was actually filled in, not a blank template - nothing
   * else in this registry carried the real value before, only whether one
   * existed. */
  value: string
}

const KEY = Symbol('form-field-registry') as InjectionKey<Record<string, FieldRegistryEntry>>

export function provideFormFieldRegistry() {
  const state = reactive<Record<string, FieldRegistryEntry>>({})
  provide(KEY, state)
  return state
}

export function useFormFieldRegistry() {
  return inject(KEY, null)
}
