<script setup lang="ts" generic="T extends string">
// The filter chip row for the Activity feed and Movements tabs: the same chip as the ticket tracker table
// (small outline button, rounded-full; the active chip is solid primary), with the count in a pill. Both tabs
// place it in the same spot: under the tab header (and summary cards), above the list.
defineProps<{ items: { value: T, label: string, count: number }[], label: string }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 mb-6" role="group" :aria-label="label">
    <UButton
      v-for="f in items"
      :key="f.value"
      :color="model === f.value ? 'primary' : 'neutral'"
      :variant="model === f.value ? 'solid' : 'outline'"
      size="sm"
      class="rounded-full"
      :aria-pressed="model === f.value"
      @click="model = f.value"
    >
      {{ f.label }}
      <UBadge color="neutral" :variant="model === f.value ? 'solid' : 'subtle'" size="sm" class="rounded-full tabular-nums" :class="model === f.value ? 'bg-white/20 text-white' : ''">{{ f.count }}</UBadge>
    </UButton>
  </div>
</template>
