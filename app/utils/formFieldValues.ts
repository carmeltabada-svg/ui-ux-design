import { inject, provide, reactive, type InjectionKey } from 'vue'

// Lets the page rendering a form (the builder canvas, or the standalone
// /form-preview page) know whether each required field currently has a
// value, without lifting every field's local state into the page itself -
// MasterDataFormDocumentField instances each own their own typed-in value
// (there's no backend to persist to), but the page still needs a yes/no per
// field id to decide whether Submit should be enabled.
//
// Explicit import instead of Nuxt's composables/ auto-import - a new
// composables/ file needs the dev server's auto-import registry to pick it
// up, which can lag a full page (or even trigger a transient
// "useX is not defined" SSR error) until the server restarts. A plain
// explicit import is resolved by Vite immediately, no registry involved.
const KEY = Symbol('form-field-values') as InjectionKey<Record<string, boolean>>

export function provideFormFieldValues() {
  const state = reactive<Record<string, boolean>>({})
  provide(KEY, state)
  return state
}

export function useFormFieldValues() {
  return inject(KEY, null)
}
