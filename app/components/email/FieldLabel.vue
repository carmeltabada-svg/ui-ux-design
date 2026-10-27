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
  <div class="flex items-center justify-between mb-2">
    <label class="text-xs font-normal text-default">
      {{ label }}
      <UBadge v-if="optional" color="neutral" variant="outline" size="sm" class="ml-1.5">Optional</UBadge>
    </label>
  </div>
</template>
