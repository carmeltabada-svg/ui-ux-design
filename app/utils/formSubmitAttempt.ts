import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

// A separate provide/inject pair from formFieldRegistry.ts (not folded into
// it, to avoid changing that one's already-adopted shape) - lets a Submit
// click make every FormFieldNodeView show its own validation error at once,
// not just the one a person happens to blur. Mirrors the old builder's
// `show-validation` prop, which FormDocumentField.vue read the same way.
const KEY = Symbol('form-submit-attempted') as InjectionKey<Ref<boolean>>

export function provideFormSubmitAttempt() {
  const state = ref(false)
  provide(KEY, state)
  return state
}

export function useFormSubmitAttempt() {
  return inject(KEY, null)
}
