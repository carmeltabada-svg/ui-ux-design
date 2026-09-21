<script setup lang="ts">
// A full-width recipient chip - avatar/name/detail line on the left, action
// buttons on the right, both inside the same bordered container (matching
// the app's own e-signature chip pattern: bordered rounded-lg, not a narrow
// rounded-full pill with buttons dangling outside it).
interface Props {
  name: string
  detail: string
  initials: string
}
defineProps<Props>()
</script>

<template>
  <div class="flex items-center justify-between gap-3 border border-default rounded-lg px-3 py-2 w-full">
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-primary/10 size-8 text-primary text-xs font-bold">
        {{ initials }}
      </span>
      <div class="min-w-0 leading-tight">
        <div class="text-sm font-semibold text-highlighted truncate">{{ name }}</div>
        <div v-if="$slots.detail" class="text-xs text-muted"><slot name="detail" /></div>
        <div v-else class="text-xs text-muted truncate">{{ detail }}</div>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-1.5 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
