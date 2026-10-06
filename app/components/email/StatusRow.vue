<script setup lang="ts">
interface Props {
  unsaved?: boolean
}

withDefaults(defineProps<Props>(), {
  unsaved: false
})
</script>

<template>
  <div v-if="unsaved" class="flex items-center gap-2 flex-wrap text-default">
    <span
      class="text-xs font-medium pl-2 pr-2.5 py-1 rounded-full inline-flex items-center gap-1.5 bg-elevated text-muted"
    >
      <UIcon name="i-lucide-loader" class="size-3.5" />
      Unsaved changes
    </span>
  </div>
</template>
