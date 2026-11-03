<script setup lang="ts">
// A labelled value inside a SummaryCard: a section label (12px, 600, uppercase, text-dimmed), then the value in
// the slot (`text-base font-semibold text-highlighted`, as on the live Custody page), then an optional supporting line (`text-xs text-muted`).
// Cells sit side by side (`row`) or stacked, separated by a divider the parent draws.
defineProps<{ label: string }>()
</script>

<template>
  <div class="px-4 py-4 min-w-0">
    <p class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-2">{{ label }}</p>
    <div class="text-base font-semibold text-highlighted min-w-0"><slot /></div>
    <p v-if="$slots.sub" class="text-xs text-muted mt-1"><slot name="sub" /></p>
  </div>
</template>
