<script setup lang="ts">
interface Props {
  label: string
  mode: 'onsite' | 'remote'
}

defineProps<Props>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-xs font-medium text-primary rounded-full pl-0 pr-1.5 py-1 max-w-full">
    <UIcon name="i-lucide-mail" class="size-3.5 shrink-0" />
    <span class="truncate">{{ label }}</span>
    <EmailModeBadge :mode="mode" />
  </span>
</template>
