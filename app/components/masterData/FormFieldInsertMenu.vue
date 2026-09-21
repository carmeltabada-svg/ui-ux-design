<script setup lang="ts">
// Replaces the old drag-from-a-left-palette flow: dragging fields onto a
// canvas isn't always convenient (touch, precision, discoverability), so
// inserting a field is just picking one from a browsable dropdown list
// instead - same field types, no dragging required.
import { FIELD_TYPE_INFO, type FormFieldType } from '~/data/retrievalForms'

withDefaults(defineProps<{ label?: string, sublabel?: string }>(), { label: 'Add field' })

const emit = defineEmits<{
  insert: [FormFieldType]
}>()

const items = computed(() => [
  (Object.keys(FIELD_TYPE_INFO) as FormFieldType[]).map(type => ({
    label: FIELD_TYPE_INFO[type].label,
    icon: FIELD_TYPE_INFO[type].icon,
    onSelect: () => emit('insert', type)
  }))
])
</script>

<template>
  <UDropdownMenu :items="items" :ui="{ content: 'w-56' }">
    <UButton color="primary" variant="outline" size="xs" icon="i-lucide-plus">
      {{ label }}<span v-if="sublabel" class="text-primary/50 font-normal">&nbsp;{{ sublabel }}</span>
    </UButton>
  </UDropdownMenu>
</template>
