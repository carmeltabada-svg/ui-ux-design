<script setup lang="ts">
// One summary card, used by Custody history and Movements so both read with the same spec: the design
// system's section header strip (12px, 600, uppercase, text-default on slate-50, px-4 py-2.5) over a white
// body, a border and no shadow. The body is the slot; use SummaryCell for each labelled value inside it.
// The title is optional: the live Custody page's second card (Currently with / First deployed to) has no strip.
defineProps<{ title?: string }>()
</script>

<template>
  <section class="flex flex-col rounded-lg border border-default bg-card overflow-hidden">
    <h3 v-if="title" class="px-4 py-2.5 border-b border-default bg-slate-50 dark:bg-gray-800/60 text-xs font-semibold uppercase tracking-wide text-default">{{ title }}</h3>
    <div class="flex-1 min-w-0"><slot /></div>
  </section>
</template>
