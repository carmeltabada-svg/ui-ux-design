<script setup lang="ts">
// Sized to match EmailModeBadge exactly (text-xs px-1.5 py-0.5 rounded-full) -
// UBadge's own `size="xs"` renders far tinier text than that, which made the
// status pill look mismatched sitting next to an Onsite/Remote badge.
interface Props {
  status: 'active' | 'draft' | 'retired'
}

const props = defineProps<Props>()

const style = computed(() => {
  if (props.status === 'active') return { background: 'rgb(0,127,69)', color: '#fff', borderColor: 'rgb(0,127,69)' }
  if (props.status === 'retired') return { background: 'rgb(137,75,0)', color: '#fff', borderColor: 'rgb(137,75,0)' }
  return { background: 'var(--color-card)', color: 'var(--ui-text-muted)', borderColor: 'var(--ui-border-accented)' }
})
</script>

<template>
  <span class="text-xs font-semibold px-1.5 py-0.5 rounded-full border capitalize shrink-0" :style="style">
    {{ status }}
  </span>
</template>
