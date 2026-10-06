<script setup lang="ts">
interface Props {
  mode: 'onsite' | 'remote'
}

const props = defineProps<Props>()

// matches the original's --onsite (rgb(0,127,69)) and --remote-outline (rgb(112,8,231)) tokens
const style = computed(() => {
  const color = props.mode === 'onsite' ? 'rgb(0,127,69)' : 'rgb(112,8,231)'
  return { borderColor: color, color }
})
</script>

<template>
  <span
    class="text-xs font-semibold px-1.5 py-0.5 rounded-full border bg-white shrink-0"
    :style="style"
  >
    {{ mode === 'onsite' ? 'Onsite' : 'Remote' }}
  </span>
</template>
