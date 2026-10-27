<script setup lang="ts">
// The banner that asks for a recorded reason when the operator changes
// something that was suggested for them (Reason or Mode at ticket creation).
// It is the app's one banner with a field inside: same stroke, accent bar and
// type scale as every other banner, with a labelled field in its body.
interface Props {
  modelValue: string
  /** The question, for example "Why are you changing the reason?" */
  title: string
  /** What changed, in a sentence: the suggestion against the operator's choice. */
  context: string
  placeholder?: string
  /** Shown in red under the field when the note is still missing. */
  error?: string
}
const props = withDefaults(defineProps<Props>(), { placeholder: '', error: '' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = useId()
const fieldId = `${uid}-field`
const helpId = `${uid}-help`
</script>

<template>
  <SharedBanner tone="warning" icon="i-lucide-pencil-line" :title="props.title">
    {{ props.context }}
    <template #body>
      <label :for="fieldId" class="text-xs font-medium text-default block mb-1.5">
        Your reason <span class="text-red-700 font-normal">(required)</span>
      </label>
      <UTextarea
        :id="fieldId"
        :model-value="props.modelValue"
        :rows="2"
        class="w-full"
        :placeholder="props.placeholder"
        :aria-describedby="helpId"
        :aria-invalid="!!props.error"
        :color="props.error ? 'error' : 'primary'"
        @update:model-value="(v: unknown) => emit('update:modelValue', String(v ?? ''))"
      />
      <p :id="helpId" class="text-xs mt-1.5 flex items-start gap-1.5" :class="props.error ? 'text-red-700' : 'text-muted'">
        <UIcon :name="props.error ? 'i-lucide-circle-alert' : 'i-lucide-info'" class="size-3.5 shrink-0 mt-px" aria-hidden="true" />
        <span>{{ props.error || 'Saved on the ticket so the team can see why it differs.' }}</span>
      </p>
    </template>
  </SharedBanner>
</template>
