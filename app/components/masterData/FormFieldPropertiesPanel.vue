<script setup lang="ts">
import { FIELD_TYPE_INFO, type FormField, type FormFieldType } from '~/data/retrievalForms'

interface Props {
  field: FormField | null
  /** true when this field lives in the "no section" container - it gets its
   * own boxed/plain toggle then, since there's no section layout for it to
   * inherit (a field inside a real section always follows that section's
   * own toggle instead). */
  isOrphan?: boolean
  /** true once this form is attached to at least one email template - forms
   * aren't composed the same way an email body is (no single free-text
   * "body" field), so placeholder tokens are scoped to just the Text Block's
   * rich content and the Label/Hint fields, and only surfaced once there's
   * an actual email merge context for a token to resolve against. */
  placeholdersEnabled?: boolean
}

defineProps<Props>()

const staticTextEditorRef = ref<{ insertToken: (code: string) => void } | null>(null)

defineExpose({
  insertContentToken: (code: string) => staticTextEditorRef.value?.insertToken(code)
})

const layoutItems = [
  { value: 'boxed' as const, label: 'Boxed (default)' },
  { value: 'plain' as const, label: 'Plain' }
]

const emit = defineEmits<{
  update: [Partial<FormField>]
  close: []
  'open-placeholders': ['label' | 'hint' | 'content']
}>()

const typeItems = (Object.keys(FIELD_TYPE_INFO) as FormFieldType[]).map(value => ({
  value,
  label: FIELD_TYPE_INFO[value].label,
  icon: FIELD_TYPE_INFO[value].icon
}))

function changeType(field: FormField, type: FormFieldType) {
  emit('update', {
    type,
    required: type === 'signature' ? true : type === 'button_link' ? false : field.required,
    content: type === 'static_text' ? (field.content ?? '<p>New static text block.</p>') : undefined
  })
}
</script>

<template>
  <!-- Slides in from the right only once a field is actually selected, and
       is entirely absent (not just a collapsed empty "select a field"
       placeholder) otherwise, at every breakpoint - it no longer permanently
       reserves a column on desktop either. `translate-x-full` (off-canvas)
       vs `translate-x-0`, both transitioned, is what gives it the actual
       slide animation rather than a hard show/hide; `fixed` at every
       breakpoint now, not just below `lg`, since there's no in-flow sidebar
       state left to fall back to. No backdrop behind it - a `fixed inset-0`
       dimmer intercepts wheel/touch input over its whole area, which made
       the canvas behind it unscrollable while the panel was open; the
       panel's own close (X) button and clicking the canvas background
       (see the form editor page) are the ways out instead. -->
  <div
    class="flex flex-col fixed inset-y-0 right-0 z-30 w-[88vw] max-w-96 border-l border-default shadow-2xl bg-card min-h-0 overflow-hidden transition-transform duration-200 ease-out"
    :class="field ? 'translate-x-0' : 'translate-x-full pointer-events-none'"
  >
    <template v-if="field">
      <div class="flex items-center justify-between px-4 py-3 border-b border-default shrink-0">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed">Field settings</h3>
        <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-x" aria-label="Close" @click="emit('close')" />
      </div>

      <div class="space-y-4 p-4 overflow-y-auto flex-1 min-h-0 fade-scroll-y">
        <UFormField label="Field type" :ui="{ label: 'text-xs' }">
          <USelectMenu
            :model-value="field.type"
            :items="typeItems"
            value-key="value"
            class="w-full text-sm"
            @update:model-value="(v: FormFieldType) => changeType(field!, v)"
          >
            <template #leading="{ modelValue }">
              <UIcon :name="typeItems.find(t => t.value === modelValue)?.icon ?? 'i-lucide-shapes'" class="size-4" />
            </template>
            <template #item-leading="{ item }">
              <UIcon :name="item.icon" class="size-4" />
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField v-if="isOrphan" label="Layout" hint="no section" :ui="{ label: 'text-xs', labelWrapper: 'justify-start gap-1.5', hint: 'text-dimmed text-xs' }">
          <USelectMenu
            :model-value="field.layout || 'boxed'"
            :items="layoutItems"
            value-key="value"
            class="w-full text-sm"
            @update:model-value="(v) => emit('update', { layout: v })"
          />
        </UFormField>

        <template v-if="field.type !== 'static_text'">
          <UFormField :label="field.type === 'button_link' ? 'Button text' : 'Label'" :ui="{ label: 'text-xs' }">
            <UInput
              :model-value="field.label"
              :placeholder="field.type === 'button_link' ? 'Open link' : undefined"
              class="w-full text-sm"
              @update:model-value="(v) => emit('update', { label: String(v) })"
            >
              <template v-if="placeholdersEnabled" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-braces" aria-label="Insert placeholder" @click="emit('open-placeholders', 'label')" />
              </template>
            </UInput>
          </UFormField>

          <UFormField label="Hint" :ui="{ label: 'text-xs', labelWrapper: 'justify-start gap-1.5' }">
            <template #hint><UBadge color="neutral" variant="outline" size="sm">Optional</UBadge></template>
            <UInput
              :model-value="field.hint"
              class="w-full text-sm"
              @update:model-value="(v) => emit('update', { hint: String(v) })"
            >
              <template v-if="placeholdersEnabled" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-braces" aria-label="Insert placeholder" @click="emit('open-placeholders', 'hint')" />
              </template>
            </UInput>
          </UFormField>

          <UFormField v-if="field.type === 'button_link'" label="Link URL" :ui="{ label: 'text-xs' }">
            <UInput
              :model-value="field.buttonUrl"
              placeholder="https://…"
              class="w-full text-sm"
              @update:model-value="(v) => emit('update', { buttonUrl: String(v) })"
            />
          </UFormField>

          <UCheckbox
            v-if="field.type !== 'signature' && field.type !== 'button_link'"
            :model-value="!!field.required"
            label="Required"
            :ui="{ root: 'items-center', label: 'text-xs' }"
            @update:model-value="(v) => emit('update', { required: !!v })"
          />
          <p v-else-if="field.type === 'signature'" class="text-xs text-dimmed flex items-center gap-1.5">
            <UIcon name="i-lucide-info" class="size-3.5 shrink-0" />
            Signature boxes are always required.
          </p>
        </template>

        <template v-else>
          <!-- Text size lives in the rich-text editor's own toolbar now
               (a per-selection Tiptap mark, not a field-level CSS class) -
               there's no separate control for it here. -->
          <UFormField
            label="Content"
            hint="Text shown on the form"
            :ui="{ label: 'text-xs', labelWrapper: 'justify-start gap-1.5', hint: 'text-dimmed text-xs' }"
          >
            <div v-if="placeholdersEnabled" class="flex justify-end mb-1">
              <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-braces" @click="emit('open-placeholders', 'content')">
                Insert placeholder
              </UButton>
            </div>
            <MasterDataStaticTextEditor
              ref="staticTextEditorRef"
              :model-value="field.content"
              @update:model-value="(v) => emit('update', { content: v })"
            />
          </UFormField>
        </template>
      </div>
    </template>

    <div v-else class="flex-1 flex flex-col items-center justify-center text-center text-muted gap-2 py-12">
      <UIcon name="i-lucide-mouse-pointer-click" class="size-6" />
      <p class="text-xs max-w-[160px]">Select a field on the canvas to edit its settings.</p>
    </div>
  </div>
</template>
