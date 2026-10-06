import { inject, provide, type InjectionKey, type Ref } from 'vue'

// Whether this form is attached as the retrieval-form attachment on at least
// one email template - gates the placeholder-insert ("braces") affordance on
// a field's Label/Hint inputs (see FormFieldNodeView.vue), same as the old,
// now-removed `isAttachedToEmail` computed on this page: a form's fields only
// need {{TOKEN}} placeholders once there's an actual email merge context for
// a token to resolve against. Provided by the host page (edit.vue), which is
// the one with access to TEMPLATE_GROUPS/CUSTOM_TEMPLATE_IDS and this form's
// own id; injected inside the NodeView the same way formStructureEditable and
// formFieldsInteractive already are.
const KEY = Symbol('form-attached-to-email') as InjectionKey<Ref<boolean>>

export function provideFormAttachedToEmail(value: Ref<boolean>) {
  provide(KEY, value)
}

export function useFormAttachedToEmail() {
  return inject(KEY, null)
}

// The form's own onsite/remote mode - only needed alongside the flag above,
// to label the Placeholder Library drawer's context badge the same way the
// email editor's own drawer does. Provided/injected the same way.
const MODE_KEY = Symbol('form-mode') as InjectionKey<Ref<'onsite' | 'remote'>>

export function provideFormMode(value: Ref<'onsite' | 'remote'>) {
  provide(MODE_KEY, value)
}

export function useFormMode() {
  return inject(MODE_KEY, null)
}
