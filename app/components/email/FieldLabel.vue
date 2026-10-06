<script setup lang="ts">
interface Props {
  label: string
  /** Shows a small "Optional" tag beside the label - for a field where that
   * matters enough to say up front, not buried in a sentence underneath. */
  optional?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center justify-between mb-1.5">
    <label class="text-xs font-semibold uppercase tracking-wide text-dimmed">
      {{ label }}
      <span v-if="optional" class="ml-1 normal-case font-normal text-dimmed/70">(optional)</span>
    </label>
  </div>
</template>
