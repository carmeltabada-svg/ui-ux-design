<script setup lang="ts">
import type { AutosaveState } from '~/composables/useAutosaveStatus'

interface Props {
  state: AutosaveState
  lastSavedAt?: string
}

defineProps<Props>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-xs shrink-0"
    :class="state === 'offline' ? 'text-error font-medium' : 'text-dimmed'"
  >
    <UIcon v-if="state === 'saving'" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
    <UIcon v-else-if="state === 'offline'" name="i-lucide-cloud-off" class="size-3.5" />
    <UIcon v-else name="i-lucide-cloud-check" class="size-3.5" />

    <span v-if="state === 'saving'">Saving…</span>
    <span v-else-if="state === 'offline'">Can't save - you're offline</span>
    <span v-else-if="lastSavedAt">Saved · {{ lastSavedAt }}</span>
    <span v-else>All changes saved</span>
  </span>
</template>
