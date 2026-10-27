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

/**
 * Inserts text at the remembered cursor, replacing any selected text. Returns false when the author never
 * chose a place. The text goes in through the browser's own editing command, so it joins the input's undo
 * history: Ctrl+Z removes the placeholder and Ctrl+Y or Ctrl+Shift+Z puts it back. Setting the value from
 * code would wipe that history. The input takes focus, which is also where Ctrl+Z needs to be pressed.
 */
function insertAtCursor(text: string): boolean {
  if (!hasCursor.value) return false
  const el = input.value?.inputRef
  const start = Math.min(cursor.value.start, props.modelValue.length)
  const end = Math.min(cursor.value.end, props.modelValue.length)
  let done = false
  if (el) {
    el.focus({ preventScroll: true })
    el.setSelectionRange(start, end)
    // Deprecated but still the only way to type into an input and keep native undo; it fires a normal input event.
    done = document.execCommand('insertText', false, text)
  }
  if (!done) {
    emit('update:modelValue', props.modelValue.slice(0, start) + text + props.modelValue.slice(end))
  }
  cursor.value = { start: start + text.length, end: start + text.length }
  return true
}
defineExpose({ insertAtCursor })
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-2 mb-1.5">
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
