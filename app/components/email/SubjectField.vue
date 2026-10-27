<script setup lang="ts">
import { wrapTokens } from '~/data/templates'

interface Props {
  modelValue: string
  editing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editing: false
})

const emit = defineEmits<{ 'update:modelValue': [string]; focus: []; 'open-placeholder': [] }>()

const { onTokenClick } = useTokenHighlight()

const html = computed(() => wrapTokens(props.modelValue))

// Where the author's cursor was in the subject. The input loses focus while the placeholder drawer
// is open, so the position is remembered on blur and moved forward after each insert. `hasCursor`
// stays false until the author has clicked or tabbed into the field in this edit session.
const input = ref<{ inputRef?: HTMLInputElement | null } | null>(null)
const hasCursor = ref(false)
const cursor = ref({ start: 0, end: 0 })
watch(() => props.editing, () => { hasCursor.value = false })

function rememberCursor() {
  const el = input.value?.inputRef
  if (el) cursor.value = { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length }
}

function onFocus() {
  hasCursor.value = true
  emit('focus')
}

/** Inserts text at the remembered cursor, replacing any selected text. Returns false when the author never chose a place. */
function insertAtCursor(text: string): boolean {
  if (!hasCursor.value) return false
  const start = Math.min(cursor.value.start, props.modelValue.length)
  const end = Math.min(cursor.value.end, props.modelValue.length)
  emit('update:modelValue', props.modelValue.slice(0, start) + text + props.modelValue.slice(end))
  cursor.value = { start: start + text.length, end: start + text.length }
  return true
}
defineExpose({ insertAtCursor })
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-2">
      <EmailFieldLabel label="Subject line" class="pt-[10px]" />
      <UTooltip v-if="editing" text="Insert placeholder">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-braces"
          aria-label="Insert placeholder into the subject line"
          @click="emit('open-placeholder')"
        />
      </UTooltip>
    </div>
    <UInput
      v-if="editing"
      ref="input"
      :model-value="modelValue"
      size="lg"
      placeholder="Write a subject line..."
      aria-label="Subject line"
      class="w-full font-semibold mb-1"
      @update:model-value="emit('update:modelValue', String($event))"
      @focus="onFocus"
      @blur="rememberCursor"
    />
    <div
      v-else-if="modelValue"
      class="text-base font-semibold text-highlighted pb-1 leading-relaxed"
      data-pane="editor"
      v-html="html"
      @click="onTokenClick"
    />
    <div v-else class="text-base font-semibold text-dimmed pb-1 leading-relaxed">
      Write a subject line...
    </div>
  </div>
</template>
